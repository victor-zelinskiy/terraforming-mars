// Campaign mode — «ТЕНДЕРЫ» (docs/CAMPAIGN_CONCESSIONS_DESIGN.md): the second
// reward mode of a campaign. After every non-final mission a BIDDING deals the
// table from a FRESH deck — ONE card of every applicable kind, shuffled anew for
// that mission (the owner, 2026-11-08) — the seats pick by place, and each
// tender shapes the FINALE's start — the deal, the draft, the legacy.
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

/**
 * HOW MANY tenders a bidding deals (the owner, 2026-11-08 — a creator setting of a «Тендеры» campaign, frozen with it):
 *  · `minusOne` — the default: `seats − 1` cards, every seat but the last takes one (a two-seat table deals TWO and
 *    withdraws the one the winner leaves — D2, so the winner has a choice);
 *  · `all` — `seats` cards, every seat takes one (the last takes what is left);
 *  · `minusTwo` — `seats − 2` cards, the last two seats leave with nothing — only for a table of three or more (on a
 *    two-seat table it reads as `minusOne`).
 * Absent on an older document = `minusOne`.
 */
export type CampaignTenderOffer = 'minusTwo' | 'minusOne' | 'all';

/** The dial's order — fewer cards first, the default in the middle. */
export const CAMPAIGN_TENDER_OFFERS: ReadonlyArray<CampaignTenderOffer> = ['minusTwo', 'minusOne', 'all'];

export const DEFAULT_CAMPAIGN_TENDER_OFFER: CampaignTenderOffer = 'minusOne';

export function isCampaignTenderOffer(value: unknown): value is CampaignTenderOffer {
  return typeof value === 'string' && (CAMPAIGN_TENDER_OFFERS as ReadonlyArray<string>).includes(value);
}

/** `minusTwo` needs a third seat to mean anything — a smaller table reads it as the default. */
export function effectiveTenderOffer(offer: CampaignTenderOffer, seatCount: number): CampaignTenderOffer {
  return offer === 'minusTwo' && seatCount < 3 ? 'minusOne' : offer;
}

export type TenderId =
  | 'programExtension'
  | 'targetedRequest'
  | 'restructuring'
  | 'extendedLegacy'
  | 'preludeReview'
  | 'projectReview'
  | 'openCall'
  | 'broadPortfolio'
  | 'researchSubsidy'
  | 'gamblePreludes'
  | 'gambleProjects'
  | 'gambleCorporations';

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
  /**
   * The bot's pick order, 1 = taken first — the DENIAL order: the bot takes what would help a human most. It follows
   * the catalog's impact estimate (§4.1 / §18.6 of the design doc): the decisive first, the gambles LAST (the owner,
   * 2026-11-08). Unique across the catalog.
   */
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
  // THE TIERS by real impact at the finale's start (M€-equivalents — the design doc §18.6, the owner's review of
  // 2026-11-08): decisive ≥ 10 · notable 5–9 · minor < 5 · gamble = high variance at a low expectation.
  programExtension: {id: 'programExtension', tier: 'decisive', window: 'legacy', botPriority: 1, needsPreludes: true},
  researchSubsidy: {id: 'researchSubsidy', tier: 'decisive', window: 'start', botPriority: 2, needsPreludes: false},
  broadPortfolio: {id: 'broadPortfolio', tier: 'notable', window: 'start', botPriority: 3, needsPreludes: false},
  openCall: {id: 'openCall', tier: 'notable', window: 'start', botPriority: 4, needsPreludes: true},
  targetedRequest: {id: 'targetedRequest', tier: 'notable', window: 'start', botPriority: 5, needsPreludes: false},
  extendedLegacy: {id: 'extendedLegacy', tier: 'notable', window: 'legacy', botPriority: 6, needsPreludes: false},
  restructuring: {id: 'restructuring', tier: 'notable', window: 'start', botPriority: 7, needsPreludes: false},
  preludeReview: {id: 'preludeReview', tier: 'notable', window: 'start', botPriority: 8, needsPreludes: true},
  projectReview: {id: 'projectReview', tier: 'minor', window: 'start', botPriority: 9, needsPreludes: false},
  // THE GAMBLES — one per pool; the LAST the bot takes (the owner, 2026-11-08). The corporation one only where the
  // finale DRAFTS a corporation (a three-mission route — `tenderWindows.ts`).
  gamblePreludes: {id: 'gamblePreludes', tier: 'gamble', window: 'start', botPriority: 10, needsPreludes: true},
  gambleProjects: {id: 'gambleProjects', tier: 'gamble', window: 'start', botPriority: 11, needsPreludes: false},
  gambleCorporations: {id: 'gambleCorporations', tier: 'gamble', window: 'start', botPriority: 12, needsPreludes: false},
};

