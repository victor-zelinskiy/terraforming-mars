/*
 * CONSOLE OVERFLOW GUARD — dev-only diagnostics for the "no browser
 * scrollbars in console-native" invariant (foundation layer;
 * docs/CONSOLE_FOUNDATION.md §3.4).
 *
 * The CSS policy (html.console-native → overflow:hidden) makes a page-level
 * scrollbar IMPOSSIBLE — but it also makes genuine layout overflow
 * INVISIBLE (content silently clipped instead of a tell-tale bar). This
 * guard restores the signal: while a console-native surface is active it
 * measures the root after layout-relevant moments (resize, transition /
 * animation end, a slow safety tick) and, when `scrollWidth/Height` exceeds
 * the client box, logs ONE structured warning per offender signature with
 * the top offending elements (rects beyond the viewport).
 *
 * Enabled in dev builds automatically; in production it stays fully inert
 * unless forced with `?conOverflow=1` (on-Deck debugging). Never throws,
 * never affects layout, all work is debounced and runs only on demand.
 *
 * The measurement mathematics is PURE (`classifyRootOverflow` /
 * `rankOverflowOffenders`) and unit-tested; the installer is a thin DOM
 * shell (VueUse: `useEventListener` for auto-cleanup-by-handle,
 * `useDebounceFn` for the coalesced check, `useDocumentVisibility` is NOT
 * needed — checks are event-driven and the tick self-gates).
 */

import {useDebounceFn, useEventListener} from '@vueuse/core';
import {consoleNativeActive} from '@/client/console/composables/consoleNativeSurface';

// ── PURE measurement model ─────────────────────────────────────────────────

export type RootOverflowMetrics = {
  scrollW: number,
  clientW: number,
  scrollH: number,
  clientH: number,
};

export type RootOverflowReport = {
  /** Pixels of horizontal / vertical overflow (0 = none on that axis). */
  horizontal: number,
  vertical: number,
};

/** Sub-pixel rounding tolerance — a 1px excess is noise, not a bug. */
export const OVERFLOW_TOLERANCE_PX = 1;

export function classifyRootOverflow(m: RootOverflowMetrics): RootOverflowReport | undefined {
  const horizontal = Math.max(0, m.scrollW - m.clientW);
  const vertical = Math.max(0, m.scrollH - m.clientH);
  if (horizontal <= OVERFLOW_TOLERANCE_PX && vertical <= OVERFLOW_TOLERANCE_PX) {
    return undefined;
  }
  return {horizontal, vertical};
}

export type OffenderCandidate = {
  /** Human label — tag + id + leading classes (built by the DOM shell). */
  label: string,
  left: number,
  right: number,
  top: number,
  bottom: number,
};

export type RankedOffender = OffenderCandidate & {
  /** How many px past the viewport the element reaches (its worst axis). */
  overshoot: number,
};

/**
 * Rank elements that poke past the viewport box. Horizontal overshoot is
 * ALWAYS a bug (right > vw or left < 0); vertical only counts when the root
 * reported vertical overflow (a taller-than-viewport backdrop is normal —
 * position:fixed layers don't create scroll).
 */
export function rankOverflowOffenders(
  candidates: ReadonlyArray<OffenderCandidate>,
  vw: number,
  vh: number,
  includeVertical: boolean,
  limit: number = 5,
): Array<RankedOffender> {
  const ranked: Array<RankedOffender> = [];
  for (const c of candidates) {
    const h = Math.max(c.right - vw, -c.left, 0);
    const v = includeVertical ? Math.max(c.bottom - vh, -c.top, 0) : 0;
    const overshoot = Math.max(h, v);
    if (overshoot > OVERFLOW_TOLERANCE_PX) {
      ranked.push({...c, overshoot});
    }
  }
  ranked.sort((a, b) => b.overshoot - a.overshoot);
  return ranked.slice(0, limit);
}

// ── DOM shell ──────────────────────────────────────────────────────────────

/** Slow safety tick — catches overflow no event announced (font/img late load). */
const GUARD_TICK_MS = 2000;
const CHECK_DEBOUNCE_MS = 250;
/** Never walk more elements than this — dev diagnostics must stay cheap. */
const MAX_WALK = 4000;
const MAX_WARNINGS = 40;

function elementLabel(el: Element): string {
  const id = el.id !== '' ? `#${el.id}` : '';
  const classes = Array.from(el.classList).slice(0, 3).map((c) => `.${c}`).join('');
  return `${el.tagName.toLowerCase()}${id}${classes}`;
}

function guardForced(): boolean {
  try {
    return typeof window !== 'undefined' && /[?&]conOverflow=1/.test(window.location.search);
  } catch {
    return false;
  }
}

export function consoleOverflowGuardEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || guardForced();
}

const seenSignatures = new Set<string>();

function runCheck(): void {
  if (!consoleNativeActive() || typeof document === 'undefined') {
    return;
  }
  const root = document.documentElement;
  const report = classifyRootOverflow({
    scrollW: root.scrollWidth,
    clientW: root.clientWidth,
    scrollH: root.scrollHeight,
    clientH: root.clientHeight,
  });
  if (report === undefined) {
    return;
  }
  const vw = root.clientWidth;
  const vh = root.clientHeight;
  const candidates: Array<OffenderCandidate> = [];
  const all = document.body.querySelectorAll('*');
  const n = Math.min(all.length, MAX_WALK);
  for (let i = 0; i < n; i++) {
    const el = all[i];
    if (!(el instanceof HTMLElement) || el.getClientRects().length === 0) {
      continue;
    }
    const r = el.getBoundingClientRect();
    candidates.push({label: elementLabel(el), left: r.left, right: r.right, top: r.top, bottom: r.bottom});
  }
  const offenders = rankOverflowOffenders(candidates, vw, vh, report.vertical > 0);
  const signature = `${report.horizontal}x${report.vertical}|${offenders[0]?.label ?? ''}`;
  if (seenSignatures.has(signature) || seenSignatures.size >= MAX_WARNINGS) {
    return;
  }
  seenSignatures.add(signature);
  console.warn(
    `[console-overflow] page overflow in console-native mode — H:+${report.horizontal}px V:+${report.vertical}px ` +
    `(viewport ${vw}×${vh}). Content must live inside a <ConsoleScrollArea>, never overflow the page.`,
    offenders.map((o) => `${o.label} → +${Math.round(o.overshoot)}px [${Math.round(o.left)},${Math.round(o.top)}→${Math.round(o.right)},${Math.round(o.bottom)}]`),
  );
}

let uninstall: (() => void) | undefined;

/** Idempotent — App-level bootstrap next to the gamepad core. Inert in prod. */
export function installConsoleOverflowGuard(): void {
  if (uninstall !== undefined || typeof window === 'undefined' || !consoleOverflowGuardEnabled()) {
    return;
  }
  const schedule = useDebounceFn(runCheck, CHECK_DEBOUNCE_MS);
  const stops = [
    useEventListener(window, 'resize', schedule, {passive: true}),
    // Capture: transitions/animations end on arbitrary descendants.
    useEventListener(window, 'transitionend', schedule, {capture: true, passive: true}),
    useEventListener(window, 'animationend', schedule, {capture: true, passive: true}),
  ];
  const tick = window.setInterval(() => {
    if (consoleNativeActive() && document.visibilityState === 'visible') {
      void schedule();
    }
  }, GUARD_TICK_MS);
  uninstall = () => {
    stops.forEach((stop) => stop());
    window.clearInterval(tick);
  };
}

export function uninstallConsoleOverflowGuard(): void {
  uninstall?.();
  uninstall = undefined;
  seenSignatures.clear();
}
