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
