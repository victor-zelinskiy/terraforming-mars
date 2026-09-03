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

export type CampaignGrant = {
  /** The immutable campaign seat index — THE identity key (never color/name). */
  seat: number;
  /** This seat's color in this mission (mapping convenience for models). */
  color: Color;
  /** One-shot comeback bonus, applied with the base corporation's starting M€. */
  bonusMegaCredits: number;
  /** Corporation lineage to auto-play in acquisition order (humans only). */
  corporations: ReadonlyArray<CardName>;
  /** Accumulated Title Points; populated only when `final` is true. */
  titlePoints: ReadonlyArray<TitleEntry>;
};

export type CampaignGameContract = {
  campaignId: CampaignId;
  /** Frozen display name of the campaign (lobby grouping / briefing). */
  campaignName: string;
  missionSlot: number;
  missionCount: number;
  final: boolean;
  grants: ReadonlyArray<CampaignGrant>;
};
