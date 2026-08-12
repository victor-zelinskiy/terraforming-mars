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
 * desktop bridge pushes the aggregated host list here. For every host we PROBE
 * its addresses (`api/games/joinable`) and list its joinable games next to the
 * local ones. Joining pins the seat's participant id to the host's endpoint
 * (`serverEndpoints.ts`) and navigates — from there the whole client
 * transparently talks to the host's server for that game.
 *
 * TWO SOURCES OF HOSTS, one probe path:
 *   - DISCOVERED over mDNS (the normal case);
 *   - MANUAL, typed by the player as `192.168.50.168` or `host:port`. mDNS is
 *     multicast, and multicast is exactly what a router's client isolation, a
 *     guest SSID or a firewall drops first — so a hand-typed address is the
 *     fallback that always works as long as the two machines can reach each
 *     other at all. Manual entries persist across launches.
 */

export type LanGameRow = {
  host: DesktopLanHost;
  endpoint: ServerEndpoint;
  game: JoinableGameSummary;
  /** Host build differs from ours — join may misbehave; the row warns. */
  versionMismatch: boolean;
};

export type ManualHostStatus = 'checking' | 'ok' | 'unreachable';

export type ManualHost = {
  /** Exactly what the player typed — both the key and the label. */
  entry: string;
  address: string;
  port: number;
  status: ManualHostStatus;
};

const PROBE_TIMEOUT_MS = 1500;
const DEFAULT_POLL_MS = 6000;
/** The embedded server's preferred port (embeddedServerMain.DEFAULT_EMBEDDED_PORT). */
export const DEFAULT_LAN_PORT = 17325;
const MANUAL_STORAGE_KEY = 'tm.lan.manualHosts';

