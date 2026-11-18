/*
 * @console-shared LIVE — the flow kernel (docs/claude/console/architecture-v2/KERNEL.md).
 *
 * THE FRAME WITNESS — «how much MOTION TIME did the page give while this motion was owed?» (FREEZE ZERO, second
 * phase, stage 1 — docs/claude/console/freeze-zero/PLAN.md § 8: every bound is measured on the clock of the thing
 * it bounds).
 *
 * A bound over a MOTION is kept in WALL time — a token «touches down within 1.8 s», a hold «is released within 4 s».
 * The motion itself advances on GSAP's clock, and that clock is not the wall's: a gap between two frames longer than
 * 500 ms is booked as 33 ms (`lagSmoothing(500, 33)` — the project keeps GSAP's default, `gsapMotionBridge.ts`). So a
 * page that stalls — a window behind another (measured on the box, 2026-11-17: the tab that is not in front freezes
 * for a second out of every two), a hidden tab, a renderer starved to a slide show — gives a 600 ms flight a
 * fraction of the wall time its bound counts, the bound runs out, and the wait ends on its ceiling (as designed: the
 * state is applied, the beat resolves). Until this module that ceiling's line was a DEFECT — an event of the quota,
 * a red on a walk — for a page that was simply not painting. The box monkey's duo pass named eight tables this way:
 * always the page that was NOT in front, never the other one.
 *
 * So a motion's ceiling asks the witness how much motion time the page gave while the wait stood — counted the way
 * GSAP counts it. Less than `STARVED_SHARE` of the wall time (over at least `STARVED_MIN_MS`) is «the page did not
 * give the motion its time»: the ceiling's honest end, said with its reason (tier `planned` — counted, never an
 * event). A page that painted and still missed its bound is the defect it always was.
 *
 * COSTS NOTHING ON A QUIET SECOND: the loop runs only while somebody watches (a motion's ceiling wait, a hold) — and
 * those stand only while a motion is owed, when the page paints anyway.
 */
import {FlowClock, flowClock} from '@/client/console/kernel/flowClock';

/** GSAP's own lag smoothing (its default, kept by the project): a frame gap over the threshold is booked as this much. */
export const LAG_THRESHOLD_MS = 500;
export const LAG_BOOKED_MS = 33;
/** The page gave the motion less than this share of the wall time: it was not painting. */
export const STARVED_SHARE = 0.75;
/** …judged only over a watch at least this long: a wait that ended at once says nothing about the page. */
export const STARVED_MIN_MS = 500;
/**
 * …AND NEVER OF A MOTION THE PAGE GAVE THIS MUCH TIME. The share alone excuses too much over a long watch: a 35 s hold
 * with one nine-second alt-tab reads «the page gave 26 of 35 s» = under three quarters = starved — and a real leak
 * was counted as an honest end (the tier audit of 2026-11-18, row 4). No motion of this game needs twenty seconds of
 * painted time (every flow's own safety is below it — the foreground watchdog's `ANIMATION_STALL_GRACE_MS`): a page
 * that gave that much has given the motion its time, whatever it did not paint beside it.
 */
export const STARVED_ENOUGH_MS = 20_000;

export type FrameWatch = {
  /** Motion time the page gave since the watch began — frame gaps booked the way GSAP books them. */
  motionMs(): number,
  /** How long the watch has stood, on the kernel's clock (wall time). */
  elapsedMs(): number,
  /** Frame gaps over the lag threshold inside the watch. */
  stalls(): number,
  /** WHY the page could not have kept a motion's bound in this watch — or `undefined` (it painted; or too short to say). */
  starved(): string | undefined,
  stop(): void,
};

/** Motion time and stalls booked by the frames painted so far (while anybody watched). */
let motion = 0;
let stalled = 0;
/** When the last frame came (the kernel's clock). */
let lastFrameAt = 0;
let watchers = 0;
let cancelNext: (() => void) | undefined;
let scheduledOn: FlowClock | undefined;

function booked(gap: number): number {
  return gap > LAG_THRESHOLD_MS ? LAG_BOOKED_MS : Math.max(0, gap);
}

function schedule(): void {
  const clock = flowClock();
  scheduledOn = clock;
  cancelNext = clock.nextFrame(() => {
    const now = clock.now();
    const gap = now - lastFrameAt;
    motion += booked(gap);
    if (gap > LAG_THRESHOLD_MS) {
      stalled++;
    }
    lastFrameAt = now;
    cancelNext = undefined;
    if (watchers > 0) {
      schedule();
    }
  });
}

