import {Page} from '@playwright/test';

/*
 * THE BEAT WITNESS — «nothing changes in one frame» for the CHROME of a surface (the smoothness iteration after TR58:
 * PL-473 the target step's entry, PL-508 the hand's chrome, PL-510 the play composer's late content).
 *
 * The focus witness (`focusWitness.ts`) follows ONE object that carries the cursor; this one follows NAMED parts of a
 * screen — a header, a status line, a step, a block of rows — and answers two questions about each:
 *  · HOW it appeared: its effective opacity (the product of the ancestor chain, `visibility` / `display` included) on
 *    every sample — a part that goes from ≤ 5 % to ≥ 95 % between two consecutive samples close in time SNAPPED;
 *  · WHEN it appeared, against the other parts: the sample it first painted (`t05`) and the sample it was whole (`t95`),
 *    so a choreography can be asserted as an ORDER («the header is whole before the cards hand over», «the status line
 *    comes with the cursor, after the handoff») instead of a duration.
 * A part that is absent or invisible reads 0. Never rAF: MutationObserver + a 4 ms `setInterval` (a quiet compositor
 * withholds rAF exactly when these beats play); a sample is stored only when a value changed, with its own time.
 * ⚠ A mutation never samples IN its own microtask: the MutationObserver fires between Vue's patch and the `nextTick`
 * that writes an entrance's from-state, and would record a whole surface «visible» in a state the browser never paints
 * (the PL-473 step read SNAPPED that way, then 0 → 1 over 260 ms). It SCHEDULES a task-level sample (a MessageChannel
 * message — after every microtask of the turn), the same law as `parliament` rule 17 («a sample carries its clock»).
 */

/**
 * `held` — the part's opacity animation (on it or an ancestor) is PENDING: created, its start time not yet resolved by
 * the compositor that runs it. The main thread reads such an animation at its START keyframe (`fill: backwards`) while
 * the screen still shows the LAST presented frame — no new frame exists yet (a 4K software raster of a freshly mounted
 * step takes hundreds of ms). A held interval is the frames' time, never the product's: it is netted out like a long
 * task (`heldIntervals`), and a part still held when the window closes is a window closed too early, never «it never
 * came» (`awaitBeatsSettled`). The same «the main thread reads a held start value» class as the focus witness's `held`.
 */
export type BeatSample = {t: number, vis: Record<string, number>, anim: Record<string, boolean>, held?: Record<string, boolean>};
export type BeatMark = {
  name: string;
  /** First sample the part painted (effective opacity ≥ .05); undefined — never. */
  t05?: number;
  /** First sample the part was whole (≥ .95); undefined — never. */
  t95?: number;
  /**
   * A jump ≤ .05 → ≥ .95 between two consecutive samples with NO opacity animation / transition running on the part or
   * an ancestor at either of them — the part appeared in one frame. (The sample DENSITY proves nothing here: timers are
   * coarse in this harness and a compositor-driven fade progresses while the main thread is starved; whether an
   * animation was RUNNING is what tells a fade from a cut.)
   */
  snapped?: {t: number, gap: number};
  /** The part was visible at the arm already (its appearance is not part of this window). */
  standing: boolean;
};
export type BeatReport = {samples: number, marks: Record<string, BeatMark>, trail: ReadonlyArray<BeatSample>, errors?: ReadonlyArray<string>};

