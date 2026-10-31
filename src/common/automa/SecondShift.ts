import {DifficultyLevel} from './AutomaTypes';

/**
 * «ВТОРАЯ СМЕНА» — MarsBot's «ДИНАМИЧЕСКИЙ БАЛАНС» (the owner, 2026-10-28;
 * docs/claude/marsbot-second-shift.md). The switch once had an EARLY half too —
 * a deck that filled gradually in the first generations — and the owner removed
 * it on 2026-10-31: a slower start cost the bot its milestones (0.5 a game
 * against 0.84 before it) and broke the balance; the early deck is the
 * rulebook's again, only this late pace stays.
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
 * THE CAP LADDER (the owner, 2026-10-29, after the «Cold Carbon Mass» campaign
 * played with the rule on: «бот хорошо скейлится в лейт, но откалибровать
 * сильнее — в 1–4 поколении доп. карта не нужна, Hard: 5–6 — одна, 7–8 — две,
 * 9 — три, 10+ — четыре»). Five generation BANDS, a cap per difficulty in each;
 * Hard is the owner's own row, the others one step around it. Measured: before
 * the rule the bot passed first in 32–44 % of the 5th–6th generations, 75–90 %
 * of the 7th–8th, 91 % of the 9th; through the 1st–4th it never did (it passed
 * LAST in 100 / 100 / 96 / 68 %), so a card there only widened its lead. Brutal
 * stays at 4 — its +1 VP per played card compounds with every extra card.
 * READ LIVE at every bot turn from the game's generation: a game already under
 * way with the switch on takes a new ladder up the moment the server does.
 */
export const SECOND_SHIFT_CAP_LADDER: Readonly<Record<DifficultyLevel, readonly [number, number, number, number, number]>> = {
  easy: [0, 0, 1, 1, 2],
  normal: [0, 1, 1, 2, 3],
  hard: [0, 1, 2, 3, 4],
  brutal: [0, 2, 3, 4, 4],
};
/** The first generation of each band after the first: 1–4 · 5–6 · 7–8 · 9 · 10+. */
export const SECOND_SHIFT_BAND_STARTS: readonly [number, number, number, number] = [5, 7, 9, 10];

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
  const band = SECOND_SHIFT_BAND_STARTS.filter((start) => generation >= start).length;
  return SECOND_SHIFT_CAP_LADDER[difficulty][band];
}
