import {DifficultyLevel} from './AutomaTypes';

/**
 * «ВТОРАЯ СМЕНА» — the late-game pace rule of MarsBot (the owner, 2026-10-28;
 * docs/claude/marsbot-second-shift.md).
 *
 * Measured on the owner's 25 finished Turmoil Redux games: from the 7th
 * generation on the bot takes a third of the best human's actions and passes
 * FIRST in 75–91 % of the generations — its action deck is constant (6–7
 * cards) while a human engine runs 15 turns. So while at least one player is
 * still acting in the generation, a bot whose deck ran out does not pass: it
 * draws an extra project card and resolves it as usual — up to a CAP per
 * generation, set by the difficulty and the generation (the ladder below).
 * Nothing changes in a generation the bot
 * outlasts (the first four, every short game); a long generation is where
 * the rule works. HIDDEN BALANCE (the owner, 2026-10-28): the extra card is
 * never announced — no journal line, no turn step, no counter on any screen
 * (the deck count stays the rulebook's); a player who knew the moment and the
 * cap could pass «at the right time» to deny it. Shared by the server (the
 * rule) and the creator (the switch beside the difficulty; its note names no
 * number).
 */
/**
 * THE CAP LADDER (the owner, 2026-10-28): a base by difficulty, one step up from
 * the 7th generation and another from the 10th. Measured on the same 23 games:
 * the bot passes first from the 7th generation on, 15 of 23 games end in the
 * 8th–9th, 4 reach the 10th; a late card still yields ~1.8 track steps but
 * fails more often (the tracks near their ends), paying M€ instead. Brutal
 * stays at 4 — its +1 VP per played card compounds with every extra card;
 * Easy draws nothing before the 7th generation and one card from there on, so
 * the switch means something on every difficulty.
 * READ LIVE at every bot turn from the game's generation: a game already under
 * way with the switch on takes a new ladder up the moment the server does.
 */
export const SECOND_SHIFT_CAP_LADDER: Readonly<Record<DifficultyLevel, readonly [number, number, number]>> = {
  easy: [0, 1, 1],
  normal: [1, 1, 2],
  hard: [2, 3, 4],
  brutal: [3, 4, 4],
};
/** The generation the ladder's first step starts at (the bot passes first from here on). */
export const SECOND_SHIFT_LATE_GENERATION = 7;
/** The generation the ladder's second step starts at (a long game). */
export const SECOND_SHIFT_LONG_GENERATION = 10;

/** The base cap by difficulty — the ladder's first rung (Easy's is 0: its one card comes from the 7th generation). */
export const SECOND_SHIFT_CAP: Readonly<Record<DifficultyLevel, number>> = {
  easy: SECOND_SHIFT_CAP_LADDER.easy[0],
  normal: SECOND_SHIFT_CAP_LADDER.normal[0],
  hard: SECOND_SHIFT_CAP_LADDER.hard[0],
  brutal: SECOND_SHIFT_CAP_LADDER.brutal[0],
};

/** Whether the difficulty has the rule at all — any rung above zero (every difficulty today); the creator's generation-free reading. */
export function secondShiftRuleApplies(difficulty: DifficultyLevel): boolean {
  return SECOND_SHIFT_CAP_LADDER[difficulty].some((cap) => cap > 0);
}

/** The most the difficulty can ever draw in one generation — the ladder's top rung. */
export function secondShiftMaxCap(difficulty: DifficultyLevel): number {
  return Math.max(...SECOND_SHIFT_CAP_LADDER[difficulty]);
}

/** The cap of THIS generation on this difficulty. */
export function secondShiftCap(difficulty: DifficultyLevel, generation: number): number {
  const tier = generation >= SECOND_SHIFT_LONG_GENERATION ? 2 : generation >= SECOND_SHIFT_LATE_GENERATION ? 1 : 0;
  return SECOND_SHIFT_CAP_LADDER[difficulty][tier];
}