/** PURE: why a page that gave `motionMs` of `elapsedMs` could not keep a motion's bound — or `undefined`. */
export function starvedReason(motionMs: number, elapsedMs: number, stalls: number): string | undefined {
  if (elapsedMs < STARVED_MIN_MS || motionMs >= STARVED_SHARE * elapsedMs || motionMs >= STARVED_ENOUGH_MS) {
    return undefined;
  }
  // (No parenthesis in the reason: it is printed inside the line's own `(planned: …)`.)
  return `the page gave the motion ${Math.round(motionMs)} of ${Math.round(elapsedMs)} ms, ${stalls} frame gap${stalls === 1 ? '' : 's'} over ${LAG_THRESHOLD_MS} ms — ` +
    'a motion cannot keep its bound on a page that does not paint';
}

/** Watch the page's frames from now until `stop()`. */
export function watchFrames(): FrameWatch {
  const clock = flowClock();
  const since = clock.now();
  // (A frame asked of a clock that is no longer the kernel's — a spec swapped it — never comes: ask again. A loop
  // that was asleep starts its first gap HERE: the time nobody watched is nobody's stall.)
  if (cancelNext === undefined || scheduledOn !== clock) {
    cancelNext?.();
    lastFrameAt = since;
    schedule();
  }
  watchers++;
  const baseMotion = motion;
  const baseStalls = stalled;
  const baseFrameAt = lastFrameAt;
  let open = true;
  const elapsedMs = (): number => flowClock().now() - since;
  // The gap still OPEN (no frame since `lastFrameAt`) is booked as it stands — a page that never paints again is one
  // long stall; and the part of the first gap that came BEFORE the watch is not the watch's.
  const openGap = (): number => flowClock().now() - lastFrameAt;
  const motionMs = (): number => Math.max(0, motion - baseMotion - Math.min(booked(since - baseFrameAt), motion - baseMotion) + booked(openGap()));
  const stalls = (): number => stalled - baseStalls + (openGap() > LAG_THRESHOLD_MS ? 1 : 0);
  return {
    motionMs,
    elapsedMs,
    stalls,
    starved: () => starvedReason(motionMs(), elapsedMs(), stalls()),
    stop: () => {
      if (!open) {
        return;
      }
      open = false;
      watchers = Math.max(0, watchers - 1);
      if (watchers === 0 && cancelNext !== undefined) {
        cancelNext();
        cancelNext = undefined;
      }
    },
  };
}

/*
 * ── THE PAGE'S OWN PAINT, STANDING — a state every judge of the screen knows ────────────────────────────────────────
 *
 * A watch above answers «could THIS motion have kept its bound?». The judges that look at the whole screen once a
 * second — the wait graph («a press cannot come»), the feed's starvation escape («a hold leaked») — ask something
 * wider: IS THE PAGE PAINTING AT ALL? A page behind another window, a hidden tab, a starved compositor paints a frame
 * a second or none: no motion ends there, no transition finishes, and no press comes — the player is at another
 * window. Nothing on such a page is dead and nothing leaked; it is WAITING TO BE LOOKED AT (stage 1 of the second
 * phase, PLAN § 8 — «a hidden / starved page is a state the judges know»; named by CI's two-window pass, 2026-11-18:
 * six classes of seven were judges reading a page nobody was looking at).
 *
 * One standing watch while a game screen stands, rolled at every look of the supervisor (`notePageLook`): the page is
 * STARVED when the look that just ended was (or the one in progress already is) — the same arithmetic as every
 * watch, on the same clock.
 */
let standing: FrameWatch | undefined;
let lastLook: string | undefined;

/** The game screen stands: the page's paint is witnessed from now. Returns the stop (idempotent). */
export function standPagePaintWitness(): () => void {
  standing?.stop();
  standing = watchFrames();
  lastLook = undefined;
  const mine = standing;
  return () => {
    mine.stop();
    if (standing === mine) {
      standing = undefined;
      lastLook = undefined;
    }
  };
}

/** A look of the supervisor: the window that just ended is judged and remembered, the next one begins. */
export function notePageLook(): void {
  if (standing === undefined) {
    return;
  }
  lastLook = standing.starved();
  standing.stop();
  standing = watchFrames();
}

/**
 * WHY THE PAGE IS NOT PAINTING, right now — or `undefined` (it paints; or nobody is witnessing). True of the look in
 * progress as soon as it can be said, of the look before it otherwise.
 */
export function pageStarvedNow(): string | undefined {
  return standing === undefined ? undefined : standing.starved() ?? lastLook;
}

/** Tests only. */
export function __resetFrameWitnessForTesting(): void {
  standing = undefined;
  lastLook = undefined;
  cancelNext?.();
  cancelNext = undefined;
  scheduledOn = undefined;
  watchers = 0;
  motion = 0;
  stalled = 0;
  lastFrameAt = 0;
}
