/**
 * THE TRACE OF A RENDERER STOP — where the FRAME went (console architecture v2 · N1).
 *
 * A stop inside native rendering (CI 42626840874 — fifteen minutes with the renderer's main thread outside JS after the
 * hand album closed on SwiftShader; the box — eleven seconds with VizCompositor at 99 %) leaves nothing in the page's
 * own log: the hang watch (`rendererHangWatch.ts`) names the screen that stood, and that is all anybody had. Chromium
 * can say the rest — which thread was busy, in style, layout, paint, raster, the compositor or the GPU process — and
 * only the main process can ask it while the renderer is silent: `contentTracing` records every process of the app.
 *
 * So the hang watch starts a trace the moment the page stops answering and stops it when the page answers again, after
 * a few seconds, or just before it restarts the renderer; the file lands beside the game's logs (the folder the F12
 * console export already writes to) and is named in the watch's own line. Only the last `HANG_TRACE_KEEP` traces are
 * kept. The categories are the ones the Performance panel records plus the compositor's and the GPU's, and the
 * sampling profilers — a stop with the main thread outside JS shows as native samples under one task.
 *
 * `createHangTrace(deps)` is PURE of Electron (unit-tested); `electronHangTraceDeps` binds it to `contentTracing`.
 */
import * as path from 'path';

/** What a stop is recorded with. */
export const HANG_TRACE_CATEGORIES: ReadonlyArray<string> = [
  'toplevel', 'toplevel.flow', 'renderer.scheduler', 'blink', 'blink.user_timing', 'cc', 'viz', 'gpu', 'latencyInfo', 'input',
  'loading', 'v8', 'devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame',
  'disabled-by-default-cpu_profiler', 'disabled-by-default-v8.cpu_profiler',
];

/** How many trace files are kept (the oldest go). */
export const HANG_TRACE_KEEP = 5;

export type HangTraceDeps = {
  /** Begin recording with these categories. */
  startRecording: (categories: ReadonlyArray<string>) => Promise<void>,
  /** End recording into `file`; resolves with the path actually written. */
  stopRecording: (file: string) => Promise<string>,
  /** The folder the traces go to. */
  dir: () => string,
  /** The trace files already there (names), any order. */
  list: (dir: string) => ReadonlyArray<string>,
  remove: (file: string) => void,
  now: () => number,
  /** One line for the log when something about the trace itself fails. */
  note: (line: string) => void,
};

const PREFIX = 'renderer-hang-';

/** `renderer-hang-20261110-221503.trace.json` — sortable by name. */
export function hangTraceName(at: number): string {
  const d = new Date(at);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${PREFIX}${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}${two(d.getSeconds())}.trace.json`;
}

/** Which of the existing trace files go so that at most `keep` remain after one more is written (oldest first). */
export function hangTracesToPrune(names: ReadonlyArray<string>, keep: number = HANG_TRACE_KEEP): Array<string> {
  const traces = names.filter((n) => n.startsWith(PREFIX) && n.endsWith('.trace.json')).sort();
  return traces.slice(0, Math.max(0, traces.length - (keep - 1)));
}

/** The recorder the hang watch takes (`HangWatchDeps.trace`): `start` / `stop`, neither ever throws or rejects. */
export function createHangTrace(deps: HangTraceDeps): {start: () => void, stop: (label: string) => Promise<string>} {
  let started: Promise<boolean> | undefined;
  return {
    start: () => {
      if (started !== undefined) {
        return;
      }
      started = deps.startRecording(HANG_TRACE_CATEGORIES).then(() => true, (error) => {
        deps.note(`[renderer-hang] the trace could not start — ${String(error).slice(0, 200)}`);
        return false;
      });
    },
    stop: (label) => {
      const begun = started;
      started = undefined;
      if (begun === undefined) {
        return Promise.resolve('');
      }
      return begun.then((recording) => {
        if (!recording) {
          return '';
        }
        const dir = deps.dir();
        try {
          for (const stale of hangTracesToPrune(deps.list(dir))) {
            deps.remove(path.join(dir, stale));
          }
        } catch (error) {
          deps.note(`[renderer-hang] old traces could not be pruned — ${String(error).slice(0, 200)}`);
        }
        return deps.stopRecording(path.join(dir, hangTraceName(deps.now())));
      }).catch((error) => {
        deps.note(`[renderer-hang] the trace (${label}) could not be written — ${String(error).slice(0, 200)}`);
        return '';
      });
    },
  };
}
