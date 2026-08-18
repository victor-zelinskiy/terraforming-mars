import {reactive} from 'vue';
import {paths} from '@/common/app/paths';
import {apiUrl} from '@/client/utils/runtimeConfig';
import {JoinableGameStatus, JoinableGameSummary} from '@/common/models/JoinableGameModel';

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

// ── Cross-session cache ─────────────────────────────────────────────────────
// The joinable list drives the console main menu's CONTINUE item + My-games
// badge. Those depend on an async fetch, so a cold menu first rendered WITHOUT
// them and popped CONTINUE in a beat later (a visible flash). The last
// successful list is persisted so the menu can HYDRATE it synchronously before
// its first render — no more appearing sections. Stale entries self-correct on
// the background refresh. Local-only, keyed by the (temporary) display name.
const CACHE_KEY = 'tm_joinable_cache';

function storage(): Storage | undefined {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

function persistJoinableCache(name: string, games: ReadonlyArray<JoinableGameSummary>): void {
  try {
    storage()?.setItem(CACHE_KEY, JSON.stringify({name, games}));
  } catch {
    // Private mode / quota — the in-memory list still works this session.
  }
}

/**
 * Synchronously seed the list from the last-session cache (call BEFORE the
 * first render, e.g. a component `created()` hook) so CONTINUE / the badge are
 * present on the first paint. No-op when already loaded this session or the
 * cached name doesn't match. The background fetch refreshes + corrects it.
 */
export function hydrateJoinableGames(displayName: string): void {
  if (joinGamesState.loadedOnce || displayName === '') {
    return;
  }
  try {
    const raw = storage()?.getItem(CACHE_KEY);
    if (raw === null || raw === undefined) {
      return;
    }
    const parsed = JSON.parse(raw) as {name?: string, games?: Array<JoinableGameSummary>};
    if (parsed?.name === displayName && Array.isArray(parsed.games)) {
      joinGamesState.games = parsed.games;
      joinGamesState.loadedOnce = true;
      // Match loadJoinableGames' active name so its next fetch diffs (not "all new").
      activeName = displayName;
    }
  } catch {
    // Corrupt blob — ignore; the fetch will populate cleanly.
  }
}

/** One GET of a name's games in one SLICE (see {@link JoinableGameStatus}). */
async function fetchGames(displayName: string, status: JoinableGameStatus): Promise<Array<JoinableGameSummary>> {
  const url = apiUrl(paths.API_GAMES_JOINABLE) +
    '?name=' + encodeURIComponent(displayName) +
    (status === 'active' ? '' : '&status=' + status);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('bad response');
  }
  return await res.json() as Array<JoinableGameSummary>;
}

export async function loadJoinableGames(displayName: string, opts: {silent?: boolean} = {}): Promise<void> {
  activeName = displayName;
  if (opts.silent !== true) {
    joinGamesState.loading = true;
  }
  try {
    const games = await fetchGames(displayName, 'active');
    // Drop a stale response if the name changed while this request was in flight.
    if (activeName !== displayName) {
      return;
    }
    const prevIds = new Set(joinGamesState.games.map((g) => g.id));
    const fresh = joinGamesState.loadedOnce ? games.filter((g) => !prevIds.has(g.id)).map((g) => g.id) : [];
    joinGamesState.games = games;
    joinGamesState.error = false;
    joinGamesState.loadedOnce = true;
    persistJoinableCache(displayName, games);
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

// ── The ARCHIVE (finished games) ────────────────────────────────────────────
// Deliberately THINNER than the live list: a finished game never changes, so
// there is no polling and no cross-session cache here (nothing on the first
// painted frame depends on it — CONTINUE and the menu badge are active-only).
// The console main menu loads it lazily, on the first toggle into the archive,
// and re-loads it silently on every later toggle so a game that has just
// ended appears without a restart.

export const finishedGamesState = reactive<{
  loading: boolean,
  loadedOnce: boolean,
  error: boolean,
  games: ReadonlyArray<JoinableGameSummary>,
}>({
  loading: false,
  loadedOnce: false,
  error: false,
  games: [],
});

let archiveName = '';

export async function loadFinishedGames(displayName: string, opts: {silent?: boolean} = {}): Promise<void> {
  if (archiveName !== displayName) {
    // A different player (profile switch) — the loaded archive is not theirs.
    // Self-healing here rather than at the call sites, so no screen can show
    // one profile's finished games under another profile's name.
    finishedGamesState.games = [];
    finishedGamesState.loadedOnce = false;
    finishedGamesState.error = false;
  }
  archiveName = displayName;
  if (opts.silent !== true) {
    finishedGamesState.loading = true;
  }
  try {
    const games = await fetchGames(displayName, 'finished');
    // Drop a stale response if the name changed while this request was in flight.
    if (archiveName !== displayName) {
      return;
    }
    finishedGamesState.games = games;
    finishedGamesState.error = false;
    finishedGamesState.loadedOnce = true;
  } catch {
    if (archiveName === displayName) {
      finishedGamesState.error = true;
    }
  } finally {
    if (archiveName === displayName) {
      finishedGamesState.loading = false;
    }
  }
}
