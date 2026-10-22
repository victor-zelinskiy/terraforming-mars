/*
 * THE COMMIT ARRIVES (T14 «ПРИБЫТИЕ НА КОММИТ», ledger CC — `docs/claude/console/composer-preselect.md`).
 *
 * The DOM half of the pure window in `consoleCommitGate.ts` (`CommitArrival` / `commitPressAbsorbed`), one record per
 * composer instance (Options-API `data()` friendly, the `cursorArrival.ts` idiom). When the ONE cursor rule lands the
 * cursor on the commit row because nothing is left to ask (`nextCursorAfterAnswer` → `commit`), the composer calls
 * `arriveAtCommit`; from then on:
 *
 *   · the arrival is PAINTED only when the commit's pose can paint — the composer's root (or the band around it) may
 *     still wear `[data-cursor-pending]` (an entry, a late preview's cascade), and a pose under that gate stands at
 *     rest; the record watches that attribute leave (a `MutationObserver` — the gate's own release is the signal, never
 *     a timer) and stamps `paintedAt` one probe tick later;
 *   · a deciding press before the paint, inside the ring's own clock after it, or — on an open whose every answer was
 *     seeded — inside the decision family's first settle, is the ARRIVAL, not the move (`commitArrivalAbsorbs`);
 *   · on the paint the commit row takes ONE breath («взведено» — `armed`, bound to `data-composer-armed`): the ring
 *     layer inhales once (`console.less` § THE COMMIT ARRIVES), never a loop; reduced motion breathes nothing and keeps
 *     the inertia gate.
 *
 * The harness reads the window it must wait out before a deciding press (`commitArrivalDiag` → `__conCommitArrival`
 * on the window — the e2e driver's `awaitDecisionSettled`): a driver press the player could not have made inside it
 * would be absorbed by design.
 */

import {nextTick, reactive} from 'vue';
import {CommitArrival, COMMIT_ARRIVAL_ABSORB_MS, commitPressAbsorbed} from '@/client/console/consoleCommitGate';
import {SETTLE_FIRST_MS} from '@/client/console/promptSequence';
import {probeTick} from '@/client/console/probeTick';
import {CURSOR_PENDING_MAX_MS} from '@/client/console/cursorArrival';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';

export type CommitArrivalRecord = {
  /** The arrival in force — `undefined` when the cursor WALKED onto the commit row (or stands elsewhere). */
  arrival: CommitArrival | undefined;
  /** The one breath of «взведено» — the commit row's `data-composer-armed` while true. */
  armed: boolean;
  /** Bumped by every arrival: a late paint / breath of an earlier one does nothing. */
  seq: number;
  /** The surface's name, for the diag. */
  label: string;
};

type Watch = {observer?: MutationObserver, backstop?: ReturnType<typeof setTimeout>};
const watches = new WeakMap<object, Watch>();
const live = new Set<CommitArrivalRecord>();

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function watchOf(r: CommitArrivalRecord): Watch {
  let w = watches.get(r);
  if (w === undefined) {
    w = {};
    watches.set(r, w);
  }
  return w;
}

function disconnect(r: CommitArrivalRecord): void {
  const w = watchOf(r);
  w.observer?.disconnect();
  w.observer = undefined;
  if (w.backstop !== undefined) {
    clearTimeout(w.backstop);
    w.backstop = undefined;
  }
}

export function createCommitArrival(label: string): CommitArrivalRecord {
  return reactive({arrival: undefined, armed: false, seq: 0, label}) as CommitArrivalRecord;
}

/** The pose can paint now: stamp it and take the breath (one probe tick later — the frame that shows it). */
function paint(r: CommitArrivalRecord, seq: number): void {
  probeTick(() => {
    if (r.seq !== seq || r.arrival === undefined) {
      return;
    }
    r.arrival = {...r.arrival, paintedAt: now()};
    r.armed = !consoleReducedMotionActive();
  });
}

/**
 * The cursor landed on the commit row BY THE RULE (nothing left to ask). `root` resolves the composer's own root — the
 * arrival gate, when one stands, is on it or on an ancestor, and it is read AFTER the patch this landing rides (a late
 * preview's gate is bound on the root BY that patch; an open runs before the first render). `opening`: the screen
 * opened with nothing to ask (every answer seeded) — the A that opened it must not be the A that commits, so the
 * decision family's first settle is a floor under the window. A gate that never lets go (an element gone with its
 * attribute on) is bounded by the cursor's own backstop (`CURSOR_PENDING_MAX_MS`) — a press is never absorbed forever.
 */
export function arriveAtCommit(r: CommitArrivalRecord, root: () => HTMLElement | null | undefined, opts: {opening: boolean}): void {
  disconnect(r);
  r.seq++;
  const seq = r.seq;
  const at = now();
  r.armed = false;
  r.arrival = {at, paintedAt: undefined, settleUntil: opts.opening ? at + SETTLE_FIRST_MS : 0};
  live.add(r);
  void nextTick(() => {
    if (r.seq !== seq || r.arrival === undefined) {
      return;
    }
    const gate = root()?.closest<HTMLElement>('[data-cursor-pending]') ?? null;
    if (gate === null || typeof MutationObserver === 'undefined') {
      paint(r, seq);
      return;
    }
    const observer = new MutationObserver(() => {
      if (!gate.hasAttribute('data-cursor-pending') || !gate.isConnected) {
        disconnect(r);
        paint(r, seq);
      }
    });
    const w = watchOf(r);
    w.observer = observer;
    w.backstop = setTimeout(() => {
      if (r.seq === seq && r.arrival?.paintedAt === undefined) {
        disconnect(r);
        paint(r, seq);
      }
    }, CURSOR_PENDING_MAX_MS);
    observer.observe(gate, {attributes: true, attributeFilter: ['data-cursor-pending']});
  });
}

/** The cursor left the commit row, the press went, or the surface goes: no arrival, no breath. */
export function leaveCommit(r: CommitArrivalRecord): void {
  disconnect(r);
  r.seq++;
  r.arrival = undefined;
  r.armed = false;
  live.delete(r);
}

/** The breath ended (`animationend` on the commit row's layer) — the attribute goes, the paint stays. */
export function endCommitBreath(r: CommitArrivalRecord): void {
  r.armed = false;
}

/** Is a deciding press on the commit row, now, still the arrival (absorbed) rather than the move? */
export function commitArrivalAbsorbs(r: CommitArrivalRecord): boolean {
  return commitPressAbsorbed(r.arrival, now());
}

/** The probe's read: how long a deciding press on a commit row would still be absorbed (0 = never; unpainted = a beat). */
export function commitArrivalDiag(): {leftMs: number, armed: boolean} {
  const t = now();
  let left = 0;
  let armed = false;
  for (const r of live) {
    const a = r.arrival;
    if (a === undefined) {
      continue;
    }
    armed = armed || r.armed;
    const paintLeft = a.paintedAt === undefined ? COMMIT_ARRIVAL_ABSORB_MS : a.paintedAt + COMMIT_ARRIVAL_ABSORB_MS - t;
    left = Math.max(left, paintLeft, a.settleUntil - t);
  }
  return {leftMs: Math.max(0, Math.ceil(left)), armed};
}
if (typeof window !== 'undefined') {
  (window as unknown as {__conCommitArrival?: typeof commitArrivalDiag}).__conCommitArrival = commitArrivalDiag;
}
