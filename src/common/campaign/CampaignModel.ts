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
};

export type CarryoverSeatPublic = {
  seat: number;
  status: CarryoverStatus;
  count: number;
};

export type CampaignCarryoverModel = {
  sourceSlot: number;
  bySeat: ReadonlyArray<CarryoverSeatPublic>;
  /** Owner-only: the viewer's currently selected cards. */
  yourCards?: ReadonlyArray<CardName>;
  /** Owner-only: the recorded terminal hand the viewer may pick from. */
  yourEligible?: ReadonlyArray<CardName>;
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
    titles: ReadonlyArray<{seat: number} & TitleEntry>;
    /** seat → accumulated Title Points (missions 1–3). */
    titlePoints: Record<number, number>;
    /** seat → bonus M€ pending for the next mission (empty when none). */
    pendingBonuses: Record<number, number>;
  };
  carryover?: CampaignCarryoverModel;
  championSeats?: ReadonlyArray<number>;
};
