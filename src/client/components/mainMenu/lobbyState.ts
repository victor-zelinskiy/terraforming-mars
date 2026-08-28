import {reactive, watch} from 'vue';
import {paths} from '@/common/app/paths';
import {JoinableGameStatus, JoinableGameSummary} from '@/common/models/JoinableGameModel';
import {apiBaseUrl, apiUrl, wsBaseUrl} from '@/client/utils/runtimeConfig';
import {ServerEndpoint, wsBaseFromApiBase} from '@/client/utils/serverEndpoints';
import {DesktopLanHost} from '@/client/components/desktop/desktopUpdateState';
import {lanState, ManualHost} from './lanState';
import {openLobbyChannel, LobbyChannelHandle, lobbyChannelHealthy} from './lobbyChannel';

/**
 * «МОИ ПАРТИИ» — THE LOBBY MODEL.
 *
 * ONE owner of the whole screen: the local server's games, the archive, and the
 * games of every LAN host discovered in host-as-server mode
 * (docs/EMBEDDED_SERVER.md §6). The console menu renders this and drives its
 * lifecycle; it holds no list state of its own.
 *
 * ── WHAT WENT WRONG BEFORE ────────────────────────────────────────────────
 * The list was three unrelated stores stitched together in the component, and
 * each of them could be silently EMPTY rather than silently WRONG, which is
 * worse: «У вас пока нет незавершённых партий» was also what you saw when
 *   · the identity had not resolved yet (the loader was never even called, and
 *     nothing re-ran when the name arrived — you had to restart the app);
 *   · the fetch failed while a stale cross-session cache held zero rows;
 *   · a LAN host's answer was slower than the 1.5 s probe budget, which the
 *     old load-every-game listing endpoint routinely was.
 * Each path produced the same sentence, so the player could not tell «nothing
 * here» from «I never asked» from «the host is slow».
 *
 * ── THE CONTRACT ──────────────────────────────────────────────────────────
 * 1. EVERY SOURCE HAS A STATE, and the UI reads it. `idle` (never asked) ≠
 *    `loading` ≠ `ok` ≠ `unreachable`. «Пусто» may only be shown for `ok`.
 * 2. ENTERING THE SCREEN IS A REFRESH. Not «load if not loaded» — an
 *    unconditional re-ask of every source, every time.
 * 3. PUSH FIRST, POLL AS A FLOOR. Each server's lobby channel
 *    ({@link openLobbyChannel}) says «the set of games changed»; the poll is the
 *    bounded fallback and stretches to a long interval while the channel is
 *    healthy — the same shape the in-game transport uses.
 * 4. THE IDENTITY IS AN INPUT, NOT A PRECONDITION. It may arrive late (Steam
 *    prefill, profile roster); when it does, the model reloads itself. Nothing
 *    is ever silently skipped because a name was empty at the wrong moment.
 * 5. NOTHING DISAPPEARS SILENTLY. A source that stops answering keeps its rows,
 *    marked — they are shown, not joinable, with the reason. Rows go away only
 *    when the SERVER says so (an ok answer without them) or when the host left
 *    the network.
 * 6. ONE ENTRY POINT. Every trigger — open, push, poll, focus, identity change,
 *    a deletion, a new LAN host — funnels into {@link refreshLobby}. Adding a
 *    trigger never means adding a loading path.
 */

// ── Cadence ────────────────────────────────────────────────────────────────
/** Screen open, every source pushing: the poll is only a safety net. */
const POLL_OPEN_LIVE_MS = 30_000;
/** Screen open, something is not pushing: the old, brisk cadence. */
const POLL_OPEN_FALLBACK_MS = 5_000;
/** Screen closed (CONTINUE + the menu badge), pushing. */
const POLL_IDLE_LIVE_MS = 120_000;
/** Screen closed, not pushing. */
const POLL_IDLE_FALLBACK_MS = 20_000;
/** A push storm (several saves in a row) collapses into one re-ask. */
const PUSH_DEBOUNCE_MS = 250;
/** Regaining focus re-asks, unless we just did. */
const FOCUS_MIN_AGE_MS = 3_000;
/**
 * A LAN probe budget. Deliberately generous: the addresses are raced in
 * parallel, so this bounds only the case where NOTHING answers — and a host
 * that is merely busy must be reported as slow, never as empty.
 */
