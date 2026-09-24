import {PlayerId, SpaceId} from '../../common/Types';
import {Color} from '../../common/Color';
import {PartyName} from '../../common/turmoil/PartyName';
import {CardName} from '../../common/cards/CardName';
import {Tag} from '../../common/cards/Tag';
import {CardResource} from '../../common/CardResource';
import {ColonyName} from '../../common/colonies/ColonyName';
import {Resource} from '../../common/Resource';
import {BotParliamentMode, ParliamentPhaseStep, QuestDefinition, ResolutionInstanceId} from '../../common/parliament/ParliamentTypes';
import {ParameterMoveId} from '../../common/parliament/parameterMove';
import {ResolutionCountByResource, ResolutionCountMetricModel} from '../../common/parliament/resolutionCounts';
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
  /**
   * THE SEAT the record belongs to — ABSENT on a WORLD record (a `world` part):
   * a move the enactment makes for the whole table (Gas Export lowers oxygen
   * and raises Venus) belongs to no player and is never attributed to one, so
   * every reading that filters by seat simply does not pick it up, and every
   * viewer reads the same line.
   */
  player?: PlayerId;
  /** The step key that produced it. */
  step: string;
  /**
   * WHICH PART of the resolution produced it — the effect every participant
   * receives, the WORLD's own part, or the winner's — stamped by the driver
   * from the list the step belongs to (absent on older saves).
   */
  part?: EnactOutcomePart;
  /** The scaled effect's id (`InfluenceScaledEffect.id`) when the amount came from influence. */
  effect?: string;
  /**
   * `cardResource` resources onto a card · `production` a production increase ·
   * `stock` standard resources into the player's supply · `cards` project
   * cards drawn for the player · `discard` a card the player threw away (the
   * second half of Pluto's colony bonus — see `colony`) · `colonyBonus` a
   * colony bonus the chip language does not speak, paid through its own
   * counter (a discount, a loss, a science tag — see `description`) ·
   * `ocean` / `greenery` the winner's tile · `colony` the winner's colony built
   * for free (Colony Contest — `colony` names the tile) · `globalParameter` a
   * WORLD move of a global parameter (Gas Export — see `parameter`, and
   * `amount` = the steps actually made, negative for a lowering) · `skipped`
   * nothing happened (see `reason`) · `reaction` the RULING PARTY's answer to
   * this step's own change (see `party`).
   */
  kind: 'cardResource' | 'production' | 'stock' | 'cards' | 'discard' | 'colonyBonus' | 'ocean' | 'greenery' | 'colony' | 'globalParameter' | 'skipped' | 'reaction';
  /**
   * THE COLONY whose printed bonus this record pays (Colonial Affairs: «gain
   * all your colony bonuses k times») — the ledger row the record belongs to
   * on every surface; `multiplier` is how many times that bonus was paid in
   * this one record (the resolution's k, the scaled effect's own amount).
   */
  colony?: ColonyName;
  multiplier?: number;
  /** `colonyBonus`: the tile's printed description of the bonus (the colony's own English key). */
  description?: string;
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
  /**
   * `stock` (and its skip): the standard resource the effect adds to the
   * supply — or TAKES from it: a LEVY (the Budgets' «lose 10 M€») is a `stock`
   * record with a NEGATIVE `amount` (what actually left), never a skip.
   */
  stock?: Resource;
  amount?: number;
  /**
   * A LEVY: what was OWED (the printed sum), beside `amount` (what was taken,
   * negative). Above `−amount` exactly when the seat could not pay it all —
   * the shortfall is then named in `reason` on the paying record itself; a
   * seat that held nothing records a `skipped` with `owed` and `amount: 0`.
   */
  owed?: number;
  /** `cardResource`: the ONE card the whole amount landed on (absent when it was spread over several — see `cards`). */
  card?: CardName;
  /**
   * `cardResource`: WHERE the units landed, card by card — the whole list,
   * every consumer's reading (the stage, the results, the journal); a single
   * recipient is the list of one. Absent on older saves (then `card`).
   */
  cards?: Array<{card: CardName; amount: number}>;
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
  /**
   * A count over SEVERAL tags (Cloud Development's Venus + Jovian): each
   * tag's own total at the enactment, in the term's order — the breakdown
   * the reading prints beside the sum. Absent on a single-tag count.
   */
  countedByTag?: Array<{tag: Tag; count: number}>;
  /**
   * A BOARD count (Colonization Funding's space cities): the CELLS counted at
   * the enactment — a tile has no card, so `counted` is empty and this list
   * explains the number. Frozen here, never re-read from a later board.
   */
  countedSpaces?: Array<SpaceId>;
  /**
   * A THRESHOLD count (Generous Funding's sets of 5 TR over 15): the
   * BREAKDOWN of the metric at the enactment — there is no list, so the value,
   * the threshold, the step and the sets explain the number. Frozen here,
   * never re-read from a later rating.
   */
  countedMetric?: ResolutionCountMetricModel;
  /**
   * A PRODUCTION count (Industrialist Budget's steel + titanium + energy
   * steps): each resource's own steps at the enactment, in the term's order —
   * the breakdown the reading prints beside the sum. Frozen here, never
   * re-read from a later production.
   */
  countedByResource?: Array<ResolutionCountByResource>;
  /**
   * A COLONIES count (Jovian Tax Rights's «each colony you have»): the tiles
   * the counted cubes stood on at the enactment — a name per cube, in the
   * table's order. `counted` is empty and this list explains the number.
   * Frozen here, never re-read from a later colony table.
   */
  countedColonies?: Array<ColonyName>;
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
   * A LEVEL effect (Joint Research's «draw until you have 6 + influence in
   * hand»): the TARGET the formula brought the seat up to, beside `total`
   * (the hand before and after) and `amount` (the difference owed). Frozen
   * here: a reading never recomputes it from a later influence.
   */
  target?: number;
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
   * A winner TILE (`ocean` / `greenery`) or a WORLD move (`globalParameter`):
   * the global parameter that moved, read before and after — equal when the
   * parameter was already at the limit (a greenery still lands and pays its
   * own TR; a world move that could not happen names itself in `reason`).
   */
  parameter?: {id: ParameterMoveId; before: number; after: number};
  /**
   * `globalParameter`: NOBODY was credited with a terraform rating for this
   * move (the law's own «no one gets the TR for this») — recorded so the
   * reading never has to re-derive a rule from the card's text.
   */
  unrewarded?: boolean;
};

