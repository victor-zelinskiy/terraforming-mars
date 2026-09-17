/*
 * THE COUNTED TERM of a resolution effect (Turmoil Redux) — the «for every X
 * you have» half of formulas like «+1 M€ production for every Building card
 * with a non-negative VP icon you have in play + Influence (max 5)».
 *
 * A count is DATA the effect declares (`InfluenceScaledEffect.count`, see
 * `influenceScaling.ts`) and ONE predicate per count id, here, shared by:
 *   · the server — the payout at the enactment and the model's per-player
 *     count (`server/parliament/resolutions/ResolutionCounts.ts` walks the
 *     player's tableau through it);
 *   · the client — the Polygon stand counts its synthetic tableaus of REAL
 *     card definitions through it (never a typed-in number).
 * Nothing re-derives the rule: a surface that needs B asks the server's model
 * (or, off the table, this predicate), and every reading keeps the LIST of
 * counted cards so the number can always be explained.
 *
 * WHAT A CARD IS, for a count: its name, type, printed tags and VP
 * declaration — the facts `ICard` and `ClientCard` share. Played-event tags
 * follow the tag-activity rule (`Tags.eventTagsInPlay`: face down, unless
 * Odyssey). A wild tag never stands in for a printed tag here: «a Building
 * card» is a card that PRINTS the building tag.
 */
import {CardName} from '../cards/CardName';
import {CardType} from '../cards/CardType';
import {Tag} from '../cards/Tag';
import {hasNonNegativeVictoryPointsIcon, VictoryPointsDeclaration, victoryPointsIconOf} from '../cards/victoryPointsIcon';

export const RESOLUTION_COUNT_IDS = [
  /** Architecture Award: own cards in play that print a building tag AND a non-negative VP icon. */
  'buildingCardsWithNonNegativeVp',
] as const;
export type ResolutionCountId = typeof RESOLUTION_COUNT_IDS[number];

/** A counted term: `per` units of the effect for every counted item. */
export type ResolutionCountTerm = {
  id: ResolutionCountId;
  per: number;
};

/** ONE player's count for a term — the number, and the cards that made it (in play order). */
export type ResolutionCountModel = {
  id: ResolutionCountId;
  count: number;
  cards: ReadonlyArray<CardName>;
};

/** The card facts a card-based count reads (satisfied by `ICard` and by `ClientCard`). */
export type CountedCardFacts = VictoryPointsDeclaration & {
  name: CardName;
  type: CardType;
  tags: ReadonlyArray<Tag>;
};

/** The owner's side of the tag-activity rule. */
export type CardCountContext = {
  /** Played events' tags are face up (Odyssey) — see `Tags.eventTagsInPlay`. */
  eventTagsInPlay: boolean;
};

/** Are this played card's printed tags in play for its owner? */
export function cardTagsInPlay(card: CountedCardFacts, ctx: CardCountContext): boolean {
  return card.type !== CardType.EVENT || ctx.eventTagsInPlay;
}

/**
 * WHY a card does or does not count toward `id` — the predicate itself, with
 * the first failed condition named (an English i18n key), so a surface that
 * explains the number reads the same rule the number was counted by.
 */
export type CardCountVerdict = {counts: true} | {counts: false, reason: string};

export function cardCountVerdict(id: ResolutionCountId, card: CountedCardFacts, ctx: CardCountContext): CardCountVerdict {
  if (card.type === CardType.PROXY) {
    return {counts: false, reason: 'Not a card in play'};
  }
  switch (id) {
  case 'buildingCardsWithNonNegativeVp': {
    if (!cardTagsInPlay(card, ctx)) {
      return {counts: false, reason: 'A played event is face down'};
    }
    if (!card.tags.includes(Tag.BUILDING)) {
      return {counts: false, reason: 'No building tag'};
    }
    const icon = victoryPointsIconOf(card);
    if (icon.kind === 'none') {
      return {counts: false, reason: 'No VP icon'};
    }
    if (!hasNonNegativeVictoryPointsIcon(card)) {
      // A bespoke icon that can score either sign is not «non-negative»; an
      // undeclared one is never guessed to be (the guard spec lists those).
      const reason = icon.kind === 'variable' && icon.sign === 'either' ? 'The VP icon can be negative' :
        icon.kind === 'variable' && icon.sign === 'unknown' ? 'The VP icon sign is not declared' : 'Negative VP icon';
      return {counts: false, reason};
    }
    return {counts: true};
  }
  }
}

/** Does `card` (one of the owner's cards in play) count toward `id`? One card counts once. */
export function cardCountsToward(id: ResolutionCountId, card: CountedCardFacts, ctx: CardCountContext): boolean {
  return cardCountVerdict(id, card, ctx).counts;
}

/** Count `cards` (the owner's cards in play, in play order) toward `id`. */
export function countCardsToward(id: ResolutionCountId, cards: Iterable<CountedCardFacts>, ctx: CardCountContext): ResolutionCountModel {
  const counted: Array<CardName> = [];
  for (const card of cards) {
    if (cardCountsToward(id, card, ctx)) {
      counted.push(card.name);
    }
  }
  return {id, count: counted.length, cards: counted};
}

/** A player's count for `id` in a list of count models (undefined when the list does not carry it). */
export function countOf(counts: ReadonlyArray<ResolutionCountModel> | undefined, id: ResolutionCountId): ResolutionCountModel | undefined {
  return counts?.find((c) => c.id === id);
}
