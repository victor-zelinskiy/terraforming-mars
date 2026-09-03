// Campaign mode — shared domain types (docs/CAMPAIGN_MODE_ARCHITECTURE.md).
//
// A campaign is a server-authoritative document linking 4 mission games with a
// frozen roster/settings, a generated board route, corporation lineages, titles
// (Титулы), next-mission bonus M€ and the 0–2 project-card carryover
// («Наследие проектов»). Ordinary games never reference any of this.
//
// Everything here is data-shaped: no runtime logic bound to either side.

import {CardName} from '../cards/CardName';
import {Color} from '../Color';
import {DifficultyLevel, MarsBotCorpId} from '../automa/AutomaTypes';
import {GameId} from '../Types';

export const CAMPAIGN_MISSION_COUNT = 4;
export const CAMPAIGN_GENERATOR_VERSION = 1;
/** Max project cards a human seat may carry into the next mission. */
export const CARRYOVER_MAX_CARDS = 2;

export type CampaignPhase =
  | 'generated'     // route exists, mission 1 not launched
  | 'missionActive' // missions[pointer] has a live game without a committed result
  | 'interlude'     // missions[pointer-1] committed, next slot not launched
  | 'finished'      // final mission committed; champion(s) recorded
  | 'abandoned';    // explicit cancel (soft delete; mission games untouched)

export type TitleName = 'governor' | 'administrator' | 'prefect';

export type TitleEntry = {
  missionSlot: number;
  title: TitleName;
  /** Copied from the config table at commit time — later tuning never rewrites history. */
  titlePoints: number;
};

/** v1: never generated, never rendered when empty. The typed extension point only. */
export type MissionModifier = {id: string};

export type CampaignSeatKind = 'human' | 'bot';

/**
 * The immutable seat of one participant, fixed for the whole campaign.
 * `seat` (the array index) is THE stable identity key for every progression
 * artefact (lineage, titles, bonuses, carryover). Color is presentational;
 * the display name is used only for join/viewer resolution.
 */
export type CampaignSeat = {
  seat: number;
  kind: CampaignSeatKind;
  name: string;
  color: Color;
  trBoost: number;
  botDifficulty?: DifficultyLevel;
};

export type MissionStanding = {
  seat: number;
  /** 1-based; full ties share the better place (competition ranking). */
  place: number;
  score: number;
  /** The tie-break metric, snapshotted at commit. */
  megaCredits: number;
  /** Corporations in play order at mission end (bot: its corp id rendered separately). */
  corporations: ReadonlyArray<CardName>;
  /** Other seats sharing this place ([] normally). */
  tiedWith: ReadonlyArray<number>;
};

export type MissionResult = {
  gameId: GameId;
  committedAtMs: number;
  /** Rollback-invalidation fingerprint (see the rollback guard). */
  gameLastSaveId: number;
  gameUndoCount: number;
  generations: number;
  standings: ReadonlyArray<MissionStanding>;
  titles: ReadonlyArray<{seat: number} & TitleEntry>;
  /** Bonus M€ to apply in the NEXT mission (empty after the final mission). */
  bonuses: ReadonlyArray<{seat: number; megaCredits: number}>;
  /** Final mission only. Full ties share the championship — never a single forced seat. */
  championSeats?: ReadonlyArray<number>;
};

export type CarryoverStatus = 'pending' | 'confirmed';

/** Derived per-slot presentation state. */
export type MissionSlotState = 'locked' | 'ready' | 'active' | 'committed';

export type CampaignProgression = {
  /** seat → corporations in acquisition order (humans only). */
  lineages: Record<number, ReadonlyArray<CardName>>;
  /** Fixed after mission 1; the bot keeps ONE corporation all campaign. */
  botCorporation?: MarsBotCorpId;
  /** Flattened title ledger across committed missions. */
  titles: ReadonlyArray<{seat: number} & TitleEntry>;
};