/**
 * `effect` — everyone's part (`immediateSteps`) · `world` — the part the
 * enactment does to the TABLE, once, for nobody (`worldSteps`) · `winner` —
 * the winner's (`winnerSteps`).
 */
export type EnactOutcomePart = 'effect' | 'world' | 'winner';

/**
 * ONE PHYSICAL EVENT OF THE VOTING AREA'S RENEWAL (rulebook p.11–12; spec
 * §1.3 step 5), in the order the server PRODUCED it. The three flat lists
 * (`discarded` / `refreshed` / `lobbyRefilled`) cannot say in which order the
 * losers left, whether the discard was reshuffled mid-deal, which revealed
 * cards were rejected, nor whose delegates came home off a loser — and the
 * client can only play honestly what the server wrote down. Every entry is
 * a card that moved, a pile that turned over, a cube that went somewhere:
 *  · `leave`     — a loser leaves its slot for the discard; its delegates
 *                  go home per owner (players → their reserve, neutral → the
 *                  supply) BEFORE the card goes (the returns are derived, so
 *                  the record is what lets the client fly them);
 *  · `reshuffle` — the deck was empty: the discard (`size` cards) became the
 *                  deck. It can happen mid-deal, and a card that left one
 *                  entry earlier can be dealt straight back after it;
 *  · `reject`    — a card was revealed for `slot` and does not fit (its
 *                  party is already in the area / is the enacted party): it
 *                  goes to the discard and the next is drawn;
 *  · `deal`      — a card lands in `slot`, off the deck as it was or off the
 *                  reshuffled one;
 *  · `support`   — the party's whole popular support becomes `count` neutral
 *                  votes on the card just dealt;
 *  · `empty`     — nothing of another party exists anywhere: `slot` stays empty;
 *  · `lobby`     — the lobby step put a free delegate into `player`'s lobby.
 */
export type SerializedRenewalEvent =
  | {kind: 'leave'; instance: ResolutionInstanceId; slot: number; returned: Array<{owner: SerializedDelegateOwner; count: number}>}
  | {kind: 'reshuffle'; size: number}
  | {kind: 'reject'; instance: ResolutionInstanceId; slot: number; reason: 'party-in-area' | 'party-enacted'}
  | {kind: 'deal'; instance: ResolutionInstanceId; slot: number; source: 'deck' | 'reshuffled'}
  | {kind: 'support'; party: PartyName; instance: ResolutionInstanceId; count: number}
  | {kind: 'empty'; slot: number}
  | {kind: 'lobby'; player: PlayerId};

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
  /** The losers the refresh discarded, in their slot order (absent on a save from before this field, and before the refresh). */
  discarded?: Array<ResolutionInstanceId>;
  lobbyRefilled: Array<PlayerId>;
  /**
   * THE RENEWAL JOURNAL — every physical event of the refresh and the lobby
   * steps, in the server's order (`SerializedRenewalEvent`). The client's
   * renewal beat plays this and nothing else; the three lists above are kept
   * as derived summaries. Absent before the refresh, on the final sitting
   * (nothing is renewed) and on a save from before this field (the client
   * then shows the refreshed table without a beat).
   */
  renewal?: Array<SerializedRenewalEvent>;
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
  /** …and the same for the enactment's WORLD steps, which belong to no seat (`worldSteps`). */
  worldState?: Record<string, unknown>;
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
  /**
   * A quest was completed but the new chairman still has to pick which own
   * resolution gives up a delegate. `previous` is the player whose delegate
   * already LEFT the seat — carried here rather than in memory, because the
   * pick is routinely answered after a reload and it is what tells the other
   * players' notification apart from the one the previous holder gets.
   */
  | {kind: 'chairman-seat'; player: PlayerId; previous?: Color}
  /**
   * THE CHAIRMAN QUEST WAS COMPLETED and the player has NOT answered its gate
   * yet — so nothing of it is applied: no seat, no Agenda step, no TR, no
   * card. Unlike its two siblings this record stands BEFORE the irreversible
   * half, which is the whole point of it: the reward must not arrive while the
   * player is looking at the board (the presentation of the step lives in the
   * Parliament section, and a step played with the section off screen plays
   * into nothing). Deferred actions are not serialized, so this is also what
   * lets a reload re-raise the gate instead of losing the reward.
   */
  | {kind: 'chairman-quest'; player: PlayerId};

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
