// DIAGNOSTICS — the main process's half (docs/claude/diagnostics.md).
//
// The diagnostics HUB (src/server/diagnostics/hub — mirrors every runtime's journal, decides what is sent, scrubs it,
// sends it, builds a report package) is a plain Node module that knows nothing of Electron. This file is its HOST: it
// loads the hub's bundle and gives it everything only the main process can do —
//
//   · the page ↔ hub pipes (desktop:diag / desktop:diag-line / desktop:diag-event — the preload passes them through);
//   · the frame on screen (captured BEFORE the system menu covers it), the renderer's console dump, the hosted save,
//     the tails of the logs beside the game, the newest hang trace — the parts of a report package;
//   · the main process's own signals: every console.warn / console.error it prints, an uncaught exception, an
//     unhandled rejection, a child process that went away;
//   · native crashes: Electron's crash reporter uploads minidumps straight to the collector's minidump endpoint,
//     following the same consent as everything automatic.
//
// It also gives the main process what it never had: a LOG FILE on every platform (<userData>/logs/main.log — on
// Windows a packaged build's stdout goes nowhere, so a field report had no main-side log at all).
//
// NOTHING HERE MAY BRICK A LAUNCH. The hub is optional by construction: a missing or broken bundle leaves
// `hub === undefined`, the game runs, and the page's own journal still works (it simply has nobody to send through).

import {app, BrowserWindow, clipboard, crashReporter, ipcMain, net, type NativeImage} from 'electron';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as util from 'util';
import type {ConsoleExporter} from './consoleExport';
import type {DiagnosticsHub, HubHost} from './diagnosticsHost';

export type DiagnosticsMainDeps = {
  /** `host` / `remote` — asked each time (a failed embedded start downgrades the session). */
  appMode: () => 'host' | 'remote';
  /** Post a message to the embedded game server; false when none runs. */
  postToServer: (message: unknown) => boolean;
  /** Where the console exports, the hang traces and (on the Deck) the wrapper's log live. */
  exportDir: () => string;
  /**
   * Quit the app through its ONE guarded door (`beginShutdown` — shutdown.ts). Never a bare `app.quit()`: on the
   * Steam Machine Chromium's native teardown can stall after `quit`, and only that door arms the watchdog that ends
   * the process (the first probe of a release on the box left its process alive behind «process should end now»).
   */
  quit: (reason: string) => void;
};

export type DiagnosticsMain = {
  /** The window whose page the hub talks to, and its console capture. */
  attachWindow(win: BrowserWindow, exporter: ConsoleExporter): void;
  /** A `{type: 'diag', signal}` message of the embedded game server. */
  noteServerSignal(signal: unknown): void;
  /** The developer's key (F12). */
  openJournal(): void;
  shutdown(): Promise<void>;
};

const MAIN_LOG_MAX_BYTES = 2 * 1024 * 1024;
const SCREEN_MAX_WIDTH = 1920;
const SCREEN_JPEG_QUALITY = 74;
const HANG_TRACE_PREFIX = 'renderer-hang-';
/** How many of the newest saves are read to find the one a seat belongs to. */
const SAVE_SEARCH_MAX = 40;

/** build/electron/diagnosticsMain.js → repo root (dev) / asar root (packaged) — the same resolution as cacheVersion.ts. */
const SETTINGS_FILE = path.resolve(__dirname, '..', '..', 'src', 'genfiles', 'settings.json');

type BuildSettings = {head?: string, version?: string, sentryDsn?: string};

function readSettings(): BuildSettings {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) as BuildSettings;
  } catch {
    return {};
  }
}

/** One console argument as the terminal shows it: a string as it is, an Error as its stack, the rest inspected. */
function formatArg(arg: unknown): string {
  if (typeof arg === 'string') {
    return arg;
  }
  if (arg instanceof Error) {
    return typeof arg.stack === 'string' && arg.stack !== '' ? arg.stack : `${arg.name}: ${arg.message}`;
  }
  return util.inspect(arg, {depth: 4, breakLength: 160, maxStringLength: 4000});
}

