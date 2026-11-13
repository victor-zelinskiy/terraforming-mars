<template>
  <div ref="root" class="card-annotations"
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

<script setup vapor lang="ts">
/*
 * FULLSCREEN CARD ANNOTATION LAYER — the premium rule overlay.
 *
 * ONE floating sci-fi rule block per SEMANTIC TYPE in the gutters around
 * the fullscreen card (requirement / effect / action / «При розыгрыше» /
 * VP / special rule), each tethered by a thin gold trace to the graphic
 * element it explains: effect & action frames, the card-native play-rail
 * (the on-play zone opener), the requirements bar, the VP badge. Content
 * comes from the build-time Card Information Model grouped by type;
 * placement from the pure annotationLayout solver; choreography is a GSAP
 * timeline that starts on the host's SETTLE nonce (after the card lands /
 * after a slide), never mid-flight — a stage-stability rAF poll
 * additionally guards against a still-transforming stage (console FLIP).
 *
 * Targets are NEVER permanently highlighted: a short premium pulse plays
 * exactly when a tether CONNECTS, then the card returns to its calm
 * resting state. Focus (mouse hover / console right stick) re-accents the
 * tether + target temporarily.
 *
 * The root is ALWAYS rendered (empty = an inert pointer-transparent div):
 * replay() locates the host <dialog> via the root ref's closest BEFORE any
 * block exists — a v-if root would be a comment node with no closest. The layer
 * is a no-op when the card has no information model, when the gutters are
 * too narrow for readable blocks, or under JSDOM (rects are 0).
 *
 * (This comment opened the template; the template starts with its root now.)
 */

import {nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch} from 'vue';
import {gsap} from 'gsap';
import {CardName} from '@/common/cards/CardName';
import {getCard} from '@/client/cards/ClientCardManifest';
import {translateText} from '@/client/directives/i18n';
import {motionMs} from '@/client/components/motion/motionTokens';
import {prefersReducedMotion} from '@/client/components/feedback/changeFeedbackManager';
import {buildCardAnnotations, stripKindPrefix, segmentAnyPlayer, CardAnnotation, CardAnnotationRow, AnnotationTextSegment} from './annotationModel';
import {solveAnnotationLayout, routeTether, AnnotationSide, TetherRect} from './annotationLayout';
import {AnnotationTraversal, registerAnnotationTraversal, unregisterAnnotationTraversal} from './annotationFocusBus';
import {useFlowScope} from '@/client/console/session/useFlowScope';
import {probeTick} from '@/client/console/probeTick';

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
  /** pending connection-pulse cleanups (the cancels of the layer's owned timers). */
  pulseTimers: Set<() => void>;
  /** the registered right-stick traversal handler (console). */
  traversal?: AnnotationTraversal;
  timeline?: gsap.core.Timeline;
  /** the coalesced resize frame's cancel — `undefined` while none is pending. */
  cancelResize?: () => void;
  /** Invalidates an in-flight stage-stability poll (new replay / cleanup). */
  revealToken: number;
};

