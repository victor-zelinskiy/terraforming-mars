<template>
  <!--
    FULLSCREEN CARD ANNOTATION LAYER — the premium rule overlay.

    Floating sci-fi rule blocks in the gutters around the fullscreen card,
    each tethered by a thin gold trace to the graphic element it explains
    (data-graphic-id anchors stamped by the premium face). Content comes
    1:1 from the build-time Card Information Model; placement from the pure
    annotationLayout solver; choreography is a GSAP timeline that starts on
    the host's SETTLE nonce (after the card lands / after a slide), never
    mid-flight — a stage-stability rAF poll additionally guards against a
    still-transforming stage (the console FLIP open).

    The layer is a no-op when the card has no information model, when the
    gutters are too narrow for readable blocks, or under JSDOM (rects are 0).
  -->
  <!-- The root is ALWAYS rendered (empty = an inert pointer-transparent
       div): replay() locates the host <dialog> via $el.closest BEFORE any
       block exists — a v-if root would be a comment node with no closest. -->
  <div class="card-annotations"
       :class="{'card-annotations--compact': compact, 'card-annotations--measuring': measuring}">
    <svg v-if="lines.length > 0" class="card-annotations__lines" aria-hidden="true">
      <g v-for="line in lines"
         :key="line.id"
         class="cal-line"
         :class="{'cal-line--special': line.special, 'cal-line--focus': focusId === line.id}">
        <path :ref="(el) => setPathRef(line.id, el)" :d="line.d" />
        <circle class="cal-line__node" :cx="line.ax" :cy="line.ay" r="2.6"
                :ref="(el) => setNodeRef(line.id, el)" />
      </g>
    </svg>

    <div v-for="a in rendered"
         :key="a.id"
         :ref="(el) => setBlockRef(a.id, el)"
         class="caanno"
         :class="['caanno--' + a.side, {'caanno--special': a.special, 'caanno--focus': focusId === a.id}]"
         :style="blockStyle(a)"
         @mouseenter="setFocus(a.id)"
         @mouseleave="clearFocus(a.id)">
      <span class="caanno__tick caanno__tick--tl" aria-hidden="true"></span>
      <span class="caanno__tick caanno__tick--br" aria-hidden="true"></span>
      <div class="caanno__head">
        <span class="caanno__label">{{ a.label }}</span>
        <span v-if="a.special" class="caanno__star" aria-hidden="true"></span>
      </div>
      <div class="caanno__text">{{ a.displayText }}</div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, nextTick} from 'vue';
import {gsap} from 'gsap';
import {CardName} from '@/common/cards/CardName';
import {getCard} from '@/client/cards/ClientCardManifest';
import {translateText} from '@/client/directives/i18n';
import {motionMs} from '@/client/components/motion/motionTokens';
import {prefersReducedMotion} from '@/client/components/feedback/changeFeedbackManager';
import {buildCardAnnotations, stripKindPrefix, CardAnnotation} from './annotationModel';
import {solveAnnotationLayout, AnnotationSide} from './annotationLayout';

type RenderedAnnotation = CardAnnotation & {
  label: string;
  displayText: string;
  side: AnnotationSide;
  x: number;
  y: number;
};

type TetherLine = {
  id: string;
  d: string;
  ax: number;
  ay: number;
  special: boolean;
};

/**
 * A rule block's resolved card elements. `line` is the EXACT semantic anchor
 * (data-graphic-node / the effect frame / the VP badge) — the tether lands
 * on it and hover-focus rings it. `mark` is the HIGHLIGHT surface: for
 * effects/actions it IS the frame (contour accent, colour identity kept);
 * for on-play/requirement blocks it's the row/bar (block-level treatment).
 */
type ResolvedAnchor = {
  line?: HTMLElement;
  mark?: HTMLElement;
  markVariant: 'frame' | 'block';
};

const EFFECT_KINDS: ReadonlySet<string> = new Set(['effect', 'action', 'action-cost', 'action-result']);

