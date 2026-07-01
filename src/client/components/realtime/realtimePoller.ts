import {onRealtimeWake} from './realtimeSync';

/**
 * Adaptive, WS-aware fallback poller for the SECONDARY feeds (journal /
 * notifications / rematch). It refetches immediately on every realtime wake (a
 * game-room invalidation) and otherwise on a fallback timer whose interval comes
 * from `intervalMsFn(safeIntervalMs)` — stretched long while the WS is healthy,
 * the safe rate otherwise. So: real-time updates when WS is up, an unchanged
 * fast poll when it's down. The fallback is never removed.
 *
 * Kept Vue/DOM-free (the interval provider is injected) so it is unit-testable
 * under the server runner and reusable by a future Electron client. Returns a
 * `stop()` function; store it on the component and call it in beforeUnmount.
 */
export function startRealtimePoller(
  fetchFn: () => void,
  safeIntervalMs: number,
  intervalMsFn: (safeMs: number) => number,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const arm = (): void => {
    if (stopped) {
      return;
    }
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      fetchFn();
      arm();
    }, intervalMsFn(safeIntervalMs));
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
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    wakeOff();
  };
}
