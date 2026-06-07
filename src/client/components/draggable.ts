/*
 * draggable.ts — make a fixed-position UI pill (PlacementBanner /
 * MandatoryInputModal pill) draggable while keeping its host @click
 * handler functional.
 *
 * v40-s rewrite — performance and ergonomics:
 *
 *   1. Pointer events (pointerdown / pointermove / pointerup) instead
 *      of mouse events, with `setPointerCapture` so the gesture
 *      follows the handle even if the cursor leaves it during the
 *      drag. Document-level listeners are gone — every event flows
 *      through the captured element.
 *   2. Live position is written to inline CSS variables (`--drag-x`,
 *      `--drag-y`) directly on the moved element via
 *      `style.setProperty`. The host CSS composes these into its
 *      regular `transform: translate(...)` rule. No Vue reactivity
 *      fires for the per-frame visual update — Vue only sees the
 *      FINAL position written back to the `position` argument on
 *      `pointerup`. That alone eliminated the laggy feel: previously
 *      every mousemove dirtied a reactive object, re-evaluated a
 *      computed property, re-rendered the pill's `:style` binding,
 *      and patched the DOM through Vue's render pipeline — all at
 *      the cursor's polling rate (≥ 100 Hz on modern devices).
 *   3. `requestAnimationFrame` batches multiple pointermoves between
 *      paints into a single DOM write. The cursor can report at
 *      500 Hz; the screen still draws at 60–120 Hz. We coalesce.
 *   4. `getBoundingClientRect()` is read ONCE at pointerdown to
 *      capture width / height / baseline position; the per-frame
 *      bounds clamp uses cached values + `window.innerWidth/Height`.
 *      Avoids forced sync layout on every move.
 *   5. `will-change: transform` and `transition: none` are applied
 *      via an `is-dragging` class for the duration of the gesture —
 *      browser hoists the element onto its own compositor layer
 *      during drag, and existing CSS transitions don't fight the
 *      RAF-driven updates.
 *   6. Click vs drag distinction is preserved via the 5-px threshold
 *      and the post-drag one-shot click suppressor (host's @click
 *      doesn't fire after a real drag).
 *   7. Window resize listener re-clamps the persisted position so
 *      the pill never ends up off-screen after the viewport shrinks.
 *
 * Click vs drag:
 *   - The hosts' default @click behaviour (open details / restore
 *     modal) must still work for a no-drag click. We track movement
 *     after pointerdown; if the cursor moves past `dragThreshold`
 *     pixels, it's a drag — otherwise the click sequence is left
 *     alone and @click fires as usual.
 *   - When a drag DID occur, the click event that follows pointerup
 *     is suppressed via a one-shot capture-phase listener on the
 *     moved element. Otherwise a 20-px drag + release would
 *     immediately pop the details modal — annoying.
 *
 * Handle vs whole element:
 *   - Pass `options.handle` to make a specific child element the
 *     grab target while the bigger `element` is what moves. Used by
 *     MandatoryInputModal's pill — the pill body is a click target
 *     (restores the modal), and a small sci-fi 6-dot grip on the
 *     left is the dedicated drag handle. This eliminates the
 *     click-vs-drag ambiguity on the clickable region.
 *   - Without `handle`, the whole element listens for pointerdown
 *     (PlacementBanner's current behaviour — entire banner draggable,
 *     click on banner opens details).
 *
 * Style coupling:
 *   - The host element's CSS must compose `var(--drag-x, 0px)` and
 *     `var(--drag-y, 0px)` into its `transform`. Example:
 *       transform: translate(calc(-50% + var(--drag-x, 0px)),
 *                            var(--drag-y, 0px));
 *     With the vars unset, the transform falls back to the original
 *     centred-top position. With them set during drag, the element
 *     follows the cursor. The vars are written to inline `style` so
 *     they take precedence over any stylesheet rule.
 */

export type DraggablePosition = {
  x: number;
  y: number;
};

export type DraggableController = {
  destroy(): void;
  /** Reset position back to (0,0) — used when the host is restored
   *  to a fresh state (e.g. new placement starts). */
  reset(): void;
};

const SUPPRESS_CLICK_GRACE_MS = 120;
const DRAGGING_CLASS = 'is-dragging';

/* Cached layout snapshot captured at pointerdown so per-frame moves
 * never force sync layout. `baseLeft/baseTop` is where the element
 * WOULD sit if `position` were (0, 0) — derived by subtracting the
 * starting offset from the live rect. */
type GestureState = {
  pointerId: number;
  mouseStartX: number;
  mouseStartY: number;
  posStartX: number;
  posStartY: number;
  baseLeft: number;
  baseTop: number;
  width: number;
  height: number;
  liveX: number;
  liveY: number;
  isDragging: boolean;
  rafScheduled: boolean;
};

