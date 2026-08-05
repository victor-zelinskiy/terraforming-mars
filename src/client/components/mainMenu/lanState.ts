import {reactive} from 'vue';
import {paths} from '@/common/app/paths';
import {JoinableGameSummary} from '@/common/models/JoinableGameModel';
import {desktopBridge, DesktopLanHost} from '@/client/components/desktop/desktopUpdateState';
import {ServerEndpoint, wsBaseFromApiBase} from '@/client/utils/serverEndpoints';

/**
 * LAN games state for the main menu (host-as-server mode —
 * docs/EMBEDDED_SERVER.md §6). Mirrors the joinGamesState module shape: a
 * module-level reactive store, the menu drives the lifecycle.
 *
 * Discovery itself runs in the embedded-server utility process (mDNS); the
 * desktop bridge pushes the aggregated host list here. For every discovered
 * host we PROBE its addresses (first `api/games/joinable` to answer wins — a
 * host can expose several NICs) and list its joinable games next to the local
 * ones. Joining pins the seat's participant id to the host's endpoint
 * (`serverEndpoints.ts`) and navigates — from there the whole client
 * transparently talks to the host's server for that game.
 */

export type LanGameRow = {
  host: DesktopLanHost;
  endpoint: ServerEndpoint;
  game: JoinableGameSummary;
  /** Host build differs from ours — join may misbehave; the row warns. */
  versionMismatch: boolean;
};

const PROBE_TIMEOUT_MS = 1500;
const DEFAULT_POLL_MS = 6000;

export const lanState = reactive<{
  /** The desktop bridge supports LAN discovery (host mode, current shell). */
  supported: boolean,
  hosts: ReadonlyArray<DesktopLanHost>,
  games: ReadonlyArray<LanGameRow>,
  loading: boolean,
}>({
  supported: false,
  hosts: [],
  games: [],
  loading: false,
});

let initialized = false;
let activeName = '';
let refreshSeq = 0;
let pollTimer: number | undefined;
let ownVersion = '';
/** Working endpoint per host id — skips re-probing every poll tick. */
const endpointCache = new Map<string, ServerEndpoint>();

/**
 * One-time wiring: feature-detect the bridge, seed the host list, subscribe to
 * pushes. Safe to call from every menu mount.
 */
export function initLanDiscovery(): void {
  if (initialized) {
    return;
  }
  initialized = true;
  const bridge = desktopBridge();
  if (bridge?.getLanState === undefined || bridge.onLanHosts === undefined) {
    return;
  }
  lanState.supported = true;
  void bridge.getVersion?.().then((v) => {
    ownVersion = v ?? '';
  }).catch(() => {});
  void bridge.getLanState().then((state) => {
    if (state !== undefined) {
      lanState.hosts = state.hosts ?? [];
      maybeRefresh();
    }
  }).catch(() => {});
  bridge.onLanHosts((hosts) => {
    lanState.hosts = hosts ?? [];
    for (const id of [...endpointCache.keys()]) {
      if (!lanState.hosts.some((h) => h.id === id)) {
        endpointCache.delete(id);
      }
    }
    maybeRefresh();
  });
}

/** Publish the active profile's name as this host's LAN advertisement (live). */
export function publishLanName(name: string): void {
  void desktopBridge()?.setLanName?.(name).catch(() => {});
}

function urlBase(address: string, port: number): string {
  const host = address.includes(':') ? `[${address}]` : address;
  return `http://${host}:${port}`;
}

/** IPv4 first — bracketed IPv6 fetches are the flakier path on a LAN. */
function orderedAddresses(host: DesktopLanHost): string[] {
  return [...host.addresses].sort((a, b) => Number(b.includes('.')) - Number(a.includes('.')));
}

async function fetchJoinable(base: string, name: string): Promise<JoinableGameSummary[] | undefined> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/${paths.API_GAMES_JOINABLE}?name=${encodeURIComponent(name)}`, {signal: controller.signal});
    if (!res.ok) {
      return undefined;
    }
    return await res.json() as JoinableGameSummary[];
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

async function loadHostGames(host: DesktopLanHost, name: string): Promise<LanGameRow[]> {
  const cached = endpointCache.get(host.id);
  const bases = cached !== undefined ?
    [cached.apiBase] :
    orderedAddresses(host).map((a) => urlBase(a, host.port));
  for (const base of bases) {
    const games = await fetchJoinable(base, name);
    if (games !== undefined) {
      const endpoint: ServerEndpoint = {apiBase: base, wsBase: wsBaseFromApiBase(base)};
      endpointCache.set(host.id, endpoint);
      return games.map((game) => ({
        host,
        endpoint,
        game,
        versionMismatch: ownVersion !== '' && host.version !== '' && host.version !== ownVersion,
      }));
    }
  }
  endpointCache.delete(host.id);
  return [];
}

/** Re-query every discovered host's joinable list for the given player name. */
export async function refreshLanGames(displayName: string): Promise<void> {
  activeName = displayName;
  if (!lanState.supported || displayName === '' || lanState.hosts.length === 0) {
    lanState.games = [];
    return;
  }
  const seq = ++refreshSeq;
  lanState.loading = true;
  try {
    const rows = await Promise.all(lanState.hosts.map((h) => loadHostGames(h, displayName)));
    if (seq === refreshSeq) {
      lanState.games = rows.flat();
    }
  } finally {
    if (seq === refreshSeq) {
      lanState.loading = false;
    }
  }
}

function maybeRefresh(): void {
  if (activeName !== '') {
    void refreshLanGames(activeName);
  }
}

export function startLanPolling(displayName: string, intervalMs: number = DEFAULT_POLL_MS): void {
  activeName = displayName;
  stopLanPolling();
  maybeRefresh();
  pollTimer = window.setInterval(maybeRefresh, intervalMs);
}

export function stopLanPolling(): void {
  if (pollTimer !== undefined) {
    clearInterval(pollTimer);
    pollTimer = undefined;
  }
}
