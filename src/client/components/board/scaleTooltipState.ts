import {reactive} from 'vue';
import {ArcScaleName} from '@/client/components/board/arcScaleTheme';

/**
 * UNIFIED tooltip for the dynamic global-parameter scale HUD.
 *
 * One module-level reactive store + one teleported renderer (`ScaleTooltip.vue`)
 * back EVERY hover surface of the scales — the band/rail, the identity badge,
 * the current-value indicator (the lit current digit), and the reward / event
 * marker chips. Previously each surface carried its OWN CSS `::after` / slot
 * tooltip, so they couldn't share a look and — critically — couldn't viewport-
 * clamp or dodge the bottom toolbar / sidebars (the bottom OCEAN scale's chips
 * sit right above the bar). Routing them all through one teleported, fixed-
 * position host (the same pattern as `BoardCellInfoPopover` / `PlacementReason
 * Popover`) gives a single premium look + JS-driven safe-zone positioning.
 *
 * The store survives PlayerHome's `:key` remount (module-level, like
 * `boardInfoState` / `journalState`). Content rows are ALREADY-TRANSLATED
 * strings (built with `translateText` at the call site) so the renderer needs no
 * `v-i18n` — which would not re-translate reactive content on update anyway.
 *
 * No-op-safe under JSDOM: listeners are attached lazily on first show and the
 * renderer guards on `window` / element measurement.
 */

/** Accent family that tints the tooltip frame (matches the scale theme). */
export type ScaleTooltipAccent = ArcScaleName;

/** Visual tone of a content row (drives colour / weight in ScaleTooltip.vue). */
export type ScaleTooltipTone = 'value' | 'desc' | 'reward' | 'note' | 'claim';

export type ScaleTooltipRow = {
  /** Display text — ALREADY translated (built with translateText). */
  text: string;
  tone: ScaleTooltipTone;
  /** Optional leading colour dot (e.g. the claiming player's colour). */
  dot?: string;
};

export type ScaleTooltipContent = {
  /** Per-scale accent for the frame tint. */
  accent: ScaleTooltipAccent;
  /** Small uppercase header (already translated). */
  kicker: string;
  rows: ReadonlyArray<ScaleTooltipRow>;
};

type State = {
  visible: boolean;
  /** Screen-space rect the tooltip positions against (a real element's rect, or
   *  a zero-size rect at the cursor for the band/rail). */
  anchor: DOMRect | null;
  content: ScaleTooltipContent | null;
};

export const scaleTooltipState = reactive<State>({
  visible: false,
  anchor: null,
  content: null,
});

const SHOW_DELAY = 110;
const HIDE_DELAY = 90;

let showTimer: ReturnType<typeof setTimeout> | undefined;
let hideTimer: ReturnType<typeof setTimeout> | undefined;
// The element the tooltip is anchored to (re-measured on scroll/resize). Null
// when anchored to a cursor point (band/rail) — those just hide on scroll.
let activeEl: HTMLElement | null = null;
let listenersAttached = false;

function clearShow(): void {
  if (showTimer !== undefined) {
    clearTimeout(showTimer);
    showTimer = undefined;
  }
}

function clearHide(): void {
  if (hideTimer !== undefined) {
    clearTimeout(hideTimer);
    hideTimer = undefined;
  }
}

function hideNow(): void {
  scaleTooltipState.visible = false;
  scaleTooltipState.anchor = null;
  scaleTooltipState.content = null;
  activeEl = null;
}

/** Re-read the anchored element's rect (or hide if it left the DOM). */
function reposition(): void {
  if (!scaleTooltipState.visible) {
    return;
  }
  if (activeEl === null) {
    // Cursor-anchored (band): there is no element to track — hide on scroll so a
    // stale tooltip doesn't float over moved content.
    hideNow();
    return;
  }
  if (!activeEl.isConnected) {
    hideNow();
    return;
  }
  scaleTooltipState.anchor = activeEl.getBoundingClientRect();
}

