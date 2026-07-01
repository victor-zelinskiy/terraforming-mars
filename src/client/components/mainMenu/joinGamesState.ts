import {reactive} from 'vue';
import {paths} from '@/common/app/paths';
import {apiUrl} from '@/client/utils/runtimeConfig';
import {JoinableGameSummary} from '@/common/models/JoinableGameModel';

/**
 * Live state for the premium "join games" panel. Module-level (survives any
 * component remount) and deliberately thin: the panel drives the lifecycle
 * (load on open, poll while open, reset on close). Polling is the fallback for
 * "a new matching game appeared" — the fork has no websocket layer, and this is
 * structured so a future push channel can replace `startJoinPolling` without
 * touching the panel.
 */

const NEW_HIGHLIGHT_MS = 9000;
const DEFAULT_POLL_MS = 6000;

export const joinGamesState = reactive<{
  loading: boolean,
  loadedOnce: boolean,
  error: boolean,
  games: ReadonlyArray<JoinableGameSummary>,
  newIds: ReadonlyArray<string>,
}>({
  loading: false,
  loadedOnce: false,
  error: false,
  games: [],
  newIds: [],
});

let pollTimer: number | undefined;
const decayTimers = new Map<string, number>();
let activeName = '';

export async function loadJoinableGames(displayName: string, opts: {silent?: boolean} = {}): Promise<void> {
  activeName = displayName;
  if (opts.silent !== true) {
    joinGamesState.loading = true;
  }
  try {
    const url = apiUrl(paths.API_GAMES_JOINABLE) + '?name=' + encodeURIComponent(displayName);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error('bad response');
    }
    const games = await res.json() as Array<JoinableGameSummary>;
    // Drop a stale response if the name changed while this request was in flight.
    if (activeName !== displayName) {
      return;
    }
    const prevIds = new Set(joinGamesState.games.map((g) => g.id));
    const fresh = joinGamesState.loadedOnce ? games.filter((g) => !prevIds.has(g.id)).map((g) => g.id) : [];
    joinGamesState.games = games;
    joinGamesState.error = false;
    joinGamesState.loadedOnce = true;
    if (fresh.length > 0) {
      markNew(fresh);
    }
  } catch {
    if (activeName === displayName) {
      joinGamesState.error = true;
    }
  } finally {
    if (activeName === displayName) {
      joinGamesState.loading = false;
    }
  }
}

function markNew(ids: ReadonlyArray<string>): void {
  joinGamesState.newIds = Array.from(new Set([...joinGamesState.newIds, ...ids]));
  for (const id of ids) {
    const existing = decayTimers.get(id);
    if (existing !== undefined) {
      clearTimeout(existing);
    }
    const timer = window.setTimeout(() => {
      joinGamesState.newIds = joinGamesState.newIds.filter((x) => x !== id);
      decayTimers.delete(id);
    }, NEW_HIGHLIGHT_MS);
    decayTimers.set(id, timer);
  }
}

export function startJoinPolling(intervalMs: number = DEFAULT_POLL_MS): void {
  stopJoinPolling();
  pollTimer = window.setInterval(() => {
    if (activeName !== '') {
      void loadJoinableGames(activeName, {silent: true});
    }
  }, intervalMs);
}

export function stopJoinPolling(): void {
  if (pollTimer !== undefined) {
    clearInterval(pollTimer);
    pollTimer = undefined;
  }
}

/** Clear the list + highlights for a fresh name (keeps polling cadence). */
export function beginNameReload(): void {
  for (const timer of decayTimers.values()) {
    clearTimeout(timer);
  }
  decayTimers.clear();
  joinGamesState.games = [];
  joinGamesState.newIds = [];
  joinGamesState.loadedOnce = false;
  joinGamesState.error = false;
}

/** Full teardown — call on panel close / unmount. */
export function resetJoinGames(): void {
  stopJoinPolling();
  beginNameReload();
  joinGamesState.loading = false;
  activeName = '';
}
