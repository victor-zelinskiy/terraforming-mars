// Export the renderer console to a text file (the "⬇ Экспорт консоли" button in the F12
// DevTools overlay) OR straight to the system clipboard (the "📋 Копировать консоль" button,
// same overlay — for a quick paste with no file to dig up). Steam Machine / Deck have no easy
// copy-out of the console, so this dumps everything the renderer logged, named with the game,
// date and time when it goes to a file.
//
// OBJECTS ARE EXPANDED. The `console-message` event only carries Chromium's flattened text, where
// an object argument is the useless `[object Object]`. So instead the capture runs IN the renderer
// MAIN world: a tiny injected script wraps console.{log,info,warn,error,debug}, richly serializes
// each argument (JSON with a circular guard / Errors as stacks / functions+bigint handled), and
// buffers the result; the main process periodically DRAINS that buffer into a reload-surviving log.
// The injection is instrumentation-only (it calls the original console first, never throws into the
// app) — it does NOT change game behaviour.
//
// ERRORS ARE THE POINT OF THE EXPORT. A player is asked to press this button *because* something
// broke, so anything red in DevTools has to reach the file. Two whole classes of red line used not
// to (probe-verified on Electron 44):
//   • FAILED SERVER CALLS. Chromium's "Failed to load resource: … 404" is written straight to the
//     DevTools front-end: it never goes through `console.*` (the wrappers cannot see it) and it
//     never fires `console-message` either (the fallback cannot see it). So the capture hooks the
//     ORIGIN instead — `fetch`, `XMLHttpRequest`, `WebSocket` and resource-load errors — which also
//     buys what Chromium's line lacks: method, timing and the server's own error body.
//   • BROWSER-GENERATED LINES + anything logged before the injection ran (dom-ready). Those only
//     ever reach `console-message`, and the dump used to pick ONE buffer (`rich ? rich : fallback`),
//     silently discarding the other. The two are now MERGED and de-duplicated (`mergeCaptures`).
// The dump then leads with an ERRORS digest (`buildErrorDigest`) so triage does not start by
// scrolling twenty thousand lines.
//
// Filename: <game>_console_export_<YYYY-MM-DD_HH-MM-SS>.txt  (game sanitized for the filesystem).
// Directory: TM_LOG_DIR / dirname(TM_LOG_FILE) / dirname($APPIMAGE) (where the wrapper's
//   terraforming-mars-steam.log lives) / app logs path — first that resolves.

import type {App, BrowserWindow} from 'electron';
import {clipboard} from 'electron';
import * as fs from 'fs';
import * as path from 'path';

/** One captured console line. */
export interface ConsoleEntry {
  t: number;
  level: string;
  text: string;
  source: string;
  /**
   * Chromium's OWN flattening of the same arguments (`String(arg)` joined by spaces), recorded
   * alongside the rich text purely so `mergeCaptures` can recognise the `console-message` copy of
   * this line and drop it. Absent on entries that never came from a `console.*` call.
   */
  flat?: string;
}

const MAX_ENTRIES = 20000;

/** How many ERROR lines the head-of-file digest reprints before deferring to the full log. */
const DIGEST_LIMIT = 60;

/**
 * Renderer console lines starting with this prefix are ALSO echoed to
 * main-process stdout, so they survive into the packaged/Steam Deck log without
 * anyone having to trigger an export. Kept to one narrow prefix on purpose:
 * mirroring the whole console would flood that shared log file.
 */
const FORWARDED_PREFIX = '[gamepad]';

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

/** Does this level make the line one a bug report should LEAD with? */
export function isErrorLevel(level: string): boolean {
  const l = level.toUpperCase();
  return l === 'ERROR' || l === 'SEVERE' || l === 'FATAL';
}

/**
 * MERGE the two capture buffers instead of choosing between them. PURE (unit-tested).
 *
 * The rich (injected) buffer expands objects but is blind to everything Chromium logs on the page's
 * behalf and to everything logged before it was installed at dom-ready; the `console-message`
 * buffer sees exactly those but flattens objects. Picking one — which is what this used to do —
 * threw away real errors, so both are kept: every fallback line whose flattened text the rich
 * buffer already carries is dropped (occurrence by occurrence, so a message logged three times
 * keeps all three), and whatever is left is folded in by timestamp.
 *
 * A fallback line that fails to match (Chromium substituted a `%c`/`%s` specifier, say) survives as
 * a near-duplicate. That is the deliberate direction to fail in: a doubled line costs a reader a
 * second, a dropped error costs a ticket.
 */
