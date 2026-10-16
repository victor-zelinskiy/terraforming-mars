/*
 * THE CURSOR'S SCROLL — one function for every cursor-driven move of a scroll container (TR58 «КУРСОР — ОДИН ЖИВОЙ
 * ОБЪЕКТ»; `.claude/rules/console-ui.md` § THE CURSOR).
 *
 * Nine console surfaces kept their cursored element in view with `scrollIntoView` — the browser's own curve and
 * duration (never the cursor's), free to walk OUTER containers, measuring the element's LIFTED box (so the cursor's
 * own lift asked for a few px of scroll); the rest scrolled INSTANTLY under a ring that was still fading in. This is
 * the one road now:
 *  · bounded to the container it is given — nothing outside it moves;
 *  · the element's RESTING box is kept in view (its own transform taken out — `restingRect`);
 *  · the move rides the cursor's clock (`CURSOR_MS` on `CURSOR_EASE`) and is RETARGETABLE (a step mid-glide aims from
 *    where the list is going, not from where it stands);
 *  · `instant` for a caller that measures the scrolled layout right after; reduced motion is always instant.
 * `ConsoleScrollArea.ensureVisible` stands on it; a container that is not a ConsoleScrollArea calls it directly.
 */

import {gsap} from 'gsap';
import {CURSOR_EASE, CURSOR_MS, motionMs} from '@/client/components/motion/motionTokens';
import {cubicBezierFromCss} from '@/client/components/motion/cubicBezier';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';

export type CursorScrollAxis = 'y' | 'x';

const EASE = cubicBezierFromCss(CURSOR_EASE) ?? ((p: number) => p);

type Live = {tween: gsap.core.Tween, target: number};
const live = new WeakMap<HTMLElement, Partial<Record<CursorScrollAxis, Live>>>();

function posOf(c: HTMLElement, axis: CursorScrollAxis): number {
  return axis === 'y' ? c.scrollTop : c.scrollLeft;
}

function setPos(c: HTMLElement, axis: CursorScrollAxis, v: number): void {
  if (axis === 'y') {
    c.scrollTop = v;
  } else {
    c.scrollLeft = v;
  }
}

/** The element's client rect with its OWN transform taken back out (the cursor's lift about its centre). */
export function restingRect(el: Element): {top: number, bottom: number, left: number, right: number} {
  const r = el.getBoundingClientRect();
  const tf = typeof getComputedStyle === 'function' ? getComputedStyle(el).transform : 'none';
  const m = /^matrix\(([^)]+)\)$/.exec(tf ?? 'none');
  if (m === null) {
    return {top: r.top, bottom: r.bottom, left: r.left, right: r.right};
  }
  const [a, b, c, d, e, f] = m[1].split(',').map((v) => Number.parseFloat(v));
  const sx = Math.hypot(a, b) || 1;
  const sy = Math.hypot(c, d) || 1;
  const w = r.width / sx;
  const h = r.height / sy;
  const cx = r.left + r.width / 2 - e;
  const cy = r.top + r.height / 2 - f;
  return {top: cy - h / 2, bottom: cy + h / 2, left: cx - w / 2, right: cx + w / 2};
}

/** Stop a cursor scroll in flight on this container (the right stick takes over; an unmount). */
export function stopCursorScroll(container: HTMLElement): void {
  const rec = live.get(container);
  if (rec === undefined) {
    return;
  }
  rec.x?.tween.kill();
  rec.y?.tween.kill();
  live.delete(container);
}

/** Where the container is GOING on this axis (its target while a scroll runs, else where it stands). */
export function cursorScrollBase(container: HTMLElement, axis: CursorScrollAxis): number {
  return live.get(container)?.[axis]?.target ?? posOf(container, axis);
}

/** Scroll `container` to `target` on the cursor's clock (clamped; `instant` / reduced motion → at once). */
export function cursorScrollTo(container: HTMLElement, axis: CursorScrollAxis, target: number, opts: {instant?: boolean, onSettled?: () => void} = {}): void {
  const rec = live.get(container) ?? {};
  rec[axis]?.tween.kill();
  delete rec[axis];
  const max = axis === 'y' ? container.scrollHeight - container.clientHeight : container.scrollWidth - container.clientWidth;
  const to = Math.max(0, Math.min(Math.max(0, max), target));
  if (opts.instant === true || consoleReducedMotionActive() || Math.abs(to - posOf(container, axis)) < 1) {
    setPos(container, axis, to);
    live.set(container, rec);
    opts.onSettled?.();
    return;
  }
  const state = {v: posOf(container, axis)};
  const tween = gsap.to(state, {
    v: to,
    duration: motionMs(CURSOR_MS) / 1000,
    ease: EASE,
    onUpdate: () => setPos(container, axis, state.v),
    onComplete: () => {
      setPos(container, axis, to);
      const now = live.get(container);
      if (now?.[axis]?.tween === tween) {
        delete now[axis];
      }
      opts.onSettled?.();
    },
  });
  rec[axis] = {tween, target: to};
  live.set(container, rec);
}

/**
 * Keep `el` inside `container` on `axis` — `nearest` (the default: the least move that shows it with `margin`) or
 * `center`. Returns whether a move was started.
 */
export function cursorEnsureVisible(
  container: HTMLElement,
  el: Element,
  opts: {axis?: CursorScrollAxis, margin?: number, align?: 'nearest' | 'center', instant?: boolean, onSettled?: () => void} = {},
): boolean {
  const axis = opts.axis ?? 'y';
  const margin = opts.margin ?? 12;
  const er = restingRect(el);
  const cr = container.getBoundingClientRect();
  const base = cursorScrollBase(container, axis);
  const shift = base - posOf(container, axis);
  const lo = (axis === 'y' ? er.top : er.left) - shift;
  const hi = (axis === 'y' ? er.bottom : er.right) - shift;
  const cLo = axis === 'y' ? cr.top : cr.left;
  const cHi = axis === 'y' ? cr.bottom : cr.right;
  let target = base;
  if (opts.align === 'center') {
    target = base + (lo + hi) / 2 - (cLo + cHi) / 2;
  } else if (lo < cLo + margin) {
    target = base + lo - (cLo + margin);
  } else if (hi > cHi - margin) {
    target = base + hi - (cHi - margin);
  }
  if (Math.abs(target - base) < 0.5) {
    return false;
  }
  cursorScrollTo(container, axis, target, {instant: opts.instant, onSettled: opts.onSettled});
  return true;
}

/** The nearest scrolling ancestor of `el` on `axis` (a cursor-scroll container for a surface without a ConsoleScrollArea). */
export function scrollContainerOf(el: Element, axis: CursorScrollAxis = 'y'): HTMLElement | undefined {
  for (let n = el.parentElement; n !== null; n = n.parentElement) {
    const cs = getComputedStyle(n);
    const ov = axis === 'y' ? cs.overflowY : cs.overflowX;
    if ((ov === 'auto' || ov === 'scroll') && (axis === 'y' ? n.scrollHeight > n.clientHeight : n.scrollWidth > n.clientWidth)) {
      return n;
    }
  }
  return undefined;
}
