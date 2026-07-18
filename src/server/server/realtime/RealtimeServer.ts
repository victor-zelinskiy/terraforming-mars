import {WebSocket, WebSocketServer, RawData} from 'ws';
import type {IncomingMessage, Server as HttpServer} from 'http';
import type {Server as HttpsServer} from 'https';
import type {Duplex} from 'stream';
import prometheus from 'prom-client';
import {paths} from '@/common/app/paths';
import {GameId} from '@/common/Types';
import {buildVersionLabel} from '@/common/utils/buildVersion';
import {runId} from '@/server/utils/server-ids';
import raw_settings from '@/genfiles/settings.json';
import {RealtimeHub} from './RealtimeHub';
import {
  ClientMessageType,
  REALTIME_PROTOCOL_VERSION,
  ResumeGameMessage,
  ServerMessage,
  SubscribeGameMessage,
  gameStateInvalidated,
  parseClientMessage,
  protocolIncompatible,
  serializeMessage,
  serverError,
  serverHello,
  serverPong,
  subscribed,
} from '@/common/realtime/Protocol';

/**
 * Phase 1 realtime WebSocket gateway.
 *
 * Attaches a `ws` server to the existing HTTP(S) server on the `/ws` upgrade
 * path (behind the REALTIME_ENABLED flag), performs the hello handshake and a
 * heartbeat, and logs connect / disconnect / heartbeat. It does NOT yet do game
 * subscription, rooms, broadcasting, or any game mutation — those are later
 * phases. Nothing here touches gameplay.
 */

const HEARTBEAT_INTERVAL_MS = 30_000;
const WS_UPGRADE_PATH = '/' + paths.WEBSOCKET;

const metrics = {
  activeConnections: new prometheus.Gauge({
    name: 'realtime_active_connections',
    help: 'Number of currently open realtime WebSocket connections',
    registers: [prometheus.register],
  }),
  connectionsTotal: new prometheus.Counter({
    name: 'realtime_connections_total',
    help: 'Total realtime WebSocket connections accepted',
    registers: [prometheus.register],
  }),
};

/**
 * Reads the server master switch. **Default ON** — WebSocket is the primary
 * realtime mechanism (Phase 12). Opt out with `REALTIME_ENABLED=0` / `false` /
 * `off`, which restores byte-identical legacy polling (the WS gateway is never
 * attached and every broadcast goes to an empty room).
 */
export function realtimeEnabled(): boolean {
  const v = (process.env.REALTIME_ENABLED ?? '').trim().toLowerCase();
  return v !== '0' && v !== 'false' && v !== 'off';
}

/**
 * Verbose per-connection realtime logging (connect / hello / subscribe /
 * unsubscribe / disconnect / resume / heartbeat) is OFF by default to keep the
 * server log quiet. Enable with `REALTIME_LOG=verbose` (or `debug` / `1` /
 * `true`). Warnings and errors always log regardless.
 */
function realtimeVerbose(): boolean {
  const v = (process.env.REALTIME_LOG ?? '').trim().toLowerCase();
  return v === 'verbose' || v === 'debug' || v === '1' || v === 'true';
}
function vlog(message: string): void {
  if (realtimeVerbose()) {
    console.log(message);
  }
}

class RealtimeConnection {
  public participantId: string | undefined = undefined;
  /** Set once the connection has joined a game room (Phase 2). */
  public gameId: GameId | undefined = undefined;
  public helloReceived = false;
  /** Heartbeat liveness flag, reset on every ws-level pong. */
  public isAlive = true;

  constructor(public readonly id: number, public readonly ws: WebSocket) {}

  public send(message: ServerMessage): void {
    if (this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    try {
      this.ws.send(serializeMessage(message));
    } catch (err) {
      console.warn(`[realtime] send failed #${this.id}:`, err);
    }
  }
}

export class RealtimeServer {
  private static instance: RealtimeServer | undefined;

  private wss: WebSocketServer | undefined;
  private readonly connections = new Set<RealtimeConnection>();
  private heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  private nextConnectionId = 1;
  private readonly hub: RealtimeHub;

