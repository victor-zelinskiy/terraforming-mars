/**
 * THE TOP-BAR PLAYER-CHIP CONVEYOR — the generation-order reorder animation
 * of the status strip's player chips (ConsoleStatusStrip).
 *
 * CONCEPT. Turn order is a CYCLE, and the chip row is a WINDOW ONTO THAT
 * RING starting at the first player. When the server rotates
 * `playersInGenerationOrder` (a new generation: `[A,B,C,D] → [B,C,D,A]`),
 * the whole ribbon glides sideways by exactly the vacated slot: every
 * surviving chip slides one slot in lockstep, while the wrapped chip
 * leaves through the row's near edge and — the same object, one ring
 * position on — enters through the far edge into the space the last chip
 * vacates. One shared vector, one duration, one easing: chips never
 * overlap by construction (a rigid belt keeps every gap constant), and
 * the visible "mass" of the wrapping chip is conserved — it erodes at one
 * edge exactly as fast as it grows at the other.
 *
 * ⚠ ONE DRIVER, BY CONSTRUCTION. The belt is a single WAAPI transform on
 * the RIBBON wrapper (`.con-status__ribbon`) — never one animation per
 * chip. Per-element animations start on the compositor at measurably
 * different times (fresh nodes and standing nodes were observed to skew
 * BOTH ways by 90-350 ms on a loaded generation-flip frame), and any skew
 * between the pieces of a rigid belt reads as the ribbon tearing. On the
 * one driver ride: every chip (the entering one included — its start pose
 * one belt-vector out past the far edge is just where the new layout
 * stands before the ribbon lands) and the exit ghost, parented into the
 * ribbon. What stays per-element:
 *  - RESIDUAL corrections for survivors whose own FLIP delta differs from
 *    the belt vector (simultaneous status-swap width changes; usually 0
 *    thanks to the pill's width floor) — small, composite:'add';
 *  - the ghost's OPACITY ramp, started only at the ribbon animation's own
 *    `ready` (a fade that runs while the belt is still pending dissolves
 *    the ghost in place — the observed inverse tear).
 *
 * MECHANICS (FLIP, measured around the Vue patch): `beforePatch`
 * (component `beforeUpdate`, DOM still pre-patch) detects a pure rotation
 * of the on-screen order, measures every chip's VISUAL rect (live
 * transforms included — a retarget starts from where the eye is) and
 * clones the wrapping chips (their content is about to change with the
 * new statuses; the exit ghost must carry the OLD frame). `afterPatch`
 * (component `updated`, same task — nothing intermediate is ever painted)
 * measures the new natural rects and poses the belt. `fill:'none'`
 * everywhere guarantees zero residue; the ghost holds `'forwards'` until
 * removal. During the run the container carries
 * `con-status__players--conveyor`: a net-zero box extension + a soft
 * horizontal mask, so the ring's edges dissolve chips instead of
 * guillotining them (console.less).
 *
 * INVARIANTS: decorative only (no holds, nothing waits on it); identity
 * by player color (the chips' own `:key`); a non-rotation change, reduced
 * motion, or a missing WAAPI snap instantly; re-delivery of the same
 * order triggers nothing; a second reorder mid-flight retargets from the
 * current visual positions.
 */
