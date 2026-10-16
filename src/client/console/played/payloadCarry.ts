/*
 * THE PAYLOAD IS CARRIED ONE LEVEL DEEPER (TR56 «КУДА ЛЯЖЕТ», П3).
 *
 * A composer's «what» and «where» are ONE question asked on two levels: the variant tile answered WHAT («3 [мех]» —
 * the card's own print of that branch), the target step asks WHERE. The print is the object the player is carrying,
 * so it travels: it leaves the tile it was chosen on and lands in the step's contract line («КУДА: 3 [мех]»), while
 * the step's other groups surface from inside (the workspace descend's REVEAL). Same phrase, one level deeper — never
 * a second, unrelated header standing where the tile was.
 *
 * Two halves on the descend grammar's own primitives (`surfaceMotion/workspaceDescend.ts`): ARM measures the tile's
 * print on the press frame (the review it stands in unmounts in the next patch), PLAY flies the header's print from
 * that rect once the step has mounted. Transform + opacity only; a guarded episode (the safety timer can never strand
 * a half-shown header); reduced motion — no carry, the step simply stands.
 */
import {gsap} from 'gsap';
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {descendCascade, descendFlipFrom, descendRectOf, guardedDescend} from '@/client/console/surfaceMotion/workspaceDescend';

type Rect = {left: number, top: number, width: number, height: number};

/** The CARRY's length — one glide, a little longer than the reveal under it (the carried object lands last). */
const CARRY_MS = 360;
/** The step's groups surfacing from inside, under the carry. */
const REVEAL_MS = 300;

/**
 * ARM — the selected variant tile's printed graphic, as it stands on the press frame (`[data-vchoice-print]` of the
 * answered tile inside `scope`). Undefined when the host shows no print (a branch without one, a pick outside a
 * variant group): the step then stands without a carry.
 */
export function armPayloadCarry(scope: Element | null | undefined): Rect | undefined {
  const ink = scope?.querySelector<HTMLElement>('.con-vchoice__opt--selected [data-vchoice-print] .con-vchoice__ink');
  return descendRectOf(ink ?? undefined);
}

/**
 * PLAY — the header's payload flies in from the tile's rect; every other group of the step surfaces from inside, the
 * contract line's own words with them. `stepRoot` is the step's `.con-ptsel`, `payload` its `[data-ptsel-payload]`.
 */
export function playPayloadCarry(stepRoot: HTMLElement | undefined, payload: HTMLElement | undefined, from: Rect | undefined): void {
  if (stepRoot === undefined || payload === undefined || from === undefined || consoleReducedMotionActive()) {
    return;
  }
  const flip = descendFlipFrom(payload, from);
  if (flip === undefined) {
    return;
  }
  // The contract line's own words, and every group below it — never the payload (it is the carried object).
  const header = payload.closest<HTMLElement>('[data-unfold-item]');
  const words = header === null ? [] :
    Array.from(header.querySelectorAll<HTMLElement>('.con-ptsel__contract-head > *, .con-ptsel__contract-ask'))
      .filter((el) => el !== payload && !el.contains(payload) && !payload.contains(el));
  const groups = Array.from(stepRoot.querySelectorAll<HTMLElement>('[data-unfold-item]')).filter((el) => el !== header);
  guardedDescend(payload, CARRY_MS, () => undefined, (finish) => {
    const tl = gsap.timeline({onComplete: finish, onInterrupt: () => {
      gsap.set(payload, {clearProps: 'transform,transformOrigin'});
      finish();
    }});
    tl.fromTo(payload,
      {x: flip.x, y: flip.y, scale: flip.scale, transformOrigin: '0 0'},
      {x: 0, y: 0, scale: 1, duration: motionMs(CARRY_MS) / 1000, ease: 'expo.out', clearProps: 'transform,transformOrigin'},
      0);
    descendCascade(tl, words, motionMs(REVEAL_MS) / 1000, motionMs(90) / 1000, 0.02);
    descendCascade(tl, groups, motionMs(REVEAL_MS) / 1000, motionMs(60) / 1000);
    return tl;
  });
}

/** ARM THE RETURN — the step's header print as it stands, before the step unmounts (`[data-ptsel-payload]`). */
export function armPayloadReturn(step: Element | null | undefined): Rect | undefined {
  return descendRectOf(step?.querySelector<HTMLElement>('[data-ptsel-payload]') ?? undefined);
}

/**
 * PLAY THE RETURN — one level back of the same phrase: the selected tile's print flies home from the header's rect, and
 * the review's other groups surface from inside (the group holding the carried print stands — it is the destination).
 */
export function playPayloadReturn(scope: HTMLElement | undefined, from: Rect | undefined): void {
  if (scope === undefined || from === undefined || consoleReducedMotionActive()) {
    return;
  }
  const ink = scope.querySelector<HTMLElement>('.con-vchoice__opt--selected [data-vchoice-print] .con-vchoice__ink');
  if (ink === null) {
    return;
  }
  const flip = descendFlipFrom(ink, from);
  if (flip === undefined) {
    return;
  }
  const home = ink.closest<HTMLElement>('[data-unfold-item]');
  const groups = Array.from(scope.querySelectorAll<HTMLElement>('.con-composer__scroll-body [data-unfold-item]'))
    .filter((el) => el !== home && !el.contains(ink));
  guardedDescend(ink, CARRY_MS, () => undefined, (finish) => {
    const tl = gsap.timeline({onComplete: finish, onInterrupt: () => {
      gsap.set(ink, {clearProps: 'transform,transformOrigin'});
      finish();
    }});
    tl.fromTo(ink,
      {x: flip.x, y: flip.y, scale: flip.scale, transformOrigin: '0 0'},
      {x: 0, y: 0, scale: 1, duration: motionMs(CARRY_MS) / 1000, ease: 'expo.out', clearProps: 'transform,transformOrigin'},
      0);
    descendCascade(tl, groups, motionMs(REVEAL_MS) / 1000, motionMs(60) / 1000);
    return tl;
  });
}
