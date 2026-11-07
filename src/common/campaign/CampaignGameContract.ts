// Campaign mode — the PUBLIC mission contract a campaign injects into its
// mission game (docs/CAMPAIGN_MODE_ARCHITECTURE.md §2.8). Lives in common
// because it rides GameOptions AND its wire projection (GameOptionsModel):
// every client legitimately reads it (lineage briefing, «Штаб», the final
// mission's titles category, lobby grouping). It therefore carries ONLY
// public data — the private project-card carryover flows through server-only
// per-player state, never through here.

import {CardName} from '../cards/CardName';
import {Color} from '../Color';
import {CampaignId} from '../Types';
import {TitleEntry} from './CampaignTypes';
import {CampaignRewardMode, TenderId} from './tenders';

/**
 * A TENDER a seat brings into the mission (the «Тендеры» reward mode — public:
 * it was taken in front of everyone at the bidding). Only `held` tenders ride
 * a contract: a tender the carryover already realized, or one the Committee
 * already bought back, has nothing left to do in the game.
 */
export type CampaignTenderGrant = {
  instance: string;
  id: TenderId;
};

export type CampaignGrant = {
  /** The immutable campaign seat index — THE identity key (never color/name). */
  seat: number;
  /** This seat's color in this mission (mapping convenience for models). */
  color: Color;
  /** One-shot comeback bonus, applied with the base corporation's starting M€. */
  bonusMegaCredits: number;
  /** Corporation lineage to auto-play in acquisition order (humans only). */
  corporations: ReadonlyArray<CardName>;
  /** Accumulated Title Points; populated only when `final` is true (the `titles` reward mode). */
  titlePoints: ReadonlyArray<TitleEntry>;
  /**
   * The seat's HELD tenders (the `tenders` reward mode, the FINAL mission only —
   * every window opens at the finale). Absent on a titles campaign and on every
   * non-final mission, so their wire shape stays byte-identical.
   */
  tenders?: ReadonlyArray<CampaignTenderGrant>;
};

export type CampaignGameContract = {
  campaignId: CampaignId;
  /** Frozen display name of the campaign (lobby grouping / briefing). */
  campaignName: string;
  missionSlot: number;
  missionCount: number;
  final: boolean;
  /** How the campaign rewards a mission's placement. Absent on a contract written before the mode existed = `titles`. */
  rewardMode?: CampaignRewardMode;
  grants: ReadonlyArray<CampaignGrant>;
};

/** The ONE reader of a contract's reward mode — an older contract is a titles campaign. */
export function contractRewardMode(contract: Pick<CampaignGameContract, 'rewardMode'> | undefined): CampaignRewardMode {
  return contract?.rewardMode ?? 'titles';
}
