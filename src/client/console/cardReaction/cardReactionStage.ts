/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE ONE RISE PRIMITIVE — «the reacting card comes forward» («СРАБАТЫВАНИЕ
 * КАРТЫ — ОДИН ФРЕЙМВОРК»). Before it the console had three rises that did not
 * know each other (the assembly scene's `surfaceTrigger`, the banner stage's
 * CSS rise, the asker's plate) and one more inside the receiving stage
 * (`emergeTarget`). This module is the ONE that surfaces a card AT A SEAT —
 * the assembly scene's numbers byte for byte (alpha 0 → .94, y +14 → 0,
 * `power2.out`; the recede the reverse) — and the registry of the faces the
 * app-level layer paints for it (`ConsoleCardReactionLayer.vue`). A card that
 * stands in the receiving stage rises OUT OF ITS PLACE instead (the stage's
 * own `emergeTarget` — TR53 «the card comes out of its PLACE»); the director
 * decides which, this module never guesses.
 *
 * Invariant 15: a rise is TRANSFORM and OPACITY — no halo, no filter, no
 * breathing. The face stands a touch below full (it is the cause, the row is
 * the subject — a kant of opacity).
 */
import {reactive, nextTick} from 'vue';
import {gsap} from 'gsap';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {motionMs} from '@/client/components/motion/motionTokens';
import {CARD_NATURAL_W} from '@/client/console/cardDeal/cardDealModel';
import {RectLike} from '@/client/console/cardIntake/intakeAssemblyPlan';
import {ReactionTempo} from '@/client/console/cardReaction/cardReactionModel';

/** The natural (unscaled) lite-face height — the premium card frame (320×460). */
export const REACTOR_NATURAL_H = 460;

/** One face the layer paints: a reactor surfacing at a seat. */
export type ReactorFace = {
  key: string;
  name: CardName;
  /** The LIVE model (the capsule's count) when the host has it — the pristine print otherwise. */
  card?: CardModel;
  seat: RectLike;
};

export type CardReactionPhase = 'idle' | 'waiting' | 'rising' | 'paying' | 'receding';

export const cardReactionState = reactive({
  phase: 'idle' as CardReactionPhase,
  /** The faces the layer paints right now (seated reactors). */
  faces: [] as Array<ReactorFace>,
  /** The chain on stage: the cards in order, how many landed, how many were summarized (ticked past the ceiling). */
  chain: undefined as {cards: Array<CardName>, landed: number, summarized: Array<CardName>, seats: 1 | 2, pace: number} | undefined,
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

/** Mount a face at its seat (invisible until it rises) and return its element once painted — `undefined` when the layer is not there. */
export async function seatReactor(face: ReactorFace): Promise<HTMLElement | undefined> {
  if (stage === undefined) {
    return undefined;
  }
  if (!cardReactionState.faces.some((f) => f.key === face.key)) {
    cardReactionState.faces = [...cardReactionState.faces, face];
  }
  await nextTick();
  const el = stage?.faceEl(face.key) ?? null;
  return el === null ? undefined : el;
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

/**
 * RISE — the face surfaces at its seat: sized to the seat (scale off the natural frame), alpha 0 → .94, a 14 px
 * settle upward. Resolves on the tween's completion (or at once for a killed tween — nothing here can hang).
 */
export function riseReactor(face: HTMLElement, seat: RectLike, t: ReactionTempo, reduced: boolean): Promise<void> {
  const scale = Math.max(0.05, seat.height / REACTOR_NATURAL_H);
  gsap.killTweensOf(face);
  gsap.set(face, {width: CARD_NATURAL_W, height: REACTOR_NATURAL_H, transformOrigin: 'top left', x: seat.left, y: seat.top + (reduced ? 0 : 14), scale, autoAlpha: 0});
  return new Promise<void>((resolve) => {
    gsap.to(face, {autoAlpha: 0.94, y: seat.top, duration: motionMs(t.riseMs) / 1000, ease: 'power2.out', onComplete: resolve, onInterrupt: resolve});
  });
}

/** RECEDE — the face lets go: alpha → 0, a 10 px drift down. Resolves on completion or interrupt. */
export function recedeReactor(face: HTMLElement, t: ReactionTempo, reduced: boolean): Promise<void> {
  gsap.killTweensOf(face);
  return new Promise<void>((resolve) => {
    gsap.to(face, {autoAlpha: 0, y: reduced ? '+=0' : '+=10', duration: motionMs(t.recedeMs) / 1000, ease: 'power1.in', onComplete: resolve, onInterrupt: resolve});
  });
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
