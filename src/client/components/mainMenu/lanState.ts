import {reactive} from 'vue';
import {desktopBridge, DesktopLanHost} from '@/client/components/desktop/desktopUpdateState';

/**
 * LAN HOST DISCOVERY (host-as-server mode — docs/EMBEDDED_SERVER.md §6).
 *
 * This module knows WHO is out there, and nothing else. The games each host
 * offers, the probing, the endpoint that answered and the freshness of it all
 * belong to `lobbyState.ts`, which treats every host as one SOURCE among
 * several — the same way it treats this device's own server.
 *
 * Keeping the two apart is what lets «Мои партии» have a single refresh engine:
 * discovery is a push (mDNS add/remove, relayed by the desktop bridge), while
 * listing is a request with a status. Mixing them is how the screen previously
 * ended up with two independent poll loops and no shared notion of «asked and
 * failed» versus «never asked».
 *
 * TWO SOURCES OF HOSTS:
 *   - DISCOVERED over mDNS (the normal case);
 *   - MANUAL, typed by the player as `192.168.50.168` or `host:port`. mDNS is
 *     multicast, and multicast is exactly what a router's client isolation, a
 *     guest SSID or a firewall drops first — so a hand-typed address is the
 *     fallback that always works as long as the two machines can reach each
 *     other at all. Manual entries persist across launches.
 */

/** The embedded server's preferred port (embeddedServerMain.DEFAULT_EMBEDDED_PORT). */
export const DEFAULT_LAN_PORT = 17325;
const MANUAL_STORAGE_KEY = 'tm.lan.manualHosts';

export type ManualHost = {
  /** Exactly what the player typed — both the key and the label. */
  entry: string;
  address: string;
  port: number;
};

export const lanState = reactive<{
  /** The desktop bridge supports LAN discovery (host mode, current shell). */
  supported: boolean,
  hosts: ReadonlyArray<DesktopLanHost>,
  manual: ReadonlyArray<ManualHost>,
}>({
  supported: false,
  hosts: [],
  manual: [],
});

let wired = false;

/**
 * One-time wiring: feature-detect the bridge, seed the host list, subscribe to
 * pushes. Safe to call from every menu mount.
 *
 * The latch is set only once the bridge was ACTUALLY wired: a shell whose
 * bridge is not there yet must be able to try again on the next mount, instead
 * of being marked «no LAN» for the rest of the session.
 */
export function initLanDiscovery(): void {
  if (wired) {
    return;
  }
  // Manual entries are independent of the bridge: they are precisely what the
  // player falls back to when discovery cannot work.
  if (lanState.manual.length === 0) {
    lanState.manual = loadManualHosts();
  }
  const bridge = desktopBridge();
  if (bridge?.getLanState === undefined || bridge.onLanHosts === undefined) {
    return;
  }
  wired = true;
  lanState.supported = true;
  void bridge.getLanState().then((state) => {
    if (state !== undefined) {
      lanState.hosts = state.hosts ?? [];
    }
  }).catch(() => {});
  bridge.onLanHosts((hostList) => {
    lanState.hosts = hostList ?? [];
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

function loadManualHosts(): Array<ManualHost> {
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
      .map(({entry, parsed}) => ({entry, address: parsed.address, port: parsed.port}));
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
  lanState.manual = [...lanState.manual, {entry, address: parsed.address, port: parsed.port}];
  saveManualHosts();
  return true;
}

export function removeManualHost(entry: string): void {
  lanState.manual = lanState.manual.filter((h) => h.entry !== entry);
  saveManualHosts();
}

/** Tests: forget the bridge wiring + the discovered hosts. */
export function resetLanStateForTesting(): void {
  wired = false;
  lanState.supported = false;
  lanState.hosts = [];
  lanState.manual = [];
}
