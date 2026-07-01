import {isRealtimeDebug} from './realtimeConfig';

/**
 * Realtime -> refresh coordinator (Phase 4).
 *
 * The transport (realtimeService) never touches the UI or the refresh logic
 * directly. On a GAME_STATE_INVALIDATED it calls `notifyGameInvalidated()`, and
 * this coordinator (after coalescing) fires a "wake". WaitingFor.vue registers a
 * wake listener that calls its EXISTING guarded `waitForUpdate(true)` — the same
 * path a visibility/focus wake already uses. So the WS event merely REPLACES the
 * poll timer as the trigger; every guard (viewerHasPrompt, preserveOpenOverlay,
 * animation holds, the playerkey rules) is preserved. We never call updatePlayer
 * directly and never bump playerkey from here.
 *
 * Coalescing / storm guard: invalidations can arrive in bursts (a single turn
 * can emit several saves). We collapse a burst into ONE wake and cap the wake
 * rate, so overlapping full refreshes never pile up. The natural
 * gameAge/undoCount comparison in /api/waitingfor dedups the rest: a wake that
 * finds nothing new returns WAIT and fetches no full model.
 *
 * Deliberately free of Vue/DOM so it is unit-testable under the server runner
 * and reusable by a future Electron client. WaitingFor subscribes via
 * `onRealtimeWake` (mirroring the existing manual visibility/focus listeners).
 */

// Collapse a burst arriving within this window into a single wake.
const COALESCE_WINDOW_MS = 60;
// Never wake the refresh path more often than this (storm cap).
const MIN_WAKE_INTERVAL_MS = 400;

export interface RealtimeSyncStats {
  invalidationsSeen: number;
  wakesDelivered: number;
  wakesCoalesced: number;
}

type WakeListener = () => void;

const stats: RealtimeSyncStats = {invalidationsSeen: 0, wakesDelivered: 0, wakesCoalesced: 0};
const listeners = new Set<WakeListener>();
let scheduled = false;
let lastWakeAt = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

/** Register a wake listener (WaitingFor). Returns an unsubscribe function. */
export function onRealtimeWake(listener: WakeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Called by the transport on each GAME_STATE_INVALIDATED. Coalesces bursts. */
export function notifyGameInvalidated(): void {
  stats.invalidationsSeen += 1;
  if (scheduled) {
    // A wake is already pending — fold this invalidation into it.
    stats.wakesCoalesced += 1;
    return;
  }
  scheduled = true;
  const sinceLast = Date.now() - lastWakeAt;
  const delay = Math.max(COALESCE_WINDOW_MS, MIN_WAKE_INTERVAL_MS - sinceLast);
  timer = setTimeout(fireWake, delay);
}

function fireWake(): void {
  scheduled = false;
  timer = undefined;
  lastWakeAt = Date.now();
  stats.wakesDelivered += 1;
  if (isRealtimeDebug()) {
    console.log('[realtime] wake -> refresh', {...stats});
  }
  for (const listener of listeners) {
    try {
      listener();
    } catch (err) {
      console.error('[realtime] wake listener failed', err);
    }
  }
}

/**
 * Fire a wake immediately, cancelling any pending coalesced one. Used for
 * non-invalidation reasons that must re-run the guarded refresh / re-evaluate
 * the poll interval NOW — e.g. the WebSocket dropped and the poller must fall
 * back to the safe interval without waiting out a stretched one.
 */
export function wakeNow(): void {
  if (timer !== undefined) {
    clearTimeout(timer);
    timer = undefined;
  }
  scheduled = false;
  fireWake();
}

/** Clear any pending wake (e.g. when leaving the game). Keeps counters. */
export function resetRealtimeSync(): void {
  if (timer !== undefined) {
    clearTimeout(timer);
    timer = undefined;
  }
  scheduled = false;
  lastWakeAt = 0;
}

export function getRealtimeSyncStats(): Readonly<RealtimeSyncStats> {
  return stats;
}

/** Test-only: fully reset the module singleton (state + counters + listeners). */
export function __resetRealtimeSyncForTesting(): void {
  resetRealtimeSync();
  stats.invalidationsSeen = 0;
  stats.wakesDelivered = 0;
  stats.wakesCoalesced = 0;
  listeners.clear();
}
