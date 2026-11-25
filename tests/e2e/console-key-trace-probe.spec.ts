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
 * Deeper, each asked for by name (they are heavy, and they inflate every time they report):
 *   KEY_TRACE_INVALIDATION=1 — WHY a style pass was owed: the nodes marked for a recalc by reason, and the class /
 *     attribute change that scheduled it, with the application frame that made it;
 *   KEY_TRACE_SELECTORS=1    — WHAT the style passes matched: Chromium's selector stats (time · tried → matched).
 * What one style pass costs as a whole is the sibling probe's: `console-style-cost-probe.spec.ts`.
 *
 * THE BOOT (`KEY_TRACE_BOOT=1` — the autopilot's zero bar, 2026-11-25: a `[long-frame]` of 0.5 – 0.8 s at the page's
 * start in one game of six, «resolve-promise import.then @ main.js», forced layout 180 – 420 ms): the table is booted,
 * the trace starts, the page RELOADS and the shell mounts under it. Every long task of the boot is opened: the forced
 * layouts in it by the application frames that asked, and the CPU profile's samples inside it — self time by function
 * and inclusive time by application frame, mapped back to the sources.
 * A walk is NOT a deterministic run (the game goes where the presses take it) — compare shapes, never milliseconds.
 * The report is printed and written to `screenshots/key-trace/<fixture>.json`.
 */
import {test, expect, Page} from './consoleTest';
import {bootFixtureSeats, cinematicBeat, FixtureName, reloadConsole} from './consoleStart';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {originalPositionFor, TraceMap} from '@jridgewell/trace-mapping';

/** A knob by its name — or under `TM_E2E_` (the box's wrapper carries only those to the run). */
const knob = (name: string): string | undefined => process.env[name] ?? process.env[`TM_E2E_${name}`];
const RUN = knob('KEY_TRACE') === '1';
const FIXTURE = knob('KEY_TRACE_FIXTURE') ?? 'colony-trade-hub';
const LANDING = (knob('KEY_TRACE_LANDING') ?? 'prompt') as 'prompt' | 'board';
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
  args?: {
    data?: {
      type?: string, stackTrace?: Array<Frame>,
      // (invalidation tracking)
      nodeName?: string, reason?: string, extraData?: string, changedClass?: string, changedAttribute?: string, changedId?: string,
      changedPseudo?: string, invalidationSet?: string, selectorPart?: string,
    },
    beginData?: {stackTrace?: Array<Frame>, dirtyObjects?: number, totalObjects?: number, partialLayout?: boolean},
    elementCount?: number,
    // (selector stats — `disabled-by-default-blink.debug`)
    selector_stats?: {selector_timings?: Array<{selector?: string, 'elapsed (us)'?: number, match_attempts?: number, match_count?: number, fast_reject_count?: number}>},
  },
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
  const source = at.source.replace(/^webpack:\/\/[^/]*\/\.?\/?/, '').replace(/^(\.\.\/)+/, '').replace(/\?.*$/, '');
  return `${source}:${at.line}${at.name ? ` ${at.name}` : frame.functionName ? ` ${frame.functionName}` : ''}`;
}

type KeyCost = {type: string, key: string, ms: number, forcedMs: number, forced: number, styleMs: number, sites: Array<{site: string, ms: number, n: number}>};

