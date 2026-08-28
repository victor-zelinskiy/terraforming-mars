// Embedded game-server supervisor (host-as-server mode) — docs/EMBEDDED_SERVER.md §5.
//
// Spawns the bundled game server (src/server/embedded/embeddedServerMain.ts →
// build/electron/embedded-server.js) in an Electron utilityProcess: full Node,
// its own event loop, crash-isolated from the window. The main process owns the
// lifecycle: ready handshake before the window is created, one respawn on an
// unexpected exit, best-effort graceful shutdown on quit (every save is a
// completed synchronous file write, so even a hard kill loses nothing).
//
// The utility process also runs LAN mDNS advertise/browse (multicast sockets
// share its lifetime); browse results are relayed here and pushed to the
// renderer over the desktop bridge.

import {app, utilityProcess, UtilityProcess} from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export type LanHost = {
  id: string;
  name: string;
  addresses: string[];
  port: number;
  version: string;
};

/** Per-link mDNS health (mirrors src/server/embedded/lanDiscovery.ts). */
export type LanLinkStatus = {
  name: string;
  address: string;
  virtual: boolean;
  published: boolean;
  queriesIn: number;
  responsesIn: number;
  error: string;
};

export type LanDiagnostics = {
  advertising: boolean;
  serviceName: string;
  port: number;
  links: LanLinkStatus[];
  hosts: number;
  /** Discovered but hidden — they stopped answering a socket. */
  hiddenHosts: number;
  /** False while responses arrive = we can send but not be asked (firewall). */
  inboundSeen: boolean;
};

export type EmbeddedServerStatus = 'stopped' | 'starting' | 'ready' | 'failed';

type StartOptions = {
  /** Bind 0.0.0.0 + advertise on the LAN (false → 127.0.0.1, no advertising). */
  lanVisible: boolean;
  /** Friendly host name for the mDNS TXT record ('' → hostname fallback). */
  lanName: string;
};

const READY_TIMEOUT_MS = 20_000;
const RESPAWN_DELAY_MS = 2_000;

let child: UtilityProcess | undefined;
let status: EmbeddedServerStatus = 'stopped';
let boundPort: number | undefined;
let lastOptions: StartOptions | undefined;
let respawnUsed = false;
let shuttingDown = false;
let lanHosts: LanHost[] = [];
let lanDiagnostics: LanDiagnostics | undefined;
let lanHostsListener: ((hosts: LanHost[]) => void) | undefined;
let logStream: fs.WriteStream | undefined;

export function embeddedServerStatus(): EmbeddedServerStatus {
  return status;
}

export function embeddedServerPort(): number | undefined {
  return boundPort;
}

export function getLanHosts(): LanHost[] {
  return lanHosts;
}

/**
 * Latest per-link mDNS health pushed by the utility process (heartbeat, so it
 * is at most ~15 s stale). Undefined until the first push — the settings
 * surface treats that as "not reporting yet", not as a failure.
 */
export function getLanDiagnostics(): LanDiagnostics | undefined {
  return lanDiagnostics;
}

/** The renderer push hook (set once from main; survives window reloads). */
export function onLanHostsChanged(listener: (hosts: LanHost[]) => void): void {
  lanHostsListener = listener;
}

/** Live re-advertise under a new friendly name (profile change on the host). */
export function setLanName(name: string): void {
  child?.postMessage({type: 'lan-rename', name});
}

function embeddedRoot(): string {
  return path.join(app.getPath('userData'), 'embedded');
}

/**
 * The server script to fork. Packaged: the asar-UNPACKED webpack bundle
 * (utilityProcess needs a real file). Dev: the bundle if built, else the plain
 * tsc output (node_modules are present at the project root in dev).
 */
function serverScriptPath(): string | undefined {
  const bundled = path.join(__dirname, 'embedded-server.js');
  if (app.isPackaged) {
    const unpacked = bundled.replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
    return fs.existsSync(unpacked) ? unpacked : (fs.existsSync(bundled) ? bundled : undefined);
  }
  if (fs.existsSync(bundled)) {
    return bundled;
  }
  // __dirname (dev) = <project>/build/electron → tsc output lives beside it.
  const tscOut = path.resolve(__dirname, '..', 'src', 'server', 'embedded', 'embeddedServerMain.js');
  return fs.existsSync(tscOut) ? tscOut : undefined;
}

function openLog(root: string): fs.WriteStream | undefined {
  try {
    fs.mkdirSync(root, {recursive: true});
    return fs.createWriteStream(path.join(root, 'embedded-server.log'), {flags: 'w'});
  } catch {
    return undefined;
  }
}

