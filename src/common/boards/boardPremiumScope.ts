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
 * Empty since 2026-11-06: Amazonis Planitia (the official eleven-row board, base-adapted the same day) passed its
 * phase-1 premium adaptation (`docs/claude/amazonis-planitia-phase-1.md` — the 91-hex field, the longer dials, Alt
 * Venus to 33 %, Activist in its printed set). MarsBot on it is phase 2 (`AUTOMA_SUPPORTED_BOARDS`, not this list).
 */
export const BOARDS_PENDING_PREMIUM_ADAPTATION: ReadonlyArray<BoardName> = [];

/** Is `name` in the premium scope (every surface of the console covers it)? See {@link BOARDS_PENDING_PREMIUM_ADAPTATION}. */
export function isBoardInPremiumScope(name: BoardName): boolean {
  return !BOARDS_PENDING_PREMIUM_ADAPTATION.includes(name);
}
