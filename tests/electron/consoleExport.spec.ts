import {expect} from 'chai';
import {
  buildExportFilename, CONSOLE_CAPTURE, formatConsoleEntry, formatStamp, makeRichFormatter,
  normalizeConsoleLevel, RICH_FORMAT_SOURCE, sanitizeForFilename,
} from '../../electron/consoleExport';

// Exercise the EXACT source the renderer main world runs (compiled from the string, no drift).
const richFormatArgs = makeRichFormatter();

// Pure unit test of the console-export naming + formatting helpers (the capture/write side is a
// thin Electron shim around these).
//   npx mocha --import=tsx "tests/electron/consoleExport.spec.ts"

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
    // Evaluate the injected main-world script against a fake window/console, then drive the
    // listeners it registers. The uncaught-error path is what the console.* wrappers never see,
    // so it must land in __tmConsoleBuf directly (with a stack trace when available).
    function runCapture() {
      const listeners: Record<string, (ev: unknown) => void> = {};
      const win: Record<string, unknown> = {
        addEventListener(type: string, cb: (ev: unknown) => void) {
          listeners[type] = cb;
        },
      };
      const fakeConsole: Record<string, (...a: unknown[]) => void> = {
        log() {}, info() {}, warn() {}, error() {}, debug() {},
      };
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      new Function('window', 'console', CONSOLE_CAPTURE)(win, fakeConsole);
      return {win, listeners};
    }

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
});
