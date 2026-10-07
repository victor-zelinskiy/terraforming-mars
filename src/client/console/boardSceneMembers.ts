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