const LAN_PROBE_TIMEOUT_MS = 6_000;
/** Consecutive failures before a still-advertised host's rows are dropped. */
const LAN_STALE_TOLERANCE = 3;
/** How long a freshly-arrived row is marked «новая». */
const NEW_HIGHLIGHT_MS = 9_000;

export const LOCAL_SOURCE_ID = 'local';

export type LobbySourceKind = 'local' | 'lan';
export type LobbySourceStatus = 'idle' | 'loading' | 'ok' | 'unreachable';

export type LobbySource = {
  id: string;
  kind: LobbySourceKind;
  /** '' for the local server; the advertised host name for a LAN source. */
  label: string;
  /** undefined = the app's own default endpoint (runtimeConfig). */
  endpoint: ServerEndpoint | undefined;
  status: LobbySourceStatus;
  /** Wall clock of the last SUCCESSFUL answer. */
  lastOkAt: number | undefined;
  /** Consecutive failures since the last success. */
  failures: number;
  /** The push channel for this server is carrying right now. */
  live: boolean;
  /** The host runs a different build than we do (soft warning on its rows). */
  versionMismatch: boolean;
};

export type LobbyRow = {
  /** Stable across refreshes — source + game, so Vue keeps the DOM node. */
  key: string;
  sourceId: string;
  kind: LobbySourceKind;
  /** '' for local rows; the host's name for LAN rows. */
  hostName: string;
  /** Where this game lives — what a join pins the seat to. */
  endpoint: ServerEndpoint | undefined;
  game: JoinableGameSummary;
  versionMismatch: boolean;
  /** Its server has stopped answering; shown, but not enterable. */
  stale: boolean;
};

export const lobbyState = reactive<{
  /** The «Мои партии» screen is on screen (drives cadence + LAN sources). */
  open: boolean,
  /** The active profile's display name. '' = not resolved yet. */
  identity: string,
  sources: ReadonlyArray<LobbySource>,
  /** Unfinished games on THIS device's server. */
  localRows: ReadonlyArray<LobbyRow>,
  /** Unfinished games on other couches, in host order. */
  lanRows: ReadonlyArray<LobbyRow>,
  /** The archive — finished games, local only (a LAN host publishes none). */
  archive: ReadonlyArray<JoinableGameSummary>,
  archiveStatus: LobbySourceStatus,
  /** True while any source is in flight (a quiet «обновляем» affordance). */
  refreshing: boolean,
  /** Rows that appeared while the player was watching. */
  newIds: ReadonlyArray<string>,
  /** Wall clock of the last completed refresh of any source. */
  lastRefreshAt: number | undefined,
  /** The list was seeded from the cross-session cache and not yet verified. */
  hydrated: boolean,
}>({
  open: false,
  identity: '',
  sources: [],
  localRows: [],
  lanRows: [],
  archive: [],
  archiveStatus: 'idle',
  refreshing: false,
  newIds: [],
  lastRefreshAt: undefined,
  hydrated: false,
});

/** Local + LAN, in the order the screen shows them (cursor arithmetic). */
export function lobbyRows(): ReadonlyArray<LobbyRow> {
  return [...lobbyState.localRows, ...lobbyState.lanRows];
}

export function lobbySource(id: string): LobbySource | undefined {
  return lobbyState.sources.find((s) => s.id === id);
}

export function localLobbySource(): LobbySource | undefined {
  return lobbySource(LOCAL_SOURCE_ID);
}

/**
 * The screen has NOTHING to show yet and is still finding out — the honest
 * «Загрузка…» state. Distinct from a verified empty library.
 */
