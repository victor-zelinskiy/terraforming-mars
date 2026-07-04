/**
 * Perf-0 instrumentation (§17 Performance Initiative). Zero-cost unless enabled via
 * `?perf=1` or `localStorage tm_perf=1`. Uses the User Timing API so marks/measures show
 * up in the DevTools Performance panel's "Timings" track AND in Electron `contentTracing`.
 *
 * Also installs a long-task observer that logs every main-thread task >= 50 ms — the
 * fastest way to find jank without instrumenting every call site.
 *
 * Add `perfMark('label')` at any suspected hot path; wrap a block with `perfTime`.
 */

let cachedEnabled: boolean | undefined;

export function perfEnabled(): boolean {
  if (cachedEnabled !== undefined) {
    return cachedEnabled;
  }
  let on = false;
  try {
    const params = new URLSearchParams(window.location.search);
    on = params.get('perf') === '1' || window.localStorage?.getItem('tm_perf') === '1';
  } catch {
    on = false;
  }
  cachedEnabled = on;
  return on;
}

export function perfMark(name: string): void {
  if (!perfEnabled()) {
    return;
  }
  try {
    performance.mark(name);
  } catch {
    // performance.mark unavailable — ignore
  }
}

/** Measure from a previously-set start mark to now, and log the duration. */
export function perfMeasure(name: string, startMark: string): void {
  if (!perfEnabled()) {
    return;
  }
  try {
    performance.measure(name, startMark);
    const entries = performance.getEntriesByName(name, 'measure');
    const last = entries[entries.length - 1];
    if (last !== undefined) {
      console.log(`[perf] ${name}: ${last.duration.toFixed(1)}ms`);
    }
  } catch {
    // measure failed (missing start mark) — ignore
  }
}

/** Time a synchronous block; returns its result. No-op wrapper when disabled. */
export function perfTime<T>(name: string, fn: () => T): T {
  if (!perfEnabled()) {
    return fn();
  }
  const start = `${name}:start`;
  try {
    performance.mark(start);
  } catch {
    // ignore
  }
  const result = fn();
  perfMeasure(name, start);
  return result;
}

let longTaskObserver: PerformanceObserver | undefined;

/** Log every main-thread task >= 50 ms (Perf-0 jank finder). Idempotent. */
export function startLongTaskObserver(): void {
  if (!perfEnabled() || longTaskObserver !== undefined) {
    return;
  }
  try {
    longTaskObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration >= 50) {
          console.warn(`[perf] long task ${entry.duration.toFixed(0)}ms @ ${entry.startTime.toFixed(0)}ms`);
        }
      }
    });
    longTaskObserver.observe({entryTypes: ['longtask']});
  } catch {
    // longtask entry type unsupported — ignore
  }
}
