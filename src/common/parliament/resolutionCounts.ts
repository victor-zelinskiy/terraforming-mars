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
 * THREE KINDS OF COUNT, told apart by `resolutionCountKind` because the
 * objects answer them differently:
 *   · CARDS — «for every Building card with a VP icon»: one card is ONE unit,
 *     however many tags or victory points it prints (Architecture Award);
 *   · TAGS — «for each Power tag you have»: one card contributes EVERY
 *     matching tag it prints, so a two-power-tag card is 2 (Central Power
 *     Grid). The card list still explains the number — with the card's own
 *     contribution beside it (`ResolutionCountModel.units`);
 *   · BOARD — «for every space city you have» (Colonization Funding): the
 *     count walks the player's TILES, not their tableau — a tile has no card,
 *     so what explains the number is a list of CELLS (`ResolutionCountModel.spaces`).
 *     The server asks THE ENGINE for the number (`MarsBoard.getCitiesOffMars`,
 *     the function the awards and the behavior counter already stand on); the
 *     cell predicate here (`spaceCountVerdict`) is the stand's, pinned to the
 *     engine by spec. The next board count (Migration Funding's «city on
 *     Mars») is one more `BoardCountedTile` and one more branch, never a kind
 *     of its own.
 *
 * WHAT A CARD IS, for a count: its name, type, printed tags and VP
 * declaration — the facts `ICard` and `ClientCard` share. Played-event tags
 * follow the tag-activity rule (`Tags.eventTagsInPlay`: face down, unless
 * Odyssey). A wild tag never stands in for a printed tag here: «a Building
 * card» is a card that PRINTS the building tag, and a Power tag is a printed
 * power tag — see `RESOLUTION_TAG_COUNTING_MODE` for why.
 *
 * WHAT A CELL IS, for a board count: its id, its space type and the tile on
 * it — the facts the server's `Space` and the stand's synthetic cells share.
 */
import {CardName} from '../cards/CardName';
import {CardType} from '../cards/CardType';
import {Tag} from '../cards/Tag';
import {hasNonNegativeVictoryPointsIcon, VictoryPointsDeclaration, victoryPointsIconOf} from '../cards/victoryPointsIcon';
import {SpaceId} from '../Types';
import {SpaceType} from '../boards/SpaceType';
import {CITY_TILES, TileType} from '../TileType';

