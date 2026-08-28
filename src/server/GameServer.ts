/**
 * The game server as a LIBRARY (docs/EMBEDDED_SERVER.md).
 *
 * Everything the standalone CLI (`server.ts`) used to do at startup, behind a
 * single `startGameServer()` call — so the SAME server (same routes, same
 * realtime gateway, same server-authoritative bot pacing) can also run inside
 * the desktop app's utility process (host-as-server mode). Callers:
 *   - `src/server/server.ts` — the Heroku / dev CLI (thin wrapper);
 *   - `src/server/embedded/embeddedServerMain.ts` — the desktop embedded entry.
 *
 * Deliberately NOT here: dotenv, console-stamp, the uncaughtException hook and
 * the serverId console banner — each host process owns its own environment,
 * logging and crash policy.
 */
import https from 'https';
import http from 'http';
import fs from 'fs';
import * as v8 from 'node:v8';
import prometheus from 'prom-client';
import * as responses from './server/responses';

import {Database} from './database/Database';
import {processRequest} from './server/requestProcessor';
import {timeAsync} from './utils/timer';
import {GameLoader} from './database/GameLoader';
import {globalInitialize} from './globalInitialize';
import {getBehaviorExecutor} from './behavior/BehaviorExecutor';
import {SessionManager} from './server/auth/SessionManager';
import {RealtimeServer} from './server/realtime/RealtimeServer';
import {RealtimeHub} from './server/realtime/RealtimeHub';
import {gameLoaderSubscriptionResolver} from './server/realtime/subscriptionResolver';
import {LobbyIndex} from './models/lobbyIndex';
import {BotTurnScheduler} from './automa/BotTurnScheduler';

export type GameServerOptions = {
  /** TCP port to listen on. `0` picks an ephemeral port. Default: env `PORT`, else 8080. */
  port?: number | string;
  /** Bind host (e.g. '127.0.0.1' loopback-only, '0.0.0.0' all interfaces). Default: env `HOST`. */
  host?: string;
  /**
   * Server-authoritative MarsBot turn pacing (bounded timers instead of resolving
   * the bot inside the human's request). Default true — production behavior.
   */
  enableBotScheduler?: boolean;
  /** Register prom-client default process metrics (once per process). Default true. */
  collectDefaultMetrics?: boolean;
};

export type RunningGameServer = {
  readonly server: http.Server | https.Server;
  /** The actually-bound port (meaningful when options.port was 0). */
  readonly port: number;
  /** Close the realtime gateway and the HTTP server (open sockets are dropped). */
  stop(): Promise<void>;
};

const metrics = {
  startDatabase: new prometheus.Gauge({
    name: 'server_start_database',
    help: 'Time to initialize the database',
    registers: [prometheus.register],
  }),
  // The V8 old-space ceiling. Compare against heap usage to see OOM headroom.
  // Not included in prom-client's default metrics.
  heapSizeLimit: new prometheus.Gauge({
    name: 'nodejs_heap_size_limit_bytes',
    help: 'V8 heap size limit in bytes',
    registers: [prometheus.register],
    collect() {
      this.set(v8.getHeapStatistics().heap_size_limit);
    },
  }),
  // A non-zero (and growing) value is a strong memory-leak signal.
  detachedContexts: new prometheus.Gauge({
    name: 'nodejs_detached_contexts',
    help: 'Number of detached V8 contexts (a memory-leak signal)',
    registers: [prometheus.register],
    collect() {
      this.set(v8.getHeapStatistics().number_of_detached_contexts);
    },
  }),
};

function requestHandler(req: http.IncomingMessage, res: http.ServerResponse): void {
  try {
    processRequest(req, res);
  } catch (error) {
    responses.internalServerError(req, res, error);
  }
}

function createServer(): http.Server | https.Server {
  // If they've set up https
  if (process.env.KEY_PATH && process.env.CERT_PATH) {
    const httpsHowto =
  'https://nodejs.org/en/knowledge/HTTP/servers/how-to-create-a-HTTPS-server/';
    if (!fs.existsSync(process.env.KEY_PATH)) {
      console.error(
        'TLS KEY_PATH is set in .env, but cannot find key! Check out ' +
    httpsHowto,
      );
    } else if (!fs.existsSync(process.env.CERT_PATH)) {
      console.error(
        'TLS CERT_PATH is set in .env, but cannot find cert! Check out' +
    httpsHowto,
      );
    }
    const options = {
      key: fs.readFileSync(process.env.KEY_PATH),
      cert: fs.readFileSync(process.env.CERT_PATH),
    };
    return https.createServer(options, requestHandler);
  } else {
    return http.createServer(requestHandler);
  }
}