export function makeDraggable(
  element: HTMLElement,
  position: DraggablePosition,
  options?: {
    dragThreshold?: number;
    handle?: HTMLElement;
  },
): DraggableController {
  const threshold = options?.dragThreshold ?? 5;
  const handle = options?.handle ?? element;
  let gesture: GestureState | null = null;

  /* Per-frame flush — runs at most once per RAF, regardless of how
   * many pointermove events fired. Writes the live position to inline
   * CSS variables; the host stylesheet composes them into its
   * transform. */
  const flush = () => {
    if (gesture === null) {
      return;
    }
    gesture.rafScheduled = false;
    element.style.setProperty('--drag-x', `${gesture.liveX}px`);
    element.style.setProperty('--drag-y', `${gesture.liveY}px`);
  };

  const scheduleFlush = () => {
    if (gesture !== null && !gesture.rafScheduled) {
      gesture.rafScheduled = true;
      requestAnimationFrame(flush);
    }
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) {
      return;
    }
    /* Capture the layout snapshot ONCE. `rect.left/top` reflects the
     * current screen position which already includes the existing
     * `position.x/y` offset; subtract to get the un-offset baseline. */
    const rect = element.getBoundingClientRect();
    gesture = {
      pointerId: e.pointerId,
      mouseStartX: e.clientX,
      mouseStartY: e.clientY,
      posStartX: position.x,
      posStartY: position.y,
      baseLeft: rect.left - position.x,
      baseTop: rect.top - position.y,
      width: rect.width,
      height: rect.height,
      liveX: position.x,
      liveY: position.y,
      isDragging: false,
      rafScheduled: false,
    };
    /* setPointerCapture routes all subsequent pointer events to the
     * handle, even when the cursor leaves it. No need to attach
     * document-level listeners. */
    try {
      handle.setPointerCapture(e.pointerId);
    } catch {
      /* Some browsers throw if the pointer was already lost between
       * the down event and the capture call — safe to ignore. */
    }
    e.preventDefault();
  };

  const onPointerMove = (e: PointerEvent) => {
    if (gesture === null || e.pointerId !== gesture.pointerId) {
      return;
    }
    const dx = e.clientX - gesture.mouseStartX;
    const dy = e.clientY - gesture.mouseStartY;
    if (!gesture.isDragging) {
      if (Math.hypot(dx, dy) <= threshold) {
        return;
      }
      gesture.isDragging = true;
      element.classList.add(DRAGGING_CLASS);
    }

    /* Project next position from the cached baseline. */
    let nextX = gesture.posStartX + dx;
    let nextY = gesture.posStartY + dy;

    /* Clamp against viewport using cached width/height + baseline.
     * No DOM reads needed here. */
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const projLeft = gesture.baseLeft + nextX;
    const projTop = gesture.baseTop + nextY;
    const projRight = projLeft + gesture.width;
    const projBottom = projTop + gesture.height;
    if (projLeft < 0) {
      nextX -= projLeft;
    }
    if (projRight > vw) {
      nextX -= (projRight - vw);
    }
    if (projTop < 0) {
      nextY -= projTop;
    }
    if (projBottom > vh) {
      nextY -= (projBottom - vh);
    }

    gesture.liveX = nextX;
    gesture.liveY = nextY;
    scheduleFlush();
  };

  const onPointerEnd = (e: PointerEvent) => {
    if (gesture === null || e.pointerId !== gesture.pointerId) {
      return;
    }
    const didDrag = gesture.isDragging;
    const finalX = gesture.liveX;
    const finalY = gesture.liveY;
    try {
      handle.releasePointerCapture(gesture.pointerId);
    } catch { /* see setPointerCapture above */ }
    gesture = null;

    if (didDrag) {
      element.classList.remove(DRAGGING_CLASS);
      /* Commit final position to the reactive store so the value
       * survives any re-render that might unset the inline CSS vars.
       * The inline vars stay set anyway — but writing through Vue
       * lets external code observe the position. */
      position.x = finalX;
      position.y = finalY;
      /* Suppress the click that fires after pointerup-on-same-element
       * so the host's @click handler doesn't pop a details modal
       * after the user just finished dragging. One-shot capture-phase
       * listener; removed defensively after a grace window in case
       * the browser doesn't deliver a click (e.g. pointerup happened
       * off-element via capture). */
      const suppress = (clickEvent: MouseEvent) => {
        clickEvent.preventDefault();
        clickEvent.stopImmediatePropagation();
        element.removeEventListener('click', suppress, true);
      };
      element.addEventListener('click', suppress, true);
      window.setTimeout(
        () => element.removeEventListener('click', suppress, true),
        SUPPRESS_CLICK_GRACE_MS,
      );
    }
  };

  /* On window resize, re-clamp the persisted position so the pill
   * never ends up off-screen if the viewport shrinks below where it
   * was last released. Runs in RAF so consecutive resize events
   * collapse to one re-clamp. */
  let resizeRafScheduled = false;
  const onResize = () => {
    if (resizeRafScheduled) {
      return;
    }
    resizeRafScheduled = true;
    requestAnimationFrame(() => {
      resizeRafScheduled = false;
      if (gesture !== null) {
        return;
      } /* mid-drag, leave it alone */
      if (position.x === 0 && position.y === 0) {
        return;
      }
      const rect = element.getBoundingClientRect();
      let nx = position.x;
      let ny = position.y;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (rect.left < 0) {
        nx -= rect.left;
      }
      if (rect.right > vw) {
        nx -= (rect.right - vw);
      }
      if (rect.top < 0) {
        ny -= rect.top;
      }
      if (rect.bottom > vh) {
        ny -= (rect.bottom - vh);
      }
      if (nx !== position.x || ny !== position.y) {
        position.x = nx;
        position.y = ny;
        element.style.setProperty('--drag-x', `${nx}px`);
        element.style.setProperty('--drag-y', `${ny}px`);
      }
    });
  };

  handle.addEventListener('pointerdown', onPointerDown);
  handle.addEventListener('pointermove', onPointerMove);
  handle.addEventListener('pointerup', onPointerEnd);
  handle.addEventListener('pointercancel', onPointerEnd);
  window.addEventListener('resize', onResize);

  return {
    destroy() {
      handle.removeEventListener('pointerdown', onPointerDown);
      handle.removeEventListener('pointermove', onPointerMove);
      handle.removeEventListener('pointerup', onPointerEnd);
      handle.removeEventListener('pointercancel', onPointerEnd);
      window.removeEventListener('resize', onResize);
      element.classList.remove(DRAGGING_CLASS);
    },
    reset() {
      position.x = 0;
      position.y = 0;
      element.style.removeProperty('--drag-x');
      element.style.removeProperty('--drag-y');
    },
  };
}