function attachListeners(): void {
  if (listenersAttached || typeof window === 'undefined') {
    return;
  }
  listenersAttached = true;
  window.addEventListener('scroll', reposition, true);
  window.addEventListener('resize', reposition);
}

function apply(anchor: DOMRect, content: ScaleTooltipContent, el: HTMLElement | null): void {
  activeEl = el;
  scaleTooltipState.anchor = anchor;
  scaleTooltipState.content = content;
  scaleTooltipState.visible = true;
}

/** Show the tooltip anchored to an element (re-measured on scroll/resize). */
export function showScaleTooltip(el: HTMLElement, content: ScaleTooltipContent): void {
  attachListeners();
  clearHide();
  // Already visible → swap content instantly (no re-delay) for a smooth
  // surface-to-surface move; else honour the show delay.
  if (scaleTooltipState.visible) {
    clearShow();
    apply(el.getBoundingClientRect(), content, el);
    return;
  }
  clearShow();
  showTimer = setTimeout(() => {
    showTimer = undefined;
    apply(el.getBoundingClientRect(), content, el);
  }, SHOW_DELAY);
}

/** Show the tooltip anchored to a CURSOR point (the band/rail, which has no
 *  single element to track). Updates instantly while visible (follows the move). */
export function showScaleTooltipAt(x: number, y: number, content: ScaleTooltipContent): void {
  attachListeners();
  clearHide();
  const rect = new DOMRect(x, y, 0, 0);
  if (scaleTooltipState.visible) {
    clearShow();
    apply(rect, content, null);
    return;
  }
  clearShow();
  showTimer = setTimeout(() => {
    showTimer = undefined;
    apply(rect, content, null);
  }, SHOW_DELAY);
}

/** Begin hiding the tooltip (a short grace so moving between surfaces doesn't flicker). */
export function hideScaleTooltip(): void {
  clearShow();
  clearHide();
  hideTimer = setTimeout(() => {
    hideTimer = undefined;
    hideNow();
  }, HIDE_DELAY);
}

/** Viewport region the tooltip must stay inside (excludes the bottom toolbar /
 *  sidebars). Computed from live CSS vars by ScaleTooltip.vue. */
export type TooltipSafeZones = {top: number; bottom: number; left: number; right: number};

/**
 * PURE clamp: given the anchor rect, the tooltip's measured size, and the safe
 * zones, return the fixed-position {left, top}. Centres horizontally on the
 * anchor (clamped inside [left, right]); prefers ABOVE the anchor, drops below
 * only with room, and NEVER lets the box cross the top / bottom safe lines (so
 * it can't slide under the bottom toolbar). Extracted from the renderer so the
 * safe-zone behaviour is unit-testable without a DOM.
 */
export function clampScaleTooltipPosition(
  anchor: {left: number; top: number; bottom: number; width: number},
  w: number,
  h: number,
  zones: TooltipSafeZones,
  opts: {margin?: number; gap?: number} = {},
): {left: number; top: number} {
  const margin = opts.margin ?? 8;
  const gap = opts.gap ?? 10;

  let cx = anchor.left + anchor.width / 2;
  const cxMin = zones.left + w / 2 + margin;
  const cxMax = zones.right - w / 2 - margin;
  cx = cxMax >= cxMin ? Math.min(Math.max(cx, cxMin), cxMax) : (zones.left + zones.right) / 2;

  let top: number;
  const aboveTop = anchor.top - gap - h;
  if (aboveTop >= zones.top) {
    top = aboveTop;
  } else {
    const belowTop = anchor.bottom + gap;
    top = belowTop + h <= zones.bottom ? belowTop : aboveTop;
  }
  top = Math.min(Math.max(top, zones.top), Math.max(zones.top, zones.bottom - h));

  return {left: Math.round(cx - w / 2), top: Math.round(top)};
}
