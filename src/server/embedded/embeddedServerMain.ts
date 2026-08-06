/**
 * Desktop EMBEDDED game-server entry (docs/EMBEDDED_SERVER.md §5).
 *
 * Runs inside an Electron `utilityProcess` forked by `electron/embeddedServer.ts`.
 * Same server as production (`startGameServer` — all routes, realtime gateway,
 * bot pacing), rooted in the app's userData dir on the LocalFilesystem backend
 * (no native modules), plus mDNS LAN advertise/browse.
 *
 * Environment contract (set by the Electron main process):
 *   TM_EMBEDDED_ROOT  — cwd root; the db lands at <root>/db/files. REQUIRED packaged.
 *   TM_EMBEDDED_PORT  — preferred TCP port (default 17325); EADDRINUSE → ephemeral.
 *   TM_EMBEDDED_BIND  — 'local' → 127.0.0.1 (LAN visibility off), else 0.0.0.0.
 *   TM_LAN_VISIBLE    — '0' disables mDNS ADVERTISING (browsing always runs).
 *   TM_LAN_NAME       — friendly host name to advertise (falls back to hostname).
 *   TM_BUILD_VERSION  — app build version for the TXT record / compat warning.
 *
 * Parent-port protocol (utility ↔ main):
 *   → {type:'ready', port, bind}      server is listening
 *   → {type:'fatal', error}           unrecoverable startup failure (main falls back to remote)
 *   → {type:'lan-hosts', hosts}       aggregated browse results (LanHostInfo[])
 *   ← {type:'shutdown'}               graceful stop, then process.exit(0)
 *   ← {type:'lan-rename', name}       re-advertise under a new friendly name
 *
 * NOTE: server modules are `require`d AFTER process.chdir so every cwd-derived
 * default (LocalFilesystem db folder) resolves under TM_EMBEDDED_ROOT.
 */
import * as fs from 'fs';

export const DEFAULT_EMBEDDED_PORT = 17325;

type ParentMessage = {data?: {type?: string, name?: unknown}};
type ParentPort = {
  postMessage(message: unknown): void;
  on(event: 'message', listener: (message: ParentMessage) => void): void;
};

/** `process.parentPort` exists only inside an Electron utilityProcess. */
function parentPort(): ParentPort | undefined {
  return (process as unknown as {parentPort?: ParentPort}).parentPort;
}

function send(message: unknown): void {
  const port = parentPort();
  if (port !== undefined) {
    port.postMessage(message);
  } else {
    console.log('[embedded]', JSON.stringify(message));
  }
}

process.on('uncaughtException', (err: unknown) => {
  console.error('UNCAUGHT EXCEPTION', err);
});

async function main(): Promise<void> {
  const root = (process.env.TM_EMBEDDED_ROOT ?? '').trim();
  if (root !== '') {
    fs.mkdirSync(root, {recursive: true});
    process.chdir(root);
  }
  // The embedded server always uses the filesystem backend: durable one-file-per-
  // save JSON, zero native modules (pg / better-sqlite3 are not shipped).
  if (process.env.LOCAL_FS_DB === undefined) {
    process.env.LOCAL_FS_DB = '1';
  }

  const {startGameServer} = require('../GameServer') as typeof import('../GameServer');
  const {LanDiscovery} = require('./lanDiscovery') as typeof import('./lanDiscovery');

  // Silence the per-save / per-load trace. It fires on essentially every player
  // action, and console.log from a utilityProcess is a SYNCHRONOUS pipe write to
  // the main process on Windows — routine chatter on the hot path. Errors,
  // startup and LAN diagnostics are unaffected.
  const {LocalFilesystem} = require('../database/LocalFilesystem') as typeof import('../database/LocalFilesystem');
  LocalFilesystem.quiet = true;

  // The filesystem backend writes off the event loop, so a save can still be in
  // flight when the server stops. Settle the queue before exiting, or the
  // player's last action dies with the process. Best-effort: shutdown must
  // never hang on it.
  const flushDatabase = async (): Promise<void> => {
    try {
      const {Database} = require('../database/Database') as typeof import('../database/Database');
      const db = Database.getInstance();
      if (db instanceof LocalFilesystem) {
        await db.flushPendingWrites();
      }
    } catch (err) {
      console.error('[embedded] flushing the database failed', err);
    }
  };

  const preferredPort = Number(process.env.TM_EMBEDDED_PORT ?? DEFAULT_EMBEDDED_PORT);
  const bind = process.env.TM_EMBEDDED_BIND === 'local' ? '127.0.0.1' : '0.0.0.0';

  let running;
  try {
    running = await startGameServer({port: preferredPort, host: bind});
  } catch (err) {
    if ((err as {code?: string}).code === 'EADDRINUSE') {
      console.warn(`[embedded] port ${preferredPort} is taken — falling back to an ephemeral port`);
      running = await startGameServer({port: 0, host: bind});
    } else {
      throw err;
    }
  }

  const discovery = new LanDiscovery((hosts) => send({type: 'lan-hosts', hosts}));
  discovery.browse();
  if (bind !== '127.0.0.1' && process.env.TM_LAN_VISIBLE !== '0') {
    discovery.advertise({
      name: (process.env.TM_LAN_NAME ?? '').trim(),
      port: running.port,
      version: (process.env.TM_BUILD_VERSION ?? '').trim(),
    });
  }

  parentPort()?.on('message', (message) => {
    const data = message.data;
    if (data === undefined || data === null) {
      return;
    }
    if (data.type === 'shutdown') {
      console.log('[embedded] shutdown requested');
      discovery.destroy();
      running.stop()
        .catch((err) => console.error('[embedded] stop failed', err))
        .then(() => flushDatabase())
        .finally(() => process.exit(0));
    } else if (data.type === 'lan-rename') {
      discovery.rename(String(data.name ?? ''));
    }
  });
  process.on('SIGTERM', () => {
    discovery.destroy();
    void running.stop().then(() => flushDatabase()).finally(() => process.exit(0));
  });

  send({type: 'ready', port: running.port, bind});
  console.log(`[embedded] game server ready on ${bind}:${running.port} (db root: ${process.cwd()})`);
}

main().catch((err) => {
  console.error('[embedded] fatal startup failure', err);
  send({type: 'fatal', error: err instanceof Error ? err.message : String(err)});
  process.exit(1);
});
