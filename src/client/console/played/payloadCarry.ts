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
 * ARM — the printed graphic of what the player CARRIES, as it stands on the press frame: the ONE result every price
 * buys when the group's «ИЛИ» stands on the price side (TR58 — `.con-vchoice__shared`, the tiles are the prices), else
 * the answered tile's own print (`[data-vchoice-print]` of the selected option inside `scope`). Undefined when the host
 * shows no print (a branch without one, a pick outside a variant group): the step then ENTERS without a carry
 * (`playPayloadCarry` — its groups still surface; it never stands in one frame, PL-473).
 */
export function armPayloadCarry(scope: Element | null | undefined): Rect | undefined {
  const ink = scope?.querySelector<HTMLElement>('.con-vchoice__shared [data-vchoice-print] .con-vchoice__ink') ??
    scope?.querySelector<HTMLElement>('.con-vchoice__opt--selected [data-vchoice-print] .con-vchoice__ink');
  return descendRectOf(ink ?? undefined);
}

/**
 * PLAY — the header's payload flies in from the tile's rect; every other group of the step surfaces from inside, the
 * contract line's own words with them. `stepRoot` is the step's `.con-ptsel`, `payload` its `[data-ptsel-payload]`.
 */
export function playPayloadCarry(stepRoot: HTMLElement | undefined, payload: HTMLElement | undefined, from: Rect | undefined): void {
  if (stepRoot === undefined || consoleReducedMotionActive()) {
    return;
  }
  const flip = payload === undefined || from === undefined ? undefined : descendFlipFrom(payload, from);
  if (payload === undefined || flip === undefined) {
    // NOTHING TO CARRY (a branch without a print, a step with no payload in its contract): the step still ENTERS — its
    // groups surface from inside, the contract line first (PL-473: it used to stand in one frame).
    const groups = Array.from(stepRoot.querySelectorAll<HTMLElement>('[data-unfold-item]'));
    if (groups.length === 0) {
      return;
    }
    guardedDescend(stepRoot, REVEAL_MS, () => undefined, (finish) => {
      const tl = gsap.timeline({onComplete: finish, onInterrupt: finish});
      descendCascade(tl, groups, motionMs(REVEAL_MS) / 1000, 0);
      return tl;
    });
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
  const ink = scope.querySelector<HTMLElement>('.con-vchoice__shared [data-vchoice-print] .con-vchoice__ink') ??
    scope.querySelector<HTMLElement>('.con-vchoice__opt--selected [data-vchoice-print] .con-vchoice__ink');
  const body = scope.querySelectorAll<HTMLElement>('.con-composer__scroll-body [data-unfold-item]');
  const all = Array.from(body.length > 0 ? body : scope.querySelectorAll<HTMLElement>('[data-unfold-item]'))
    .filter((el) => el.closest('.con-ptsel') === null);
  const flip = ink === null ? undefined : descendFlipFrom(ink, from);
  if (ink === null || flip === undefined) {
    // Nothing to carry home: the review still RETURNS — its groups surface from inside (never one frame, PL-473).
    if (all.length > 0) {
      guardedDescend(scope, REVEAL_MS, () => undefined, (finish) => {
        const tl = gsap.timeline({onComplete: finish, onInterrupt: finish});
        descendCascade(tl, all, motionMs(REVEAL_MS) / 1000, 0);
        return tl;
      });
    }
    return;
  }
  const home = ink.closest<HTMLElement>('[data-unfold-item]');
  const groups = all.filter((el) => el !== home && !el.contains(ink));
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