function analyse(events: ReadonlyArray<TraceEvent>, keys: ReadonlyArray<{at: number, key: string}>, root: string) {
  const dispatches = events.filter((e) => e.name === 'EventDispatch' && e.ph === 'X' && (e.args?.data?.type === 'keydown' || e.args?.data?.type === 'keyup'));
  const layouts = events.filter((e) => (e.name === 'Layout' || e.name === 'UpdateLayoutTree') && e.ph === 'X' && typeof e.dur === 'number');
  const perKey: Array<KeyCost> = [];
  const bySite = new Map<string, {ms: number, n: number, stack: string}>();
  const byLeaf = new Map<string, {ms: number, n: number}>();
  const byAsker = new Map<string, {ms: number, n: number}>();
  /** HOW MUCH each forced pass touched: the elements a style pass recomputed, the boxes a layout pass laid out of all. */
  const scope = new Map<string, {style: number, styleN: number, dirty: number, total: number, layoutN: number}>();
  let keyIndex = 0;
  for (const dispatch of dispatches) {
    const end = dispatch.ts + (dispatch.dur ?? 0);
    const inside = layouts.filter((l) => l.pid === dispatch.pid && l.tid === dispatch.tid && l.ts >= dispatch.ts && l.ts <= end);
    let forcedMs = 0;
    let forced = 0;
    let styleMs = 0;
    const own = new Map<string, {ms: number, n: number}>();
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
      const all = stack.map((frame) => named(frame, root));
      const frames = all.slice(0, 4);
      // WHO OF OURS asked: a library frame (GSAP reading a computed style, Vue's transition measuring) is named with
      // the nearest two frames of the application under it.
      const ours = all.filter((frame) => frame.startsWith('src/')).slice(0, 2);
      const asked = all[0].startsWith('src/') ? frames.slice(0, 2).join(' ← ') : `${all[0]} ← … ← ${ours.join(' ← ') || '(no app frame in the stack)'}`;
      const site = frames.slice(0, 3).join(' ← ');
      const entry = bySite.get(site) ?? {ms: 0, n: 0, stack: frames.join(' ← ')};
      entry.ms += ms;
      entry.n++;
      bySite.set(site, entry);
      const leaf = byLeaf.get(frames[0]) ?? {ms: 0, n: 0};
      leaf.ms += ms;
      leaf.n++;
      byLeaf.set(frames[0], leaf);
      const mine = own.get(asked) ?? {ms: 0, n: 0};
      mine.ms += ms;
      mine.n++;
      own.set(asked, mine);
      const total = byAsker.get(asked) ?? {ms: 0, n: 0};
      total.ms += ms;
      total.n++;
      byAsker.set(asked, total);
      const touched = scope.get(asked) ?? {style: 0, styleN: 0, dirty: 0, total: 0, layoutN: 0};
      if (layout.name === 'UpdateLayoutTree') {
        touched.style += layout.args?.elementCount ?? 0;
        touched.styleN++;
      } else {
        touched.dirty += layout.args?.beginData?.dirtyObjects ?? 0;
        touched.total += layout.args?.beginData?.totalObjects ?? 0;
        touched.layoutN++;
      }
      scope.set(asked, touched);
    }
    const type = dispatch.args?.data?.type ?? '?';
    if (type === 'keydown' && keyIndex < keys.length) {
      keyIndex++;
    }
    perKey.push({
      type, key: keys[Math.max(0, keyIndex - 1)]?.key ?? '?', ms: (dispatch.dur ?? 0) / 1000, forcedMs, forced, styleMs,
      sites: [...own.entries()].sort((x, y) => y[1].ms - x[1].ms).slice(0, 8).map(([site, v]) => ({site, ...v})),
    });
  }
  // WHY a style pass was owed (the trace's invalidation tracking, inside the key events only): the node marked for
  // a recalc and the reason; and the change (a class, an attribute, a pseudo) that scheduled an invalidation.
  const windows = dispatches.map((d) => ({pid: d.pid, tid: d.tid, from: d.ts, to: d.ts + (d.dur ?? 0)}));
  const inKey = (e: TraceEvent) => windows.some((w) => w.pid === e.pid && w.tid === e.tid && e.ts >= w.from && e.ts <= w.to);
  const nodeOf = (name: string | undefined) => (name ?? '?').replace(/\s+/g, ' ').split(' ').slice(0, 2).join(' ').slice(0, 70);
  const why = new Map<string, number>();
  const scheduled = new Map<string, number>();
  for (const e of events) {
    const d = e.args?.data;
    if (d === undefined || !inKey(e)) {
      continue;
    }
    if (e.name === 'StyleRecalcInvalidationTracking') {
      const key = `${d.reason ?? '?'}${d.extraData ? ` (${d.extraData})` : ''} · ${nodeOf(d.nodeName)}`;
      why.set(key, (why.get(key) ?? 0) + 1);
    } else if (e.name === 'ScheduleStyleInvalidationTracking') {
      const change = d.changedClass !== undefined ? `class .${d.changedClass}` : d.changedAttribute !== undefined ? `attr [${d.changedAttribute}]` :
        d.changedId !== undefined ? `id #${d.changedId}` : d.changedPseudo !== undefined ? `pseudo ${d.changedPseudo}` : 'other';
      const ours = (d.stackTrace ?? []).map((frame) => named(frame, root)).find((frame) => frame.startsWith('src/')) ?? '';
      const key = `${change} on ${nodeOf(d.nodeName)}${ours === '' ? '' : ` ← ${ours}`}`;
      scheduled.set(key, (scheduled.get(key) ?? 0) + 1);
    }
  }
  // WHAT THE STYLE PASSES SPENT THEIR TIME ON (Chromium's selector stats, inside the key events only): the selectors
  // by the time their matching took — and how often they were tried for how few matches (a selector tried on every
  // element and matched by none is the cost of a universal rightmost compound).
  const selectors = new Map<string, {ms: number, tried: number, matched: number}>();
  for (const e of events) {
    const timings = e.args?.selector_stats?.selector_timings;
    if (e.name !== 'SelectorStats' || timings === undefined || !inKey(e)) {
      continue;
    }
    for (const timing of timings) {
      const key = (timing.selector ?? '?').slice(0, 150);
      const entry = selectors.get(key) ?? {ms: 0, tried: 0, matched: 0};
      entry.ms += (timing['elapsed (us)'] ?? 0) / 1000;
      entry.tried += timing.match_attempts ?? 0;
      entry.matched += timing.match_count ?? 0;
      selectors.set(key, entry);
    }
  }
  const selectorMs = [...selectors.values()].reduce((sum, v) => sum + v.ms, 0);
  const counted = (map: Map<string, number>, n: number) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
  const top = <T extends {ms: number}>(map: Map<string, T>, n: number) => [...map.entries()].sort((a, b) => b[1].ms - a[1].ms).slice(0, n);
  const askers = top(byAsker, 40).map(([site, v]) => {
    const t = scope.get(site) ?? {style: 0, styleN: 0, dirty: 0, total: 0, layoutN: 0};
    return [site, {
      ...v,
      styled: t.styleN === 0 ? 0 : Math.round(t.style / t.styleN),
      dirty: t.layoutN === 0 ? 0 : Math.round(t.dirty / t.layoutN),
      boxes: t.layoutN === 0 ? 0 : Math.round(t.total / t.layoutN),
    }] as const;
  });
  return {
    perKey, sites: top(bySite, 25), leaves: top(byLeaf, 25), askers, why: counted(why, 30), scheduled: counted(scheduled, 30),
    selectors: top(selectors, 40), selectorMs, selectorCount: selectors.size,
  };
}

