/*
 * THE CURSOR ARRIVES — it never appears (TR58 «КУРСОР — ОДИН ЖИВОЙ ОБЪЕКТ»; `.claude/rules/console-ui.md`
 * § THE CURSOR IS ONE LIVING OBJECT).
 *
 * A surface that opens places its default focus at once — the cursor is LOGICALLY there from the first frame: the
 * pad routes to it, the bar reads its verbs, the first press steps from it. What it may not do is PAINT there before
 * the surface is ready: the hand's album was mounted with its first card already in the focus pose (ring, halo, lift)
 * under the flying copies and revealed with them in ONE frame — the owner's «фокус появляется одним кадром».
 *
 * So the pose has a GATE (`[data-cursor-pending]` on the surface root → `--con-cursor-gate: 0`, `.con-cursor()` in
 * console.less): while it stands, the focused element sits at REST; when the surface reaches its own ready signal
 * (the hand: the frame after the copies hand over; a band surface: its entry settled; a stage row: its last
 * touchdown) it calls `arrive`, and the gate lets go on the NEXT painted frame — the same transition that carries a
 * step then carries the arrival (ring 0 → full, the lift, one clock).
 *
 * Three rules keep it honest:
 *  · INPUT IS NEVER DELAYED — a step during the pending window (`release`) lets the gate go at once: the step is the
 *    arrival, there is nothing to wait for;
 *  · NO TIMER STANDS FOR A SIGNAL — `arrive` is called by the surface's own ready edge; the only clock here is the
 *    one painted frame between that edge and the release (`probeTick`, never a bare rAF — a quiet compositor
 *    withholds frames), plus a bounded backstop so a surface whose ready edge never comes cannot keep its cursor
 *    invisible (`CURSOR_PENDING_MAX_MS`, named in a dev warn);
 *  · REDUCED MOTION HAS NO GATE — the cursor simply stands.
 * A reactive record per surface instance (Options API `data()` friendly); pure besides `probeTick` / the timer.
 */

import {reactive} from 'vue';
import {probeTick} from '@/client/console/probeTick';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';

/** The longest a cursor may stay unposed waiting for its surface's ready edge. */
export const CURSOR_PENDING_MAX_MS = 4000;

export type CursorArrival = {
  /** The pose is gated — bind `data-cursor-pending` on the surface root while true. */
  pending: boolean;
  /** Bumped on every hold — a stale `arrive` / backstop of an earlier hold does nothing. */
  epoch: number;
  /** A ready signal was given (the release is scheduled for the next painted frame). */
  arriving: boolean;
  /** The surface's name, for the backstop's warn. */
  label: string;
};

type Timers = {backstop?: ReturnType<typeof setTimeout>};
const timers = new WeakMap<object, Timers>();

function timersOf(a: CursorArrival): Timers {
  let t = timers.get(a);
  if (t === undefined) {
    t = {};
    timers.set(a, t);
  }
  return t;
}

export function createCursorArrival(label: string): CursorArrival {
  return reactive({pending: false, epoch: 0, arriving: false, label}) as CursorArrival;
}

/** The attribute value for the surface root: `''` while the cursor is held back, else absent. */
export function cursorPendingAttr(a: CursorArrival | undefined): '' | undefined {
  return a?.pending === true ? '' : undefined;
}

/**
 * HOLD the pose: the surface is not ready (it mounts under copies, behind a fade, mid-entry). Idempotent; reduced
 * motion never holds.
 */
export function holdCursor(a: CursorArrival): void {
  if (consoleReducedMotionActive()) {
    a.pending = false;
    return;
  }
  a.epoch++;
  a.arriving = false;
  a.pending = true;
  const t = timersOf(a);
  if (t.backstop !== undefined) {
    clearTimeout(t.backstop);
  }
  const epoch = a.epoch;
  t.backstop = setTimeout(() => {
    if (a.epoch === epoch && a.pending) {
      if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
        console.warn(`[cursor] «${a.label}» never signalled ready in ${CURSOR_PENDING_MAX_MS} ms — the cursor arrives by the backstop`);
      }
      releaseCursor(a);
    }
  }, CURSOR_PENDING_MAX_MS);
}

/**
 * The surface is READY: the cursor arrives on the next painted frame (the frame that shows the ready surface is never
 * the frame the ring starts in — «не раньше кадра после передачи»).
 */
