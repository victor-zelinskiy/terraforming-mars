/**
 * A HUNG PAGE NAMES ITS STACK (CI 2026-11-09, `console-parliament-climate` :292 — a 300 s test timeout spent inside ONE
 * `page.evaluate` that never returned: the page's main thread did not answer at all, and the report said nothing but
 * «Target page, context or browser has been closed»). A frozen main thread is the one stall the product's own nets
 * (the liveness arbiter, the wait graph, the beat-stall guard) can never report — they run ON that thread. So the
 * harness asks from OUTSIDE: every few seconds it pings each page of the test's context; a page that has not answered
 * for `HUNG_AFTER_MS` is PAUSED over CDP (`Debugger.pause` interrupts whatever JS is running) and its call stack is read,
 * filed at once as a `hung-page` annotation (raw frames), then mapped through the build's source maps and the same
 * annotation rewritten — then resumed. Diagnostic only: it never fails a test on its own.
 *
 * A STALLED WORKER NAMES ITSELF TOO (CI 2026-11-09, run 42591455049 — the same test ran to 300 s again with the bounded
 * settle in place and the watch filing NOTHING, so the page's main thread was answering the whole time): every bound in
 * the driver (the settle's read bound, a press's bound) is a Node timer in THIS process, so the worker's longest
 * event-loop stall is measured (`monitorEventLoopDelay`) and filed as `worker-stall` past `WORKER_STALL_MS`, and the
 * watch's own heavy work — mapping a stack through an 8 MB source map — runs on a worker THREAD, bounded, never on the
 * test's loop. A stall off the main thread (a screenshot waiting on a compositor frame, a key press on its input ack) is
 * not this watch's: those CALLS are bounded (`actionTimeout` in the config, `dispatchKey` in `consoleStart.ts`) and fail
 * by name. (A frame ping was tried and dropped: headless Chromium stops producing frames on a quiet screen, so «no rAF
 * for 10 s» is the normal state of an idle page — see the ratchet's note in `e2eDriverGuard.spec.ts`.)
 */
import * as path from 'path';
import {monitorEventLoopDelay} from 'perf_hooks';
import {Worker} from 'worker_threads';
import type {BrowserContext, CDPSession, Page, TestInfo} from '@playwright/test';

const PING_EVERY_MS = 3000;
const HUNG_AFTER_MS = 10_000;
/** How long the mapping thread may take for one stack before the raw frames stand as the report. */
const MAP_BUDGET_MS = 15_000;
/** A worker event-loop stall at least this long is filed — every driver bound is a timer on that loop. */
const WORKER_STALL_MS = 3_000;

type Frame = {functionName: string, url: string, lineNumber: number, columnNumber: number};

function rawFrame(frame: Frame): string {
  return `${frame.functionName || '(anonymous)'} (${frame.url === '' ? '<evaluated>' : frame.url.split('?')[0].split('/').pop()}:${frame.lineNumber + 1}:${frame.columnNumber})`;
}

/**
 * THE MAPPING THREAD — one per worker process, created on the first hung page. The source-map consumer is synchronous
 * (`source-map` 0.6: an 8 MB `main.js.map` is parsed whole on the first lookup), so it never runs on the loop that keeps
 * the test's own bounds; a thread that does not answer within `MAP_BUDGET_MS` leaves the raw frames standing.
 */
const MAPPER_SOURCE = `
const {parentPort, workerData} = require('worker_threads');
const fs = require('fs');
const path = require('path');
const {SourceMapConsumer} = require(workerData.sourceMap);
const consumers = new Map();
function consumerFor(root, url) {
  const file = url.split('?')[0].split('/').pop() || '';
  if (!/\\.js$/.test(file)) return null;
  const key = root + '|' + file;
  if (!consumers.has(key)) {
    let consumer = null;
    try {
      consumer = new SourceMapConsumer(JSON.parse(fs.readFileSync(path.join(root, 'build', file + '.map'), 'utf8')));
    } catch (e) {
      consumer = null;
    }
    consumers.set(key, consumer);
  }
  return consumers.get(key);
}
parentPort.on('message', ({id, root, frames}) => {
  const lines = frames.map((f) => {
    const consumer = consumerFor(root, f.url);
    if (consumer !== null) {
      const at = consumer.originalPositionFor({line: f.lineNumber + 1, column: f.columnNumber});
      if (at.source !== null) {
        const source = at.source.replace(/^webpack:\\/\\/[^/]*\\//, '');
        return (at.name || f.functionName || '?') + ' (' + source + ':' + at.line + ':' + at.column + ')';
      }
    }
    return null;
  });
  parentPort.postMessage({id, lines});
});
`;

let mapper: Worker | undefined;
let mapperSeq = 0;
const mapperWaiting = new Map<number, (lines: Array<string | null>) => void>();

function mapperThread(): Worker {
  if (mapper === undefined) {
    const sourceMap = require.resolve('source-map');
    mapper = new Worker(MAPPER_SOURCE, {eval: true, workerData: {sourceMap: path.resolve(sourceMap)}});
    mapper.unref(); // never keeps the worker process alive
    mapper.on('message', ({id, lines}: {id: number, lines: Array<string | null>}) => {
      mapperWaiting.get(id)?.(lines);
      mapperWaiting.delete(id);
    });
    mapper.on('error', () => {
      mapperWaiting.forEach((done) => done([]));
      mapperWaiting.clear();
      mapper = undefined;
    });
  }
  return mapper;
}

