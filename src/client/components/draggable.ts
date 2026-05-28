/*
 * draggable.ts — make a fixed-position UI pill (PlacementBanner /
 * MandatoryInputModal pill) draggable with the mouse while keeping
 * its host @click handler functional.
 *
 * Why a shared utility:
 *   - PlacementBanner and the MandatoryInputModal minimized pill are
 *     two independent "awaiting prompt" pills at the top of the
 *     viewport. Both can occasionally cover board hexes the player
 *     needs to click. User-driven repositioning is the cheapest fix.
 *   - The two components are otherwise unrelated, so the drag
 *     behaviour lives in a small DOM-level helper instead of a Vue
 *     mixin — each component just calls `makeDraggable` from its
 *     `mounted()` hook with a template ref + a reactive position
 *     object, and `destroy()` from `beforeUnmount`.
 *
 * Click vs drag:
 *   - The hosts' default @click behaviour (open details modal /
 *     restore the modal) must still work for a no-drag click.
 *   - We track mouse movement after mousedown. If the cursor moves
 *     past `dragThreshold` pixels, it's a drag; otherwise the
 *     mouseup -> click sequence is left alone and the host @click
 *     handler fires as usual.
 *   - When a drag DID occur, the click event that follows mouseup
 *     is suppressed via a one-shot capture-phase listener on the
 *     element. Otherwise the user would drag the pill 20px and have
 *     the details modal pop open the instant they released the
 *     mouse — annoying.
 *
 * Viewport clamping:
 *   - On every move the proposed next position is checked against
 *     `getBoundingClientRect()`. Any portion outside the viewport
 *     pulls the position back so the pill never escapes the screen.
 *   - Clamp is per-axis (x, y) so a vertical drag along the right
 *     edge still works once we hit the wall, etc.
 *
 * Style coupling:
 *   - The caller renders position via a Vue `:style` binding that
 *     returns `{ transform: 'translate(calc(-50% + Xpx), Ypx)' }`
 *     when (x,y) ≠ (0,0). When at default position (0,0) the
 *     binding returns `{}` and the CSS animation / transitions on
 *     `transform` are preserved (mount-in, minimized -> visible
 *     transition for the pill, etc.).
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

type GestureState = {
  mouseStartX: number;
  mouseStartY: number;
  posStartX: number;
  posStartY: number;
  isDragging: boolean;
};

const SUPPRESS_CLICK_GRACE_MS = 120;

export function makeDraggable(
  element: HTMLElement,
  position: DraggablePosition,
  options?: {
    dragThreshold?: number;
  },
): DraggableController {
  const threshold = options?.dragThreshold ?? 5;
  let gesture: GestureState | null = null;

  const onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    gesture = {
      mouseStartX: e.clientX,
      mouseStartY: e.clientY,
      posStartX: position.x,
      posStartY: position.y,
      isDragging: false,
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    e.preventDefault();
  };

  const onMouseMove = (e: MouseEvent) => {
    if (gesture === null) return;
    const dx = e.clientX - gesture.mouseStartX;
    const dy = e.clientY - gesture.mouseStartY;
    if (!gesture.isDragging && Math.hypot(dx, dy) > threshold) {
      gesture.isDragging = true;
    }
    if (!gesture.isDragging) return;

    let nextX = gesture.posStartX + dx;
    let nextY = gesture.posStartY + dy;

    /* Clamp against the viewport. `rect` reflects the element's
     * CURRENT screen position (i.e. with `position.x/y` already
     * applied via the Vue style binding). To project where the
     * element WOULD be at (nextX, nextY) we apply the delta from
     * the current offset to current rect. */
    const rect = element.getBoundingClientRect();
    const deltaX = nextX - position.x;
    const deltaY = nextY - position.y;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const projLeft = rect.left + deltaX;
    const projTop = rect.top + deltaY;
    const projRight = rect.right + deltaX;
    const projBottom = rect.bottom + deltaY;
    if (projLeft < 0) nextX -= projLeft;
    if (projRight > vw) nextX -= (projRight - vw);
    if (projTop < 0) nextY -= projTop;
    if (projBottom > vh) nextY -= (projBottom - vh);

    position.x = nextX;
    position.y = nextY;
  };

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    const didDrag = gesture?.isDragging === true;
    gesture = null;
    if (didDrag) {
      /* Suppress the click that fires after mouseup-on-same-element
       * so the host's @click handler doesn't pop a details modal /
       * restore action after the user just finished dragging. The
       * listener is one-shot (capture phase, so it runs before any
       * delegated handler) and removed defensively after a short
       * grace window in case the browser doesn't deliver a click
       * (e.g. mouseup happened off-element). */
      const suppress = (clickEvent: MouseEvent) => {
        clickEvent.preventDefault();
        clickEvent.stopImmediatePropagation();
        element.removeEventListener('click', suppress, true);
      };
      element.addEventListener('click', suppress, true);
      window.setTimeout(() => element.removeEventListener('click', suppress, true), SUPPRESS_CLICK_GRACE_MS);
    }
  };

  element.addEventListener('mousedown', onMouseDown);

  return {
    destroy() {
      element.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    },
    reset() {
      position.x = 0;
      position.y = 0;
    },
  };
}
