/*
 * THE COLONY LEDGER (Turmoil Redux — Colonial Affairs): the PURE half shared
 * by the server and the client of «gain all your colony bonuses k times».
 *
 * The server pays a printed colony bonus through the engine's own primitive
 * for its SHAPE (a supply gain, a distribution onto cards, an intake, Pluto's
 * pair of draw → discard, a community benefit through its own counter) and
 * records every payout under the tile's name with the multiplier beside it;
 * the client multiplies the seat's registry (`ParliamentPlayerModel
 * .colonyBonuses` — the tiles with a cube and their printed bonus, the
 * server's own list) into the reading the player sees BEFORE the vote and
 * during the payout. Both stand on THIS module: the shape of a benefit and
 * the arithmetic of a row are stated once, so the plan the server walks and
 * the ledger the player reads can never disagree about what a tile pays.
 *
 * Pure: no DOM, no Vue, no i18n, no engine — `ColonyBenefit` and the grant
 * descriptor are the colony metadata's own vocabulary.
 */
import {ColonyBenefit} from '../colonies/ColonyBenefit';
import {ColonyName} from '../colonies/ColonyName';
import {ColonyTradeGrantModel} from '../models/ColonyTradeManifestModel';
import {ColonyBonusAsk, ColonyLedgerEntryModel} from '../models/ColonyBonusLedgerModel';
import {ParliamentEnactOutcomeModel} from '../models/ParliamentModel';

/**
 * WHAT A PRINTED COLONY BONUS BECOMES under ×k — the family table (§2 of the
 * card's document), stated once: a merged supply / production gain, ONE
 * distribution of k units onto the player's holders, ONE intake of k cards,
 * k pairs of «draw 1, then discard 1», k paid reveals, and the community
 * benefits the chip language does not speak (a loss, a discount, M€ per
 * Earth tag / hazard). `unsupported` is a benefit NO tile of the pool prints
 * as a colony bonus — named and skipped, never thrown, never silent.
 */
export type ColonyBonusShape =
  | 'stock' | 'production' | 'cardResource' | 'venusCardResource' | 'draw' | 'drawDiscard' | 'revealBuy'
  | 'loss' | 'discount' | 'mcPerEarthTags' | 'mcPerHazard' | 'unsupported';

export function colonyBonusShape(benefit: ColonyBenefit): ColonyBonusShape {
  switch (benefit) {
  case ColonyBenefit.GAIN_RESOURCES: return 'stock';
  case ColonyBenefit.GAIN_PRODUCTION: return 'production';
  case ColonyBenefit.ADD_RESOURCES_TO_CARD: return 'cardResource';
  case ColonyBenefit.ADD_RESOURCES_TO_VENUS_CARD: return 'venusCardResource';
  case ColonyBenefit.DRAW_CARDS: return 'draw';
  case ColonyBenefit.DRAW_CARDS_AND_DISCARD_ONE: return 'drawDiscard';
  case ColonyBenefit.DRAW_CARDS_AND_BUY_ONE: return 'revealBuy';
  case ColonyBenefit.LOSE_RESOURCES: return 'loss';
  case ColonyBenefit.GAIN_CARD_DISCOUNT: return 'discount';
  case ColonyBenefit.GAIN_MC_FOR_EARTH_TAGS: return 'mcPerEarthTags';
  case ColonyBenefit.GAIN_MC_PER_HAZARD_TILE: return 'mcPerHazard';
  default: return 'unsupported';
  }
}

/**
 * HOW ONE REPEAT of a bonus reads as a chip — the ledger row's own unit.
 *  · `stock` / `production` — a standard resource (`resource` names it), `amount` per repeat;
 *  · `card-resource` — a resource onto a card (`resource` is the `CardResource` name), `amount` per repeat;
 *  · `cards` — a plain draw, `amount` cards per repeat;
 *  · `draw-discard` — Pluto's pair: one card in, one card out, never merged — read «k × (card → discard)»;
 *  · `hud` — a benefit the chip language does not speak (a discount, a loss, a paid reveal, M€ by a count
 *    read at the enactment): the tile's printed description is the reading; `amount` is per repeat where
 *    the tile prints one (Titania's −3), else 1 (one repeat of the benefit); `loss` marks a negative one.
 */
