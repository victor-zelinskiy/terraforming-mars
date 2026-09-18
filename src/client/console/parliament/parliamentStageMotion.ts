import {gsap} from 'gsap';
import {motionMs} from '@/client/components/motion/motionTokens';
import {descendSurfaceInset, guardedDescend} from '@/client/console/surfaceMotion/workspaceDescend';
import {STAGE_FOLD_MS, STAGE_UNFOLD_MS} from './consoleParliamentFlow';
import type {Rect} from './consoleParliamentVoteMotion';

/*
 * THE MIDDLE TIER'S STAGE PHRASE — the seat pick / the results scene UNFOLD
 * from the rect the parties tier occupied (a clip, never a scale: nothing in
 * the surface is re-rastered) and FOLD back into place on B. Guarded
 * episodes: `done()` can never be dropped; reduced motion = the instant
 * pose. The section's `<transition>` hooks call these two.
 */

/** ENTER — the stage opens from `from` (the parties tier's rect at the press); with no rect it simply stands. */
export function playStageUnfold(surface: HTMLElement, from: Rect | undefined, done: () => void): void {
  const inset = from === undefined ? undefined : descendSurfaceInset(surface, from);
  if (inset === undefined) {
    done();
    return;
  }
  guardedDescend(surface, STAGE_UNFOLD_MS, done, (finish) => {
    const tl = gsap.timeline({onComplete: finish});
    tl.fromTo(surface, {clipPath: inset, opacity: 0.4}, {clipPath: 'inset(0px 0px 0px 0px round 12px)', opacity: 1, duration: motionMs(STAGE_UNFOLD_MS) / 1000, ease: 'expo.out', clearProps: 'clipPath,opacity'});
    return tl;
  });
}

/** LEAVE — the stage lets go in place (the parties tier is already back under it). */
export function playStageFold(surface: HTMLElement, done: () => void): void {
  guardedDescend(surface, STAGE_FOLD_MS, done,
    (finish) => gsap.to(surface, {opacity: 0, y: 8, duration: motionMs(STAGE_FOLD_MS) / 1000, ease: 'power2.in', onComplete: finish}));
}
