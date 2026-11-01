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
 * ONE HANDOFF FOR THE WHOLE ROW (2026-11-01, the owner's «вторая карта в
 * момент приземления мигнула»): the real cards of the batch stay HELD until
 * the cover scene's own handoff, so a guest that dissolved its flyers the
 * moment they landed left its slots EMPTY for the cover scene's frame beat —
 * the card vanished and came back. The guest's flyers now HOVER in their slots
 * like the cell's own, and dissolve in the SAME frame the cover scene releases
 * the real cards (`releaseIntakeGuest` — the host's handoff, and every end of
 * the host scene, idempotent).
 *
 * No handler registered → the continuation resolves at once (the cover scene
 * proceeds to its handoff; the remaining slots unveil with the real cards —
 * an honest degrade, never a stranded reveal).
 */
import {DrawnCardEntry} from '@/client/components/drawnCards/drawnCardsState';

export type IntakeContinuation = (e: DrawnCardEntry, fromCard: number, onDone: () => void) => void;

let continuation: IntakeContinuation | undefined;
/** The guest's standing flyers, waiting for the host's handoff to dissolve over the released cards. */
let guestRelease: (() => void) | undefined;

/** The deck layer registers its continuation (idempotent; `undefined` unregisters). */
export function registerIntakeContinuation(fn: IntakeContinuation | undefined): void {
  continuation = fn;
}

/**
 * Play the runs from `fromCard` on (the cards before it were flown by the
 * caller's own scene). `onDone` fires once every remaining run has LANDED —
 * the flyers keep standing in their slots until `releaseIntakeGuest` — or at
 * once when nobody can play them.
 */
export function continueIntakeAssembly(e: DrawnCardEntry, fromCard: number, onDone: () => void): void {
  if (continuation === undefined || fromCard >= e.cards.length) {
    onDone();
    return;
  }
  continuation(e, fromCard, onDone);
}

/** The guest parks its flyers' dissolve here when its runs have landed (`undefined` = nothing standing). */
export function holdIntakeGuest(release: (() => void) | undefined): void {
  guestRelease = release;
}

/**
 * The HOST's handoff (or any end of the host scene): the guest's flyers dissolve now, over the real cards the host
 * is releasing in this very frame. Idempotent; a no-op when no guest stands.
 */
export function releaseIntakeGuest(): void {
  const release = guestRelease;
  guestRelease = undefined;
  release?.();
}

/** Test / teardown hook. */
export function resetIntakeAssembly(): void {
  continuation = undefined;
  guestRelease = undefined;
}
