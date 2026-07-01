import {reactive} from 'vue';
import raw_settings from '@/genfiles/settings.json';
import {
  ServerMessageType,
  clientHello,
  clientPing,
  parseServerMessage,
  resumeGame,
  serializeMessage,
  subscribeGame,
  unsubscribeGame,
} from '@/common/realtime/Protocol';
import {isRealtimeDebug, realtimeClientEnabled, realtimePollReductionEnabled, realtimeRefreshEnabled, realtimeWsUrl} from './realtimeConfig';
import {notifyGameInvalidated, resetRealtimeSync, wakeNow} from './realtimeSync';
import {isPongStale, isRealtimeHealthy, pollIntervalMs} from './pollPolicy';

/**
 * Phase 1 realtime client service — a module SINGLETON (survives the App-level
 * `playerkey` remount, like journalState / notificationState). It owns the one
 * WebSocket connection and exposes a reactive status for a dev-only indicator.
 *
 * IMPORTANT (per the migration plan): this service does NOTHING to gameplay in
 * Phase 1. It connects, says hello, heartbeats, and tracks status. It never
 * triggers a refresh, never touches `waitForUpdate`, never remounts anything.
 * UI components must read `realtimeState`; they must never touch the socket.
 */

export type RealtimeStatus =
  | 'disabled'      // not started / flag off
  | 'connecting'    // first connect in progress
  | 'connected'     // socket open (hello may still be pending)
  | 'reconnecting'  // dropped, retrying
  | 'closed'        // stopped, no retry
  | 'error';        // protocol-incompatible or fatal

export interface RealtimeState {
  status: RealtimeStatus;
  helloAcked: boolean;
  /** True once the connection has joined its game room (Phase 2). */
  subscribed: boolean;
  lastConnectedAt: number | undefined;
  lastPongAt: number | undefined;
  reconnectAttempts: number;
  serverVersion: string | undefined;
  participantId: string | undefined;
  /**
   * Authoritative version cursor last reported by the server for the subscribed
   * game. Phase 2 only RECORDS this (baseline for the Phase 5 resume model); it
   * does NOT drive any refresh.
   */
  lastKnownGameAge: number | undefined;
  lastKnownUndoCount: number | undefined;
  /**
   * Phase 3 observe-only diagnostics: how many invalidations we've received and
   * the version cursor the latest one advertised. These do NOT drive any
   * refresh yet (Phase 4 wires invalidation to the guarded refresh path).
   */
  invalidationsReceived: number;
  lastInvalidationGameAge: number | undefined;
  lastInvalidationUndoCount: number | undefined;
  /** How many times we've re-subscribed via RESUME after a reconnect (Phase 5). */
  resumeAttempts: number;
}

export const realtimeState: RealtimeState = reactive({
  status: 'disabled',
  helloAcked: false,
  subscribed: false,
  lastConnectedAt: undefined,
  lastPongAt: undefined,
  reconnectAttempts: 0,
  serverVersion: undefined,
  participantId: undefined,
  lastKnownGameAge: undefined,
  lastKnownUndoCount: undefined,
  invalidationsReceived: 0,
  lastInvalidationGameAge: undefined,
  lastInvalidationUndoCount: undefined,
  resumeAttempts: 0,
});

/** Strict WS health for the Phase 6 poll-reduction decision. */
export function realtimeHealthy(): boolean {
  return isRealtimeHealthy(realtimeState, Date.now());
}

/**
 * The interval WaitingFor should use for its next poll: the stretched long
 * interval only when WS is strictly healthy AND reduction is enabled, else the
 * caller's safe interval. Re-evaluated every poll cycle, so a health change
 * takes effect on the next re-arm (and a drop wakes an immediate re-arm).
 */
export function realtimePollIntervalMs(safeMs: number): number {
  return pollIntervalMs(realtimeHealthy(), realtimePollReductionEnabled(), safeMs);
}

const PING_INTERVAL_MS = 25_000;
// Reconnect uses capped exponential backoff so an unreachable/mis-flagged
// gateway (e.g. server without REALTIME_ENABLED) doesn't hammer /ws every few
// seconds. The backoff resets to the base on each successful connection. Full
// resume / missed-event recovery is Phase 5 — not built here.
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const RECONNECT_MAX_EXPONENT = 5; // 1s, 2s, 4s, 8s, 16s, then capped at 30s

const clientVersion: string = (raw_settings as {head?: string}).head ?? 'dev';

function log(...args: ReadonlyArray<unknown>): void {
  if (isRealtimeDebug()) {
    console.log('[realtime]', ...args);
  }
}

