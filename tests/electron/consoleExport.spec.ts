import {expect} from 'chai';
import {
  buildErrorDigest, buildExportFilename, CONSOLE_CAPTURE, ConsoleEntry, formatConsoleEntry,
  formatStamp, isErrorLevel, makeRichFormatter, mergeCaptures, normalizeConsoleLevel,
  RICH_FORMAT_SOURCE, sanitizeForFilename,
} from '../../electron/consoleExport';

// Exercise the EXACT source the renderer main world runs (compiled from the string, no drift).
const richFormatArgs = makeRichFormatter();

// Pure unit test of the console-export naming + formatting helpers (the capture/write side is a
// thin Electron shim around these).
//   npx mocha --import=tsx "tests/electron/consoleExport.spec.ts"

/** One record as the injected capture pushes it into `window.__tmConsoleBuf`. */
type Captured = {t: number; level: string; text: string; flat?: string};

/**
 * Evaluate the injected main-world script against a fake window/console, then drive whatever it
 * hooked. Everything the export exists for — uncaught errors, failed HTTP calls, dead sockets,
 * missing assets — arrives through one of these hooks and NOT through `console.*`, so this is the
 * only place their capture can be pinned. `extra` supplies the page globals a case needs
 * (`fetch` / `XMLHttpRequest` / `WebSocket`); anything absent is simply not wrapped.
 */
function runCapture(extra: Record<string, unknown> = {}) {
  const listeners: Record<string, (ev: unknown) => void> = {};  // bubble/target phase
  const capturing: Record<string, (ev: unknown) => void> = {};  // capture phase (useCapture===true)
  const win: Record<string, unknown> = {
    addEventListener(type: string, cb: (ev: unknown) => void, useCapture?: boolean) {
      (useCapture === true ? capturing : listeners)[type] = cb;
    },
    ...extra,
  };
  const fakeConsole: Record<string, (...a: unknown[]) => void> = {
    log() {}, info() {}, warn() {}, error() {}, debug() {},
  };
  new Function('window', 'console', CONSOLE_CAPTURE)(win, fakeConsole);
  // `fakeConsole` is the object the script wrapped — calling through it exercises the wrappers.
  return {win, listeners, capturing, console: fakeConsole, buf: () => win.__tmConsoleBuf as Array<Captured>};
}

/** Minimal stand-in for the `Response` the wrapper inspects (status + headers + a clonable body). */
function fakeResponse(status: number, statusText: string, body: string, contentLength?: string) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: {get: (k: string) => (k === 'content-length' ? (contentLength ?? String(body.length)) : null)},
    clone: () => ({text: () => Promise.resolve(body)}),
  };
}

/** Let the wrapper's `clone().text()` continuation (a microtask) run before asserting. */
const flushMicrotasks = () => new Promise((res) => setTimeout(res, 0));

