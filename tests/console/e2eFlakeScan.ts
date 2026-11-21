/**
 * THE E2E FLAKE SCAN — one reader of «what in this e2e file depends on how fast the machine is» (FLAKE ZERO,
 * 2026-11-15; the taxonomy: `docs/claude/e2e-flake-zero.md` § 3, the canon: `.claude/rules/tests.md` § КАК ПИСАТЬ
 * E2E-ПРОВЕРКУ). The guard (`e2eDriverGuard.spec.ts` ④ · ⑧–⑬) and the baseline writer read the SAME scan, so a count
 * the guard compares is a count the writer froze — never two copies of a regex drifting apart.
 *
 *   waitForTimeout         G  a pause standing in for a state                       (every file)
 *   requestAnimationFrame  B  a frame-clocked sampler                               (every file)
 *   setInterval            B  a sampler that sleeps through a transient            (every file)
 *   oneShotRead            A  `expect(await <x>.count() | .isVisible() | …)`       (specs)
 *   driverClock            H  a value from the DRIVER's `Date.now()` asserted      (functional specs)
 *   looseGeometry          C  a geometry read outside `readSettled` / a recorder   (specs)
 *   goneAsDone             E  «X left the screen» as the end of a step, no server  (specs)
 *   msOrder                I  a STRICT order of two `.t` stamps (`a.t > b.t`)        (specs)
 *
 * Usage (also `npm run e2e:baseline`):
 *   tsx tests/console/e2eFlakeScan.ts --write     — regenerate `e2eRatchetBaseline.json`
 *   tsx tests/console/e2eFlakeScan.ts             — print the totals (dry run)
 *   tsx tests/console/e2eFlakeScan.ts --census    — the heaviest spec files, per class
 */
import * as fs from 'fs';
import * as path from 'path';
import {isTimingSpec} from '../e2e/timingSpecs';

export const E2E_DIR = path.resolve(__dirname, '..', 'e2e');
export const BASELINE_FILE = path.resolve(__dirname, 'e2eRatchetBaseline.json');

export const SCAN_KEYS = ['waitForTimeout', 'requestAnimationFrame', 'setInterval', 'oneShotRead', 'driverClock', 'looseGeometry', 'goneAsDone', 'msOrder'] as const;
export type ScanKey = typeof SCAN_KEYS[number];
export type ScanCounts = Partial<Record<ScanKey, number>>;
export type Baseline = {totals: ScanCounts, files: Record<string, ScanCounts>};

/** Strip line + block comments so a rule never fires on prose about itself (positions and line numbers kept). */
export function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length));
}

export function lineOf(text: string, index: number): number {
  return text.slice(0, index).split('\n').length;
}

/**
 * The index of the bracket closing the one at `open` (`(`, `[` or `{`), skipping string and template literals
 * (a `${…}` inside a template is code again). -1 when unbalanced.
 */
export function matchingClose(text: string, open: number): number {
  const pairs: Record<string, string> = {'(': ')', '[': ']', '{': '}'};
  const stack: Array<string> = [];
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === '\'' || c === '"') {
      i = skipQuoted(text, i, c);
      continue;
    }
    if (c === '`') {
      i = skipTemplate(text, i);
      continue;
    }
    if (pairs[c] !== undefined) {
      stack.push(pairs[c]);
    } else if (c === ')' || c === ']' || c === '}') {
      if (stack.pop() !== c) {
        return -1;
      }
      if (stack.length === 0) {
        return i;
      }
    }
  }
  return -1;
}

function skipQuoted(text: string, at: number, quote: string): number {
  for (let i = at + 1; i < text.length; i++) {
    if (text[i] === '\\') {
      i++;
    } else if (text[i] === quote || text[i] === '\n') {
      return i;
    }
  }
  return text.length;
}

function skipTemplate(text: string, at: number): number {
  for (let i = at + 1; i < text.length; i++) {
    if (text[i] === '\\') {
      i++;
    } else if (text[i] === '`') {
      return i;
    } else if (text[i] === '$' && text[i + 1] === '{') {
      const close = matchingClose(text, i + 1);
      if (close < 0) {
        return text.length;
      }
      i = close;
    }
  }
  return text.length;
}