function cssEscape(value: string): string {
  return typeof CSS !== 'undefined' && CSS.escape !== undefined ? CSS.escape(value) : value.replace(/["\\#.:()~+ ]/g, '\\$&');
}

defineOptions({name: 'CardAnnotationsLayer'});
const props = defineProps({
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
});

// A plain object, typed and NOT made reactive — DOM element maps and the
// gsap timeline must never be proxied.
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
const flow = useFlowScope('card-annotations-layer');
const root = useTemplateRef<HTMLElement>('root');
const rendered = ref<Array<RenderedAnnotation>>([]);
const lines = ref<Array<TetherLine>>([]);
const width = ref(0);
const compact = ref(false);
// True from render until the choreography's initial states are set —
// the LESS keeps the whole layer invisible, so neither the measuring
// pass nor the frame before the timeline can flash.
const measuring = ref(false);
const focusId = ref<string | null>(null);

/* ── refs bookkeeping (typed maps — v-for function refs) ─────────── */
function setBlockRef(id: string, el: unknown) {
  fx.blockEls.set(id, (el as HTMLElement | null) ?? undefined);
}
function setPathRef(id: string, el: unknown) {
  fx.pathEls.set(id, (el as SVGPathElement | null) ?? undefined);
}
function setNodeRef(id: string, el: unknown) {
  fx.nodeEls.set(id, (el as SVGCircleElement | null) ?? undefined);
}
/* ── host DOM lookups ────────────────────────────────────────────── */
function dialogEl(): HTMLElement | null {
  return root.value?.closest?.('dialog') ?? null;
}
function stageCardEl(): HTMLElement | null {
  // Only the premium face carries graphic anchors; a legacy / bonus face
  // on stage → null → the layer stays silent.
  return dialogEl()?.querySelector<HTMLElement>('.card-zoom-stage .pcard') ?? null;
}
/** The annotation's ROW element (data-graphic-id + documented fallbacks). */
function rowEl(stage: HTMLElement, graphicId: string | undefined): HTMLElement | null {
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
}
/** A row's EXACT element: its data-graphic-node, else its row. */
function rowAnchorEl(stage: HTMLElement, row: CardAnnotationRow): HTMLElement | null {
  const host = rowEl(stage, row.graphicId);
  if (host === null) {
    return null;
  }
  if (row.graphicNode !== undefined) {
    return host.querySelector<HTMLElement>(`[data-graphic-node="${cssEscape(row.graphicNode)}"]`) ?? host;
  }
  return host;
}
/**
 * Resolve a GROUP's anchors: the tether target (`line`) and the
 * connection-pulse surface (`mark`).
 *  - «При розыгрыше» → the card-native play-rail (the zone opener);
 *  - effect / action → the frame element (contour semantics);
 *  - VP → the badge; requirement → the bar; note → floats untethered.
 */
function resolveAnchor(stage: HTMLElement, a: CardAnnotation): ResolvedAnchor {
  if (a.kind === 'immediate') {
    const rail = stage.querySelector<HTMLElement>('.pcard-play-rail');
    if (rail !== null) {
      return {line: rail, mark: rail, markVariant: 'rail'};
    }
  }
  const row = rowEl(stage, a.graphicId);
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
}
/* ── the reveal ──────────────────────────────────────────────────── */
function replay() {
  cleanup();
  rendered.value = [];
  lines.value = [];
  const clientCard = props.cardName !== undefined ? getCard(props.cardName) : undefined;
  const annotations = clientCard !== undefined ? buildCardAnnotations(clientCard) : [];
  const stage = stageCardEl();
  if (annotations.length === 0 || stage === null) {
    return;
  }
  // Never measure a still-moving stage: the console FLIP open transforms
  // `.card-zoom-stage` while the settle beat is approximate. Wait until
  // the card's rect is identical across two consecutive frames.
  awaitStableStage(stage, () => beginMeasure(annotations, stage));
}
/**
 * Bounded rAF poll for stage-rect stability. Bails silently for a
 * zero-width stage (JSDOM / not laid out) and when a newer replay or
 * cleanup superseded this poll (`revealToken`).
 */
function awaitStableStage(stage: HTMLElement, ready: () => void) {
  const token = ++fx.revealToken;
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
    if (token !== fx.revealToken) {
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
    // A probe tick (the next painted frame, or shortly): the poll never stands on a quiet compositor.
    probeTick(step);
  };
  step();
}
/** Phase 1: width from the gutters alone; render hidden for measuring. */
function beginMeasure(annotations: Array<CardAnnotation>, stage: HTMLElement) {
  const cardRect = stage.getBoundingClientRect();
  const probe = solveAnnotationLayout({
    items: annotations.map((a) => ({id: a.id, anchorY: 0, height: 40})),
    cardRect,
    viewport: {width: window.innerWidth, height: window.innerHeight},
    edgePad: edgePad(),
  });
  if (probe === null) {
    return; // gutters too narrow — graceful absence, never mush
  }
  width.value = probe.width;
  compact.value = annotations.length > 5;
  measuring.value = true;
  rendered.value = annotations.map((a) => ({
    ...a,
    rows: a.rows.map((r) => {
      const displayText = stripKindPrefix(translateText(r.text));
      return {...r, displayText, segments: textSegments(displayText, r.anyPlayer)};
    }),
    label: translateText(a.labelKey),
    side: 'left' as AnnotationSide,
    x: 0,
    y: 0,
  }));
  nextTick(() => position(true));
}
function edgePad(): number {
  // Reserve the nav-arrow zone when the viewer is in browse mode.
  return dialogEl()?.querySelector('.card-zoom-nav-slot') !== null ? 96 : 24;
}
/**
 * Phase 2 (post-measure): solve the real layout from measured block
 * heights + anchor rects, apply positions, build the tether lines.
 * `animate` = fresh reveal (GSAP choreography); false = silent
 * reposition (resize).
 */
function position(animate: boolean) {
  const stage = stageCardEl();
  if (stage === null || rendered.value.length === 0) {
    return;
  }
  const cardRect = stage.getBoundingClientRect();
  const cardCenterX = (cardRect.left + cardRect.right) / 2;
  fx.anchors.clear();
  const anchors = new Map<string, DOMRect>();
  for (const a of rendered.value) {
    const resolved = resolveAnchor(stage, a);
    fx.anchors.set(a.id, resolved);
    if (resolved.line !== undefined) {
      anchors.set(a.id, resolved.line.getBoundingClientRect());
    }
  }
  const layout = solveAnnotationLayout({
    items: rendered.value.map((a) => {
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
        height: fx.blockEls.get(a.id)?.offsetHeight ?? 40,
        bias,
      };
    }),
    cardRect,
    viewport: {width: window.innerWidth, height: window.innerHeight},
    edgePad: edgePad(),
  });
  if (layout === null) {
    clearRendered();
    return;
  }
  compact.value = layout.compact;
  const byId = new Map(layout.placements.map((p) => [p.id, p]));
  for (const a of rendered.value) {
    const p = byId.get(a.id);
    if (p !== undefined) {
      a.side = p.side;
      a.x = p.x;
      a.y = p.y;
    }
  }
  buildLines(anchors);
  // NOTE: `measuring` stays true until the choreography has applied the
  // initial (hidden) states — no flash between layout and animation.
  nextTick(() => {
    if (animate) {
      play(stage);
    } else {
      applyFinalStates(stage);
    }
  });
}
function buildLines(anchors: Map<string, DOMRect>) {
  // Keep every trace off the card's bottom-left service elements (the
  // engraved expansion stamp + the resource counter) — the router
  // detours around them, the pretty elbow stays when the way is clear.
  const obstacles = serviceObstacles();
  const linesNow: Array<TetherLine> = [];
  for (const a of rendered.value) {
    const rect = anchors.get(a.id);
    if (rect === undefined) {
      continue; // block without a resolvable anchor — no line, no noise
    }
    const height = fx.blockEls.get(a.id)?.offsetHeight ?? 40;
    const by = a.y + Math.min(height / 2, 30);
    const bx = a.side === 'left' ? a.x + width.value : a.x;
    const {d, ax, ay} = routeTether({bx, by, anchor: rect, side: a.side, obstacles});
    linesNow.push({id: a.id, d, ax, ay, special: a.special});
  }
  lines.value = linesNow;
}
/** The card's bottom-left service elements a trace must avoid. */
function serviceObstacles(): Array<TetherRect> {
  const stage = stageCardEl();
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
}
/* ── choreography ────────────────────────────────────────────────── */
function play(stage: HTMLElement) {
  killTimeline();
  const ordered = [...rendered.value].sort((a, b) => a.order - b.order);
  // Hover/traversal hotspots are static bookkeeping — arm them upfront.
  for (const a of ordered) {
    registerTarget(a);
  }
  armReverseHover(stage);
  armTraversal();
  if (prefersReducedMotion()) {
    applyFinalStatesInner();
    return;
  }
  // Set EVERY initial (hidden) state synchronously, then unveil the layer
  // — no element can flash at its final state before its tween starts.
  for (const a of ordered) {
    const block = fx.blockEls.get(a.id);
    if (block !== undefined) {
      gsap.set(block, {autoAlpha: 0, x: a.side === 'left' ? -12 : 12});
    }
    const path = fx.pathEls.get(a.id);
    if (path !== undefined && typeof path.getTotalLength === 'function') {
      const len = path.getTotalLength();
      gsap.set(path, {strokeDasharray: len, strokeDashoffset: len});
    }
    const node = fx.nodeEls.get(a.id);
    if (node !== undefined) {
      gsap.set(node, {scale: 0, transformOrigin: 'center'});
    }
  }
  measuring.value = false;
  const tl = gsap.timeline();
  fx.timeline = tl;
  const step = motionMs(90) / 1000;
  const lineDelay = motionMs(110) / 1000;
  const lineDur = motionMs(300) / 1000;
  ordered.forEach((a, i) => {
    const block = fx.blockEls.get(a.id);
    if (block === undefined) {
      return;
    }
    const at = i * step;
    tl.to(block, {autoAlpha: 1, x: 0, duration: motionMs(240) / 1000, ease: 'power2.out'}, at);
    const arrive = at + lineDelay + lineDur;
    const path = fx.pathEls.get(a.id);
    if (path !== undefined && typeof path.getTotalLength === 'function') {
      tl.to(path, {strokeDashoffset: 0, duration: lineDur, ease: 'power1.inOut'}, at + lineDelay);
    }
    const node = fx.nodeEls.get(a.id);
    if (node !== undefined) {
      tl.to(node, {scale: 1, duration: motionMs(200) / 1000, ease: 'back.out(2.4)'}, arrive - motionMs(60) / 1000);
    }
    // THE CONNECTION MOMENT: the tether lands → one short premium pulse
    // on the target, then the card returns to its calm resting state.
    tl.call(() => pulseTarget(a), undefined, arrive);
  });
}
/** Reduced-motion / reposition path: final states, no tweens, no pulses. */
function applyFinalStates(stage: HTMLElement) {
  for (const a of rendered.value) {
    registerTarget(a);
  }
  armReverseHover(stage);
  armTraversal();
  applyFinalStatesInner();
}
function applyFinalStatesInner() {
  for (const a of rendered.value) {
    const block = fx.blockEls.get(a.id);
    if (block !== undefined) {
      gsap.set(block, {autoAlpha: 1, x: 0});
    }
    const path = fx.pathEls.get(a.id);
    if (path !== undefined) {
      gsap.set(path, {strokeDasharray: 'none', strokeDashoffset: 0});
    }
    const node = fx.nodeEls.get(a.id);
    if (node !== undefined) {
      gsap.set(node, {scale: 1, transformOrigin: 'center'});
    }
  }
  measuring.value = false;
}
/**
 * Static bookkeeping for a group's card elements: reverse-hover
 * hotspots (visual-less classes) + the element→annotation map. The
 * VISIBLE accents are only the connection pulse and the focus ring.
 */
function registerTarget(a: RenderedAnnotation) {
  const resolved = fx.anchors.get(a.id);
  if (resolved === undefined) {
    return;
  }
  const mark = resolved.mark;
  if (mark !== undefined) {
    mark.classList.add('caanno-hot');
    fx.markedTargets.add(mark);
    if (!fx.targetIds.has(mark)) {
      fx.targetIds.set(mark, a.id);
    }
  }
  const line = resolved.line;
  if (line !== undefined && line !== mark) {
    line.classList.add('caanno-node');
    fx.markedTargets.add(line);
    fx.targetIds.set(line, a.id);
  }
}
/** The one-shot connection pulse — plays when the tether lands. */
function pulseTarget(a: RenderedAnnotation) {
  const resolved = fx.anchors.get(a.id);
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
  fx.markedTargets.add(el);
  // PACING, owned by the layer: `cleanup()` (every replay, the unmount) strips the classes itself.
  const cancel = flow.after(motionMs(820), 'a connection pulse ends', () => {
    fx.pulseTimers.delete(cancel);
    el.classList.remove(...PULSE_CLASSES);
  });
  fx.pulseTimers.add(cancel);
}
/* ── focus interplay (block ↔ card element, both directions) ─────── */
/** The element the focus ring rides: the EXACT anchor, else the mark. */
function focusEl(id: string): HTMLElement | undefined {
  const resolved = fx.anchors.get(id);
  return resolved?.line ?? resolved?.mark;
}
function setFocus(id: string) {
  if (focusId.value !== null && focusId.value !== id) {
    clearFocus(focusId.value);
  }
  focusId.value = id;
  focusEl(id)?.classList.add('caanno-target--focus');
}
function clearFocus(id: string) {
  if (focusId.value === id) {
    focusId.value = null;
  }
  focusEl(id)?.classList.remove('caanno-target--focus');
}
/** Row-level precision: hovering a row rings ITS exact card element. */
function focusRow(row: RenderedRow) {
  unfocusRow();
  const stage = stageCardEl();
  if (stage === null) {
    return;
  }
  const el = rowAnchorEl(stage, row);
  if (el !== null) {
    el.classList.add('caanno-target--focus');
    fx.markedTargets.add(el);
    fx.rowFocusEl = el;
  }
}
function unfocusRow() {
  fx.rowFocusEl?.classList.remove('caanno-target--focus');
  fx.rowFocusEl = undefined;
}
/* ── console right-stick traversal (annotationFocusBus) ─────────── */
function armTraversal() {
  if (fx.traversal === undefined) {
    fx.traversal = {
      step: (delta: 1 | -1) => stepStickFocus(delta),
      clear: () => {
        if (focusId.value !== null) {
          clearFocus(focusId.value);
        }
      },
    };
  }
  registerAnnotationTraversal(fx.traversal);
}
/** Cycle focus across the blocks in on-screen (top-down) order. */
function stepStickFocus(delta: 1 | -1) {
  if (rendered.value.length === 0) {
    return;
  }
  const orderList = [...rendered.value].sort((p, q) => (p.y - q.y) || (p.x - q.x));
  const current = orderList.findIndex((a) => a.id === focusId.value);
  const next = current === -1 ?
    (delta > 0 ? 0 : orderList.length - 1) :
    (current + delta + orderList.length) % orderList.length;
  setFocus(orderList[next].id);
}
/** Delegated hover on the CARD: pointing at a hotspot accents its block. */
function armReverseHover(stage: HTMLElement) {
  if (fx.hoverStage === stage) {
    return;
  }
  disarmReverseHover();
  stage.addEventListener('mouseover', onStageOver);
  stage.addEventListener('mouseout', onStageOut);
  fx.hoverStage = stage;
}
function disarmReverseHover() {
  const stage = fx.hoverStage;
  if (stage !== undefined) {
    stage.removeEventListener('mouseover', onStageOver);
    stage.removeEventListener('mouseout', onStageOut);
    fx.hoverStage = undefined;
  }
}
function onStageOver(e: Event) {
  // The exact node hotspot wins over its host surface (closest walks up).
  const target = (e.target as HTMLElement | null)?.closest?.('.caanno-node, .caanno-hot');
  if (target === null || target === undefined) {
    return;
  }
  const id = fx.targetIds.get(target as HTMLElement);
  if (id !== undefined) {
    setFocus(id);
  }
}
function onStageOut(e: Event) {
  const target = (e.target as HTMLElement | null)?.closest?.('.caanno-node, .caanno-hot');
  if (target === null || target === undefined) {
    return;
  }
  const related = (e as MouseEvent).relatedTarget as Node | null;
  if (related !== null && target.contains(related)) {
    return; // still inside the same anchor
  }
  const id = fx.targetIds.get(target as HTMLElement);
  if (id !== undefined) {
    clearFocus(id);
  }
}
/* ── resize ──────────────────────────────────────────────────────── */
function onResize() {
  if (rendered.value.length === 0 || fx.cancelResize !== undefined) {
    return;
  }
  fx.cancelResize = flow.afterFrame('the annotations re-position after a resize', () => {
    fx.cancelResize = undefined;
    killTimeline();
    position(false);
  });
}
/* ── lifecycle hygiene ───────────────────────────────────────────── */
function killTimeline() {
  fx.timeline?.kill();
  fx.timeline = undefined;
}
/** Full teardown of side effects (marks, listeners, tweens, polls). */
function cleanup() {
  fx.revealToken++; // invalidate any in-flight stability poll
  killTimeline();
  disarmReverseHover();
  if (fx.traversal !== undefined) {
    unregisterAnnotationTraversal(fx.traversal);
  }
  if (fx.cancelResize !== undefined) {
    fx.cancelResize();
    fx.cancelResize = undefined;
  }
  for (const cancel of fx.pulseTimers) {
    cancel();
  }
  fx.pulseTimers.clear();
  for (const el of fx.markedTargets) {
    el.classList.remove('caanno-hot', 'caanno-node', 'caanno-target--focus', ...PULSE_CLASSES);
  }
  fx.markedTargets.clear();
  fx.anchors.clear();
  fx.targetIds.clear();
  fx.rowFocusEl = undefined;
  fx.blockEls.clear();
  fx.pathEls.clear();
  fx.nodeEls.clear();
  focusId.value = null;
}
/** Cleanup + drop the rendered blocks (card left the stage / closed). */
function clearRendered() {
  cleanup();
  rendered.value = [];
  lines.value = [];
  measuring.value = false;
}
/**
 * CLOSE dismiss — fade every rule block + tether out quickly, THEN drop
 * them. Used when the viewer starts closing (nonce → 0) so the overlay
 * leaves BEFORE the card's close flight, never during/after it. Falls
 * back to an instant clear under reduced motion / no content / no rAF.
 */
function dismiss() {
  const blocks = [...fx.blockEls.values()].filter((b): b is HTMLElement => b !== undefined);
  const paths = [...fx.pathEls.values()].filter((p): p is SVGPathElement => p !== undefined);
  const nodes = [...fx.nodeEls.values()].filter((n): n is SVGCircleElement => n !== undefined);
  const targets: Array<HTMLElement | SVGElement> = [...blocks, ...paths, ...nodes];
  if (targets.length === 0 || prefersReducedMotion() || typeof requestAnimationFrame !== 'function') {
    clearRendered();
    return;
  }
  // Stop any in-flight reveal poll / timeline so the fade isn't fought.
  fx.revealToken++;
  killTimeline();
  const tl = gsap.timeline({onComplete: () => clearRendered()});
  fx.timeline = tl;
  tl.to(targets, {autoAlpha: 0, duration: motionMs(120) / 1000, ease: 'power1.in'});
}
/**
 * Split a row's text so the «any player» words that explain the red
 * «{all}» bezel render in the bezel's accent colour. If the localized
 * text carries no such phrase, append a colored clarifier so the bezel
 * is never left unexplained.
 */
function textSegments(text: string, anyPlayer: boolean): Array<AnnotationTextSegment> {
  if (!anyPlayer) {
    return [{text, any: false}];
  }
  const segments = segmentAnyPlayer(text);
  if (segments.some((s) => s.any)) {
    return segments;
  }
  return [{text: text + ' ', any: false}, {text: translateText('(any player)'), any: true}];
}
function blockStyle(a: RenderedAnnotation): Record<string, string> {
  return {
    left: `${a.x}px`,
    top: `${a.y}px`,
    width: `${width.value}px`,
  };
}

watch(() => props.nonce, (value: number) => {
  if (value > 0) {
    replay();
  } else {
    // nonce → 0 = the viewer is CLOSING. Fade the rule blocks + tethers
    // out FIRST (a quick premium dismiss), so they're gone before the
    // card's close flight — never lingering through the flight and
    // vanishing at the end. (`cardName` change stays an instant clear —
    // the old card's blocks must not bleed into the new card's reveal.)
    dismiss();
  }
});
// The stage card changed (browse slide started / host re-pointed the
// viewer): the OLD card's blocks must vanish immediately — the settle
// nonce replays for the new card once it lands.
watch(() => props.cardName, () => {
  clearRendered();
});

onMounted(() => {
  window.addEventListener('resize', onResize);
  if (props.nonce > 0) {
    replay();
  }
});
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
  cleanup();
});
</script>
