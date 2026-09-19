/*
 * THE ENACTMENT'S MOTION (Turmoil Redux) — the sitting's REWARD stage taking
 * the field for a hosted step (the payout pick, the take) and giving it back,
 * spoken in the WORKSPACE DESCEND grammar the vote mode speaks
 * (`consoleParliamentVoteMotion.ts`), one object smaller (the Э4 director
 * absorbs it as the enactment beat):
 *
 *  · RECEDE — the overview (government · voting area · parties · Agenda)
 *    steps back; the HEAD LINE (crumb + delegates zone) is outside the field
 *    and never moves;
 *  · CARRY — the ENACTED CARD is the continuity. It is not copied onto the
 *    stage: the government's own card element is TELEPORTED into the stage's
 *    hero slot (one DOM instance — a second copy can never exist) and this
 *    module FLIPs it from the rect it had a frame ago, so the resolution that
 *    rules visibly steps forward to pay out;
 *  · SURFACE — the payout reading and the recipient zone rise into their
 *    final geometry under the settling card (the shared picker teleports into
 *    that zone on its own schedule — ownership ≠ readiness);
 *  · FOLD (only when the flow could not conclude) reverses it: the card FLIPs
 *    home from the hero slot, the overview breathes back.
 *
 * A finished payout does NOT fold: the flow LEAVES with the stage standing,
 * in one motion with the workspace.
 *
 * Transform / opacity only, guarded episodes, durations through `motionMs`,
 * FLIP deltas compensated for CSS-`zoom` contexts, reduced motion = instant
 * poses with unchanged semantics.
 */
import {gsap} from 'gsap';
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {
  descendCascade, descendFlipFrom, descendParkLayer, descendRecede, descendReturn, guardedDescend, killDescendEpisode,
} from '@/client/console/surfaceMotion/workspaceDescend';
import type {Rect} from './consoleParliamentVoteMotion';

const RECEDE_MS = 200;
const CARRY_MS = 460;
const SURFACE_MS = 300;
const FOLD_MS = 360;

/**
 * The overview's parts that step back for the hosted step (the voting plate
 * included — its cards are a vote that is over). NOT the middle tier: the
 * sitting's stage lives INSIDE it and grows out of it for the field pose —
 * parking the tier parked the stage with it (measured: an empty field under
 * a live crumb and the picker's own verbs). Its parties are already parked by
 * the stage standing over them.
 */
function recedersOf(root: HTMLElement): Array<HTMLElement> {
  const out = Array.from(root.querySelectorAll<HTMLElement>('.con-parl__body [data-parl-recede]:not([data-parl-mid])'));
  const plate = root.querySelector<HTMLElement>('.con-parl__voting');
  if (plate !== null) {
    out.push(plate);
  }
  return out;
}

function carryOf(root: HTMLElement): HTMLElement | null {
  return root.querySelector<HTMLElement>('[data-parl-gov-carry]');
}

function surfaceItemsOf(root: HTMLElement): Array<HTMLElement> {
  return Array.from(root.querySelectorAll<HTMLElement>('.con-parl__stage--field [data-parl-sit-item]'));
}

/** The carried card's rect right now (measure BEFORE the teleport moves it). */
export function enactCarryRect(root: HTMLElement | null | undefined): Rect | undefined {
  const el = root === null || root === undefined ? null : carryOf(root);
  const r = el?.getBoundingClientRect();
  return r === undefined || r.width < 4 ? undefined : {left: r.left, top: r.top, width: r.width, height: r.height};
}

/** Park the overview for a payout standing without an entrance to play (a reload, a restore). */
export function parkParliamentForEnact(root: HTMLElement | null | undefined): void {
  if (root === null || root === undefined) {
    return;
  }
  for (const el of recedersOf(root)) {
    descendParkLayer(el);
  }
}

/**
 * ENTER — the overview recedes, the enacted card FLIPs from `cardFrom` (its
 * government rect, measured before the teleport) into the hero slot, the
 * payout surface rises. Call after the layout change (the teleport happened).
 */
export function playParliamentEnactEnter(args: {root: HTMLElement, cardFrom: Rect | undefined}): void {
  const {root, cardFrom} = args;
  const receders = recedersOf(root);
  const carry = carryOf(root);
  const items = surfaceItemsOf(root);
  if (consoleReducedMotionActive()) {
    for (const el of receders) {
      descendParkLayer(el);
    }
    return;
  }
  const s = (ms: number) => motionMs(ms) / 1000;
  guardedDescend(root, motionMs(CARRY_MS + SURFACE_MS), () => undefined, (finish) => {
    const tl = gsap.timeline({onComplete: finish});
    for (const el of receders) {
      descendRecede(tl, el, undefined, s(RECEDE_MS), 0);
    }
    if (carry !== null && cardFrom !== undefined) {
      const flip = descendFlipFrom(carry, cardFrom);
      if (flip !== undefined) {
        tl.fromTo(carry,
          {x: flip.x, y: flip.y, scale: flip.scale, transformOrigin: '0 0'},
          {x: 0, y: 0, scale: 1, duration: s(CARRY_MS), ease: 'expo.out', clearProps: 'transform'},
          0.04);
      }
    }
    descendCascade(tl, items, s(SURFACE_MS), s(140), 0.06);
    return tl;
  });
}

/**
 * FOLD — the flow could not conclude: the card FLIPs home from `cardFrom`
 * (its hero rect, measured before the teleport returned it) and the overview
 * breathes back. Call after the layout change.
 */
export function playParliamentEnactFold(args: {root: HTMLElement, cardFrom: Rect | undefined}): void {
  const {root, cardFrom} = args;
  const receders = recedersOf(root);
  const carry = carryOf(root);
  if (consoleReducedMotionActive()) {
    gsap.set(receders, {clearProps: 'transform,opacity,visibility'});
    return;
  }
  const s = (ms: number) => motionMs(ms) / 1000;
  guardedDescend(root, motionMs(FOLD_MS), () => undefined, (finish) => {
    const tl = gsap.timeline({onComplete: finish});
    if (carry !== null && cardFrom !== undefined) {
      const flip = descendFlipFrom(carry, cardFrom);
      if (flip !== undefined) {
        tl.fromTo(carry,
          {x: flip.x, y: flip.y, scale: flip.scale, transformOrigin: '0 0'},
          {x: 0, y: 0, scale: 1, duration: s(FOLD_MS), ease: 'expo.out', clearProps: 'transform'},
          0);
      }
    }
    for (const el of receders) {
      descendReturn(tl, el, s(FOLD_MS - 60), 0.06);
    }
    return tl;
  });
}

/** Unmount / abort — nothing may stay posed. */
export function killParliamentEnactMotion(root: HTMLElement | null | undefined): void {
  if (root === null || root === undefined) {
    return;
  }
  killDescendEpisode(root);
  const posed = [...recedersOf(root), ...surfaceItemsOf(root)];
  const carry = carryOf(root);
  if (carry !== null) {
    posed.push(carry);
  }
  if (posed.length > 0) {
    gsap.set(posed, {clearProps: 'transform,opacity,visibility'});
  }
}
