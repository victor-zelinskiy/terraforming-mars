import {CardName} from '../cards/CardName';
import {Color} from '../Color';
import {Resource} from '../Resource';
import {Tag} from '../cards/Tag';
import {TileType} from '../TileType';
import {SpaceId} from '../Types';
import {LogMessage} from '../logs/LogMessage';
import {BonusCardId, TrackAction} from './AutomaTypes';

/**
 * The ordered, typed script of ONE MarsBot turn — written authoritatively by
 * the server while the turn resolves (synchronously), then exposed on
 * `MarsBotModel.lastTurn` so the client can replay it with its own pacing
 * (the "turn theater"). The client NEVER re-derives bot rules from this; it
 * only presents what already happened.
 *
 * Privacy: every step carries exclusively OPEN information — the revealed
 * card, track movements, and the public log lines of the turn. Face-down deck
 * contents never appear here.
 */

/**
 * Why MarsBot took a Failed Action. Each maps to its own full log template so
 * the journal (and the theater) always explain the cause — never a vague
 * "failed".
 */
export type FailedActionReason =
  | 'no-tags'
  | 'track-maxed'
  | 'venus-maxed'
  | 'temperature-maxed'
  | 'oceans-complete'
  | 'no-tile-space'
  | 'milestones-claimed'
  | 'no-milestone-criteria'
  | 'awards-funded'
  | 'not-ahead-any-award';

export type MarsBotRevealedCard =
  | {kind: 'project', name: CardName}
  | {kind: 'bonus', id: BonusCardId};

/**
 * WHY a step happened — the cause anchor the client groups a turn's steps into
 * (Phase B). The server stamps it authoritatively as the turn resolves, so the
 * review builds cause → effect chains from DATA, not from step ORDER
 * (the Phase-A fallback, kept for turns recorded before this field existed):
 *  - `tag`   the i-th printed tag of the PLAYED project card (0-based);
 *  - `bonus` the bonus card's own effect;
 *  - `colony` a colony trade (Shipping Lines);
 *  - `failed` the failed-action compensation;
 *  - `delta` the Hydronetwork (Delta Project) advance.
 */
export type MarsBotStepCause =
  | {kind: 'tag', index: number}
  | {kind: 'bonus'}
  /** A chained fallback bonus card's OWN effect (Corporate Competition draws
   *  another card) — the review nests it under the parent as ONE flow. */
  | {kind: 'secondary-bonus'}
  | {kind: 'colony'}
  | {kind: 'failed'}
  | {kind: 'delta'};

/**
 * The SEMANTIC role of a public log line captured during the turn — stamped by
 * the server (AutomaTurnLog) from the EMITTING template, so the client review
 * classifies logs from DATA, never by re-matching the message template on the
 * client (a translatable string i18n may rewrite in place):
 *  - `tie-flip` / `colony-pick-flip` — a random card FLIP for a placement tie /
 *    a colony pick (internal bookkeeping the review filters out, and tells apart
 *    from a genuine reveal);
 *  - `resource-loss` — a "${0} lost ${1} ${2}" stock deduction (labelled the
 *    "Trade cost" when it is the bot's own loss inside a colony-trade chain).
 */
export type MarsBotLogRole = 'tie-flip' | 'colony-pick-flip' | 'resource-loss';

/** What became of a bonus card THIS turn (Phase B — resolved, not the printed rule). */
export type MarsBotBonusFate = 'discarded' | 'destroyed' | 'recurring';

/**
 * The RESOLVED outcome of the played bonus card this turn:
 *  - `fate` — where the card went (destroyed / discarded / recurring);
 *  - `branch` — the ONE branch a multi-branch card actually took (an English
 *    i18n template + params), so the review shows «сработавшая ветка» instead
 *    of the card's full if/else rule text;
 *  - `secondaryCard` — a chained fallback bonus card this one drew (Corporate
 *    Competition), so the review presents parent → secondary as ONE flow.
 */
export type MarsBotBonusResolution = {
  fate: MarsBotBonusFate;
  branch?: {key: string, params?: ReadonlyArray<string>};
  secondaryCard?: BonusCardId;
};

/**
 * One concrete BEFORE → AFTER change the turn caused for one participant.
 * `resource` is a standard resource; `scope` says whether the STOCK or the
 * PRODUCTION moved; 'tr' is the terraform rating. Derived on the server from
 * per-player snapshots taken around the whole turn, so ANY mechanic (bonus
 * cards, tile triggers, failed-action money) is covered without per-site
 * instrumentation — and it names the TARGET explicitly, which is exactly what
 * a future multi-human game needs.
 */
export type MarsBotImpactChange = {
  resource: Resource | 'tr';
  scope: 'stock' | 'production';
  before: number;
  after: number;
};

export type MarsBotImpact = {
  target: Color;
  targetIsBot: boolean;
  changes: ReadonlyArray<MarsBotImpactChange>;
};

/**
 * What a direct attack actually achieved:
 *  - 'hit' — resources left the target's stock (before/after are the proof);
 *  - 'nothing-to-lose' — the target simply had nothing of the kind;
 *  - 'protected' — an effect (Protected Habitats) blocked the removal;
 *  - 'target-chooses' — the loss resolves via the TARGET's own follow-up pick
 *    (Invasive Species' highest-scoring cube), so no amount is known yet.
 */
