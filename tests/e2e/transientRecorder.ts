import type {Page} from '@playwright/test';

/**
 * ⭐ THE TRANSIENT RECORDER — the e2e flake architecture, CLASS 2.
 *
 * A `setInterval` sampler asks the page «what does it look like now?» every N ms — and on the 4K software (SwiftShader)
 * runner the main thread is starved for 100 – 300 ms at a time, so a sampler SLEEPS THROUGH a short transient (a 230 ms
 * dust puff at motion ×0.5, a 380 ms departure proxy, a flight's last pose): six CI flakes over five rounds were exactly
 * this (climate's proxy pose, parliament-water's departure, the transfer witness's landing, tile-language's dust,
 * delegate-grant's departures, utopia's landing). The product cannot change the DOM without the change being observed,
 * so this records off the product's OWN WRITES: a MutationObserver over the whole document (attributes incl. `style` /
 * `class`, children, text — a Teleport's move is a childList change it sees too) samples the reader in the very task the
 * product wrote, and a light rAF tick catches what only a computed style moves (a CSS transition). A starved renderer can
 * slow a transient; it can no longer hide it.
 *
 * ⭐ AND IT IS REPLACE-PROOF. A witness that lives in page JS dies with the document: when the product REPLACES the page
 * (the transport reloads on `INVALID_RUN_ID`), every record was gone and recording silently stopped — the empty trail of
 * `console-planetary-alliance` A on CI. Here the recorder is installed by `page.addInitScript` (re-installed on EVERY new
 * document of the page) and every sample is pushed to the NODE side at once (`page.exposeBinding`): a reload neither
 * loses what was recorded nor stops the recording, and each sample carries its document's id (`doc`), so a reader sees
 * the replacement as a fact. The harness names a reload the product made on its own (`consoleTest.ts`
 * `productReloadGuard`).
 *
 * The READER runs in the page and must be self-contained (it is serialized: no closures over spec variables — pass
 * values through `args`); it returns any JSON-able value. Samples are kept only when the value CHANGES (so a still pose
 * costs nothing), each with its wall-clock time. Usage:
 *
 *   await recordTransient(page, 'dust', () => Number(getComputedStyle(document.querySelector('.dust')!).opacity));
 *   … the press …
 *   const s = await readTransient<number>(page, 'dust');           // every distinct value, in order
 *   expect(s.some((x) => x.v > 0.1)).toBe(true);                     // «did it ever happen»
 *   const last = s.at(-1);                                            // «the last pose the product wrote»
 *
 * A NEW probe of a transient is this, never a `setInterval` (ratcheted in `tests/console/e2eDriverGuard.spec.ts`).
 *
 * ⭐ `settled: true` — WHAT IS PAINTED AT ONCE IS WHAT A TASK LEAVES, never what stands between two of its writes.
 * The observer's callback runs at the microtask checkpoint — after the product's FIRST write of the task and before
 * the writes the same task still owes: a tween's tick moves a proxy and calls «the card left its tile», the tile is
 * emptied by the reactive flush that call queued, a microtask later, in the same task, before any paint. A sample
 * taken in the callback sees the proxy away AND the tile full — a state no frame ever shows. On a fast frame the two
 * stand a few pixels apart and no reader minds; on a 300 ms software frame the tween has carried the proxy across the
 * screen in that one tick, and the reader calls it «two certificates at once» (`console-tenders-storyboard`, CI
 * 2026-11-14, 3 / 3 — the box: only pinned to two cores). So a claim about COEXISTENCE or ORDER — «never painted
 * twice», «the old one gone before the new one stands» — records with `settled: true`: the sample is taken when the
 * task's microtasks have run (the flush included), which is the state a frame can paint. «Did it ever happen» keeps
 * the default: a transient is caught in the task that wrote it.
 */

export type TransientSample<T> = {t: number, v: T, /** the document the sample was taken in (a reload changes it) */ doc: string};

type Record_ = {samples: Array<TransientSample<unknown>>, stopped: boolean, max: number};
type PageState = {bound: Promise<void>, recs: Map<string, Record_>};

const pages = new WeakMap<Page, PageState>();

function stateOf(page: Page): PageState {
  const known = pages.get(page);
  if (known !== undefined) {
    return known;
  }
  const recs = new Map<string, Record_>();
  const s: PageState = {
    recs,
    // ONE binding per page: Playwright re-installs it in every new document of the page by itself.
    bound: page.exposeBinding('__tmTransientPush', (_source, key: string, t: number, v: unknown, doc: string) => {
      const rec = recs.get(key);
      if (rec === undefined || rec.stopped) {
        return;
      }
      rec.samples.push({t, v, doc});
      if (rec.samples.length > rec.max) {
        rec.samples.shift();
      }
    }).then(() => undefined),
  };
  pages.set(page, s);
  return s;
}

