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
 * 9 — три, 10+ — четыре»). SEVEN generation BANDS, a cap per difficulty in each;
 * Hard is the owner's own row, the others one step around it. The last two
 * bands (13–15 · 16+) are the LONG game's — added 2026-11-07 with Amazonis
 * Planitia, whose longer parameters run a game a quarter longer: the ladder
 * had been written for games that end by the 13th generation, and a bot that
 * had earned four extra cards in the 10th deserves no fewer in the 16th, when
 * the human's engine is at its widest (the owner: «расширить скейлы
 * динамического баланса на более поздние поколения»). Brutal stays at 4 to the
 * end — its +1 VP per played card compounds with every extra card. Measured: before
 * the rule the bot passed first in 32–44 % of the 5th–6th generations, 75–90 %
 * of the 7th–8th, 91 % of the 9th; through the 1st–4th it never did (it passed
 * LAST in 100 / 100 / 96 / 68 %), so a card there only widened its lead. Brutal
 * stays at 4 — its +1 VP per played card compounds with every extra card.
 * READ LIVE at every bot turn from the game's generation: a game already under
 * way with the switch on takes a new ladder up the moment the server does.
 */
export const SECOND_SHIFT_CAP_LADDER: Readonly<Record<DifficultyLevel, readonly [number, number, number, number, number, number, number]>> = {
  easy: [0, 0, 1, 1, 2, 2, 3],
  normal: [0, 1, 1, 2, 3, 3, 4],
  hard: [0, 1, 2, 3, 4, 4, 5],
  brutal: [0, 2, 3, 4, 4, 4, 4],
};
/** The first generation of each band after the first: 1–4 · 5–6 · 7–8 · 9 · 10–12 · 13–15 · 16+. */
export const SECOND_SHIFT_BAND_STARTS: readonly [number, number, number, number, number, number] = [5, 7, 9, 10, 13, 16];

/**
 * THE LONG MAP'S BONUS (the owner, 2026-11-08, after the campaign mission on Amazonis Planitia the bot lost 164 : 173):
 * on a map with a bot pace offset (`botPace.ts` — longer global parameters, Amazonis Planitia) every ACTIVE band of
 * the ladder is ONE card higher; the sleeping first band (1–4) stays asleep. Measured on that game (two humans with
 * carried engines, 8 generations): the humans took 25–38 actions a generation in the 5th–8th against the bot's 9–11
 * turns with 1 / 1 / 2 / 2 extra cards; an extra card there was worth 1.2–1.6 TR in the 5th–7th and, in a campaign,
 * ≈ 2–3 VP through the holdings' dividends in the 8th (the bot ended two cheap cards short of C01's +10 and two Earth
 * tags short of CF2's +8). The bonus gives 2 / 2 / 3 / 3 in such a game — four cards, one in each late generation;
 * the humans' share of a longer planet is what it answers, so a standard-length map reads the ladder as printed.
 * ONE card on every difficulty (the owner, 2026-11-09): a by-difficulty variant (Hard / Brutal +2 from the 7th
 * generation — 2 / 2 / 4 / 4 in that game) shipped for a day and was withdrawn as an overbuff; the steady +1 stays.
 */
export const SECOND_SHIFT_LONG_MAP_BONUS = 1;

/** Whether the difficulty has the rule at all — any rung above zero (every difficulty today); the creator's generation-free reading. */
export function secondShiftRuleApplies(difficulty: DifficultyLevel): boolean {
  return SECOND_SHIFT_CAP_LADDER[difficulty].some((cap) => cap > 0);
}

/** The most the difficulty can ever draw in one generation — the ladder's top rung (one higher on a long map). */
export function secondShiftMaxCap(difficulty: DifficultyLevel, longMap = false): number {
  return withLongMapBonus(Math.max(...SECOND_SHIFT_CAP_LADDER[difficulty]), longMap);
}

/** The cap of THIS generation on this difficulty — `longMap`: the map carries a bot pace offset (`botPaceOffset > 0`). */
export function secondShiftCap(difficulty: DifficultyLevel, generation: number, longMap = false): number {
  const band = SECOND_SHIFT_BAND_STARTS.filter((start) => generation >= start).length;
  return withLongMapBonus(SECOND_SHIFT_CAP_LADDER[difficulty][band], longMap);
}

/** The long map's +1 on an ACTIVE rung only — a sleeping band (cap 0) stays asleep. */
function withLongMapBonus(cap: number, longMap: boolean): number {
  return longMap && cap > 0 ? cap + SECOND_SHIFT_LONG_MAP_BONUS : cap;
}