/** The last `maxBytes` of a file as text ('' when it cannot be read). */
function tailOfFile(file: string, maxBytes: number): string {
  try {
    const size = fs.statSync(file).size;
    const from = Math.max(0, size - maxBytes);
    const fd = fs.openSync(file, 'r');
    try {
      const buffer = Buffer.alloc(size - from);
      fs.readSync(fd, buffer, 0, buffer.length, from);
      return buffer.toString('utf8');
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return '';
  }
}

/**
 * The main process's own log file: `<userData>/logs/main.log`, the previous run kept as `main.prev.log`. Everything
 * the main process prints is appended (the terminal still gets it). Returns where it writes ('' = nowhere).
 */
function installMainLog(): string {
  try {
    const dir = path.join(app.getPath('userData'), 'logs');
    fs.mkdirSync(dir, {recursive: true});
    const file = path.join(dir, 'main.log');
    try {
      // One run back is kept whole; a log that grew past its bound within ONE run is cut at the next start.
      if (fs.existsSync(file)) {
        fs.renameSync(file, path.join(dir, 'main.prev.log'));
      }
    } catch {
      // The old log could not be moved (a scanner holds it): append to it.
    }
    const stream = fs.createWriteStream(file, {flags: 'a'});
    let written = 0;
    stream.on('error', () => undefined);
    for (const method of ['log', 'info', 'warn', 'error'] as const) {
      const platform = console[method].bind(console) as (...args: Array<unknown>) => void;
      console[method] = (...args: Array<unknown>) => {
        platform(...args);
        if (written > MAIN_LOG_MAX_BYTES) {
          return;
        }
        try {
          const line = `${new Date().toISOString()} ${method.toUpperCase().padEnd(5)} ${args.map(formatArg).join(' ')}\n`;
          written += line.length;
          stream.write(written > MAIN_LOG_MAX_BYTES ? `${line}… (the log reached its bound for this run)\n` : line);
        } catch {
          // The log never breaks the process that writes it.
        }
      };
    }
    return file;
  } catch {
    return '';
  }
}

/** The probe waits this long after the page loaded (the boot, the embedded server's first answers) before it asks. */
const PROBE_SETTLE_MS = 9_000;
/** `TM_DIAG_PROBE=stall`: how long the control stop spins the page (past Chromium's own hung-renderer delay). */
const PROBE_STOP_MS = 24_000;
/** …and how long the probe then waits for the two episodes' events to leave (the hub's settle + the request). */
const PROBE_SETTLE_AFTER_MS = 12_000;

/**
 * `TM_DIAG_PROBE=1` — THE WHOLE ROAD, PROVEN BY THE APP ITSELF, with no hand on a pad: once the page has loaded, the
 * page runs the connection check (page → hub → main / the game server → the collector) and sends one report (the frame,
 * the console dump, the save, the logs — the real package); both answers are printed to the log and the app quits.
 * A developer's instrument (`electron/README.md` § Diagnostics): pair it with `TM_DIAG_DSN` to prove a local build,
 * or run it on an installed release to prove that installation. Never set by the game.
 */
function runProbe(win: BrowserWindow, quit: (reason: string) => void): void {
  let ran = false;
  win.webContents.on('did-finish-load', () => {
    if (ran) {
      return;
    }
    ran = true;
    setTimeout(() => {
      const ask = (code: string): Promise<unknown> => win.webContents.executeJavaScript(code, true).catch((err: unknown) => ({error: String(err)}));
      void (async () => {
        // eslint-disable-next-line no-console
        console.log('[diagnostics] probe: the connection check…');
        // eslint-disable-next-line no-console
        console.log(`[diagnostics] probe: connection check → ${JSON.stringify(await ask('window.__conDiagnostics.selfTest()'))}`);
        // eslint-disable-next-line no-console
        console.log(`[diagnostics] probe: report → ${JSON.stringify(await ask('window.__conDiagnostics.report("other", "TM_DIAG_PROBE — a probe report, not a player")'))}`);
        if (process.env.TM_DIAG_PROBE === 'stall') {
          // THE ROAD OF A FREEZE (`TM_DIAG_PROBE=stall`): a control stall through the page's own console — one episode,
          // filed under its cause class with how it ended — and a control STOP of the renderer: the page spins, the
          // watch names it and records Chromium's trace, the hub sends the stop with the trace attached.
          // eslint-disable-next-line no-console
          console.log(`[diagnostics] probe: a control stall → ${JSON.stringify(await ask('window.__conDiagnostics.stall()'))}`);
          // eslint-disable-next-line no-console
          console.log('[diagnostics] probe: a control stop of the renderer (the page spins for 24 s)…');
          const spun = ask(`window.__conDiagnostics.hang(${PROBE_STOP_MS})`);
          // (Chromium looks for a hung renderer when an input event is not answered: the probe sends one.)
          setTimeout(() => {
            try {
              win.webContents.sendInputEvent({type: 'keyDown', keyCode: 'Shift'});
              win.webContents.sendInputEvent({type: 'keyUp', keyCode: 'Shift'});
            } catch {
              // The window went away — the probe ends with what it has.
            }
          }, 500);
          // eslint-disable-next-line no-console
          console.log(`[diagnostics] probe: the page answered again → ${JSON.stringify(await spun)}`);
          // …and the two episodes leave after their settle (the hub waits to learn how each ended, and for the trace).
          await new Promise((resolve) => setTimeout(resolve, PROBE_SETTLE_AFTER_MS));
        }
        // eslint-disable-next-line no-console
        console.log('[diagnostics] probe: done — quitting');
        quit('diagnostics probe');
      })();
    }, PROBE_SETTLE_MS);
  });
}

/** A test error thrown in THIS file — its stack is the Electron lane's own (it proves the lane's source maps). */
function hostSelfTestError(): Error {
  try {
    throw new Error('the connection check — a test error of the main process (not a defect)');
  } catch (err) {
    return err as Error;
  }
}

/** What the main process holds when diagnostics could not be installed: every member answers «nothing». */
const NO_DIAGNOSTICS: DiagnosticsMain = {
  attachWindow: () => undefined,
  noteServerSignal: () => undefined,
  openJournal: () => undefined,
  shutdown: () => Promise.resolve(),
};

/**
 * Install diagnostics — and NEVER let them stop a launch. This runs at the main module's load, before the window
 * exists: an exception escaping here would leave a player with a game that does not start, which is the one outcome a
 * diagnostics subsystem may not have. Whatever throws is said once and the game goes on without it.
 */
export function installDiagnosticsMain(deps: DiagnosticsMainDeps): DiagnosticsMain {
  try {
    return install(deps);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log(`[diagnostics] not installed — the game runs without it (${err instanceof Error ? err.message : String(err)})`);
    try {
      // The page still asks; nobody must hang on an unanswered question.
      ipcMain.handle('desktop:diag', () => undefined);
      ipcMain.on('desktop:diag-line', () => undefined);
    } catch {
      // already registered by the half that ran — fine
    }
    return NO_DIAGNOSTICS;
  }
}

function install(deps: DiagnosticsMainDeps): DiagnosticsMain {
  const mainLog = installMainLog();
  const settings = readSettings();
  let window: BrowserWindow | undefined;
  let exporter: ConsoleExporter | undefined;
  let heldScreen: NativeImage | undefined;
  let crashStarted = false;
  let crashUpload = false;
  const userData = app.getPath('userData');

  const host: HubHost = {
    version: app.getVersion(),
    packaged: app.isPackaged,
    head: settings.head ?? '',
    dsn: settings.sentryDsn ?? '',
    platform: process.platform,
    osVersion: os.release(),
    arch: process.arch,
    runtimeName: 'Electron',
    runtimeVersion: process.versions.electron ?? '',
    dataDir: userData,
    env: process.env,
    appMode: () => deps.appMode(),
    request: async (url, init) => {
      // Electron's own network stack (the system proxy, the OS certificate store) — available once the app is ready.
      const response = await net.fetch(url, {method: init.method, headers: init.headers, body: Buffer.from(init.body)});
      const headers: Record<string, string | undefined> = {};
      response.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });
      // The body is read so the connection is released; the collector's answer carries nothing we use.
      await response.arrayBuffer().catch(() => undefined);
      return {status: response.status, headers};
    },
    push: (event) => {
      if (window !== undefined && !window.isDestroyed() && !window.webContents.isDestroyed()) {
        window.webContents.send('desktop:diag-event', event);
      }
    },
    holdScreen: async () => {
      if (window === undefined || window.isDestroyed()) {
        return false;
      }
      heldScreen = await window.webContents.capturePage();
      return !heldScreen.isEmpty();
    },
    dropScreen: () => {
      heldScreen = undefined;
    },
    heldScreenJpeg: async () => {
      if (heldScreen === undefined || heldScreen.isEmpty()) {
        return undefined;
      }
      const size = heldScreen.getSize();
      const image = size.width > SCREEN_MAX_WIDTH ? heldScreen.resize({width: SCREEN_MAX_WIDTH, quality: 'good'}) : heldScreen;
      return image.toJPEG(SCREEN_JPEG_QUALITY);
    },
    consoleDump: async () => (exporter === undefined ? undefined : exporter.dumpText()),
    readSave: async (participantId) => {
      // Only the shape the server itself generates is looked for (the id is searched as a JSON string).
      if (!/^[ps][0-9a-f]{1,16}$/.test(participantId)) {
        return undefined;
      }
      // The page knows its seat, never its game: the save is the NEWEST one that names the seat. The game being
      // played is the one written last, so the first file read is almost always the answer; the look is bounded.
      const needle = Buffer.from(`"${participantId}"`);
      const files = path.join(userData, 'embedded', 'db', 'files');
      for (const dir of [files, path.join(files, 'completed')]) {
        let saves: Array<{name: string, at: number}>;
        try {
          saves = fs.readdirSync(dir, {withFileTypes: true})
            .filter((d) => d.isFile() && /^g[0-9a-f]+\.json$/.test(d.name))
            .map((d) => ({name: d.name, at: fs.statSync(path.join(dir, d.name)).mtimeMs}))
            .sort((a, b) => b.at - a.at)
            .slice(0, SAVE_SEARCH_MAX);
        } catch {
          continue;
        }
        for (const save of saves) {
          try {
            const data = await fs.promises.readFile(path.join(dir, save.name));
            if (data.includes(needle)) {
              return {gameId: save.name.replace(/\.json$/, ''), data};
            }
          } catch {
            // unreadable — try the next one
          }
        }
      }
      return undefined;
    },
    logTails: async (maxBytes) => {
      const wrapper = (process.env.TM_LOG_FILE ?? '').trim() || path.join(deps.exportDir(), 'terraforming-mars-steam.log');
      const candidates: Array<[string, string]> = [
        ['embedded-server', path.join(userData, 'embedded', 'embedded-server.log')],
        ['embedded-server.prev', path.join(userData, 'embedded', 'embedded-server.prev.log')],
        ['main', mainLog],
        ['main.prev', mainLog === '' ? '' : path.join(path.dirname(mainLog), 'main.prev.log')],
        ['wrapper', wrapper],
      ];
      const tails: Array<{name: string, text: string}> = [];
      for (const [name, file] of candidates) {
        const text = file === '' ? '' : tailOfFile(file, maxBytes);
        if (text !== '') {
          tails.push({name, text});
        }
      }
      return tails;
    },
    recentHangTrace: async (sinceMs, maxBytes) => {
      const dir = deps.exportDir();
      let names: Array<string>;
      try {
        names = fs.readdirSync(dir).filter((n) => n.startsWith(HANG_TRACE_PREFIX) && n.endsWith('.trace.json')).sort();
      } catch {
        return undefined;
      }
      const newest = names[names.length - 1];
      if (newest === undefined) {
        return undefined;
      }
      const file = path.join(dir, newest);
      const stat = fs.statSync(file);
      if (stat.mtimeMs < sinceMs || stat.size > maxBytes) {
        return undefined;
      }
      return {name: newest, data: await fs.promises.readFile(file)};
    },
    serverSelfTest: async () => deps.postToServer({type: 'diag-selftest'}),
    hostSelfTestError,
    copyToClipboard: (text) => {
      void clipboard.writeText(text);
    },
    setCrashUpload: (enabled) => {
      crashUpload = enabled;
      if (crashStarted) {
        crashReporter.setUploadToServer(enabled);
      }
    },
    // eslint-disable-next-line no-console
    log: (line) => console.log(line),
  };

  let hub: DiagnosticsHub | undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bundle = require(path.join(__dirname, 'diagnostics-hub.js')) as {createDiagnosticsHub: (host: HubHost) => DiagnosticsHub};
    hub = bundle.createDiagnosticsHub(host);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log(`[diagnostics] the hub is not available in this build (${err instanceof Error ? err.message.split('\n')[0] : String(err)}) — the in-game journal still works, nothing is sent`);
  }

  if (hub !== undefined) {
    const live = hub;
    // NATIVE CRASHES. The crash reporter is started only when this build has a destination; it must start before the
    // app is ready to cover the child processes. Upload follows the player's choice (`setCrashUpload`).
    const submitURL = live.crashSubmitUrl();
    if (submitURL !== undefined) {
      try {
        crashReporter.start({
          submitURL, uploadToServer: crashUpload, compress: true, ignoreSystemCrashHandler: true,
          productName: 'TerraformingMars', extra: live.crashExtra(),
        });
        crashStarted = true;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.log(`[diagnostics] the crash reporter did not start: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    // THE MAIN PROCESS'S OWN LINES. Everything it prints as a warning or an error is a record of the journal (its tag
    // decides its kind — `[renderer-hang] …` is a stall, `[embedded] …` a note); the terminal and the log file still
    // get the line first.
    for (const method of ['warn', 'error'] as const) {
      const platform = console[method].bind(console) as (...args: Array<unknown>) => void;
      console[method] = (...args: Array<unknown>) => {
        platform(...args);
        try {
          const firstError = args.find((a): a is Error => a instanceof Error);
          live.note('main', method, args.map(formatArg).join(' '), firstError?.stack);
        } catch {
          // A reader never breaks the console it reads.
        }
      };
    }
    // An exception nobody caught. Electron's default is a modal error dialog over a fullscreen game on a TV; with a
    // listener the process goes on, and what happened is a record (and, when allowed, an event).
    process.on('uncaughtException', (err: unknown) => {
      // eslint-disable-next-line no-console
      console.error(`[main-error] uncaught exception: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`, err);
    });
    process.on('unhandledRejection', (reason: unknown) => {
      // eslint-disable-next-line no-console
      console.error(`[main-error] unhandled rejection: ${reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason)}`, reason);
    });
    app.on('child-process-gone', (_event, details) => {
      if (details.reason === 'clean-exit' || details.reason === 'killed') {
        return;
      }
      // eslint-disable-next-line no-console
      console.error(`[process-gone] ${details.type}${details.name !== undefined ? ` (${details.name})` : ''}${details.serviceName !== undefined ? ` ${details.serviceName}` : ''}: ${details.reason}, exit ${details.exitCode}`);
    });
    ipcMain.handle('desktop:diag', (_event, verb: unknown, payload: unknown) => live.invoke(String(verb), payload));
    ipcMain.on('desktop:diag-line', (_event, payload: unknown) => live.line(payload));
  } else {
    // The page still asks (an older question must not hang): every verb answers «nobody here».
    ipcMain.handle('desktop:diag', () => undefined);
    ipcMain.on('desktop:diag-line', () => undefined);
  }

  return {
    attachWindow: (win, consoleExporter) => {
      window = win;
      exporter = consoleExporter;
      if (process.env.TM_DIAG_PROBE === '1' || process.env.TM_DIAG_PROBE === 'stall') {
        runProbe(win, deps.quit);
      }
      win.on('closed', () => {
        if (window === win) {
          window = undefined;
          exporter = undefined;
          heldScreen = undefined;
        }
      });
    },
    noteServerSignal: (signal) => {
      const s = signal as {level?: unknown, text?: unknown, stack?: unknown, debugIds?: unknown} | undefined;
      if (hub === undefined || s === undefined || s === null || typeof s.text !== 'string') {
        return;
      }
      hub.note('server', s.level === 'warn' ? 'warn' : 'error', s.text,
        typeof s.stack === 'string' ? s.stack : undefined,
        typeof s.debugIds === 'object' && s.debugIds !== null ? s.debugIds as Record<string, string> : undefined);
    },
    openJournal: () => hub?.openJournal(),
    shutdown: async () => {
      await hub?.shutdown();
    },
  };
}
