/*
 * THE BOARD SCENE'S REGISTERED MEMBERS — a board scene that WAITS for the
 * board's quiet itself (it starts only once the field has spoken) cannot be
 * imported by `rewardPayoutQuiet.ts` without an import cycle, so it registers
 * its own «on stage» predicate here and `boardSceneSettling()` asks them all:
 * «ТАЙЛ ПЛАТИТ КАРТЕ» (`tilePlacement/cityDataPayoutBeat.ts` — the card
 * standing by the field, the tokens in the air). A member's WAITING phase must
 * not read «on stage», or it would wait for itself.
 *
 * Deliberately import-free: both sides import it, it imports nothing.
 */

const members: Array<() => boolean> = [];

/** Register a scene's «on stage» predicate (idempotent). */
export function registerBoardSceneMember(busy: () => boolean): void {
  if (!members.includes(busy)) {
    members.push(busy);
  }
}

/** Is any registered member on stage now? */
export function boardSceneMemberBusy(): boolean {
  return members.some((busy) => busy());
}

/**
 * A member's OWED phase — the scene is decided (its record is in the response) and waits for the field's own story
 * before it plays. Deliberately a SECOND list, never read by `boardSceneSettling()` (a member waiting for the board's
 * quiet must not wait for itself); read by what must come AFTER the board's own story whatever its tempo — the card
 * reaction chain (CI 2026-11-04, `console-red-museum`: the ruling Greens' answer to Nuclear Zone's rating rose INTO
 * the museum's payout on a fast frame and after it on a slow one — the chain had slipped through the window where the
 * scene still waited for the scales).
 */
const owed: Array<() => boolean> = [];

/** Register a scene's «owed, not yet on stage» predicate (idempotent). */
export function registerBoardSceneOwed(isOwed: () => boolean): void {
  if (!owed.includes(isOwed)) {
    owed.push(isOwed);
  }
}

/** Is any registered member owed (decided, waiting for its turn)? */
export function boardSceneOwedBusy(): boolean {
  return owed.some((isOwed) => isOwed());
}
