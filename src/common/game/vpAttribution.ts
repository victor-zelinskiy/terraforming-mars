/*
 * VP ATTRIBUTION — «every point comes from its own cause» (TR55, the score
 * cell iteration — docs/claude/console/score-cell.md).
 *
 * The live score is the SERVER's: `calculateVictoryPoints` builds a total out
 * of named components (the TR, the cards row by row, the cities cell by cell
 * and tier by tier, the milestones and awards by name, …). When the total
 * moves between two views, this function says WHICH COMPONENT moved it — by
 * subtracting the two breakdowns component by component. It counts nothing,
 * re-implements no rule and reads no game state: a share is the difference of
 * two numbers the server already wrote.
 *
 * THE GUARD: the shares always sum to the total's difference exactly. A
 * component this function does not itemize (a future breakdown field, a card
 * row the server wrote under no name) lands in ONE residual `other` share —
 * it is never dropped and never invented.
 *
 * AMBIGUITY, named: a component that moved UP AND BACK within one response
 * nets to zero and yields no share (the score never showed the intermediate
 * value, so there is nothing for a token to carry); two cards of one name are
 * one row key (the server writes one row per card in the tableau, and two
 * tableau cards never share a name).
 */
import {CardVictoryPointsDetail, CityVpDetail, MADetail, VictoryPointsBreakdown} from './VictoryPointsBreakdown';

/** The pseudo-rows the server writes into `detailsCards` under a NAME that is no card. */
export const VP_PSEUDO_ROWS: ReadonlySet<string> = new Set([
  'Turmoil Points', 'Colony VP', 'Underworld Corruption Bribe',
]);

/** WHERE a share of a score change comes from — one component of the server's breakdown. */
export type VpSource =
  /** A card's own row of `detailsCards` (fixed, per resource, per tag, per city, a penalty). */
  | {kind: 'card', card: string}
  /** One of the player's cities (its adjacent greeneries, summed over the stack's tiers). */
  | {kind: 'city', space: string}
  /** The greenery tiles' own points (not under the Turmoil Redux revision — there a greenery pays TR). */
  | {kind: 'greenery'}
  /** A claimed milestone, by name. */
  | {kind: 'milestone', name: string}
  /** A funded award, by name — the player's place in it changed. */
  | {kind: 'award', name: string, place?: {before?: string, after?: string}}
  /** The terraform rating (the TR cell's own business — held by the rating's own tokens). */
  | {kind: 'rating'}
  /** Anything else, by the breakdown's key (`moonHabitats`, `planetaryTracks`, a pseudo-row, the residual …). */
  | {kind: 'other', key: string};

export type VpShare = {source: VpSource, points: number};

/** A stable key for one source — what a host claims and a ledger dedups by. */
export function vpSourceKey(source: VpSource): string {
  switch (source.kind) {
  case 'card': return `card:${source.card}`;
  case 'city': return `city:${source.space}`;
  case 'greenery': return 'greenery';
  case 'milestone': return `milestone:${source.name}`;
  case 'award': return `award:${source.name}`;
  case 'rating': return 'rating';
  case 'other': return `other:${source.key}`;
  }
}

function sumBy<T>(rows: ReadonlyArray<T> | undefined, key: (row: T) => string | undefined, points: (row: T) => number): Map<string, number> {
  const out = new Map<string, number>();
  for (const row of rows ?? []) {
    const k = key(row);
    if (k !== undefined) {
      out.set(k, (out.get(k) ?? 0) + points(row));
    }
  }
  return out;
}

/** The milestone's name in a `detailsMilestones` row («Claimed ${0} milestone», [name]). */
function milestoneName(row: MADetail): string | undefined {
  return row.messageArgs?.[0];
}

/** The award's name in a `detailsAwards` row («${0} place for ${1} award (funded by ${2})», [place, name, funder]). */
function awardName(row: MADetail): string | undefined {
  return row.messageArgs?.[1];
}

function awardPlace(rows: ReadonlyArray<MADetail> | undefined, name: string): string | undefined {
  return rows?.find((row) => awardName(row) === name)?.messageArgs?.[0];
}

/** Per-name differences of two keyed maps, in first-seen order (the AFTER rows first, then the vanished ones). */
function diffMaps(before: Map<string, number>, after: Map<string, number>): Array<[string, number]> {
  const keys = [...after.keys(), ...[...before.keys()].filter((k) => !after.has(k))];
  return keys.map((k): [string, number] => [k, (after.get(k) ?? 0) - (before.get(k) ?? 0)]).filter(([, d]) => d !== 0);
}

/** The scalar components the breakdown sums into `total` that this function does not itemize further. */
const SCALAR_KEYS = ['escapeVelocity', 'moonHabitats', 'moonMines', 'moonRoads', 'planetaryTracks', 'deltaProject', 'titles'] as const;

function automaTotal(b: VictoryPointsBreakdown): number {
  const a = b.automa;
  return a === undefined ? 0 : a.mcToVp + a.neuralInstance + a.cardVp + a.corpVp + (a.dividendVp ?? 0);
}

