/*
 * THE BOTTLE'S ONE CLOCK (FREEZE ZERO · B3, the spike) — every source of time the page AND the server read, moved by
 * hand.
 *
 * ⚠️ THIS MODULE STANDS BEFORE THE PAGE IS EVALUATED. One source is captured by a library at ITS module load and can
 * only be reached by an indirection that stood before it: GSAP's ticker takes `Date.now` once (`var _getTime =
 * Date.now` — `gsap-core.js`), so `Date.now` is replaced HERE, at load, by a function that reads the real clock until
 * a bottle takes it over. Outside a bottle every reader gets the wall clock exactly as before. (The page's modules —
 * GSAP among them — are evaluated anew for every bottle, after this module: `consoleBottle.ts` § a pristine page.)
 *
 * WHAT A BOTTLE TAKES OVER (`takeTime` … the returned `giveBack`):
 *   · the globals `setTimeout` / `setInterval` / `requestAnimationFrame` (+ their cancels, on `globalThis` and on the
 *     jsdom `window`) — Vue's `<Transition>`, VueUse, GSAP's ticker loop, and the SERVER's own timers (the same
 *     process: `BotTurnScheduler`'s paced turns);
 *   · `Date.now()`, `new Date()`, `performance.now()` — the supervisor, the transport's ages, GSAP's ticker time, the
 *     server's `Clock`;
 *   · and the object itself IS a `FlowClock`: the page installs it as the flow kernel's clock (`setFlowClock` — every
 *     owned wait, bound, tick and machine `after` of the client).
 * What it does NOT take: `setImmediate` (the bottle's own «let every microtask run» step), mocha's timers (captured by
 * mocha at its load), anything a native API keeps (there is none under jsdom).
 *
 * THE EVENT LOOP IT MODELS: one TASK at a time — the earliest timer, or a FRAME (every queued `requestAnimationFrame`
 * callback, at the next 16 ms boundary) — and after each task EVERY microtask (a promise chain, Vue's scheduler flush,
 * a request answered by the in-process server) before the next task: what a browser does, with no wall time between.
 */
import type {FlowClock} from '@/client/console/kernel/flowClock';

const RealDate = Date;
const realNow = RealDate.now.bind(RealDate);
let nowSource: () => number = realNow;
// The indirection GSAP (and any other load-time capture) holds.
RealDate.now = () => nowSource();

type Globals = Record<string, unknown>;
const globals = globalThis as unknown as Globals;
const realSetImmediate = globals.setImmediate as (fn: () => void) => unknown;

/** One frame of the bottle (the kernel's manual clock uses the same 16 ms). */
export const BOTTLE_FRAME_MS = 16;

type Timer = {at: number, fn: () => void, order: number, every?: number};

export type BottleClock = FlowClock & {
  /** Move the world by `ms`: every task due inside the span runs in due order, the microtasks drained after each. */
  advance(ms: number): Promise<void>,
  /** Let every pending microtask run (no time passes). */
  drain(): Promise<void>,
  /** Timers armed + frame callbacks queued. */
  pending(): number,
  /** When the next task is due (`undefined` = nothing armed) — a walk that waits «until something can happen». */
  nextDue(): number | undefined,
  /** Tasks run since the bottle was booted (a throughput / determinism fact). */
  tasksRun(): number,
  /** What a task threw (a timer callback's exception is a page error, never the bottle's own). */
  errors: Array<unknown>,
  /** Put every global back. */
  giveBack(): void,
};