type InstallArgs = {key: string, src: string, args: unknown, rafTick: boolean, settled: boolean};

/** The page half — runs in every document (init script) and once in the current one. Self-contained. */
function installTransient({key, src, args, rafTick, settled}: InstallArgs): void {
  type Live = {flush: () => Promise<unknown>, stop: () => void};
  const w = window as unknown as {
    __tmTransientPush?: (key: string, t: number, v: unknown, doc: string) => Promise<unknown>,
    __tmTransientDoc?: string,
    __tmTransientLive?: Record<string, Live>,
  };
  w.__tmTransientDoc ??= `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  w.__tmTransientLive ??= {};
  w.__tmTransientLive[key]?.stop();
  const read = new Function(`return (${src});`)() as (a: unknown) => unknown;
  let last = '\u0000';
  let pending: Promise<unknown> = Promise.resolve();
  const sample = (): Promise<unknown> => {
    let v: unknown;
    try {
      v = read(args);
    } catch {
      v = null;
    }
    const s = JSON.stringify(v ?? null);
    if (s !== last && w.__tmTransientPush !== undefined) {
      last = s;
      pending = w.__tmTransientPush(key, Date.now(), v ?? null, w.__tmTransientDoc ?? '');
    }
    return pending;
  };
  let live = true;
  let mo: MutationObserver | undefined;
  const start = () => {
    if (!live || document.documentElement === null) {
      return;
    }
    // `settled`: behind the microtasks the task has already queued (the reactive flush of the write just observed) —
    // and behind one more turn, for a flush that queues its own.
    mo = new MutationObserver(settled ?
      () => queueMicrotask(() => queueMicrotask(() => void sample())) :
      () => void sample());
    mo.observe(document.documentElement, {subtree: true, childList: true, attributes: true, characterData: true});
    const tick = () => {
      if (!live) {
        return;
      }
      void sample();
      window.requestAnimationFrame(tick);
    };
    if (rafTick) {
      window.requestAnimationFrame(tick);
    }
    void sample();
  };
  // An init script runs before the document has an element — start once it does.
  if (document.documentElement === null) {
    document.addEventListener('readystatechange', start, {once: true});
  } else {
    start();
  }
  w.__tmTransientLive[key] = {
    flush: sample,
    stop: () => {
      live = false;
      mo?.disconnect();
    },
  };
}

/**
 * Start recording `reader()` under `key` on `page` — and in every document the page loads after this (a reload by the
 * product included). `args` is passed to the reader as its one argument. `max` caps the kept samples.
 */
export async function recordTransient<A, T>(page: Page, key: string, reader: (args: A) => T,
  opts: {args?: A, max?: number, rafTick?: boolean, /** the state a task LEAVES — for a coexistence / order claim */ settled?: boolean} = {}): Promise<void> {
  const state = stateOf(page);
  await state.bound;
  state.recs.set(key, {samples: [], stopped: false, max: opts.max ?? 4000});
  const install: InstallArgs = {key, src: reader.toString(), args: opts.args ?? null, rafTick: opts.rafTick ?? true, settled: opts.settled ?? false};
  await page.addInitScript(installTransient, install);
  await page.evaluate(installTransient, install).catch(() => undefined); // a navigating page: the init script covers it
}

/** Every distinct value recorded under `key`, in order — across reloads (empty when never armed). */
export async function readTransient<T>(page: Page, key: string): Promise<Array<TransientSample<T>>> {
  // Flush the page's last write through the binding before reading the Node side.
  await page.evaluate((key) => {
    const w = window as unknown as {__tmTransientLive?: Record<string, {flush: () => Promise<unknown>}>};
    return w.__tmTransientLive?.[key]?.flush();
  }, key).catch(() => undefined);
  return (pages.get(page)?.recs.get(key)?.samples ?? []).slice() as Array<TransientSample<T>>;
}

/** Stop recording `key` (in this document and every later one) and return what it recorded. */
export async function stopTransient<T>(page: Page, key: string): Promise<Array<TransientSample<T>>> {
  const samples = await readTransient<T>(page, key);
  const rec = pages.get(page)?.recs.get(key);
  if (rec !== undefined) {
    rec.stopped = true; // an init script re-installed after this pushes into nothing
  }
  await page.evaluate((key) => {
    const w = window as unknown as {__tmTransientLive?: Record<string, {stop: () => void}>};
    w.__tmTransientLive?.[key]?.stop();
  }, key).catch(() => undefined);
  return samples;
}

/** The documents a recording spans — more than one means the page was REPLACED while it recorded. */
export function transientDocuments<T>(samples: ReadonlyArray<TransientSample<T>>): Array<string> {
  return [...new Set(samples.map((s) => s.doc))];
}
