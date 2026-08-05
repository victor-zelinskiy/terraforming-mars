/**
 * Per-participant server-endpoint pinning (docs/EMBEDDED_SERVER.md §6).
 *
 * In host-as-server mode one app talks to SEVERAL servers: its own embedded one
 * (the injected default), a LAN host's embedded server (a joined game), and —
 * via the remote mode — the hosted server. A game session is permanently tied
 * to the server that holds it, and the participant id is the session key the
 * whole client already routes by (`?id=` / injected id). So the pin is a
 * localStorage map `participantId → {apiBase, wsBase}`; `runtimeConfig.ts`
 * consults it FIRST, which transparently redirects every REST call, the
 * waitingfor XHR, logs/journal, previews and the realtime WebSocket for that
 * one game — and nothing else.
 *
 * The map is cached in module memory: `apiUrl()` is on the hot path of every
 * fetch, and endpoints only change through {@link pinServerEndpoint} (which
 * updates the cache synchronously) or a full page load (game entry — re-read).
 */

export type ServerEndpoint = {
  /** e.g. 'http://192.168.1.5:17325' (no trailing slash). */
  apiBase: string;
  /** e.g. 'ws://192.168.1.5:17325'. */
  wsBase: string;
};

const STORAGE_KEY = 'tm_server_endpoints';
/** Oldest pins fall off past this — a finished game's pin is dead weight. */
const MAX_PINS = 60;

type PinMap = Record<string, ServerEndpoint & {at: number}>;

let cache: PinMap | undefined;

function storage(): Storage | undefined {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

function load(): PinMap {
  if (cache !== undefined) {
    return cache;
  }
  try {
    const raw = storage()?.getItem(STORAGE_KEY);
    cache = raw !== null && raw !== undefined ? JSON.parse(raw) as PinMap : {};
  } catch {
    cache = {};
  }
  return cache;
}

function persist(map: PinMap): void {
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Private mode / quota — the in-memory cache still covers this session.
  }
}

/** The pinned endpoint for a participant, if any. */
export function pinnedServerEndpoint(participantId: string): ServerEndpoint | undefined {
  const entry = load()[participantId];
  return entry === undefined ? undefined : {apiBase: entry.apiBase, wsBase: entry.wsBase};
}

/** Pin a participant's game session to the server that hosts it. */
export function pinServerEndpoint(participantId: string, endpoint: ServerEndpoint): void {
  const map = load();
  map[participantId] = {
    apiBase: endpoint.apiBase.replace(/\/+$/, ''),
    wsBase: endpoint.wsBase.replace(/\/+$/, ''),
    at: Date.now(),
  };
  const ids = Object.keys(map);
  if (ids.length > MAX_PINS) {
    ids.sort((a, b) => (map[a].at ?? 0) - (map[b].at ?? 0));
    for (const stale of ids.slice(0, ids.length - MAX_PINS)) {
      delete map[stale];
    }
  }
  persist(map);
}

/** ws(s):// base derived from an http(s):// base. */
export function wsBaseFromApiBase(apiBase: string): string {
  return apiBase.replace(/^http(s?):/i, 'ws$1:');
}
