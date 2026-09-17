/*
 * THE PRINTED VP ICON of a card, read from its SEMANTIC declaration — never
 * from a rendered plate, a localized text or a list of card names.
 *
 * Three rules ask «does this card print a (non-negative) VP icon?» and must
 * never disagree: MarsBot's Hard/Brutal scoring of its played pile, the bot
 * corporation Vitor's reward, and the Turmoil Redux resolution Architecture
 * Award («every Building card with a NON-NEGATIVE VP icon you have in play»).
 * They all read this one module.
 *
 * WHAT A CARD DECLARES (`victoryPoints`, shared by `ICard` and `ClientCard`):
 *   · absent               — NO icon. A card without an icon is not
 *                            «non-negative» even though it scores 0: the
 *                            requirement is the icon, not the score.
 *   · a number             — a FIXED icon («1», «2», «−1»); 0 is non-negative.
 *   · a countable formula  — a VARIABLE icon («1 per 2 animals», «−1 per
 *                            city»): its sign is the sign of `each`, whatever
 *                            the formula scores right now (a «1 per science
 *                            resource» card with none still prints a
 *                            non-negative icon; a «−1 per X» penalty at 0 is
 *                            still a negative one).
 *   · 'special'            — a BESPOKE scorer (`getVictoryPoints` override):
 *                            nothing in the declaration says what it can
 *                            score, so the card states its icon's sign itself
 *                            (`victoryPointsSign`, co-located in the card
 *                            file). An undeclared 'special' icon is `unknown`
 *                            and is never read as non-negative — the guard
 *                            spec lists any card that still owes a sign.
 *
 * `either` is a bespoke scorer whose printed rule can score BOTH signs
 * (Agricola Inc: −2…+2 per tag type; Duncan: 7 − X). Such an icon is NOT
 * non-negative: «non-negative» is a property of the icon, and this icon can
 * print a penalty.
 */
import {CountableVictoryPoints} from './CountableVictoryPoints';

/** What a bespoke ('special') VP icon can ever score. */
export type VictoryPointsSign = 'nonNegative' | 'negative' | 'either';

export type VictoryPointsDeclaration = {
  victoryPoints?: number | 'special' | CountableVictoryPoints;
  victoryPointsSign?: VictoryPointsSign;
};

export type VictoryPointsIcon =
  | {kind: 'none'}
  | {kind: 'fixed', points: number}
  | {kind: 'variable', sign: VictoryPointsSign | 'unknown'};

/** The card's printed VP icon, classified from its declaration. */
export function victoryPointsIconOf(card: VictoryPointsDeclaration): VictoryPointsIcon {
  const vp = card.victoryPoints;
  if (vp === undefined) {
    return {kind: 'none'};
  }
  if (typeof vp === 'number') {
    return {kind: 'fixed', points: vp};
  }
  if (vp === 'special') {
    return {kind: 'variable', sign: card.victoryPointsSign ?? 'unknown'};
  }
  return {kind: 'variable', sign: (vp.each ?? 1) >= 0 ? 'nonNegative' : 'negative'};
}

/** The card PRINTS a VP icon and that icon is never a penalty. */
export function hasNonNegativeVictoryPointsIcon(card: VictoryPointsDeclaration): boolean {
  const icon = victoryPointsIconOf(card);
  switch (icon.kind) {
  case 'none':
    return false;
  case 'fixed':
    return icon.points >= 0;
  case 'variable':
    return icon.sign === 'nonNegative';
  }
}