export function arriveCursor(a: CursorArrival): void {
  if (!a.pending || a.arriving) {
    return;
  }
  a.arriving = true;
  const epoch = a.epoch;
  probeTick(() => {
    if (a.epoch === epoch) {
      releaseCursor(a);
    }
  });
}

/** Let the gate go NOW — a press during the pending window, a teardown. */
export function releaseCursor(a: CursorArrival): void {
  const t = timersOf(a);
  if (t.backstop !== undefined) {
    clearTimeout(t.backstop);
    t.backstop = undefined;
  }
  a.arriving = false;
  a.pending = false;
}

/*
 * THE BAND SURFACE'S ENTRANCE IS ITS READY SIGNAL — the DOM half, for every surface the surface-motion director
 * opens («Действия карт», «Стандартные проекты», the composers, the sheets, the colonies' section, …). A surface that
 * materializes from opacity 0 with its default cursor already posed reveals the ring WITH the frame — the hand's
 * defect in a softer form. The director marks the root `data-cursor-pending="entry"` when a real entrance starts
 * (never for a pick-bridge re-show or a headless / drawn variant) and lets it go one painted frame after the
 * entrance is done: the cursor then arrives on the very transition a step uses. One call site, every surface.
 */
const ENTRY = 'entry';

/** Gate the cursor for an entrance; returns the entrance's `done` wrapped to release the gate after it. */
export function gateCursorDuringEntry(el: HTMLElement, done: () => void): () => void {
  if (consoleReducedMotionActive()) {
    return done;
  }
  el.setAttribute('data-cursor-pending', ENTRY);
  let released = false;
  const release = () => {
    if (!released) {
      released = true;
      clearTimeout(backstop);
      if (el.getAttribute('data-cursor-pending') === ENTRY) {
        el.removeAttribute('data-cursor-pending');
      }
    }
  };
  const backstop = setTimeout(release, CURSOR_PENDING_MAX_MS);
  return () => {
    done();
    probeTick(release);
  };
}

/**
 * Gate the cursor of `root` until every FINITE animation running in it has finished — an entrance stagger, a deal-in:
 * the animations' own completion is the ready signal, never a duration guessed beside them. Nothing running → no gate.
 * A press releases it like any entrance gate.
 */
export function gateCursorUntilAnimationsEnd(root: HTMLElement): void {
  if (consoleReducedMotionActive() || typeof root.getAnimations !== 'function') {
    return;
  }
  const running = root.getAnimations({subtree: true}).filter((a) => {
    const timing = a.effect?.getComputedTiming();
    return a.playState !== 'finished' && a.playState !== 'idle' && timing !== undefined && timing.iterations !== Infinity;
  });
  if (running.length === 0) {
    return;
  }
  root.setAttribute('data-cursor-pending', ENTRY);
  let released = false;
  const release = () => {
    if (!released) {
      released = true;
      clearTimeout(backstop);
      releaseEntryCursorGate(root);
    }
  };
  const backstop = setTimeout(release, CURSOR_PENDING_MAX_MS);
  void Promise.allSettled(running.map((a) => a.finished)).then(() => probeTick(release));
}

/** An entrance that never finished (cancelled by a leave) lets its gate go with it. */
export function releaseEntryCursorGate(el: HTMLElement): void {
  if (el.getAttribute('data-cursor-pending') === ENTRY) {
    el.removeAttribute('data-cursor-pending');
  }
}

/** Every live arrival record (a press releases them all — see `releaseCursorsOnInput`). */
const liveArrivals = new Set<CursorArrival>();

/** Register a record for the input release (a surface instance's own `createCursorArrival`). */
export function trackCursorArrival(a: CursorArrival): () => void {
  liveArrivals.add(a);
  return () => {
    liveArrivals.delete(a);
  };
}

/**
 * A PRESS DURING AN ARRIVAL IS THE ARRIVAL — the console's input observer calls this on every navigation / button
 * intent (`cursorArrivalInput.ts`): the entrance gates and the tracked records let go now, so the step lands on a
 * posed cursor and input never waits for a ring to finish arriving.
 */
export function releaseCursorsOnInput(): void {
  if (typeof document !== 'undefined') {
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(`[data-cursor-pending="${ENTRY}"]`))) {
      el.removeAttribute('data-cursor-pending');
    }
  }
  for (const a of liveArrivals) {
    if (a.pending && a.arriving) {
      releaseCursor(a);
    }
  }
}
