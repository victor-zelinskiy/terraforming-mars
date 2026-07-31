/*
 * ACTION COMMIT MOTION — the DOM/GSAP half of the universal activation beat
 * (state + plan: consoleActionCommit.ts; concept:
 * docs/claude/console/workspace-band.md § ACTION COMMIT).
 *
 * The phrase (Combined Mechanical Commit):
 *   MECHANICAL PRESS  — the CTA compresses on the very press frame;
 *   MECHANICAL FIX    — the source card lifts a breath and seats back
 *                       (scale-only: the wrap's geometry is a NORTH STAR
 *                       anchor and never moves);
 *   ACTION IMPULSE    — a light band sweeps the SELECTED variant's printed
 *                       graphic (cost → arrow → result) and lands on the
 *                       RESULT icon with a one-shot ring — «механика карты
 *                       ожила и исполнена»;
 *   RESULT HANDOFF    — fired as the impulse lands (overlapping, never a
 *                       pause): the deck answers a draw, the reward wave
 *                       materializes resources, the board/HUD take a tile /
 *                       global change.
 *
 * Anchors come from the REAL premium face: the selected action node resolves
 * via its content token (`data-graphic-node`, the CardAnnotationsLayer
 * idiom), icons by their sprite URL inside the variant's result cluster.
 * Nothing is injected into the `.pcard` DOM — every visual rides a dedicated
 * fixed overlay layer, measured once (raw viewport rects: CSS `zoom` is
 * already folded into getBoundingClientRect). Missing anchors degrade to the
 * mechanical commit alone — the fallback is safe by construction.
 */
import {gsap} from 'gsap';
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {nodeGraphicToken} from '@/common/cards/render/cardGraphicIds';
import type {ICardRenderEffect} from '@/common/cards/render/Types';
import type {ActionCommitKind} from '@/client/console/consoleActionCommit';
import type {ResourceTransferSpec, TransferPoint} from '@/client/console/resourceTransfer/resourceTransferModel';

// ── timings (1080-logical ms; motionMs folds the speed preset) ──────────────

/** The CTA's physical press acknowledgement. */
const PRESS_MS = 120;
/** The card's lift half of the mechanical fix. */
const FIX_IN_MS = 110;
/** The seat-back half (the «fixation» read). */
const FIX_OUT_MS = 150;
/** The impulse band's travel across the variant graphic. */
const SWEEP_MS = 210;
/** The impulse starts this far into the phrase (under the lift). */
const SWEEP_AT_MS = 70;
/** The result-icon pop + ring. */
const ICON_MS = 170;
/** The handoff fires AT the impulse's landing — overlap, never a pause. */
export const COMMIT_HANDOFF_AT_MS = SWEEP_AT_MS + SWEEP_MS;
/** The whole mandatory beat (a frequent flow — felt, never waited for). */
const SETTLE_AT_MS = 430;

function s(ms: number): number {
  return motionMs(ms) / 1000;
}

// ── anchor resolution (the semantic API — no per-card tables) ───────────────

/** Sprite-URL needles per resource/result key (premium icons carry no
 *  per-resource class — identity is the asset the face painted). */
const ICON_NEEDLES: Readonly<Record<string, ReadonlyArray<string>>> = {
  'plants': ['plant.'],
  'heat': ['heat.'],
  'energy': ['power.'],
  'steel': ['steel.'],
  'titanium': ['titanium.'],
  'cards': ['card.webp', 'card.png'],
  'temperature': ['temperature'],
  'oxygen': ['oxygen'],
  'venus': ['venus'],
  'oceans': ['ocean'],
  'tr': ['tr.'],
  'microbe': ['microbe'],
  'animal': ['animal'],
  'floater': ['floater'],
  'science': ['science'],
  'asteroid': ['asteroid'],
};

export type ActionCommitAnchors = {
  /** The card's visual body (the mechanical-fix target). */
  cardEl: HTMLElement;
  /** The selected variant's printed group (the impulse's runway). */
  groupEl?: HTMLElement;
  /** The variant's RESULT cluster (icons live here). */
  resultEl?: HTMLElement;
};

function iconMatches(el: HTMLElement, key: string): boolean {
  const needles = ICON_NEEDLES[key];
  if (needles === undefined) {
    return false;
  }
  const bg = el.style.backgroundImage ?? '';
  return needles.some((n) => bg.includes(n));
}

function measurable(el: Element | null | undefined): HTMLElement | undefined {
  if (el === null || el === undefined) {
    return undefined;
  }
  const r = (el as HTMLElement).getBoundingClientRect();
  return r.width > 4 && r.height > 4 ? (el as HTMLElement) : undefined;
}