export function mergeCaptures(rich: ConsoleEntry[], fallback: ConsoleEntry[]): ConsoleEntry[] {
  if (rich.length === 0) {
    return fallback.slice();
  }
  const outstanding = new Map<string, number>();
  for (const e of rich) {
    const key = e.flat ?? e.text;
    outstanding.set(key, (outstanding.get(key) ?? 0) + 1);
  }
  const extra: ConsoleEntry[] = [];
  for (const e of fallback) {
    const n = outstanding.get(e.text) ?? 0;
    if (n > 0) {
      outstanding.set(e.text, n - 1); // the rich buffer already carries this line, expanded
      continue;
    }
    extra.push(e);
  }
  if (extra.length === 0) {
    return rich.slice();
  }
  // Stable sort — same-millisecond ties keep the rich line ahead of its fallback neighbour.
  return rich.concat(extra).sort((a, b) => a.t - b.t);
}

/**
 * The ERRORS-FIRST block that opens the dump. PURE (unit-tested).
 *
 * The export exists to answer "what broke", and the answer used to be buried thousands of lines
 * down a file nobody reads to the end. This reprints the errors — the LAST ones, since the failure
 * that made the player press the button is the most recent — while the full log below stays the
 * complete record.
 */
export function buildErrorDigest(entries: ConsoleEntry[], limit: number = DIGEST_LIMIT): string {
  const errors = entries.filter((e) => isErrorLevel(e.level));
  if (errors.length === 0) {
    return 'ERRORS: none captured\n';
  }
  const shown = errors.slice(-limit);
  const head = shown.length < errors.length ?
    `ERRORS: ${errors.length} (last ${shown.length} shown here — all of them are in the full log below)` :
    `ERRORS: ${errors.length}`;
  return [head, ...shown.map(formatConsoleEntry)].join('\n') + '\n';
}

