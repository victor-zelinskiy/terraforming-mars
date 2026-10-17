// THE PHRASE OF A PREGAME SCREEN (TR68 «ПРЕДИГРОВОЕ — ЭТО ВИТРИНА») — the menu → «Мои партии» / «Мои кампании» move is
// ONE phrase, never a dialog that arrives: the menu column RECEDES (the menu's own CSS class, opacity + a step left —
// the brand stays), the screen's plate UNFOLDS out of the rect of the item that was pressed (a FLIP: the plate alone
// is scaled — it carries no text — while the head and the stage's content only fade), and the cards SURFACE in a wave
// out of the centre (the campaign map's reveal, in small). B plays the same phrase back: the cards let go, the plate
// folds into the item the cursor still stands on, the column returns. Transform / opacity only, on `motionMs` and
// `MOTION_EASE`; reduced motion is a short crossfade in place. A missing WAAPI (jsdom) settles at once.

import {MOTION_EASE} from '@/client/components/motion/motionTokens';
import {consoleMotionMs, consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';

/** Base durations (ms at motion scale 1). */
export const LOBBY_UNFOLD_MS = 340;
export const LOBBY_CONTENT_MS = 260;
export const LOBBY_WAVE_MS = 320;
/** The wave's step per card-distance from the centre (ms). */
export const LOBBY_WAVE_STEP_MS = 55;
/** …and its READING-ORDER step (ms per card; the whole order capped at `LOBBY_WAVE_ORDER_SPAN_MS`), so two cards
 *  standing symmetric about the centre still surface in turn. */
export const LOBBY_WAVE_ORDER_MS = 60;
export const LOBBY_WAVE_ORDER_SPAN_MS = 240;
export const LOBBY_FOLD_MS = 260;
export const LOBBY_REDUCED_MS = 140;

export type LobbyRect = {left: number, top: number, width: number, height: number};

/** One keyframe / the options of a WAAPI run — the subset this phrase speaks. */
type Frame = Record<string, string | number>;
type FrameOptions = {duration: number, delay?: number, easing?: string, fill?: 'none' | 'forwards' | 'backwards' | 'both'};
type Animatable = HTMLElement & {animate?: (keyframes: Array<Frame>, options: FrameOptions) => Animation};

function animate(el: Element | null, keyframes: Array<Frame>, options: FrameOptions): Promise<void> {
  const target = el as Animatable | null;
  if (target === null || typeof target.animate !== 'function') {
    return Promise.resolve();
  }
  const anim = target.animate(keyframes, options);
  return anim.finished.then(() => undefined, () => undefined);
}

/** The FLIP of the plate: the transform that lays the plate's full box over `from`. */
function flipTransform(plate: LobbyRect, from: LobbyRect): string {
  const sx = Math.max(0.02, from.width / Math.max(1, plate.width));
  const sy = Math.max(0.02, from.height / Math.max(1, plate.height));
  const dx = from.left - plate.left;
  const dy = from.top - plate.top;
  return `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
}

/**
 * The order the cards surface in: by the distance of each card's centre from the stage's centre (the campaign map's
 * wave out of the centre) plus a short reading-order step (two cards symmetric about the centre still come in turn),
 * as delays in ms. Pure — the rects are measured by the caller.
 */
export function waveDelays(cards: ReadonlyArray<LobbyRect>, stage: LobbyRect, stepMs: number, orderMs = 0): Array<number> {
  if (cards.length === 0) {
    return [];
  }
  const cx = stage.left + stage.width / 2;
  const cy = stage.top + stage.height / 2;
  const unit = Math.max(1, Math.min(...cards.map((c) => Math.max(c.width, c.height))));
  const order = cards.length > 1 ? Math.min(orderMs, LOBBY_WAVE_ORDER_SPAN_MS / (cards.length - 1)) : 0;
  return cards.map((c, i) => {
    const d = Math.hypot(c.left + c.width / 2 - cx, c.top + c.height / 2 - cy) / unit;
    return Math.round(d * stepMs + i * order);
  });
}

function rectOf(el: Element): LobbyRect {
  const r = el.getBoundingClientRect();
  return {left: r.left, top: r.top, width: r.width, height: r.height};
}

/** The cards of a screen, in DOM order. */
function cardsOf(root: Element): Array<HTMLElement> {
  return Array.from(root.querySelectorAll<HTMLElement>('.cm-lcard, .cm-lobby__state, .cm-lobby__band'));
}

/**
 * UNFOLD — the screen arrives out of `origin` (the pressed menu item). Resolves when the plate has opened and the last
 * card has surfaced. Every part is held at its first keyframe from the first frame (`fill: backwards` — the enter hook
 * runs before the first paint), so the finished composition never flashes ahead of its phrase.
 */
export async function unfoldLobbyScreen(root: HTMLElement, origin: LobbyRect | undefined): Promise<void> {
  const plate = root.querySelector<HTMLElement>('.cm-screen__plate');
  const head = root.querySelector<HTMLElement>('.cm-screen__head');
  const stage = root.querySelector<HTMLElement>('.cm-screen__stage');
  const cards = cardsOf(root);
  if (consoleReducedMotionActive()) {
    await animate(root, [{opacity: 0}, {opacity: 1}], {duration: LOBBY_REDUCED_MS, easing: 'linear', fill: 'backwards'});
    return;
  }
  const unfold = consoleMotionMs(LOBBY_UNFOLD_MS);
  const content = consoleMotionMs(LOBBY_CONTENT_MS);
  const wave = consoleMotionMs(LOBBY_WAVE_MS);
  const plateMove = plate !== null && origin !== undefined ?
    animate(plate, [
      {transform: flipTransform(rectOf(plate), origin), opacity: 0.55},
      {transform: 'none', opacity: 1},
    ], {duration: unfold, easing: MOTION_EASE.enter, fill: 'backwards'}) :
    animate(plate, [{opacity: 0}, {opacity: 1}], {duration: unfold, easing: MOTION_EASE.enter, fill: 'backwards'});
  // The head and the stage's frame surface from inside the opening plate (REVEAL), a beat behind it.
  const headIn = animate(head, [{opacity: 0, transform: 'translateY(-0.6rem)'}, {opacity: 1, transform: 'none'}],
    {duration: content, delay: Math.round(unfold * 0.45), easing: MOTION_EASE.standard, fill: 'backwards'});
  const stageRect = stage !== null ? rectOf(stage) : rectOf(root);
  const delays = waveDelays(cards.map(rectOf), stageRect, consoleMotionMs(LOBBY_WAVE_STEP_MS), consoleMotionMs(LOBBY_WAVE_ORDER_MS));
  // `fill: backwards` holds every card at its first keyframe through its delay — the enter hook runs before the first
  // paint, so no card is ever painted ahead of its turn.
  const cardMoves = cards.map((card, i) => animate(card, [
    {opacity: 0, transform: 'translateY(1.1rem) scale(0.965)'},
    {opacity: 1, transform: 'none'},
  ], {duration: wave, delay: Math.round(unfold * 0.6) + delays[i], easing: MOTION_EASE.enter, fill: 'backwards'}));
  await Promise.all([plateMove, headIn, ...cardMoves]);
}

/**
 * FOLD — the screen leaves into `target` (the menu item the cursor stands on): the cards let go on the spot, the head
 * fades, the plate folds into the item. Resolves when the plate has gone.
 */
export async function foldLobbyScreen(root: HTMLElement, target: LobbyRect | undefined): Promise<void> {
  const plate = root.querySelector<HTMLElement>('.cm-screen__plate');
  const head = root.querySelector<HTMLElement>('.cm-screen__head');
  const cards = cardsOf(root);
  if (consoleReducedMotionActive()) {
    await animate(root, [{opacity: 1}, {opacity: 0}], {duration: LOBBY_REDUCED_MS, easing: 'linear', fill: 'forwards'});
    return;
  }
  const fold = consoleMotionMs(LOBBY_FOLD_MS);
  const letGo = Math.round(fold * 0.55);
  const contentOut = [head, ...cards].map((el) => animate(el, [{opacity: 1}, {opacity: 0}], {duration: letGo, easing: MOTION_EASE.exit, fill: 'forwards'}));
  const plateOut = plate !== null && target !== undefined ?
    animate(plate, [
      {transform: 'none', opacity: 1},
      {transform: flipTransform(rectOf(plate), target), opacity: 0.4},
    ], {duration: fold, delay: Math.round(letGo * 0.5), easing: MOTION_EASE.standard, fill: 'forwards'}) :
    animate(plate, [{opacity: 1}, {opacity: 0}], {duration: fold, easing: MOTION_EASE.exit, fill: 'forwards'});
  await Promise.all([plateOut, ...contentOut]);
}
