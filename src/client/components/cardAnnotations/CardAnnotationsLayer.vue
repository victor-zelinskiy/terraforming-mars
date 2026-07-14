<template>
  <!--
    FULLSCREEN CARD ANNOTATION LAYER — the premium rule overlay.

    ONE floating sci-fi rule block per SEMANTIC TYPE in the gutters around
    the fullscreen card (requirement / effect / action / «При розыгрыше» /
    VP / special rule), each tethered by a thin gold trace to the graphic
    element it explains: effect & action frames, the card-native play-rail
    (the on-play zone opener), the requirements bar, the VP badge. Content
    comes from the build-time Card Information Model grouped by type;
    placement from the pure annotationLayout solver; choreography is a GSAP
    timeline that starts on the host's SETTLE nonce (after the card lands /
    after a slide), never mid-flight — a stage-stability rAF poll
    additionally guards against a still-transforming stage (console FLIP).

    Targets are NEVER permanently highlighted: a short premium pulse plays
    exactly when a tether CONNECTS, then the card returns to its calm
    resting state. Focus (mouse hover / console right stick) re-accents the
    tether + target temporarily.

    The root is ALWAYS rendered (empty = an inert pointer-transparent div):
    replay() locates the host <dialog> via $el.closest BEFORE any block
    exists — a v-if root would be a comment node with no closest. The layer
    is a no-op when the card has no information model, when the gutters are
    too narrow for readable blocks, or under JSDOM (rects are 0).
  -->
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
      <!-- single rule → plain text; composite type → light internal rows
           (hovering a row accents ITS exact card element). The «any player»
           words that explain a red «{all}» bezel render in the accent colour. -->
      <div v-if="a.rows.length === 1" class="caanno__text">
        <span v-for="(s, si) in a.rows[0].segments" :key="si" :class="{'caanno__any': s.any}">{{ s.text }}</span>
      </div>
      <div v-else class="caanno__rows">
        <div v-for="r in a.rows"
             :key="r.id"
             class="caanno__row"
             @mouseenter="focusRow(r)"
             @mouseleave="unfocusRow()">
          <span v-if="r.special" class="caanno__row-star" aria-hidden="true"></span>
          <span class="caanno__row-text"><span v-for="(s, si) in r.segments" :key="si" :class="{'caanno__any': s.any}">{{ s.text }}</span></span>
        </div>
      </div>
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
import {buildCardAnnotations, stripKindPrefix, segmentAnyPlayer, CardAnnotation, CardAnnotationRow, AnnotationTextSegment} from './annotationModel';
import {solveAnnotationLayout, routeTether, AnnotationSide, TetherRect} from './annotationLayout';
import {AnnotationTraversal, registerAnnotationTraversal, unregisterAnnotationTraversal} from './annotationFocusBus';

type RenderedRow = CardAnnotationRow & {
  displayText: string;
  /** Text split into plain / accented «any player» segments (see the model). */
  segments: Array<AnnotationTextSegment>;
};

