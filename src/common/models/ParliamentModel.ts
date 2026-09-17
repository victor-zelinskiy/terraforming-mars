import {Color} from '../Color';
import {SpaceId} from '../Types';
import {CardName} from '../cards/CardName';
import {CardResource} from '../CardResource';
import {Resource} from '../Resource';
import {ResolutionCountModel} from '../parliament/resolutionCounts';
import {WinnerRewardParameter} from '../parliament/winnerReward';
import {PartyName} from '../turmoil/PartyName';
import {Message} from '../logs/Message';
import {PlayerInputType} from '../input/PlayerInputType';
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
  player: Color;
  step: string;
  /** `effect` — everyone's part · `winner` — the winner's own part (absent on older saves). */
  part?: 'effect' | 'winner';
  /** The scaled effect's id (`InfluenceScaledEffect.id`) when the amount came from influence. */
  effect?: string;
  /** `cardResource` onto a card · `production` · `stock` into the supply · `ocean` / `greenery` the winner's tile · `skipped`. */
  kind: 'cardResource' | 'production' | 'stock' | 'ocean' | 'greenery' | 'skipped';
  resource?: CardResource;
  /** `production` (and its skip): the standard resource whose production the effect raises. */
  production?: Resource;
  /** `stock` (and its skip): the standard resource the effect adds to the supply. */
  stock?: Resource;
  amount?: number;
  card?: CardName;
  space?: SpaceId;
  reason?: string;
  influence?: number;
  /** A counted term (B) at the enactment, and the cards it counted — frozen, never re-read from a later tableau. */
  count?: number;
  counted?: ReadonlyArray<CardName>;
  /** …and what each of those cards contributed (a TAG count: a two-power-tag card is 2). */
  countedUnits?: ReadonlyArray<number>;
  /** The formula's sum before the cap (above `amount` exactly when the cap bit). */
  uncapped?: number;
  /** `production` / `stock`: the value before and after. */
  before?: number;
  after?: number;
  /** A winner tile: the global parameter its own placement moved, before and after (equal at the maximum). */
  parameter?: {id: WinnerRewardParameter; before: number; after: number};
};

export type ParliamentPhaseModel = {
  generation: number;
  final: boolean;
  step: ParliamentPhaseStep;
  winner?: {instance: ResolutionInstanceId; player?: Color | 'neutral'};
  pending?: ParliamentPhasePendingModel;
  /** The effect's outcomes recorded SO FAR (the enactment stage reads them live). */
  outcomes?: ReadonlyArray<ParliamentEnactOutcomeModel>;
};

/**
 * What the LAST completed end-of-generation phase did — a summary the client
 * presents once (keyed by generation) and never reconstructs from the log.
 */
export type ParliamentPhaseSummaryModel = {
  generation: number;
  final: boolean;
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
  lobbyRefilled: ReadonlyArray<Color>;
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
  lastAdvance?: ParliamentAdvanceModel;
  botMode: BotParliamentMode;
  /** Present on the viewer's own model only. */
  viewer?: {
    vote: VoteOptionModel;
    partyActions: ReadonlyArray<PartyActionModel>;
  };
};
