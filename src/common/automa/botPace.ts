import {BoardName} from '../boards/BoardName';

/**
 * THE BOT'S PACE OFFSET of a map — how many generations LATER the game on it runs its course (docs/claude/
 * amazonis-planitia-marsbot.md § The clock; docs/AUTOMA_DATA_AUDIT.md §24.5).
 *
 * MarsBot's «clock» ladders are written for the standard map: the final-scoring reference card converts the bot's M€
 * at 8 M€ a VP up to the 12th generation and tightens a rung a generation after it (7 … 1 for the 13th–19th), and
 * entering the 20th generation (the 18th with Prelude) is an instant win for the bot — both model «how close to the
 * end this game is», and both assume the standard map's 42 Martian terraforming steps. Amazonis Planitia prints 51
 * (11 oceans, 22 temperature steps, 18 % oxygen — a quarter more), so a game there runs about a quarter longer: the
 * owner's solo games end around the 13th generation on the standard map, which is the 16th here. Read unshifted, the
 * reference card would price the bot's money at 4 M€ a VP in a game the human is still terraforming — the clock
 * would say «late» while the planet says «mid-game». So every clock ladder reads the generation LESS this offset
 * (the rulebook itself hands the standard solo game one extra generation on this map — upstream 16da0a0117).
 *
 * The second-shift cap ladder deliberately does NOT read it: the length of a GENERATION (how many actions a human
 * takes before passing) is the engine's doing, not the planet's, and that rule is about outlasting a generation.
 */
export const BOT_PACE_OFFSETS: Readonly<Partial<Record<BoardName, number>>> = {
  [BoardName.AMAZONIS_PLANITIA]: 3,
};

/** The generations the clock of a game on `boardName` runs behind the standard map's (0 for every other map). */
export function botPaceOffset(boardName: BoardName | string | undefined): number {
  return boardName === undefined ? 0 : (BOT_PACE_OFFSETS[boardName as BoardName] ?? 0);
}