type RenderedAnnotation = Omit<CardAnnotation, 'rows'> & {
  rows: Array<RenderedRow>;
  label: string;
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
 * A rule block's resolved card elements. `line` is the EXACT tether target
 * (the play-rail / an effect frame / the VP badge / a data-graphic-node);
 * `mark` is the CONNECTION-PULSE surface. Variants: 'frame' (contour of an
 * effect/action/VP element — colour identity preserved), 'block' (row/bar
 * level), 'rail' (the play-rail light sweep).
 */
type ResolvedAnchor = {
  line?: HTMLElement;
  mark?: HTMLElement;
  markVariant: 'frame' | 'block' | 'rail';
};

const PULSE_CLASSES = ['caanno-pulse', 'caanno-pulse--frame', 'caanno-pulse--block', 'caanno-pulse--rail', 'caanno-pulse--special'];

/** Non-reactive per-instance bookkeeping (DOM refs, gsap, poll tokens). */
type AnnotationFx = {
  blockEls: Map<string, HTMLElement | undefined>;
  pathEls: Map<string, SVGPathElement | undefined>;
  nodeEls: Map<string, SVGCircleElement | undefined>;
  /** Every card element the layer touched (hotspots / pulses / focus). */
  markedTargets: Set<HTMLElement>;
  /** annotation id → its resolved card elements (computed once per layout). */
  anchors: Map<string, ResolvedAnchor>;
  /** anchor element → annotation id (reverse hover: card element → block). */
  targetIds: Map<HTMLElement, string>;
  /** the stage element the reverse-hover listeners are attached to. */
  hoverStage?: HTMLElement;
  /** the element ringed by a ROW-level hover (sub-anchor precision). */
  rowFocusEl?: HTMLElement;
  /** pending connection-pulse cleanups. */
  pulseTimers: Set<number>;
  /** the registered right-stick traversal handler (console). */
  traversal?: AnnotationTraversal;
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
      pulseTimers: new Set(),
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
        // nonce → 0 = the viewer is CLOSING. Fade the rule blocks + tethers
        // out FIRST (a quick premium dismiss), so they're gone before the
        // card's close flight — never lingering through the flight and
        // vanishing at the end. (`cardName` change stays an instant clear —
        // the old card's blocks must not bleed into the new card's reveal.)
        this.dismiss();
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
      if (graphicId === 'tags') {
        // A rule ABOUT the printed tags tethers to the tag cluster (Research
        // Coordination's wild-tag rule → the wild medallion).
        return stage.querySelector<HTMLElement>('.pcard__tags');
      }
      return stage.querySelector<HTMLElement>('.pcard__mech');
    },
    /** A row's EXACT element: its data-graphic-node, else its row. */
    rowAnchorEl(stage: HTMLElement, row: CardAnnotationRow): HTMLElement | null {
      const host = this.rowEl(stage, row.graphicId);
      if (host === null) {
        return null;
      }
      if (row.graphicNode !== undefined) {
        return host.querySelector<HTMLElement>(`[data-graphic-node="${cssEscape(row.graphicNode)}"]`) ?? host;
      }
      return host;
    },
    /**
     * Resolve a GROUP's anchors: the tether target (`line`) and the
     * connection-pulse surface (`mark`).
     *  - «При розыгрыше» → the card-native play-rail (the zone opener);
     *  - effect / action → the frame element (contour semantics);
     *  - VP → the badge; requirement → the bar; note → floats untethered.
     */
    resolveAnchor(stage: HTMLElement, a: CardAnnotation): ResolvedAnchor {
      if (a.kind === 'immediate') {
        const rail = stage.querySelector<HTMLElement>('.pcard-play-rail');
        if (rail !== null) {
          return {line: rail, mark: rail, markVariant: 'rail'};
        }
      }
      const row = this.rowEl(stage, a.graphicId);
      if (row === null) {
        return {markVariant: 'block'};
      }
      if (a.kind === 'effect' || a.kind === 'action') {
        const frame = row.querySelector<HTMLElement>('.pcard-effect') ?? row;
        return {line: frame, mark: frame, markVariant: 'frame'};
      }
      if (a.kind === 'victory-points') {
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
        rows: a.rows.map((r) => {
          const displayText = stripKindPrefix(translateText(r.text));
          return {...r, displayText, segments: this.textSegments(displayText, r.anyPlayer)};
        }),
        label: translateText(a.labelKey),
        side: 'left' as AnnotationSide,
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
          // Wide anchors (the play-rail / reqs bar / whole rows) are 'free'.
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
      // Keep every trace off the card's bottom-left service elements (the
      // engraved expansion stamp + the resource counter) — the router
      // detours around them, the pretty elbow stays when the way is clear.
      const obstacles = this.serviceObstacles();
      const lines: Array<TetherLine> = [];
      for (const a of this.rendered) {
        const rect = anchors.get(a.id);
        if (rect === undefined) {
          continue; // block without a resolvable anchor — no line, no noise
        }
        const height = this.fx.blockEls.get(a.id)?.offsetHeight ?? 40;
        const by = a.y + Math.min(height / 2, 30);
        const bx = a.side === 'left' ? a.x + this.width : a.x;
        const {d, ax, ay} = routeTether({bx, by, anchor: rect, side: a.side, obstacles});
        lines.push({id: a.id, d, ax, ay, special: a.special});
      }
      this.lines = lines;
    },

    /** The card's bottom-left service elements a trace must avoid. */
    serviceObstacles(): Array<TetherRect> {
      const stage = this.stageCardEl();
      if (stage === null) {
        return [];
      }
      const rects: Array<TetherRect> = [];
      for (const sel of ['.pcard__exp', '.pcard__res']) {
        const el = stage.querySelector<HTMLElement>(sel);
        if (el === null) {
          continue;
        }
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          rects.push({left: r.left, right: r.right, top: r.top, bottom: r.bottom});
        }
      }
      return rects;
    },

    /* ── choreography ────────────────────────────────────────────────── */
    play(stage: HTMLElement) {
      this.killTimeline();
      const ordered = [...this.rendered].sort((a, b) => a.order - b.order);
      // Hover/traversal hotspots are static bookkeeping — arm them upfront.
      for (const a of ordered) {
        this.registerTarget(a);
      }
      this.armReverseHover(stage);
      this.armTraversal();
      if (prefersReducedMotion()) {
        this.applyFinalStatesInner();
        return;
      }
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
      const step = motionMs(90) / 1000;
      const lineDelay = motionMs(110) / 1000;
      const lineDur = motionMs(300) / 1000;
      ordered.forEach((a, i) => {
        const block = this.fx.blockEls.get(a.id);
        if (block === undefined) {
          return;
        }
        const at = i * step;
        tl.to(block, {autoAlpha: 1, x: 0, duration: motionMs(240) / 1000, ease: 'power2.out'}, at);
        const arrive = at + lineDelay + lineDur;
        const path = this.fx.pathEls.get(a.id);
        if (path !== undefined && typeof path.getTotalLength === 'function') {
          tl.to(path, {strokeDashoffset: 0, duration: lineDur, ease: 'power1.inOut'}, at + lineDelay);
        }
        const node = this.fx.nodeEls.get(a.id);
        if (node !== undefined) {
          tl.to(node, {scale: 1, duration: motionMs(200) / 1000, ease: 'back.out(2.4)'}, arrive - motionMs(60) / 1000);
        }
        // THE CONNECTION MOMENT: the tether lands → one short premium pulse
        // on the target, then the card returns to its calm resting state.
        tl.call(() => this.pulseTarget(a), undefined, arrive);
      });
    },

    /** Reduced-motion / reposition path: final states, no tweens, no pulses. */
    applyFinalStates(stage: HTMLElement) {
      for (const a of this.rendered) {
        this.registerTarget(a);
      }
      this.armReverseHover(stage);
      this.armTraversal();
      this.applyFinalStatesInner();
    },
    applyFinalStatesInner() {
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
      }
      this.measuring = false;
    },

    /**
     * Static bookkeeping for a group's card elements: reverse-hover
     * hotspots (visual-less classes) + the element→annotation map. The
     * VISIBLE accents are only the connection pulse and the focus ring.
     */
    registerTarget(a: RenderedAnnotation) {
      const resolved = this.fx.anchors.get(a.id);
      if (resolved === undefined) {
        return;
      }
      const mark = resolved.mark;
      if (mark !== undefined) {
        mark.classList.add('caanno-hot');
        this.fx.markedTargets.add(mark);
        if (!this.fx.targetIds.has(mark)) {
          this.fx.targetIds.set(mark, a.id);
        }
      }
      const line = resolved.line;
      if (line !== undefined && line !== mark) {
        line.classList.add('caanno-node');
        this.fx.markedTargets.add(line);
        this.fx.targetIds.set(line, a.id);
      }
    },

    /** The one-shot connection pulse — plays when the tether lands. */
    pulseTarget(a: RenderedAnnotation) {
      const resolved = this.fx.anchors.get(a.id);
      const el = resolved?.mark ?? resolved?.line;
      if (resolved === undefined || el === undefined) {
        return;
      }
      const classes = ['caanno-pulse', `caanno-pulse--${resolved.markVariant}`];
      if (a.special) {
        classes.push('caanno-pulse--special');
      }
      // Restart cleanly if a previous pulse is somehow still on (rapid replay).
      el.classList.remove(...PULSE_CLASSES);
      void el.offsetWidth; // reflow → the animation restarts
      el.classList.add(...classes);
      this.fx.markedTargets.add(el);
      const timer = window.setTimeout(() => {
        this.fx.pulseTimers.delete(timer);
        el.classList.remove(...PULSE_CLASSES);
      }, motionMs(820));
      this.fx.pulseTimers.add(timer);
    },

    /* ── focus interplay (block ↔ card element, both directions) ─────── */
    /** The element the focus ring rides: the EXACT anchor, else the mark. */
    focusEl(id: string): HTMLElement | undefined {
      const resolved = this.fx.anchors.get(id);
      return resolved?.line ?? resolved?.mark;
    },
    setFocus(id: string) {
      if (this.focusId !== null && this.focusId !== id) {
        this.clearFocus(this.focusId);
      }
      this.focusId = id;
      this.focusEl(id)?.classList.add('caanno-target--focus');
    },
    clearFocus(id: string) {
      if (this.focusId === id) {
        this.focusId = null;
      }
      this.focusEl(id)?.classList.remove('caanno-target--focus');
    },
    /** Row-level precision: hovering a row rings ITS exact card element. */
    focusRow(row: RenderedRow) {
      this.unfocusRow();
      const stage = this.stageCardEl();
      if (stage === null) {
        return;
      }
      const el = this.rowAnchorEl(stage, row);
      if (el !== null) {
        el.classList.add('caanno-target--focus');
        this.fx.markedTargets.add(el);
        this.fx.rowFocusEl = el;
      }
    },
    unfocusRow() {
      this.fx.rowFocusEl?.classList.remove('caanno-target--focus');
      this.fx.rowFocusEl = undefined;
    },

    /* ── console right-stick traversal (annotationFocusBus) ─────────── */
    armTraversal() {
      if (this.fx.traversal === undefined) {
        this.fx.traversal = {
          step: (delta: 1 | -1) => this.stepStickFocus(delta),
          clear: () => {
            if (this.focusId !== null) {
              this.clearFocus(this.focusId);
            }
          },
        };
      }
      registerAnnotationTraversal(this.fx.traversal);
    },
    /** Cycle focus across the blocks in on-screen (top-down) order. */
    stepStickFocus(delta: 1 | -1) {
      if (this.rendered.length === 0) {
        return;
      }
      const orderList = [...this.rendered].sort((p, q) => (p.y - q.y) || (p.x - q.x));
      const current = orderList.findIndex((a) => a.id === this.focusId);
      const next = current === -1 ?
        (delta > 0 ? 0 : orderList.length - 1) :
        (current + delta + orderList.length) % orderList.length;
      this.setFocus(orderList[next].id);
    },

    /** Delegated hover on the CARD: pointing at a hotspot accents its block. */
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
      // The exact node hotspot wins over its host surface (closest walks up).
      const target = (e.target as HTMLElement | null)?.closest?.('.caanno-node, .caanno-hot');
      if (target === null || target === undefined) {
        return;
      }
      const id = this.fx.targetIds.get(target as HTMLElement);
      if (id !== undefined) {
        this.setFocus(id);
      }
    },
    onStageOut(e: Event) {
      const target = (e.target as HTMLElement | null)?.closest?.('.caanno-node, .caanno-hot');
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
      if (this.fx.traversal !== undefined) {
        unregisterAnnotationTraversal(this.fx.traversal);
      }
      if (this.fx.resizeRaf !== undefined) {
        window.cancelAnimationFrame(this.fx.resizeRaf);
        this.fx.resizeRaf = undefined;
      }
      for (const timer of this.fx.pulseTimers) {
        window.clearTimeout(timer);
      }
      this.fx.pulseTimers.clear();
      for (const el of this.fx.markedTargets) {
        el.classList.remove('caanno-hot', 'caanno-node', 'caanno-target--focus', ...PULSE_CLASSES);
      }
      this.fx.markedTargets.clear();
      this.fx.anchors.clear();
      this.fx.targetIds.clear();
      this.fx.rowFocusEl = undefined;
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
    /**
     * CLOSE dismiss — fade every rule block + tether out quickly, THEN drop
     * them. Used when the viewer starts closing (nonce → 0) so the overlay
     * leaves BEFORE the card's close flight, never during/after it. Falls
     * back to an instant clear under reduced motion / no content / no rAF.
     */
    dismiss() {
      const blocks = [...this.fx.blockEls.values()].filter((b): b is HTMLElement => b !== undefined);
      const paths = [...this.fx.pathEls.values()].filter((p): p is SVGPathElement => p !== undefined);
      const nodes = [...this.fx.nodeEls.values()].filter((n): n is SVGCircleElement => n !== undefined);
      const targets: Array<HTMLElement | SVGElement> = [...blocks, ...paths, ...nodes];
      if (targets.length === 0 || prefersReducedMotion() || typeof requestAnimationFrame !== 'function') {
        this.clearRendered();
        return;
      }
      // Stop any in-flight reveal poll / timeline so the fade isn't fought.
      this.fx.revealToken++;
      this.killTimeline();
      const tl = gsap.timeline({onComplete: () => this.clearRendered()});
      this.fx.timeline = tl;
      tl.to(targets, {autoAlpha: 0, duration: motionMs(120) / 1000, ease: 'power1.in'});
    },
    /**
     * Split a row's text so the «any player» words that explain the red
     * «{all}» bezel render in the bezel's accent colour. If the localized
     * text carries no such phrase, append a colored clarifier so the bezel
     * is never left unexplained.
     */
    textSegments(text: string, anyPlayer: boolean): Array<AnnotationTextSegment> {
      if (!anyPlayer) {
        return [{text, any: false}];
      }
      const segments = segmentAnyPlayer(text);
      if (segments.some((s) => s.any)) {
        return segments;
      }
      return [{text: text + ' ', any: false}, {text: translateText('(any player)'), any: true}];
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