type ProfileNode = {id: number, parent?: number, callFrame: Frame};
type ProfileChunk = {nodes?: Array<ProfileNode>, samples?: Array<number>, timeDeltas?: Array<number>};

/**
 * THE BOOT's long tasks, opened: per task over `minMs`, the forced layouts by asker and the CPU samples inside it.
 * The profile's samples are placed on the trace's clock (a `Profile`'s start + the cumulative deltas of its chunks).
 */
function analyseBoot(events: ReadonlyArray<TraceEvent>, root: string, minMs: number) {
  type Raw = TraceEvent & {id?: string, args?: TraceEvent['args'] & {name?: string, data?: {startTime?: number, cpuProfile?: ProfileChunk, timeDeltas?: Array<number>}}};
  const all = events as ReadonlyArray<Raw>;
  const mains = new Set(all.filter((e) => e.ph === 'M' && e.name === 'thread_name' && e.args?.name === 'CrRendererMain').map((e) => `${e.pid}:${e.tid}`));
  const tasks = all.filter((e) => e.name === 'RunTask' && e.ph === 'X' && (e.dur ?? 0) / 1000 >= minMs && mains.has(`${e.pid}:${e.tid}`));
  const layouts = all.filter((e) => (e.name === 'Layout' || e.name === 'UpdateLayoutTree') && e.ph === 'X' && typeof e.dur === 'number');
  // The CPU profile: nodes by id (per profile), samples on the trace clock.
  const nodes = new Map<string, ProfileNode>();
  const samples: Array<{ts: number, node: string, dt: number}> = [];
  const clock = new Map<string, number>();
  for (const e of all) {
    const key = `${e.pid}:${e.id ?? ''}`;
    if (e.name === 'Profile' && e.args?.data?.startTime !== undefined) {
      clock.set(key, e.args.data.startTime);
    } else if (e.name === 'ProfileChunk') {
      const chunk = e.args?.data?.cpuProfile;
      for (const node of chunk?.nodes ?? []) {
        nodes.set(`${key}#${node.id}`, node);
      }
      const deltas = e.args?.data?.timeDeltas ?? [];
      let ts = clock.get(key) ?? 0;
      (chunk?.samples ?? []).forEach((id, i) => {
        ts += deltas[i] ?? 0;
        samples.push({ts, node: `${key}#${id}`, dt: deltas[i + 1] ?? 0});
      });
      clock.set(key, ts);
    }
  }
  const nameOf = (id: string): string => {
    const node = nodes.get(id);
    if (node === undefined) {
      return '?';
    }
    const frame = node.callFrame;
    if ((frame.url ?? '') === '') {
      return `(${frame.functionName || 'native'})`;
    }
    return named({...frame, lineNumber: (frame.lineNumber ?? 0) + 1, columnNumber: (frame.columnNumber ?? 0) + 1}, root);
  };
  const parentOf = (id: string): string | undefined => {
    const node = nodes.get(id);
    if (node?.parent === undefined) {
      return undefined;
    }
    return `${id.slice(0, id.lastIndexOf('#'))}#${node.parent}`;
  };
  // (A node's parent is not always given — the profiler gives `children`; rebuild the parent links once.)
  for (const [id, node] of nodes) {
    for (const child of (node as unknown as {children?: Array<number>}).children ?? []) {
      const childId = `${id.slice(0, id.lastIndexOf('#'))}#${child}`;
      const c = nodes.get(childId);
      if (c !== undefined && c.parent === undefined) {
        c.parent = node.id;
      }
    }
  }
  return tasks.map((task) => {
    const from = task.ts;
    const to = task.ts + (task.dur ?? 0);
    const inside = layouts.filter((l) => l.pid === task.pid && l.tid === task.tid && l.ts >= from && l.ts <= to);
    const askers = new Map<string, {ms: number, n: number, dirty: number, boxes: number, styled: number}>();
    /** Every forced pass IN ORDER, its whole stack (the first reader pays for the document; the next ones for what changed since). */
    const passes: Array<string> = [];
    let forcedMs = 0;
    let styleMs = 0;
    let layoutMs = 0;
    for (const layout of inside) {
      const ms = (layout.dur ?? 0) / 1000;
      if (layout.name === 'UpdateLayoutTree') {
        styleMs += ms;
      } else {
        layoutMs += ms;
      }
      const stack = layout.args?.beginData?.stackTrace ?? [];
      if (stack.length === 0) {
        continue;
      }
      forcedMs += ms;
      const frames = stack.map((frame) => named(frame, root));
      passes.push(`${ms.toFixed(1).padStart(6)} ms ${layout.name === 'Layout' ? 'L' : 'S'} [${layout.args?.beginData?.dirtyObjects ?? 0}/${layout.args?.beginData?.totalObjects ?? 0} · ${layout.args?.elementCount ?? 0}] ${frames.slice(0, 8).join(' ← ')}`);
      const ours = frames.filter((frame) => frame.startsWith('src/')).slice(0, 3);
      const asked = `${layout.name === 'Layout' ? 'L' : 'S'} ${frames[0].startsWith('src/') ? ours.join(' ← ') : `${frames[0]} ← … ← ${ours.join(' ← ') || '(no app frame)'}`}`;
      const entry = askers.get(asked) ?? {ms: 0, n: 0, dirty: 0, boxes: 0, styled: 0};
      entry.ms += ms;
      entry.n++;
      entry.dirty += layout.args?.beginData?.dirtyObjects ?? 0;
      entry.boxes = Math.max(entry.boxes, layout.args?.beginData?.totalObjects ?? 0);
      entry.styled += layout.args?.elementCount ?? 0;
      askers.set(asked, entry);
    }
    const self = new Map<string, number>();
    const inclusive = new Map<string, number>();
    let sampledMs = 0;
    for (const sample of samples) {
      if (sample.ts < from || sample.ts > to) {
        continue;
      }
      const ms = sample.dt / 1000;
      sampledMs += ms;
      const leaf = nameOf(sample.node);
      self.set(leaf, (self.get(leaf) ?? 0) + ms);
      const seen = new Set<string>();
      for (let id: string | undefined = sample.node; id !== undefined; id = parentOf(id)) {
        const name = nameOf(id);
        const app = name.startsWith('src/') || /^(main|console-shell|[\w-]+)\.js:/.test(name) && !name.startsWith('vendors.js:');
        if (!app || seen.has(name)) {
          continue;
        }
        seen.add(name);
        inclusive.set(name, (inclusive.get(name) ?? 0) + ms);
      }
    }
    const top = (map: Map<string, number>, n: number) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
    return {
      atMs: Math.round(from / 1000), ms: (task.dur ?? 0) / 1000, forcedMs, styleMs, layoutMs, sampledMs,
      askers: [...askers.entries()].sort((a, b) => b[1].ms - a[1].ms).slice(0, 30), passes,
      self: top(self, 30), inclusive: top(inclusive, 60),
    };
  });
}

