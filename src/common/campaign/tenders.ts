// Campaign mode — «ТЕНДЕРЫ» (docs/CAMPAIGN_CONCESSIONS_DESIGN.md): the second
// reward mode of a campaign. After every non-final mission a BIDDING deals
// `seats − 1` tender cards from the Register, the seats pick by place, and
// each tender shapes the FINALE's start — the deal, the draft, the legacy.
// Never a point, never a resource: a tender left unexecuted is bought back
// by the Committee for `TENDER_COMPENSATION_MC` at the finale's start.
//
// Pure data + tiny pure helpers; the bidding itself lives server-side
// (`server/campaign/tenderBidding.ts`), the effects in
// `server/campaign/CampaignMissionSetup.ts`, the presentation registry in
// `client/console/campaign/tenderMeta.ts` — ONE id, one row in each.

import {CardName} from '../cards/CardName';

/** How a campaign rewards a mission's placement. Absent on an older document = `titles`. */
export type CampaignRewardMode = 'titles' | 'tenders';

export const CAMPAIGN_REWARD_MODES: ReadonlyArray<CampaignRewardMode> = ['titles', 'tenders'];

export function isCampaignRewardMode(value: unknown): value is CampaignRewardMode {
  return typeof value === 'string' && (CAMPAIGN_REWARD_MODES as ReadonlyArray<string>).includes(value);
}

export type TenderId =
  | 'programExtension'
  | 'additionalPrelude'
  | 'restructuring'
  | 'extendedLegacy'
  | 'preludeReview'
  | 'projectReview'
  | 'openCall'
  | 'broadPortfolio'
  | 'researchSubsidy'
  | 'gamble';

/**
 * WHEN a tender speaks:
 *  · `legacy` — realized BY USE on the carryover step before the finale (an
 *    extra legacy seat taken, a played prelude carried) — never a toggle;
 *  · `start` — executed from the finale's start («НАСЛЕДИЕ › ТЕНДЕРЫ») while
 *    the initial selection is open; unexecuted at «Старт» → compensation.
 */
export type TenderWindow = 'legacy' | 'start';

/** The printed rank — the bot's denial order follows it, the face prints it. */
export type TenderTier = 'decisive' | 'notable' | 'minor' | 'gamble';

export type TenderDef = {
  id: TenderId;
  tier: TenderTier;
  window: TenderWindow;
  /** Copies in the Register (the ONE balance dial — data, never code). */
  copies: number;
  /** The bot's pick order, 1 = taken first. Unique across the catalog. */
  botPriority: number;
  /** The tender exists only with the Prelude expansion at the table. */
  needsPreludes: boolean;
};

/**
 * THE CATALOG — every tender of the fork. The compiler refuses a `TenderId`
 * without a row; `tests/campaign/tenderCatalog.spec.ts` refuses a row without
 * its effect, its meta and its copy.
 */
export const TENDER_CATALOG: Readonly<Record<TenderId, TenderDef>> = {
  programExtension: {id: 'programExtension', tier: 'decisive', window: 'legacy', copies: 2, botPriority: 1, needsPreludes: true},
  additionalPrelude: {id: 'additionalPrelude', tier: 'decisive', window: 'start', copies: 2, botPriority: 2, needsPreludes: true},
  restructuring: {id: 'restructuring', tier: 'notable', window: 'start', copies: 3, botPriority: 4, needsPreludes: false},
  extendedLegacy: {id: 'extendedLegacy', tier: 'notable', window: 'legacy', copies: 3, botPriority: 6, needsPreludes: false},
  preludeReview: {id: 'preludeReview', tier: 'notable', window: 'start', copies: 3, botPriority: 5, needsPreludes: true},
  projectReview: {id: 'projectReview', tier: 'notable', window: 'start', copies: 3, botPriority: 7, needsPreludes: false},
  researchSubsidy: {id: 'researchSubsidy', tier: 'notable', window: 'start', copies: 3, botPriority: 9, needsPreludes: false},
  gamble: {id: 'gamble', tier: 'gamble', window: 'start', copies: 2, botPriority: 8, needsPreludes: true},
  openCall: {id: 'openCall', tier: 'notable', window: 'start', copies: 3, botPriority: 3, needsPreludes: true},
  broadPortfolio: {id: 'broadPortfolio', tier: 'minor', window: 'start', copies: 2, botPriority: 10, needsPreludes: false},
};

export const TENDER_IDS: ReadonlyArray<TenderId> = Object.keys(TENDER_CATALOG) as Array<TenderId>;