function listen(server: http.Server | https.Server, port: number | string, host: string | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (err: Error) => {
      server.off('listening', onListening);
      reject(err);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen({port, host});
  });
}

// Both are once-per-process operations, but startGameServer may legitimately be
// called again in the same process (a restart after stop(), a spec exercising
// both): prom-client throws on re-registering default metrics and
// SessionManager.initialize() throws on a second call.
let defaultMetricsCollected = false;
let sessionsInitialized = false;

export async function startGameServer(options: GameServerOptions = {}): Promise<RunningGameServer> {
  prometheus.register.setDefaultLabels({
    app: 'terraforming-mars-app',
  });
  if ((options.collectDefaultMetrics ?? true) && !defaultMetricsCollected) {
    defaultMetricsCollected = true;
    prometheus.collectDefaultMetrics();
  }
  // registerBehaviorExecutor throws on a second registration — tolerate a host
  // process (mocha's setup, a restart after stop()) that already initialized.
  try {
    getBehaviorExecutor();
  } catch {
    globalInitialize();
  }

  const server = createServer();

  // Realtime: wire the game-subscription lookup here; the WebSocket gateway
  // itself is attached only once this server is actually LISTENING (below).
  RealtimeHub.getInstance().configureResolver(gameLoaderSubscriptionResolver);
  // ...and the LOBBY channel: every change to the lobby index (a game created,
  // finished, deleted, or a listed field that moved) becomes one broadcast to
  // the menus watching "My games". Injected here rather than imported by the
  // index, so `GameLoader -> lobbyIndex -> RealtimeHub` can never cycle.
  LobbyIndex.getInstance().onRevisionChanged((revision) => {
    RealtimeHub.getInstance().invalidateLobby(revision);
  });

  // Server-authoritative MarsBot turn pacing: the bot's turn resolves on a
  // bounded, non-blocking server timer (players first see it become the active
  // player, then it acts) instead of synchronously inside the human's request.
  // OFF by default in tests so the bot resolves inline; ON for a real server.
  if (options.enableBotScheduler ?? true) {
    BotTurnScheduler.getInstance().enable();
  }

  await timeAsync(Database.getInstance().initialize())
    .then((v) => {
      metrics.startDatabase.set(v.duration);
    });

  // Initialize the session manager after initializing the database.
  if (!sessionsInitialized) {
    sessionsInitialized = true;
    await SessionManager.getInstance().initialize();
  }

  try {
    Database.getInstance().stats().then((stats) => {
      console.log(JSON.stringify(stats, undefined, 2));
    });
  } catch (err) {
    // Do not fail. Just continue. Stats aren't vital.
    console.error(err);
  }
  GameLoader.getInstance().maintenance();

  const port = options.port ?? process.env.PORT ?? 8080;
  const host = options.host ?? process.env.HOST;
  await listen(server, port, host);

  // Attach the gateway to the server that really listens, and only after the
  // bind succeeded. Attaching earlier poisoned the process-wide RealtimeServer
  // singleton whenever the bind failed: the embedded server's EADDRINUSE
  // fallback (embeddedServerMain.ts) starts a SECOND server, whose attach() then
  // no-op'd — leaving it without an 'upgrade' listener, so Node handed every
  // /ws handshake to the normal router (404 'Not found GET /ws') and the client
  // reconnect-looped forever on legacy polling. No-op if REALTIME_ENABLED
  // disables it — gameplay is untouched.
  RealtimeServer.getInstance().attach(server);

  const address = server.address();
  const boundPort = (address !== null && typeof address === 'object') ? address.port : Number(port);

  return {
    server,
    port: boundPort,
    stop: async () => {
      RealtimeServer.getInstance().close();
      const closed = new Promise<void>((resolve, reject) => {
        server.close((err) => err !== undefined ? reject(err) : resolve());
      });
      // Drop keep-alive connections so close() doesn't wait on idle sockets
      // (embedded shutdown and spec teardown both want promptness).
      server.closeAllConnections();
      await closed;
    },
  };
}
