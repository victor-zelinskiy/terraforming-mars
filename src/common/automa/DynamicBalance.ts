import {AutomaOptions} from './AutomaTypes';

/**
 * «ДИНАМИЧЕСКИЙ БАЛАНС» — MarsBot's pace across the whole game, ONE switch beside
 * the bot's difficulty (`AutomaOptions.secondShift` — the key the first half
 * shipped under; absent ⇒ off, every pre-rule save and spec unchanged). Two
 * halves, both HIDDEN balance (never announced, never counted on a screen):
 *
 *  · EARLY — THE BASE DECK FILLS GRADUALLY (this module, the owner 2026-10-29:
 *    «в 1–3 поколении бот почти в 100 % партий делает больше ходов и пасует
 *    позже игроков — пусть базовую колоду заполняет постепенно»). Measured on
 *    25 Redux Hard games before the rule: the bot passed LAST in 100 / 100 / 96 %
 *    of the 1st–3rd generations (9.3 / 7.3 / 7.4 turns against the best human's
 *    10.2 / 9.4 / 12.4 actions — the human count includes free conversions; the
 *    pass order is the honest witness). So in those generations the deck holds
 *    FEWER project cards: 2 fewer in the 1st, 1 fewer in the 2nd and the 3rd —
 *    on top of nothing else (the cards for the preludes, the floater spend, the
 *    bonus and recurring cards stay). A withheld card is simply not taken: in a
 *    draft game the corporation's Draft Priority keeps the best of the drafted
 *    cards and the rest go to the discard pile with the rulebook's own discard.
 *  · LATE — «ВТОРАЯ СМЕНА» (`common/automa/SecondShift.ts`): in a generation
 *    the players outlast, an empty deck draws an extra card instead of passing,
 *    up to the ladder's cap.
 *
 * A deck is built when its generation starts — a game already under way with
 * the switch on meets the early half only in generations it has yet to begin.
 */
export const DYNAMIC_BALANCE_WITHHELD: readonly number[] = [2, 1, 1];

/** The switch — the one option both halves read. */
export function dynamicBalanceOn(options: AutomaOptions | undefined): boolean {
  return options?.secondShift === true;
}

/** Project cards the base deck of THIS generation leaves out under the switch (0 from the 4th generation on). */
export function withheldProjectCards(generation: number): number {
  return generation >= 1 && generation <= DYNAMIC_BALANCE_WITHHELD.length ? DYNAMIC_BALANCE_WITHHELD[generation - 1] : 0;
}
