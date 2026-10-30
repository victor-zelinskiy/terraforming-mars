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
 *    3rd / 4th generation's deck takes at most 0 / 1 / 2 / 3 cards of the bonus
 *    side, chosen by a shuffle, the whole side from the 5th. Measured on 25
 *    Redux Hard games before the rule: the bot passed LAST in 100 / 100 / 96 %
 *    of the 1st–3rd generations with 3.2 / 4.2 / 4.2 bonus-side turns in each,
 *    and its lead over the best player grew +2.4 / +5.9 / +4.5 / +4.3 VP in the
 *    1st–4th — the 1st generation barely moves it (the project cards and the
 *    rating do), the 2nd–4th build it, ≈ +1.5–3 VP of lead per bonus-side turn
 *    there. So the ladder starts at ZERO and shifts the 2nd–4th by one card each
 *    (the owner, 2026-10-29 evening; the first ladder was 1 / 2 / 3, full from
 *    the 4th). (A stretch to 0 / 1 / 1 / 2 / 3 shipped for a few hours on
 *    2026-10-30 on a misread corpus and was rolled back: the bonus side gives
 *    the bot almost no points of its own — Government Intervention raises a
 *    scale with NO TR — its early VP come from its PROJECT cards' tags landing
 *    on the tracks' printed «+3 TR» cells; see the third half below.) A first
 *    cut withheld PROJECT cards instead — 2 / 1 / 1 — and was
 *    rolled back the same day: the start lost its variety, «тут разнообразие
 *    важнее».
 *  · EARLY, the projects — THE PRELUDE CARDS COME ONE PER GENERATION (the
 *    owner, 2026-10-30: «эти 3 карты за прелюдии отдавать боту постепенно»).
 *    The rulebook gives the bot 3 project cards «instead of prelude cards» in
 *    the 1st generation — 6 projects there, 3 after — and those tags reach the
 *    tracks' first printed «+3 TR» cells (the power track's 3rd on every board,
 *    the earth track's 4th on Tharsis / Hellas / Utopia) in the first one or
 *    two generations. With the switch on the three come one per generation
 *    over the 1st–3rd: 4 / 4 / 4 instead of 6 / 3 / 3 — the same twelve cards
 *    by the end of the 3rd, the variety of the random tags kept, only the
 *    timing moves. A game without the Prelude expansion has none to spread.
 *  · LATE — «ВТОРАЯ СМЕНА» (`common/automa/SecondShift.ts`): in a generation
 *    the players outlast, an empty deck draws an extra card instead of passing,
 *    up to the ladder's cap.
 *
 * A deck is built when its generation starts — a game already under way with
 * the switch on meets the early half only in generations it has yet to begin.
 */
export const DYNAMIC_BALANCE_BONUS_SIDE: readonly number[] = [0, 1, 2, 3];

/** The project cards the bot takes «instead of prelude cards» (rulebook: all three in the 1st generation). */
export const AUTOMA_PRELUDE_PROJECT_CARDS = 3;

/** Under the switch, the prelude cards one per generation over the 1st–3rd (Σ = {@link AUTOMA_PRELUDE_PROJECT_CARDS}). */
export const DYNAMIC_BALANCE_PRELUDE_SPREAD: readonly number[] = [1, 1, 1];

/**
 * How many «instead of preludes» project cards THIS generation's deck adds — 0 in a game without the Prelude
 * expansion; the rulebook's 3 in the 1st generation with the switch off; the spread's share with it on.
 */
export function preludeProjectCards(generation: number, preludeExtension: boolean, dynamicBalance: boolean): number {
  if (!preludeExtension) {
    return 0;
  }
  if (!dynamicBalance) {
    return generation === 1 ? AUTOMA_PRELUDE_PROJECT_CARDS : 0;
  }
  return generation >= 1 && generation <= DYNAMIC_BALANCE_PRELUDE_SPREAD.length ? DYNAMIC_BALANCE_PRELUDE_SPREAD[generation - 1] : 0;
}

/** The switch — the one option both halves read. */
export function dynamicBalanceOn(options: AutomaOptions | undefined): boolean {
  return options?.secondShift === true;
}

/** How many cards of the bonus side THIS generation's deck may take under the switch — undefined = all of them. */
export function bonusSideCap(generation: number): number | undefined {
  return generation >= 1 && generation <= DYNAMIC_BALANCE_BONUS_SIDE.length ? DYNAMIC_BALANCE_BONUS_SIDE[generation - 1] : undefined;
}