/** The end (exclusive) of the FIRST argument of the call whose `(` is at `open`. */
export function firstArgEnd(text: string, open: number): number {
  const close = matchingClose(text, open);
  const end = close < 0 ? text.length : close;
  for (let i = open + 1; i < end; i++) {
    const c = text[i];
    if (c === '\'' || c === '"') {
      i = skipQuoted(text, i, c);
    } else if (c === '`') {
      i = skipTemplate(text, i);
    } else if (c === '(' || c === '[' || c === '{') {
      const inner = matchingClose(text, i);
      if (inner < 0) {
        return end;
      }
      i = inner;
    } else if (c === ',') {
      return i;
    }
  }
  return end;
}

/** The [start, end) spans of the arguments of every call matching `callee(` (the regex must end at the `(`). */
export function callSpans(text: string, callee: RegExp): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  const re = new RegExp(callee.source, 'g');
  for (const m of text.matchAll(re)) {
    const open = (m.index ?? 0) + m[0].length - 1;
    const close = matchingClose(text, open);
    if (close > open) {
      spans.push([open, close]);
    }
  }
  return spans;
}

const inSpans = (spans: ReadonlyArray<[number, number]>, i: number) => spans.some(([a, b]) => i > a && i < b);

const COUNTED_EVERYWHERE: Record<'waitForTimeout' | 'requestAnimationFrame' | 'setInterval', RegExp> = {
  waitForTimeout: /\bwaitForTimeout\s*\(/g,
  requestAnimationFrame: /\brequestAnimationFrame\b/g,
  setInterval: /\bsetInterval\s*\(/g,
};

/**
 * A — the read is THE first argument of `expect(await …)`: a live state taken once, right where the machine had got
 * to. The LAST call of the awaited chain is the read (`expect(await pressUntil(…, () => x.count() > 0))` asserts a
 * driver's verdict, not a read).
 */
const LIVE_READ = /^await\s+[\s\S]*\.(?:count|isVisible|isHidden|textContent|innerText|getAttribute|isEnabled|isDisabled|isChecked|inputValue|allTextContents|allInnerTexts)\((?:[^()]|\([^()]*\))*\)$/;

export type OneShotRead = {
  /** `expect(` … through the matcher call's `)`, in the text's coordinates. */
  start: number, end: number,
  /** The awaited read (without `await`), the message argument ('' when none), the chain after `expect(…)`. */
  read: string, message: string, chain: string,
};

/** Every `expect(await <read>[, message]).<matcher>(…)` STATEMENT whose first argument is a one-shot live read. */
export function oneShotReads(text: string): Array<OneShotRead> {
  const out: Array<OneShotRead> = [];
  for (const m of text.matchAll(/\bexpect\s*\(/g)) {
    const start = m.index ?? 0;
    if (/[.\w$]$/.test(text.slice(0, start))) {
      continue; // `x.expect(` / `myexpect(`
    }
    const open = start + m[0].length - 1;
    const close = matchingClose(text, open);
    if (close < 0) {
      continue;
    }
    const argEnd = firstArgEnd(text, open);
    const first = text.slice(open + 1, argEnd).trim();
    if (!LIVE_READ.test(first)) {
      continue;
    }
    // The matcher chain: `.not.toBe(…)` / `.toContain(…)` right after the call.
    const chainHead = /^\s*((?:\.\s*not)?\s*\.\s*[A-Za-z]+)\s*\(/.exec(text.slice(close + 1));
    if (chainHead === null) {
      continue;
    }
    const matcherOpen = close + 1 + chainHead[0].length - 1;
    const matcherClose = matchingClose(text, matcherOpen);
    if (matcherClose < 0) {
      continue;
    }
    out.push({
      start, end: matcherClose + 1,
      read: first.replace(/^await\s+/, ''),
      message: argEnd < close ? text.slice(argEnd + 1, close).trim().replace(/,$/, '').trim() : '',
      chain: text.slice(close + 1, matcherClose + 1).trim(),
    });
  }
  return out;
}

/** C — the reads of geometry; and the calls whose readers are the sanctioned homes of one. */
const GEOMETRY = /\bgetBoundingClientRect\b|\.boundingBox\(/g;
const SETTLED_HOMES = /\b(?:readSettled|armWitness|recordTransient|witnessOf)\s*(?:<[^()]*?>)?\s*\(/;

/** E — the surfaces whose disappearance was once taken for «the server moved on» (`tests.md` — a driver's «done»). */
export const DONE_BY_GONE_SELECTORS: ReadonlyArray<string> = ['.con-context__task-kicker', '.con-composer--play'];
const SERVER_TRUTH = /\b(?:syncClient|promptId|wireOf|fetchPlayerModel|waitingFor|sendPlayerInput\w*|answerAsksAs|placementState)\b/;

/**
 * The spans of every call to `callee(` — and the bodies of the file's top-level functions NAMED inside one of them
 * (`readSettled(page, () => rect(page))`, `page.evaluate(installProbe)`): code that runs in that home.
 */
function homeSpans(text: string, callee: RegExp): Array<[number, number]> {
  const homes = callSpans(text, callee);
  const named = new Set<string>();
  for (const [a, b] of homes) {
    for (const m of text.slice(a, b).matchAll(/\b([A-Za-z_]\w*)\s*\(/g)) {
      named.add(m[1]);
    }
    for (const m of text.slice(a, b).matchAll(/[(,]\s*([A-Za-z_]\w*)\s*[,)]/g)) {
      named.add(m[1]);
    }
  }
  return [...homes, ...declaredBodies(text, named)];
}

function countLooseGeometry(text: string): number {
  const homes = homeSpans(text, SETTLED_HOMES);
  let n = 0;
  for (const m of text.matchAll(GEOMETRY)) {
    if (!inSpans(homes, m.index ?? 0)) {
      n++;
    }
  }
  return n;
}

/** The bodies of the top-level declarations (`function x(…) {…}` / `const x = (…) => …`) whose name is in `named`. */
function declaredBodies(text: string, named: ReadonlySet<string>): Array<[number, number]> {
  const readerBodies: Array<[number, number]> = [];
  for (const m of text.matchAll(/(?:^|\n)(?:export\s+)?(?:async\s+)?(?:function\s+([A-Za-z_]\w*)\s*(?:<[^>]*>)?\s*\(|const\s+([A-Za-z_]\w*)\s*=\s*(?:async\s*)?(?:<[^>]*>)?\s*\()/g)) {
    const name = m[1] ?? m[2];
    if (!named.has(name)) {
      continue;
    }
    const start = (m.index ?? 0) + m[0].length - 1;
    // The body: the next `{` after the parameter list, or the arrow's expression up to the declaration's end.
    const params = matchingClose(text, start);
    if (params < 0) {
      continue;
    }
    const brace = text.indexOf('{', params);
    const nextDecl = text.slice(params).search(/\n(?:export\s+)?(?:async\s+)?(?:function|const|let|type|test|describe)\b/);
    const declEnd = nextDecl < 0 ? text.length : params + nextDecl;
    const bodyEnd = brace >= 0 && brace < declEnd ? Math.max(matchingClose(text, brace), declEnd) : declEnd;
    readerBodies.push([start, bodyEnd]);
  }
  return readerBodies;
}

/** Code that runs IN THE PAGE (its `Date.now()` is the page's clock, its geometry the page's own read). */
const PAGE_CODE = /\b(?:evaluate|evaluateHandle|addInitScript|waitForFunction|recordTransient|armWitness|exposeBinding|exposeFunction)\s*(?:<[^()]*?>)?\s*\(/;

function countDriverClock(text: string): number {
  const page = homeSpans(text, PAGE_CODE);
  const word = (name: string) => new RegExp(`(?<![.\\w$])${name}\\b`);
  // The DRIVER's clock: names assigned ON THE NODE SIDE from `Date.now()`, and from those — two rounds.
  const names = new Set<string>();
  const assign = /\b(?:const|let|var)\s+([A-Za-z_]\w*)\s*=\s*([^;\n]*)/g;
  for (let round = 0; round < 2; round++) {
    for (const m of text.matchAll(assign)) {
      if (inSpans(page, m.index ?? 0)) {
        continue; // the page's clock
      }
      const rhs = m[2];
      if (PAGE_CODE.test(rhs)) {
        continue; // a value read through the page
      }
      if (/\bDate\.now\(\)/.test(rhs) || [...names].some((n) => word(n).test(rhs))) {
        names.add(m[1]);
      }
    }
  }
  // Only the asserted VALUE counts (the first argument): a duration in a failure MESSAGE is a diagnosis, not a claim.
  let n = 0;
  for (const m of text.matchAll(/\bexpect(?:\.soft)?\s*\(/g)) {
    const open = (m.index ?? 0) + m[0].length - 1;
    const arg = text.slice(open + 1, firstArgEnd(text, open));
    if (/\bDate\.now\(\)/.test(arg) || [...names].some((name) => word(name).test(arg))) {
      n++;
    }
  }
  return n;
}

/**
 * A STRICT order of two whole-millisecond stamps — `expect(a.t, …).toBeGreaterThan(b.t)` / `toBeLessThan`. Two
 * callbacks of one 300 ms frame share a `t` (the hunt 44905320939: «#1 +9 t=10661 · #2 ПО+2 t=10661»): an order of two
 * states of ONE record is its INDEX (`samples.indexOf`, a witness's ids). A tolerance — `toBeGreaterThanOrEqual`,
 * «no earlier than» — is not counted (tests.md law 14).
 */
function countMsOrder(text: string): number {
  return (text.match(/expect\(\s*[\w$.!?[\]()]+?\.t\b[^;]*?\)\s*\.(?:toBeGreaterThan|toBeLessThan)\(\s*[\w$.!?[\]()]+?\.t\s*\)/g) ?? []).length;
}

function countGoneAsDone(text: string): number {
  // A DRIVER whose press loop ENDS when the surface itself is gone (its exact selector — a sub-element's absence is a
  // different question): `pressUntilGone(…, '<surface>')`, or `pressUntil(…)` whose witness is that surface's count
  // reaching zero. An assertion that it left (`toHaveCount(0)` after B) is a CLAIM about the surface, not a driver's
  // «done», and `count() === 0` in a loop condition is the opposite («until it OPENS») — neither is counted.
  const lines = text.split('\n');
  const named = (span: string) => DONE_BY_GONE_SELECTORS.some((sel) => span.includes(`'${sel}'`));
  const loops = [
    ...callSpans(text, /\bpressUntilGone\s*\(/).filter(([a, b]) => named(text.slice(a, b))),
    ...callSpans(text, /\bpressUntil\s*\(/).filter(([a, b]) => named(text.slice(a, b)) && /===\s*0/.test(text.slice(a, b))),
  ];
  let n = 0;
  for (const [a, b] of loops) {
    const first = lineOf(text, a) - 1;
    const last = lineOf(text, b) - 1;
    const near = lines.slice(Math.max(0, first - 2), last + 7).join('\n');
    if (!SERVER_TRUTH.test(near)) {
      n++;
    }
  }
  return n;
}

/**
 * The functional specs whose SUBJECT is the driver's own clock — each with the reason (a row is the exception the guard
 * names, never a silent widening).
 */
export const DRIVER_CLOCK_IS_THE_SUBJECT: Readonly<Record<string, string>> = {
  'hung-page-control.spec.ts': 'the positive control of the harness hung-page bound: the page is hung ON PURPOSE (its ' +
    'clock stands still), and the claim is that the DRIVER settle throws within its own bound',
};

/** Every class counted in one e2e file (`rel` relative to `tests/e2e`). */
export function scanText(rel: string, raw: string): ScanCounts {
  const text = stripComments(raw);
  const spec = rel.endsWith('.spec.ts');
  const out: ScanCounts = {};
  const put = (k: ScanKey, n: number) => {
    if (n > 0) {
      out[k] = n;
    }
  };
  for (const [k, re] of Object.entries(COUNTED_EVERYWHERE)) {
    put(k as ScanKey, (text.match(re) ?? []).length);
  }
  if (spec) {
    put('oneShotRead', oneShotReads(text).length);
    put('looseGeometry', countLooseGeometry(text));
    put('goneAsDone', countGoneAsDone(text));
    put('msOrder', countMsOrder(text));
    if (!isTimingSpec(rel) && DRIVER_CLOCK_IS_THE_SUBJECT[rel] === undefined) {
      put('driverClock', countDriverClock(text));
    }
  }
  return out;
}

const SOURCES = new Map<string, string>();
/** ONE READ PER FILE PER RUN (a static check has no clock in its subject — its budget is the read, paid once). */
export function readE2e(rel: string): string {
  let text = SOURCES.get(rel);
  if (text === undefined) {
    text = fs.readFileSync(path.join(E2E_DIR, rel), 'utf8');
    SOURCES.set(rel, text);
  }
  return text;
}

export function allE2eFiles(dir = E2E_DIR, prefix = ''): Array<string> {
  const out: Array<string> = [];
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (entry.isDirectory()) {
      if (entry.name !== 'fixtures' && entry.name !== 'node_modules') {
        out.push(...allE2eFiles(path.join(dir, entry.name), `${prefix}${entry.name}/`));
      }
    } else if (entry.name.endsWith('.ts')) {
      out.push(`${prefix}${entry.name}`);
    }
  }
  return out.sort();
}

let scanned: Map<string, ScanCounts> | undefined;
export function scanTree(): Map<string, ScanCounts> {
  if (scanned === undefined) {
    scanned = new Map(allE2eFiles().map((rel) => [rel, scanText(rel, readE2e(rel))]));
  }
  return scanned;
}

export function baselineOf(scan: Map<string, ScanCounts>): Baseline {
  const files: Record<string, ScanCounts> = {};
  // Every class stands in the totals, a class at ZERO included — that zero is the law the guard keeps.
  const totals: ScanCounts = Object.fromEntries(SCAN_KEYS.map((k) => [k, 0]));
  for (const [rel, counts] of scan) {
    if (Object.keys(counts).length > 0) {
      files[rel] = counts;
    }
    for (const [k, n] of Object.entries(counts)) {
      totals[k as ScanKey] = (totals[k as ScanKey] ?? 0) + (n ?? 0);
    }
  }
  return {totals, files};
}

if (require.main === module) {
  const scan = scanTree();
  const base = baselineOf(scan);
  if (process.argv.includes('--census')) {
    const rows = [...scan].filter(([rel]) => rel.endsWith('.spec.ts'))
      .map(([rel, c]) => ({rel, c, w: Object.values(c).reduce((a, n) => a + (n ?? 0), 0)}))
      .sort((a, b) => b.w - a.w);
    console.log('file'.padEnd(56) + SCAN_KEYS.map((k) => k.slice(0, 9).padStart(10)).join(''));
    for (const r of rows.slice(0, Number(process.argv[process.argv.indexOf('--census') + 1]) || 40)) {
      console.log(r.rel.padEnd(55) + SCAN_KEYS.map((k) => String(r.c[k] ?? '·').padStart(10)).join(''));
    }
    const specTotals: ScanCounts = {};
    const specFiles: ScanCounts = {};
    for (const r of rows) {
      for (const k of SCAN_KEYS) {
        specTotals[k] = (specTotals[k] ?? 0) + (r.c[k] ?? 0);
        specFiles[k] = (specFiles[k] ?? 0) + ((r.c[k] ?? 0) > 0 ? 1 : 0);
      }
    }
    console.log(`\nspecs: ${rows.length} — sites ${JSON.stringify(specTotals)}\n          files ${JSON.stringify(specFiles)}`);
  } else {
    const doc = {
      '//': 'Frozen per-file counts of e2e flake classes (FLAKE ZERO — tests/console/e2eFlakeScan.ts). Counts may only ' +
        'FALL; the target in every *.spec.ts is ZERO. Regenerate with: npm run e2e:baseline',
      ...base,
    };
    if (process.argv.includes('--write')) {
      fs.writeFileSync(BASELINE_FILE, JSON.stringify(doc, null, 2) + '\n');
      console.log(`wrote ${path.relative(process.cwd(), BASELINE_FILE)} — totals: ${JSON.stringify(base.totals)}`);
    } else {
      console.log(`(dry run) totals: ${JSON.stringify(base.totals)}`);
    }
  }
}