export const lanState = reactive<{
  /** The desktop bridge supports LAN discovery (host mode, current shell). */
  supported: boolean,
  hosts: ReadonlyArray<DesktopLanHost>,
  manual: ReadonlyArray<ManualHost>,
  games: ReadonlyArray<LanGameRow>,
  loading: boolean,
}>({
  supported: false,
  hosts: [],
  manual: [],
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
  // Manual entries are independent of the bridge: they are precisely what the
  // player falls back to when discovery cannot work.
  lanState.manual = loadManualHosts();
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
      if (id.startsWith('manual:')) {
        continue;
      }
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

// ------------------------------------------------------------- manual hosts

/**
 * Normalise what the player typed into an address + port.
 * Accepts `192.168.50.168`, `192.168.50.168:17325`, `deck.local`,
 * `http://192.168.50.168:17325`, and a bracketed IPv6 literal.
 */
export function parseManualEntry(raw: string): {address: string, port: number} | undefined {
  const value = raw.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  if (value === '') {
    return undefined;
  }
  let address = value;
  let port = DEFAULT_LAN_PORT;
  const bracketed = /^\[([^\]]+)\](?::(\d+))?$/.exec(value);
  if (bracketed !== null) {
    address = bracketed[1];
    port = bracketed[2] === undefined ? DEFAULT_LAN_PORT : Number(bracketed[2]);
  } else if (value.split(':').length === 2) {
    const [host, rawPort] = value.split(':');
    address = host;
    port = Number(rawPort);
  }
  // 3+ colons and no brackets = a bare IPv6 literal; keep the default port.
  if (address === '' || !Number.isInteger(port) || port < 1 || port > 65535) {
    return undefined;
  }
  return {address, port};
}

function loadManualHosts(): ManualHost[] {
  try {
    const raw = window.localStorage.getItem(MANUAL_STORAGE_KEY);
    const entries = raw === null ? [] : JSON.parse(raw) as unknown;
    if (!Array.isArray(entries)) {
      return [];
    }
    return entries
      .filter((e): e is string => typeof e === 'string')
      .map((entry) => ({entry, parsed: parseManualEntry(entry)}))
      .filter((e): e is {entry: string, parsed: {address: string, port: number}} => e.parsed !== undefined)
      .map(({entry, parsed}) => ({entry, address: parsed.address, port: parsed.port, status: 'checking' as ManualHostStatus}));
  } catch {
    return [];
  }
}

function saveManualHosts(): void {
  try {
    window.localStorage.setItem(MANUAL_STORAGE_KEY, JSON.stringify(lanState.manual.map((h) => h.entry)));
  } catch {
    // A blocked storage must not break the session's manual hosts.
  }
}

/** Add a hand-typed host. Returns false when the entry is not a usable address. */
export function addManualHost(raw: string): boolean {
  const parsed = parseManualEntry(raw);
  if (parsed === undefined) {
    return false;
  }
  const entry = raw.trim();
  if (lanState.manual.some((h) => h.address === parsed.address && h.port === parsed.port)) {
    return true; // already there — idempotent, not an error
  }
  lanState.manual = [...lanState.manual, {entry, address: parsed.address, port: parsed.port, status: 'checking'}];
  saveManualHosts();
  maybeRefresh();
  return true;
}

export function removeManualHost(entry: string): void {
  lanState.manual = lanState.manual.filter((h) => h.entry !== entry);
  endpointCache.delete(manualHostId(entry));
  saveManualHosts();
  maybeRefresh();
}

function manualHostId(entry: string): string {
  return `manual:${entry}`;
}

/** A manual entry rendered in the same shape as a discovered host. */
function manualAsHost(manual: ManualHost): DesktopLanHost {
  return {
    id: manualHostId(manual.entry),
    name: manual.entry,
    addresses: [manual.address],
    port: manual.port,
    version: '',
  };
}

function setManualStatus(entry: string, status: ManualHostStatus): void {
  lanState.manual = lanState.manual.map((h) => h.entry === entry ? {...h, status} : h);
}

// ------------------------------------------------------------------ probing

function urlBase(address: string, port: number): string {
  const host = address.includes(':') ? `[${address}]` : address;
  return `http://${host}:${port}`;
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

/**
 * First address that answers wins.
 *
 * Probing in PARALLEL rather than in sequence is load-bearing: a host
 * advertises an address per NIC, so a machine with Hyper-V, WSL and a VPN
 * offers half a dozen candidates and the dead ones do not fail fast — they hang
 * to the timeout. Sequentially that is 1.5 s each, which the 6 s poll tick laps,
 * and `refreshSeq` then discards the answer that finally arrives. Raced, the
 * reachable address replies in milliseconds and the rest are simply ignored.
 */
async function probeFirst(bases: string[], name: string): Promise<{base: string, games: JoinableGameSummary[]} | undefined> {
  if (bases.length === 0) {
    return undefined;
  }
  try {
    return await Promise.any(bases.map(async (base) => {
      const games = await fetchJoinable(base, name);
      if (games === undefined) {
        throw new Error(`unreachable: ${base}`);
      }
      return {base, games};
    }));
  } catch {
    return undefined; // every candidate failed
  }
}

async function loadHostGames(host: DesktopLanHost, name: string): Promise<{rows: LanGameRow[], reachable: boolean}> {
  const cached = endpointCache.get(host.id);
  const bases = cached !== undefined ? [cached.apiBase] : host.addresses.map((a) => urlBase(a, host.port));
  const hit = await probeFirst(bases, name);
  if (hit === undefined) {
    endpointCache.delete(host.id);
    return {rows: [], reachable: false};
  }
  const endpoint: ServerEndpoint = {apiBase: hit.base, wsBase: wsBaseFromApiBase(hit.base)};
  endpointCache.set(host.id, endpoint);
  return {
    reachable: true,
    rows: hit.games.map((game) => ({
      host,
      endpoint,
      game,
      versionMismatch: ownVersion !== '' && host.version !== '' && host.version !== ownVersion,
    })),
  };
}

/** Re-query every known host's joinable list for the given player name. */
export async function refreshLanGames(displayName: string): Promise<void> {
  activeName = displayName;
  // A manual entry that mDNS also found would otherwise be listed twice.
  const discoveredEndpoints = new Set(
    lanState.hosts.flatMap((h) => h.addresses.map((a) => `${a}:${h.port}`)));
  const manual = lanState.manual.filter((m) => !discoveredEndpoints.has(`${m.address}:${m.port}`));
  const targets = [
    ...lanState.hosts.map((host) => ({host, manualEntry: undefined as string | undefined})),
    ...manual.map((m) => ({host: manualAsHost(m), manualEntry: m.entry})),
  ];
  if (displayName === '' || targets.length === 0) {
    lanState.games = [];
    return;
  }
  const seq = ++refreshSeq;
  lanState.loading = true;
  try {
    const results = await Promise.all(targets.map(async (target) => ({
      target,
      result: await loadHostGames(target.host, displayName),
    })));
    if (seq !== refreshSeq) {
      return;
    }
    for (const {target, result} of results) {
      if (target.manualEntry !== undefined) {
        setManualStatus(target.manualEntry, result.reachable ? 'ok' : 'unreachable');
      }
    }
    lanState.games = results.flatMap((r) => r.result.rows);
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
