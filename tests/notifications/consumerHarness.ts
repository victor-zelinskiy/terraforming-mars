import {TestPlayer} from '../TestPlayer';
import {Color} from '../../src/common/Color';
import {PlayerViewModel} from '../../src/common/models/PlayerModel';
import {LogMessage} from '../../src/common/logs/LogMessage';
import {GameEvent} from '../../src/common/events/GameEvent';
import {IGame} from '../../src/server/IGame';
import {Server} from '../../src/server/models/ServerModel';
import {GameLogs} from '../../src/server/routes/GameLogs';
import {applyNotificationDiff, resetNotificationIngest} from '../../src/client/components/notifications/notificationIngest';
import {notificationState, resetNotifications} from '../../src/client/components/notifications/notificationState';
import {NotificationModel} from '../../src/client/components/notifications/notificationTypes';

/**
 * The shared PRODUCER → CONSUMER harness: real `Server.getPlayerModel`
 * snapshots + real route payloads, fed to the REAL ingest module
 * (`applyNotificationDiff` — the code NotificationLayer runs). Nothing in the
 * delivery path is mocked or re-implemented; the only liberty a spec may take
 * is PAIRING a view with streams from a different captured moment, because
 * that pairing is the production reality (the poller's stream fetch races the
 * transport's view apply).
 */

/** The journal-events route's exclusion filter, replicated exactly (the same
 *  mirror crossPlayerDeliveryAudit uses). */
const ANALYTICS_ONLY_TAGS = new Set(['resource-payment', 'payment-bonus', 'colony-track', 'trade-discount', 'global-parameter', 'reveal']);

export function eventsPayload(game: IGame, generation: number): Array<GameEvent> {
  return game.events.events.filter((e) =>
    e.generation === generation &&
    !(e.tags ?? []).some((t) => ANALYTICS_ONLY_TAGS.has(t)));
}

/** The REAL logs route (per-viewer redaction included). */
export function logsPayload(game: IGame, viewer: TestPlayer, generation: number): Array<LogMessage> {
  return new GameLogs().getLogsForGameView(viewer.id, game, String(generation));
}

export type ConsumerSnapshot = {
  view: PlayerViewModel;
  messages: Array<LogMessage>;
  events: Array<GameEvent>;
};

/** One captured client moment: the serialized player view + the two streams,
 *  all taken from the same server state (what a fetch at that instant returns). */
export function consumerSnapshot(game: IGame, viewer: TestPlayer): ConsumerSnapshot {
  const view = Server.getPlayerModel(viewer);
  const generation = view.game.generation;
  return {
    view,
    messages: logsPayload(game, viewer, generation),
    events: eventsPayload(game, generation),
  };
}

/** Feed one (view, streams) pair to the REAL ingest — exactly the call
 *  NotificationLayer.applyDiff makes. */
export function ingest(view: PlayerViewModel, streams: {messages: ReadonlyArray<LogMessage>; events: ReadonlyArray<GameEvent>}, now: number, journalOpen = false): void {
  applyNotificationDiff({
    messages: streams.messages,
    events: streams.events,
    generation: view.game.generation,
    undoCount: view.game.undoCount,
    openEventCorrelations: view.game.openEventCorrelations,
    viewerColor: view.thisPlayer.color,
    journalOpen,
    now,
  });
}

/** Everything the consumer currently holds for presentation (visible + queued). */
export function presented(): Array<NotificationModel> {
  return [...notificationState.transient, ...notificationState.queue];
}

export function freshConsumer(): void {
  resetNotifications();
  resetNotificationIngest();
}

/**
 * Run one viewer's WHOLE consumer session around a door: silent seed on the
 * pre-door state, then the settled post-door state — the clean two-pass
 * sequence. Returns what that viewer's console presents. (Race/boundary
 * pairings are exercised separately in consumerDeliverySequences.)
 */
export function consumeDoor(game: IGame, viewer: TestPlayer, pre: ConsumerSnapshot, now = 1_000): Array<NotificationModel> {
  freshConsumer();
  ingest(pre.view, pre, now);
  const post = consumerSnapshot(game, viewer);
  ingest(post.view, post, now + 1_000);
  return presented();
}

export {notificationState};
export type {Color};
