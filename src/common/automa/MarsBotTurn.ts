import {CardName} from '../cards/CardName';
import {Tag} from '../cards/Tag';
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

export type MarsBotTurnStep =
  /** Empty action deck — MarsBot passes for the round. */
  | {kind: 'pass', message?: LogMessage}
  /** The action-deck card flipped this turn (open from this moment on). */
  | {kind: 'reveal', card: MarsBotRevealedCard, message?: LogMessage}
  /**
   * One printed tag being processed (left to right). `trackIndex` is the
   * track it advances — resolved for Wild; undefined = an unused-expansion
   * icon that is ignored.
   */
  | {kind: 'tag', tag: Tag, trackIndex?: number}
  /** A tracker moved `from` → `to`; `action` is the landed-on icon, if any. */
  | {kind: 'advance', trackIndex: number, from: number, to: number, action?: TrackAction}
  /** A Failed Action: the cause + the M€ gained (5, or 3 on Easy). */
  | {kind: 'failed', reason: FailedActionReason, mc: number, message?: LogMessage}
  /** Any other public log line emitted during the turn, in order. */
  | {kind: 'log', message: LogMessage};

export type MarsBotTurn = {
  /** Monotonic per-game turn number — the client's replay/dedup key. */
  id: number;
  generation: number;
  steps: ReadonlyArray<MarsBotTurnStep>;
};