test.describe('where the boot\'s time goes — the key trace probe, from the reload', () => {
  test.skip(knob('KEY_TRACE_BOOT') !== '1', 'opt-in: KEY_TRACE_BOOT=1 (a measurement, never a gate)');

  test(`boot trace · ${FIXTURE}`, async ({page, request}) => {
    test.setTimeout(15 * 60_000);
    await bootFixtureSeats(page, request, FIXTURE as FixtureName, {landing: LANDING, query: knob('KEY_TRACE_QUERY')});
    const browser = page.context().browser();
    if (browser === null) {
      throw new Error('no browser behind the page');
    }
    const minMs = Number(knob('KEY_TRACE_BOOT_MIN_MS') ?? 150);
    const rounds = Number(knob('KEY_TRACE_BOOT_ROUNDS') ?? 3);
    const lines: Array<string> = [`boot trace · ${FIXTURE} · ${rounds} reload(s) · tasks over ${minMs} ms · cpu ×${process.env.TM_E2E_CPU_THROTTLE ?? 1}`];
    const reports: Array<unknown> = [];
    for (let round = 0; round < rounds; round++) {
      await browser.startTracing(page as Page, {categories: [
        'devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.stack', 'v8.execute',
        'disabled-by-default-v8.cpu_profiler',
      ]});
      await reloadConsole(page);
      await cinematicBeat(page, 4000, 'the boot\'s own beats after the shell stands — the probe measures the whole start');
      const buffer = await browser.stopTracing();
      const trace = JSON.parse(buffer.toString('utf8')) as {traceEvents?: Array<TraceEvent>} | Array<TraceEvent>;
      const events = Array.isArray(trace) ? trace : trace.traceEvents ?? [];
      const tasks = analyseBoot(events, path.resolve(process.env.TM_E2E_ROOT ?? '.'), minMs);
      reports.push(tasks);
      lines.push(`══ reload ${round + 1}: ${tasks.length} long task(s) — ${tasks.map((task) => `${task.ms.toFixed(0)} ms`).join(' · ')}`);
      for (const task of [...tasks].sort((a, b) => b.ms - a.ms).slice(0, 3)) {
        lines.push(`── a task of ${task.ms.toFixed(0)} ms at ${task.atMs} ms — forced ${task.forcedMs.toFixed(0)} ms · style ${task.styleMs.toFixed(0)} · layout ${task.layoutMs.toFixed(0)} · sampled ${task.sampledMs.toFixed(0)} ms`);
        lines.push('   who forced (S style / L layout · ms ×n [boxes dirty / of all · elements restyled]):');
        lines.push(...task.askers.map(([site, v]) => `     ${v.ms.toFixed(0).padStart(5)} ms ×${String(v.n).padEnd(3)} [${v.dirty}/${v.boxes} · ${v.styled}] ${site}`));
        lines.push('   every forced pass in order (ms · S/L [boxes dirty / of all · elements restyled] · the stack):');
        lines.push(...task.passes.map((pass) => `     ${pass}`));
        lines.push('   self time by function:');
        lines.push(...task.self.map(([site, ms]) => `     ${ms.toFixed(1).padStart(7)} ms  ${site}`));
        lines.push('   inclusive time by application frame:');
        lines.push(...task.inclusive.map(([site, ms]) => `     ${ms.toFixed(1).padStart(7)} ms  ${site}`));
      }
    }
    console.log(lines.join('\n'));
    fs.mkdirSync(OUT, {recursive: true});
    fs.writeFileSync(path.join(OUT, `boot-${FIXTURE}.json`), JSON.stringify({fixture: FIXTURE, reports}, null, 1));
    fs.writeFileSync(path.join(OUT, `boot-${FIXTURE}.txt`), `${lines.join('\n')}\n`);
  });
});

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
      // WHY a style pass was owed — heavy (an event per marked node): asked for by name.
      ...(process.env.KEY_TRACE_INVALIDATION === '1' ? ['disabled-by-default-devtools.timeline.invalidationTracking'] : []),
      // WHAT the style passes matched — heavier still (every selector of every pass): asked for by name.
      ...(process.env.KEY_TRACE_SELECTORS === '1' ? ['disabled-by-default-blink.debug'] : []),
    ]});
    const domOf = () => page.evaluate(() => {
      const all = document.querySelectorAll('*').length;
      const layers = [...document.body.children].map((el) => `${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ')[0] : ''}:${el.querySelectorAll('*').length}`)
        .filter((row) => Number(row.split(':').pop()) > 200);
      return {all, layers};
    });
    const domBefore = await domOf();
    const pressed: Array<{at: number, key: string}> = [];
    for (const step of walk) {
      pressed.push({at: Date.now(), key: step.key});
      await page.keyboard.press(step.key);
      await cinematicBeat(page, step.gapMs, 'the recorded rhythm of the walk — the probe measures the presses as the monkey made them');
    }
    const domAfter = await domOf();
    const buffer = await browser.stopTracing();
    const trace = JSON.parse(buffer.toString('utf8')) as {traceEvents?: Array<TraceEvent>} | Array<TraceEvent>;
    const events = Array.isArray(trace) ? trace : trace.traceEvents ?? [];
    const report = analyse(events, pressed, path.resolve(process.env.TM_E2E_ROOT ?? '.'));

    const slow = [...report.perKey].sort((a, b) => b.ms - a.ms).slice(0, 15);
    const lines = [
      `key trace · ${FIXTURE} · ${walk.length} presses · cpu ×${process.env.TM_E2E_CPU_THROTTLE ?? 1}`,
      `DOM: ${domBefore.all} elements at the first press, ${domAfter.all} at the last · ${domAfter.layers.join(' · ')}`,
      `key events: ${report.perKey.length} · total ${report.perKey.reduce((sum, k) => sum + k.ms, 0).toFixed(0)} ms · forced layout ${report.perKey.reduce((sum, k) => sum + k.forcedMs, 0).toFixed(0)} ms`,
      '── the slowest key events ──',
      ...slow.map((k) => `  ${k.ms.toFixed(0).padStart(5)} ms  ${k.type.padEnd(7)} ${k.key.padEnd(11)} forced ${k.forcedMs.toFixed(0)} ms in ${k.forced}`),
      '── inside the five slowest: who forced, how often (a count above 1 for one site is a read-after-write loop) ──',
      ...slow.slice(0, 5).flatMap((k) => [
        `  ${k.type} ${k.key} · ${k.ms.toFixed(0)} ms`,
        ...k.sites.map((site) => `      ${site.ms.toFixed(0).padStart(5)} ms ×${String(site.n).padEnd(4)} ${site.site}`),
      ]),
      '── who forced the layout (leaf frame) ──',
      ...report.leaves.map(([site, v]) => `  ${v.ms.toFixed(0).padStart(5)} ms ×${String(v.n).padEnd(4)} ${site}`),
      '── …and who of the application asked (per pass: elements restyled · boxes dirty / of all) ──',
      ...report.askers.map(([site, v]) => `  ${v.ms.toFixed(0).padStart(5)} ms ×${String(v.n).padEnd(4)} [${v.styled} el · ${v.dirty}/${v.boxes}] ${site}`),
      ...(report.selectors.length === 0 ? [] : [
        `── WHAT the style passes matched: ${report.selectorCount} selectors, ${report.selectorMs.toFixed(0)} ms of matching (KEY_TRACE_SELECTORS=1) — ms · tried → matched ──`,
        ...report.selectors.map(([selector, v]) => `  ${v.ms.toFixed(1).padStart(7)} ms  ${String(v.tried).padStart(7)} → ${String(v.matched).padEnd(6)} ${selector}`),
      ]),
      ...(report.why.length === 0 ? [] : [
        '── WHY a style pass was owed: nodes marked for a recalc, by reason (KEY_TRACE_INVALIDATION=1) ──',
        ...report.why.map(([reason, n]) => `  ×${String(n).padEnd(5)} ${reason}`),
        '── …and the changes that scheduled an invalidation ──',
        ...report.scheduled.map(([change, n]) => `  ×${String(n).padEnd(5)} ${change}`),
      ]),
    ];
    console.log(lines.join('\n'));
    fs.mkdirSync(OUT, {recursive: true});
    fs.writeFileSync(path.join(OUT, `${FIXTURE}.json`), JSON.stringify({fixture: FIXTURE, walk, ...report}, null, 1));
    fs.writeFileSync(path.join(OUT, `${FIXTURE}.txt`), `${lines.join('\n')}\n`);
  });
});
