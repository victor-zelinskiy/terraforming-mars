/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE ONE RISE PRIMITIVE — «the reacting card comes forward» («СРАБАТЫВАНИЕ
 * КАРТЫ — ОДИН ФРЕЙМВОРК»). Before it the console had three rises that did not
 * know each other (the assembly scene's `surfaceTrigger`, the banner stage's
 * CSS rise, the asker's plate) and one more inside the receiving stage
 * (`emergeTarget`). This module is the ONE that surfaces a card AT THE STAGE
 * (the centre of the central opening — `reactionStageSlots`) and the registry
 * of the faces the app-level layer paints for it (`ConsoleCardReactionLayer.vue`).
 * A card whose face already stands on screen rises IN ITS PLACE instead
 * (`reactorPlaces.ts` — the composer's hero, a target miniature, the receiving
 * stage's own `emergeTarget`, the start seat); the director decides which,
 * this module never guesses.
 *
 * Iteration 3 (the owner's field report of 2026-10-27):
 *  - A FACE IS WARMED before it rises (`warmReactorFaces` — mounted in the
 *    layer at the seed, its art decoded, laid out while the cause's scene
 *    plays) and the rise tween starts on a PAINTED frame: on a slow device
 *    (the Steam Deck) a tween started in the same task as the mount was eaten
 *    whole by the layout + decode stall — the card appeared finished and
 *    receded one frame later.
 *  - The rise is a LIFT from below with a hair of scale to FULL opacity (a
 *    protagonist at the stage reads at 1; the old .94 was a seat's modesty).
 *  - The effect ROW that fired is lit for the read beat (`markReactionRow` —
 *    a one-shot kant that ends on its own, invariant 15's licence; the WHY).
 *
 * Invariant 15: a rise is TRANSFORM and OPACITY — no halo, no filter, no
 * breathing.
 */
import {reactive, nextTick} from 'vue';
import {gsap} from 'gsap';
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {CardModel} from '@/common/models/CardModel';
import {CardReactionRecord} from '@/common/models/CardReactionModel';
import {motionMs} from '@/client/components/motion/motionTokens';
import {CARD_NATURAL_W} from '@/client/console/cardDeal/cardDealModel';
import {RectLike} from '@/client/console/cardIntake/intakeAssemblyPlan';
import {probeTick} from '@/client/console/probeTick';
import {ResourceTransferSpec} from '@/client/console/resourceTransfer/resourceTransferModel';
import {REACTOR_NATURAL_H, ReactionTempo} from '@/client/console/cardReaction/cardReactionModel';
import {effectRowFor} from '@/client/console/cardReaction/effectIconEnds';

export {REACTOR_NATURAL_H};

/** A caption over a face: whose card this is (a RIVAL's reactor at the shared stage names its seat). */
export type ReactorCaption = {color: Color; name: string};

/** One face the layer paints: a reactor at the stage, or a WARM face waiting for its rise (hidden). */
export type ReactorFace = {
  key: string;
  name: CardName;
  /** WHAT the face is (iteration 4): a card / corporation face by name — or an enacted RESOLUTION's (`name` is its id). Absent = a card. */
  kind?: CardReactionRecord['kind'];
  /** The LIVE model (the capsule's count) when the host has it — the pristine print otherwise. */
  card?: CardModel;
  seat: RectLike;
  caption?: ReactorCaption;
  /** Mounted ahead of its rise — laid out and decoded, never painted (`visibility: hidden` by the layer's own CSS). */
  warm?: boolean;
};

export type CardReactionPhase = 'idle' | 'waiting' | 'rising' | 'paying' | 'receding';

export const cardReactionState = reactive({
  phase: 'idle' as CardReactionPhase,
  /** The faces the layer paints right now (seated reactors and warm faces). */
  faces: [] as Array<ReactorFace>,
  /** The chain on stage: the cards in order, how many landed, how many were summarized (ticked past the ceiling). */
  chain: undefined as {cards: Array<CardName>, landed: number, summarized: Array<CardName>, seats: number, pace: number} | undefined,
  /** The chain plays HURRIED (a press / a navigation while it ran — every face still rises, at the hurry pace). */
  hurried: false,
  /** The last chain's wall-clock, for the probe (`performance.now` from the first rise to the last recede). */
  lastWallMs: undefined as number | undefined,
  /** The last reason a reaction was not shown as the record said (a probe's and a dev's read). */
  degraded: undefined as string | undefined,
  /** How many scenes played since load (a probe's liveness witness). */
  runs: 0,
});

type StageHandle = {
  /** The face element painted for `key` — `null` while it is not in the DOM. */
  faceEl: (key: string) => HTMLElement | null;
  /** The room the seats are solved in (the viewport by default). */
  stageRect: () => RectLike;
};
let stage: StageHandle | undefined;

export function registerCardReactionStage(handle: StageHandle): () => void {
  stage = handle;
  return () => {
    if (stage === handle) {
      stage = undefined;
    }
  };
}

/** The layer is mounted and can paint a face. */
export function cardReactionStageMounted(): boolean {
  return stage !== undefined;
}

export function cardReactionStageRect(): RectLike {
  return stage?.stageRect() ?? {left: 0, top: 0, width: typeof window === 'undefined' ? 0 : window.innerWidth, height: typeof window === 'undefined' ? 0 : window.innerHeight};
}

/** The next painted frame (or the probe's fallback) — never bare rAF. */
export function nextPaintedFrame(): Promise<void> {
  return new Promise<void>((resolve) => probeTick(() => resolve()));
}

let warmSeq = 0;

/**
 * WARM the faces a chain will rise (the apply block): mounted in the layer, hidden, at the stage's own size, so the
 * premium face is laid out and its art decoded while the cause's own scene plays. A rise of the same card then takes
 * the warm face over (same key, same element — no remount) and starts its tween on a laid-out, painted-once face.
 */
export function warmReactorFaces(faces: ReadonlyArray<Pick<ReactorFace, 'name' | 'card' | 'kind'>>, seat: RectLike): void {
  if (stage === undefined) {
    return;
  }
  const fresh = faces
    .filter((f) => !cardReactionState.faces.some((x) => x.warm === true && x.name === f.name))
    .map((f): ReactorFace => ({key: `warm:${f.name}:${++warmSeq}`, name: f.name, kind: f.kind, card: f.card, seat, warm: true}));
  if (fresh.length > 0) {
    cardReactionState.faces = [...cardReactionState.faces, ...fresh];
  }
}

/** Drop every warm face (a chain that never rose them — an abort, a hurry's cut). */
export function dropWarmReactors(): void {
  cardReactionState.faces = cardReactionState.faces.filter((f) => f.warm !== true);
}

/**
 * Mount a face at its seat (invisible until it rises) and return its element once painted — `undefined` when the
 * layer is not there. A WARM face of the same card is taken over (its key kept — the element survives the take).
 */
export async function seatReactor(face: ReactorFace): Promise<{el: HTMLElement, key: string} | undefined> {
  if (stage === undefined) {
    return undefined;
  }
  const warm = cardReactionState.faces.find((f) => f.warm === true && f.name === face.name);
  const key = warm?.key ?? face.key;
  if (warm !== undefined) {
    cardReactionState.faces = cardReactionState.faces.map((f) => (f === warm ? {...face, key, warm: false} : f));
  } else if (!cardReactionState.faces.some((f) => f.key === face.key)) {
    cardReactionState.faces = [...cardReactionState.faces, {...face, warm: false}];
  }
  await nextTick();
  const el = stage?.faceEl(key) ?? null;
  return el === null ? undefined : {el, key};
}

/** Drop a face from the layer (after its recede, or on an abort). */
export function unseatReactor(key: string): void {
  cardReactionState.faces = cardReactionState.faces.filter((f) => f.key !== key);
}

export function unseatAllReactors(): void {
  cardReactionState.faces = [];
}

/** The seated element of `key`, if painted. */
export function reactorEl(key: string): HTMLElement | undefined {
  const el = stage?.faceEl(key) ?? null;
  return el === null ? undefined : el;
}

/** The lift's start below the seat and the scale's start — a share of the card, never a px constant (the TV scales). */
const RISE_LIFT_SHARE = 0.06;
const RISE_SCALE_FROM = 0.96;
const RECEDE_DROP_SHARE = 0.04;
const RECEDE_SCALE_TO = 0.97;

/**
 * RISE — the face surfaces at its seat: sized to the seat (scale off the natural frame), a lift from a hair below with
 * a hair of scale, opacity 0 → 1. The tween starts only after the posed face has been PAINTED once (a probe tick) —
 * a tween begun in the mount's own task is swallowed by the layout + decode stall on a slow device. Resolves on the
 * tween's completion (or at once for a killed tween — nothing here can hang).
 */
export async function riseReactor(face: HTMLElement, seat: RectLike, t: ReactionTempo, reduced: boolean): Promise<void> {
  const scale = Math.max(0.05, seat.height / REACTOR_NATURAL_H);
  gsap.killTweensOf(face);
  gsap.set(face, {
    width: CARD_NATURAL_W, height: REACTOR_NATURAL_H, transformOrigin: 'top left',
    x: seat.left, y: seat.top + (reduced ? 0 : seat.height * RISE_LIFT_SHARE),
    scale: reduced ? scale : scale * RISE_SCALE_FROM,
    // Painted at (almost) zero, never `visibility: hidden`: the layer rasters the face BEFORE its first visible frame.
    opacity: 0.002, visibility: 'visible',
  });
  await nextPaintedFrame();
  await nextPaintedFrame();
  return new Promise<void>((resolve) => {
    gsap.to(face, {opacity: 1, y: seat.top, scale, duration: motionMs(t.riseMs) / 1000, ease: 'power3.out', onComplete: resolve, onInterrupt: resolve});
  });
}

/** RECEDE — the face lets go: opacity → 0, a drift down, a hair of scale. Resolves on completion or interrupt. */
export function recedeReactor(face: HTMLElement, seat: RectLike | undefined, t: ReactionTempo, reduced: boolean): Promise<void> {
  gsap.killTweensOf(face);
  const drop = seat === undefined || reduced ? 0 : seat.height * RECEDE_DROP_SHARE;
  return new Promise<void>((resolve) => {
    gsap.to(face, {
      autoAlpha: 0, y: `+=${drop}`, scale: reduced ? '+=0' : `*=${RECEDE_SCALE_TO}`,
      duration: motionMs(t.recedeMs) / 1000, ease: 'power2.in', onComplete: resolve, onInterrupt: resolve,
    });
  });
}

/**
 * THE WHY — the effect row that fired wears a one-shot kant for the read beat (`[data-reaction-row]`, a `@keyframes`
 * that ends on its own; its length is the beat's). On a face that prints no such row nothing is marked.
 */
export function markReactionRow(face: HTMLElement | undefined, printedEffect: number | undefined, specs: ReadonlyArray<ResourceTransferSpec>, ms: number): HTMLElement | undefined {
  if (face === undefined) {
    return undefined;
  }
  const row = effectRowFor(face, printedEffect, specs);
  if (row === undefined) {
    return undefined;
  }
  row.removeAttribute('data-reaction-row');
  void row.offsetWidth;
  row.style.setProperty('--con-reaction-row-ms', `${Math.max(240, Math.round(ms))}ms`);
  row.setAttribute('data-reaction-row', '1');
  window.setTimeout(() => {
    row.removeAttribute('data-reaction-row');
    row.style.removeProperty('--con-reaction-row-ms');
  }, Math.max(240, Math.round(ms)) + 80);
  return row;
}

/** Every tween of the seated faces runs at this time scale from now on (a HURRY — never a kill). */
export function paceReactorTweens(timeScale: number): void {
  for (const face of cardReactionState.faces) {
    const el = reactorEl(face.key);
    if (el !== undefined) {
      gsap.getTweensOf(el).forEach((tween) => tween.timeScale(timeScale));
    }
  }
}

/** Kill every tween of the seated faces (an abort) — the layer unmounts them next. */
export function killReactorTweens(): void {
  for (const face of cardReactionState.faces) {
    const el = reactorEl(face.key);
    if (el !== undefined) {
      gsap.killTweensOf(el);
    }
  }
}