  private constructor(hub: RealtimeHub = RealtimeHub.getInstance()) {
    this.hub = hub;
  }

  public static getInstance(): RealtimeServer {
    if (RealtimeServer.instance === undefined) {
      RealtimeServer.instance = new RealtimeServer();
    }
    return RealtimeServer.instance;
  }

  /** A fresh, non-singleton instance for tests (own http server + hub, clean teardown). */
  public static newInstanceForTesting(hub?: RealtimeHub): RealtimeServer {
    return new RealtimeServer(hub);
  }

  /**
   * Wire the WebSocket gateway onto an existing HTTP(S) server. No-op (with a
   * log line) when disabled. `options.enabled` overrides the env flag — used by
   * tests to force-enable.
   */
  public attach(server: HttpServer | HttpsServer, options: {enabled?: boolean} = {}): void {
    const enabled = options.enabled ?? realtimeEnabled();
    if (!enabled) {
      console.log('[realtime] WebSocket gateway disabled via REALTIME_ENABLED (default is enabled) — legacy polling only');
      return;
    }
    if (this.wss !== undefined) {
      return;
    }
    this.wss = new WebSocketServer({noServer: true});
    server.on('upgrade', (req, socket, head) => this.onUpgrade(req, socket as Duplex, head));
    this.startHeartbeat();
    console.log(`[realtime] WebSocket gateway enabled on ${WS_UPGRADE_PATH}`);
  }

  public getActiveConnectionCount(): number {
    return this.connections.size;
  }

  /** Tear everything down (tests / graceful shutdown). */
  public close(): void {
    if (this.heartbeatTimer !== undefined) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
    for (const conn of this.connections) {
      this.hub.handleDisconnect(conn);
      try {
        conn.ws.terminate();
      } catch {
        // ignore
      }
    }
    this.connections.clear();
    metrics.activeConnections.set(0);
    if (this.wss !== undefined) {
      this.wss.close();
      this.wss = undefined;
    }
  }

  private onUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
    let pathname = '';
    try {
      pathname = new URL(req.url ?? '', `http://${req.headers.host}`).pathname;
    } catch {
      pathname = '';
    }
    if (pathname !== WS_UPGRADE_PATH || this.wss === undefined) {
      // Not ours — refuse cleanly rather than leaving the socket hanging.
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }
    this.wss.handleUpgrade(req, socket, head, (ws) => this.onConnection(ws));
  }

  private onConnection(ws: WebSocket): void {
    const conn = new RealtimeConnection(this.nextConnectionId++, ws);
    this.connections.add(conn);
    metrics.activeConnections.set(this.connections.size);
    metrics.connectionsTotal.inc();
    vlog(`[realtime] connect #${conn.id} (active=${this.connections.size})`);

    ws.on('message', (data) => this.onMessage(conn, data));
    ws.on('pong', () => {
      conn.isAlive = true;
    });
    ws.on('close', (code) => {
      this.hub.handleDisconnect(conn);
      this.connections.delete(conn);
      metrics.activeConnections.set(this.connections.size);
      vlog(`[realtime] disconnect #${conn.id} code=${code} (active=${this.connections.size})`);
    });
    ws.on('error', (err) => {
      // Abrupt closes (tab reload / navigate-away → ECONNRESET / code 1006) fire
      // here routinely and are not actionable, so keep it verbose-only.
      vlog(`[realtime] socket error #${conn.id}: ${String((err as {message?: string})?.message ?? err)}`);
    });
  }

  private onMessage(conn: RealtimeConnection, data: RawData): void {
    const message = parseClientMessage(data.toString());
    if (message === undefined) {
      this.send(conn, serverError('bad-message', 'Malformed or unknown message.'));
      return;
    }
    if (message.protocolVersion !== REALTIME_PROTOCOL_VERSION) {
      this.send(conn, protocolIncompatible());
      return;
    }
    switch (message.type) {
    case ClientMessageType.HELLO:
      conn.participantId = message.participantId;
      conn.helloReceived = true;
      vlog(`[realtime] hello #${conn.id} client=${message.clientVersion} participant=${message.participantId ?? '(none)'}`);
      this.send(conn, serverHello(runId, buildVersionLabel(raw_settings), message.correlationId));
      break;
    case ClientMessageType.PING:
      conn.isAlive = true;
      this.send(conn, serverPong(message.correlationId));
      break;
    case ClientMessageType.SUBSCRIBE:
      void this.handleSubscribe(conn, message);
      break;
    case ClientMessageType.RESUME:
      void this.handleResume(conn, message);
      break;
    case ClientMessageType.UNSUBSCRIBE:
      this.hub.unsubscribe(conn);
      vlog(`[realtime] unsubscribe #${conn.id}`);
      break;
    }
  }