export type ColonyLedgerBonus = {
  kind: 'stock' | 'production' | 'card-resource' | 'cards' | 'draw-discard' | 'hud';
  resource?: string;
  /** `card-resource` over SEVERAL kinds (the grant's list) — the unit's icons, «or»-joined; `resource` is then absent. */
  resources?: ReadonlyArray<string>;
  amount: number;
  loss?: boolean;
  /** The tile's printed description of the bonus (the colony's own English key). */
  description: string;
};

/** What the PAYOUT recorded for a row, once the server has paid it. */
export type ColonyLedgerRowState =
  /** Not paid yet (a reading before the vote, or the effects have not reached this tile). */
  | 'pending'
  /** The record is in and paid (one, or — Pluto — one per repeat so far). */
  | 'paid'
  /** The record is in and named a skip (no holder, an empty deck, nothing to lose…). */
  | 'skipped';

export type ColonyLedgerRow = {
  colony: ColonyName;
  bonus: ColonyLedgerBonus;
  /**
   * HOW MANY TIMES this row's bonus is paid: k × the seat's cubes on the tile
   * (every cube is a colony and pays in full — two cubes at k = 3 pay 6
   * times; one cube pays k).
   */
  multiplier: number;
  /** The seat's cubes on the tile (the row's own factor of `multiplier`). */
  cubes: number;
  /**
   * The row's TOTAL in the bonus's own unit: `amount × multiplier` for a
   * merged bonus; for a pair (`draw-discard`) the number of PAIRS; for a
   * `hud` benefit `amount × multiplier` where the tile prints an amount,
   * else the repeats.
   */
  total: number;
  state: ColonyLedgerRowState;
  /** The records the server kept for this row (empty before the payout). */
  records: ReadonlyArray<ParliamentEnactOutcomeModel>;
  /** `skipped`: the server's reason (an English key). */
  skipped?: string;
  /** A CARD's payout: what the row will ask of the player after the press (the entry's own `asks`). */
  asks?: ColonyBonusAsk;
};

/** The ledger's SUMS by unit — what the player receives in all, read off the rows. */
export type ColonyLedgerTotals = {
  stock: ReadonlyArray<{resource: string, amount: number}>;
  production: ReadonlyArray<{resource: string, amount: number}>;
  cardResources: ReadonlyArray<{resource: string, amount: number}>;
  /** Cards drawn outright (a plain draw). */
  cards: number;
  /** Pluto's pairs: each is one card drawn AND one discarded. */
  pairs: number;
  /** Benefits read by their description only. */
  other: number;
};

/** The bonus chip of ONE repeat, from the tile's printed grant. */
export function colonyLedgerBonusOf(entry: ColonyLedgerEntryModel): ColonyLedgerBonus {
  const grant: ColonyTradeGrantModel = entry.grant;
  const description = entry.description;
  switch (colonyBonusShape(grant.benefit)) {
  case 'stock': return {kind: 'stock', resource: grant.resource ?? 'megacredits', amount: grant.quantity, description};
  case 'production': return {kind: 'production', resource: grant.resource ?? 'megacredits', amount: grant.quantity, description};
  case 'cardResource': return {
    kind: 'card-resource',
    ...(grant.cardResource === undefined ? {} : {resource: String(grant.cardResource)}),
    ...(grant.cardResources === undefined ? {} : {resources: grant.cardResources.map(String)}),
    amount: grant.quantity, description,
  };
  // The Venus tile's «any Venus card» has no one resource: the chip reads the description, the amount is per repeat.
  case 'venusCardResource': return {kind: 'card-resource', amount: grant.quantity, description};
  case 'draw': return {kind: 'cards', amount: grant.quantity, description};
  case 'drawDiscard': return {kind: 'draw-discard', amount: 1, description};
  case 'loss': return {kind: 'hud', resource: grant.resource ?? 'megacredits', amount: grant.quantity, loss: true, description};
  case 'revealBuy':
  case 'discount':
  case 'mcPerEarthTags':
  case 'mcPerHazard':
  case 'unsupported':
    return {kind: 'hud', amount: 1, description};
  }
}

