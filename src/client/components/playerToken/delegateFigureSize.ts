import {conLogicalPx} from '@/client/console/consoleLayoutProfile';

/**
 * THE DELEGATE FIGURE'S FLOOR — 18 logical px of height (the owner,
 * 2026-10-24): below it the head and the shoulders stop reading as a person on
 * the couch. A place that cannot hold it yields its chip density first, never
 * the figure's size, and never scrolls. `.9rem` is the same floor in a
 * stylesheet (`--pd-host`'s fallback in `player_delegate.less`).
 */
export const DELEGATE_FIGURE_FLOOR = 18;

/** The chairman's delegate seated in the chair (logical px) — `--pd-host: 1.2rem` on `.con-parl__chair-cube`. */
export const CHAIR_FIGURE = 24;

/** A figure's height (logical px, 1080-logical) as real px at the profile's scale — never under the floor. */
export function delegateFigurePx(logical: number): number {
  return conLogicalPx(Math.max(DELEGATE_FIGURE_FLOOR, logical));
}
