import {PlayerId, SpaceId} from '../../common/Types';
import {PartyName} from '../../common/turmoil/PartyName';
import {CardName} from '../../common/cards/CardName';
import {CardResource} from '../../common/CardResource';
import {BotParliamentMode, ParliamentPhaseStep, QuestDefinition, ResolutionInstanceId} from '../../common/parliament/ParliamentTypes';

/** Bump when the shape changes incompatibly; older saves are refused explicitly. */
export const PARLIAMENT_SAVE_VERSION = 1;

export type SerializedDelegateOwner = PlayerId | 'NEUTRAL';

export type SerializedVote = {
  owner: SerializedDelegateOwner;
  /** Global placement order — the tie-breaker among players (rulebook p.8). */
  seq: number;
};

/** One voting-area slot. Index 0 is the slot closest to ENACTED (wins ties among cards). */
export type SerializedSlot = {
  instance: ResolutionInstanceId;
  votes: Array<SerializedVote>;
};

export type SerializedQuest = {
  definition: QuestDefinition;
  /** 'starter' = the printed generation-1 quest of the empty ENACTED slot. */
  source: 'starter' | string;
  generation: number;
  progress: Record<PlayerId, number>;
  completedBy?: PlayerId;
};

/**
 * WHAT ONE STEP of the enacted resolution's effect ACTUALLY DID for one
 * player — recorded by the step itself at the moment it mutates (or decides
 * to skip), never recomputed later: the amount is the amount paid, not the
 * amount a later influence would give. The client's results scene and the
 * enactment stage read these; a `skipped` outcome names itself (no silent
 * loss — the reason is an English i18n key).
 */
export type SerializedEnactOutcome = {
  player: PlayerId;
  /** The step key that produced it. */
  step: string;
  /** The scaled effect's id (`InfluenceScaledEffect.id`) when the amount came from influence. */
  effect?: string;
  kind: 'cardResource' | 'ocean' | 'skipped';
  resource?: CardResource;
  amount?: number;
  card?: CardName;
  space?: SpaceId;
  /** `skipped`: why nothing happened (English i18n key). */
  reason?: string;
  /** The influence the amount was computed from (a scaled effect). */
  influence?: number;
};

export type SerializedPhaseSummary = {
  generation: number;
  final: boolean;
  winner: {instance: ResolutionInstanceId; votes: number; player?: SerializedDelegateOwner; tieBreak?: 'slot-priority' | 'earlier-delegate'};
  agenda?: {player: PlayerId; from: number; to: number; bonus?: 'tr' | 'card'};
  /** The enacted resolution's effect, step by step, as it was ACTUALLY applied (absent on older saves and on a resolution with no effect). */
  outcomes?: Array<SerializedEnactOutcome>;
  support: Array<{party: PartyName; gained: number; total: number; reason: 'absent' | 'lost' | 'lost-with-player-vote'}>;
  enacted: ResolutionInstanceId;
  discardedEnacted?: ResolutionInstanceId;
  /** The delegates that LEFT the enacted card at the enactment, per owner (absent on a save from before this field). */
  returned?: Array<{owner: SerializedDelegateOwner; count: number}>;
  refreshed: Array<{instance: ResolutionInstanceId; neutralVotes: number}>;
  lobbyRefilled: Array<PlayerId>;
};

/** The last Agenda advance (see `ParliamentAdvanceModel`). */
export type SerializedAdvance = {
  seq: number;
  player: PlayerId;
  from: number;
  to: number;
  bonus?: 'tr' | 'card';
  reason: 'quest' | 'phase';
  generation: number;
};

export type SerializedPhaseProgress = {
  generation: number;
  final: boolean;
  step: ParliamentPhaseStep;
  /** Idempotency keys of every operation already applied in this phase. */
  applied: Array<string>;
  /** The effects step's cursor: which player (generation-order index of the participants) and which step key is pending. */
  effects?: {playerIndex: number; pending?: {player: PlayerId; key: string}};
  /** Free-form resumable state a resolution's multi-step effect keeps between its steps, per player. */
  effectState?: Record<PlayerId, Record<string, unknown>>;
  /** The summary being assembled (copied to `lastPhase` when the phase completes). */
  summary?: SerializedPhaseSummary;
};

/**
 * A political step that already COMMITTED (its irreversible half ran) and
 * still owes a mandatory input. Deferred actions are not serialized, so this
 * is what lets a reload rebuild the prompt instead of losing the step.
 */
export type SerializedPendingAction =
  /** The Reds' recycle: 2 cards were drawn, 2 must be discarded. */
  | {kind: 'reds-recycle'; player: PlayerId; countAction: boolean}
  /** A quest was completed but the new chairman still has to pick which own resolution gives up a delegate. */
  | {kind: 'chairman-seat'; player: PlayerId};

export type SerializedParliament = {
  version: number;
  slots: Array<SerializedSlot>;
  enacted?: ResolutionInstanceId;
  quest?: SerializedQuest;
  chairman?: PlayerId;
  /** Players whose free delegate is waiting in the lobby. */
  lobby: Array<PlayerId>;
  voteSeq: number;
  popularSupport: Partial<Record<PartyName, number>>;
  agenda: Record<PlayerId, number>;
  influenceBonus: Record<PlayerId, number>;
  grantedEffects: Record<PlayerId, Array<{party: PartyName; source: string}>>;
  partyActionUses: Record<PlayerId, Partial<Record<PartyName, number>>>;
  resolutionActionUses: Record<PlayerId, number>;
  deck: Array<ResolutionInstanceId>;
  discard: Array<ResolutionInstanceId>;
  phase?: SerializedPhaseProgress;
  lastPhase?: SerializedPhaseSummary;
  lastAdvance?: SerializedAdvance;
  pendingActions?: Array<SerializedPendingAction>;
  botMode: BotParliamentMode;
};
