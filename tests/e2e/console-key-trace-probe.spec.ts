/*
 * WHERE A PRESS'S TIME GOES — a MEASUREMENT probe, not a regression gate (FREEZE ZERO · R16 —
 * docs/claude/console/freeze-zero/PLAN.md §4 · 8). Env-gated (`KEY_TRACE=1`), skipped in every ordinary run.
 *
 * The monkey's baseline recorded long frames of 0.6 – 0.9 s in which «a press waited»: 34 of 40 were the key
 * bridge's own listeners (`[long-frame] … 788 event-listener «DOMWindow.onkeyup» … forced layout 662`). The line
 * names the listener — never WHO inside it forced the layout. This probe does: it walks a table by the monkey's own
 * recorded presses under a real Chromium trace and, for every key event, sums the FORCED layouts (a `Layout` /
 * `UpdateLayoutTree` that carries the JS stack which asked for it) by the frames that forced them, mapped back to
 * the sources.
 *
 * Run (the laptop; a snapshot's build):
 *   KEY_TRACE=1 KEY_TRACE_FIXTURE=colony-trade-hub KEY_TRACE_WALK=<path to a monkey-walk.txt> \
 *     TM_E2E_CPU_THROTTLE=4 TM_E2E_LAPTOP_OVERRIDE=1 TM_E2E_ROOT=.e2e-<task> \
 *     npx playwright test tests/e2e/console-key-trace-probe.spec.ts --project=chromium --workers=1 --reporter=list
 * Without KEY_TRACE_WALK the walk is `KEY_TRACE_KEYS` (comma-separated codes) or a default tour of the verbs.
 * The report is printed and written to `screenshots/key-trace/<fixture>.json`.
 */
import {test, expect, Page} from './consoleTest';
import {bootFixtureSeats, cinematicBeat, FixtureName} from './consoleStart';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {originalPositionFor, TraceMap} from '@jridgewell/trace-mapping';

const RUN = process.env.KEY_TRACE === '1';
const FIXTURE = process.env.KEY_TRACE_FIXTURE ?? 'colony-trade-hub';
const LANDING = (process.env.KEY_TRACE_LANDING ?? 'prompt') as 'prompt' | 'board';
const OUT = path.resolve('screenshots', 'key-trace');
const DEFAULT_KEYS = ['ArrowDown', 'ArrowDown', 'ArrowRight', 'Enter', 'Escape', 'Period', 'ArrowDown', 'Enter', 'Escape', 'Comma', 'ArrowRight', 'Enter', 'Escape', 'KeyY', 'Escape', 'KeyQ', 'Escape'];

/** The presses of a recorded monkey walk (`<ms>:<code>` — the second line of `monkey-walk.txt`), with their gaps. */
function recordedWalk(file: string): Array<{key: string, gapMs: number}> {
  const line = fs.readFileSync(file, 'utf8').split('\n')[1] ?? '';
  const presses = line.split(' ').map((token) => /^(\d+):([A-Za-z]+)$/.exec(token)).filter((m): m is RegExpExecArray => m !== null && m[2] !== 'RELOAD')
    .map((m) => ({at: Number(m[1]), key: m[2]}));
  return presses.map((press, i) => {
    const next = presses[i + 1];
    // (The clock is `Date.now() % 1e6` — a wrap reads as a negative gap.)
    const gap = next === undefined ? 1200 : next.at - press.at;
    return {key: press.key, gapMs: Math.min(Math.max(gap < 0 ? 400 : gap, 120), 4000)};
  });
}

type TraceEvent = {
  name: string, ph: string, ts: number, dur?: number, pid: number, tid: number,
  args?: {data?: {type?: string, stackTrace?: Array<Frame>}, beginData?: {stackTrace?: Array<Frame>}},
};
type Frame = {functionName?: string, url?: string, lineNumber?: number, columnNumber?: number};

