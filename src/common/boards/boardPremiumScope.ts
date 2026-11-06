import {BoardName} from './BoardName';

/**
 * BOARDS THE ENGINE PLAYS BUT THE PREMIUM SCOPE DOES NOT COVER YET — the one list (vize1215 fork).
 *
 * A board here has its BASE adaptation only: the server builds it, its rules hold (maximums, track bonuses, space
 * bonuses, milestones and awards), a game can be created for it through the API. What it does NOT have yet is the
 * console: the creator does not offer it, the random pools skip it (`randomBoard.ts`), MarsBot has no profile for it,
 * and the premium guards that walk every board (the creator's miniature geometry, the printed-bonus faces) exempt it
 * by reading this list. The board's FULL adaptation empties its row here — the guards then name what is missing.
 *
 * Amazonis Planitia — the official eleven-row board (upstream 900e758a78 and its chain), base-adapted 2026-11-06:
 * its larger scales (+14 °C, 18 % oxygen, 11 oceans, Venus to 33 % in 1 % steps above 30), the 91-hex render
 * (upstream 27db80e67e — not taken, nor its art: the fork's scales are dynamic), the standard-resource cell face, Alt
 * Venus on the 33 % track and its printed set's retired Lobbyist (→ Activist, the owner's word) are the
 * full adaptation's.
 */
export const BOARDS_PENDING_PREMIUM_ADAPTATION: ReadonlyArray<BoardName> = [
  BoardName.AMAZONIS_PLANITIA,
];

/** Is `name` in the premium scope (every surface of the console covers it)? See {@link BOARDS_PENDING_PREMIUM_ADAPTATION}. */
export function isBoardInPremiumScope(name: BoardName): boolean {
  return !BOARDS_PENDING_PREMIUM_ADAPTATION.includes(name);
}