class RealtimeService {
  private ws: WebSocket | undefined;
  private started = false;
  private participantId: string | undefined;
  private pingTimer: ReturnType<typeof setInterval> | undefined;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  /**
   * On returning to the tab (after sleep / background), if the socket isn't
   * healthy, reconnect NOW rather than waiting out the backoff — so resume is
   * snappy. Stable reference so add/removeEventListener dedupe correctly.
   */
  private readonly onVisible = (): void => {
    if (!this.started || !realtimeClientEnabled()) {
      return;
    }
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      return;
    }
    if (this.ws === undefined || this.ws.readyState !== WebSocket.OPEN) {
      log('tab visible & socket not open — reconnecting now');
      realtimeState.reconnectAttempts = 0;
      this.clearReconnect();
      this.connect();
    }
  };

  private bindVisibility(): void {
    if (typeof document === 'undefined') {
      return;
    }
    document.addEventListener('visibilitychange', this.onVisible);
    window.addEventListener('focus', this.onVisible);
  }

  private unbindVisibility(): void {
    if (typeof document === 'undefined') {
      return;
    }
    document.removeEventListener('visibilitychange', this.onVisible);
    window.removeEventListener('focus', this.onVisible);
  }

  /** Begin (or re-point) the connection for a game screen. Idempotent per id. */
  public start(options: {participantId: string}): void {
    if (this.started && this.participantId === options.participantId && this.ws !== undefined) {
      return;
    }
    this.participantId = options.participantId;
    realtimeState.participantId = options.participantId;
    this.started = true;
    if (!realtimeClientEnabled()) {
      realtimeState.status = 'disabled';
      log('client transport disabled (flag off) — not connecting');
      return;
    }
    realtimeState.reconnectAttempts = 0;
    this.bindVisibility();
    this.connect();
  }

  /** Stop and close. Called when leaving the game screen. */
  public stop(): void {
    this.started = false;
    this.unbindVisibility();
    this.clearTimers();
    // Drop any pending coalesced wake so a stray refresh can't fire after we've
    // left the game.
    resetRealtimeSync();
    if (this.ws !== undefined) {
      // Best-effort clean leave so the server drops us from the room promptly
      // (the close handler would clean up anyway).
      if (this.ws.readyState === WebSocket.OPEN) {
        this.sendRaw(serializeMessage(unsubscribeGame()));
      }
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = undefined;
    }
    realtimeState.status = 'disabled';
    realtimeState.helloAcked = false;
    realtimeState.subscribed = false;
    log('stopped');
  }

  /**
   * Join our game room. On the FIRST connect we plain-subscribe; once we already
   * hold a version cursor (i.e. after a reconnect) we RESUME with it, so the
   * server can tell us to full-refresh if the game moved while we were away.
   * Safe to call repeatedly (server is idempotent).
   */
  private subscribe(): void {
    if (this.participantId === undefined || this.participantId === '') {
      return;
    }
    const gameAge = realtimeState.lastKnownGameAge;
    const undoCount = realtimeState.lastKnownUndoCount;
    if (gameAge !== undefined && undoCount !== undefined) {
      realtimeState.resumeAttempts += 1;
      this.sendRaw(serializeMessage(resumeGame(this.participantId, gameAge, undoCount)));
    } else {
      this.sendRaw(serializeMessage(subscribeGame(this.participantId)));
    }
  }

  private connect(): void {
    this.clearReconnect();
    realtimeState.status = realtimeState.reconnectAttempts > 0 ? 'reconnecting' : 'connecting';
    let socket: WebSocket;
    try {
      socket = new WebSocket(realtimeWsUrl());
    } catch (err) {
      log('connect threw', err);
      this.scheduleReconnect();
      return;
    }
    this.ws = socket;

    socket.onopen = () => {
      realtimeState.status = 'connected';
      realtimeState.lastConnectedAt = Date.now();
      // Successful connect — reset the backoff so a future drop retries fast.
      realtimeState.reconnectAttempts = 0;
      log('open ->', realtimeWsUrl());
      this.sendRaw(serializeMessage(clientHello(clientVersion, this.participantId)));
      this.startPing();
    };
    socket.onmessage = (ev) => this.onMessage(typeof ev.data === 'string' ? ev.data : String(ev.data));
    socket.onerror = () => {
      log('socket error');
      // onclose fires next and handles reconnect.
    };
    socket.onclose = (ev) => {
      this.stopPing();
      if (this.ws === socket) {
        this.ws = undefined;
      }
      realtimeState.helloAcked = false;
      realtimeState.subscribed = false;
      if (!this.started) {
        realtimeState.status = 'closed';
        return;
      }
      if (realtimeState.status === 'error') {
        // Protocol-incompatible: do not spin reconnecting.
        return;
      }
      log('closed code=', ev.code, '- scheduling reconnect');
      this.scheduleReconnect();
      this.pollFallbackWake();
    };
  }

  private onMessage(raw: string): void {
    const message = parseServerMessage(raw);
    if (message === undefined) {
      log('ignored malformed server message');
      return;
    }
    switch (message.type) {
    case ServerMessageType.HELLO:
      realtimeState.helloAcked = true;
      realtimeState.serverVersion = message.serverVersion;
      log('hello acked; server=', message.serverVersion);
      // Join our game room as soon as the handshake completes (also re-runs
      // automatically after a reconnect, since connect() always re-hellos).
      this.subscribe();
      break;
    case ServerMessageType.PONG:
      realtimeState.lastPongAt = Date.now();
      break;
    case ServerMessageType.SUBSCRIBED:
      realtimeState.subscribed = true;
      realtimeState.lastKnownGameAge = message.gameAge;
      realtimeState.lastKnownUndoCount = message.undoCount;
      log('subscribed; gameAge=', message.gameAge, 'undoCount=', message.undoCount);
      break;
    case ServerMessageType.INVALIDATED:
      // Record + log (observe), then — Phase 4 — hand off to the sync
      // coordinator, which coalesces bursts and WAKES the existing guarded
      // refresh path (WaitingFor.waitForUpdate(true)). We never refresh directly
      // here. Gated by realtimeRefreshEnabled() so the wiring can be disabled
      // independently of the transport (falls back to observe-only + polling).
      realtimeState.invalidationsReceived += 1;
      realtimeState.lastInvalidationGameAge = message.gameAge;
      realtimeState.lastInvalidationUndoCount = message.undoCount;
      // Track the latest server-advertised cursor so a later RESUME sends it.
      realtimeState.lastKnownGameAge = message.gameAge;
      realtimeState.lastKnownUndoCount = message.undoCount;
      log('invalidation gameAge=', message.gameAge, 'undoCount=', message.undoCount, 'phase=', message.phase);
      if (realtimeRefreshEnabled()) {
        notifyGameInvalidated();
      }
      break;
    case ServerMessageType.ERROR:
      if (message.code === 'subscribe-rejected' || message.code === 'invalid-participant') {
        realtimeState.subscribed = false;
      }
      log('server error', message.code, message.message);
      break;
    case ServerMessageType.PROTOCOL_INCOMPATIBLE:
      log('protocol incompatible — stopping realtime, falling back to polling');
      realtimeState.status = 'error';
      this.started = false;
      this.clearTimers();
      // Ensure the poller returns to the safe interval right away.
      this.pollFallbackWake();
      break;
    }
  }

  private sendRaw(data: string): void {
    if (this.ws !== undefined && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      // Liveness: if the server has gone silent past the stale threshold the
      // socket is a zombie — force a reconnect so health + resume recover and
      // the poller falls back to the safe interval.
      if (isPongStale(realtimeState.lastPongAt, realtimeState.lastConnectedAt, Date.now())) {
        log('heartbeat stale — forcing reconnect');
        this.forceReconnect();
        return;
      }
      this.sendRaw(serializeMessage(clientPing()));
    }, PING_INTERVAL_MS);
  }

  /** Tear down a (possibly zombie) socket and drive a reconnect ourselves. */
  private forceReconnect(): void {
    const dead = this.ws;
    this.ws = undefined;
    if (dead !== undefined) {
      dead.onopen = null;
      dead.onmessage = null;
      dead.onerror = null;
      dead.onclose = null;
      try {
        dead.close();
      } catch {
        // ignore
      }
    }
    this.stopPing();
    realtimeState.helloAcked = false;
    realtimeState.subscribed = false;
    this.scheduleReconnect();
    this.pollFallbackWake();
  }

  /** WS became unhealthy — wake the poller so it re-arms at the safe interval now. */
  private pollFallbackWake(): void {
    if (realtimePollReductionEnabled()) {
      wakeNow();
    }
  }

  private stopPing(): void {
    if (this.pingTimer !== undefined) {
      clearInterval(this.pingTimer);
      this.pingTimer = undefined;
    }
  }

  private scheduleReconnect(): void {
    if (!this.started || !realtimeClientEnabled()) {
      return;
    }
    this.clearReconnect();
    realtimeState.status = 'reconnecting';
    realtimeState.reconnectAttempts += 1;
    const exponent = Math.min(realtimeState.reconnectAttempts - 1, RECONNECT_MAX_EXPONENT);
    const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * (2 ** exponent));
    log('reconnect in', delay, 'ms (attempt', realtimeState.reconnectAttempts, ')');
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer !== undefined) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  private clearTimers(): void {
    this.stopPing();
    this.clearReconnect();
  }
}

export const realtimeService = new RealtimeService();
