import {Color} from '../Color';
import {SpaceId} from '../Types';
import {CardName} from '../cards/CardName';
import {Tag} from '../cards/Tag';
import {CardResource} from '../CardResource';
import {ColonyName} from '../colonies/ColonyName';
import {ColonyTradeGrantModel} from './ColonyTradeManifestModel';
import {Resource} from '../Resource';
import {ResolutionCountByResource, ResolutionCountMetricModel, ResolutionCountModel} from '../parliament/resolutionCounts';
import {ParameterMoveId} from '../parliament/parameterMove';
import {PartyName} from '../turmoil/PartyName';
import {Message} from '../logs/Message';
import {PlayerInputType} from '../input/PlayerInputType';
import type {EventTrigger} from '../events/GameEvent';
import {ActionEffect} from './ActionPreviewModel';
import {
  BotParliamentMode, ParliamentPhaseStep, PartyActionId, QuestDefinition, ReduxParty,
  ResolutionId, ResolutionInstanceId,
} from '../parliament/ParliamentTypes';

/** One delegate on a resolution, in placement order (`seq` is global and monotonic). */
export type ParliamentVoteModel = {
  owner: Color | 'neutral';
  seq: number;
};

export type ParliamentSlotModel = {
  instance: ResolutionInstanceId;
  resolution: ResolutionId;
  party: ReduxParty;
  votes: ReadonlyArray<ParliamentVoteModel>;
  totalVotes: number;
  /** The player who would win this resolution if it were enacted now (rulebook p.8). */
  leader?: Color | 'neutral';
  /** True for the resolution that would be enacted if the generation ended now. */
  isWinning: boolean;
  /** 1 = closest to the ENACTED slot — wins every tie among the three. */
  tiePriority: number;
  /** Delegates the VIEWER has on this card (the party-effect / requirement threshold). */
  viewerVotes: number;
};

export type ParliamentEnactedModel = {
  instance: ResolutionInstanceId;
  resolution: ResolutionId;
  party: ReduxParty;
};

export type ParliamentQuestModel = {
  definition: QuestDefinition;
  /** 'starter' for the printed first-generation quest, else the resolution it belongs to. */
  source: 'starter' | ResolutionId;
  generation: number;
  progress: Readonly<Record<string, number>>; // keyed by Color
  completedBy?: Color;
};

/** WHY a player holds a party's effect — every reason stands on its own. */
export type PartyAccessModel = {
  party: ReduxParty;
  ruling: boolean;
  /** Own delegates on the party's resolution (≥ PARTY_EFFECT_DELEGATES grants access). */
  delegates: number;
  byDelegates: boolean;
  /** Card-granted access (a future Septem Tribus / Council Seat) — effect only, never the requirement. */
  granted: ReadonlyArray<string>;
  hasEffect: boolean;
  satisfiesRequirement: boolean;
};

/** ONE row of a seat's colony ledger: the tile and its printed colony bonus (see `ParliamentPlayerModel.colonyBonuses`). */
export type ColonyLedgerEntryModel = {
  colony: ColonyName;
  grant: ColonyTradeGrantModel;
  /** The tile's printed description of the bonus — an English key of the colony's own. */
  description: string;
};