/** Arm the witness: `parts` maps a name to a selector (the first match is the part). */
export async function armBeatWitness(page: Page, parts: Record<string, string>): Promise<void> {
  await page.evaluate((spec) => {
    type S = {t: number, vis: Record<string, number>, anim: Record<string, boolean>, held: Record<string, boolean>};
    type W = {samples: Array<S>, errors: Array<string>, stop: () => void, read: () => S | undefined};
    const g = window as unknown as {__beat?: W};
    g.__beat?.stop();
    const t0 = performance.now();
    const samples: Array<S> = [];
    /** An opacity animation or transition running on `el` or an ancestor (CSS-driven fades and rises). */
    const animOf = (el: Element | null): boolean => {
      if (el === null || typeof document.getAnimations !== 'function') {
        return false;
      }
      return document.getAnimations().some((a) => {
        if (a.playState !== 'running') {
          return false;
        }
        const target = (a.effect as KeyframeEffect | null)?.target ?? null;
        if (target === null || !(target === el || target.contains(el))) {
          return false;
        }
        if (typeof CSSTransition !== 'undefined' && a instanceof CSSTransition) {
          return a.transitionProperty === 'opacity' || a.transitionProperty === 'visibility';
        }
        const frames = (a.effect as KeyframeEffect).getKeyframes();
        return frames.some((k) => 'opacity' in k);
      });
    };
    /** An opacity animation on `el` or an ancestor whose start the compositor has not resolved yet (see `held`). */
    const heldOf = (el: Element | null): boolean => {
      if (el === null || typeof document.getAnimations !== 'function') {
        return false;
      }
      return document.getAnimations().some((a) => {
        if (!a.pending || a.playState === 'idle' || a.playState === 'finished') {
          return false;
        }
        const target = (a.effect as KeyframeEffect | null)?.target ?? null;
        if (target === null || !(target === el || target.contains(el))) {
          return false;
        }
        if (typeof CSSTransition !== 'undefined' && a instanceof CSSTransition) {
          return a.transitionProperty === 'opacity' || a.transitionProperty === 'visibility';
        }
        return (a.effect as KeyframeEffect).getKeyframes().some((k) => 'opacity' in k);
      });
    };
    const visOf = (el: Element | null): number => {
      if (el === null) {
        return 0;
      }
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) {
        return 0;
      }
      let v = 1;
      for (let n: Element | null = el; n !== null && n !== document.documentElement; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.display === 'none' || cs.visibility === 'hidden') {
          return 0;
        }
        v *= Number.parseFloat(cs.opacity) || 0;
        if (v < 0.005) {
          return 0;
        }
      }
      return Math.round(v * 100) / 100;
    };
    let last = '';
    const errors: Array<string> = [];
    const sample = (): void => {
      try {
        sampleNow();
      } catch (e) {
        // A sampler that throws silently STOPS sampling — the report carries the error instead (a dead witness proves
        // nothing; its absence of findings must never read as «nothing happened»).
        if (errors.length < 5) {
          errors.push(String(e));
        }
      }
    };
    const sampleNow = (): void => {
      const vis: Record<string, number> = {};
      const anim: Record<string, boolean> = {};
      const held: Record<string, boolean> = {};
      for (const [name, sel] of Object.entries(spec)) {
        const el = document.querySelector(sel);
        vis[name] = visOf(el);
        anim[name] = animOf(el);
        held[name] = heldOf(el);
      }
      const sig = JSON.stringify([vis, anim, held]);
      if (sig !== last) {
        last = sig;
        samples.push({t: Math.round(performance.now() - t0), vis, anim, held});
      }
    };
    const channel = new MessageChannel();
    let queued = false;
    channel.port1.onmessage = () => {
      queued = false;
      sample();
    };
    const schedule = (): void => {
      if (!queued) {
        queued = true;
        channel.port2.postMessage(0);
      }
    };
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, {subtree: true, childList: true, attributes: true});
    const iv = window.setInterval(sample, 4);
    // The boundaries of every CSS motion are samples too — a fade that runs on the compositor mutates no DOM.
    const EVENTS = ['transitionrun', 'transitionend', 'transitioncancel', 'animationstart', 'animationend', 'animationcancel'];
    for (const ev of EVENTS) {
      document.addEventListener(ev, sample, true);
    }
    sample();
    let stopped = false;
    g.__beat = {samples, errors, read: () => {
      if (!stopped) {
        sample();
      }
      return samples[samples.length - 1];
    }, stop: () => {
      if (stopped) {
        return;
      }
      // The window's LAST state is a sample too — a stop that lands right after a long task (its own evaluate queued
      // before the 4 ms interval's) would otherwise leave the report on the pre-task state.
      sample();
      stopped = true;
      mo.disconnect();
      window.clearInterval(iv);
      channel.port1.close();
      for (const ev of EVENTS) {
        document.removeEventListener(ev, sample, true);
      }
    }};
  }, parts);
}

/** Stop the witness and read its report. */
export async function beatWitness(page: Page): Promise<BeatReport> {
  const trail = await page.evaluate(() => {
    const g = window as unknown as {__beat?: {samples: Array<{t: number, vis: Record<string, number>, anim: Record<string, boolean>, held: Record<string, boolean>}>, errors: Array<string>, stop: () => void}};
    g.__beat?.stop();
    return {samples: g.__beat?.samples ?? [], errors: g.__beat?.errors ?? []};
  });
  return {...analyseBeats(trail.samples), errors: trail.errors};
}