  private async handleSubscribe(conn: RealtimeConnection, message: SubscribeGameMessage): Promise<void> {
    if (typeof message.participantId !== 'string' || message.participantId === '') {
      this.send(conn, serverError('invalid-participant', 'Missing participant id.', message.correlationId));
      return;
    }
    const result = await this.hub.subscribe(conn, message.participantId);
    // The socket may have closed while the async lookup was in flight.
    if (conn.ws.readyState !== WebSocket.OPEN) {
      this.hub.unsubscribe(conn);
      return;
    }
    if (!result.ok) {
      console.warn(`[realtime] subscribe rejected #${conn.id} participant=${message.participantId}`);
      this.send(conn, serverError('subscribe-rejected', 'Not authorized for any game.', message.correlationId));
      return;
    }
    vlog(`[realtime] subscribe #${conn.id} game=${result.gameId} roomSize=${result.roomSize}`);
    this.send(conn, subscribed(result.gameAge ?? 0, result.undoCount ?? 0, message.correlationId));
  }

  /**
   * Phase 5 resume. Re-join the room like a subscribe, ack SUBSCRIBED with the
   * CURRENT cursor, and — if the game advanced past the client's last-known
   * cursor while it was away — send it an invalidation so it full-refreshes. The
   * invalidation is per-connection (only the reconnecting client needs to catch
   * up), and the client's own /api/waitingfor comparison is the final authority,
   * so a redundant refresh is harmless and a missed change is impossible.
   */
  private async handleResume(conn: RealtimeConnection, message: ResumeGameMessage): Promise<void> {
    if (typeof message.participantId !== 'string' || message.participantId === '') {
      this.send(conn, serverError('invalid-participant', 'Missing participant id.', message.correlationId));
      return;
    }
    const result = await this.hub.subscribe(conn, message.participantId);
    if (conn.ws.readyState !== WebSocket.OPEN) {
      this.hub.unsubscribe(conn);
      return;
    }
    if (!result.ok || result.gameId === undefined) {
      console.warn(`[realtime] resume rejected #${conn.id} participant=${message.participantId}`);
      this.send(conn, serverError('subscribe-rejected', 'Not authorized for any game.', message.correlationId));
      return;
    }
    const currentGameAge = result.gameAge ?? 0;
    const currentUndoCount = result.undoCount ?? 0;
    const changed = currentGameAge !== message.lastGameAge || currentUndoCount !== message.lastUndoCount;
    vlog(`[realtime] resume #${conn.id} game=${result.gameId} last=(${message.lastGameAge},${message.lastUndoCount}) current=(${currentGameAge},${currentUndoCount}) changed=${changed}`);
    this.send(conn, subscribed(currentGameAge, currentUndoCount, message.correlationId));
    if (changed) {
      this.send(conn, gameStateInvalidated(result.gameId, currentGameAge, currentUndoCount));
    }
  }

  private send(conn: RealtimeConnection, message: ServerMessage): void {
    conn.send(message);
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      for (const conn of this.connections) {
        if (!conn.isAlive) {
          vlog(`[realtime] heartbeat timeout #${conn.id} — terminating`);
          conn.ws.terminate();
          continue;
        }
        conn.isAlive = false;
        try {
          conn.ws.ping();
        } catch {
          // ignore — the close/error handler will clean up
        }
      }
    }, HEARTBEAT_INTERVAL_MS);
    // Don't keep the process alive just for the heartbeat.
    this.heartbeatTimer.unref?.();
  }
}
