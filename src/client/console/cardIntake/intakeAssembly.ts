/*
 * THE ASSEMBLY SCENE's registry — the one seam between the two layers that
 * deal a merged batch («ОДНО ДЕЙСТВИЕ — ОДИН ЗАБОР», Ф3).
 *
 * A batch rooted on the BOARD (a tile's cell bonus with a table hook behind
 * it — Ф-Б) is opened by the board card-bonus scene: its cover lifted off the
 * cell at the submit, so the cell's run is that scene's to fly. The runs that
 * follow (the trigger cards surfacing and dealing) are the deck layer's — it
 * owns the trigger faces and the arrival director. The cover scene therefore
 * HANDS OVER after its own run has landed and waits for the continuation to
 * settle before its handoff; the deck layer registers itself here once.
 *
 * No handler registered → the continuation resolves at once (the cover scene
 * proceeds to its handoff; the remaining slots unveil with the real cards —
 * an honest degrade, never a stranded reveal).
 */
import {DrawnCardEntry} from '@/client/components/drawnCards/drawnCardsState';

export type IntakeContinuation = (e: DrawnCardEntry, fromCard: number, onDone: () => void) => void;

let continuation: IntakeContinuation | undefined;

/** The deck layer registers its continuation (idempotent; `undefined` unregisters). */
export function registerIntakeContinuation(fn: IntakeContinuation | undefined): void {
  continuation = fn;
}

/**
 * Play the runs from `fromCard` on (the cards before it were flown by the
 * caller's own scene). `onDone` fires once every remaining run has settled —
 * or at once when nobody can play them.
 */
export function continueIntakeAssembly(e: DrawnCardEntry, fromCard: number, onDone: () => void): void {
  if (continuation === undefined || fromCard >= e.cards.length) {
    onDone();
    return;
  }
  continuation(e, fromCard, onDone);
}

/** Test / teardown hook. */
export function resetIntakeAssembly(): void {
  continuation = undefined;
}
