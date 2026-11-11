import {onRealtimeWake} from './realtimeSync';
import {consoleAppScope} from '@/client/console/session/consoleSession';

/**
 * Adaptive, WS-aware fallback poller for the SECONDARY feeds (journal /
 * notifications / rematch). It refetches immediately on every realtime wake (a
 * game-room invalidation) and otherwise on a fallback timer whose interval comes
 * from `intervalMsFn(safeIntervalMs)` — stretched long while the WS is healthy,
 * the safe rate otherwise. So: real-time updates when WS is up, an unchanged
 * fast poll when it's down. The fallback is never removed.
 *
 * Kept component/DOM-free (the interval provider is injected) so it is
 * unit-testable under the server runner and reusable by a future Electron
 * client. Returns a `stop()` function; store it on the component and call it in
 * beforeUnmount.
 *
 * The fallback tick is a LIVENESS chain (each tick re-arms the next), so it is
 * owned by the PAGE's scope (`consoleAppScope()`) — never by a game session,
 * whose end would take the pending tick back with nothing left to re-arm it.
 * Its lifetime is the caller's `stop()`.
 */
export function startRealtimePoller(
  fetchFn: () => void,
  safeIntervalMs: number,
  intervalMsFn: (safeMs: number) => number,
): () => void {
  let cancelTick: () => void = () => {};
  let stopped = false;

  const arm = (): void => {
    if (stopped) {
      return;
    }
    cancelTick();
    cancelTick = consoleAppScope().after(intervalMsFn(safeIntervalMs), 'the realtime poller\'s fallback tick', () => {
      fetchFn();
      arm();
    });
  };

  const wakeOff = onRealtimeWake(() => {
    if (stopped) {
      return;
    }
    // A game-room invalidation — refetch now and reset the fallback timer.
    fetchFn();
    arm();
  });

  arm();

  return () => {
    stopped = true;
    cancelTick();
    wakeOff();
  };
}
