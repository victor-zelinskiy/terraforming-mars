/**
 * Pure poll-interval policy (Phase 6). No Vue / DOM / timers here so it is
 * unit-testable under the server runner and reusable by a future Electron
 * client. realtimeService adapts the live reactive state onto these functions.
 *
 * The rule: only stretch the primary poll interval when the WebSocket is STRICTLY
 * healthy AND poll reduction is enabled. Any doubt -> the safe interval, so
 * polling always remains a correct fallback and the UI never silently goes stale.
 */

export interface RealtimeHealthSnapshot {
  status: string;
  helloAcked: boolean;
  subscribed: boolean;
  lastPongAt: number | undefined;
  lastConnectedAt: number | undefined;
}

/** No heartbeat for this long -> the socket is considered stale / a zombie. */
export const STALE_PONG_MS = 60_000;
/** The stretched "safety-net" poll interval used while WS is healthy. */
export const LONG_POLL_MS = 20_000;

/**
 * Strict health: connected, handshake done, subscribed to the game, and the
 * heartbeat is fresh (a recent PONG, or still inside the post-connect grace
 * before the first ping). Anything else — connecting, reconnecting, error,
 * unsubscribed, stale — is unhealthy.
 */
export function isRealtimeHealthy(s: RealtimeHealthSnapshot, now: number): boolean {
  if (s.status !== 'connected' || !s.helloAcked || !s.subscribed) {
    return false;
  }
  const ref = s.lastPongAt ?? s.lastConnectedAt;
  if (ref === undefined) {
    return false;
  }
  return now - ref < STALE_PONG_MS;
}

/** Long interval only when healthy AND reduction is enabled; else the safe one. */
export function pollIntervalMs(healthy: boolean, reductionEnabled: boolean, safeMs: number): number {
  return healthy && reductionEnabled ? Math.max(safeMs, LONG_POLL_MS) : safeMs;
}

/** True when the heartbeat has been silent past the stale threshold. */
export function isPongStale(lastPongAt: number | undefined, lastConnectedAt: number | undefined, now: number): boolean {
  const ref = lastPongAt ?? lastConnectedAt;
  if (ref === undefined) {
    return false;
  }
  return now - ref > STALE_PONG_MS;
}