/** Every kind — the mission deck holds one card of each applicable one. */
export const TENDER_IDS: ReadonlyArray<TenderId> = Object.keys(TENDER_CATALOG) as Array<TenderId>;

/** A gamble of any pool — the one-press redeal with the «your picks will be cleared» confirm. */
export function isGambleTender(id: TenderId): boolean {
  return TENDER_CATALOG[id].tier === 'gamble';
}

/** The printed NAME of every tender — an English i18n key (the journal and every surface speak it). */
export const TENDER_NAME_KEY: Readonly<Record<TenderId, string>> = {
  programExtension: 'Programme Extension',
  targetedRequest: 'Targeted Request',
  restructuring: 'Restructuring',
  extendedLegacy: 'Extended Legacy',
  preludeReview: 'Prelude Review',
  projectReview: 'Project Review',
  openCall: 'Open Call',
  broadPortfolio: 'Broad Portfolio',
  researchSubsidy: 'Research Subsidy',
  gamblePreludes: 'Gamble: Preludes',
  gambleProjects: 'Gamble: Projects',
  gambleCorporations: 'Gamble: Corporations',
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
/** «Целевой запрос»: how many project cards with the named tag join the deal per copy. */
export const TENDER_TARGETED_REQUEST_CARDS = 3;
/** «Субсидия на исследования»: a starting-hand card never goes below this price (the owner's floor, 2026-11-08). */
export const TENDER_SUBSIDY_FLOOR_MC = 1;
/** «Пересмотр прологов / проектов»: how many of the dealt cards the player may KEEP; the rest are redealt once. */
export const TENDER_REVIEW_KEEP_MAX = 1;

export function tenderWindowOf(id: TenderId): TenderWindow {
  return TENDER_CATALOG[id].window;
}

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
  /** Two seats only: the card the winner did not take is withdrawn (back into the mission's deck, never dealt again this bidding). */
  withdrawn?: boolean;
};

/**
 * ONE bidding — the interlude state between the mission's commit and the
 * carryover window. `order` is the pick order (standings, lots applied),
 * `pointer` indexes it; `done` once every seat that gets a card has one.
 * `pickers` is how many seats of the order TAKE a card (the campaign's offer
 * rule, fixed at the deal); absent on an older record = every seat but the last.
 */
export type BiddingState = {
  sourceSlot: number;
  offer: ReadonlyArray<BiddingOfferCard>;
  order: ReadonlyArray<number>;
  lots: ReadonlyArray<BiddingLot>;
  pointer: number;
  done: boolean;
  pickers?: number;
};

/**
 * How many tender cards a bidding deals under the campaign's offer rule: `all` — one per seat; `minusOne` — `seats − 1`,
 * and TWO for a two-seat table (D2: the winner chooses, the other card is withdrawn); `minusTwo` — `seats − 2` (a
 * two-seat table reads as `minusOne`).
 */
export function biddingOfferSize(seatCount: number, offer: CampaignTenderOffer = DEFAULT_CAMPAIGN_TENDER_OFFER): number {
  switch (effectiveTenderOffer(offer, seatCount)) {
  case 'all': return Math.max(0, seatCount);
  case 'minusTwo': return Math.max(0, seatCount - 2);
  default: return Math.max(seatCount - 1, Math.min(seatCount, 2));
  }
}

/** How many seats of the order TAKE a card under the offer rule (D2: two seats, two cards, ONE picker). */
export function biddingPickers(seatCount: number, offer: CampaignTenderOffer = DEFAULT_CAMPAIGN_TENDER_OFFER): number {
  switch (effectiveTenderOffer(offer, seatCount)) {
  case 'all': return Math.max(0, seatCount);
  case 'minusTwo': return Math.max(0, seatCount - 2);
  default: return Math.max(0, seatCount - 1);
  }
}

/** The seats that PICK — the record's own count; an older record: every seat of the order but the last. */
export function biddingPickerCount(bidding: Pick<BiddingState, 'order' | 'pickers'>): number {
  return bidding.pickers ?? Math.max(0, bidding.order.length - 1);
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