/** The frames mapped through the build's source maps, bounded — a frame the thread could not map stays raw. */
export async function mapFrames(root: string, frames: Array<Frame>): Promise<Array<string>> {
  const id = ++mapperSeq;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const mapped = await Promise.race([
    new Promise<Array<string | null>>((resolve) => {
      mapperWaiting.set(id, resolve);
      try {
        mapperThread().postMessage({id, root, frames});
      } catch {
        mapperWaiting.delete(id);
        resolve([]);
      }
    }),
    new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), MAP_BUDGET_MS);
    }),
  ]);
  clearTimeout(timer);
  mapperWaiting.delete(id);
  return frames.map((f, i) => mapped?.[i] ?? rawFrame(f));
}

/**
 * ONE debugger session per page, ENABLED BEFORE any hang. ⚠ `Debugger.enable` is handled on the page's main thread —
 * sent to a page already spinning it waits for the spin to end, and the pause that follows lands on the NEXT script (the
 * watch's own ping): the first cut filed «(anonymous) <evaluated>:1:0» for a 16 s loop. With the domain enabled up front,
 * `Debugger.pause` interrupts the running JS where it stands. Any pause the watch did not ask for (a stray `debugger;`)
 * is resumed at once — the watch never stops a page it is not diagnosing — and the resume is SENT before anything else
 * runs, so the page never waits on the report.
 */
type PauseResult = {frames: Array<Frame>} | {reason: string};
type PageDebugger = {pause: () => Promise<PauseResult>, close: () => Promise<void>};

async function attachDebugger(context: BrowserContext, page: Page): Promise<PageDebugger | undefined> {
  let session: CDPSession;
  try {
    session = await context.newCDPSession(page);
  } catch {
    return undefined; // the page closed before its session opened
  }
  let want: ((frames: Array<Frame>) => void) | undefined;
  // A CALL FRAME'S `url` IS EMPTY in current Chromium (deprecated in CDP) — the script is named by its `scriptId`, whose
  // URL arrives once in `Debugger.scriptParsed` (replayed for every existing script by `Debugger.enable`, so the
  // listener stands BEFORE the enable). Read off `callFrame.url`, every product frame read «<evaluated>» and no stack
  // was ever mapped (the box, 2026-11-09: `Bd (<evaluated>:1:2285169)` — a frame of main.js).
  const scriptUrls = new Map<string, string>();
  session.on('Debugger.scriptParsed', (event) => {
    if (event.url !== '') {
      scriptUrls.set(event.scriptId, event.url);
    }
  });
  try {
    await session.send('Debugger.enable');
  } catch {
    return undefined;
  }
  session.on('Debugger.paused', (event) => {
    void session.send('Debugger.resume').catch(() => undefined);
    const frames = event.callFrames.map((f) => ({
      functionName: f.functionName,
      url: f.url !== '' ? f.url : scriptUrls.get(f.location.scriptId) ?? '',
      lineNumber: f.location.lineNumber,
      columnNumber: f.location.columnNumber ?? 0,
    }));
    const taker = want;
    want = undefined;
    taker?.(frames);
  });
  return {
    pause: async () => {
      try {
        const paused = new Promise<Array<Frame>>((resolve) => {
          want = resolve;
        });
        let timer: ReturnType<typeof setTimeout> | undefined;
        const frames = await Promise.race([
          session.send('Debugger.pause').then(() => paused),
          new Promise<null>((resolve) => {
            timer = setTimeout(() => resolve(null), 5000);
          }),
        ]);
        clearTimeout(timer);
        if (frames === null) {
          want = undefined;
          return {reason: '(the pause never landed — the thread is not running JS: layout / raster / a native wait)'};
        }
        return {frames: frames.slice(0, 40)};
      } catch (e) {
        return {reason: `(could not pause: ${String(e).slice(0, 200)})`};
      }
    },
    close: async () => {
      await session.detach().catch(() => undefined);
    },
  };
}

/** One annotation that is filed at once and REWRITTEN in place when a better reading arrives (the mapped stack). */
function fileAnnotation(testInfo: TestInfo, type: string, line: string): {description: string} {
  console.log(line);
  const annotation = {type, description: line.slice(0, 4000)};
  testInfo.annotations.push(annotation);
  return annotation;
}

/** Arm the watch on every page of the context; returns the stop function (call it in the fixture's teardown). */
export function armHungPageWatch(context: BrowserContext, testInfo: TestInfo, root: string): () => void {
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const debuggers: Array<Promise<PageDebugger | undefined>> = [];
  const loopDelay = monitorEventLoopDelay({resolution: 20});
  loopDelay.enable();
  let stopped = false;
  const watch = (page: Page) => {
    const dbg = attachDebugger(context, page);
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
        void dbg.then(async (d) => {
          const result: PauseResult = d === undefined ? {reason: '(no debugger session on this page)'} : await d.pause();
          const head = `[hung-page] the main thread has not answered for ${Math.round(silentMs / 1000)} s — its stack:`;
          if ('reason' in result) {
            fileAnnotation(testInfo, 'hung-page', `${head}\n    ${result.reason}`);
            return;
          }
          // the RAW frames are filed at once; the mapping (a thread, bounded) rewrites the same annotation
          const annotation = fileAnnotation(testInfo, 'hung-page', `${head}\n${result.frames.map((f) => `    at ${rawFrame(f)}`).join('\n')}`);
          const mapped = await mapFrames(root, result.frames);
          if (mapped.some((m, i) => m !== rawFrame(result.frames[i]))) {
            const line = `${head}\n${mapped.map((m) => `    at ${m}`).join('\n')}`;
            console.log(line);
            annotation.description = line.slice(0, 4000);
          }
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
    loopDelay.disable();
    const stallMs = loopDelay.max / 1e6;
    if (stallMs >= WORKER_STALL_MS) {
      fileAnnotation(testInfo, 'worker-stall', `[worker-stall] the test worker's own event loop stood still for ${Math.round(stallMs)} ms — ` +
        'every driver bound (a settle read, a press) is a timer on that loop and waited with it');
    }
  };
}