export type ParliamentPlayerModel = {
  color: Color;
  /** False for a MarsBot seat in iteration 0 (see BotParliamentMode). */
  participates: boolean;
  lobby: boolean;
  reserve: number;
  onResolutions: number;
  chairman: boolean;
  agenda: number;
  influence: number;
  /**
   * The seat's COUNTS for every counted term a resolution of the catalog
   * declares (`resolutionCounts.ts`) — the number and the cards, read from
   * the tableau by the server. Absent for a seat outside the parliament.
   */
  counts?: ReadonlyArray<ResolutionCountModel>;
  /**
   * The seat's PRODUCTIONS a SEQUENTIAL effect of the catalog divides
   * («1 card for every 3 steps of heat production you have» — Climate
   * Research). Only the resources some declaration names; absent for a seat
   * outside the parliament. Every surface computes the second half of a
   * chained effect from THIS number, so the estimate and the payout stand on
   * the same reading.
   */
  production?: Readonly<Partial<Record<Resource, number>>>;
  /**
   * THE SEAT'S SUPPLY a LEVY of the catalog takes from (the Budgets' «lose 10
   * M€» — `resolutionLevy.ts`): only the resources some declaration names;
   * absent for a seat outside the parliament. The vote panel's net line and
   * the stand read the seat's shortfall from THIS number — the same supply
   * the levy step will read at the enactment.
   */
  stock?: Readonly<Partial<Record<Resource, number>>>;
  /**
   * THE SEAT'S COLONY LEDGER — every colony tile the seat has a cube on, in
   * the table's order, with the tile's PRINTED colony bonus as a grant
   * (`ColonyTradeGrantModel` — the trade manifest's own shape) and its printed
   * description (the colony's English key). Present only while some
   * resolution of the catalog pays «all your colony bonuses» (Colonial
   * Affairs); every surface reads THIS list — the client never derives it
   * from the colonies model (the server's rule of what a colony bonus is).
   */
  colonyBonuses?: ReadonlyArray<ColonyLedgerEntryModel>;
  /**
   * THE SEAT'S HAND SIZE a LEVEL part of the catalog tops up (Joint
   * Research's «draw until you have 6 + influence in hand»): present only
   * while some declaration reads the hand; absent for a seat outside the
   * parliament. Every surface computes the top-up from THIS number — the
   * same count the step will read (cards withheld in a pending intake are
   * not in it, exactly as the step sees the hand).
   */
  hand?: number;
  access: ReadonlyArray<PartyAccessModel>;
  partyActionUses: Partial<Record<PartyName, number>>;
  resolutionActionUses: number;
};

/** The viewer's own vote options — one projection per voting slot. */
export type VoteProjectionModel = {
  instance: ResolutionInstanceId;
  votesAfter: number;
  leaderAfter?: Color | 'neutral';
  /** The viewer would become (or stay) the card's leader. */
  viewerLeads: boolean;
  /** The card would become (or stay) the winning resolution. */
  becomesWinning: boolean;
  /** This delegate reaches the party-effect threshold. */
  unlocksEffect: boolean;
  unlocksRequirement: boolean;
  /** Ties resolved in the viewer's favour by an earlier delegate (rulebook p.8). */
  tieNote?: 'earlier-delegate' | 'slot-priority';
};

export type VoteOptionModel = {
  available: boolean;
  /** English i18n key naming the blocker ('' when available). */
  reason: string;
  source: 'lobby' | 'reserve' | 'none';
  cost: number;
  projections: ReadonlyArray<VoteProjectionModel>;
};

export type PartyActionModel = {
  id: PartyActionId;
  party: ReduxParty;
  hasAccess: boolean;
  usesLeft: number;
  usesPerGeneration: number;
  available: boolean;
  reason: string | Message;
  /** Server-computed result chips (`current → resulting` where known). */
  preview: ReadonlyArray<ActionEffect>;
};

export type ParliamentPhasePendingModel = {
  player: Color;
  key: string;
  /**
   * WHAT the asked seat is answering — its live prompt's input type ('card' a
   * card pick, 'space' a placement, 'or' a choice, …). Lets every OTHER seat
   * read an honest «waiting for X to choose a card» without knowing the step.
   */
  input?: PlayerInputType;
};

/**
 * What ONE STEP of the enacted resolution's effect ACTUALLY did for one
 * player — the server's own record (`SerializedEnactOutcome`), never a
 * recomputation: the amount is the amount paid. A `skipped` outcome names
 * its reason (an English i18n key) — no silent loss.
 */
