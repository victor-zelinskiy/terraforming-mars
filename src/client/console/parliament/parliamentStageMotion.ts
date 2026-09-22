import {gsap} from 'gsap';
import {motionMs} from '@/client/components/motion/motionTokens';
import {descendSurfaceInset, guardedDescend} from '@/client/console/surfaceMotion/workspaceDescend';
import {BODY_SWAP_MS} from './consoleParliamentFlow';
import type {Rect} from './consoleParliamentVoteMotion';

/*
 * СМЕНА ТЕЛА («Заседание v5» §3) — the ONE grammar for every change of the
 * middle zone's body, and there is no second one.
 *
 *   the ROW LEAVES DOWNWARD as one group with a light stagger, like a drawer
 *   being pushed shut; the NEW BODY UNFOLDS FROM UNDER THE BAND, in the rect
 *   the row occupied. The carrier card gives one short impulse at the start,
 *   so the cause reads: THIS card paid, and the work unfolds out of it.
 *   The return is symmetric — the step leaves downward, the row comes back the
 *   same way. About four tenths of a second each way.
 *
 * A `v-if` swap is a BLINK and is never acceptable: the two surfaces are a
 * LAYER STACK inside the body zone, both absolute, so the one that leaves
 * paints through its whole leave while the one that arrives is already opening.
 *
 * The band above does not take part: it stands still and only changes its text.
 *
 * Guarded episodes (`guardedDescend`): `done()` can never be dropped, and
 * reduced motion resolves to the instant pose. The tiles are `clearProps`-ed at
 * the end — the enactment's own FLIP tweens the very same elements later, and a
 * transform left behind would be measured as their resting place.
 */

/** The tiles of the row, in their own left-to-right order (the ruling party's tile is in the government). */
function rowTiles(root: HTMLElement | undefined): Array<HTMLElement> {
  return root === undefined ? [] : Array.from(root.querySelectorAll<HTMLElement>('.con-parl__party[data-party]'));
}

/** The travel of the drawer, in px of the row's own height (never a fixed number: the row is 101–442 px tall). */
function drawerY(tiles: ReadonlyArray<HTMLElement>): number {
  const h = tiles[0]?.getBoundingClientRect().height ?? 0;
  return Math.max(24, Math.round(h * 0.55));
}

/** ONE SHORT IMPULSE from the carrier card: the cause of the work that is opening. */
export function pulseCarrier(card: HTMLElement | undefined): void {
  if (card === undefined) {
    return;
  }
  gsap.fromTo(card,
    {scale: 1},
    {scale: 1.035, duration: motionMs(140) / 1000, ease: 'power2.out', yoyo: true, repeat: 1,
      transformOrigin: 'center center', clearProps: 'transform,transformOrigin', overwrite: 'auto'});
}

/** ENTER — the new body opens from `from` (the rect the row stood in), while the row is pushed shut under it. */
export function playBodyUnfold(surface: HTMLElement, row: HTMLElement | undefined, from: Rect | undefined, done: () => void): void {
  const inset = from === undefined ? undefined : descendSurfaceInset(surface, from);
  if (inset === undefined) {
    playRowLeave(row);
    done();
    return;
  }
  playRowLeave(row);
  guardedDescend(surface, BODY_SWAP_MS, done, (finish) => {
    const tl = gsap.timeline({onComplete: finish});
    tl.fromTo(surface,
      {clipPath: inset, opacity: 0.4, y: 10},
      {clipPath: 'inset(0px 0px 0px 0px round 12px)', opacity: 1, y: 0, duration: motionMs(BODY_SWAP_MS) / 1000, ease: 'expo.out', clearProps: 'clipPath,opacity,transform'});
    return tl;
  });
}

/**
 * A LAYER OF THE ZONE RETURNS (Colonial Affairs, block C): the colony ledger comes back under a hosted step
 * that has just left — the same drawer phrase as the body swap, on one layer of the zone's own stack (the
 * step's surface paints through its whole leave beside it). The step's own ENTRY belongs to its CSS.
 */
export function playZoneLayerEnter(surface: HTMLElement, done: () => void): void {
  guardedDescend(surface, BODY_SWAP_MS, done, (finish) =>
    gsap.fromTo(surface,
      {opacity: 0, y: 14},
      {opacity: 1, y: 0, duration: motionMs(BODY_SWAP_MS) / 1000, ease: 'expo.out', clearProps: 'opacity,transform', onComplete: finish}));
}

/** LEAVE — the step is pushed shut downward; the row is already coming back under it. */
export function playBodyFold(surface: HTMLElement, row: HTMLElement | undefined, done: () => void): void {
  playRowReturn(row);
  guardedDescend(surface, BODY_SWAP_MS, done,
    (finish) => gsap.to(surface, {opacity: 0, y: 14, duration: motionMs(BODY_SWAP_MS) / 1000, ease: 'power2.in', onComplete: finish}));
}

/** The row goes down as one group, with a light stagger — the drawer shutting. */
export function playRowLeave(row: HTMLElement | undefined): void {
  const tiles = rowTiles(row);
  if (tiles.length === 0) {
    return;
  }
  gsap.killTweensOf(tiles);
  gsap.to(tiles, {
    y: drawerY(tiles), opacity: 0,
    duration: motionMs(BODY_SWAP_MS) / 1000, ease: 'power2.in',
    stagger: motionMs(34) / 1000, overwrite: 'auto',
  });
}

/** …and comes back the same way, from below, in the same order. */
export function playRowReturn(row: HTMLElement | undefined): void {
  const tiles = rowTiles(row);
  if (tiles.length === 0) {
    return;
  }
  gsap.killTweensOf(tiles);
  gsap.fromTo(tiles,
    {y: drawerY(tiles), opacity: 0},
    {y: 0, opacity: 1, duration: motionMs(BODY_SWAP_MS) / 1000, ease: 'expo.out',
      stagger: motionMs(34) / 1000, clearProps: 'transform,opacity', overwrite: 'auto'});
}

/** The row's resting pose, with no motion at all (a restore that never swapped, an aborted episode). */
export function settleRow(row: HTMLElement | undefined, shown: boolean): void {
  const tiles = rowTiles(row);
  if (tiles.length === 0) {
    return;
  }
  gsap.killTweensOf(tiles);
  if (shown) {
    gsap.set(tiles, {clearProps: 'transform,opacity'});
  } else {
    gsap.set(tiles, {y: drawerY(tiles), opacity: 0});
  }
}