describe('electron/consoleExport', () => {
  describe('sanitizeForFilename', () => {
    it('keeps safe chars, collapses unsafe runs to one _, trims separators', () => {
      expect(sanitizeForFilename('Red Planet #1: Тест!')).to.eq('Red_Planet_1');
      expect(sanitizeForFilename('g1a2b3c4')).to.eq('g1a2b3c4');
    });
    it('never returns empty (all-unsafe / blank → "game")', () => {
      expect(sanitizeForFilename('   ')).to.eq('game');
      expect(sanitizeForFilename('')).to.eq('game');
      expect(sanitizeForFilename('/// ')).to.eq('game');
    });
    it('bounds the length to 48 chars', () => {
      expect(sanitizeForFilename('x'.repeat(200))).to.have.length(48);
    });
  });

  describe('formatStamp', () => {
    it('is filesystem-safe (no colons) and zero-padded', () => {
      // Local-time based — assert the shape, not the absolute value.
      expect(formatStamp(new Date(2026, 6, 17, 9, 4, 5))).to.eq('2026-07-17_09-04-05');
      expect(formatStamp(new Date(2026, 6, 17, 9, 4, 5))).to.not.include(':');
    });
  });

  describe('buildExportFilename', () => {
    it('is <game>_console_export_<stamp>.txt', () => {
      expect(buildExportFilename('Red Planet', new Date(2026, 6, 17, 17, 41, 26)))
        .to.eq('Red_Planet_console_export_2026-07-17_17-41-26.txt');
    });
    it('substitutes "game" when the name is unusable', () => {
      expect(buildExportFilename('', new Date(2026, 0, 1, 0, 0, 0)))
        .to.eq('game_console_export_2026-01-01_00-00-00.txt');
    });
  });

  describe('normalizeConsoleLevel', () => {
    it('passes through a string level (upper)', () => {
      expect(normalizeConsoleLevel('warning')).to.eq('WARNING');
    });
    it('maps the legacy int levels', () => {
      expect(normalizeConsoleLevel(0)).to.eq('DEBUG');
      expect(normalizeConsoleLevel(1)).to.eq('INFO');
      expect(normalizeConsoleLevel(2)).to.eq('WARN');
      expect(normalizeConsoleLevel(3)).to.eq('ERROR');
      expect(normalizeConsoleLevel(undefined)).to.eq('INFO');
    });
  });

  describe('richFormatArgs (objects EXPANDED — the fix for [object Object])', () => {
    it('expands an object argument as pretty JSON, not [object Object]', () => {
      const out = richFormatArgs(['[TM perf]', {switches: ['--a', '--b'], gpu: {compositing: 'enabled'}}]);
      expect(out).to.not.include('[object Object]');
      expect(out).to.include('"compositing": "enabled"');
      expect(out.startsWith('[TM perf] {')).to.be.true;
    });
    it('renders primitives legibly and joins args with a space', () => {
      expect(richFormatArgs(['n=', 42, true, undefined, null])).to.eq('n= 42 true undefined null');
    });
    it('serializes an Error as its stack (or name: message)', () => {
      const e = new Error('boom');
      const out = richFormatArgs([e]);
      expect(out.startsWith('Error: boom')).to.be.true;
    });
    it('handles a circular reference without throwing', () => {
      const a: Record<string, unknown> = {name: 'a'};
      a.self = a;
      const out = richFormatArgs([a]);
      expect(out).to.include('"name": "a"');
      expect(out).to.include('[Circular]');
    });
    it('renders functions and bigint', () => {
      expect(richFormatArgs([function foo() {}])).to.eq('[Function: foo]');
      expect(richFormatArgs([10n])).to.eq('10n');
    });
    it('caps a monster string so one value cannot blow the file', () => {
      const out = richFormatArgs(['x'.repeat(50000)]);
      expect(out.length).to.be.lessThan(21000);
      expect(out).to.include('…(truncated)');
    });
    it('the injected SOURCE string carries no transpiler helper refs (would ReferenceError in the page)', () => {
      // The page evals RICH_FORMAT_SOURCE as-is. A bundler helper like esbuild's `__name` /
      // `__spreadArray` is undefined in the page → the capture would silently break. Being a plain
      // string, no transpiler rewrites it — assert it stays clean.
      expect(RICH_FORMAT_SOURCE).to.include('WeakSet');
      expect(RICH_FORMAT_SOURCE).to.include('JSON.stringify');
      expect(RICH_FORMAT_SOURCE).to.not.match(/__name|__spreadArray|__assign|_classCallCheck/);
    });
  });

  describe('CONSOLE_CAPTURE — uncaught errors go to the buffer (the export "no errors" bug)', () => {
    it('captures an uncaught exception WITH its stack trace as an ERROR entry', () => {
      const {win, listeners} = runCapture();
      const err = new Error("Cannot read properties of null (reading 'clientHeight')");
      listeners.error({error: err, message: err.message, filename: '401.js', lineno: 1, colno: 5976});
      const buf = win.__tmConsoleBuf as Array<{level: string; text: string}>;
      expect(buf).to.have.length(1);
      expect(buf[0].level).to.eq('ERROR');
      expect(buf[0].text.startsWith('Uncaught Error: ')).to.be.true;
      expect(buf[0].text).to.include("reading 'clientHeight'");
      expect(buf[0].text).to.include('at '); // the stack trace made it through
    });

    it('falls back to message + source location when no Error object is present', () => {
      const {win, listeners} = runCapture();
      listeners.error({message: 'Script error.', filename: 'app://bundle/x.js', lineno: 3, colno: 9});
      const buf = win.__tmConsoleBuf as Array<{level: string; text: string}>;
      expect(buf[0].text).to.eq('Uncaught Script error. (app://bundle/x.js:3:9)');
    });

    it('captures an unhandled promise rejection', () => {
      const {win, listeners} = runCapture();
      listeners.unhandledrejection({reason: new Error('boom')});
      const buf = win.__tmConsoleBuf as Array<{level: string; text: string}>;
      expect(buf[0].level).to.eq('ERROR');
      expect(buf[0].text.startsWith('Unhandled promise rejection: Error: boom')).to.be.true;
    });

    it('records Chromium\'s OWN flattening beside the rich text, so mergeCaptures can spot the twin', () => {
      const {console: wrapped, buf} = runCapture();
      wrapped.error('[app] boom', {a: 1});
      expect(buf()[0].text).to.include('"a": 1');            // rich: expanded, for the reader
      expect(buf()[0].flat).to.eq('[app] boom [object Object]'); // flat: what console-message will say
    });
  });

  // ── The reported blocker: a red line in DevTools that never reached the export ────────────────
  // "обычные логи копируются а ошибки нет" — a failed server call is written by Chromium STRAIGHT
  // to the DevTools front-end: it never passes through console.* and never fires webContents'
  // 'console-message' either (verified against Electron 44). The capture therefore has to take it
  // at the origin, which is what these pin.
  describe('CONSOLE_CAPTURE — failed server calls (the export blocker)', () => {
    it('logs a 404 with status, method, url AND the server\'s own error body', async () => {
      const {win, buf} = runCapture({
        fetch: () => Promise.resolve(fakeResponse(404, 'Not Found', '{"error":"no such game"}')),
      });
      await (win.fetch as (u: string) => Promise<unknown>)('/api/game?id=g1');
      await flushMicrotasks();
      const texts = buf().map((e) => e.text);
      expect(buf().every((e) => e.level === 'ERROR')).to.be.true;
      expect(texts[0]).to.match(/^HTTP 404 Not Found — GET \/api\/game\?id=g1 \(\d+ms\)$/);
      expect(texts[1]).to.eq('  ↳ GET /api/game?id=g1 response body: {"error":"no such game"}');
    });

    it('takes the method from the init AND from a Request object', async () => {
      const {win, buf} = runCapture({fetch: () => Promise.resolve(fakeResponse(500, '', ''))});
      const f = win.fetch as (u: unknown, i?: unknown) => Promise<unknown>;
      await f('/api/a', {method: 'post'});
      await f({url: '/api/b', method: 'PUT'});
      expect(buf().map((e) => e.text.split(' (')[0])).to.deep.eq([
        'HTTP 500  — POST /api/a',
        'HTTP 500  — PUT /api/b',
      ]);
    });

    it('logs a network failure (no response at all) with the reason', async () => {
      const {win, buf} = runCapture({fetch: () => Promise.reject(new TypeError('Failed to fetch'))});
      let rethrown: unknown;
      await (win.fetch as (u: string) => Promise<unknown>)('/api/game').catch((e) => {
        rethrown = e;
      });
      expect((rethrown as Error).message).to.eq('Failed to fetch'); // the app still sees ITS error
      expect(buf()).to.have.length(1);
      expect(buf()[0].text).to.include('HTTP FAILED — GET /api/game');
      expect(buf()[0].text).to.include('Failed to fetch');
    });

    it('stays SILENT on an aborted request — normal flow here, and it would bury the real failures', async () => {
      const abort = Object.assign(new Error('aborted'), {name: 'AbortError'});
      const {win, buf} = runCapture({fetch: () => Promise.reject(abort)});
      await (win.fetch as (u: string) => Promise<unknown>)('/api/journal').catch(() => {});
      expect(buf()).to.have.length(0);
    });

    it('leaves a successful call alone — instrumentation must not change behaviour', async () => {
      const ok = fakeResponse(200, 'OK', 'payload');
      const {win, buf} = runCapture({fetch: () => Promise.resolve(ok)});
      const got = await (win.fetch as (u: string) => Promise<unknown>)('/api/game');
      expect(got).to.eq(ok); // the very same Response instance reaches the caller
      await flushMicrotasks();
      expect(buf()).to.have.length(0);
    });

    it('skips the body snippet when the error payload is huge (never buffer megabytes for 500 chars)', async () => {
      const {win, buf} = runCapture({
        fetch: () => Promise.resolve(fakeResponse(503, 'Unavailable', 'x'.repeat(50), '999999')),
      });
      await (win.fetch as (u: string) => Promise<unknown>)('/api/game');
      await flushMicrotasks();
      expect(buf()).to.have.length(1);
      expect(buf()[0].text).to.include('HTTP 503');
    });

    it('caps the body snippet so one monster error cannot blow the export', async () => {
      const {win, buf} = runCapture({
        fetch: () => Promise.resolve(fakeResponse(400, 'Bad Request', 'y'.repeat(5000), '5000')),
      });
      await (win.fetch as (u: string) => Promise<unknown>)('/api/game');
      await flushMicrotasks();
      expect(buf()[1].text).to.include('…(truncated)');
      expect(buf()[1].text.length).to.be.lessThan(600);
    });
  });

  describe('CONSOLE_CAPTURE — XHR, WebSocket and resource failures', () => {
    // A fake XHR whose open/send the injection wraps on the PROTOTYPE, exactly as in the page.
    function fakeXhrClass() {
      function FakeXHR(this: Record<string, unknown>) {
        this.status = 0;
        this.statusText = '';
        this.responseType = '';
        this.responseText = '';
        this.__h = {} as Record<string, Array<() => void>>;
      }
      FakeXHR.prototype.open = function() {};
      FakeXHR.prototype.send = function() {};
      FakeXHR.prototype.addEventListener = function(this: Record<string, unknown>, type: string, cb: () => void) {
        const h = this.__h as Record<string, Array<() => void>>;
        (h[type] = h[type] ?? []).push(cb);
      };
      FakeXHR.prototype.fire = function(this: Record<string, unknown>, type: string) {
        const h = this.__h as Record<string, Array<() => void>>;
        (h[type] ?? []).forEach((cb) => cb());
      };
      return {FakeXHR};
    }

    it('logs an XHR 404 with its body, composing with (not replacing) the app\'s own handlers', () => {
      const {FakeXHR} = fakeXhrClass();
      const {win, buf} = runCapture({XMLHttpRequest: FakeXHR});
      const x = new (win.XMLHttpRequest as new () => Record<string, unknown>)();
      let appOnloadFired = false;
      (x.addEventListener as (t: string, c: () => void) => void)('load', () => {
        appOnloadFired = true;
      });
      (x.open as (m: string, u: string) => void)('get', '/api/waitingFor?id=p1');
      (x.send as () => void)();
      x.status = 404;
      x.statusText = 'Not Found';
      x.responseText = 'unknown participant';
      (x.fire as (t: string) => void)('load');
      (x.fire as (t: string) => void)('loadend');
      expect(appOnloadFired).to.be.true; // the app's handler still ran
      expect(buf().map((e) => e.text.replace(/ \(\d+ms\)/, ''))).to.deep.eq([
        'HTTP 404 Not Found — GET /api/waitingFor?id=p1',
        '  ↳ response body: unknown participant',
      ]);
    });

    it('logs a dead XHR (status 0) but not a deliberate abort', () => {
      const {FakeXHR} = fakeXhrClass();
      const {win, buf} = runCapture({XMLHttpRequest: FakeXHR});
      const mk = () => {
        const x = new (win.XMLHttpRequest as new () => Record<string, unknown>)();
        (x.open as (m: string, u: string) => void)('GET', '/api/waitingFor');
        (x.send as () => void)();
        return x;
      };
      const dead = mk();
      (dead.fire as (t: string) => void)('loadend');
      const aborted = mk();
      (aborted.fire as (t: string) => void)('abort');
      (aborted.fire as (t: string) => void)('loadend');
      expect(buf()).to.have.length(1);
      expect(buf()[0].text).to.include('XHR FAILED (no response) — GET /api/waitingFor');
    });

    it('never touches responseText when the responseType makes reading it illegal', () => {
      const {FakeXHR} = fakeXhrClass();
      const {win, buf} = runCapture({XMLHttpRequest: FakeXHR});
      const x = new (win.XMLHttpRequest as new () => Record<string, unknown>)();
      (x.open as (m: string, u: string) => void)('GET', '/api/game');
      (x.send as () => void)();
      x.status = 500;
      x.statusText = 'Server Error';
      x.responseType = 'json';
      Object.defineProperty(x, 'responseText', {
        get() {
          throw new Error('InvalidStateError'); // what a real XHR does here
        },
      });
      (x.fire as (t: string) => void)('loadend');
      expect(buf()).to.have.length(1); // the status line survived; no body line, no throw
      expect(buf()[0].text).to.include('HTTP 500 Server Error — GET /api/game');
    });

    it('logs a WebSocket error and an unclean close, but not a clean one', () => {
      const built: Array<Record<string, unknown>> = [];
      function FakeWS(this: Record<string, unknown>, url: string) {
        this.url = url;
        this.__h = {} as Record<string, Array<(ev: unknown) => void>>;
        this.addEventListener = (t: string, cb: (ev: unknown) => void) => {
          const h = this.__h as Record<string, Array<(ev: unknown) => void>>;
          (h[t] = h[t] ?? []).push(cb);
        };
        built.push(this);
      }
      const {win, buf} = runCapture({WebSocket: FakeWS});
      const WS = win.WebSocket as new (u: string) => Record<string, unknown>;
      const sock = new WS('ws://host/realtime');
      const fire = (t: string, ev: unknown) => {
        ((sock.__h as Record<string, Array<(e: unknown) => void>>)[t] ?? []).forEach((cb) => cb(ev));
      };
      fire('close', {wasClean: true, code: 1000});
      expect(buf()).to.have.length(0);
      fire('error', {});
      fire('close', {wasClean: false, code: 1006, reason: 'abnormal'});
      expect(buf().map((e) => e.text)).to.deep.eq([
        'WebSocket error — ws://host/realtime',
        'WebSocket closed uncleanly — ws://host/realtime code=1006 reason=abnormal',
      ]);
    });

    it('logs a failed asset load from the CAPTURE phase (a resource error never bubbles to window)', () => {
      const {capturing, listeners, buf} = runCapture();
      expect(capturing.error, 'the resource hook must be registered with useCapture=true').to.be.a('function');
      capturing.error({target: {tagName: 'IMG', src: 'app://bundle/assets/cards/x.png'}});
      expect(buf()[0].level).to.eq('ERROR');
      expect(buf()[0].text).to.eq('Resource failed to load: <img> app://bundle/assets/cards/x.png');
      // A SCRIPT error also travels through the capture phase — it belongs to the bubble hook, and
      // this one must not double-report it.
      capturing.error({message: 'boom', target: undefined});
      expect(buf()).to.have.length(1);
      expect(listeners.error).to.be.a('function');
    });
  });

  describe('formatConsoleEntry', () => {
    it('renders [time] LEVEL message with an optional source suffix', () => {
      const line = formatConsoleEntry({t: new Date(2026, 6, 17, 8, 5, 9).getTime(), level: 'ERROR', text: 'boom', source: 'app://bundle/main.js:12'});
      expect(line).to.eq('[08:05:09] ERROR boom  (app://bundle/main.js:12)');
    });
    it('omits the source suffix when empty', () => {
      const line = formatConsoleEntry({t: new Date(2026, 6, 17, 8, 5, 9).getTime(), level: 'INFO', text: 'hi', source: ''});
      expect(line).to.eq('[08:05:09] INFO  hi');
    });
  });

  describe('mergeCaptures — both buffers ship, neither is discarded', () => {
    const entry = (t: number, level: string, text: string, flat?: string): ConsoleEntry =>
      ({t, level, text, source: '', ...(flat === undefined ? {} : {flat})});

    it('keeps a browser-generated line the injection structurally cannot see', () => {
      // THE REGRESSION: the dump used to be `rich.length > 0 ? rich : fallback`, so one non-empty
      // console.log was enough to throw every console-message line — errors included — away.
      const rich = [entry(1, 'LOG', 'ordinary line', 'ordinary line')];
      const fallback = [
        entry(1, 'INFO', 'ordinary line'),
        entry(2, 'ERROR', 'Refused to connect to ws://host — CSP'),
      ];
      expect(mergeCaptures(rich, fallback).map((e) => e.text)).to.deep.eq([
        'ordinary line',
        'Refused to connect to ws://host — CSP',
      ]);
    });

    it('drops the flattened twin of a rich line, occurrence by occurrence', () => {
      const rich = [
        entry(1, 'ERROR', '[app] boom {\n  "a": 1\n}', '[app] boom [object Object]'),
        entry(2, 'ERROR', '[app] boom {\n  "a": 1\n}', '[app] boom [object Object]'),
      ];
      const fallback = [
        entry(1, 'ERROR', '[app] boom [object Object]'),
        entry(2, 'ERROR', '[app] boom [object Object]'),
        entry(3, 'ERROR', '[app] boom [object Object]'), // a THIRD, with no rich twin — keep it
      ];
      const merged = mergeCaptures(rich, fallback);
      expect(merged).to.have.length(3);
      expect(merged.filter((e) => e.text.includes('"a": 1'))).to.have.length(2);
      expect(merged[2].text).to.eq('[app] boom [object Object]');
    });

    it('interleaves the surviving lines by timestamp', () => {
      const rich = [entry(10, 'LOG', 'r1', 'r1'), entry(30, 'LOG', 'r2', 'r2')];
      const fallback = [entry(20, 'WARNING', 'f1')];
      expect(mergeCaptures(rich, fallback).map((e) => e.text)).to.deep.eq(['r1', 'f1', 'r2']);
    });

    it('falls back wholesale when the injection never ran (CSP blocked it)', () => {
      const fallback = [entry(1, 'ERROR', 'boom')];
      expect(mergeCaptures([], fallback)).to.deep.eq(fallback);
    });

    it('matches on text when a rich entry has no flattening (network/uncaught hooks)', () => {
      const rich = [entry(1, 'ERROR', 'HTTP 404 Not Found — GET /api/game')];
      const fallback = [entry(1, 'ERROR', 'HTTP 404 Not Found — GET /api/game')];
      expect(mergeCaptures(rich, fallback)).to.have.length(1);
    });
  });

  describe('buildErrorDigest — the export leads with what broke', () => {
    const err = (t: number, text: string): ConsoleEntry => ({t, level: 'ERROR', text, source: ''});

    it('reprints the errors at the head of the file', () => {
      const digest = buildErrorDigest([
        {t: new Date(2026, 6, 17, 8, 0, 0).getTime(), level: 'LOG', text: 'noise', source: ''},
        err(new Date(2026, 6, 17, 8, 0, 1).getTime(), 'HTTP 404 Not Found — GET /api/game'),
      ]);
      expect(digest).to.eq('ERRORS: 1\n[08:00:01] ERROR HTTP 404 Not Found — GET /api/game\n');
    });

    it('says so plainly when there are none', () => {
      expect(buildErrorDigest([{t: 0, level: 'LOG', text: 'hi', source: ''}])).to.eq('ERRORS: none captured\n');
    });

    it('keeps the LAST errors when there are more than the limit, and says how many it dropped', () => {
      const many = Array.from({length: 5}, (_, i) => err(i, `e${i}`));
      const digest = buildErrorDigest(many, 2);
      expect(digest).to.include('ERRORS: 5 (last 2 shown here — all of them are in the full log below)');
      expect(digest).to.include('e3');
      expect(digest).to.include('e4');
      expect(digest).to.not.include('e0');
    });

    it('counts the levels a bug report leads with', () => {
      expect(isErrorLevel('ERROR')).to.be.true;
      expect(isErrorLevel('error')).to.be.true;   // console-message hands them lowercase
      expect(isErrorLevel('WARNING')).to.be.false;
      expect(isErrorLevel('INFO')).to.be.false;
    });
  });
});