const maps = new Map<string, TraceMap | undefined>();
function mapOf(url: string, root: string): TraceMap | undefined {
  const file = path.basename(new URL(url, 'http://x').pathname);
  if (!maps.has(file)) {
    const candidates = [path.join(root, 'build', `${file}.map`), path.join(root, 'build', 'chunks', `${file}.map`)];
    const found = candidates.find((candidate) => fs.existsSync(candidate));
    maps.set(file, found === undefined ? undefined : new TraceMap(fs.readFileSync(found, 'utf8')));
  }
  return maps.get(file);
}

/** A frame as the sources name it: `consoleFit.ts:212 fitRow` — or as V8 printed it when no map knows it. */
function named(frame: Frame, root: string): string {
  const raw = `${path.basename(frame.url ?? '?')}:${frame.lineNumber ?? 0}:${frame.columnNumber ?? 0} ${frame.functionName ?? ''}`.trim();
  if (frame.url === undefined || frame.lineNumber === undefined || frame.columnNumber === undefined) {
    return raw;
  }
  const map = mapOf(frame.url, root);
  if (map === undefined) {
    return raw;
  }
  // The trace's positions are 1-based lines AND 1-based columns; the mapper takes a 1-based line and a 0-based column.
  const at = originalPositionFor(map, {line: frame.lineNumber, column: Math.max(0, frame.columnNumber - 1)});
  if (at.source === null) {
    return raw;
  }
  const source = at.source.replace(/^webpack:\/\/[^/]*\/\.?\/?/, '').replace(/\?.*$/, '');
  return `${source}:${at.line}${at.name ? ` ${at.name}` : frame.functionName ? ` ${frame.functionName}` : ''}`;
}

type KeyCost = {type: string, key: string, ms: number, forcedMs: number, forced: number, styleMs: number};

function analyse(events: ReadonlyArray<TraceEvent>, keys: ReadonlyArray<{at: number, key: string}>, root: string) {
  const dispatches = events.filter((e) => e.name === 'EventDispatch' && e.ph === 'X' && (e.args?.data?.type === 'keydown' || e.args?.data?.type === 'keyup'));
  const layouts = events.filter((e) => (e.name === 'Layout' || e.name === 'UpdateLayoutTree') && e.ph === 'X' && typeof e.dur === 'number');
  const perKey: Array<KeyCost> = [];
  const bySite = new Map<string, {ms: number, n: number, stack: string}>();
  const byLeaf = new Map<string, {ms: number, n: number}>();
  let keyIndex = 0;
  for (const dispatch of dispatches) {
    const end = dispatch.ts + (dispatch.dur ?? 0);
    const inside = layouts.filter((l) => l.pid === dispatch.pid && l.tid === dispatch.tid && l.ts >= dispatch.ts && l.ts <= end);
    let forcedMs = 0;
    let forced = 0;
    let styleMs = 0;
    for (const layout of inside) {
      const stack = layout.args?.beginData?.stackTrace ?? [];
      const ms = (layout.dur ?? 0) / 1000;
      if (layout.name === 'UpdateLayoutTree') {
        styleMs += ms;
      }
      if (stack.length === 0) {
        continue;
      }
      forcedMs += ms;
      forced++;
      const frames = stack.slice(0, 4).map((frame) => named(frame, root));
      const site = frames.slice(0, 3).join(' ← ');
      const entry = bySite.get(site) ?? {ms: 0, n: 0, stack: frames.join(' ← ')};
      entry.ms += ms;
      entry.n++;
      bySite.set(site, entry);
      const leaf = byLeaf.get(frames[0]) ?? {ms: 0, n: 0};
      leaf.ms += ms;
      leaf.n++;
      byLeaf.set(frames[0], leaf);
    }
    const type = dispatch.args?.data?.type ?? '?';
    if (type === 'keydown' && keyIndex < keys.length) {
      keyIndex++;
    }
    perKey.push({type, key: keys[Math.max(0, keyIndex - 1)]?.key ?? '?', ms: (dispatch.dur ?? 0) / 1000, forcedMs, forced, styleMs});
  }
  const top = <T extends {ms: number}>(map: Map<string, T>, n: number) => [...map.entries()].sort((a, b) => b[1].ms - a[1].ms).slice(0, n);
  return {perKey, sites: top(bySite, 25), leaves: top(byLeaf, 25)};
}

