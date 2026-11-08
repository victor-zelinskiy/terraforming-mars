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
import {BiddingState, CampaignRewardMode, CampaignTenderOffer, TenderHolding} from '../../common/campaign/tenders';

export type SerializedMissionSlot = {
  slot: number;
  board: BoardName;
  /**
   * The slot's rolled conditions (`missionModifiers.ts`), generated with the
   * route. Read through `slotModifiersOf` — a pre-roll campaign derives them.
   */
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
  /**
   * The project cards each seat carried INTO this mission, snapshotted at
   * launch (the moment the interlude carryover is consumed — the live
   * `carryover` window is overwritten by the next commit, so this is the
   * durable history the campaign overview reads). Absent on mission 1
   * (nothing can be carried into it) and on slots launched before this
   * field existed — absent means UNKNOWN, never «0 cards». Card names stay
   * owner-only in every wire projection; other viewers see counts.
   */
  carriedBySeat?: Record<number, Array<CardName>>;
  /** D12 board repairs of a blocked slot — part of the public chronicle. */
  repairs?: Array<{atMs: number, fromBoard: BoardName, toBoard: BoardName}>;
  /**
   * The «Тендеры» mode: each human seat's PLAYED preludes at the mission's end
   * (public — they lay face-up on the table), recorded at commit — the ONLY set
   * a «Продление программы» may carry from.
   */
  finalPreludes?: Record<number, Array<CardName>>;
  /**
   * The «Тендеры» mode: this mission's bidding once it is DONE — the table, the
   * order, the lots, who took what. The chronicle's record; the live bidding
   * stands on the campaign (`bidding`) while open.
   */
  bidding?: BiddingState;
};

export type CarryoverSeatState = {
  status: CarryoverStatus;
  /** PRIVATE to the seat owner. 0..`limit` entries. */
  cards: Array<CardName>;
  /**
   * How many cards this seat may carry — a VARIABLE OF THE SEAT, written once
   * by `carryoverLimitFor` when the window opens. Absent on an older save:
   * read through `carryoverLimitOf` (the default). In the «Тендеры» mode the
   * seat's held «Расширенное наследие» tenders add to it at READ time
   * (`carryoverLimitWithTenders`) — the stored number stays the base.
   */
  limit?: number;
  /**
   * The «Тендеры» mode: the played preludes this seat carries into the finale
   * («Продление программы» — one per held copy). Absent = none.
   */
  preludes?: Array<CardName>;
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
  /**
   * Provenance of the generated route; `missions[].board` / `.modifiers` are
   * authoritative. `randomMAChance` (percent, 0 = the rule was off) marks a
   * route whose «Случайные цели и награды» was ROLLED per slot; ABSENT on a
   * campaign generated before the roll — every mission then followed the
   * frozen rule (`slotModifiersOf`). `shuffleMapChance` is the same for
   * «Случайные места для тайлов» (absent on a route generated before 2026-11-07).
   */
  generator: {seed: number, version: number, pool: Array<BoardName>, randomMAChance?: number, shuffleMapChance?: number};
  missions: Array<SerializedMissionSlot>;
  /** Index of the current slot (the active mission, or the next to launch). */
  pointer: number;
  phase: CampaignPhase;
  progression: {
    /** seat → corporations in acquisition order (humans only). */
    lineages: Record<number, Array<CardName>>;
    botCorporation?: MarsBotCorpId;
    /**
     * The bot's HOLDINGS in acquisition order — drawn at the launch of
     * missions 2 and 3, each paying only its end-game dividend
     * (docs/claude/prompts/marsbot-portfolio-dividends.md). ABSENT on a
     * campaign created before the portfolio existed: it finishes without
     * holdings (the owner's D7 — honest to the results already recorded).
     */
    botHoldings?: Array<MarsBotCorpId>;
    titles: Array<{seat: number} & TitleEntry>;
    /**
     * The «Тендеры» mode: seat → every tender the seat won, in acquisition
     * order, with its status. Rebuilt from the slots' bidding records on a
     * revoke. Absent on a titles campaign.
     */
    tenders?: Record<number, Array<TenderHolding>>;
  };
  /** Present between missions while the project carryover is being decided. */
  carryover?: {
    sourceSlot: number;
    bySeat: Record<number, CarryoverSeatState>;
  };
  championSeats?: Array<number>;
  /**
   * How the campaign rewards a mission's placement (docs/CAMPAIGN_CONCESSIONS_DESIGN.md).
   * Absent on a document written before the mode existed = `titles`. Frozen at creation.
   */
  rewardMode?: CampaignRewardMode;
  /**
   * The «Тендеры» mode: how many tenders a bidding deals (`biddingOfferSize` / `biddingPickers` — all seats, all but
   * the last, all but the last two). Absent = `minusOne`. Frozen at creation.
   */
  tenderOffer?: CampaignTenderOffer;
  /** The «Тендеры» mode: the LIVE bidding of the interlude — present from the commit until every pick is made. */
  bidding?: BiddingState;
  /**
   * DELETION TOMBSTONE. Set (and persisted) BEFORE the first mission game is
   * deleted; the campaign document itself is deleted only after the whole
   * cascade succeeded. A campaign carrying this field is invisible to every
   * read and refuses every mutation — `CampaignManager.load` resumes the
   * cascade instead, so a crash mid-delete converges on «fully deleted»
   * rather than on a half-orphaned campaign. Optional: absent on every
   * pre-existing document (graceful degradation).
   */
  deletingAtMs?: number;
};
