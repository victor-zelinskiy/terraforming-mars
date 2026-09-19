import {PlayerId, SpaceId} from '../../common/Types';
import {PartyName} from '../../common/turmoil/PartyName';
import {CardName} from '../../common/cards/CardName';
import {CardResource} from '../../common/CardResource';
import {Resource} from '../../common/Resource';
import {BotParliamentMode, ParliamentPhaseStep, QuestDefinition, ResolutionInstanceId} from '../../common/parliament/ParliamentTypes';
import {WinnerRewardParameter} from '../../common/parliament/winnerReward';
import type {EventTrigger} from '../../common/events/GameEvent';

/** Bump when the shape changes incompatibly; older saves are refused explicitly. */
export const PARLIAMENT_SAVE_VERSION = 1;

/** How many finished sittings the save keeps (`phaseHistory`) — the oldest leave past it, like `automa.turnHistory`. */
export const PARLIAMENT_PHASE_HISTORY_CAP = 24;

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
  /**
   * WHICH PART of the resolution produced it — the effect every participant
   * receives, or the winner's own part — stamped by the driver from the list
   * the step belongs to (absent on older saves).
   */
  part?: EnactOutcomePart;
  /** The scaled effect's id (`InfluenceScaledEffect.id`) when the amount came from influence. */
  effect?: string;
  /**
   * `cardResource` resources onto a card · `production` a production increase ·
   * `stock` standard resources into the player's supply · `cards` project
   * cards drawn for the player · `ocean` / `greenery` the winner's tile ·
   * `skipped` nothing happened (see `reason`) · `reaction` the RULING PARTY's
   * answer to this step's own change (see `party`).
   */
  kind: 'cardResource' | 'production' | 'stock' | 'cards' | 'ocean' | 'greenery' | 'skipped' | 'reaction';
  /**
   * `reaction`: the answering party and what it answered — DERIVED by the
   * driver from the recorder's own events inside the step (a `party`-sourced
   * production / supply change under the step's scope), never re-stated by
   * the resolution. Shares the `step` of the change it answered; `production`
   * / `stock` name the resource paid, `amount` the sum inside the step,
   * `before` / `after` the value around it.
   */
  party?: PartyName;
  trigger?: EventTrigger;
  resource?: CardResource;
  /** `production` (and its skip): the standard resource whose production the effect raises. */
  production?: Resource;
  /** `stock` (and its skip): the standard resource the effect adds to the supply. */
  stock?: Resource;
  amount?: number;
  card?: CardName;
  space?: SpaceId;
  /** `skipped`: why nothing happened (English i18n key). */
  reason?: string;
  /** The influence the amount was computed from (a scaled effect). */
  influence?: number;
  /** A scaled effect with a COUNT term: the counted items at the enactment (B)… */
  count?: number;
  /** …and which cards they were — frozen here, never re-read from a later tableau. */
  counted?: Array<CardName>;
  /**
   * …and what each of them contributed (aligned with `counted`) — a TAG count
   * only, where one card can be worth several (a two-power-tag card is 2).
   * Absent on a count where every card is worth exactly 1, and on older saves.
   */
  countedUnits?: Array<number>;
  /** The formula's sum before the cap (above `amount` exactly when the cap bit). */
  uncapped?: number;
  /** `production` / `stock`: the value before and after the change. */
  before?: number;
  after?: number;
  /**
   * A SEQUENTIAL amount (`InfluenceScaledEffect.sequel`): the player TOTAL the
   * amount was divided from, as the server read it BEFORE and AFTER the
   * earlier effect moved it — «heat production 4 → 6 → 2 cards». Frozen here:
   * a later production change never re-divides a payout already made.
   */
  total?: {before: number; after: number};
  /**
   * `cards`: how many actually left the deck. Below `amount` only when the
   * deck (and its reshuffled discard) could not supply the whole draw — the
   * difference is what the player did NOT get, and it is never silent.
   */
  drawn?: number;
  /**
   * A CARD DRAW handed over as a mandatory intake: the intake's id, so a
   * reload can tell «already drawn, still being taken» from «not drawn yet».
   */
  intake?: number;
  /**
   * A winner TILE (`ocean` / `greenery`): the global parameter its own
   * placement moved, read before and after — equal when the parameter was
   * already at its maximum (a greenery still lands and pays its own TR).
   */
  parameter?: {id: WinnerRewardParameter; before: number; after: number};
};

/** `effect` — everyone's part (`immediateSteps`); `winner` — the winner's (`winnerSteps`). */
export type EnactOutcomePart = 'effect' | 'winner';

export type SerializedPhaseSummary = {
  generation: number;
  final: boolean;
  /** The sitting's monotonic number (`Parliament.phaseSeq`) — the client's «played once» key; absent on a save from before the sittings. */
  seq?: number;
  /** The journal group of the whole phase (`political-phase` root) — every line of the sitting, a gate's answer after a reload included, carries it; absent on older saves. */
  correlationId?: number;
  /** `slot` — the voting slot (0 = closest to ENACTED) the winner stood in; absent on older saves. */
  winner: {instance: ResolutionInstanceId; votes: number; player?: SerializedDelegateOwner; tieBreak?: 'slot-priority' | 'earlier-delegate'; slot?: number};
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
  /** Idempotency keys of every PHASE-WIDE operation already applied (support, enactment, refresh, lobby). */
  applied: Array<string>;
  /**
   * …and of every PER-SEAT operation (a winner's Agenda step, one step of one
   * player's effect), KEYED BY THE PLAYER. A record keyed by player id is
   * remapped structurally when a save is cloned or a fixture booted with fresh
   * ids (`Cloner.replacePlayerIds`); a key STRING embedding the id was not —
   * a game cloned mid-phase re-paid every seat's applied effect. Absent on
   * older saves, whose per-seat keys still read from `applied`.
   */
  appliedBySeat?: Record<PlayerId, Array<string>>;
  /**
   * The effects step's cursor: which player (generation-order index of the
   * participants) and which step key is pending. `scan` is the REACTION
   * window of the step last run — the ruling party's answers are read off the
   * recorder's events from `sinceEvent` (an event id, stable across a reload)
   * and folded into the step's outcome record; the window advances as it is
   * read, so nothing is counted twice.
   */
  effects?: {playerIndex: number; pending?: {player: PlayerId; key: string}; scan?: {player: PlayerId; key: string; part: EnactOutcomePart; sinceEvent: number}};
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
  /** Sittings numbered so far (`SerializedPhaseSummary.seq` is monotonic across the game); absent on older saves = 0. */
  phaseSeq?: number;
  /** The finished sittings, oldest first, at most `PARLIAMENT_PHASE_HISTORY_CAP`; absent on older saves and until the first. */
  phaseHistory?: Array<SerializedPhaseSummary>;
  lastAdvance?: SerializedAdvance;
  pendingActions?: Array<SerializedPendingAction>;
  botMode: BotParliamentMode;
};