test.describe('where a press\'s time goes — the key trace probe', () => {
  test.skip(!RUN, 'opt-in: KEY_TRACE=1 (a measurement, never a gate)');

  test(`key trace · ${FIXTURE}`, async ({page, request}) => {
    test.setTimeout(15 * 60_000);
    // (The monkey's own boot: the project's default viewport, no profile flag — the frames it recorded were made there.)
    await bootFixtureSeats(page, request, FIXTURE as FixtureName, {landing: LANDING, query: process.env.KEY_TRACE_QUERY});
    const walk = process.env.KEY_TRACE_WALK !== undefined ? recordedWalk(process.env.KEY_TRACE_WALK) :
      (process.env.KEY_TRACE_KEYS?.split(',') ?? DEFAULT_KEYS).map((key) => ({key, gapMs: 900}));
    expect(walk.length, 'the walk has presses').toBeGreaterThan(0);

    const browser = page.context().browser();
    if (browser === null) {
      throw new Error('no browser behind the page');
    }
    await browser.startTracing(page as Page, {categories: [
      'devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.stack', 'v8.execute',
    ]});
    const pressed: Array<{at: number, key: string}> = [];
    for (const step of walk) {
      pressed.push({at: Date.now(), key: step.key});
      await page.keyboard.press(step.key);
      await cinematicBeat(page, step.gapMs, 'the recorded rhythm of the walk — the probe measures the presses as the monkey made them');
    }
    const buffer = await browser.stopTracing();
    const trace = JSON.parse(buffer.toString('utf8')) as {traceEvents?: Array<TraceEvent>} | Array<TraceEvent>;
    const events = Array.isArray(trace) ? trace : trace.traceEvents ?? [];
    const report = analyse(events, pressed, path.resolve(process.env.TM_E2E_ROOT ?? '.'));

    const slow = [...report.perKey].sort((a, b) => b.ms - a.ms).slice(0, 15);
    const lines = [
      `key trace · ${FIXTURE} · ${walk.length} presses · cpu ×${process.env.TM_E2E_CPU_THROTTLE ?? 1}`,
      `key events: ${report.perKey.length} · total ${report.perKey.reduce((sum, k) => sum + k.ms, 0).toFixed(0)} ms · forced layout ${report.perKey.reduce((sum, k) => sum + k.forcedMs, 0).toFixed(0)} ms`,
      '── the slowest key events ──',
      ...slow.map((k) => `  ${k.ms.toFixed(0).padStart(5)} ms  ${k.type.padEnd(7)} ${k.key.padEnd(11)} forced ${k.forcedMs.toFixed(0)} ms in ${k.forced}`),
      '── who forced the layout (leaf frame) ──',
      ...report.leaves.map(([site, v]) => `  ${v.ms.toFixed(0).padStart(5)} ms ×${String(v.n).padEnd(4)} ${site}`),
      '── …and from where (three frames) ──',
      ...report.sites.map(([, v]) => `  ${v.ms.toFixed(0).padStart(5)} ms ×${String(v.n).padEnd(4)} ${v.stack}`),
    ];
    console.log(lines.join('\n'));
    fs.mkdirSync(OUT, {recursive: true});
    fs.writeFileSync(path.join(OUT, `${FIXTURE}.json`), JSON.stringify({fixture: FIXTURE, walk, ...report}, null, 1));
    fs.writeFileSync(path.join(OUT, `${FIXTURE}.txt`), `${lines.join('\n')}\n`);
  });
});
