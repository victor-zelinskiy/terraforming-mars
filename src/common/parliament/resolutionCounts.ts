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
 * TWO KINDS OF COUNT, told apart by `resolutionCountKind` because the cards
 * answer them differently:
 *   · CARDS — «for every Building card with a VP icon»: one card is ONE unit,
 *     however many tags or victory points it prints (Architecture Award);
 *   · TAGS — «for each Power tag you have»: one card contributes EVERY
 *     matching tag it prints, so a two-power-tag card is 2 (Central Power
 *     Grid). The card list still explains the number — with the card's own
 *     contribution beside it (`ResolutionCountModel.units`).
 *
 * WHAT A CARD IS, for a count: its name, type, printed tags and VP
 * declaration — the facts `ICard` and `ClientCard` share. Played-event tags
 * follow the tag-activity rule (`Tags.eventTagsInPlay`: face down, unless
 * Odyssey). A wild tag never stands in for a printed tag here: «a Building
 * card» is a card that PRINTS the building tag, and a Power tag is a printed
 * power tag — see `RESOLUTION_TAG_COUNTING_MODE` for why.
 */
import {CardName} from '../cards/CardName';
import {CardType} from '../cards/CardType';
import {Tag} from '../cards/Tag';
import {hasNonNegativeVictoryPointsIcon, VictoryPointsDeclaration, victoryPointsIconOf} from '../cards/victoryPointsIcon';

export const RESOLUTION_COUNT_IDS = [
  /** Architecture Award: own cards in play that print a building tag AND a non-negative VP icon. */
  'buildingCardsWithNonNegativeVp',
  /** Central Power Grid: the POWER TAGS the player has in play (a card gives every one it prints). */
  'powerTags',
] as const;
export type ResolutionCountId = typeof RESOLUTION_COUNT_IDS[number];

/**
 * THE COUNTING CONTEXT a resolution's TAG term is read in — the project's own
 * `Tags.CountingMode`, named here so the server's canonical count, the model
 * and the client's walk over a tableau all stand on ONE word.
 *
 * An ENACTMENT is not the player's own action: it resolves in the political
 * phase, for every participant at once. Wild tags — the printed ones and the
 * Scientists' granted one — are the «typical when performing an action»
 * substitution (`'default'`), so they must NOT turn into power tags here, even
 * while the player is looking at the card during their own turn and some
 * counters beside them do count them. `'raw'` is «face-up printed tags,
 * literally, plus the permanent modifiers a card grants» — exactly the
 * question «how many Power tags do you have» asks.
 */
export const RESOLUTION_TAG_COUNTING_MODE = 'raw';

/** A counted term: `per` units of the effect for every counted item. */
export type ResolutionCountTerm = {
  id: ResolutionCountId;
  per: number;
};

/**
 * WHAT a count id counts. `cards` — one unit per qualifying card; `tags` — the
 * printed occurrences of ONE tag (the canonical tag count, read in
 * `RESOLUTION_TAG_COUNTING_MODE`).
 */
export type ResolutionCountKind = {kind: 'cards'} | {kind: 'tags', tag: Tag};

export function resolutionCountKind(id: ResolutionCountId): ResolutionCountKind {
  switch (id) {
  case 'buildingCardsWithNonNegativeVp': return {kind: 'cards'};
  case 'powerTags': return {kind: 'tags', tag: Tag.POWER};
  }
}

/** ONE player's count for a term — the number, and the cards that made it (in play order). */
export type ResolutionCountModel = {
  id: ResolutionCountId;
  count: number;
  cards: ReadonlyArray<CardName>;
  /**
   * A TAG count: what each listed card contributed (aligned with `cards`) —
   * absent on a `cards` count, where every entry is worth exactly 1.
   */
  units?: ReadonlyArray<number>;
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
  case 'powerTags': {
    // A TAG count asks ONE question — «does this card print the tag, face
    // up» — and nothing else: no VP icon, no card type, no production. A
    // wild tag is not a power tag (see `RESOLUTION_TAG_COUNTING_MODE`).
    if (!cardTagsInPlay(card, ctx)) {
      return {counts: false, reason: 'A played event is face down'};
    }
    if (!card.tags.includes(Tag.POWER)) {
      return {counts: false, reason: 'No power tag'};
    }
    return {counts: true};
  }
  }
}

/** Does `card` (one of the owner's cards in play) count toward `id` at all? */
export function cardCountsToward(id: ResolutionCountId, card: CountedCardFacts, ctx: CardCountContext): boolean {
  return cardCountVerdict(id, card, ctx).counts;
}

/**
 * HOW MUCH `card` contributes to `id` — 1 for a qualifying card of a `cards`
 * count, its printed occurrences of the tag for a `tags` count, 0 when it
 * does not count at all.
 */
export function cardCountUnits(id: ResolutionCountId, card: CountedCardFacts, ctx: CardCountContext): number {
  if (!cardCountsToward(id, card, ctx)) {
    return 0;
  }
  const kind = resolutionCountKind(id);
  return kind.kind === 'cards' ? 1 : card.tags.filter((tag) => tag === kind.tag).length;
}

/** Count `cards` (the owner's cards in play, in play order) toward `id`. */
export function countCardsToward(id: ResolutionCountId, cards: Iterable<CountedCardFacts>, ctx: CardCountContext): ResolutionCountModel {
  const counted: Array<CardName> = [];
  const units: Array<number> = [];
  let total = 0;
  for (const card of cards) {
    const n = cardCountUnits(id, card, ctx);
    if (n > 0) {
      counted.push(card.name);
      units.push(n);
      total += n;
    }
  }
  const model: ResolutionCountModel = {id, count: total, cards: counted};
  // The per-card contribution rides along only where it can differ from 1 —
  // a `cards` count would carry a column of ones and say nothing.
  return resolutionCountKind(id).kind === 'cards' ? model : {...model, units};
}

/** A player's count for `id` in a list of count models (undefined when the list does not carry it). */
export function countOf(counts: ReadonlyArray<ResolutionCountModel> | undefined, id: ResolutionCountId): ResolutionCountModel | undefined {
  return counts?.find((c) => c.id === id);
}

/** What `card` contributed to a recorded count — `units` when the record carries it, else 1. */
export function countedUnitsOf(model: Pick<ResolutionCountModel, 'cards' | 'units'>, index: number): number {
  return model.units?.[index] ?? 1;
}
