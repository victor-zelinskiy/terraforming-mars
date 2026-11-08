// Campaign mode — the per-viewer wire model served by GET /api/campaign.
//
// PRIVACY CONTRACT: carried project-card NAMES are owner-only. Every other
// viewer (and every shared surface) sees only status + count. The server-side
// projection (CampaignManager.getModel) is the single place that enforces
// this — never widen the shared fields with card identities.

import {CardName} from '../cards/CardName';
import {BoardName} from '../boards/BoardName';
import {MarsBotCorpId} from '../automa/AutomaTypes';
import {CampaignId, GameId, PlayerId} from '../Types';
import {
  CampaignPhase,
  CampaignSeat,
  CarryoverStatus,
  MissionModifier,
  MissionSlotState,
  MissionStanding,
  TitleEntry,
} from './CampaignTypes';
import {BiddingState, CampaignRewardMode, TenderHolding, TenderId, TenderStatus, TenderWindow} from './tenders';

/**
 * The live BIDDING as every viewer sees it (the «Тендеры» reward mode): the
 * table, the pick order with its lots, whose turn it is — plus the viewer's own
 * `yourTurn`. Nothing here is private: the cards were dealt face-up.
 */
export type BiddingModel = BiddingState & {
  yourTurn: boolean;
};

/** Public projection of a committed mission result (no private hand data). */
export type MissionResultModel = {
  gameId: GameId;
  generations: number;
  standings: ReadonlyArray<MissionStanding>;
  titles: ReadonlyArray<{seat: number} & TitleEntry>;
  bonuses: ReadonlyArray<{seat: number; megaCredits: number}>;
  championSeats?: ReadonlyArray<number>;
};

export type CampaignMissionModel = {
  slot: number;
  board: BoardName;
  final: boolean;
  state: MissionSlotState;
  modifiers: ReadonlyArray<MissionModifier>;
  /** English i18n reason key when the slot cannot launch (board unavailable, …). */
  blockedReason?: string;
  gameId?: GameId;
  /** The VIEWER's seat in that mission game — never another participant's id. */
  yourPlayerId?: PlayerId;
  result?: MissionResultModel;
  /**
   * seat → number of project cards carried INTO this mission, snapshotted at
   * launch. Human seats only. ABSENT means unknown (slot launched before the
   * history existed) — never «0 cards»; mission 1 is absent by construction.
   */
  carriedCounts?: Record<number, number>;
  /** Owner-only: the viewer's own cards carried INTO this mission. */
  yourCarried?: ReadonlyArray<CardName>;
  /** The «Тендеры» reward mode: this mission's finished bidding — the table, the order, the lots, who took what. */
  bidding?: BiddingState;
};

export type CarryoverSeatPublic = {
  seat: number;
  status: CarryoverStatus;
  count: number;
  /** The seat's carry limit (public — a limit is not a secret; the cards are). */
  limit: number;
  /** The «Тендеры» mode: how many played preludes this seat carries («Продление программы»). */
  preludeCount?: number;
};

/**
 * The «Тендеры» mode: ONE of the viewer's holdings as the carryover step shows it — executable on THIS step, or why
 * not (`blocked`: the server's reason, an English i18n key; absent on a held tender = executable now).
 */
export type CarryoverTenderModel = {
  instance: string;
  id: TenderId;
  status: TenderStatus;
  window: TenderWindow;
  blocked?: string;
};

export type CampaignCarryoverModel = {
  sourceSlot: number;
  bySeat: ReadonlyArray<CarryoverSeatPublic>;
  /** Owner-only: the viewer's currently selected cards. */
  yourCards?: ReadonlyArray<CardName>;
  /** Owner-only: the recorded terminal hand the viewer may pick from. */
  yourEligible?: ReadonlyArray<CardName>;
  /**
   * The viewer's own carry limit — THE one number every carryover surface reads. In the «Тендеры» mode before the
   * finale it already INCLUDES the seats the viewer's held «Расширенное наследие» tenders add (`yourTenderSeats`).
   */
  yourLimit?: number;
  /** The «Тендеры» mode: how many of `yourLimit` are seats a tender adds (the picker marks them). */
  yourTenderSeats?: number;
  /** The «Тендеры» mode: the viewer's played preludes of the source mission (a «Продление программы» candidate set). */
  yourEligiblePreludes?: ReadonlyArray<CardName>;
  /** The «Тендеры» mode: how many preludes the viewer may carry (one per held «Продление программы»). */
  yourPreludeLimit?: number;
  /** The «Тендеры» mode: the viewer's currently selected preludes. */
  yourPreludes?: ReadonlyArray<CardName>;
  /**
   * The «Тендеры» mode: EVERY holding of the viewer, in acquisition order, with its availability on this step — the
   * portfolio stage reads it. A legacy-window tender is ACTIVATED here (`api/campaign/tender`), never «used» silently.
   */
  yourTenders?: ReadonlyArray<CarryoverTenderModel>;
};

export type CampaignModel = {
  id: CampaignId;
  /** Monotonic document revision — the client derived-cache stamp. */
  rev: number;
  name: string;
  createdTimeMs: number;
  phase: CampaignPhase;
  pointer: number;
  missionCount: number;
  seats: ReadonlyArray<CampaignSeat>;
  /** The viewer's seat, resolved by normalized display name. */
  you?: {seat: number};
  /** Both are viewer-specific: creator-only, order-gated, carryover-gated. */
  canLaunch: boolean;
  launchBlockers: ReadonlyArray<string>;
  missions: ReadonlyArray<CampaignMissionModel>;
  progression: {
    lineages: Record<number, ReadonlyArray<CardName>>;
    botCorporation?: MarsBotCorpId;
    /** The bot's HOLDINGS in acquisition order (dividend only) — absent on a pre-portfolio campaign. */
    botHoldings?: ReadonlyArray<MarsBotCorpId>;
    titles: ReadonlyArray<{seat: number} & TitleEntry>;
    /** seat → accumulated Title Points (missions 1–3). */
    titlePoints: Record<number, number>;
    /** seat → bonus M€ pending for the next mission (empty when none). */
    pendingBonuses: Record<number, number>;
    /** The «Тендеры» mode: seat → every tender the seat won, in acquisition order (public). */
    tenders?: Record<number, ReadonlyArray<TenderHolding>>;
  };
  carryover?: CampaignCarryoverModel;
  championSeats?: ReadonlyArray<number>;
  /**
   * How the campaign rewards a mission's placement. The server always sends it; a model without one (an older server,
   * a fixture) reads `titles` — `campaignModelRewardMode` is the ONE reader.
   */
  rewardMode?: CampaignRewardMode;
  /** The «Тендеры» mode: the LIVE bidding of the interlude, while one is open. */
  bidding?: BiddingModel;
};

/** The ONE reader of a model's reward mode — absent is a titles campaign. */
export function campaignModelRewardMode(model: Pick<CampaignModel, 'rewardMode'> | undefined): CampaignRewardMode {
  return model?.rewardMode ?? 'titles';
}
