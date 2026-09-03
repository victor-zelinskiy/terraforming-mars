// Campaign mode — the persisted campaign document
// (docs/CAMPAIGN_MODE_ARCHITECTURE.md §2.4). The whole document is a small
// JSON blob, write-through persisted by CampaignManager on every mutation.
//
// PRIVACY: `missions[].finalHands` and `carryover.bySeat[].cards` hold
// PRIVATE card identities. They exist only in this server document — the wire
// projection (CampaignManager.getModel) exposes card names to their OWNER
// alone and status+count to everyone else.

import {CardName} from '../../common/cards/CardName';
import {BoardName} from '../../common/boards/BoardName';
import {MarsBotCorpId} from '../../common/automa/AutomaTypes';
import {NewGameConfig} from '../../common/game/NewGameConfig';
import {CampaignId, GameId, PlayerId} from '../../common/Types';
import {
  CampaignPhase,
  CampaignSeat,
  CarryoverStatus,
  MissionModifier,
  MissionResult,
  TitleEntry,
} from '../../common/campaign/CampaignTypes';

export type SerializedMissionSlot = {
  slot: number;
  board: BoardName;
  /** v1: always empty; the typed modifier extension point. */
  modifiers: Array<MissionModifier>;
  gameId?: GameId;
  /** seat → that seat's PlayerId in this mission's game (captured at launch). */
  playerIds?: Record<number, PlayerId>;
  /** Immutable once set; cleared only by an explicit result revoke. */
  result?: MissionResult;
  /**
   * SERVER-PRIVATE: each human seat's terminal hand, recorded at commit —
   * the ONLY set the carryover selection may pick from. Never serialized
   * into any wire model.
   */
  finalHands?: Record<number, Array<CardName>>;
  /** D12 board repairs of a blocked slot — part of the public chronicle. */
  repairs?: Array<{atMs: number, fromBoard: BoardName, toBoard: BoardName}>;
};

export type CarryoverSeatState = {
  status: CarryoverStatus;
  /** PRIVATE to the seat owner. 0..CARRYOVER_MAX_CARDS entries. */
  cards: Array<CardName>;
  /** Set atomically by the next mission's launch — re-launch can never re-apply. */
  consumed: boolean;
};

export type SerializedCampaign = {
  version: 1;
  id: CampaignId;
  /** Monotonic revision, bumped on every persisted mutation (client cache stamp). */
  rev: number;
  name: string;
  createdTimeMs: number;
  seats: Array<CampaignSeat>;
  /**
   * The FROZEN settings snapshot (NewGameConfig-shaped; board/seed/clone are
   * ignored at launch — each mission derives its own). Never mutated after
   * creation: missions can't drift by construction.
   */
  settings: NewGameConfig;
  /** Provenance of the generated route; `missions[].board` is authoritative. */
  generator: {seed: number, version: number, pool: Array<BoardName>};
  missions: Array<SerializedMissionSlot>;
  /** Index of the current slot (the active mission, or the next to launch). */
  pointer: number;
  phase: CampaignPhase;
  progression: {
    /** seat → corporations in acquisition order (humans only). */
    lineages: Record<number, Array<CardName>>;
    botCorporation?: MarsBotCorpId;
    titles: Array<{seat: number} & TitleEntry>;
  };
  /** Present between missions while the project carryover is being decided. */
  carryover?: {
    sourceSlot: number;
    bySeat: Record<number, CarryoverSeatState>;
  };
  championSeats?: Array<number>;
};
