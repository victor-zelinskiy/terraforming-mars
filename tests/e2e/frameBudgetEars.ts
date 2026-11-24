import {Page} from './consoleTest';

/**
 * THE EARS OF THE FRAME BUDGET (`console-frame-budget.spec.ts`) — what the page itself hears of a press: every long
 * animation frame, every layout-forcing read (wrapped on the prototypes: how many, how long, the slowest with their
 * stacks), every write onto the roots. Installed once per page; `markFrameReading` starts a reading, `frameReading`
 * ends it. A driver, not a check: nothing here reads a geometry of the product — it times the product's own reads.
 */
export type SlowRead = {name: string, took: number, on: string, stack: Array<string>};
export type PressReading = {
  frameMs: number, scriptMs: number, forcedMs: number, frames: number,
  reads: number, readMs: number, slow: Array<SlowRead>, roots: Array<string>, bar: string,
};

/** Install the page's ears: the frames, the layout-forcing reads, the writes onto the roots. Idempotent. */
export async function installFrameEars(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as {__fb?: Record<string, unknown>};
    if (w.__fb !== undefined) {
      return;
    }
    const fb = {frames: [] as Array<Record<string, unknown>>, reads: 0, readMs: 0, slow: [] as Array<Record<string, unknown>>, roots: [] as Array<string>};
    w.__fb = fb;
    new PerformanceObserver((list) => {
      for (const raw of list.getEntries()) {
        const e = raw as unknown as {startTime: number, duration: number, scripts?: Array<{duration: number, forcedStyleAndLayoutDuration?: number}>};
        fb.frames.push({
          start: e.startTime, dur: e.duration,
          script: (e.scripts ?? []).reduce((sum, s) => sum + s.duration, 0),
          forced: (e.scripts ?? []).reduce((sum, s) => sum + (s.forcedStyleAndLayoutDuration ?? 0), 0),
        });
      }
    }).observe({type: 'long-animation-frame', buffered: false});
    const describe = (el: unknown): string => {
      const e = el as {tagName?: string, className?: unknown, id?: string};
      const cls = typeof e.className === 'string' ? e.className : '';
      return `${(e.tagName ?? '?').toLowerCase()}${e.id ? `#${e.id}` : ''}${cls !== '' ? `.${cls.trim().split(/\s+/).slice(0, 3).join('.')}` : ''}`;
    };
    const note = (name: string, took: number, el: unknown): void => {
      fb.reads++;
      fb.readMs += took;
      if (took >= 3) {
        fb.slow.push({name, took, on: describe(el), stack: (new Error().stack ?? '').split('\n').slice(3, 11).map((line) => line.trim())});
      }
    };
    const wrapMethod = (proto: object, name: string): void => {
      const original = (proto as Record<string, unknown>)[name] as (...args: Array<unknown>) => unknown;
      (proto as Record<string, unknown>)[name] = function(this: unknown, ...args: Array<unknown>): unknown {
        const t = performance.now();
        const result = original.apply(this, args);
        note(name, performance.now() - t, this);
        return result;
      };
    };
    const wrapGetter = (proto: object, name: string): void => {
      const d = Object.getOwnPropertyDescriptor(proto, name);
      if (d === undefined || d.get === undefined) {
        return;
      }
      const get = d.get;
      Object.defineProperty(proto, name, {...d, get(this: unknown): unknown {
        const t = performance.now();
        const result = get.call(this);
        note(name, performance.now() - t, this);
        return result;
      }});
    };
    wrapMethod(Element.prototype, 'getBoundingClientRect');
    wrapMethod(Element.prototype, 'getClientRects');
    for (const name of ['offsetWidth', 'offsetHeight', 'offsetTop', 'offsetLeft', 'offsetParent']) {
      wrapGetter(HTMLElement.prototype, name);
    }
    for (const name of ['clientWidth', 'clientHeight', 'scrollWidth', 'scrollHeight', 'scrollTop', 'scrollLeft']) {
      wrapGetter(Element.prototype, name);
    }
    const roots: Array<[string, Element | null]> = [['html', document.documentElement], ['body', document.body], ['#app', document.querySelector('#app')], ['.con-root', document.querySelector('.con-root')]];
    for (const [label, el] of roots) {
      if (el === null) {
        continue;
      }
      new MutationObserver((records) => {
        for (const r of records) {
          const was = new Set((r.oldValue ?? '').split(/\s+/).filter((c) => c !== ''));
          const now = new Set(((r.target as Element).getAttribute(r.attributeName ?? 'class') ?? '').split(/\s+/).filter((c) => c !== ''));
          const added = [...now].filter((c) => !was.has(c));
          const removed = [...was].filter((c) => !now.has(c));
          if (r.attributeName === 'class' && (added.length > 0 || removed.length > 0)) {
            fb.roots.push(`${label} ${added.map((c) => `+${c}`).concat(removed.map((c) => `-${c}`)).join(' ')}`);
          } else if (r.attributeName !== 'class') {
            fb.roots.push(`${label} [${r.attributeName}]`);
          }
        }
      }).observe(el, {attributes: true, attributeOldValue: true});
    }
  });
}

/** Start a reading: what the page heard before this moment is not this press's. */
export async function markFrameReading(page: Page): Promise<number> {
  return page.evaluate(() => {
    const fb = (window as unknown as {__fb: {frames: Array<unknown>, reads: number, readMs: number, slow: Array<unknown>, roots: Array<string>}}).__fb;
    fb.frames.length = 0;
    fb.reads = 0;
    fb.readMs = 0;
    fb.slow.length = 0;
    fb.roots.length = 0;
    return performance.now();
  });
}

export async function frameReading(page: Page): Promise<PressReading> {
  return page.evaluate(() => {
    const fb = (window as unknown as {__fb: {frames: Array<{dur: number, script: number, forced: number}>, reads: number, readMs: number, slow: Array<{name: string, took: number, on: string, stack: Array<string>}>, roots: Array<string>}}).__fb;
    const worst = [...fb.frames].sort((a, b) => b.dur - a.dur)[0];
    return {
      frameMs: Math.round(worst?.dur ?? 0), scriptMs: Math.round(worst?.script ?? 0), forcedMs: Math.round(worst?.forced ?? 0), frames: fb.frames.length,
      reads: fb.reads, readMs: Math.round(fb.readMs),
      slow: [...fb.slow].sort((a, b) => b.took - a.took).slice(0, 4).map((s) => ({...s, took: Math.round(s.took)})),
      roots: [...new Set(fb.roots)].slice(0, 12),
      bar: (document.querySelector('.con-cmdbar')?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 90),
    };
  });
}