export function analyseBeats(trail: ReadonlyArray<BeatSample>): BeatReport {
  const names = trail.length > 0 ? Object.keys(trail[0].vis) : [];
  const marks: Record<string, BeatMark> = {};
  for (const name of names) {
    const first = trail[0].vis[name] ?? 0;
    const mark: BeatMark = {name, standing: first >= 0.95};
    for (let i = 0; i < trail.length; i++) {
      const v = trail[i].vis[name] ?? 0;
      if (mark.t05 === undefined && v >= 0.05) {
        mark.t05 = trail[i].t;
      }
      if (mark.t95 === undefined && v >= 0.95) {
        mark.t95 = trail[i].t;
      }
      if (i > 0 && mark.snapped === undefined) {
        const prev = trail[i - 1].vis[name] ?? 0;
        const gap = trail[i].t - trail[i - 1].t;
        const moving = (trail[i - 1].anim?.[name] ?? false) || (trail[i].anim?.[name] ?? false) || (trail[i - 1].held?.[name] ?? false);
        if (prev <= 0.05 && v >= 0.95 && !moving) {
          mark.snapped = {t: trail[i].t, gap};
        }
      }
    }
    marks[name] = mark;
  }
  return {samples: trail.length, marks, trail};
}

/** One line per part — for messages and the acceptance record. */
export function beatSummary(r: BeatReport): string {
  const parts = Object.values(r.marks).map((m) =>
    `${m.name} ${m.standing ? 'standing' : `${m.t05 ?? '–'}→${m.t95 ?? '–'} ms`}${m.snapped !== undefined ? ` SNAPPED@${m.snapped.t}` : ''}`);
  const errs = (r.errors ?? []).length > 0 ? ` · SAMPLER ERRORS ${JSON.stringify(r.errors)}` : '';
  return `samples ${r.samples} · ${parts.join(' · ')}${errs}`;
}

/** The trail around `t` (± `span` ms) for the named parts — a red names the moment. */
export function beatTrailAround(r: BeatReport, t: number, span = 120): string {
  return r.trail.filter((s) => Math.abs(s.t - t) <= span)
    .map((s) => `${String(s.t).padStart(6)} ${Object.entries(s.vis).map(([k, v]) => `${k}=${v}${s.anim?.[k] === true ? '~' : ''}`).join(' ')}`).join('\n');
}

/**
 * The intervals a part's entry was HELD (`BeatSample.held` — pending on the compositor): from each held sample to the
 * next sample. Frames that did not exist yet — net them out of a wait like long tasks.
 */
export function heldIntervals(r: BeatReport, name: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i + 1 < r.trail.length; i++) {
    if (r.trail[i].held?.[name] === true) {
      out.push([r.trail[i].t, r.trail[i + 1].t - r.trail[i].t]);
    }
  }
  return out;
}

/**
 * Wait until every named part's entry is OVER from the witness's own view — whole (≥ .95), or no opacity motion left on
 * it — before the window closes. A window closed while a part is still held / moving reports «it never came» about an
 * entry that simply had not started yet (CI 2026-11-11, `console-smoothness` (A): two samples, the cards held at 0, the
 * window shut). Bounded: a part that never starts its entry within `timeoutMs` is returned as such — a product that
 * leaves an entry pending for ever is a real red, named by the caller.
 */
export async function awaitBeatsSettled(page: Page, names: ReadonlyArray<string>, timeoutMs = 10_000): Promise<{settled: boolean, last?: BeatSample}> {
  const deadline = Date.now() + timeoutMs;
  let last: BeatSample | undefined;
  for (;;) {
    last = await page.evaluate(() => (window as unknown as {__beat?: {read: () => BeatSample | undefined}}).__beat?.read());
    const over = last !== undefined && names.every((n) => (last?.vis[n] ?? 0) >= 0.95 || (!(last?.anim[n] ?? false) && !(last?.held?.[n] ?? false)));
    if (over || Date.now() > deadline) {
      return {settled: over, last};
    }
    // A state read paced by the page's own timer (never a `waitForTimeout` — a duration standing in for a state).
    await page.evaluate(() => new Promise<void>((resolve) => window.setTimeout(resolve, 40)));
  }
}
