// Export the renderer console to a text file (the "⬇ Экспорт консоли" button in the F12
// DevTools overlay). Steam Machine / Deck have no easy copy-out of the console, so this dumps
// everything the renderer logged to a file NEXT TO the game log, named with the game, date and
// time.
//
// OBJECTS ARE EXPANDED. The `console-message` event only carries Chromium's flattened text, where
// an object argument is the useless `[object Object]`. So instead the capture runs IN the renderer
// MAIN world: a tiny injected script wraps console.{log,info,warn,error,debug}, richly serializes
// each argument (JSON with a circular guard / Errors as stacks / functions+bigint handled), and
// buffers the result; the main process periodically DRAINS that buffer into a reload-surviving log.
// The injection is instrumentation-only (it calls the original console first, never throws into the
// app) — it does NOT change game behaviour. The `console-message` event is kept only as a fallback
// for the rare case the injection never ran.
//
// Filename: <game>_console_export_<YYYY-MM-DD_HH-MM-SS>.txt  (game sanitized for the filesystem).
// Directory: TM_LOG_DIR / dirname(TM_LOG_FILE) / dirname($APPIMAGE) (where the wrapper's
//   terraforming-mars-steam.log lives) / app logs path — first that resolves.

import type {App, BrowserWindow} from 'electron';
import * as fs from 'fs';
import * as path from 'path';

/** One captured console line. */
export interface ConsoleEntry {
  t: number;
  level: string;
  text: string;
  source: string;
}

const MAX_ENTRIES = 20000;

/**
 * The rich argument-formatter, as PLAIN JS SOURCE — objects EXPANDED (the whole point of the
 * export). It is a STRING on purpose: it is injected verbatim into the renderer main world (see
 * CONSOLE_CAPTURE), so it must not go through `.toString()` of a TS function — a transpiler
 * (esbuild/tsx) rewrites that with helper refs like `__name` that don't exist in the page, which
 * would silently break the capture. As a string, no bundler touches it; the unit test evaluates
 * THIS SAME string via `makeRichFormatter()`, so there is one source of truth and zero drift.
 * Per-arg circular guard; Errors as stacks; functions / bigint / symbol / undefined legible; each
 * arg capped so one monster object can't blow the file. References only page globals (JSON /
 * String / WeakSet / Array).
 */
export const RICH_FORMAT_SOURCE =
`function (args) {
  var one = function (v) {
    if (v === undefined) return 'undefined';
    if (v === null) return 'null';
    var t = typeof v;
    if (t === 'string') return v;
    if (t === 'number' || t === 'boolean') return String(v);
    if (t === 'bigint') return String(v) + 'n';
    if (t === 'symbol') return v.toString();
    if (t === 'function') return '[Function' + (v.name ? ': ' + v.name : '') + ']';
    if (v instanceof Error) return v.stack || (v.name + ': ' + v.message);
    var seen = new WeakSet();
    try {
      var json = JSON.stringify(v, function (_k, val) {
        if (typeof val === 'bigint') return String(val) + 'n';
        if (typeof val === 'function') return '[Function' + (val.name ? ': ' + val.name : '') + ']';
        if (typeof val === 'object' && val !== null) {
          if (seen.has(val)) return '[Circular]';
          seen.add(val);
        }
        return val;
      }, 2);
      return json === undefined ? String(v) : json;
    } catch (e) {
      try { return String(v); } catch (e2) { return '[Unserializable]'; }
    }
  };
  var MAXLEN = 20000;
  return args.map(function (a) {
    var s = one(a);
    return s.length > MAXLEN ? s.slice(0, MAXLEN) + '…(truncated)' : s;
  }).join(' ');
}`;

/** Compile RICH_FORMAT_SOURCE into a callable — used by the unit test to exercise the EXACT source
 *  the page runs (no drift). Not used at runtime by the app (the page evals the string itself). */