/**
 * Resolve the commit anchors inside a rendered hero card. The variant is
 * addressed by CONTENT TOKEN (`data-graphic-node` — the face stamps the same
 * token because the mechanics model keeps node REFERENCES), never by ordinal:
 * the premium plate reorders groups. Every miss degrades one level — group →
 * whole mechanics plate → card body — so the commit always has a stage.
 */
export function resolveActionCommitAnchors(
  cardWrapEl: HTMLElement,
  actionNode: ICardRenderEffect | undefined,
): ActionCommitAnchors {
  const cardEl = (cardWrapEl.querySelector<HTMLElement>('.pcard') ?? cardWrapEl);
  let groupEl: HTMLElement | undefined;
  if (actionNode !== undefined && typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    const token = nodeGraphicToken(actionNode);
    if (token !== undefined) {
      const nodeEl = cardEl.querySelector<HTMLElement>(`[data-graphic-node="${CSS.escape(token)}"]`);
      groupEl = measurable(nodeEl?.closest<HTMLElement>('.pcard-mech-group'));
    }
  }
  groupEl = groupEl ?? measurable(cardEl.querySelector<HTMLElement>('.pcard__mech'));
  let resultEl: HTMLElement | undefined;
  if (groupEl !== undefined) {
    const parts = groupEl.querySelectorAll<HTMLElement>('.pcard-effect__part');
    resultEl = measurable(parts.length > 0 ? parts[parts.length - 1] : undefined) ?? groupEl;
  }
  return {cardEl, groupEl, resultEl};
}

/** The result icon of the commit's landing, by category. */
export function resolveResultIcon(
  anchors: ActionCommitAnchors,
  kind: ActionCommitKind,
  firstResource?: string,
): HTMLElement | undefined {
  const scope = anchors.resultEl ?? anchors.groupEl;
  if (scope === undefined) {
    return undefined;
  }
  const icons = Array.from(scope.querySelectorAll<HTMLElement>('.pcard-ic'));
  const byKey = (key: string) => icons.find((el) => iconMatches(el, key));
  switch (kind) {
  case 'draw':
  case 'deck-check':
    return measurable(byKey('cards')) ?? measurable(scope.querySelector<HTMLElement>('.pcard-ic'));
  case 'tile':
    return measurable(scope.querySelector<HTMLElement>('.pcard-tile'));
  case 'global': {
    for (const key of ['temperature', 'oxygen', 'venus', 'oceans', 'tr']) {
      const hit = measurable(byKey(key));
      if (hit !== undefined) {
        return hit;
      }
    }
    return undefined;
  }
  case 'resources': {
    if (firstResource === 'megacredits') {
      return measurable(scope.querySelector<HTMLElement>('.pcard-mi--mc'));
    }
    return firstResource !== undefined ? measurable(byKey(firstResource)) : undefined;
  }
  default:
    return undefined;
  }
}

/**
 * Per-spec ORIGIN points for the reward wave, measured NOW (submit time) so
 * the flight never depends on the workspace outliving the answer. A spec
 * whose icon can't be found gets `undefined` → the run's card-level source.
 */
export function resolveGainIconOrigins(
  anchors: ActionCommitAnchors,
  specs: ReadonlyArray<ResourceTransferSpec>,
): Array<TransferPoint | undefined> {
  const scope = anchors.resultEl ?? anchors.groupEl ?? anchors.cardEl;
  const icons = Array.from(scope.querySelectorAll<HTMLElement>('.pcard-ic'));
  const prod = scope.querySelector<HTMLElement>('.pcard-prod');
  const centerOf = (el: HTMLElement | undefined): TransferPoint | undefined => {
    if (el === undefined) {
      return undefined;
    }
    const r = el.getBoundingClientRect();
    return r.width > 4 ? {x: r.left + r.width / 2, y: r.top + r.height / 2} : undefined;
  };
  return specs.map((spec) => {
    if (spec.channel === 'production') {
      const inProd = prod !== null && prod !== undefined ?
        Array.from(prod.querySelectorAll<HTMLElement>('.pcard-ic')).find((el) => iconMatches(el, spec.resource)) :
        undefined;
      return centerOf(inProd) ?? centerOf(prod ?? undefined);
    }
    if (spec.resource === 'megacredits') {
      const mc = scope.querySelector<HTMLElement>('.pcard-mi--mc');
      return centerOf(mc ?? undefined) ?? centerOf(icons.find((el) => iconMatches(el, 'megacredits')));
    }
    return centerOf(icons.find((el) => iconMatches(el, spec.resource)));
  });
}

