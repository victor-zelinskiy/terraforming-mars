/*
 * THE RENDERER'S OWN ACCOUNT of a window of the probe's clock (`TM_E2E_TRACE=1`):
 * a CDP trace of the page (style recalc `UpdateLayoutTree`, `Layout`, `PrePaint`,
 * `Paint`, `Layerize`, `FunctionCall`, …) summed by name inside each named window,
 * plus the longest single events with their own arguments (element counts, dirty
 * objects). A CPU profile shows a frozen window as `(program)` — not JavaScript
 * at all — and a longtask observer says only WHEN the thread was gone; this says
 * WHAT it did. Windows are given on the PROBE's clock (`performance.now() −
 * probeT0`), and the trace is aligned to it by a user-timing mark laid at the
 * trace's start (`blink.user_timing` puts the mark into the trace with the
 * trace's own `ts`).
 */
import type {Page} from '@playwright/test';

type TraceEvent = {name: string, ph: string, ts: number, dur?: number, args?: Record<string, unknown>, pid?: number, tid?: number, cat?: string};

export type TraceWindow = {from: number, to: number, label: string};
export type TraceStop = (windows: ReadonlyArray<TraceWindow>, probeT0: number, log: (tag: string, value: unknown) => void) => Promise<void>;

const MARK = 'tm-trace-start';
const WRAPPERS = new Set(['RunTask', 'ThreadControllerImpl::RunTask', 'MessageLoop::RunTask', 'ThreadPool_RunTask', 'TaskQueueManager::ProcessTaskFromWorkQueue']);

/** Start tracing; the returned stop sums each window and logs it. No-op without `TM_E2E_TRACE=1`. */
export async function startTrace(page: Page): Promise<TraceStop> {
  if (process.env.TM_E2E_TRACE !== '1') {
    return async () => {};
  }
  const cdp = await page.context().newCDPSession(page);
  const events: Array<TraceEvent> = [];
  cdp.on('Tracing.dataCollected', (payload) => {
    events.push(...((payload as unknown as {value: Array<TraceEvent>}).value));
  });
  await cdp.send('Tracing.start', {
    categories: 'devtools.timeline,disabled-by-default-devtools.timeline,blink.user_timing,disabled-by-default-devtools.timeline.frame,blink,cc',
    transferMode: 'ReportEvents',
  });
  const startedAt = await page.evaluate((mark) => {
    performance.mark(mark);
    return performance.now();
  }, MARK);
  return async (windows, probeT0, log) => {
    const complete = new Promise<void>((resolve) => cdp.once('Tracing.tracingComplete', () => resolve()));
    await cdp.send('Tracing.end');
    await complete;
    const mark = events.find((e) => e.name === MARK);
    if (mark === undefined) {
      log('trace', {error: 'no start mark in the trace', events: events.length, names: [...new Set(events.map((e) => e.name))].slice(0, 40)});
      return;
    }
    // The renderer's MAIN thread — the thread the mark was laid on.
    const main = events.filter((e) => e.pid === mark.pid && e.tid === mark.tid);
    const t = (e: TraceEvent) => startedAt - probeT0 + (e.ts - mark.ts) / 1000;
    for (const {from, to, label} of windows) {
      const inWindow = main.filter((e) => e.ph === 'X' && e.dur !== undefined && t(e) >= from - 50 && t(e) <= to + 50);
      const byName = new Map<string, {ms: number, n: number}>();
      for (const e of inWindow) {
        const slot = byName.get(e.name) ?? {ms: 0, n: 0};
        slot.ms += (e.dur ?? 0) / 1000;
        slot.n++;
        byName.set(e.name, slot);
      }
      const names = [...byName].sort((a, b) => b[1].ms - a[1].ms).slice(0, 28).map(([k, v]) => `${v.ms.toFixed(1)}ms ×${v.n} ${k}`);
      const longest = inWindow
        .filter((e) => !WRAPPERS.has(e.name))
        .sort((a, b) => (b.dur ?? 0) - (a.dur ?? 0)).slice(0, 18)
        .map((e) => `${((e.dur ?? 0) / 1000).toFixed(1)}ms @${Math.round(t(e))} ${e.name} ${JSON.stringify(e.args ?? {}).slice(0, 300)}`);
      const tasks = inWindow.filter((e) => WRAPPERS.has(e.name) && (e.dur ?? 0) >= 50_000).map((e) => `${Math.round(t(e))}:${Math.round((e.dur ?? 0) / 1000)}ms`);
      log(`${label} trace window ${Math.round(from)}..${Math.round(to)}ms`, {
        events: inWindow.length, mainThreadEvents: main.length, allEvents: events.length,
        longTasks: tasks, byName: names, longest,
      });
    }
  };
}