export type ParliamentEnactOutcomeModel = {
  /**
   * The seat the record belongs to — ABSENT on a WORLD record (`part: 'world'`):
   * the enactment moved the PLANET, which belongs to no player and is read the
   * same by every viewer.
   */
  player?: Color;
  step: string;
  /** `effect` — everyone's part · `world` — the table's own · `winner` — the winner's (absent on older saves). */
  part?: 'effect' | 'world' | 'winner';
  /** The scaled effect's id (`InfluenceScaledEffect.id`) when the amount came from influence. */
  effect?: string;
  /**
   * `cardResource` onto a card · `production` · `stock` into the supply · `cards`
   * drawn projects · `discard` a card thrown away (Pluto's second half) ·
   * `colonyBonus` a colony bonus paid through its own counter (a discount, a
   * loss, a science tag) · `ocean` / `greenery` the winner's tile · `colony`
   * the winner's colony built for free (Colony Contest — see `colony`) ·
   * `city` a CITY TIER built onto the seat's own city (Skyscrapers — see
   * `space` and `stackHeight`) · `globalParameter` a WORLD move of a global
   * parameter (see `parameter`; `amount` = the steps actually made, negative
   * for a lowering) · `skipped` · `reaction` the RULING PARTY's answer to this
   * step's own change.
   */
  kind: 'cardResource' | 'production' | 'stock' | 'cards' | 'discard' | 'colonyBonus' | 'ocean' | 'greenery' | 'colony' | 'city' | 'globalParameter' | 'skipped' | 'reaction';
  /**
   * The COLONY whose printed bonus this record pays (Colonial Affairs) — the ledger row it belongs to;
   * for the `colony` kind, the tile the winner's cube landed on.
   */
  colony?: ColonyName;
  /** …how many times that bonus was paid in this one record (the resolution's multiplier k). */
  multiplier?: number;
  /** `colonyBonus`: the tile's printed description of the bonus (the colony's own English key). */
  description?: string;
  /**
   * `reaction`: the answering party and what it answered (the Greens' M€
   * production for a heat-production raise, their M€ for the TR of the
   * winner's tile) — derived by the driver from the recorder's own events
   * inside the step, never re-stated by the resolution; `production` / `stock`
   * name the resource it paid, `amount` the sum inside the step, `before` /
   * `after` the value around it. The record shares the STEP of the change it
   * answered — a reading groups it under its cause by `step`.
   */
  party?: PartyName;
  trigger?: EventTrigger;
  /** `cardResource` (and its skip): the ONE kind of the units — absent when an effect over several kinds landed units of more than one (see `resources`, `cards[].resource`). */
  resource?: CardResource;
  /** `cardResource` of an effect over SEVERAL kinds («data or microbe»): the kinds in the declared order — the unit's name where `resource` cannot say it. */
  resources?: ReadonlyArray<CardResource>;
  /** `production` (and its skip): the standard resource whose production the effect raises. */
  production?: Resource;
  /**
   * `stock` (and its skip): the standard resource the effect adds to the
   * supply — or TAKES from it: a LEVY (the Budgets' «lose 10 M€») is a `stock`
   * record with a NEGATIVE `amount`, never a skip.
   */
  stock?: Resource;
  amount?: number;
  /** A LEVY: what was OWED beside `amount` (what was taken) — above `−amount` exactly when the seat was short (see `reason`). */
  owed?: number;
  /** `cardResource`: the ONE card the whole amount landed on (absent when spread over several — see `cards`). */
  card?: CardName;
  /**
   * `cardResource`: WHERE the units landed, card by card — every reader's list; one recipient is a list of one.
   * `resource` is the kind THAT card took (its own storage rule) — the unit's kind where the effect spans several.
   */
  cards?: ReadonlyArray<{card: CardName; amount: number; resource?: CardResource}>;
  space?: SpaceId;
  /** `city`: the cell's stack AFTER the tier landed («a stack of 2») — frozen, never re-read from a later board. */
  stackHeight?: number;
  reason?: string;
  influence?: number;
  /** A counted term (B) at the enactment, and the cards it counted — frozen, never re-read from a later tableau. */
  count?: number;
  counted?: ReadonlyArray<CardName>;
  /** …and what each of those cards contributed (a TAG count: a two-power-tag card is 2). */
  countedUnits?: ReadonlyArray<number>;
  /** A count over SEVERAL tags: each tag's own total («Venus 1 · Jovian 2»). */
  countedByTag?: ReadonlyArray<{tag: Tag; count: number}>;
  /** A BOARD count: the CELLS counted at the enactment (a tile has no card — `counted` is empty, this list explains the number). */
  countedSpaces?: ReadonlyArray<SpaceId>;
  /** A BOARD count of the `tiers` measure: each counted cell's stack height (aligned with `countedSpaces`) — how «4 from 3 cells» explains itself. */
  countedTiers?: ReadonlyArray<number>;
  /** A THRESHOLD count: the BREAKDOWN of the metric at the enactment (no list — the value, the threshold, the step and the sets explain the number). */
  countedMetric?: ResolutionCountMetricModel;
  /** A PRODUCTION count: each resource's own steps at the enactment («steel 2 · titanium 1 · energy 3») — frozen, never re-read. */
  countedByResource?: ReadonlyArray<ResolutionCountByResource>;
  /** A COLONIES count: the tiles the counted cubes stood on at the enactment (a name per cube) — frozen, never re-read from a later table. */
  countedColonies?: ReadonlyArray<ColonyName>;
  /** The formula's sum before the cap (above `amount` exactly when the cap bit). */
  uncapped?: number;
  /** `production` / `stock`: the value before and after. */
  before?: number;
  after?: number;
  /**
   * A SEQUENTIAL amount: the player TOTAL it was divided from, before and
   * after the earlier effect moved it («heat production 4 → 6 → 2 cards»).
   * The server's own reading — never recomputed from today's production.
   */
  total?: {before: number; after: number};
  /**
   * A LEVEL effect (Joint Research's «until you have 6 + influence in hand»):
   * the TARGET the seat was brought up to, beside `total` (the hand before
   * and after) and `amount` (the difference owed). Recorded, never recomputed.
   */
  target?: number;
  /** `cards`: how many actually left the deck (below `amount` only when the deck ran out). */
  drawn?: number;
  /** A card draw handed over as a mandatory intake — the intake's id. */
  intake?: number;
  /** A winner tile, a winner's STEP, or a WORLD move: the global parameter that moved, before and after (equal at the limit). */
  parameter?: {id: ParameterMoveId; before: number; after: number};
  /** `globalParameter` of a WORLD move: nobody was credited with a terraform rating for this move. */
  unrewarded?: boolean;
  /**
   * `globalParameter` of the WINNER's own step (Mohole Contest): the terraform
   * rating the step paid the winner — measured around the engine's call, so a
   * card hook that adds to it is counted honestly. Absent on a world move
   * (which credits nobody) and on a skip.
   */
  tr?: number;
};