export function makeRichFormatter(): (args: unknown[]) => string {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return new Function('return (' + RICH_FORMAT_SOURCE + ')')() as (args: unknown[]) => string;
}

/** Normalize the console level to a short upper token. The `console-message` event carries a
 *  STRING level on modern Electron and an INT (0 verbose … 3 error) on the legacy signature. */
export function normalizeConsoleLevel(level: unknown): string {
  if (typeof level === 'string' && level.trim() !== '') {
    return level.trim().toUpperCase();
  }
  switch (Number(level)) {
  case 0: return 'DEBUG';
  case 2: return 'WARN';
  case 3: return 'ERROR';
  default: return 'INFO';
  }
}

/** Two-digit zero-pad for the timestamp fields. */
function pad2(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

/** `YYYY-MM-DD_HH-MM-SS` from local time — filesystem-safe (no `:`). PURE (unit-tested). */
export function formatStamp(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}_` +
    `${pad2(d.getHours())}-${pad2(d.getMinutes())}-${pad2(d.getSeconds())}`;
}

/** `HH:MM:SS` for a per-line gutter. */
function clock(t: number): string {
  const d = new Date(t);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/** Reduce a game name to a safe, bounded filename segment (never empty). PURE (unit-tested). */
export function sanitizeForFilename(name: string): string {
  const cleaned = (name ?? '')
    .replace(/[^A-Za-z0-9._-]+/g, '_') // collapse any run of unsafe chars to one _
    .replace(/^[._-]+|[._-]+$/g, '')   // trim leading/trailing separators
    .slice(0, 48);
  return cleaned === '' ? 'game' : cleaned;
}

/** `<game>_console_export_<stamp>.txt`. PURE (unit-tested). */
export function buildExportFilename(gameName: string, when: Date): string {
  return `${sanitizeForFilename(gameName)}_console_export_${formatStamp(when)}.txt`;
}

/** One formatted export line. PURE (unit-tested). */
export function formatConsoleEntry(e: ConsoleEntry): string {
  const src = e.source !== '' ? `  (${e.source})` : '';
  return `[${clock(e.t)}] ${e.level.padEnd(5)} ${e.text}${src}`;
}

/** The capture buffer + the exporter, bound to one window's renderer. */
export interface ConsoleExporter {
  /** Read the current game name from the renderer + write the dump. Resolves with the outcome. */
  export(): Promise<{ok: boolean, path?: string, error?: string}>;
}

/** Where to write the export — mirror the wrapper's log location, with sane fallbacks. */
function resolveExportDir(app: App): string {
  const dir = (process.env.TM_LOG_DIR ?? '').trim();
  if (dir !== '') {
    return dir;
  }
  const logFile = (process.env.TM_LOG_FILE ?? '').trim();
  if (logFile !== '') {
    return path.dirname(logFile);
  }
  const appImage = (process.env.APPIMAGE ?? '').trim();
  if (appImage !== '') {
    return path.dirname(appImage); // the wrapper keeps the .log beside the AppImage
  }
  try {
    return app.getPath('logs');
  } catch {
    return app.getPath('userData');
  }
}

// Reads the current game name from the RENDERER (best-effort, side-effect-free): the Options-API
// root instance holds `playerView`; fall back to the URL's participant id, then a constant.
const GAME_NAME_PROBE = `(() => {
  try {
    const root = document.querySelector('#app');
    const inst = root && root.__vue_app__ && root.__vue_app__._instance;
    const pv = inst && inst.proxy && inst.proxy.playerView;
    const n = pv && pv.game && pv.game.name;
    if (typeof n === 'string' && n.trim() !== '') return n.trim();
  } catch (e) { /* internals moved — fall through */ }
  try {
    const id = new URLSearchParams(location.search).get('id');
    if (id) return 'game-' + id.slice(0, 8);
  } catch (e) { /* no location */ }
  return 'game';
})()`;

// The main-world capture script, injected on every dom-ready. It wraps the console methods to push
// a RICHLY-serialized record ({t, level, text}) into a drainable buffer, AND hooks UNCAUGHT errors
// + unhandled promise rejections — the most important lines to export, which Chromium prints to
// DevTools directly WITHOUT going through console.error, so the console wrappers never see them
// (this was the "errors missing from the export" bug). `richFormatArgs` is embedded verbatim so the
// page uses the exact logic the unit tests cover. Guarded against double-install; calls the original
// method first and never lets a formatting error escape.
export const CONSOLE_CAPTURE = `(() => {
  if (window.__tmConsoleCap) return true;
  window.__tmConsoleCap = true;
  window.__tmConsoleBuf = [];
  var MAX = 5000;
  var fmt = ${RICH_FORMAT_SOURCE};
  window.__tmConsoleDrain = function () {
    var e = window.__tmConsoleBuf; window.__tmConsoleBuf = []; return e;
  };
  var push = function (level, text) {
    try {
      window.__tmConsoleBuf.push({t: Date.now(), level: level, text: text});
      if (window.__tmConsoleBuf.length > MAX) {
        window.__tmConsoleBuf.splice(0, window.__tmConsoleBuf.length - MAX);
      }
    } catch (e) {}
  };
  var LEVELS = {log: 'LOG', info: 'INFO', warn: 'WARN', error: 'ERROR', debug: 'DEBUG'};
  Object.keys(LEVELS).forEach(function (m) {
    var orig = (typeof console[m] === 'function') ? console[m].bind(console) : function () {};
    console[m] = function () {
      var a = Array.prototype.slice.call(arguments);
      try { orig.apply(null, a); } catch (e) {}
      try { push(LEVELS[m], fmt(a)); } catch (e) {}
    };
  });
  // Uncaught exceptions — prefer the real Error stack (with the stack trace), fall back to the
  // event's message + source location. Bubble-phase listener on window catches SCRIPT errors only
  // (resource-load errors don't reach it), so no <img>/<script> 404 noise.
  window.addEventListener('error', function (ev) {
    try {
      var text;
      if (ev && ev.error && ev.error.stack) {
        text = 'Uncaught ' + ev.error.stack;
      } else if (ev && ev.error) {
        text = 'Uncaught ' + fmt([ev.error]);
      } else if (ev && ev.message) {
        var where = ev.filename ? ' (' + ev.filename + ':' + ev.lineno + ':' + ev.colno + ')' : '';
        text = 'Uncaught ' + ev.message + where;
      } else {
        text = 'Uncaught error';
      }
      push('ERROR', text);
    } catch (e) {}
  });
  // Unhandled promise rejections — same treatment for the rejection reason.
  window.addEventListener('unhandledrejection', function (ev) {
    try {
      var r = ev ? ev.reason : undefined;
      var text = (r && r.stack) ? r.stack : fmt([r]);
      push('ERROR', 'Unhandled promise rejection: ' + text);
    } catch (e) {}
  });
  return true;
})()`;

/**
 * Buffer the renderer console and return an exporter. Call once after the BrowserWindow is
 * created. The rich capture is injected into the main world on every dom-ready and DRAINED into a
 * reload-surviving log (periodically, before each navigation, and at export time). A main-frame
 * navigation inserts a marker line but keeps prior history (bounded by MAX_ENTRIES). The
 * `console-message` event feeds a SEPARATE fallback buffer, used only if the injection never ran.
 */
export function installConsoleCapture(app: App, win: BrowserWindow): ConsoleExporter {
  const richLog: ConsoleEntry[] = [];   // objects expanded — the export's primary source
  const fallback: ConsoleEntry[] = [];  // flattened console-message text — used only if rich empty

  const capTo = (buf: ConsoleEntry[], level: string, text: string, source: string): void => {
    buf.push({t: Date.now(), level, text, source});
    if (buf.length > MAX_ENTRIES) {
      buf.splice(0, buf.length - MAX_ENTRIES);
    }
  };

  // Pull the rich records the page accumulated and append them to richLog. Cheap (returns only
  // undrained entries and clears them); safe to call often. Best-effort — a navigating/destroyed
  // frame just yields nothing.
  const drain = async (): Promise<void> => {
    if (win.isDestroyed() || win.webContents.isDestroyed()) {
      return;
    }
    try {
      const raw = await win.webContents.executeJavaScript(
        'window.__tmConsoleDrain ? window.__tmConsoleDrain() : []', true);
      if (Array.isArray(raw)) {
        for (const r of raw as Array<{t?: number; level?: string; text?: string}>) {
          richLog.push({t: Number(r.t ?? Date.now()), level: String(r.level ?? 'LOG'), text: String(r.text ?? ''), source: ''});
        }
        if (richLog.length > MAX_ENTRIES) {
          richLog.splice(0, richLog.length - MAX_ENTRIES);
        }
      }
    } catch {
      // frame not ready / navigating — ignore, the next drain catches up
    }
  };

  win.webContents.on('dom-ready', () => {
    void win.webContents.executeJavaScript(CONSOLE_CAPTURE, true).catch(() => {/* CSP/none — fallback covers it */});
  });
  // Grab the tail of the outgoing page BEFORE a reload wipes its buffer, then mark the boundary.
  win.webContents.on('did-start-navigation', (e) => {
    const isMainFrame = (e as {isMainFrame?: boolean})?.isMainFrame;
    if (isMainFrame !== false) {
      void drain();
    }
  });
  win.webContents.on('did-navigate', (_e, url) => {
    capTo(richLog, 'INFO', `──────── page loaded: ${url} ────────`, '');
  });

  // Dual-signature tolerant fallback capture (modern event object OR legacy positional args).
  win.webContents.on('console-message', (...args: unknown[]) => {
    const first = args[0] as Record<string, unknown> | undefined;
    if (first !== undefined && typeof first === 'object' && typeof first.message === 'string') {
      capTo(fallback, normalizeConsoleLevel(first.level), String(first.message), '');
    } else {
      capTo(fallback, normalizeConsoleLevel(args[1]), String(args[2] ?? ''), '');
    }
  });

  // Periodic drain so cross-reload history survives even without a navigation event firing.
  const drainTimer = setInterval(() => void drain(), 8000);
  win.on('closed', () => clearInterval(drainTimer));

  const dump = (gameName: string, when: Date, entries: ConsoleEntry[], rich: boolean): string => {
    const header = [
      `Terraforming Mars — console export`,
      `game: ${gameName}`,
      `time: ${when.toISOString()} (local ${formatStamp(when)})`,
      `url:  ${win.webContents.getURL()}`,
      `lines: ${entries.length}${rich ? '' : '  (fallback — objects not expanded)'}`,
      '─'.repeat(60),
      '',
    ].join('\n');
    return header + entries.map(formatConsoleEntry).join('\n') + '\n';
  };

  return {
    async export() {
      try {
        await drain(); // capture everything logged up to this instant
        const gameName = String(await win.webContents.executeJavaScript(GAME_NAME_PROBE, true));
        const rich = richLog.length > 0;
        const entries = rich ? richLog : fallback;
        const when = new Date();
        const dir = resolveExportDir(app);
        const file = path.join(dir, buildExportFilename(gameName, when));
        await fs.promises.mkdir(dir, {recursive: true});
        await fs.promises.writeFile(file, dump(gameName, when, entries, rich), 'utf8');
        // eslint-disable-next-line no-console
        console.log(`[console-export] wrote ${entries.length} lines (${rich ? 'rich' : 'fallback'}) → ${file}`);
        return {ok: true, path: file};
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        // eslint-disable-next-line no-console
        console.error('[console-export] failed —', error);
        return {ok: false, error};
      }
    },
  };
}