/** The printed NAME of every tender — an English i18n key (the journal and every surface speak it). */
export const TENDER_NAME_KEY: Readonly<Record<TenderId, string>> = {
  programExtension: 'Programme Extension',
  additionalPrelude: 'Additional Prelude',
  restructuring: 'Restructuring',
  extendedLegacy: 'Extended Legacy',
  preludeReview: 'Prelude Review',
  projectReview: 'Project Review',
  openCall: 'Open Call',
  broadPortfolio: 'Broad Portfolio',
  researchSubsidy: 'Research Subsidy',
  gamble: 'Gamble',
};

export function tenderNameKey(id: TenderId): string {
  return TENDER_NAME_KEY[id];
}

export function isTenderId(value: unknown): value is TenderId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(TENDER_CATALOG, value);
}

export function tenderDef(id: TenderId): TenderDef {
  return TENDER_CATALOG[id];
}

/** What the Committee pays for a tender left unexecuted (M€ each) — the floor every player knows. */
export const TENDER_COMPENSATION_MC = 3;

/** «Открытый конкурс»: how many preludes join the finale's deal per copy. */
export const TENDER_OPEN_CALL_PRELUDES = 2;
/** «Широкий портфель»: how many projects join the finale's deal per copy. */
export const TENDER_BROAD_PORTFOLIO_PROJECTS = 4;
/** «Реструктуризация»: how many corporations are dealt per copy. */
export const TENDER_RESTRUCTURING_CANDIDATES = 2;

/**
 * A tender's life: `held` (won, waiting for its window) → `executed` (its
 * effect applied: a start tender used, a legacy tender consumed by the launch)
 * or `cashed` (bought back for the compensation).
 */
export type TenderStatus = 'held' | 'executed' | 'cashed';

export type TenderHolding = {
  /** Unique in the campaign (`t<slot>-<k>`). */
  instance: string;
  id: TenderId;
  /** The mission whose bidding gave it (0-based slot). */
  wonAtSlot: number;
  /** The place it was taken with (1-based). */
  place: number;
  status: TenderStatus;
};

/**
 * A tender AS THE PLAYER HOLDS IT INSIDE THE FINALE (`Player.campaignTenders`,
 * serialized with the player): the holding's identity and status, plus — for a
 * «Реструктуризация» whose candidates were dealt but not yet chosen — the offer.
 */
export type PlayerTender = {
  instance: string;
  id: TenderId;
  status: TenderStatus;
  offer?: Array<CardName>;
};

export type BiddingLot = {
  /** The seats that tied for the place, in standings order. */
  seats: ReadonlyArray<number>;
  /** The order the lot gave them. */
  order: ReadonlyArray<number>;
};

export type BiddingOfferCard = {
  instance: string;
  id: TenderId;
  /** The seat that took it; absent while it lies on the table. */
  takenBy?: number;
  /** Two seats only: the card the winner did not take is withdrawn under the Register. */
  withdrawn?: boolean;
};

/**
 * ONE bidding — the interlude state between the mission's commit and the
 * carryover window. `order` is the pick order (standings, lots applied),
 * `pointer` indexes it; `done` once every seat that gets a card has one.
 */
export type BiddingState = {
  sourceSlot: number;
  offer: ReadonlyArray<BiddingOfferCard>;
  order: ReadonlyArray<number>;
  lots: ReadonlyArray<BiddingLot>;
  pointer: number;
  done: boolean;
};

/** How many tender cards a bidding deals: `seats − 1`, and TWO for a two-seat table (D2). */
export function biddingOfferSize(seatCount: number): number {
  return Math.max(seatCount - 1, Math.min(seatCount, 2));
}

/** The seats that PICK: every seat of the order but the last (the last place leaves with nothing). */
export function biddingPickerCount(order: ReadonlyArray<number>): number {
  return Math.max(0, order.length - 1);
}

/** The seat whose pick it is now — undefined once the bidding is done. */
export function biddingTurnSeat(bidding: Pick<BiddingState, 'order' | 'pointer' | 'done'>): number | undefined {
  if (bidding.done) {
    return undefined;
  }
  return bidding.order[bidding.pointer];
}

/** The cards still lying on the table. */
export function biddingOpenCards(bidding: Pick<BiddingState, 'offer'>): Array<BiddingOfferCard> {
  return bidding.offer.filter((c) => c.takenBy === undefined && c.withdrawn !== true);
}

/** The bot's pick among the open cards — the catalog's denial order, deterministic. */
export function botTenderPick(open: ReadonlyArray<BiddingOfferCard>): BiddingOfferCard | undefined {
  let best: BiddingOfferCard | undefined = undefined;
  for (const card of open) {
    if (best === undefined || tenderDef(card.id).botPriority < tenderDef(best.id).botPriority) {
      best = card;
    }
  }
  return best;
}

/** The held tenders of one id — what a stackable effect multiplies by. */
export function heldTenderCount(holdings: ReadonlyArray<Pick<TenderHolding, 'id' | 'status'>>, id: TenderId): number {
  return holdings.filter((h) => h.id === id && h.status === 'held').length;
}