/** The capture buffer + the exporter, bound to one window's renderer. */
export interface ConsoleExporter {
  /** Read the current game name from the renderer + write the dump. Resolves with the outcome. */
  export(): Promise<{ok: boolean, path?: string, error?: string}>;
  /** Same dump as `export()` (objects expanded), written to the system clipboard instead of a file. */
  copyToClipboard(): Promise<{ok: boolean, length?: number, error?: string}>;
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
// a RICHLY-serialized record ({t, level, text, flat}) into a drainable buffer, AND hooks the red
// lines Chromium never routes through `console.error`: uncaught exceptions, unhandled rejections,
// failed HTTP requests (fetch + XHR), failed WebSocket connections and failed resource loads.
// `richFormatArgs` is embedded verbatim so the page uses the exact logic the unit tests cover.
//
// EVERY hook here is instrumentation-only and must stay that way: it calls the original first,
// returns/rethrows exactly what the original produced, and swallows any error of its own. Nothing
// in this script may change game behaviour.
export const CONSOLE_CAPTURE = `(() => {
  if (window.__tmConsoleCap) return true;
  window.__tmConsoleCap = true;
  window.__tmConsoleBuf = [];
  var MAX = 5000;
  var fmt = ${RICH_FORMAT_SOURCE};
  window.__tmConsoleDrain = function () {
    var e = window.__tmConsoleBuf; window.__tmConsoleBuf = []; return e;
  };
  var push = function (level, text, flat) {
    try {
      window.__tmConsoleBuf.push({t: Date.now(), level: level, text: text, flat: flat});
      if (window.__tmConsoleBuf.length > MAX) {
        window.__tmConsoleBuf.splice(0, window.__tmConsoleBuf.length - MAX);
      }
    } catch (e) {}
  };
  // Chromium's own flattening of the same args — recorded so the main process can spot (and drop)
  // the duplicate 'console-message' copy of this very line. String() is what Blink applies too, so
  // an object lands as '[object Object]' on both sides and the two match.
  var flatten = function (args) {
    try {
      return args.map(function (a) {
        try { return String(a); } catch (e) { return '[?]'; }
      }).join(' ');
    } catch (e) { return ''; }
  };
  var LEVELS = {log: 'LOG', info: 'INFO', warn: 'WARN', error: 'ERROR', debug: 'DEBUG'};
  Object.keys(LEVELS).forEach(function (m) {
    var orig = (typeof console[m] === 'function') ? console[m].bind(console) : function () {};
    console[m] = function () {
      var a = Array.prototype.slice.call(arguments);
      try { orig.apply(null, a); } catch (e) {}
      try { push(LEVELS[m], fmt(a), flatten(a)); } catch (e) {}
    };
  });
  // Uncaught exceptions — prefer the real Error stack (with the stack trace), fall back to the
  // event's message + source location. This is the TARGET/bubble phase on window, which only
  // SCRIPT errors reach; failed resource loads are taken separately below, in the capture phase.
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

  /* ── FAILED SERVER CALLS ───────────────────────────────────────────────────────────────────
   * THE line a production ticket is opened about, and it used to reach neither buffer: Chromium
   * writes its red 'Failed to load resource: … 404' straight to the DevTools front-end, bypassing
   * console.* AND webContents' 'console-message'. So the failure is taken at its origin instead,
   * which is also strictly more useful than Chromium's line — method, timing and the server's own
   * error body all come along. */
  var BODYMAX = 500;
  var BODY_SKIP_BYTES = 100000; // never buffer a huge error body just to snip 500 chars off it
  var snip = function (s) {
    var v = String(s === undefined || s === null ? '' : s);
    return v.length > BODYMAX ? v.slice(0, BODYMAX) + '…(truncated)' : v;
  };
  var urlOf = function (input) {
    try {
      if (typeof input === 'string') return input;
      if (input && typeof input.url === 'string') return input.url; // Request
      return String(input);                                         // URL / anything else
    } catch (e) { return '<url?>'; }
  };
  var methodOf = function (input, init) {
    try {
      if (init && init.method) return String(init.method).toUpperCase();
      if (input && typeof input !== 'string' && input.method) return String(input.method).toUpperCase();
    } catch (e) {}
    return 'GET';
  };
  var origFetch = window.fetch;
  if (typeof origFetch === 'function') {
    window.fetch = function () {
      var url = urlOf(arguments[0]), method = methodOf(arguments[0], arguments[1]), t0 = Date.now();
      // The call itself is untouched — same receiver, same arguments, same returned promise.
      return origFetch.apply(window, arguments).then(function (res) {
        try {
          if (res && res.ok === false) {
            push('ERROR', 'HTTP ' + res.status + ' ' + (res.statusText || '') + ' — ' +
              method + ' ' + url + ' (' + (Date.now() - t0) + 'ms)');
            var len = 0;
            try { len = Number((res.headers && res.headers.get('content-length')) || 0); } catch (e) {}
            if (len <= BODY_SKIP_BYTES) {
              // clone() so the app's own read of this body is untouched. Async, hence the url in
              // the line: another entry can land between the status and the body.
              res.clone().text().then(function (b) {
                if (b) push('ERROR', '  ↳ ' + method + ' ' + url + ' response body: ' + snip(b));
              }, function () {});
            }
          }
        } catch (e) {}
        return res;
      }, function (err) {
        try {
          // An aborted request is NORMAL flow here (journal, lobby and the preview store all use
          // AbortController) — logging those would bury the real failures.
          if (!err || err.name !== 'AbortError') {
            push('ERROR', 'HTTP FAILED — ' + method + ' ' + url + ' (' + (Date.now() - t0) + 'ms): ' +
              ((err && (err.stack || err.message)) || String(err)));
          }
        } catch (e) {}
        throw err;
      });
    };
  }
  var XHR = window.XMLHttpRequest;
  if (XHR && XHR.prototype && typeof XHR.prototype.open === 'function') {
    var xopen = XHR.prototype.open, xsend = XHR.prototype.send;
    XHR.prototype.open = function (method, url) {
      try { this.__tmM = String(method).toUpperCase(); this.__tmU = String(url); } catch (e) {}
      return xopen.apply(this, arguments);
    };
    XHR.prototype.send = function () {
      var self = this;
      try {
        var t0 = Date.now();
        self.addEventListener('abort', function () { try { self.__tmAbort = true; } catch (e) {} });
        // 'loadend' always fires last whatever the outcome, and addEventListener COMPOSES with the
        // app's own onload/onerror handlers (the poll chain sets both) rather than replacing them.
        self.addEventListener('loadend', function () {
          try {
            var where = (self.__tmM || 'GET') + ' ' + (self.__tmU || '<url?>') + ' (' + (Date.now() - t0) + 'ms)';
            var st = Number(self.status);
            if (st === 0) {
              if (self.__tmAbort !== true) push('ERROR', 'XHR FAILED (no response) — ' + where);
            } else if (st >= 400) {
              push('ERROR', 'HTTP ' + st + ' ' + (self.statusText || '') + ' — ' + where);
              var body = '';
              // responseText THROWS for a json/blob/arraybuffer responseType — only read it when legal.
              try {
                if (self.responseType === '' || self.responseType === 'text') body = String(self.responseText || '');
              } catch (e) {}
              if (body !== '') push('ERROR', '  ↳ response body: ' + snip(body));
            }
          } catch (e) {}
        });
      } catch (e) {}
      return xsend.apply(this, arguments);
    };
  }
  // The realtime channel is this build's PRIMARY update signal, so 'WebSocket connection to … failed'
  // is a first-class ticket line — and it is another DevTools-only red. A CLEAN close is normal
  // (navigation, game end) and stays unlogged.
  var OrigWS = window.WebSocket;
  if (typeof OrigWS === 'function') {
    var WrappedWS = function (url, protocols) {
      var ws = (arguments.length > 1) ? new OrigWS(url, protocols) : new OrigWS(url);
      try {
        ws.addEventListener('error', function () { push('ERROR', 'WebSocket error — ' + String(url)); });
        ws.addEventListener('close', function (ev) {
          try {
            if (ev && ev.wasClean !== true) {
              push('ERROR', 'WebSocket closed uncleanly — ' + String(url) + ' code=' + ev.code +
                (ev.reason ? ' reason=' + ev.reason : ''));
            }
          } catch (e) {}
        });
      } catch (e) {}
      return ws;
    };
    WrappedWS.prototype = OrigWS.prototype; // keeps \`instanceof WebSocket\` honest
    ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach(function (k) { WrappedWS[k] = OrigWS[k]; });
    window.WebSocket = WrappedWS;
  }
  // Failed resource loads (<img>/<script>/<link>/<audio>) do NOT bubble, so the window listener
  // above never sees them and Chromium's red line reaches neither buffer. Capture phase, tagged so
  // it reads as an ASSET failure and is never mistaken for a script error.
  window.addEventListener('error', function (ev) {
    try {
      var t = ev ? ev.target : undefined;
      if (t === undefined || t === null || t === window || !t.tagName) return; // script error — handled above
      push('ERROR', 'Resource failed to load: <' + String(t.tagName).toLowerCase() + '> ' +
        String(t.currentSrc || t.src || t.href || ''));
    } catch (e) {}
  }, true);
  return true;
})()`;

/**
 * Buffer the renderer console and return an exporter. Call once after the BrowserWindow is
 * created. The rich capture is injected into the main world on every dom-ready and DRAINED into a
 * reload-surviving log (periodically, before each navigation, and at export time). A main-frame
 * navigation inserts a marker line but keeps prior history (bounded by MAX_ENTRIES). The
 * `console-message` event feeds a SECOND buffer holding what the injection structurally cannot see
 * (browser-generated lines, anything logged before dom-ready); the two are MERGED at export time.
 */
export function installConsoleCapture(app: App, win: BrowserWindow): ConsoleExporter {
  const richLog: ConsoleEntry[] = [];   // objects expanded — the export's primary source
  const fallback: ConsoleEntry[] = [];  // flattened console-message text — merged in, never discarded

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
        for (const r of raw as Array<{t?: number; level?: string; text?: string; flat?: string}>) {
          richLog.push({
            t: Number(r.t ?? Date.now()),
            level: String(r.level ?? 'LOG'),
            text: String(r.text ?? ''),
            source: '',
            // Only console.* entries carry a flattening; the network/uncaught hooks have no
            // `console-message` twin to be de-duplicated against.
            ...(typeof r.flat === 'string' ? {flat: r.flat} : {}),
          });
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
    const modern = first !== undefined && typeof first === 'object' && typeof first.message === 'string';
    const level = normalizeConsoleLevel(modern ? first.level : args[1]);
    const text = modern ? String(first.message) : String(args[2] ?? '');
    // Keep the origin — these lines are now MERGED into the export rather than being a
    // last-resort substitute for it, so "which file said this" earns its keep.
    // Legacy positional signature is (event, level, message, line, sourceId).
    const sourceId = String((modern ? first.sourceId : args[4]) ?? '');
    const lineNumber = Number((modern ? first.lineNumber : args[3]) ?? 0);
    capTo(fallback, level, text, sourceId === '' ? '' : (lineNumber > 0 ? `${sourceId}:${lineNumber}` : sourceId));
    // FIELD DIAGNOSTICS: renderer console output is otherwise reachable ONLY
    // through a manual export — which is exactly what a player reporting "my
    // controller does nothing" cannot be walked through, since they have no
    // working input to click the export button with. Echoing this one prefix to
    // MAIN-process stdout lands it in the Steam Deck wrapper's log file (that
    // wrapper redirects our stdout there — scripts/steamdeck/install-steamdeck.sh),
    // so the very next log they send answers whether the page saw the device.
    if (text.startsWith(FORWARDED_PREFIX)) {
      console.log(`[renderer] ${text}`);
    }
  });