export type ParliamentPhaseModel = {
  generation: number;
  final: boolean;
  step: ParliamentPhaseStep;
  winner?: {instance: ResolutionInstanceId; player?: Color | 'neutral'};
  pending?: ParliamentPhasePendingModel;
  /** The effect's outcomes recorded SO FAR (the enactment stage reads them live). */
  outcomes?: ReadonlyArray<ParliamentEnactOutcomeModel>;
  /**
   * The sitting's summary SO FAR — the SAME shape a finished phase leaves in
   * `lastPhase` (and the history keeps), so the live sitting, the closing and
   * a later review read one form. Filled from the first step on.
   */
  summary?: ParliamentPhaseSummaryModel;
  /** A GATE step (`assembly` / `adjourn`): the participants whose answer the phase still waits for. */
  awaiting?: ReadonlyArray<Color>;
};

/**
 * ONE PHYSICAL EVENT OF THE RENEWAL (`SerializedRenewalEvent`, players and
 * delegates named by colour) — the client's renewal beat plays these in this
 * exact order: a loser leaves (its delegates home first, per owner), the
 * discard turns over into a new deck, a revealed card is rejected, a card is
 * dealt into its slot, a party's support becomes votes on it, a slot stays
 * empty, a free delegate enters a lobby.
 */
export type ParliamentRenewalEventModel =
  | {kind: 'leave'; instance: ResolutionInstanceId; resolution: ResolutionId; party: ReduxParty; slot: number; returned: ReadonlyArray<{owner: Color | 'neutral'; count: number}>}
  | {kind: 'reshuffle'; size: number}
  | {kind: 'reject'; instance: ResolutionInstanceId; resolution: ResolutionId; party: ReduxParty; slot: number; reason: 'party-in-area' | 'party-enacted'}
  | {kind: 'deal'; instance: ResolutionInstanceId; resolution: ResolutionId; party: ReduxParty; slot: number; source: 'deck' | 'reshuffled'}
  | {kind: 'support'; party: ReduxParty; instance: ResolutionInstanceId; count: number}
  | {kind: 'empty'; slot: number}
  | {kind: 'lobby'; player: Color};

