import {AutomaOptions} from './AutomaTypes';

/**
 * «ДИНАМИЧЕСКИЙ БАЛАНС» — MarsBot's pace across the whole game, ONE switch beside
 * the bot's difficulty (`AutomaOptions.secondShift` — the key the first half
 * shipped under; absent ⇒ off, every pre-rule save and spec unchanged). Two
 * halves, both HIDDEN balance (never announced, never counted on a screen), and
 * neither reads what the players do (the owner, 2026-10-29: a bot whose pace
 * answers the table's moves is a hidden lever the players would learn to pull):
 *
 *  · EARLY — THE BONUS SIDE OF THE DECK FILLS GRADUALLY (this module, the owner
 *    2026-10-29). The action deck is two parts: the PROJECT cards (3 on Hard,
 *    +3 for the preludes in the 1st generation) — whose random tags are what
 *    makes one game's bot unlike another's, and which are NEVER cut — and the
 *    BONUS side: the top card of the bonus deck plus the recurring cards (Party
 *    Politics in Redux, Government Intervention with Venus, Shipping Lines with
 *    colonies), the same in every game. With the switch on, the 1st / 2nd /
 *    3rd / 4th / 5th generation's deck takes at most 0 / 1 / 1 / 2 / 3 cards of
 *    the bonus side, chosen by a shuffle, the whole side from the 6th. Measured on 25
 *    Redux Hard games before the rule: the bot passed LAST in 100 / 100 / 96 %
 *    of the 1st–3rd generations with 3.2 / 4.2 / 4.2 bonus-side turns in each,
 *    and its lead over the best player grew +2.4 / +5.9 / +4.5 / +4.3 VP in the
 *    1st–4th — the 1st generation barely moves it (the project cards and the
 *    rating do), the 2nd–4th build it, ≈ +1.5–3 VP of lead per bonus-side turn
 *    there. So the ladder starts at ZERO and shifts the 2nd–4th by one card each
 *    (the owner, 2026-10-29 evening; the first ladder was 1 / 2 / 3, full from
 *    the 4th). The first campaign under that ladder («Binary Oxygen Surge», 4
 *    missions, 2 players + bot, Hard Redux, 2026-10-30) read on the table: the
 *    bot's lead after the 1st–4th generations −2 / +4 / +6 / +13 — the 1st no
 *    longer moves it, the 4th and the 5th–6th do. So the ladder is stretched by
 *    one generation — 0 / 1 / 1 / 2 / 3 — instead of cutting PROJECT cards in
 *    the 1st (the owner's first idea; a project turn's marginal value there is
 *    ≈ 0–1 VP, a bonus-side turn's +1.5–3). A first cut withheld PROJECT cards
 *    instead — 2 / 1 / 1 — and was
 *    rolled back the same day: the start lost its variety, «тут разнообразие
 *    важнее».
 *  · LATE — «ВТОРАЯ СМЕНА» (`common/automa/SecondShift.ts`): in a generation
 *    the players outlast, an empty deck draws an extra card instead of passing,
 *    up to the ladder's cap.
 *
 * A deck is built when its generation starts — a game already under way with
 * the switch on meets the early half only in generations it has yet to begin.
 */
export const DYNAMIC_BALANCE_BONUS_SIDE: readonly number[] = [0, 1, 1, 2, 3];

/** The switch — the one option both halves read. */
export function dynamicBalanceOn(options: AutomaOptions | undefined): boolean {
  return options?.secondShift === true;
}

/** How many cards of the bonus side THIS generation's deck may take under the switch — undefined = all of them. */
export function bonusSideCap(generation: number): number | undefined {
  return generation >= 1 && generation <= DYNAMIC_BALANCE_BONUS_SIDE.length ? DYNAMIC_BALANCE_BONUS_SIDE[generation - 1] : undefined;
}
