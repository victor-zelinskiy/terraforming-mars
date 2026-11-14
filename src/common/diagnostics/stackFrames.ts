/*
 * A V8 STACK, PARSED — once, for both of its readers: the journal's reading surface (our frames lead, a library's step
 * back) and the event the hub sends (frames + the files' debug ids, so the stack is resolved to `src/…:line`).
 *
 * Every runtime of this app is V8 (Chromium's renderer, Electron's main process, the Node of the embedded server), so
 * ONE format is parsed:
 *
 *     TypeError: Cannot read properties of null (reading 'x')
 *         at fold (app://bundle/main.js:2:1834)
 *         at async Object.run (app://bundle/chunks/vendors.js:9:120)
 *         at app://bundle/main.js:2:99
 *         at new Scope (node:internal/process/task_queues:105:5)
 *
 * Pure. A line that is not a frame is skipped, never thrown on.
 */

import {DiagFrame} from './DiagnosticModel';

/** `at <fn> (<location>)` and `at <location>`; `async` / `new` are part of the function's name as printed. */
const FRAME = /^\s*at (?:(.+?) \()?(.+?)\)?\s*$/;
const LOCATION = /^(.*?):(\d+)(?::(\d+))?$/;

/** A frame of somebody else's code: a bundled dependency, the runtime's own modules, an extension. */
const LIBRARY_FILE = /(?:^|[\\/])node_modules[\\/]|[\\/]vendors\.js|[\\/]chunks[\\/]chartjs|^node:|^electron[\\/]js2c|^chrome-extension:|^<anonymous>$|^native$|^webpack[\\/]|[\\/]webpack[\\/]runtime/;

export function isLibraryFile(file: string): boolean {
  return file === '' || LIBRARY_FILE.test(file);
}

/** The frames of a stack, innermost first (the order V8 prints). */
export function parseStack(stack: string | undefined): Array<DiagFrame> {
  if (stack === undefined || stack === '') {
    return [];
  }
  const frames: Array<DiagFrame> = [];
  for (const raw of stack.split('\n')) {
    if (!/^\s*at /.test(raw)) {
      continue;
    }
    const m = FRAME.exec(raw);
    if (m === null) {
      continue;
    }
    let fn = (m[1] ?? '').trim();
    let location = (m[2] ?? '').trim();
    // `at eval (eval at <anonymous> (file:1:1), <anonymous>:3:9)` — the OUTER location is the one a map resolves.
    const evalAt = /^eval at .*? \((.+?)\)(?:, .*)?$/.exec(location);
    if (evalAt !== null) {
      location = evalAt[1];
    }
    // `at fn [as alias]` keeps the name the code wrote.
    fn = fn.replace(/ \[as [^\]]+\]$/, '');
    const loc = LOCATION.exec(location);
    const file = loc === null ? location : loc[1];
    const frame: DiagFrame = {fn, file, inApp: !isLibraryFile(file)};
    if (loc !== null) {
      frame.line = Number(loc[2]);
      if (loc[3] !== undefined) {
        frame.col = Number(loc[3]);
      }
    }
    frames.push(frame);
  }
  return frames;
}

/** What stands above the frames: `TypeError: message` (possibly several lines). */
export function stackHead(stack: string | undefined): string {
  if (stack === undefined) {
    return '';
  }
  const lines = stack.split('\n');
  const first = lines.findIndex((l) => /^\s*at /.test(l));
  return (first < 0 ? lines : lines.slice(0, first)).join('\n').trim();
}

/** `main.js:2:1834` — the file's last segment with its position: what a frame row prints. */
export function frameLocation(frame: DiagFrame): string {
  if (frame.file === '') {
    return '';
  }
  const tail = frame.file.replace(/[?#].*$/, '').split(/[\\/]/).filter((s) => s !== '').slice(-2).join('/');
  return frame.line === undefined ? tail : `${tail}:${frame.line}${frame.col === undefined ? '' : `:${frame.col}`}`;
}

/**
 * The key two throws of the same defect share: the error's type, its message with the numbers taken out (an id, an
 * index, a duration differ between throws), and the first frame of our own code.
 */
export function stackFingerprint(head: string, frames: ReadonlyArray<DiagFrame>): string {
  const own = frames.find((f) => f.inApp) ?? frames[0];
  const where = own === undefined ? '' : `${own.fn}@${own.file.replace(/[?#].*$/, '')}`;
  return `${normalizeMessage(head)}|${where}`;
}

/** A message with what varies between two occurrences taken out: numbers, hex ids, quoted values. */
export function normalizeMessage(message: string): string {
  return message.split('\n')[0]
    .replace(/\b[pgs]?[0-9a-f]{8,}\b/gi, '#')
    .replace(/\d+(?:\.\d+)?/g, 'N')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}