  // Periodic drain so cross-reload history survives even without a navigation event firing.
  const drainTimer = setInterval(() => void drain(), 8000);
  win.on('closed', () => clearInterval(drainTimer));

  const dump = (gameName: string, when: Date, entries: ConsoleEntry[], rich: boolean): string => {
    const rule = '─'.repeat(60);
    const header = [
      `Terraforming Mars — console export`,
      `game: ${gameName}`,
      `time: ${when.toISOString()} (local ${formatStamp(when)})`,
      `url:  ${win.webContents.getURL()}`,
      `lines: ${entries.length}${rich ? '' : '  (fallback only — objects not expanded)'}`,
      rule,
      // Errors first: this file is read because something broke, so lead with what broke.
      buildErrorDigest(entries) + rule,
      '',
    ].join('\n');
    return header + entries.map(formatConsoleEntry).join('\n') + '\n';
  };

  // Shared by export() and copyToClipboard(): drain up to this instant, then MERGE both buffers —
  // each sees red lines the other structurally cannot, so neither may be dropped.
  const gather = async (): Promise<{gameName: string, when: Date, entries: ConsoleEntry[], rich: boolean}> => {
    await drain();
    const gameName = String(await win.webContents.executeJavaScript(GAME_NAME_PROBE, true));
    return {gameName, when: new Date(), entries: mergeCaptures(richLog, fallback), rich: richLog.length > 0};
  };

