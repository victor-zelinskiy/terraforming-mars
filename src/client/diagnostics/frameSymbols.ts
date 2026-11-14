/*
 * A MINIFIED FRAME, READ BACK — `E  main.js:1:2208616` → `src/client/console/hand/handStage.ts:412`.
 *
 * The journal's reading surface promises that the frames of our own code are READABLE. On a release build they are
 * minified, and the collector resolves them for whoever reads Sentry — but the developer at play reads the game's own
 * screen. So the build leaves, beside its two initial chunks, the part of their source maps a frame needs
 * (`scripts/make-frame-symbols.mjs` → `main.js.symbols.json`, `vendors.js.symbols.json`: sources, names, mappings —
 * never the source text), and this module resolves a frame against it, on demand:
 *
 *  · nothing is fetched until a record is opened (the symbols are megabytes — never on the boot's path);
 *  · a fetched file is decoded once and kept for the page's life;
 *  · a frame with no symbols (a lazy chunk, a build that left none, the main process's and the server's frames) stays
 *    exactly as V8 printed it — a missing map is never an error.
 *
 * A browser build has the whole `.map` beside the script instead; it is read the same way (`<script>.map` is the
 * fallback when `<script>.symbols.json` is absent).
 *
 * The decoding is the source-map v3 format's own (base64 VLQ segments, `;` between generated lines, `,` between
 * segments, every field a delta) — pure, spec'd, no library.
 */

import {DiagFrame} from '@/common/diagnostics/DiagnosticModel';

export type FrameSymbols = {
  sources: ReadonlyArray<string>;
  names: ReadonlyArray<string>;
  /** Per generated line (0-based): its segments as flat quintuples `[column, source, line, column, name]` (-1 = none), sorted by column. */
  lines: ReadonlyArray<Int32Array>;
};

export type ResolvedFrame = {
  /** `src/client/console/hand/handStage.ts`. */
  source: string;
  /** 1-based, as an editor shows it. */
  line: number;
  /** The identifier the map names at that position ('' = none). */
  name: string;
};

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const DIGIT = new Int8Array(128).fill(-1);
for (let i = 0; i < BASE64.length; i++) {
  DIGIT[BASE64.charCodeAt(i)] = i;
}

/** The `mappings` string, decoded: one array of quintuples per generated line. Pure. */
export function decodeMappings(mappings: string): Array<Int32Array> {
  const lines: Array<Int32Array> = [];
  let segments: Array<number> = [];
  // The four running values that persist ACROSS lines (the generated column alone restarts on every line).
  let source = 0;
  let sourceLine = 0;
  let sourceColumn = 0;
  let name = 0;
  let column = 0;
  const fields = [0, 0, 0, 0, 0];
  let field = 0;
  let value = 0;
  let shift = 0;
  const closeSegment = (): void => {
    if (field === 0) {
      return;
    }
    column += fields[0];
    if (field >= 4) {
      source += fields[1];
      sourceLine += fields[2];
      sourceColumn += fields[3];
      if (field >= 5) {
        name += fields[4];
      }
      segments.push(column, source, sourceLine, sourceColumn, field >= 5 ? name : -1);
    } else {
      // A one-field segment: generated code with no source behind it.
      segments.push(column, -1, -1, -1, -1);
    }
    field = 0;
  };
  for (let i = 0; i < mappings.length; i++) {
    const code = mappings.charCodeAt(i);
    if (code === 59 /* ; */) {
      closeSegment();
      lines.push(Int32Array.from(segments));
      segments = [];
      column = 0;
      continue;
    }
    if (code === 44 /* , */) {
      closeSegment();
      continue;
    }
    const digit = code < 128 ? DIGIT[code] : -1;
    if (digit < 0) {
      continue;
    }
    value += (digit & 31) << shift;
    if ((digit & 32) !== 0) {
      shift += 5;
      continue;
    }
    // The last digit of a VLQ: the lowest bit is the sign.
    const negative = (value & 1) === 1;
    value >>= 1;
    if (field < 5) {
      fields[field] = negative ? -value : value;
    }
    field++;
    value = 0;
    shift = 0;
  }
  closeSegment();
  lines.push(Int32Array.from(segments));
  return lines;
}