function wireChild(proc: UtilityProcess, onReady: (port: number) => void, onFatal: (reason: string) => void): void {
  proc.on('message', (message: unknown) => {
    const m = message as {type?: string, port?: number, hosts?: LanHost[], error?: string, diagnostics?: LanDiagnostics};
    if (m.type === 'ready' && typeof m.port === 'number') {
      status = 'ready';
      boundPort = m.port;
      onReady(m.port);
    } else if (m.type === 'fatal') {
      onFatal(m.error ?? 'unknown embedded-server failure');
    } else if (m.type === 'lan-hosts' && Array.isArray(m.hosts)) {
      lanHosts = m.hosts;
      lanHostsListener?.(lanHosts);
    } else if (m.type === 'lan-diagnostics' && m.diagnostics !== undefined) {
      lanDiagnostics = m.diagnostics;
    }
  });
  proc.stdout?.on('data', (chunk: Buffer) => {
    const line = chunk.toString();
    // eslint-disable-next-line no-console
    console.log('[embedded]', line.trimEnd());
    logStream?.write(line);
  });
  proc.stderr?.on('data', (chunk: Buffer) => {
    const line = chunk.toString();
    // eslint-disable-next-line no-console
    console.error('[embedded]', line.trimEnd());
    logStream?.write(line);
  });
}

function spawn(options: StartOptions): UtilityProcess | undefined {
  const script = serverScriptPath();
  if (script === undefined) {
    // eslint-disable-next-line no-console
    console.error('[embedded] no server script found (run `npm run build:embedded` or `npm run build:server`)');
    return undefined;
  }
  const root = embeddedRoot();
  logStream ??= openLog(root);
  // eslint-disable-next-line no-console
  console.log(`[embedded] forking ${script} (root: ${root}, lan: ${options.lanVisible ? 'visible' : 'off'})`);
  return utilityProcess.fork(script, [], {
    serviceName: 'tm-embedded-server',
    stdio: 'pipe',
    env: {
      ...process.env,
      TM_EMBEDDED_ROOT: root,
      TM_EMBEDDED_BIND: options.lanVisible ? 'lan' : 'local',
      TM_LAN_VISIBLE: options.lanVisible ? '1' : '0',
      TM_LAN_NAME: options.lanName,
      TM_BUILD_VERSION: app.getVersion(),
    },
  });
}

/**
 * Start the embedded server and resolve with its port once it answers ready.
 * Rejects on spawn failure / fatal startup / timeout — the caller (main) falls
 * back to remote mode. After a successful start, ONE unexpected exit triggers
 * an automatic respawn; a second failure marks the server failed (the client's
 * INVALID_RUN_ID handling surfaces the restart to the player).
 */
export function startEmbeddedServer(options: StartOptions): Promise<number> {
  lastOptions = options;
  status = 'starting';
  return new Promise<number>((resolve, reject) => {
    const proc = spawn(options);
    if (proc === undefined) {
      status = 'failed';
      reject(new Error('embedded server script missing'));
      return;
    }
    child = proc;
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        status = 'failed';
        proc.kill();
        reject(new Error(`embedded server did not become ready in ${READY_TIMEOUT_MS} ms`));
      }
    }, READY_TIMEOUT_MS);
    wireChild(proc,
      (port) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          resolve(port);
        }
      },
      (reason) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          status = 'failed';
          reject(new Error(reason));
        }
      });
    proc.on('exit', (code) => {
      // eslint-disable-next-line no-console
      console.warn(`[embedded] exited with code ${code}`);
      if (child === proc) {
        child = undefined;
      }
      if (shuttingDown || status === 'failed') {
        return;
      }
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        status = 'failed';
        reject(new Error(`embedded server exited with code ${code} before ready`));
        return;
      }
      // Post-ready crash: one respawn, then give up loudly.
      status = 'stopped';
      boundPort = undefined;
      if (!respawnUsed && lastOptions !== undefined) {
        respawnUsed = true;
        // eslint-disable-next-line no-console
        console.warn('[embedded] unexpected exit — respawning once');
        setTimeout(() => {
          startEmbeddedServer(lastOptions as StartOptions)
            .then(() => {
              respawnUsed = false;
            })
            .catch((err) => {
              // eslint-disable-next-line no-console
              console.error('[embedded] respawn failed', err);
            });
        }, RESPAWN_DELAY_MS);
      } else {
        status = 'failed';
        // eslint-disable-next-line no-console
        console.error('[embedded] gave up after repeated failures');
      }
    });
  });
}

/**
 * Best-effort graceful stop on app quit. Deliberately does NOT block quit:
 * every save is already durable, and Electron reaps utility processes with the
 * app. The shutdown message lets the server close sockets cleanly when it can.
 */
export function stopEmbeddedServer(): void {
  shuttingDown = true;
  const proc = child;
  if (proc === undefined) {
    return;
  }
  try {
    proc.postMessage({type: 'shutdown'});
  } catch {
    // ignore — kill below
  }
  setTimeout(() => {
    try {
      proc.kill();
    } catch {
      // already gone
    }
  }, 1500);
  child = undefined;
  status = 'stopped';
  boundPort = undefined;
  // Stale link health would otherwise outlive the process that measured it.
  lanDiagnostics = undefined;
  logStream?.end();
  logStream = undefined;
}