/**
 * What the LAST completed end-of-generation phase did — a summary the client
 * presents once (keyed by generation) and never reconstructs from the log.
 */
export type ParliamentPhaseSummaryModel = {
  generation: number;
  final: boolean;
  /** The sitting's monotonic number — the client's «played once» key (absent on a save from before the sittings). */
  seq?: number;
  /** The journal group of the whole phase (`political-phase`) — the protocol's key (absent on older saves). */
  correlationId?: number;
  /** `slot` — the voting slot the winner stood in (0 = closest to ENACTED); absent on older saves. */
  winner: {instance: ResolutionInstanceId; resolution: ResolutionId; party: ReduxParty; votes: number; player?: Color | 'neutral'; tieBreak?: 'slot-priority' | 'earlier-delegate'; slot?: number};
  agenda?: {player: Color; from: number; to: number; bonus?: 'tr' | 'card'};
  /** The enacted resolution's effect as it was ACTUALLY applied, step by step (absent on older saves / no effect). */
  outcomes?: ReadonlyArray<ParliamentEnactOutcomeModel>;
  support: ReadonlyArray<{party: ReduxParty; gained: number; total: number; reason: 'absent' | 'lost' | 'lost-with-player-vote'}>;
  enacted: ParliamentEnactedModel;
  discardedEnacted?: ParliamentEnactedModel;
  /** The delegates that left the enacted card at the enactment, per owner — the client's return flights (absent on older saves). */
  returned?: ReadonlyArray<{owner: Color | 'neutral'; count: number}>;
  refreshed: ReadonlyArray<{instance: ResolutionInstanceId; resolution: ResolutionId; party: ReduxParty; neutralVotes: number}>;
  /** The losers the refresh discarded, in their slot order — the renewal beat flies them off the table (absent before the refresh / on older saves). */
  discarded?: ReadonlyArray<{instance: ResolutionInstanceId; resolution: ResolutionId; party: ReduxParty}>;
  lobbyRefilled: ReadonlyArray<Color>;
  /**
   * THE RENEWAL JOURNAL — every physical event of the refresh and the lobby
   * steps in the server's order; the ONLY thing the renewal beat plays.
   * Absent before the refresh, on the final sitting and on older saves (the
   * refreshed table is then shown without a beat).
   */
  renewal?: ReadonlyArray<ParliamentRenewalEventModel>;
};

/**
 * The LAST move of an Agenda marker — a mid-generation quest completion or the
 * political phase's winner step. The client plays it ONCE (`seq` is the key):
 * the marker glides from `from` to `to`, the step's reward follows.
 */
export type ParliamentAdvanceModel = {
  seq: number;
  player: Color;
  from: number;
  to: number;
  bonus?: 'tr' | 'card';
  reason: 'quest' | 'phase';
  generation: number;
};

export type ParliamentModel = {
  slots: ReadonlyArray<ParliamentSlotModel>;
  enacted?: ParliamentEnactedModel;
  rulingParty: ReduxParty;
  chairman?: Color;
  quest?: ParliamentQuestModel;
  popularSupport: Readonly<Record<string, number>>; // keyed by ReduxParty
  players: ReadonlyArray<ParliamentPlayerModel>;
  deckSize: number;
  discardSize: number;
  neutralSupply: number;
  phase?: ParliamentPhaseModel;
  lastPhase?: ParliamentPhaseSummaryModel;
  /** The finished sittings, oldest first (the last 24 — the protocol's source; absent until the first). */
  phaseHistory?: ReadonlyArray<ParliamentPhaseSummaryModel>;
  lastAdvance?: ParliamentAdvanceModel;
  botMode: BotParliamentMode;
  /** Present on the viewer's own model only. */
  viewer?: {
    vote: VoteOptionModel;
    partyActions: ReadonlyArray<PartyActionModel>;
  };
};