export const RESOLUTION_COUNT_IDS = [
  /** Architecture Award: own cards in play that print a building tag AND a non-negative VP icon. */
  'buildingCardsWithNonNegativeVp',
  /** Central Power Grid: the POWER TAGS the player has in play (a card gives every one it prints). */
  'powerTags',
  /**
   * Cloud Development: the VENUS and JOVIAN tags the player has in play, added
   * up — one term over TWO tags (a card that prints both is worth 2), read
   * with a per-tag breakdown so the number can be explained tag by tag.
   */
  'venusJovianTags',
  /**
   * Colonization Funding: the player's SPACE CITIES — city tiles on the
   * reserved areas off Mars (Ganymede Colony, Phobos Space Haven, Stanford
   * Torus, the Venus and Pathfinders areas). A count over the BOARD, not the
   * tableau: the Moon's tiles and a city on Mars are not space cities.
   */
  'spaceCities',
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
 * WHAT a BOARD count counts among the player's tiles on the Mars board:
 * `spaceCity` — a city tile on a reserved area OFF Mars (`SpaceType.COLONY`).
 * The family's next word is `marsCity` (Migration Funding) — one entry here,
 * one branch in `spaceCountVerdict`, one line in the server's reader.
 */
export type BoardCountedTile = 'spaceCity';

/**
 * WHAT a count id counts. `cards` — one unit per qualifying card; `tags` — the
 * printed occurrences of the listed tags, ADDED UP (the canonical tag count of
 * each, read in `RESOLUTION_TAG_COUNTING_MODE`). One tag is the ordinary case
 * (Central Power Grid); a term over several tags (Cloud Development's «per
 * Venus and Jovian tag») is the SAME kind with a longer list — a card
 * printing two of the listed tags is worth 2, whichever two they are.
 * `board` — the player's TILES of the named kind on the Mars board, one unit
 * per cell (Colonization Funding's space cities).
 */
export type ResolutionCountKind =
  | {kind: 'cards'}
  | {kind: 'tags', tags: ReadonlyArray<Tag>}
  | {kind: 'board', tiles: BoardCountedTile};

export function resolutionCountKind(id: ResolutionCountId): ResolutionCountKind {
  switch (id) {
  case 'buildingCardsWithNonNegativeVp': return {kind: 'cards'};
  case 'powerTags': return {kind: 'tags', tags: [Tag.POWER]};
  case 'venusJovianTags': return {kind: 'tags', tags: [Tag.VENUS, Tag.JOVIAN]};
  case 'spaceCities': return {kind: 'board', tiles: 'spaceCity'};
  }
}

/** ONE tag's share of a multi-tag count («Venus 1 · Jovian 2»). */
export type ResolutionCountByTag = {tag: Tag; count: number};

/**
 * ONE player's count for a term — the number, and what made it: the cards (in
 * play order) for a card or tag count, the CELLS for a board count. ONE model
 * for every kind — a reading, a record and the stand all explain the number
 * from the same shape, whichever list happens to carry it.
 */
export type ResolutionCountModel = {
  id: ResolutionCountId;
  count: number;
  /** The counted cards — EMPTY on a board count (a tile has no card; see `spaces`). */
  cards: ReadonlyArray<CardName>;
  /**
   * A TAG count: what each listed card contributed (aligned with `cards`) —
   * absent on a `cards` count, where every entry is worth exactly 1.
   */
  units?: ReadonlyArray<number>;
  /**
   * A count over SEVERAL tags: each tag's own total, in the term's order —
   * the breakdown a reading prints beside the sum («[Venus] 1 + [Jovian] 2»).
   * Absent on a single-tag count (the sum IS the one tag) and on a card count.
   */
  byTag?: ReadonlyArray<ResolutionCountByTag>;
  /**
   * A BOARD count: the cells that made it (their ids, in the board's order) —
   * the list that explains the number where no card can. Present on a board
   * count only (empty when nothing counted); absent on a card or tag count.
   */
  spaces?: ReadonlyArray<SpaceId>;
};

/** The cell facts a BOARD count reads (satisfied by the server's `Space` and by the stand's synthetic cells). */
export type CountedSpaceFacts = {
  id: SpaceId;
  spaceType: SpaceType;
  tile?: {tileType: TileType};
};

/**
 * WHY a cell of the player's does or does not count toward a BOARD count —
 * the stand's predicate, one sentence per failed condition (English i18n
 * keys). THE RULE IS THE ENGINE'S (`MarsBoard.getCitiesOffMars`: a city tile
 * on a `COLONY` space of the Mars board); this restates it for a cell the
 * stand made up, and `tests/parliament/ColonizationFunding.spec.ts` pins the
 * two together over a corpus of boards. A cell of another board (the Moon)
 * never reaches a board count at all.
 */
export type SpaceCountVerdict = {counts: true} | {counts: false, reason: string};

export function spaceCountVerdict(id: ResolutionCountId, space: CountedSpaceFacts): SpaceCountVerdict {
  const kind = resolutionCountKind(id);
  if (kind.kind !== 'board') {
    return {counts: false, reason: 'Counted among cards, not on the board'};
  }
  switch (kind.tiles) {
  case 'spaceCity':
    if (space.spaceType !== SpaceType.COLONY) {
      return {counts: false, reason: 'On Mars — not a space city'};
    }
    if (space.tile === undefined || !CITY_TILES.has(space.tile.tileType)) {
      return {counts: false, reason: 'No city tile here'};
    }
    return {counts: true};
  }
}

/** Count `spaces` (the owner's cells) toward a BOARD count `id` — the stand's reading of synthetic cells. */
export function countSpacesToward(id: ResolutionCountId, spaces: Iterable<CountedSpaceFacts>): ResolutionCountModel {
  const counted: Array<SpaceId> = [];
  for (const space of spaces) {
    if (spaceCountVerdict(id, space).counts) {
      counted.push(space.id);
    }
  }
  return {id, count: counted.length, cards: [], spaces: counted};
}

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
  case 'venusJovianTags': {
    // The same one question, over two tags: prints a Venus OR a Jovian tag,
    // face up. Which of the two (or both) is the UNITS' business.
    if (!cardTagsInPlay(card, ctx)) {
      return {counts: false, reason: 'A played event is face down'};
    }
    if (!card.tags.includes(Tag.VENUS) && !card.tags.includes(Tag.JOVIAN)) {
      return {counts: false, reason: 'No Venus or Jovian tag'};
    }
    return {counts: true};
  }
  case 'spaceCities':
    // A BOARD count: no card counts — the tiles do (`spaceCountVerdict`).
    return {counts: false, reason: 'Counted on the board, not among cards'};
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
  return kind.kind === 'tags' ? card.tags.filter((tag) => kind.tags.includes(tag)).length : 1;
}

/**
 * What `card` contributes to ONE tag of a multi-tag term (its printed
 * occurrences of that tag, face up) — the per-tag half of the breakdown.
 */
export function cardTagUnits(id: ResolutionCountId, card: CountedCardFacts, ctx: CardCountContext, tag: Tag): number {
  if (!cardCountsToward(id, card, ctx)) {
    return 0;
  }
  return card.tags.filter((t) => t === tag).length;
}

/** Count `cards` (the owner's cards in play, in play order) toward `id`. */
export function countCardsToward(id: ResolutionCountId, cards: Iterable<CountedCardFacts>, ctx: CardCountContext): ResolutionCountModel {
  const counted: Array<CardName> = [];
  const units: Array<number> = [];
  const kind = resolutionCountKind(id);
  const byTag: Array<ResolutionCountByTag> = kind.kind === 'tags' && kind.tags.length > 1 ? kind.tags.map((tag) => ({tag, count: 0})) : [];
  let total = 0;
  for (const card of cards) {
    const n = cardCountUnits(id, card, ctx);
    if (n > 0) {
      counted.push(card.name);
      units.push(n);
      total += n;
      for (const entry of byTag) {
        entry.count += cardTagUnits(id, card, ctx, entry.tag);
      }
    }
  }
  const model: ResolutionCountModel = {id, count: total, cards: counted};
  // The per-card contribution rides along only where it can differ from 1 —
  // a `cards` count would carry a column of ones and say nothing; the per-tag
  // breakdown only where there is more than one tag to tell apart. (A board
  // count walked over cards counts nothing: its cells are `countSpacesToward`'s.)
  if (kind.kind !== 'tags') {
    return model;
  }
  return byTag.length > 0 ? {...model, units, byTag} : {...model, units};
}

/** A player's count for `id` in a list of count models (undefined when the list does not carry it). */
export function countOf(counts: ReadonlyArray<ResolutionCountModel> | undefined, id: ResolutionCountId): ResolutionCountModel | undefined {
  return counts?.find((c) => c.id === id);
}

/** What `card` contributed to a recorded count — `units` when the record carries it, else 1. */
export function countedUnitsOf(model: Pick<ResolutionCountModel, 'cards' | 'units'>, index: number): number {
  return model.units?.[index] ?? 1;
}
