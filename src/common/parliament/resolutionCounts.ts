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
 * SIX KINDS OF COUNT, told apart by `resolutionCountKind` because the
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
 *     of its own;
 *   · THRESHOLD — «for each complete set of 5 TR over 15» (Generous Funding):
 *     the count is not a number of THINGS but a number of FULL STEPS one
 *     player METRIC stands above a threshold — `⌊max(0, value − over) / step⌋`.
 *     There is no list to explain it with; what explains the number is the
 *     BREAKDOWN of the value (`ResolutionCountModel.metric`: the value, the
 *     threshold, the step, the full sets and the distance to the next one).
 *     ONE function (`thresholdSets`) is the rule — the server's payout, the
 *     reading and the stand all call it; the value itself is THE ENGINE's
 *     (`player.terraformRating`), never rebuilt from its parts;
 *   · PRODUCTION — «for each step of steel, titanium and energy production
 *     you have» (Industrialist Budget): the count is the SUM of the player's
 *     production STEPS over a LIST of resources — the twin of TAGS, not of
 *     THRESHOLD: what explains it is a BREAKDOWN BY TERM («steel 2 · titanium
 *     1 · energy 3 = 6», `ResolutionCountModel.byResource`), exactly as a
 *     multi-tag count explains itself tag by tag. The values are THE
 *     ENGINE's (`player.production`), never assembled from cards; the stand
 *     reads synthetic productions through the same function
 *     (`countProductionToward`). The next budget's list (building + Mars
 *     tags, plant + microbe + animal tags) is a TAG count — this kind is for
 *     production only;
 *   · COLONIES — «for each colony you have» (Jovian Tax Rights): the count
 *     walks neither the tableau nor the Mars board nor a metric — it counts
 *     the player's CUBES on the colony tiles, one unit per cube (two cubes
 *     on one tile are 2). The server asks THE ENGINE for the list
 *     (`ColoniesHandler.coloniesOf` — the very reading the behavior counter
 *     and `Player.getColoniesCount` stand on) and this module keeps it as the
 *     NAMES of the tiles (`ResolutionCountModel.colonies`, in the table's
 *     order, a name repeated per cube) — the list that explains the number
 *     where no card and no cell can. The stand counts a synthetic list of
 *     tiles through the same function (`countColoniesToward`).
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
import {ColonyName} from '../colonies/ColonyName';
import {Resource} from '../Resource';
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
  /**
   * Generous Funding: the player's complete SETS of 5 terraform rating over
   * 15 — a count over one player METRIC, by threshold and step (TR 15 → 0,
   * 20 → 1, 24 → 1, 25 → 2, 30 → 3). The threshold is the CARD's constant,
   * never the variant's starting rating.
   */
  'terraformRatingSets',
  /**
   * Industrialist Budget: the player's STEPS of steel, titanium and energy
   * PRODUCTION, added up — a count over the production track, never over the
   * supply (the cubes in stock do not count) and never over cards (a card
   * that raised the production is not what is counted, the steps are).
   */
  'steelTitaniumEnergyProduction',
  /**
   * Jovian Tax Rights: the player's COLONIES — their cubes on the colony
   * tiles, one unit per cube (two cubes on one tile are 2). A count over the
   * colony table, never over the tiles themselves (a tile the player only
   * trades with is not theirs) and never over cards.
   */
  'colonies',
  /**
   * Medical Database: the SCIENCE TAGS the player has in play (a card gives
   * every one it prints — Research is 2). The ordinary one-tag count of
   * Central Power Grid over another tag.
   */
  'scienceTags',
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
 * WHICH player METRIC a THRESHOLD count reads: `terraformRating` — the
 * player's TR as the engine keeps it (`player.terraformRating`). The family's
 * next word (the Budgets' «steps of production») is one entry here and one
 * line in the server's reader (`ResolutionCounts.metricValue`).
 */
export type ResolutionCountMetric = 'terraformRating';

/**
 * WHAT a count id counts. `cards` — one unit per qualifying card; `tags` — the
 * printed occurrences of the listed tags, ADDED UP (the canonical tag count of
 * each, read in `RESOLUTION_TAG_COUNTING_MODE`). One tag is the ordinary case
 * (Central Power Grid); a term over several tags (Cloud Development's «per
 * Venus and Jovian tag») is the SAME kind with a longer list — a card
 * printing two of the listed tags is worth 2, whichever two they are.
 * `board` — the player's TILES of the named kind on the Mars board, one unit
 * per cell (Colonization Funding's space cities). `threshold` — the FULL
 * STEPS of `step` a player metric stands above `over` (Generous Funding's
 * «each complete set of 5 TR over 15»): one unit per full set, the remainder
 * yields nothing. `production` — the player's PRODUCTION STEPS of the listed
 * resources, ADDED UP (Industrialist Budget's steel + titanium + energy): one
 * unit per step, each resource's own total kept for the reading. `colonies`
 * — the player's CUBES on the colony tiles (Jovian Tax Rights's «each colony
 * you have»): one unit per cube, the tiles' names kept for the reading.
 */
export type ResolutionCountKind =
  | {kind: 'cards'}
  | {kind: 'tags', tags: ReadonlyArray<Tag>}
  | {kind: 'board', tiles: BoardCountedTile}
  | {kind: 'threshold', metric: ResolutionCountMetric, over: number, step: number}
  | {kind: 'production', resources: ReadonlyArray<Resource>}
  | {kind: 'colonies'};

/** Generous Funding's printed «5 TR over 15» — the threshold and the set. */
export const TERRAFORM_RATING_SETS_OVER = 15;
export const TERRAFORM_RATING_SETS_STEP = 5;

/** Industrialist Budget's printed «[steel] + [titanium] + [energy]» production box — the list, in the face's order. */
export const INDUSTRIAL_PRODUCTION_RESOURCES: ReadonlyArray<Resource> = [Resource.STEEL, Resource.TITANIUM, Resource.ENERGY];

export function resolutionCountKind(id: ResolutionCountId): ResolutionCountKind {
  switch (id) {
  case 'buildingCardsWithNonNegativeVp': return {kind: 'cards'};
  case 'powerTags': return {kind: 'tags', tags: [Tag.POWER]};
  case 'venusJovianTags': return {kind: 'tags', tags: [Tag.VENUS, Tag.JOVIAN]};
  case 'spaceCities': return {kind: 'board', tiles: 'spaceCity'};
  case 'terraformRatingSets': return {kind: 'threshold', metric: 'terraformRating', over: TERRAFORM_RATING_SETS_OVER, step: TERRAFORM_RATING_SETS_STEP};
  case 'steelTitaniumEnergyProduction': return {kind: 'production', resources: INDUSTRIAL_PRODUCTION_RESOURCES};
  case 'colonies': return {kind: 'colonies'};
  case 'scienceTags': return {kind: 'tags', tags: [Tag.SCIENCE]};
  }
}

/**
 * THE ONE RULE of a threshold count: how many FULL steps of `step` `value`
 * stands above `over` — `⌊max(0, value − over) / step⌋`. TR 15 → 0, 19 → 0,
 * 20 → 1, 24 → 1, 25 → 2, 30 → 3. The server's payout, the client's reading
 * and the stand's synthetic seats all divide HERE; nothing restates it.
 */
export function thresholdSets(value: number, over: number, step: number): number {
  const size = Math.max(1, Math.floor(step));
  return Math.floor(Math.max(0, Math.floor(value) - over) / size);
}

/**
 * THE BREAKDOWN of a threshold count — what explains the number where no list
 * can: the metric read, its value, the threshold, the step, the full sets it
 * came to, and how far the value is from the NEXT full set («TR 24 · over 15 ·
 * 1 full set · 1 to the next»). Frozen in the record at the enactment like a
 * counted list; never recomputed from a later rating.
 */
export type ResolutionCountMetricModel = {
  metric: ResolutionCountMetric;
  value: number;
  over: number;
  step: number;
  /** `thresholdSets(value, over, step)` — the same number as the model's `count`. */
  sets: number;
  /** How much more of the metric would complete one more set (always ≥ 1). */
  toNext: number;
};

/**
 * Count one player METRIC toward a threshold count `id` — the reading the
 * server makes of the engine's value and the stand makes of a synthetic one.
 * A non-threshold id counts nothing this way (the model says so with a zero,
 * never a guess).
 */
export function countMetricToward(id: ResolutionCountId, value: number): ResolutionCountModel {
  const kind = resolutionCountKind(id);
  if (kind.kind !== 'threshold') {
    return {id, count: 0, cards: []};
  }
  const sets = thresholdSets(value, kind.over, kind.step);
  const toNext = kind.over + (sets + 1) * kind.step - Math.floor(value);
  return {id, count: sets, cards: [], metric: {metric: kind.metric, value, over: kind.over, step: kind.step, sets, toNext}};
}

/** ONE tag's share of a multi-tag count («Venus 1 · Jovian 2»). */
export type ResolutionCountByTag = {tag: Tag; count: number};

/** ONE resource's share of a production count («steel 2 · titanium 1 · energy 3») — the twin of `ResolutionCountByTag`. */
export type ResolutionCountByResource = {resource: Resource; count: number};

/**
 * Count the player's PRODUCTION STEPS toward a production count `id` — the
 * server's reading of the engine's track and the stand's reading of synthetic
 * productions, through ONE function. `production` is the player's steps per
 * resource (a resource the map does not name reads as 0). The engine keeps
 * steel, titanium and energy production at 0 or above; nothing here floors
 * them a second time — the sum is the sum of what the engine holds, and
 * `tests/parliament/IndustrialistBudget.spec.ts` pins that it is never
 * negative. A non-production id counts nothing this way (a zero, never a guess).
 */
export function countProductionToward(id: ResolutionCountId, production: Readonly<Partial<Record<Resource, number>>>): ResolutionCountModel {
  const kind = resolutionCountKind(id);
  if (kind.kind !== 'production') {
    return {id, count: 0, cards: []};
  }
  const byResource: Array<ResolutionCountByResource> = kind.resources.map((resource) => ({resource, count: Math.floor(production[resource] ?? 0)}));
  const count = byResource.reduce((sum, entry) => sum + entry.count, 0);
  return {id, count, cards: [], byResource};
}

/**
 * Count the player's COLONIES toward a colonies count `id` — the server's
 * reading of the engine's list (`ColoniesHandler.coloniesOf`, one tile name
 * per CUBE, in the table's order) and the stand's reading of a synthetic
 * list, through ONE function: the number is the list's length, and the list
 * itself rides the model so the number can always be explained tile by tile
 * (a name repeated is two cubes on one tile). A non-colonies id counts
 * nothing this way (a zero, never a guess).
 */
export function countColoniesToward(id: ResolutionCountId, colonies: ReadonlyArray<ColonyName>): ResolutionCountModel {
  const kind = resolutionCountKind(id);
  if (kind.kind !== 'colonies') {
    return {id, count: 0, cards: []};
  }
  return {id, count: colonies.length, cards: [], colonies: [...colonies]};
}

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
   * A PRODUCTION count: each listed resource's production steps, in the
   * term's order — the breakdown a reading prints beside the sum («[steel]
   * 2 + [titanium] 1 + [energy] 3»). Present on a production count only
   * (every listed resource, a 0 included); `cards` is empty on it.
   */
  byResource?: ReadonlyArray<ResolutionCountByResource>;
  /**
   * A BOARD count: the cells that made it (their ids, in the board's order) —
   * the list that explains the number where no card can. Present on a board
   * count only (empty when nothing counted); absent on a card or tag count.
   */
  spaces?: ReadonlyArray<SpaceId>;
  /**
   * A THRESHOLD count: the breakdown of the metric that made it — the value,
   * the threshold, the step, the full sets and the distance to the next one.
   * There is no list on this kind (`cards` is empty, `spaces` absent); present
   * on a threshold count only.
   */
  metric?: ResolutionCountMetricModel;
  /**
   * A COLONIES count: the tiles the player's cubes stand on (their names, in
   * the table's order — a name repeated per cube) — the list that explains
   * the number where no card and no cell can. Present on a colonies count
   * only (empty when the player has none); `cards` is empty on it.
   */
  colonies?: ReadonlyArray<ColonyName>;
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
  if (kind.kind === 'threshold') {
    return {counts: false, reason: 'Counted by your terraform rating, not on the board'};
  }
  if (kind.kind === 'production') {
    return {counts: false, reason: 'Counted by your production, not on the board'};
  }
  if (kind.kind === 'colonies') {
    return {counts: false, reason: 'Counted by your colonies, not on the board'};
  }
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
  case 'terraformRatingSets':
    // A THRESHOLD count: no card counts — the player's rating does (`countMetricToward`).
    return {counts: false, reason: 'Counted by your terraform rating, not among cards'};
  case 'steelTitaniumEnergyProduction':
    // A PRODUCTION count: no card counts — the player's production steps do (`countProductionToward`).
    return {counts: false, reason: 'Counted by your production, not among cards'};
  case 'colonies':
    // A COLONIES count: no card counts — the player's cubes on the colony tiles do (`countColoniesToward`).
    return {counts: false, reason: 'Counted by your colonies, not among cards'};
  case 'scienceTags': {
    // The one question of a tag count, over the science tag: printed, face up. A wild tag is not a science tag.
    if (!cardTagsInPlay(card, ctx)) {
      return {counts: false, reason: 'A played event is face down'};
    }
    if (!card.tags.includes(Tag.SCIENCE)) {
      return {counts: false, reason: 'No science tag'};
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