/**
 * Attribute the change of `total` between two breakdowns of ONE player to the
 * components that made it. Pure; zero shares are omitted; Σ points === the
 * total's difference (the residual is one `other: 'unattributed'` share).
 */
export function vpAttribution(before: VictoryPointsBreakdown, after: VictoryPointsBreakdown): Array<VpShare> {
  const shares: Array<VpShare> = [];
  const push = (source: VpSource, points: number) => {
    if (points !== 0) {
      shares.push({source, points});
    }
  };

  push({kind: 'rating'}, after.terraformRating - before.terraformRating);

  // THE CARDS, row by row — a pseudo-row is named as itself, never as a card.
  const cardKey = (row: CardVictoryPointsDetail) => row.cardName;
  const cardDiffs = diffMaps(sumBy(before.detailsCards, cardKey, (r) => r.victoryPoint), sumBy(after.detailsCards, cardKey, (r) => r.victoryPoint));
  let cardsItemized = 0;
  for (const [name, points] of cardDiffs) {
    push(VP_PSEUDO_ROWS.has(name) ? {kind: 'other', key: name} : {kind: 'card', card: name}, points);
    cardsItemized += points;
  }
  // A card point written with no row (a module adding to `victoryPoints` without a message) stays honest.
  push({kind: 'other', key: 'cards'}, (after.victoryPoints - before.victoryPoints) - cardsItemized);

  // THE CITIES, cell by cell (a stack's tiers summed: one cell is one place the eye can find).
  const cityKey = (row: CityVpDetail) => row.spaceId;
  const cityDiffs = diffMaps(sumBy(before.detailsCities, cityKey, (r) => r.points), sumBy(after.detailsCities, cityKey, (r) => r.points));
  let citiesItemized = 0;
  for (const [space, points] of cityDiffs) {
    push({kind: 'city', space}, points);
    citiesItemized += points;
  }
  push({kind: 'other', key: 'city'}, (after.city - before.city) - citiesItemized);

  push({kind: 'greenery'}, after.greenery - before.greenery);

  // MILESTONES and AWARDS, by name.
  const msDiffs = diffMaps(sumBy(before.detailsMilestones, milestoneName, (r) => r.victoryPoint), sumBy(after.detailsMilestones, milestoneName, (r) => r.victoryPoint));
  let msItemized = 0;
  for (const [name, points] of msDiffs) {
    push({kind: 'milestone', name}, points);
    msItemized += points;
  }
  push({kind: 'other', key: 'milestones'}, (after.milestones - before.milestones) - msItemized);

  const awDiffs = diffMaps(sumBy(before.detailsAwards, awardName, (r) => r.victoryPoint), sumBy(after.detailsAwards, awardName, (r) => r.victoryPoint));
  let awItemized = 0;
  for (const [name, points] of awDiffs) {
    const was = awardPlace(before.detailsAwards, name);
    const now = awardPlace(after.detailsAwards, name);
    const place = was === undefined && now === undefined ? undefined : {...(was !== undefined ? {before: was} : {}), ...(now !== undefined ? {after: now} : {})};
    push({kind: 'award', name, ...(place !== undefined ? {place} : {})}, points);
    awItemized += points;
  }
  push({kind: 'other', key: 'awards'}, (after.awards - before.awards) - awItemized);

  for (const key of SCALAR_KEYS) {
    push({kind: 'other', key}, (after[key] ?? 0) - (before[key] ?? 0));
  }
  push({kind: 'other', key: 'automa'}, automaTotal(after) - automaTotal(before));

  // THE GUARD: whatever the itemization missed is one honest residual.
  const itemized = shares.reduce((sum, s) => sum + s.points, 0);
  push({kind: 'other', key: 'unattributed'}, (after.total - before.total) - itemized);
  return shares;
}

/**
 * Does the card's row in `breakdown` READ THE BOARD — the server's own mechanics say what its points count: cities,
 * oceans, Moon tiles, units adjacent to the card's tile, a bespoke rule, or a per-tile penalty row with no formula
 * (Vermin). A board scene (a tile landing) may show such a card's share; a card that counts its own resources or its
 * tags is never a tile's doing. Pure — a read of the server's breakdown, never a rule.
 */
export function vpCardReadsBoard(breakdown: VictoryPointsBreakdown, card: string): boolean {
  const row = breakdown.detailsCards.find((r) => r.cardName === card);
  if (row === undefined) {
    return false;
  }
  const m = row.mechanics;
  if (m === undefined) {
    return row.kind === 'penalty';
  }
  return m.adjacent === true || m.shape === 'special' ||
    m.unit === 'cities' || m.unit === 'oceans' || m.unit === 'moon-mine' || m.unit === 'moon-road';
}

/** Σ points of a share list — equals `after.total − before.total` for `vpAttribution`'s output by construction. */
export function vpSharesTotal(shares: ReadonlyArray<VpShare>): number {
  return shares.reduce((sum, s) => sum + s.points, 0);
}