import {MOTION_EASE} from '@/client/components/motion/motionTokens';
import {consoleMotionMs, consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';

/** Base glide duration (ms) — scaled by the motion preset / reduced cap. */
export const CONVEYOR_MS = 560;

const CHIP_SELECTOR = '.con-status__player[data-color]';
const RIBBON_SELECTOR = '.con-status__ribbon';
const CONVEYOR_CLASS = 'con-status__players--conveyor';
const GHOST_CLASS = 'con-status__pghost';

/** Sub-pixel FLIP noise below this is not worth a residual animation. */
const RESIDUAL_MIN_PX = 0.75;

/** The ghost's temporal fade — spatially the mask does the eroding; this
 *  ramp only guarantees the trailing sliver is gone at rest (the belt
 *  parks the ghost's tail inside the edge fade band by geometry). It
 *  starts from the CHIP'S OWN resting opacity — a passed player's chip
 *  rests at 0.45, and a ramp hardcoded from 1 visibly FLASHED the ghost
 *  to full brightness the moment it began. It also fires LATE: the
 *  ghost's trailing edge only exits at ≈ width/(width+gap) of the travel,
 *  so an earlier ramp double-fades a body the mask is still honestly
 *  eroding (slow-motion showed the left side emptying by dissolve rather
 *  than by exit — the conservation-of-mass reading is the whole point). */
function ghostFade(baseOpacity: number): Array<{opacity: number, offset: number}> {
  return [
    {opacity: baseOpacity, offset: 0},
    {opacity: baseOpacity, offset: 0.58},
    {opacity: 0, offset: 0.95},
    {opacity: 0, offset: 1},
  ];
}

/**
 * Is `next` a pure left-rotation of `prev`? Returns the shift k
 * (`next[i] === prev[(i+k) % n]`, 0 < k < n), or undefined for anything
 * else — same order, different sets, duplicates, length change. A server
 * right-rotation (undo across a generation) is a left-rotation of `n-k`
 * and lands here too; direction is chosen at run time.
 */
export function rotationShift(prev: ReadonlyArray<string>, next: ReadonlyArray<string>): number | undefined {
  const n = prev.length;
  if (n < 2 || next.length !== n) {
    return undefined;
  }
  const k = prev.indexOf(next[0]);
  if (k <= 0) {
    return undefined;
  }
  for (let i = 0; i < n; i++) {
    if (prev[(k + i) % n] !== next[i]) {
      return undefined;
    }
  }
  return k;
}

type Rect = {left: number, top: number, width: number, height: number};

type PendingReorder = {
  /** The order the patch is about to render — afterPatch must agree. */
  nextKey: string;
  /** On-screen order at measure time (from the chips' data-color attrs). */
  prevOrder: Array<string>;
  /** Left-rotation shift detected between prevOrder and the next order. */
  shift: number;
  /** VISUAL rects (transforms included) of every chip, by color. */
  rects: Map<string, Rect>;
  /** Frozen clones of the wrapping chips (old content, old state), with
   *  each original's resting opacity (a passed chip rests at 0.45 — the
   *  ghost must keep looking exactly like the chip it stands in for). */
  clones: Map<string, {el: HTMLElement, opacity: number}>;
};

type ActiveRun = {
  cancel(): void;
};

export type ChipConveyor = {
  /** Seed the rendered order on mount — never animates. */
  sync(order: ReadonlyArray<string>): void;
  /** Component `beforeUpdate`: detect + measure while the DOM is pre-patch. */
  beforePatch(container: HTMLElement | undefined, nextOrder: ReadonlyArray<string>): void;
  /** Component `updated` (and mounted): commit the rendered order; play. */
  afterPatch(container: HTMLElement | undefined, order: ReadonlyArray<string>): void;
  /** Unmount: cancel everything, drop ghosts and the mask class. */
  dispose(): void;
};

function orderKey(order: ReadonlyArray<string>): string {
  return order.join('|');
}

function chipsOf(container: HTMLElement): Array<HTMLElement> {
  return Array.from(container.querySelectorAll<HTMLElement>(CHIP_SELECTOR));
}

/**
 * WHICH chips wrap around the ring — the belt always takes the SHORT way:
 * a left-rotation by k moves the k leading chips through the left edge;
 * when the other way round is shorter (k > n−k — an undo's right-rotation)
 * the n−k trailing chips wrap through the right edge instead. The travel
 * direction itself is implicit in the surviving chips' own FLIP vector.
 */
function beltPlan(prevOrder: ReadonlyArray<string>, shift: number): {wrapped: Set<string>} {
  const n = prevOrder.length;
  if (shift <= n - shift) {
    return {wrapped: new Set(prevOrder.slice(0, shift))};
  }
  return {wrapped: new Set(prevOrder.slice(shift))};
}

/** The animation's `ready` promise where the engine provides one (a fake
 *  or jsdom does not) — the ghost fade waits for the BELT's actual start. */
function readyOf(anim: Animation): Promise<unknown> {
  const ready = (anim as {ready?: Promise<unknown>}).ready;
  return ready !== undefined && typeof ready.then === 'function' ? ready : Promise.resolve();
}

export function createChipConveyor(): ChipConveyor {
  let renderedKey: string | undefined;
  let pending: PendingReorder | undefined;
  let run: ActiveRun | undefined;
  let runSeq = 0;

  const start = (container: HTMLElement, p: PendingReorder): void => {
    const ribbon = container.querySelector<HTMLElement>(RIBBON_SELECTOR);
    if (ribbon === null || typeof ribbon.animate !== 'function') {
      return;
    }
    const chips = chipsOf(container);
    const {wrapped} = beltPlan(p.prevOrder, p.shift);
    container.classList.add(CONVEYOR_CLASS);
    const ribbonRect = ribbon.getBoundingClientRect();
    const newRects = new Map<string, Rect>();
    for (const chip of chips) {
      newRects.set(chip.dataset.color ?? '', chip.getBoundingClientRect());
    }
    // The belt vector: how far the FIRST surviving chip travels (its own
    // old→new delta; positive = the ribbon glides left). Survivors share
    // it up to same-patch width changes, wrapped chips ride it around the
    // ring's edge, and the exit ghost rides it out.
    let beltShift = 0;
    for (const color of p.prevOrder) {
      if (wrapped.has(color)) {
        continue;
      }
      const oldR = p.rects.get(color);
      const newR = newRects.get(color);
      if (oldR !== undefined && newR !== undefined) {
        beltShift = oldR.left - newR.left;
        break;
      }
    }
    if (beltShift === 0) {
      // Zero travel (hidden strip, jsdom) — nothing to show.
      container.classList.remove(CONVEYOR_CLASS);
      return;
    }

    const seq = ++runSeq;
    const duration = consoleMotionMs(CONVEYOR_MS);
    const easing = MOTION_EASE.convey;
    const anims: Array<Animation> = [];
    const completions: Array<Promise<unknown>> = [];
    const ghosts: Array<HTMLElement> = [];
    const track = (anim: Animation): void => {
      anims.push(anim);
      completions.push(anim.finished.catch(() => undefined));
    };

    // ── 1. THE BELT — one transform, one clock, every piece aboard. ──
    const ribbonAnim = ribbon.animate(
      [
        {transform: `translate(${beltShift}px, 0px)`},
        {transform: 'translate(0px, 0px)'},
      ],
      {duration, easing, fill: 'none'},
    );
    track(ribbonAnim);

    // ── 2. Residual corrections — survivors whose own FLIP delta differs
    // from the belt (simultaneous status-swap width changes; usually
    // none). A WRAPPED chip has no old pose of its own — it INHERITS the
    // residual of the survivor it stands next to in the new order (the
    // last one for a left belt, the first one for a right belt), so the
    // gap between the entering chip and its neighbour stays the exact
    // new-layout gap for the whole flight. Riding the pure belt instead
    // let the ACCUMULATED width deltas of every chip before it eat into
    // that gap mid-flight (measured as a 3-4 px box intersection at 4K).
    const residuals = new Map<string, {dx: number, dy: number}>();
    const survivorRes: Array<{dx: number, dy: number}> = [];
    for (const chip of chips) { // DOM order = the new order
      const color = chip.dataset.color ?? '';
      if (wrapped.has(color)) {
        continue;
      }
      const oldR = p.rects.get(color);
      const newR = newRects.get(color);
      if (oldR === undefined || newR === undefined) {
        continue;
      }
      const res = {dx: (oldR.left - newR.left) - beltShift, dy: oldR.top - newR.top};
      residuals.set(color, res);
      survivorRes.push(res);
    }
    const inherited = beltShift > 0 ?
      survivorRes[survivorRes.length - 1] :
      survivorRes[0];
    for (const chip of chips) {
      const color = chip.dataset.color ?? '';
      const res = wrapped.has(color) ? inherited : residuals.get(color);
      if (res === undefined || (Math.abs(res.dx) < RESIDUAL_MIN_PX && Math.abs(res.dy) < RESIDUAL_MIN_PX)) {
        continue;
      }
      track(chip.animate(
        [
          {transform: `translate(${res.dx}px, ${res.dy}px)`},
          {transform: 'translate(0px, 0px)'},
        ],
        // composite 'add': stacks under the ribbon AND under a chip's own
        // one-shot state animations (turn burst scales it slightly) —
        // nothing gets suppressed and popped back.
        {duration, easing, fill: 'none', composite: 'add'},
      ));
    }

    // ── 3. Exit ghosts — the wrapping chips' OLD frames, parented into
    // the ribbon at their old spots, leaving with the belt. Their only
    // own animation is the opacity ramp, and it starts at the BELT's own
    // `ready` — a fade running while the belt is still pending would
    // dissolve the ghost in place. ──
    for (const color of p.prevOrder) {
      if (!wrapped.has(color)) {
        continue;
      }
      const ghost = p.clones.get(color);
      const oldR = p.rects.get(color);
      if (ghost === undefined || oldR === undefined) {
        continue;
      }
      const clone = ghost.el;
      clone.style.left = `${oldR.left - ribbonRect.left - beltShift}px`;
      clone.style.top = `${oldR.top - ribbonRect.top}px`;
      clone.style.width = `${oldR.width}px`;
      clone.style.height = `${oldR.height}px`;
      ribbon.appendChild(clone);
      ghosts.push(clone);
      completions.push(readyOf(ribbonAnim).then(() => {
        if (runSeq !== seq) {
          return undefined;
        }
        const fade = clone.animate(ghostFade(ghost.opacity), {duration, easing, fill: 'forwards'});
        anims.push(fade);
        return fade.finished.catch(() => undefined);
      }).catch(() => undefined));
    }

    const cleanup = (): void => {
      for (const anim of anims) {
        try {
          anim.cancel();
        } catch (err) {
          // A finished/cancelled animation may refuse — nothing to undo.
        }
      }
      for (const ghost of ghosts) {
        ghost.remove();
      }
      container.classList.remove(CONVEYOR_CLASS);
    };
    run = {
      cancel: () => {
        if (runSeq === seq) {
          runSeq++;
        }
        cleanup();
        run = undefined;
      },
    };
    void Promise.allSettled(completions).then(() => {
      if (runSeq === seq) {
        cleanup();
        run = undefined;
      }
    });
  };

  return {
    sync(order: ReadonlyArray<string>): void {
      renderedKey = orderKey(order);
    },
    beforePatch(container: HTMLElement | undefined, nextOrder: ReadonlyArray<string>): void {
      if (container === undefined) {
        return;
      }
      const nextKey = orderKey(nextOrder);
      if (nextKey === renderedKey) {
        return; // content-only update — a live glide keeps running untouched
      }
      pending = undefined;
      if (consoleReducedMotionActive()) {
        run?.cancel();
        return;
      }
      const chips = chipsOf(container);
      const prevOrder = chips.map((chip) => chip.dataset.color ?? '');
      const shift = rotationShift(prevOrder, nextOrder);
      if (shift === undefined) {
        run?.cancel();
        return;
      }
      const rects = new Map<string, Rect>();
      for (const chip of chips) {
        rects.set(chip.dataset.color ?? '', chip.getBoundingClientRect());
      }
      const {wrapped} = beltPlan(prevOrder, shift);
      const clones = new Map<string, {el: HTMLElement, opacity: number}>();
      for (const chip of chips) {
        const color = chip.dataset.color ?? '';
        if (!wrapped.has(color)) {
          continue;
        }
        const clone = chip.cloneNode(true) as HTMLElement;
        clone.removeAttribute('data-color');
        clone.classList.add(GHOST_CLASS);
        clone.setAttribute('aria-hidden', 'true');
        const opacity = typeof getComputedStyle === 'function' ?
          parseFloat(getComputedStyle(chip).opacity || '1') : 1;
        clones.set(color, {el: clone, opacity: Number.isFinite(opacity) ? opacity : 1});
      }
      // Retarget: the rects above are VISUAL (a live run's transforms are in
      // them), so the old glide can let go now — the new one continues from
      // exactly where the eye left off, before anything repaints.
      run?.cancel();
      pending = {nextKey, prevOrder, shift, rects, clones};
    },
    afterPatch(container: HTMLElement | undefined, order: ReadonlyArray<string>): void {
      renderedKey = orderKey(order);
      const p = pending;
      pending = undefined;
      if (p === undefined || container === undefined || p.nextKey !== renderedKey) {
        return;
      }
      start(container, p);
    },
    dispose(): void {
      pending = undefined;
      run?.cancel();
    },
  };
}
