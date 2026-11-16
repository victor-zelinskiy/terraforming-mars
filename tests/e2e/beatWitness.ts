import type {Page} from '@playwright/test';
import {readTransient, recordTransient, stopTransient, TransientSample} from './transientRecorder';

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
 * A part that is absent or invisible reads 0. A sample is stored only when a value changed, with its own time (ms since
 * the arm, on the PAGE's clock).
 *
 * RECORDED (FLAKE ZERO — the replace-proof recorder, `transientRecorder.ts`): the product's own writes are observed in
 * the task that makes them, a frame tick reads what only a compositor-driven fade moves (the boundaries of every CSS
 * motion are dispatched in those very frames), and a 4 ms TIMER tick keeps the page's own pace while the compositor
 * withholds frames — a TIMING witness: a quiet compositor withholds frames exactly when these beats play, and the held
 * read below is only told from a stalled thread by a clock that keeps running. Every change is pushed to the Node side
 * at once, so a page the product REPLACES neither loses the trail nor stops it.
 * ⚠ A mutation never samples IN its own microtask: the MutationObserver fires between Vue's patch and the `nextTick`
 * that writes an entrance's from-state, and would record a whole surface «visible» in a state the browser never paints
 * (the PL-473 step read SNAPPED that way, then 0 → 1 over 260 ms). The recorder arms `settled` — a sample is taken
 * behind the microtasks the task queued — the same law as `parliament` rule 17 («a sample carries its clock»).
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

/** One reading of every part — or the error the reader met (a dead witness proves nothing; it says so instead). */
type BeatObservation = {vis: Record<string, number>, anim: Record<string, boolean>, held: Record<string, boolean>} | {error: string};

const BEAT_KEY = 'beat-witness';
/** The page's `Date.now()` at the arm — the origin of the trail's `t` (the recorder stamps samples on that clock). */
const ORIGIN = new WeakMap<Page, number>();

/** The page half — SELF-CONTAINED (serialized into every document the page loads): one observation of every part. */
function readBeats(spec: Record<string, string>): BeatObservation {
  try {
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
    const vis: Record<string, number> = {};
    const anim: Record<string, boolean> = {};
    const held: Record<string, boolean> = {};
    for (const [name, sel] of Object.entries(spec)) {
      const el = document.querySelector(sel);
      vis[name] = visOf(el);
      anim[name] = animOf(el);
      held[name] = heldOf(el);
    }
    return {vis, anim, held};
  } catch (e) {
    // A reader that throws must never read as «nothing happened» — the report carries the error.
    return {error: String(e)};
  }
}

/** The recording as a trail (ms since the arm) and the reader's errors (at most five). */
function foldBeats(recorded: ReadonlyArray<TransientSample<BeatObservation | null>>, origin: number | undefined): {trail: Array<BeatSample>, errors: Array<string>} {
  const base = origin ?? recorded[0]?.t ?? 0;
  const trail: Array<BeatSample> = [];
  const errors: Array<string> = [];
  for (const s of recorded) {
    const v = s.v;
    if (v === null || 'error' in v) {
      if (errors.length < 5) {
        errors.push(v === null ? 'the reader returned nothing' : v.error);
      }
      continue;
    }
    trail.push({t: Math.round(s.t - base), vis: v.vis, anim: v.anim, held: v.held});
  }
  return {trail, errors};
}

/** Arm the witness: `parts` maps a name to a selector (the first match is the part). Re-arming replaces a previous one. */
export async function armBeatWitness(page: Page, parts: Record<string, string>): Promise<void> {
  ORIGIN.set(page, await page.evaluate(() => Date.now()));
  await recordTransient(page, BEAT_KEY, readBeats, {args: parts, settled: true, tickMs: 4, max: 100_000});
}

/** Stop the witness and read its report. */
export async function beatWitness(page: Page): Promise<BeatReport> {
  // The window's LAST state is a sample too: `stopTransient` flushes the reader once more before it stops — a stop that
  // lands right after a long task would otherwise leave the report on the pre-task state.
  const {trail, errors} = foldBeats(await stopTransient<BeatObservation | null>(page, BEAT_KEY), ORIGIN.get(page));
  return {...analyseBeats(trail), errors};
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
    // `readTransient` flushes the reader first, so the recording's last sample IS the state now.
    last = foldBeats(await readTransient<BeatObservation | null>(page, BEAT_KEY), ORIGIN.get(page)).trail.at(-1);
    const over = last !== undefined && names.every((n) => (last?.vis[n] ?? 0) >= 0.95 || (!(last?.anim[n] ?? false) && !(last?.held?.[n] ?? false)));
    if (over || Date.now() > deadline) {
      return {settled: over, last};
    }
    // A state read paced by the page's own timer (never a `waitForTimeout` — a duration standing in for a state).
    await page.evaluate(() => new Promise<void>((resolve) => window.setTimeout(resolve, 40)));
  }
}