/** `webpack://terraforming-mars/./src/client/x.ts` → `src/client/x.ts`; a dependency keeps its package path. */
export function cleanSourcePath(source: string): string {
  return source
    .replace(/^webpack:\/\/[^/]*\//, '')
    .replace(/^\.\//, '')
    .replace(/\?.*$/, '')
    .replace(/^.*\/node_modules\//, 'node_modules/');
}

export function parseFrameSymbols(json: {sources?: ReadonlyArray<string>, names?: ReadonlyArray<string>, mappings?: string}): FrameSymbols {
  return {
    sources: (json.sources ?? []).map(cleanSourcePath),
    names: json.names ?? [],
    lines: decodeMappings(json.mappings ?? ''),
  };
}

/** The source position behind a generated one (both 1-based for the line, 1-based column as V8 prints it). Pure. */
export function resolvePosition(symbols: FrameSymbols, line: number, column: number): ResolvedFrame | undefined {
  const segments = symbols.lines[line - 1];
  if (segments === undefined || segments.length === 0) {
    return undefined;
  }
  // The LAST segment that starts at or before the column (V8's column is 1-based, the map's 0-based).
  const target = column - 1;
  let lo = 0;
  let hi = segments.length / 5 - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (segments[mid * 5] <= target) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (found < 0) {
    return undefined;
  }
  const at = found * 5;
  const sourceIndex = segments[at + 1];
  const source = sourceIndex < 0 ? undefined : symbols.sources[sourceIndex];
  if (source === undefined) {
    return undefined;
  }
  const nameIndex = segments[at + 4];
  return {source, line: segments[at + 2] + 1, name: nameIndex < 0 ? '' : (symbols.names[nameIndex] ?? '')};
}

type Fetcher = (url: string) => Promise<unknown>;

const cache = new Map<string, Promise<FrameSymbols | undefined>>();

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(String(response.status));
  }
  return response.json();
}

/** The symbols of one script (its URL as a frame names it), fetched and decoded once. Never rejects. */
export function frameSymbolsOf(file: string, fetcher: Fetcher = fetchJson): Promise<FrameSymbols | undefined> {
  const script = file.replace(/[?#].*$/, '');
  let known = cache.get(script);
  if (known === undefined) {
    known = (async () => {
      // Only the page's own scripts have symbols to fetch (never a `node:` module, a path of another runtime).
      if (!/^(?:https?|app):\/\/.*\.js$/.test(script)) {
        return undefined;
      }
      for (const url of [`${script}.symbols.json`, `${script}.map`]) {
        try {
          return parseFrameSymbols(await fetcher(url) as Parameters<typeof parseFrameSymbols>[0]);
        } catch {
          // absent or unreadable — the next candidate, or none
        }
      }
      return undefined;
    })();
    cache.set(script, known);
  }
  return known;
}

/** Every frame of a stack, resolved where its script has symbols (`undefined` where it has none). Never rejects. */
export async function resolveFrames(frames: ReadonlyArray<DiagFrame>, fetcher: Fetcher = fetchJson): Promise<Array<ResolvedFrame | undefined>> {
  const resolved: Array<ResolvedFrame | undefined> = [];
  for (const frame of frames) {
    if (frame.file === '' || frame.line === undefined || frame.col === undefined) {
      resolved.push(undefined);
      continue;
    }
    const symbols = await frameSymbolsOf(frame.file, fetcher);
    resolved.push(symbols === undefined ? undefined : resolvePosition(symbols, frame.line, frame.col));
  }
  return resolved;
}

/** Spec seam. */
export function __resetFrameSymbolsForTesting(): void {
  cache.clear();
}
