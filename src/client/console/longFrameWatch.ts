/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE LONG-FRAME WATCH — where a slow frame WENT (console architecture v2 · N1).
 *
 * Every net of this console judges the PLAYER's side (is the question served, did the press change anything) and the
 * main process judges a page that stopped answering altogether (`electron/rendererHangWatch.ts`). Between the two
 * there was nothing: a frame that took two seconds and then returned to JS left no trace of what the two seconds were
 * — a script, a forced layout inside a script, style + layout of the frame, or the renderer's own paint / raster /
 * commit with no script at all. That last one is the class the field calls «подвисает» and the one no JS probe can see
 * FROM THE INSIDE while it lasts — but the platform reports it afterwards: the Long Animation Frames API hands every
 * frame over 50 ms with its phases.
 *
 * So every frame over `LONG_FRAME_MIN_MS` is ONE tagged line (the field recorder copies tagged lines, the console
 * export prints them):
 *
 *   [long-frame] 2140ms — native 1890ms (render 1420 · style+layout 470) · script 250ms: 180 event-listener «click»
 *   @ console-shell.js:onTaskSubmit, 70 … · first input 0ms · blocked 2090ms — NATIVE
 *
 *  · `script`    — time inside JS entry points, the two heaviest named (invoker and source);
 *  · `forced`    — style / layout a script forced synchronously (layout thrash), part of the script time;
 *  · `native`    — the frame's remainder: the rendering update's style + layout (`styleAndLayoutStart` → end) and what
 *                  is neither script nor that (`render`: the browser's own work between the tasks and the paint);
 *  · the verdict — `NATIVE` when the scripts are under a third of the frame, `SCRIPT` when over two thirds.
 *
 * Bounded: at most one line per `LONG_FRAME_GAP_MS` (a software renderer makes long frames by the hundred — the line
 * that matters is the first of a burst, with the count of the ones it swallowed). PURE where it matters (`longFrameLine`
 * takes a plain entry) — `tests/console/longFrameWatch.spec.ts`.
 */

/** A frame shorter than this is not said (a 4K software frame is routinely 100–200 ms; a stall is not). */
export const LONG_FRAME_MIN_MS = 500;
/** At most one line per this span; the frames it swallows are counted into the next line. */
export const LONG_FRAME_GAP_MS = 2000;

/** The part of a `PerformanceLongAnimationFrameTiming` the line reads (plain — a spec builds one by hand). */
export type LongFrameEntry = {
  startTime: number,
  duration: number,
  blockingDuration?: number,
  renderStart?: number,
  styleAndLayoutStart?: number,
  firstUIEventTimestamp?: number,
  scripts?: ReadonlyArray<{
    duration: number,
    forcedStyleAndLayoutDuration?: number,
    invokerType?: string,
    invoker?: string,
    sourceURL?: string,
    sourceFunctionName?: string,
  }>,
};

const ms = (n: number): string => `${Math.round(n)}ms`;

function scriptName(s: NonNullable<LongFrameEntry['scripts']>[number]): string {
  const file = (s.sourceURL ?? '').split('/').pop()?.split('?')[0] ?? '';
  const where = [file, s.sourceFunctionName ?? ''].filter((p) => p !== '').join(':');
  return `${Math.round(s.duration)} ${s.invokerType ?? 'script'}${s.invoker !== undefined && s.invoker !== '' ? ` «${s.invoker.slice(0, 60)}»` : ''}${where !== '' ? ` @ ${where}` : ''}`;
}

/** The frame's split, in ms. Pure. */
export function longFrameSplit(entry: LongFrameEntry): {script: number, forced: number, styleLayout: number, render: number, native: number} {
  const scripts = entry.scripts ?? [];
  const script = Math.min(entry.duration, scripts.reduce((sum, s) => sum + s.duration, 0));
  const forced = Math.min(script, scripts.reduce((sum, s) => sum + (s.forcedStyleAndLayoutDuration ?? 0), 0));
  const end = entry.startTime + entry.duration;
  const styleLayout = entry.styleAndLayoutStart !== undefined && entry.styleAndLayoutStart > 0 ?
    Math.max(0, Math.min(entry.duration, end - entry.styleAndLayoutStart)) : 0;
  const native = Math.max(0, entry.duration - script);
  return {script, forced, styleLayout, render: Math.max(0, native - styleLayout), native};
}

/** `NATIVE` · `SCRIPT` · `MIXED` — who had the frame. Pure. */
export function longFrameVerdict(entry: LongFrameEntry): 'NATIVE' | 'SCRIPT' | 'MIXED' {
  const {script} = longFrameSplit(entry);
  const share = entry.duration <= 0 ? 0 : script / entry.duration;
  return share < 1 / 3 ? 'NATIVE' : share > 2 / 3 ? 'SCRIPT' : 'MIXED';
}

/** The line. Pure. `swallowed` — long frames since the last line that were not said. */
export function longFrameLine(entry: LongFrameEntry, swallowed = 0): string {
  const split = longFrameSplit(entry);
  const top = [...(entry.scripts ?? [])].sort((a, b) => b.duration - a.duration).slice(0, 2).map(scriptName);
  const more = (entry.scripts?.length ?? 0) - top.length;
  return `[long-frame] ${ms(entry.duration)} — native ${ms(split.native)} (render ${Math.round(split.render)} · style+layout ${Math.round(split.styleLayout)})` +
    ` · script ${ms(split.script)}${split.forced >= 1 ? ` (forced layout ${Math.round(split.forced)})` : ''}` +
    `${top.length > 0 ? `: ${top.join(', ')}${more > 0 ? `, +${more}` : ''}` : ''}` +
    `${entry.blockingDuration !== undefined ? ` · blocked ${ms(entry.blockingDuration)}` : ''}` +
    `${entry.firstUIEventTimestamp !== undefined && entry.firstUIEventTimestamp > 0 ? ' · a press waited in it' : ''}` +
    `${swallowed > 0 ? ` · +${swallowed} long frame(s) since the last line` : ''} — ${longFrameVerdict(entry)}`;
}

/** Evidence for the page (`window.__conLongFrames()`): how many long frames, the worst, the native ones. */
export const longFrameStats = {seen: 0, native: 0, worstMs: 0, last: [] as Array<string>};

let installed = false;

/** Idempotent. A platform without the Long Animation Frames API installs nothing. */
export function installLongFrameWatch(): void {
  if (installed || typeof PerformanceObserver === 'undefined') {
    return;
  }
  const supported = (PerformanceObserver as unknown as {supportedEntryTypes?: ReadonlyArray<string>}).supportedEntryTypes;
  if (supported === undefined || !supported.includes('long-animation-frame')) {
    return;
  }
  installed = true;
  let saidAt = -Infinity;
  let swallowed = 0;
  const observer = new PerformanceObserver((list) => {
    for (const raw of list.getEntries()) {
      const entry = raw as unknown as LongFrameEntry;
      if (entry.duration < LONG_FRAME_MIN_MS) {
        continue;
      }
      longFrameStats.seen++;
      longFrameStats.worstMs = Math.max(longFrameStats.worstMs, Math.round(entry.duration));
      if (longFrameVerdict(entry) === 'NATIVE') {
        longFrameStats.native++;
      }
      if (entry.startTime - saidAt < LONG_FRAME_GAP_MS) {
        swallowed++;
        continue;
      }
      saidAt = entry.startTime;
      const line = longFrameLine(entry, swallowed);
      swallowed = 0;
      longFrameStats.last.push(line);
      if (longFrameStats.last.length > 20) {
        longFrameStats.last.shift();
      }
      console.warn(line);
    }
  });
  try {
    observer.observe({type: 'long-animation-frame', buffered: true});
  } catch {
    installed = false;
    return;
  }
  (window as unknown as {__conLongFrames?: () => typeof longFrameStats}).__conLongFrames = () => longFrameStats;
}