export type MarsBotAttackOutcome = 'hit' | 'nothing-to-lose' | 'protected' | 'target-chooses';

/**
 * A direct attack on one participant, recorded AT THE ATTACK SITE — the
 * resolver knows the intent, so the theater names WHO was hit and what came
 * of it even when NOTHING was actually lost (no plants to take / plants
 * protected), which the end-of-turn snapshot diff cannot see (a no-op leaves
 * no diff). `resource` is a standard resource, or 'cube' — the composite
 * "highest-scoring animal/microbe resource cube" demand of Invasive Species.
 */
export type MarsBotAttack = {
  target: Color;
  resource: Resource | 'cube';
  /** The printed demand ("loses up to N"). */
  demanded: number;
  /** What actually left the target's stock right now (0 when blocked / deferred). */
  removed: number;
  /** Stock before/after — omitted when the loss resolves later ('target-chooses'). */
  before?: number;
  after?: number;
  outcome: MarsBotAttackOutcome;
};

export type MarsBotTurnStep =
  /** Empty action deck — MarsBot passes for the round. */
  | {kind: 'pass', message?: LogMessage}
  /**
   * The action-deck card flipped this turn (open from this moment on).
   * `resolution` (Phase B, bonus cards only) carries the card's resolved fate.
   */
  | {kind: 'reveal', card: MarsBotRevealedCard, message?: LogMessage, resolution?: MarsBotBonusResolution}
  /**
   * One printed tag being processed (left to right). `trackIndex` is the
   * track it advances — resolved for Wild; undefined = an unused-expansion
   * icon that is ignored.
   */
  | {kind: 'tag', tag: Tag, trackIndex?: number, cause?: MarsBotStepCause}
  /**
   * A tracker moved `from` → `to`; `action` is the landed-on icon, if any.
   * `depth` (Phase B) is the cascade depth — 0 for the tag's direct advance,
   * deeper for a track action that advances again — so the review nests the
   * chain reaction from DATA instead of guessing.
   */
  | {kind: 'advance', trackIndex: number, from: number, to: number, action?: TrackAction, cause?: MarsBotStepCause, depth?: number}
  /** A Failed Action: the cause + the M€ gained (5, or 3 on Easy). */
  | {kind: 'failed', reason: FailedActionReason, mc: number, message?: LogMessage}
  /**
   * A direct attack on a participant — always recorded, even for a zero
   * outcome, so the theater never leaves "did I lose anything?" unanswered.
   */
  | {kind: 'attack', attack: MarsBotAttack, message?: LogMessage, cause?: MarsBotStepCause}
  /** Any other public log line emitted during the turn, in order. `role` is the
   *  server-stamped semantic (flip noise / a resource loss) the review reads. */
  | {kind: 'log', message: LogMessage, cause?: MarsBotStepCause, role?: MarsBotLogRole}
  /**
   * The turn's NET effect on one participant — every stock/production/TR
   * value that changed, as explicit before → after pairs. Appended at the end
   * of the script (the "turn results" section), one step per affected player.
   */
  | {kind: 'impact', impact: MarsBotImpact};

/** A tile this ONE turn placed on the Mars board (snapshot-diffed). */
export type MarsBotTurnTile = {
  spaceId: SpaceId;
  tileType: TileType;
  color?: Color;
};

export type MarsBotParamChange = {before: number, after: number};

/**
 * The turn's BOARD-VISIBLE footprint, snapshot-diffed around the whole turn
 * (like the per-player impacts): the tiles it placed + the global-parameter
 * changes it caused. This is what lets the client STAGE visual commits — the
 * presented board/HUD advances turn-by-turn in lockstep with the turn's
 * compact notification instead of jumping to the batch total.
 */
export type MarsBotTurnVisual = {
  tiles?: ReadonlyArray<MarsBotTurnTile>;
  temperature?: MarsBotParamChange;
  oxygenLevel?: MarsBotParamChange;
  oceans?: MarsBotParamChange;
  venusScaleLevel?: MarsBotParamChange;
};

/**
 * The stable per-turn key shared by BOTH sides: the client uses it to dedup /
 * archive turn notifications, the server uses it to pace the NEXT bot turn on
 * a client "I've seen this turn" ack. ONE definition so the two can never
 * drift. Unique per game session: `<botColor>:<generation>:<turn id>`.
 */
export function botTurnKey(botColor: string, turn: {generation: number, id: number}): string {
  return `${botColor}:${turn.generation}:${turn.id}`;
}

export type MarsBotTurn = {
  /** Monotonic per-game turn number — the client's replay/dedup key. */
  id: number;
  generation: number;
  /**
   * The journal group id of this turn (the whole turn resolves inside ONE
   * `events.beginAction` scope, category 'automa-turn') — the shared key that
   * links the compact turn notification, the theater replay and the journal
   * entry to the SAME script. Absent on turns recorded before this field.
   */
  correlationId?: number;
  /** The board-visible footprint of the turn (absent = nothing visible moved). */
  visual?: MarsBotTurnVisual;
  steps: ReadonlyArray<MarsBotTurnStep>;
};