  return {
    async export() {
      try {
        const {gameName, when, entries, rich} = await gather();
        const dir = resolveExportDir(app);
        const file = path.join(dir, buildExportFilename(gameName, when));
        await fs.promises.mkdir(dir, {recursive: true});
        await fs.promises.writeFile(file, dump(gameName, when, entries, rich), 'utf8');
        // eslint-disable-next-line no-console
        console.log(`[console-export] wrote ${entries.length} lines, ${entries.filter((e) => isErrorLevel(e.level)).length} error(s) (${rich ? 'rich' : 'fallback'}) → ${file}`);
        return {ok: true, path: file};
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        // eslint-disable-next-line no-console
        console.error('[console-export] failed —', error);
        return {ok: false, error};
      }
    },
    async copyToClipboard() {
      try {
        const {gameName, when, entries, rich} = await gather();
        // Electron 44 rearchitected `clipboard` to match the W3C Clipboard API — the
        // read/write methods now return Promises. Awaiting keeps the success log + `ok`
        // honest (the write has actually landed) and keeps a rejection inside the catch
        // below instead of escaping as an unhandled rejection.
        await clipboard.writeText(dump(gameName, when, entries, rich));
        // eslint-disable-next-line no-console
        console.log(`[console-export] copied ${entries.length} lines, ${entries.filter((e) => isErrorLevel(e.level)).length} error(s) (${rich ? 'rich' : 'fallback'}) to the clipboard`);
        return {ok: true, length: entries.length};
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        // eslint-disable-next-line no-console
        console.error('[console-export] copy failed —', error);
        return {ok: false, error};
      }
    },
  };
}