export function lobbyFirstLoad(): boolean {
  const local = localLobbySource();
  return lobbyRows().length === 0 &&
    lobbyState.identity !== '' &&
    (local === undefined || local.status === 'idle' || local.status === 'loading');
}

/** We asked and could not find out. Never confuse this with «no games». */
export function lobbyUnreachable(): boolean {
  const local = localLobbySource();
  return lobbyRows().length === 0 && local?.status === 'unreachable';
}

/** The server answered, and the answer was: none. The only true empty state. */
export function lobbyKnownEmpty(): boolean {
  const local = localLobbySource();
  return lobbyRows().length === 0 && local?.status === 'ok';
}

// ── Cross-session cache ────────────────────────────────────────────────────
// The menu's CONTINUE item and the My-games badge depend on an async fetch, so
// a cold menu first painted WITHOUT them and popped them in a beat later. The
// last good LOCAL list is persisted so the first frame is already right.
// Keyed by name AND api base: a host↔remote mode switch must never show one
// server's games under the other's name. Always treated as UNVERIFIED — it
// seeds, it never satisfies a refresh.
const CACHE_KEY = 'tm_joinable_cache';

function storage(): Storage | undefined {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

function persistCache(name: string, games: ReadonlyArray<JoinableGameSummary>): void {
  try {
    storage()?.setItem(CACHE_KEY, JSON.stringify({name, apiBase: apiBaseUrl(), games}));
  } catch {
    // Private mode / quota — the in-memory list still works this session.
  }
}

/**
 * Seed the local list from the last session, synchronously, BEFORE the first
 * render (a component `created()` hook). No-op once anything real has loaded.
 */
export function hydrateLobbyCache(displayName: string): void {
  if (displayName === '' || lobbyState.localRows.length > 0 || lobbyState.hydrated) {
    return;
  }
  try {
    const raw = storage()?.getItem(CACHE_KEY);
    if (raw === null || raw === undefined) {
      return;
    }
    const parsed = JSON.parse(raw) as {name?: string, apiBase?: string, games?: Array<JoinableGameSummary>};
    if (parsed?.name !== displayName || parsed?.apiBase !== apiBaseUrl() || !Array.isArray(parsed.games)) {
      return;
    }
    lobbyState.identity = displayName;
    ensureLocalSource();
    lobbyState.localRows = parsed.games.map((game) => toRow(LOCAL_SOURCE_ID, 'local', '', undefined, game, false, false));
    lobbyState.hydrated = true;
  } catch {
    // Corrupt blob — ignore; the refresh populates cleanly.
  }
}

// ── Sources ────────────────────────────────────────────────────────────────

function setSource(id: string, patch: Partial<LobbySource>): void {
  lobbyState.sources = lobbyState.sources.map((s) => s.id === id ? {...s, ...patch} : s);
}

function ensureLocalSource(): void {
  if (lobbySource(LOCAL_SOURCE_ID) !== undefined) {
    return;
  }
  lobbyState.sources = [{
    id: LOCAL_SOURCE_ID,
    kind: 'local',
    label: '',
    endpoint: undefined,
    status: 'idle',
    lastOkAt: undefined,
    failures: 0,
    live: false,
    versionMismatch: false,
  }, ...lobbyState.sources];
}

function lanSourceId(hostId: string): string {
  return `lan:${hostId}`;
}

/** A manual entry rendered in the same shape as a discovered host. */
function manualAsHost(manual: ManualHost): DesktopLanHost {
  return {
    id: `manual:${manual.entry}`,
    name: manual.entry,
    addresses: [manual.address],
    port: manual.port,
    version: '',
  };
}

/** Every host worth asking: discovered over mDNS, plus hand-typed ones. */
function lanTargets(): ReadonlyArray<DesktopLanHost> {
  const discovered = lanState.hosts;
  const seen = new Set(discovered.flatMap((h) => h.addresses.map((a) => `${a}:${h.port}`)));
  const manual = lanState.manual
    .filter((m) => !seen.has(`${m.address}:${m.port}`))
    .map(manualAsHost);
  return [...discovered, ...manual];
}

/**
 * Reconcile the LAN sources with what discovery currently sees. A host that
 * LEFT the network takes its rows with it (that is the server saying so); a
 * host that is merely not answering keeps them — see {@link LAN_STALE_TOLERANCE}.
 */
function syncLanSources(): void {
  const targets = lobbyState.open ? lanTargets() : [];
  const wanted = new Map(targets.map((h) => [lanSourceId(h.id), h]));
  const kept: Array<LobbySource> = [];
  for (const source of lobbyState.sources) {
    if (source.kind === 'local') {
      kept.push(source);
      continue;
    }
    const host = wanted.get(source.id);
    if (host === undefined) {
      closeChannel(source.id);
      endpointCache.delete(source.id);
      continue;
    }
    wanted.delete(source.id);
    kept.push({...source, label: host.name, versionMismatch: versionMismatch(host)});
  }
  for (const [id, host] of wanted) {
    kept.push({
      id,
      kind: 'lan',
      label: host.name,
      endpoint: undefined,
      status: 'idle',
      lastOkAt: undefined,
      failures: 0,
      live: false,
      versionMismatch: versionMismatch(host),
    });
  }
  lobbyState.sources = kept;
  const alive = new Set(kept.map((s) => s.id));
  lobbyState.lanRows = lobbyState.lanRows.filter((row) => alive.has(row.sourceId));
  hosts = new Map(targets.map((h) => [lanSourceId(h.id), h]));
}

let hosts = new Map<string, DesktopLanHost>();
let ownVersion = '';

function versionMismatch(host: DesktopLanHost): boolean {
  return ownVersion !== '' && host.version !== '' && host.version !== ownVersion;
}

/** The desktop shell's own build id, for the host-version warning. */
export function setLobbyOwnVersion(version: string): void {
  ownVersion = version;
  syncLanSources();
}

// ── Fetching ───────────────────────────────────────────────────────────────

function toRow(
  sourceId: string,
  kind: LobbySourceKind,
  hostName: string,
  endpoint: ServerEndpoint | undefined,
  game: JoinableGameSummary,
  versionMismatchFlag: boolean,
  stale: boolean,
): LobbyRow {
  return {key: `${sourceId}:${game.id}`, sourceId, kind, hostName, endpoint, game, versionMismatch: versionMismatchFlag, stale};
}

function joinableQuery(name: string, status: JoinableGameStatus): string {
  return `?name=${encodeURIComponent(name)}` + (status === 'active' ? '' : `&status=${status}`);
}

/** The app's OWN server (host mode: the embedded one; remote: the hosted one). */
async function fetchLocal(name: string, status: JoinableGameStatus): Promise<Array<JoinableGameSummary>> {
  const res = await fetch(apiUrl(paths.API_GAMES_JOINABLE) + joinableQuery(name, status));
  if (!res.ok) {
    throw new Error(`joinable: ${res.status}`);
  }
  return await res.json() as Array<JoinableGameSummary>;
}

function apiBaseOf(address: string, port: number): string {
  const host = address.includes(':') ? `[${address}]` : address;
  return `http://${host}:${port}`;
}

async function fetchFrom(base: string, name: string): Promise<Array<JoinableGameSummary> | undefined> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), LAN_PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/${paths.API_GAMES_JOINABLE}${joinableQuery(name, 'active')}`, {signal: controller.signal});
    if (!res.ok) {
      return undefined;
    }
    return await res.json() as Array<JoinableGameSummary>;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

/** Working endpoint per LAN source — skips re-probing dead NICs every tick. */
const endpointCache = new Map<string, ServerEndpoint>();

/**
 * First address that answers wins.
 *
 * Raced rather than sequential on purpose: a host advertises one address per
 * NIC, so a machine with Hyper-V, WSL and a VPN offers half a dozen candidates
 * and the dead ones do not fail fast — they hang to the timeout. Sequentially
 * that is one timeout each, which the poll tick laps.
 */
async function probeFirst(bases: ReadonlyArray<string>, name: string): Promise<{base: string, games: Array<JoinableGameSummary>} | undefined> {
  if (bases.length === 0) {
    return undefined;
  }
  try {
    return await Promise.any(bases.map(async (base) => {
      const games = await fetchFrom(base, name);
      if (games === undefined) {
        throw new Error(`unreachable: ${base}`);
      }
      return {base, games};
    }));
  } catch {
    return undefined;
  }
}

// ── The refresh engine ─────────────────────────────────────────────────────

/** Per-source request generation — a late answer can never overwrite a newer one. */
const seqs = new Map<string, number>();

function nextSeq(sourceId: string): number {
  const next = (seqs.get(sourceId) ?? 0) + 1;
  seqs.set(sourceId, next);
  return next;
}

function isCurrent(sourceId: string, seq: number, name: string): boolean {
  return seqs.get(sourceId) === seq && lobbyState.identity === name;
}

function markNew(ids: ReadonlyArray<string>): void {
  if (ids.length === 0) {
    return;
  }
  lobbyState.newIds = [...new Set([...lobbyState.newIds, ...ids])];
  for (const id of ids) {
    const existing = decayTimers.get(id);
    if (existing !== undefined) {
      clearTimeout(existing);
    }
    decayTimers.set(id, window.setTimeout(() => {
      lobbyState.newIds = lobbyState.newIds.filter((x) => x !== id);
      decayTimers.delete(id);
    }, NEW_HIGHLIGHT_MS));
  }
}

const decayTimers = new Map<string, number>();

function clearHighlights(): void {
  for (const timer of decayTimers.values()) {
    clearTimeout(timer);
  }
  decayTimers.clear();
  lobbyState.newIds = [];
}

async function refreshLocal(name: string): Promise<void> {
  ensureLocalSource();
  const seq = nextSeq(LOCAL_SOURCE_ID);
  // «New» is only meaningful against a list we already VERIFIED: a first load
  // (or one seeded from the cross-session cache) would otherwise announce every
  // game the player has ever had as freshly arrived.
  const hadVerifiedList = localLobbySource()?.lastOkAt !== undefined;
  const known = new Set(lobbyState.localRows.map((r) => r.game.id));
  setSource(LOCAL_SOURCE_ID, {status: 'loading'});
  try {
    const games = await fetchLocal(name, 'active');
    if (!isCurrent(LOCAL_SOURCE_ID, seq, name)) {
      return;
    }
    lobbyState.localRows = games.map((game) => toRow(LOCAL_SOURCE_ID, 'local', '', undefined, game, false, false));
    lobbyState.hydrated = false;
    setSource(LOCAL_SOURCE_ID, {status: 'ok', lastOkAt: Date.now(), failures: 0});
    persistCache(name, games);
    if (hadVerifiedList) {
      markNew(games.filter((g) => !known.has(g.id)).map((g) => g.id));
    }
  } catch {
    if (!isCurrent(LOCAL_SOURCE_ID, seq, name)) {
      return;
    }
    const source = localLobbySource();
    setSource(LOCAL_SOURCE_ID, {status: 'unreachable', failures: (source?.failures ?? 0) + 1});
  }
}

async function refreshLan(source: LobbySource, name: string): Promise<void> {
  const host = hosts.get(source.id);
  if (host === undefined) {
    return;
  }
  const seq = nextSeq(source.id);
  setSource(source.id, {status: 'loading'});
  const cached = endpointCache.get(source.id);
  const candidates = host.addresses.map((a) => apiBaseOf(a, host.port));
  // A cached endpoint is tried FIRST and alone; if it has died we fall back to
  // the full sweep in the same tick, so a host that changed NIC self-heals
  // without waiting a whole poll interval.
  const hit = (cached !== undefined && candidates.includes(cached.apiBase) ?
    await probeFirst([cached.apiBase], name) : undefined) ??
    await probeFirst(candidates, name);
  if (!isCurrent(source.id, seq, name)) {
    return;
  }
  if (hit === undefined) {
    endpointCache.delete(source.id);
    const failures = (lobbySource(source.id)?.failures ?? 0) + 1;
    setSource(source.id, {status: 'unreachable', failures});
    // Keep showing what we last saw — but mark it, and give up after a few
    // rounds so a host that is off (yet still cached by mDNS) does not haunt
    // the list forever.
    lobbyState.lanRows = failures >= LAN_STALE_TOLERANCE ?
      lobbyState.lanRows.filter((row) => row.sourceId !== source.id) :
      lobbyState.lanRows.map((row) => row.sourceId === source.id ? {...row, stale: true} : row);
    return;
  }
  const endpoint: ServerEndpoint = {apiBase: hit.base, wsBase: wsBaseFromApiBase(hit.base)};
  endpointCache.set(source.id, endpoint);
  const current = lobbySource(source.id);
  const known = new Set(lobbyState.lanRows.filter((r) => r.sourceId === source.id).map((r) => r.game.id));
  const rows = hit.games.map((game) =>
    toRow(source.id, 'lan', host.name, endpoint, game, versionMismatch(host), false));
  lobbyState.lanRows = [...lobbyState.lanRows.filter((row) => row.sourceId !== source.id), ...rows];
  reorderLanRows();
  setSource(source.id, {status: 'ok', endpoint, lastOkAt: Date.now(), failures: 0});
  if (current?.lastOkAt !== undefined) {
    markNew(hit.games.filter((g) => !known.has(g.id)).map((g) => g.id));
  }
  openChannel(source.id, endpoint.wsBase);
}

/** LAN rows follow the source order so the list never reshuffles on a refresh. */
function reorderLanRows(): void {
  const order = new Map(lobbyState.sources.map((s, i) => [s.id, i]));
  lobbyState.lanRows = [...lobbyState.lanRows].sort((a, b) => {
    const bySource = (order.get(a.sourceId) ?? 0) - (order.get(b.sourceId) ?? 0);
    return bySource !== 0 ? bySource : b.game.createdTimeMs - a.game.createdTimeMs;
  });
}

let inFlight: Promise<void> | undefined;
/** A refresh asked for while one was running — replayed once it finishes. */
let pendingAgain = false;

/**
 * THE one refresh. Re-asks every source that is currently in scope (the local
 * server always; LAN hosts while the screen is open) and never trusts a cache.
 *
 * A call made while one is already running does not queue a second sweep and
 * does not get dropped either: it sets a replay flag, so a push that lands
 * mid-flight is answered exactly once, after the answer it might have missed.
 */
export function refreshLobby(opts: {archive?: boolean} = {}): Promise<void> {
  const name = lobbyState.identity;
  if (name === '') {
    ensureLocalSource();
    return Promise.resolve();
  }
  if (inFlight !== undefined) {
    pendingAgain = true;
    return inFlight;
  }
  lobbyState.refreshing = true;
  const lanSources = lobbyState.open ? lobbyState.sources.filter((s) => s.kind === 'lan') : [];
  const work: Array<Promise<void>> = [
    refreshLocal(name),
    ...lanSources.map((source) => refreshLan(source, name)),
  ];
  if (opts.archive === true || lobbyState.archiveStatus !== 'idle') {
    work.push(refreshArchive(name));
  }
  inFlight = Promise.all(work).then(() => undefined, () => undefined).then(() => {
    inFlight = undefined;
    lobbyState.refreshing = false;
    lobbyState.lastRefreshAt = Date.now();
    armPoll();
    if (pendingAgain) {
      pendingAgain = false;
      void refreshLobby();
    }
  });
  return inFlight;
}

const ARCHIVE_SOURCE_ID = 'archive';

async function refreshArchive(name: string): Promise<void> {
  const seq = nextSeq(ARCHIVE_SOURCE_ID);
  lobbyState.archiveStatus = 'loading';
  try {
    const games = await fetchLocal(name, 'finished');
    if (!isCurrent(ARCHIVE_SOURCE_ID, seq, name)) {
      return;
    }
    lobbyState.archive = games;
    lobbyState.archiveStatus = 'ok';
  } catch {
    if (isCurrent(ARCHIVE_SOURCE_ID, seq, name)) {
      lobbyState.archiveStatus = 'unreachable';
    }
  }
}

/** The archive slice, loaded on demand (the first toggle into it). */
export function loadLobbyArchive(): Promise<void> {
  const name = lobbyState.identity;
  return name === '' ? Promise.resolve() : refreshArchive(name);
}

// ── Push channels ──────────────────────────────────────────────────────────

const channels = new Map<string, LobbyChannelHandle>();
const channelBases = new Map<string, string>();
let pushTimer: number | undefined;

function openChannel(sourceId: string, wsBase: string): void {
  if (channelBases.get(sourceId) === wsBase) {
    return;
  }
  closeChannel(sourceId);
  if (wsBase === '') {
    return;
  }
  channelBases.set(sourceId, wsBase);
  // The health hook re-arms the poll the moment a channel starts or stops
  // carrying: the long «everything is pushing» interval must not outlive the
  // push it was granted for.
  channels.set(sourceId, openLobbyChannel(wsBase, () => onPush(sourceId), onChannelHealthChanged));
  updateLiveFlags();
}

function closeChannel(sourceId: string): void {
  channels.get(sourceId)?.close();
  channels.delete(sourceId);
  channelBases.delete(sourceId);
  setSource(sourceId, {live: false});
}

function closeAllChannels(): void {
  for (const id of [...channels.keys()]) {
    closeChannel(id);
  }
}

/**
 * A server says its game set moved. Debounced: one response can carry several
 * bumps (a save that also finished a game), and they must cost one re-ask.
 */
function onPush(_sourceId: string): void {
  if (pushTimer !== undefined) {
    return;
  }
  pushTimer = window.setTimeout(() => {
    pushTimer = undefined;
    void refreshLobby();
  }, PUSH_DEBOUNCE_MS);
}

function onChannelHealthChanged(): void {
  updateLiveFlags();
  armPoll();
}

function updateLiveFlags(): void {
  let changed = false;
  const next = lobbyState.sources.map((source) => {
    const base = channelBases.get(source.id);
    const live = base !== undefined && lobbyChannelHealthy(base);
    if (live !== source.live) {
      changed = true;
      return {...source, live};
    }
    return source;
  });
  if (changed) {
    lobbyState.sources = next;
  }
}

/** Every source in scope is pushing → the poll may stretch to its long interval. */
function allLive(): boolean {
  const scoped = lobbyState.sources.filter((s) => s.kind === 'local' || lobbyState.open);
  return scoped.length > 0 && scoped.every((s) => s.live);
}

// ── The fallback poll ──────────────────────────────────────────────────────

let pollTimer: number | undefined;

function pollIntervalMs(): number {
  updateLiveFlags();
  const live = allLive();
  if (lobbyState.open) {
    return live ? POLL_OPEN_LIVE_MS : POLL_OPEN_FALLBACK_MS;
  }
  return live ? POLL_IDLE_LIVE_MS : POLL_IDLE_FALLBACK_MS;
}

/**
 * Re-arm the single poll timer at the cadence the CURRENT state deserves. A
 * one-shot timer rather than an interval on purpose: the cadence is re-decided
 * after every refresh, so a channel that drops is answered within one tick.
 */
function armPoll(): void {
  if (pollTimer !== undefined) {
    clearTimeout(pollTimer);
    pollTimer = undefined;
  }
  if (!watching) {
    return;
  }
  pollTimer = window.setTimeout(() => {
    pollTimer = undefined;
    void refreshLobby();
  }, pollIntervalMs());
}

// ── Lifecycle ──────────────────────────────────────────────────────────────

let watching = false;
let stopLanWatch: (() => void) | undefined;

function onVisible(): void {
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
    return;
  }
  // Coming back from a suspended / backgrounded shell: timers were throttled
  // and the list is as old as the sleep was long. Re-ask, unless we just did.
  const age = lobbyState.lastRefreshAt === undefined ? Infinity : Date.now() - lobbyState.lastRefreshAt;
  if (age >= FOCUS_MIN_AGE_MS) {
    void refreshLobby();
  }
}

/**
 * Start the background watch: the local source only, live + slowly polled. This
 * is what keeps CONTINUE and the menu badge honest while the player is looking
 * at the main menu, without touching the LAN.
 */
export function startLobbyWatch(displayName: string): void {
  if (watching) {
    setLobbyIdentity(displayName);
    return;
  }
  watching = true;
  lobbyState.identity = displayName;
  ensureLocalSource();
  openChannel(LOCAL_SOURCE_ID, wsBaseUrl());
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
  }
  // Discovery pushes host add/remove asynchronously; a host that appears while
  // the list is OPEN must become a source (and be asked) without a poll tick.
  stopLanWatch = watch(
    () => [lanState.hosts, lanState.manual] as const,
    () => {
      syncLanSources();
      if (lobbyState.open) {
        void refreshLobby();
      }
    },
  );
  void refreshLobby();
}

export function stopLobbyWatch(): void {
  watching = false;
  lobbyState.open = false;
  if (pollTimer !== undefined) {
    clearTimeout(pollTimer);
    pollTimer = undefined;
  }
  if (pushTimer !== undefined) {
    clearTimeout(pushTimer);
    pushTimer = undefined;
  }
  stopLanWatch?.();
  stopLanWatch = undefined;
  closeAllChannels();
  clearHighlights();
  if (typeof window !== 'undefined') {
    window.removeEventListener('focus', onVisible);
    document.removeEventListener('visibilitychange', onVisible);
  }
}

/**
 * The player opened «Мои партии». This ALWAYS re-asks — the screen showing
 * something is never a reason not to check whether it is still true.
 */
export function openLobbyList(): Promise<void> {
  lobbyState.open = true;
  syncLanSources();
  return refreshLobby();
}

export function closeLobbyList(): void {
  lobbyState.open = false;
  for (const source of lobbyState.sources) {
    if (source.kind === 'lan') {
      closeChannel(source.id);
    }
  }
  syncLanSources();
  armPoll();
}

/**
 * The active profile changed (or resolved for the first time). Everything the
 * old name produced is dropped, and the new one is asked immediately — this is
 * the path that used to not exist, which is why a late identity meant an empty
 * list until the app was restarted.
 */
export function setLobbyIdentity(displayName: string): void {
  if (lobbyState.identity === displayName) {
    return;
  }
  lobbyState.identity = displayName;
  lobbyState.localRows = [];
  lobbyState.lanRows = [];
  lobbyState.archive = [];
  lobbyState.archiveStatus = 'idle';
  lobbyState.hydrated = false;
  clearHighlights();
  lobbyState.sources = lobbyState.sources.map((s) => ({...s, status: 'idle', lastOkAt: undefined, failures: 0}));
  if (watching) {
    void refreshLobby();
  }
}

/** Tests: full teardown of the module's shared state. */
export function resetLobbyStateForTesting(): void {
  stopLobbyWatch();
  seqs.clear();
  endpointCache.clear();
  hosts = new Map();
  ownVersion = '';
  inFlight = undefined;
  pendingAgain = false;
  lobbyState.identity = '';
  lobbyState.sources = [];
  lobbyState.localRows = [];
  lobbyState.lanRows = [];
  lobbyState.archive = [];
  lobbyState.archiveStatus = 'idle';
  lobbyState.refreshing = false;
  lobbyState.newIds = [];
  lobbyState.lastRefreshAt = undefined;
  lobbyState.hydrated = false;
}
