/*
 * ConsoleStartScene's MODULE state (docs/claude/vapor/RECIPES.md § R25). Inside `<script setup>` every top-level
 * statement runs once per INSTANCE, so the handles the scene keeps PER PAGE live here — one start scene at a time, as
 * it was (a minimize → restore re-creates the component; the handle of the scene before it must be the one let go) —
 * each together with the code that owns it. The scene calls these and never sees a handle.
 */
import {ReactorPlace, registerReactorPlace} from '@/client/console/cardReaction/reactorPlaces';

/** The start's registration as a reactor's place (PL-1098) — one start scene at a time. */
let startReactorPlaceOff: (() => void) | undefined;

/** The start stands as a reactor's place from now — the registration before it (if any) is retired first. */
export function standStartReactorPlace(place: ReactorPlace): void {
  startReactorPlaceOff?.();
  startReactorPlaceOff = registerReactorPlace(place);
}

/**
 * DOES THE START OFFER ITSELF AS A REACTOR'S PLACE (pure)? It CARRIES the card (the corporation or a prelude the
 * ceremony brings — the queue, the shelf, the seat), the card's face is not BURIED under another on the shelf — and
 * the scene PAINTS. A start that has yielded the screen (the board owns it: a prelude's tile waits for the player's
 * cell) shows no face of anything until the player has placed — a wait for the PLAYER, which the reactor's place
 * bounded in seconds: the rise waited its whole eight for a face that could not come, and only then rose at the
 * stage (`wait-graph/ceiling/start:reactor-face` — CI, `field-start-sbp-triton`: eight runs of eight under CPU x4,
 * one walk of 606 at full speed). A place that cannot show a face is no place: the reactor rises at the stage at
 * once, over the board the player is looking at.
 *
 * …AND ITS HOME IS NOT PUT AWAY. That guess («the scene has yielded») was wrong for the class it was made for — the
 * ceiling's own line said what stands (`ArrivingFaceWait.whyNot`): «seat none; shelf hidden; scene ceremony; seat
 * shows Experimental Forest, receives nothing; arriving false». The corporation's face lies on the shelf «РАЗЫГРАНО»,
 * and the scene itself has put the shelf away: an EMBEDDED STEP of another card spans the row, and that card presides
 * in the seat. Nothing is bringing the corporation's face anywhere until the player ends the step — the framework's
 * own law for a receded card («nothing is coming, the stage is right at once»), which the start's promise overrode.
 */
export function startOffersReactorPlace(s: {carries: boolean, buried: boolean, painting: boolean, putAway?: boolean}): boolean {
  return s.carries && !s.buried && s.painting && s.putAway !== true;
}

/** The start is no reactor's place any more (its scene unmounts); nothing to do when it was none. */
export function retireStartReactorPlace(): void {
  startReactorPlaceOff?.();
  startReactorPlaceOff = undefined;
}

/** The queue box's observer (TRP0 · DE — the queue card sized from the box) and the element it watches. */
let queueBoxObserver: ResizeObserver | undefined;
let queueBoxObserved: Element | undefined;

/**
 * Observe the deployment queue's box — re-attached when the ceremony mounts a new one (`undefined` = no queue: the
 * observer lets go). Answers `true` when a NEW box is observed from now — the caller solves its zoom once, at once —
 * and `false` when the box is the one already observed, when there is none, or where there is no `ResizeObserver`.
 */
export function observeStartQueueBox(el: Element | undefined, onResize: () => void): boolean {
  if (el === queueBoxObserved) {
    return false;
  }
  queueBoxObserver?.disconnect();
  queueBoxObserved = el;
  if (el === undefined || typeof ResizeObserver === 'undefined') {
    return false;
  }
  queueBoxObserver = new ResizeObserver(onResize);
  queueBoxObserver.observe(el);
  return true;
}

/** The queue box under observation (the one the zoom is solved from) — `undefined` while there is none. */
export function observedStartQueueBox(): HTMLElement | undefined {
  return queueBoxObserved as HTMLElement | undefined;
}

/** The scene unmounts: the observer disconnects and the box is let go. */
export function releaseStartQueueBox(): void {
  queueBoxObserver?.disconnect();
  queueBoxObserver = undefined;
  queueBoxObserved = undefined;
}