export function takeTime(start: number): BottleClock {
  let now = start;
  let nextId = 1;
  let tasks = 0;
  const timers = new Map<number, Timer>();
  let frames = new Map<number, (t: number) => void>();
  const errors: Array<unknown> = [];

  const drain = (): Promise<void> => new Promise((resolve) => realSetImmediate(resolve));

  const arm = (fn: () => void, ms: number, every?: number): number => {
    const id = nextId++;
    timers.set(id, {at: now + Math.max(0, Number(ms) || 0), fn, order: id, every});
    return id;
  };
  const nextFrameAt = (): number => (Math.floor(now / BOTTLE_FRAME_MS) + 1) * BOTTLE_FRAME_MS;
  const requestFrame = (fn: (t: number) => void): number => {
    const id = nextId++;
    frames.set(id, fn);
    return id;
  };
  const run = (fn: () => void): void => {
    tasks++;
    try {
      fn();
    } catch (error) {
      errors.push(error);
      // What the page would see: an uncaught error in a task (the product's interceptor listens for it).
      const report = (globals.window as {dispatchEvent?: (e: unknown) => void, ErrorEvent?: new (type: string, init: object) => unknown} | undefined);
      if (report?.dispatchEvent !== undefined && report.ErrorEvent !== undefined) {
        report.dispatchEvent(new report.ErrorEvent('error', {error, message: error instanceof Error ? error.message : String(error)}));
      }
    }
  };
  const nextDue = (): number | undefined => {
    let due: number | undefined;
    for (const t of timers.values()) {
      if (due === undefined || t.at < due) {
        due = t.at;
      }
    }
    if (frames.size > 0) {
      const frameAt = nextFrameAt();
      if (due === undefined || frameAt < due) {
        due = frameAt;
      }
    }
    return due;
  };

  const clock: BottleClock = {
    now: () => now,
    setTimeout: (fn, ms) => arm(fn, ms),
    clearTimeout: (handle) => {
      timers.delete(handle as number);
    },
    nextFrame: (fn) => {
      const id = requestFrame(() => fn());
      return () => {
        frames.delete(id);
      };
    },
    drain,
    pending: () => timers.size + frames.size,
    nextDue,
    tasksRun: () => tasks,
    errors,
    advance: async (ms) => {
      const until = now + Math.max(0, ms);
      await drain();
      for (;;) {
        // The earliest timer (ties by arming order)…
        let timerId: number | undefined;
        let timer: Timer | undefined;
        for (const [id, t] of timers) {
          if (timer === undefined || t.at < timer.at || (t.at === timer.at && t.order < timer.order)) {
            timer = t;
            timerId = id;
          }
        }
        // …or the frame, whichever comes first (a frame at the same instant paints after the timers due at it).
        const frameAt = frames.size > 0 ? nextFrameAt() : undefined;
        if (timer !== undefined && timerId !== undefined && timer.at <= until && (frameAt === undefined || timer.at <= frameAt)) {
          now = Math.max(now, timer.at);
          if (timer.every !== undefined) {
            timer.at = now + timer.every;
            timer.order = nextId++;
          } else {
            timers.delete(timerId);
          }
          run(timer.fn);
        } else if (frameAt !== undefined && frameAt <= until) {
          now = frameAt;
          const due = frames;
          frames = new Map();
          const stamp = now;
          for (const fn of due.values()) {
            run(() => fn(stamp));
          }
        } else {
          break;
        }
        await drain();
      }
      now = until;
      await drain();
    },
    giveBack: () => {},
  };

  // ── the takeover ──
  const saved: Array<() => void> = [];
  const replace = (host: Globals | undefined, key: string, value: unknown): void => {
    if (host === undefined) {
      return;
    }
    const had = Object.prototype.hasOwnProperty.call(host, key);
    const descriptor = Object.getOwnPropertyDescriptor(host, key);
    Object.defineProperty(host, key, {value, configurable: true, writable: true, enumerable: descriptor?.enumerable ?? true});
    saved.push(() => {
      if (had && descriptor !== undefined) {
        Object.defineProperty(host, key, descriptor);
      } else {
        delete host[key];
      }
    });
  };
  const win = globals.window as Globals | undefined;
  const timersApi: Record<string, unknown> = {
    setTimeout: (fn: (...args: Array<unknown>) => void, ms?: number, ...args: Array<unknown>) => arm(() => fn(...args), ms ?? 0),
    clearTimeout: (id: unknown) => {
      timers.delete(id as number);
    },
    setInterval: (fn: (...args: Array<unknown>) => void, ms?: number, ...args: Array<unknown>) => arm(() => fn(...args), ms ?? 0, Math.max(1, ms ?? 0)),
    clearInterval: (id: unknown) => {
      timers.delete(id as number);
    },
    requestAnimationFrame: (fn: (t: number) => void) => requestFrame(fn),
    cancelAnimationFrame: (id: unknown) => {
      frames.delete(id as number);
    },
  };
  for (const [key, value] of Object.entries(timersApi)) {
    replace(globals, key, value);
    replace(win, key, value);
  }
  class BottleDate extends RealDate {
    constructor(...args: Array<unknown>) {
      if (args.length === 0) {
        super(now);
      } else {
        super(...(args as [number]));
      }
    }
    static override now(): number {
      return now;
    }
  }
  replace(globals, 'Date', BottleDate);
  nowSource = () => now;
  const perf = globals.performance as Globals | undefined;
  replace(perf, 'now', () => now - start);

  clock.giveBack = () => {
    nowSource = realNow;
    for (const restore of saved.reverse()) {
      restore();
    }
    saved.length = 0;
    timers.clear();
    frames.clear();
  };
  return clock;
}
