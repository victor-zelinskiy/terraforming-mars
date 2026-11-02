/*
 * THE RIGHT STICK'S LAST RESORT — which scroll container the player is LOOKING AT.
 *
 * The shell routes the right stick to the surfaces that know their own scroll (the hand album, «Действия карт», the
 * «Разыграно» table, the effects explorer, …). Anything the routing does not name used to get NOTHING: the stick was
 * swallowed while a list overflowed in plain view (the owner's 4K frame of 2026-11-02 — «Информация › Эффекты» did not
 * scroll on the stick). This is the net under that routing: the overflowing scroll container that is PAINTED and on
 * TOP — never one under a foreign surface, never a parked (`visibility: hidden`) layer, never a fading one.
 *
 * Pure DOM reading, no state: a candidate is a ConsoleScrollArea viewport (the journal's feed among them), an Info Mode scroll, or
 * any element that declares `data-stick-scroll`.
 */

import {stopCursorScroll} from '@/client/console/cursorScroll';
import {conUiScale} from '@/client/console/consoleLayoutProfile';

const CANDIDATES = '.con-scroll-area__viewport, .con-info__scroll, [data-stick-scroll]';

/** Painted: a box, no `visibility: hidden` / `display: none` up the chain, an effective opacity of at least half. */
function painted(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) {
    return false;
  }
  if (typeof el.checkVisibility === 'function') {
    if (!el.checkVisibility({checkVisibilityCSS: true})) {
      return false;
    }
  } else if (el.offsetParent === null) {
    return false;
  }
  let opacity = 1;
  for (let n: HTMLElement | null = el; n !== null; n = n.parentElement) {
    const o = Number.parseFloat(getComputedStyle(n).opacity);
    if (Number.isFinite(o)) {
      opacity *= o;
    }
  }
  return opacity >= 0.5;
}

/** Overflows on the vertical axis by more than a rounding pixel. */
function overflows(el: HTMLElement): boolean {
  return el.scrollHeight > el.clientHeight + 1;
}

/**
 * On top: some point of the container's visible box hit-tests INTO it. A `pointer-events: none` subtree is never
 * named by the hit test, so the question there is «does a foreign surface paint over it» — answered by the first
 * hit-testable element at the point not being a foreign one that CONTAINS the point's owner chain.
 */
function onTop(el: HTMLElement): boolean {
  if (typeof document.elementsFromPoint !== 'function') {
    return true;
  }
  const r = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const x0 = Math.max(0, r.left);
  const x1 = Math.min(vw, r.right);
  const y0 = Math.max(0, r.top);
  const y1 = Math.min(vh, r.bottom);
  if (x1 - x0 < 1 || y1 - y0 < 1) {
    return false;
  }
  const points: Array<[number, number]> = [
    [(x0 + x1) / 2, (y0 + y1) / 2],
    [(x0 + x1) / 2, y0 + (y1 - y0) * 0.25],
    [(x0 + x1) / 2, y0 + (y1 - y0) * 0.75],
  ];
  for (const [x, y] of points) {
    const top = document.elementsFromPoint(x, y)[0];
    if (top === undefined || el.contains(top) || top.contains(el)) {
      return true;
    }
  }
  return false;
}

/**
 * The scroll container the right stick should move when no surface claimed it: painted, overflowing, on top — the
 * LARGEST such (a dossier's side column loses to the list beside it). `undefined` when nothing qualifies.
 */
export function stickScrollTarget(root: Document | Element = document): HTMLElement | undefined {
  let best: HTMLElement | undefined;
  let bestArea = 0;
  root.querySelectorAll<HTMLElement>(CANDIDATES).forEach((el) => {
    if (!overflows(el) || !painted(el) || !onTop(el)) {
      return;
    }
    const r = el.getBoundingClientRect();
    const area = r.width * r.height;
    if (area > bestArea) {
      best = el;
      bestArea = area;
    }
  });
  return best;
}

/** One frame of full stick deflection, in logical px (× the UI scale) — the shell's historical step. */
export const STICK_SCROLL_STEP_PX = 24;

/**
 * Page the target by the stick's per-frame deflection `dy` (−1…1), scaled to pixels. A cursor glide in flight on
 * that container lets go (the stick drives it now). Returns whether anything took the stick.
 */
export function stickScrollBy(dy: number, root: Document | Element = document): boolean {
  if (Math.abs(dy) < 0.05) {
    return false;
  }
  const target = stickScrollTarget(root);
  if (target === undefined) {
    return false;
  }
  stopCursorScroll(target);
  target.scrollBy({top: dy * STICK_SCROLL_STEP_PX * conUiScale(), behavior: 'auto'});
  return true;
}
