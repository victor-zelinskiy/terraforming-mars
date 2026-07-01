import {reactive} from 'vue';
import raw_settings from '@/genfiles/settings.json';
import {
  ServerMessageType,
  clientHello,
  clientPing,
  parseServerMessage,
  serializeMessage,
  subscribeGame,
  unsubscribeGame,
} from '@/common/realtime/Protocol';
import {isRealtimeDebug, realtimeClientEnabled, realtimeWsUrl} from './realtimeConfig';

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
});

const PING_INTERVAL_MS = 25_000;
// Phase 1 reconnect is intentionally simple (fixed delay). Proper backoff +
// resume/full-snapshot recovery is Phase 5 — do not build it here.
const RECONNECT_DELAY_MS = 3_000;

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
    this.connect();
  }

  /** Stop and close. Called when leaving the game screen. */
  public stop(): void {
    this.started = false;
    this.clearTimers();
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

  /** Join our game room. Safe to call repeatedly (server is idempotent). */
  private subscribe(): void {
    if (this.participantId === undefined || this.participantId === '') {
      return;
    }
    this.sendRaw(serializeMessage(subscribeGame(this.participantId)));
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
      this.sendRaw(serializeMessage(clientPing()));
    }, PING_INTERVAL_MS);
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
    this.reconnectTimer = setTimeout(() => this.connect(), RECONNECT_DELAY_MS);
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