// ── the beat itself ─────────────────────────────────────────────────────────

export type ActionCommitMotionArgs = {
  /** The un-zoomed hero wrap (geometry anchor — never transformed). */
  cardWrapEl: HTMLElement | undefined;
  /** The CTA row (the press acknowledgement). */
  ctaEl: HTMLElement | undefined;
  /** The selected variant's render node (content-token addressing). */
  actionNode: ICardRenderEffect | undefined;
  kind: ActionCommitKind;
  /** First reward resource (picks the landing icon for `resources`). */
  firstResource?: string;
  /** Fired at the impulse's landing — the result handoff (overlapping). */
  onHandoff?: () => void;
  /** Fired when the mandatory beat has played out (the min-beat release). */
  onSettled: () => void;
};

export type ActionCommitMotionHandle = {kill: () => void};

let liveEpisode: {layer: HTMLElement, tl: gsap.core.Timeline | undefined, finish: (handoff: boolean) => void} | undefined;

function killLiveEpisode(): void {
  if (liveEpisode !== undefined) {
    const ep = liveEpisode;
    liveEpisode = undefined;
    ep.tl?.kill();
    ep.layer.remove();
    ep.finish(false);
  }
}

/** A quick physical answer from the HUD deck — the draw handoff's «колода
 *  отозвалась» (transform-only, self-clearing, silent when off screen). */
export function pulseDeckPile(): void {
  if (typeof document === 'undefined' || consoleReducedMotionActive()) {
    return;
  }
  const pile = document.querySelector<HTMLElement>('.con-deckstack__pile');
  if (pile === null) {
    return;
  }
  gsap.fromTo(pile, {scale: 1}, {
    scale: 1.035, duration: s(110), ease: 'power2.out', yoyo: true, repeat: 1,
    transformOrigin: '50% 20%', clearProps: 'transform',
    onInterrupt: () => gsap.set(pile, {clearProps: 'transform'}),
  });
}

/**
 * Play the commit. Returns a handle whose `kill()` tears the episode down
 * (unmount safety) — the settle callback still fires exactly once, so the
 * min-beat gate can never hang on a dead stage.
 */