/** The records of `colony` among the viewer's records of the effect, in the server's order. */
function recordsOf(records: ReadonlyArray<ParliamentEnactOutcomeModel>, colony: ColonyName): Array<ParliamentEnactOutcomeModel> {
  return records.filter((o) => o.colony === colony && o.kind !== 'reaction');
}

/**
 * THE ROWS: one per tile of the seat's registry, in the registry's order,
 * each paid `k` times PER CUBE of the seat's on the tile; a row's state is
 * read off the RECORDS (the server's own, filtered to the viewer and the
 * effect) — or, for a card's payout read before the press, off the entry's
 * own `skipped` (the server's refusal, named with its size) — never guessed.
 */
export function colonyLedgerRows(entries: ReadonlyArray<ColonyLedgerEntryModel>, k: number, records: ReadonlyArray<ParliamentEnactOutcomeModel> = []): Array<ColonyLedgerRow> {
  return entries.map((entry) => {
    const bonus = colonyLedgerBonusOf(entry);
    const own = recordsOf(records, entry.colony);
    const skip = own.find((o) => o.kind === 'skipped');
    const paid = own.some((o) => o.kind !== 'skipped');
    const refused = entry.skipped !== undefined;
    const state: ColonyLedgerRowState = paid ? 'paid' : (skip !== undefined || refused) ? 'skipped' : 'pending';
    const repeats = k * entry.cubes;
    const total = bonus.kind === 'draw-discard' ? repeats : bonus.amount * repeats;
    const row: ColonyLedgerRow = {colony: entry.colony, bonus, multiplier: repeats, cubes: entry.cubes, total, state, records: own};
    const reason = skip?.reason ?? entry.skipped?.reason;
    if (state === 'skipped' && reason !== undefined) {
      row.skipped = reason;
    }
    if (entry.asks !== undefined && state !== 'skipped') {
      row.asks = entry.asks;
    }
    return row;
  });
}

function addTo(list: Array<{resource: string, amount: number}>, resource: string, amount: number): void {
  const entry = list.find((e) => e.resource === resource);
  if (entry === undefined) {
    list.push({resource, amount});
  } else {
    entry.amount += amount;
  }
}

/** The sums by unit over `rows` — a skipped row adds nothing (the player does not receive it). */
export function colonyLedgerTotals(rows: ReadonlyArray<ColonyLedgerRow>): ColonyLedgerTotals {
  const stock: Array<{resource: string, amount: number}> = [];
  const production: Array<{resource: string, amount: number}> = [];
  const cardResources: Array<{resource: string, amount: number}> = [];
  let cards = 0;
  let pairs = 0;
  let other = 0;
  for (const row of rows) {
    if (row.state === 'skipped') {
      continue;
    }
    const bonus = row.bonus;
    switch (bonus.kind) {
    case 'stock': addTo(stock, bonus.resource ?? 'megacredits', row.total); break;
    case 'production': addTo(production, bonus.resource ?? 'megacredits', row.total); break;
    case 'card-resource': addTo(cardResources, bonus.resource ?? 'resource', row.total); break;
    case 'cards': cards += row.total; break;
    case 'draw-discard': pairs += row.total; break;
    case 'hud': other += 1; break;
    }
  }
  return {stock, production, cardResources, cards, pairs, other};
}

/** The multiplier the viewer's records were paid at (every record carries it), else undefined. */
export function recordedMultiplierOf(records: ReadonlyArray<ParliamentEnactOutcomeModel>): number | undefined {
  return records.find((o) => o.multiplier !== undefined)?.multiplier;
}
