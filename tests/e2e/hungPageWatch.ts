/**
 * A HUNG PAGE NAMES ITS STACK (CI 2026-11-09, `console-parliament-climate` :292 — a 300 s test timeout spent inside ONE
 * `page.evaluate` that never returned: the page's main thread did not answer at all, and the report said nothing but
 * «Target page, context or browser has been closed»). A frozen main thread is the one stall the product's own nets
 * (the liveness arbiter, the wait graph, the beat-stall guard) can never report — they run ON that thread. So the
 * harness asks from OUTSIDE: every few seconds it pings each page of the test's context; a page that has not answered
 * for `HUNG_AFTER_MS` is PAUSED over CDP (`Debugger.pause` interrupts whatever JS is running) and its call stack is read,
 * mapped through the build's source maps, printed at once and filed as a `hung-page` annotation — then resumed.
 * Diagnostic only: it never fails a test on its own (the test's own timeout does), it only makes the red name its cause.
 */
import * as fs from 'fs';
import * as path from 'path';
import type {BrowserContext, CDPSession, Page, TestInfo} from '@playwright/test';
import {SourceMapConsumer} from 'source-map';

const PING_EVERY_MS = 3000;
const HUNG_AFTER_MS = 10_000;

type Frame = {functionName: string, url: string, lineNumber: number, columnNumber: number};

const consumers = new Map<string, SourceMapConsumer | null>();

function consumerFor(root: string, url: string): SourceMapConsumer | null {
  const file = url.split('?')[0].split('/').pop() ?? '';
  if (!/\.js$/.test(file)) {
    return null;
  }
  const key = `${root}|${file}`;
  if (!consumers.has(key)) {
    const mapPath = path.join(root, 'build', `${file}.map`);
    let consumer: SourceMapConsumer | null = null;
    try {
      // source-map 0.6 builds its consumer synchronously
      consumer = new SourceMapConsumer(JSON.parse(fs.readFileSync(mapPath, 'utf8'))) as SourceMapConsumer;
    } catch {
      consumer = null;
    }
    consumers.set(key, consumer);
  }
  return consumers.get(key) ?? null;
}

function describeFrame(root: string, frame: Frame): string {
  const consumer = consumerFor(root, frame.url);
  if (consumer !== null) {
    const at = consumer.originalPositionFor({line: frame.lineNumber + 1, column: frame.columnNumber});
    if (at.source !== null) {
      const source = at.source.replace(/^webpack:\/\/[^/]*\//, '');
      return `${at.name ?? frame.functionName ?? '?'} (${source}:${at.line}:${at.column})`;
    }
  }
  return `${frame.functionName || '(anonymous)'} (${frame.url === '' ? '<evaluated>' : frame.url.split('/').pop()}:${frame.lineNumber + 1}:${frame.columnNumber})`;
}

/**
 * ONE debugger session per page, ENABLED BEFORE any hang. ⚠ `Debugger.enable` is handled on the page's main thread —
 * sent to a page already spinning it waits for the spin to end, and the pause that follows lands on the NEXT script (the
 * watch's own ping): the first cut filed «(anonymous) <evaluated>:1:0» for a 16 s loop. With the domain enabled up front,
 * `Debugger.pause` interrupts the running JS where it stands. Any pause the watch did not ask for (a stray `debugger;`)
 * is resumed at once — the watch never stops a page it is not diagnosing.
 */
type PageDebugger = {pause: () => Promise<string>, close: () => Promise<void>};

async function attachDebugger(context: BrowserContext, page: Page, root: string): Promise<PageDebugger | undefined> {
  let session: CDPSession;
  try {
    session = await context.newCDPSession(page);
    await session.send('Debugger.enable');
  } catch {
    return undefined; // the page closed before its session opened
  }
  let want: ((frames: Array<Frame>) => void) | undefined;
  session.on('Debugger.paused', (event) => {
    const frames = event.callFrames.map((f) => ({functionName: f.functionName, url: f.url, lineNumber: f.location.lineNumber, columnNumber: f.location.columnNumber ?? 0}));
    const taker = want;
    want = undefined;
    void session.send('Debugger.resume').catch(() => undefined);
    taker?.(frames);
  });
  return {
    pause: async () => {
      try {
        const paused = new Promise<Array<Frame>>((resolve) => {
          want = resolve;
        });
        await session.send('Debugger.pause');
        const frames = await Promise.race([paused, new Promise<null>((r) => setTimeout(() => r(null), 5000))]);
        if (frames === null) {
          want = undefined;
          return '(the pause never landed — the thread is not running JS: layout / raster / a native wait)';
        }
        return frames.slice(0, 40).map((f) => `    at ${describeFrame(root, f)}`).join('\n');
      } catch (e) {
        return `(could not pause: ${String(e).slice(0, 200)})`;
      }
    },
    close: async () => {
      await session.detach().catch(() => undefined);
    },
  };
}

/** Arm the watch on every page of the context; returns the stop function (call it in the fixture's teardown). */
export function armHungPageWatch(context: BrowserContext, testInfo: TestInfo, root: string): () => void {
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const debuggers: Array<Promise<PageDebugger | undefined>> = [];
  let stopped = false;
  const watch = (page: Page) => {
    const dbg = attachDebugger(context, page, root);
    debuggers.push(dbg);
    let lastAnswer = Date.now();
    let nextReportMs = HUNG_AFTER_MS;
    let inFlight = false;
    const answered = () => {
      lastAnswer = Date.now();
      nextReportMs = HUNG_AFTER_MS;
    };
    const tick = () => {
      if (stopped || page.isClosed()) {
        return;
      }
      if (!inFlight) {
        inFlight = true;
        // a rejection (a navigation destroyed the context) is an answer too — the thread was free to give it
        page.evaluate(() => 1).then(answered, answered).finally(() => {
          inFlight = false;
        });
      }
      const silentMs = Date.now() - lastAnswer;
      if (silentMs >= nextReportMs) {
        // once at the threshold, then once a minute while it stays silent — a stack that MOVES is a loop, one that
        // stands is a wait inside one task
        nextReportMs = silentMs + 60_000;
        void dbg.then((d) => d?.pause() ?? '(no debugger session)').then((stack) => {
          const line = `[hung-page] the main thread has not answered for ${Math.round(silentMs / 1000)} s — its stack:\n${stack}`;
          console.log(line);
          testInfo.annotations.push({type: 'hung-page', description: line.slice(0, 4000)});
        });
      }
      schedule();
    };
    const schedule = () => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        tick();
      }, PING_EVERY_MS);
      timers.add(timer);
    };
    schedule();
  };
  context.pages().forEach(watch);
  context.on('page', watch);
  return () => {
    stopped = true;
    timers.forEach((t) => clearTimeout(t));
    timers.clear();
    debuggers.forEach((d) => void d.then((x) => x?.close()));
  };
}