export function runActionCommitMotion(args: ActionCommitMotionArgs): ActionCommitMotionHandle {
  killLiveEpisode();

  let done = false;
  let handoffFired = false;
  const fireHandoff = () => {
    if (!handoffFired) {
      handoffFired = true;
      args.onHandoff?.();
    }
  };
  const finish = (handoff: boolean) => {
    if (done) {
      return;
    }
    done = true;
    if (handoff) {
      fireHandoff();
    }
    args.onSettled();
  };

  if (typeof document === 'undefined' || args.cardWrapEl === undefined) {
    finish(true);
    return {kill: () => finish(false)};
  }

  const anchors = resolveActionCommitAnchors(args.cardWrapEl, args.actionNode);
  const iconEl = resolveResultIcon(anchors, args.kind, args.firstResource);

  // ── reduced motion: the semantics survive as a short accent — the icon
  //    highlights, the handoff and the committed state land on time. ──
  if (consoleReducedMotionActive()) {
    const target = iconEl ?? anchors.resultEl ?? anchors.groupEl;
    if (target !== undefined) {
      const r = target.getBoundingClientRect();
      const ring = document.createElement('div');
      ring.className = 'con-commit-ring';
      ring.style.cssText = `left:${r.left - 4}px;top:${r.top - 4}px;width:${r.width + 8}px;height:${r.height + 8}px;`;
      document.body.appendChild(ring);
      gsap.fromTo(ring, {opacity: 0.9}, {opacity: 0, duration: s(220), ease: 'power1.out', onComplete: () => ring.remove()});
    }
    window.setTimeout(fireHandoff, motionMs(60));
    window.setTimeout(() => finish(false), motionMs(160));
    return {kill: () => finish(false)};
  }

  // The overlay layer — every commit visual lives HERE (fixed, measured
  // once); the `.pcard` DOM is never mutated.
  const layer = document.createElement('div');
  layer.className = 'con-commit-layer';
  document.body.appendChild(layer);

  const tl = gsap.timeline({onComplete: () => {
    if (liveEpisode?.layer === layer) {
      liveEpisode = undefined;
    }
    layer.remove();
    finish(true);
  }});
  liveEpisode = {layer, tl, finish};

  // 1. MECHANICAL PRESS — the CTA answers the very press frame.
  if (args.ctaEl !== undefined) {
    tl.fromTo(args.ctaEl, {scale: 1}, {
      scale: 0.985, duration: s(PRESS_MS * 0.45), ease: 'power2.out', transformOrigin: '50% 50%',
    }, 0);
    tl.to(args.ctaEl, {
      scale: 1, duration: s(PRESS_MS * 0.55), ease: 'power2.inOut', clearProps: 'transform',
      onInterrupt: () => gsap.set(args.ctaEl as HTMLElement, {clearProps: 'transform'}),
    }, s(PRESS_MS * 0.45));
  }

  // 2. MECHANICAL FIX — the card lifts a breath and seats back. Scale-only
  //    (ratio-based — safe inside the CSS `zoom` subtree), on the visual
  //    body, never the wrap: the wrap's box is a NORTH STAR anchor.
  tl.fromTo(anchors.cardEl, {scale: 1}, {
    scale: 1.014, duration: s(FIX_IN_MS), ease: 'power2.out', transformOrigin: '50% 60%',
  }, s(30));
  tl.to(anchors.cardEl, {
    scale: 1, duration: s(FIX_OUT_MS), ease: 'power3.inOut', clearProps: 'transform',
    onInterrupt: () => gsap.set(anchors.cardEl, {clearProps: 'transform'}),
  }, s(30 + FIX_IN_MS));

  // 3. ACTION IMPULSE — the light band reads the printed mechanic left to
  //    right (cost → arrow → result) inside the SELECTED variant only.
  if (anchors.groupEl !== undefined) {
    const g = anchors.groupEl.getBoundingClientRect();
    const sweep = document.createElement('div');
    sweep.className = 'con-commit-sweep';
    sweep.style.cssText = `left:${g.left}px;top:${g.top}px;width:${g.width}px;height:${g.height}px;`;
    const band = document.createElement('div');
    band.className = 'con-commit-band';
    sweep.appendChild(band);
    layer.appendChild(sweep);
    const bandW = Math.max(26, g.width * 0.34);
    band.style.width = `${bandW}px`;
    tl.fromTo(band, {x: -bandW, opacity: 0}, {opacity: 1, duration: s(50), ease: 'power1.out'}, s(SWEEP_AT_MS));
    tl.to(band, {x: g.width, duration: s(SWEEP_MS), ease: 'power1.inOut'}, s(SWEEP_AT_MS));
    tl.to(sweep, {opacity: 0, duration: s(90), ease: 'power1.out'}, s(SWEEP_AT_MS + SWEEP_MS - 30));
  }

  // 4. RESULT LANDING — the icon pops, a one-shot ring marks the execution,
  //    and the HANDOFF fires under it (overlap, never a pause).
  const landingEl = iconEl ?? anchors.resultEl;
  if (landingEl !== undefined) {
    const r = landingEl.getBoundingClientRect();
    const ring = document.createElement('div');
    ring.className = 'con-commit-ring';
    ring.style.cssText = `left:${r.left - 5}px;top:${r.top - 5}px;width:${r.width + 10}px;height:${r.height + 10}px;`;
    layer.appendChild(ring);
    tl.fromTo(iconEl ?? landingEl, {scale: 1}, {
      scale: 1.22, duration: s(ICON_MS * 0.45), ease: 'power2.out', transformOrigin: '50% 50%',
    }, s(COMMIT_HANDOFF_AT_MS - 20));
    tl.to(iconEl ?? landingEl, {
      scale: 1, duration: s(ICON_MS * 0.55), ease: 'power2.inOut', clearProps: 'transform',
      onInterrupt: () => gsap.set(iconEl ?? landingEl, {clearProps: 'transform'}),
    }, s(COMMIT_HANDOFF_AT_MS - 20 + ICON_MS * 0.45));
    tl.fromTo(ring, {opacity: 0, scale: 0.72}, {
      opacity: 0.95, scale: 1, duration: s(ICON_MS * 0.5), ease: 'power2.out', transformOrigin: '50% 50%',
    }, s(COMMIT_HANDOFF_AT_MS - 20));
    tl.to(ring, {opacity: 0, scale: 1.12, duration: s(ICON_MS), ease: 'power1.out'}, s(COMMIT_HANDOFF_AT_MS + ICON_MS * 0.4));
  }

  tl.call(fireHandoff, undefined, s(COMMIT_HANDOFF_AT_MS));
  // The settle marks the MANDATORY beat's end (the min-beat gate) — the
  // decorative tail may still be fading; the flow never waits for it.
  tl.call(() => finish(true), undefined, s(SETTLE_AT_MS));

  return {
    kill: () => {
      if (liveEpisode?.tl === tl) {
        killLiveEpisode();
      } else {
        tl.kill();
        layer.remove();
        finish(false);
      }
    },
  };
}
