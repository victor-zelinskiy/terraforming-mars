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
 * draws an extra project card and resolves it as usual — up to this CAP per
 * generation, set by the difficulty. Nothing changes in a generation the bot
 * outlasts (the first four, every short game); a long generation is where
 * the rule works. HIDDEN BALANCE (the owner, 2026-10-28): the extra card is
 * never announced — no journal line, no turn step, no counter on any screen
 * (the deck count stays the rulebook's); a player who knew the moment and the
 * cap could pass «at the right time» to deny it. Shared by the server (the
 * rule) and the creator (the switch beside the difficulty; its note names no
 * number).
 */
export const SECOND_SHIFT_CAP: Readonly<Record<DifficultyLevel, number>> = {
  easy: 0,
  normal: 1,
  hard: 2,
  brutal: 3,
};

export function secondShiftCap(difficulty: DifficultyLevel): number {
  return SECOND_SHIFT_CAP[difficulty];
}