/** Non-reactive per-instance bookkeeping (DOM refs, gsap, poll tokens). */
type AnnotationFx = {
  blockEls: Map<string, HTMLElement | undefined>;
  pathEls: Map<string, SVGPathElement | undefined>;
  nodeEls: Map<string, SVGCircleElement | undefined>;
  markedTargets: Set<HTMLElement>;
  /** annotation id → its resolved card elements (computed once per layout). */
  anchors: Map<string, ResolvedAnchor>;
  /** anchor element → annotation id (reverse hover: card element → block). */
  targetIds: Map<HTMLElement, string>;
  /** the stage element the reverse-hover listeners are attached to. */
  hoverStage?: HTMLElement;
  timeline?: gsap.core.Timeline;
  resizeRaf?: number;
  /** Invalidates an in-flight stage-stability poll (new replay / cleanup). */
  revealToken: number;
};

function cssEscape(value: string): string {
  return typeof CSS !== 'undefined' && CSS.escape !== undefined ? CSS.escape(value) : value.replace(/["\\#.:()~+ ]/g, '\\$&');
}

export default defineComponent({
  name: 'CardAnnotationsLayer',
  props: {
    /** The card on stage (undefined / out-of-scope → the layer is silent). */
    cardName: {
      type: String as () => CardName | undefined,
      required: false,
      default: undefined,
    },
    /**
     * The host's SETTLE signal: bumped when the fullscreen card has landed
     * (open finished / slide finished). Each bump replays the reveal for
     * the CURRENT card; 0 clears the layer (dialog closed).
     */
    nonce: {
      type: Number,
      required: true,
    },
  },
  setup() {
    // Returned plain object: exposed on `this`, typed, NOT made reactive —
    // DOM element maps and the gsap timeline must never be proxied.
    const fx: AnnotationFx = {
      blockEls: new Map(),
      pathEls: new Map(),
      nodeEls: new Map(),
      markedTargets: new Set(),
      anchors: new Map(),
      targetIds: new Map(),
      revealToken: 0,
    };
    return {fx};
  },
  data() {
    return {
      rendered: [] as Array<RenderedAnnotation>,
      lines: [] as Array<TetherLine>,
      width: 0,
      compact: false,
      // True from render until the choreography's initial states are set —
      // the LESS keeps the whole layer invisible, so neither the measuring
      // pass nor the frame before the timeline can flash.
      measuring: false,
      focusId: null as string | null,
    };
  },
  watch: {
    nonce(value: number) {
      if (value > 0) {
        this.replay();
      } else {
        this.clearRendered();
      }
    },
    // The stage card changed (browse slide started / host re-pointed the
    // viewer): the OLD card's blocks must vanish immediately — the settle
    // nonce replays for the new card once it lands.
    cardName() {
      this.clearRendered();
    },
  },
  mounted() {
    window.addEventListener('resize', this.onResize);
    if (this.nonce > 0) {
      this.replay();
    }
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.onResize);
    this.cleanup();
  },
  methods: {
    /* ── refs bookkeeping (typed maps — v-for function refs) ─────────── */
    setBlockRef(id: string, el: unknown) {
      this.fx.blockEls.set(id, (el as HTMLElement | null) ?? undefined);
    },
    setPathRef(id: string, el: unknown) {
      this.fx.pathEls.set(id, (el as SVGPathElement | null) ?? undefined);
    },
    setNodeRef(id: string, el: unknown) {
      this.fx.nodeEls.set(id, (el as SVGCircleElement | null) ?? undefined);
    },

    /* ── host DOM lookups ────────────────────────────────────────────── */
    dialogEl(): HTMLElement | null {
      return (this.$el as HTMLElement | null)?.closest?.('dialog') ?? null;
    },
    stageCardEl(): HTMLElement | null {
      // Only the premium face carries graphic anchors; a legacy / bonus face
      // on stage → null → the layer stays silent.
      return this.dialogEl()?.querySelector<HTMLElement>('.card-zoom-stage .pcard') ?? null;
    },
    /** The annotation's ROW element (data-graphic-id + documented fallbacks). */
    rowEl(stage: HTMLElement, graphicId: string | undefined): HTMLElement | null {
      if (graphicId === undefined) {
        return null;
      }
      const exact = stage.querySelector<HTMLElement>(`[data-graphic-id="${cssEscape(graphicId)}"]`);
      if (exact !== null) {
        return exact;
      }
      if (graphicId.startsWith('req:')) {
        return stage.querySelector<HTMLElement>('.pcard__reqs');
      }
      if (graphicId === 'vp') {
        return stage.querySelector<HTMLElement>('.pcard__vp');
      }
      return stage.querySelector<HTMLElement>('.pcard__mech');
    },
    /**
     * Resolve the EXACT anchors: the tether target (`line`) and the
     * highlight surface (`mark`). Effects/actions and the VP badge use
     * their own frame (contour accent); on-play/requirement blocks keep the
     * block-level mark on the row/bar while the line lands on the specific
     * node the text describes (data-graphic-node).
     */
    resolveAnchor(stage: HTMLElement, a: CardAnnotation): ResolvedAnchor {
      const row = this.rowEl(stage, a.graphicId);
      if (row === null) {
        return {markVariant: 'block'};
      }
      if (EFFECT_KINDS.has(a.kind)) {
        const frame = row.querySelector<HTMLElement>('.pcard-effect') ?? row;
        return {line: frame, mark: frame, markVariant: 'frame'};
      }
      if (a.graphicId === 'vp' || a.kind === 'victory-points') {
        return {line: row, mark: row, markVariant: 'frame'};
      }
      const node = a.graphicNode !== undefined ?
        row.querySelector<HTMLElement>(`[data-graphic-node="${cssEscape(a.graphicNode)}"]`) :
        null;
      return {line: node ?? row, mark: row, markVariant: 'block'};
    },

    /* ── the reveal ──────────────────────────────────────────────────── */
    replay() {
      this.cleanup();
      this.rendered = [];
      this.lines = [];
      const clientCard = this.cardName !== undefined ? getCard(this.cardName) : undefined;
      const annotations = clientCard !== undefined ? buildCardAnnotations(clientCard) : [];
      const stage = this.stageCardEl();
      if (annotations.length === 0 || stage === null) {
        return;
      }
      // Never measure a still-moving stage: the console FLIP open transforms
      // `.card-zoom-stage` while the settle beat is approximate. Wait until
      // the card's rect is identical across two consecutive frames.
      this.awaitStableStage(stage, () => this.beginMeasure(annotations, stage));
    },

    /**
     * Bounded rAF poll for stage-rect stability. Bails silently for a
     * zero-width stage (JSDOM / not laid out) and when a newer replay or
     * cleanup superseded this poll (`revealToken`).
     */
    awaitStableStage(stage: HTMLElement, ready: () => void) {
      const token = ++this.fx.revealToken;
      if (typeof requestAnimationFrame !== 'function') {
        if (stage.getBoundingClientRect().width > 0) {
          ready();
        }
        return;
      }
      let last = '';
      let same = 0;
      let tries = 0;
      const step = () => {
        if (token !== this.fx.revealToken) {
          return; // superseded
        }
        const r = stage.getBoundingClientRect();
        const sig = `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)}`;
        if (r.width > 0 && sig === last) {
          same++;
        } else {
          same = 0;
        }
        last = sig;
        if (same >= 2) {
          ready();
          return;
        }
        if (++tries > 60) {
          if (r.width > 0) {
            ready(); // never settled perfectly — still show, honest fallback
          }
          return; // zero-width after the budget: silent no-op
        }
        requestAnimationFrame(step);
      };
      step();
    },

    /** Phase 1: width from the gutters alone; render hidden for measuring. */
    beginMeasure(annotations: Array<CardAnnotation>, stage: HTMLElement) {
      const cardRect = stage.getBoundingClientRect();
      const probe = solveAnnotationLayout({
        items: annotations.map((a) => ({id: a.id, anchorY: 0, height: 40})),
        cardRect,
        viewport: {width: window.innerWidth, height: window.innerHeight},
        edgePad: this.edgePad(),
      });
      if (probe === null) {
        return; // gutters too narrow — graceful absence, never mush
      }
      this.width = probe.width;
      this.compact = annotations.length > 5;
      this.measuring = true;
      this.rendered = annotations.map((a) => ({
        ...a,
        label: translateText(a.labelKey),
        displayText: stripKindPrefix(translateText(a.text)),
        side: 'left',
        x: 0,
        y: 0,
      }));
      nextTick(() => this.position(true));
    },

    edgePad(): number {
      // Reserve the nav-arrow zone when the viewer is in browse mode.
      return this.dialogEl()?.querySelector('.card-zoom-nav-slot') !== null ? 96 : 24;
    },

    /**
     * Phase 2 (post-measure): solve the real layout from measured block
     * heights + anchor rects, apply positions, build the tether lines.
     * `animate` = fresh reveal (GSAP choreography); false = silent
     * reposition (resize).
     */
    position(animate: boolean) {
      const stage = this.stageCardEl();
      if (stage === null || this.rendered.length === 0) {
        return;
      }
      const cardRect = stage.getBoundingClientRect();
      const cardCenterX = (cardRect.left + cardRect.right) / 2;
      this.fx.anchors.clear();
      const anchors = new Map<string, DOMRect>();
      for (const a of this.rendered) {
        const resolved = this.resolveAnchor(stage, a);
        this.fx.anchors.set(a.id, resolved);
        if (resolved.line !== undefined) {
          anchors.set(a.id, resolved.line.getBoundingClientRect());
        }
      }
      const layout = solveAnnotationLayout({
        items: this.rendered.map((a) => {
          const rect = anchors.get(a.id);
          // Side bias from the EXACT anchor's horizontal position: a block
          // reads best beside the element it explains (short, direct line).
          // Wide anchors (the full-width reqs bar / whole rows) are 'free'.
          let bias: 'left' | 'right' | 'free' = 'free';
          if (rect !== undefined && rect.width <= cardRect.width * 0.6) {
            bias = (rect.left + rect.right) / 2 <= cardCenterX ? 'left' : 'right';
          }
          return {
            id: a.id,
            anchorY: rect !== undefined ? (rect.top + rect.bottom) / 2 : (cardRect.top + cardRect.bottom) / 2,
            height: this.fx.blockEls.get(a.id)?.offsetHeight ?? 40,
            bias,
          };
        }),
        cardRect,
        viewport: {width: window.innerWidth, height: window.innerHeight},
        edgePad: this.edgePad(),
      });
      if (layout === null) {
        this.clearRendered();
        return;
      }
      this.compact = layout.compact;
      const byId = new Map(layout.placements.map((p) => [p.id, p]));
      for (const a of this.rendered) {
        const p = byId.get(a.id);
        if (p !== undefined) {
          a.side = p.side;
          a.x = p.x;
          a.y = p.y;
        }
      }
      this.buildLines(anchors);
      // NOTE: `measuring` stays true until the choreography has applied the
      // initial (hidden) states — no flash between layout and animation.
      nextTick(() => {
        if (animate) {
          this.play(stage);
        } else {
          this.applyFinalStates(stage);
        }
      });
    },

    buildLines(anchors: Map<string, DOMRect>) {
      const lines: Array<TetherLine> = [];
      for (const a of this.rendered) {
        const rect = anchors.get(a.id);
        if (rect === undefined) {
          continue; // block without a resolvable anchor — no line, no noise
        }
        const height = this.fx.blockEls.get(a.id)?.offsetHeight ?? 40;
        const by = a.y + Math.min(height / 2, 30);
        const bx = a.side === 'left' ? a.x + this.width : a.x;
        // The endpoint sits just OUTSIDE the exact element's near edge — the
        // anchor dot touches the node it explains, never covers its art.
        const ax = a.side === 'left' ? rect.left - 4 : rect.right + 4;
        const ay = rect.top + rect.height / 2;
        // elbow trace: horizontal run, then a short approach to the anchor
        const xm = a.side === 'left' ? ax - 16 : ax + 16;
        const d = `M ${bx} ${by} L ${xm} ${by} L ${ax} ${ay}`;
        lines.push({id: a.id, d, ax, ay, special: a.special});
      }
      this.lines = lines;
    },

    /* ── choreography ────────────────────────────────────────────────── */
    play(stage: HTMLElement) {
      this.killTimeline();
      if (prefersReducedMotion()) {
        this.applyFinalStates(stage);
        return;
      }
      const ordered = [...this.rendered].sort((a, b) => a.order - b.order);
      // Set EVERY initial (hidden) state synchronously, then unveil the layer
      // — no element can flash at its final state before its tween starts.
      for (const a of ordered) {
        const block = this.fx.blockEls.get(a.id);
        if (block !== undefined) {
          gsap.set(block, {autoAlpha: 0, x: a.side === 'left' ? -12 : 12});
        }
        const path = this.fx.pathEls.get(a.id);
        if (path !== undefined && typeof path.getTotalLength === 'function') {
          const len = path.getTotalLength();
          gsap.set(path, {strokeDasharray: len, strokeDashoffset: len});
        }
        const node = this.fx.nodeEls.get(a.id);
        if (node !== undefined) {
          gsap.set(node, {scale: 0, transformOrigin: 'center'});
        }
      }
      this.measuring = false;
      const tl = gsap.timeline();
      this.fx.timeline = tl;
      const step = motionMs(70) / 1000;
      ordered.forEach((a, i) => {
        const block = this.fx.blockEls.get(a.id);
        if (block === undefined) {
          return;
        }
        const at = i * step;
        tl.to(block, {autoAlpha: 1, x: 0, duration: motionMs(240) / 1000, ease: 'power2.out'}, at);
        const path = this.fx.pathEls.get(a.id);
        if (path !== undefined && typeof path.getTotalLength === 'function') {
          tl.to(path, {strokeDashoffset: 0, duration: motionMs(300) / 1000, ease: 'power1.inOut'}, at + 0.10);
        }
        const node = this.fx.nodeEls.get(a.id);
        if (node !== undefined) {
          tl.to(node, {scale: 1, duration: motionMs(180) / 1000, ease: 'back.out(2.2)'}, at + 0.26);
        }
        tl.call(() => this.markTarget(a), undefined, at + 0.24);
      });
      this.armReverseHover(stage);
    },

    /** Reduced-motion / reposition path: final states, no tweens. */
    applyFinalStates(stage: HTMLElement) {
      for (const a of this.rendered) {
        const block = this.fx.blockEls.get(a.id);
        if (block !== undefined) {
          gsap.set(block, {autoAlpha: 1, x: 0});
        }
        const path = this.fx.pathEls.get(a.id);
        if (path !== undefined) {
          gsap.set(path, {strokeDasharray: 'none', strokeDashoffset: 0});
        }
        const node = this.fx.nodeEls.get(a.id);
        if (node !== undefined) {
          gsap.set(node, {scale: 1, transformOrigin: 'center'});
        }
        this.markTarget(a);
      }
      this.measuring = false;
      this.armReverseHover(stage);
    },

    markTarget(a: RenderedAnnotation) {
      const resolved = this.fx.anchors.get(a.id);
      if (resolved === undefined) {
        return;
      }
      const mark = resolved.mark;
      if (mark !== undefined) {
        mark.classList.add('caanno-target', `caanno-target--${resolved.markVariant}`);
        if (a.special) {
          mark.classList.add('caanno-target--special');
        }
        this.fx.markedTargets.add(mark);
        if (!this.fx.targetIds.has(mark)) {
          this.fx.targetIds.set(mark, a.id); // a shared row keeps its first block
        }
      }
      // The EXACT node is a reverse-hover hotspot of its own (visual-less
      // class) — pointing at the node accents ITS block, not the row's first.
      const line = resolved.line;
      if (line !== undefined && line !== mark) {
        line.classList.add('caanno-node');
        this.fx.markedTargets.add(line);
        this.fx.targetIds.set(line, a.id);
      }
    },

    /* ── focus interplay (block ↔ card element, both directions) ─────── */
    /** The element the focus ring rides: the EXACT anchor, else the mark. */
    focusEl(id: string): HTMLElement | undefined {
      const resolved = this.fx.anchors.get(id);
      return resolved?.line ?? resolved?.mark;
    },
    setFocus(id: string) {
      this.focusId = id;
      this.focusEl(id)?.classList.add('caanno-target--focus');
    },
    clearFocus(id: string) {
      if (this.focusId === id) {
        this.focusId = null;
      }
      this.focusEl(id)?.classList.remove('caanno-target--focus');
    },
    /** Delegated hover on the CARD: pointing at a marked element accents its block. */
    armReverseHover(stage: HTMLElement) {
      if (this.fx.hoverStage === stage) {
        return;
      }
      this.disarmReverseHover();
      stage.addEventListener('mouseover', this.onStageOver);
      stage.addEventListener('mouseout', this.onStageOut);
      this.fx.hoverStage = stage;
    },
    disarmReverseHover() {
      const stage = this.fx.hoverStage;
      if (stage !== undefined) {
        stage.removeEventListener('mouseover', this.onStageOver);
        stage.removeEventListener('mouseout', this.onStageOut);
        this.fx.hoverStage = undefined;
      }
    },
    onStageOver(e: Event) {
      // The exact node hotspot wins over its host row (closest walks up).
      const target = (e.target as HTMLElement | null)?.closest?.('.caanno-node, .caanno-target');
      if (target === null || target === undefined) {
        return;
      }
      const id = this.fx.targetIds.get(target as HTMLElement);
      if (id !== undefined) {
        this.setFocus(id);
      }
    },
    onStageOut(e: Event) {
      const target = (e.target as HTMLElement | null)?.closest?.('.caanno-node, .caanno-target');
      if (target === null || target === undefined) {
        return;
      }
      const related = (e as MouseEvent).relatedTarget as Node | null;
      if (related !== null && target.contains(related)) {
        return; // still inside the same anchor
      }
      const id = this.fx.targetIds.get(target as HTMLElement);
      if (id !== undefined) {
        this.clearFocus(id);
      }
    },

    /* ── resize ──────────────────────────────────────────────────────── */
    onResize() {
      if (this.rendered.length === 0 || this.fx.resizeRaf !== undefined) {
        return;
      }
      this.fx.resizeRaf = window.requestAnimationFrame(() => {
        this.fx.resizeRaf = undefined;
        this.killTimeline();
        this.position(false);
      });
    },

    /* ── lifecycle hygiene ───────────────────────────────────────────── */
    killTimeline() {
      this.fx.timeline?.kill();
      this.fx.timeline = undefined;
    },
    /** Full teardown of side effects (marks, listeners, tweens, polls). */
    cleanup() {
      this.fx.revealToken++; // invalidate any in-flight stability poll
      this.killTimeline();
      this.disarmReverseHover();
      if (this.fx.resizeRaf !== undefined) {
        window.cancelAnimationFrame(this.fx.resizeRaf);
        this.fx.resizeRaf = undefined;
      }
      for (const el of this.fx.markedTargets) {
        el.classList.remove(
          'caanno-target', 'caanno-target--frame', 'caanno-target--block',
          'caanno-target--special', 'caanno-target--focus', 'caanno-node');
      }
      this.fx.markedTargets.clear();
      this.fx.anchors.clear();
      this.fx.targetIds.clear();
      this.fx.blockEls.clear();
      this.fx.pathEls.clear();
      this.fx.nodeEls.clear();
      this.focusId = null;
    },
    /** Cleanup + drop the rendered blocks (card left the stage / closed). */
    clearRendered() {
      this.cleanup();
      this.rendered = [];
      this.lines = [];
      this.measuring = false;
    },
    blockStyle(a: RenderedAnnotation): Record<string, string> {
      return {
        left: `${a.x}px`,
        top: `${a.y}px`,
        width: `${this.width}px`,
      };
    },
  },
});
</script>
