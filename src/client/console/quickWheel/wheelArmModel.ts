/*
 * QUICK-WHEEL ARM MODEL — the PURE input lifecycle of the RT/LT quick
 * selectors (no Vue / DOM / GSAP; unit-tested under the server runner).
 *
 * ONE machine unifies both input families:
 *
 *  DIGITAL (d-pad / A):   DOWN arms the slot → UP of the SAME control
 *                         commits. A fast tap arms+commits within its
 *                         natural ~80 ms — no hold threshold, no timer.
 *  ANALOG (left stick):   the AIM protocol (gamepadPollModel) tracks the
 *                         engaged sector — `aim` moves the FOCUS between
 *                         slots (circling is free, nothing fires), and the
 *                         CONFIRMED return to neutral (`aimEnd`) commits
 *                         whatever slot is focused at that moment.
 *
 * Visually both families share the same armed state (the seated tile); the
 * machine only differs in WHICH edge commits.
 *
 * The rules (each closes a real double-input / repeat / conflict hole):
 *  - REPEAT never arms: a held direction's hold-repeat (`nav` with
 *    `repeat: true`) is ignored, so a d-pad held from before the wheel
 *    opened can never ghost-arm a slot.
 *  - The wheel never digital-arms on a STICK-sourced `nav` (`analog` flag)
 *    — the stick speaks the aim protocol only. The merged `navEnd` however
 *    commits a digital arm regardless of which source finally let the
 *    direction go (d-pad armed + stick held the same way = one gesture).
 *  - FIRST-WINS across families: while A holds the centre, d-pad and stick
 *    input is ignored; while the STICK tracks, A is ignored. The D-PAD is
 *    the one deliberate override — a digital press takes the arm over from
 *    stick tracking (the stick's later `aimEnd` no longer matches and drops).
 *  - ROCKING re-arms within a family: d-pad up → right re-arms; the stale
 *    direction's release no longer matches and is dropped. Same for the
 *    stick's sector crossings (`aim` re-focuses).
 *  - A release that matches nothing (control already down at open, arm
 *    cancelled, family mismatch) is silently dropped — no phantom commits.
 *  - CANCEL (B) always disarms AND closes; later releases are no-ops.
 *  - A DISABLED slot arms in `blocked` mode (the mechanism presses against
 *    its stop) and its commit edge REFUSES instead of executing.
 */

import {NavDirection} from '@/client/gamepad/gamepadPollModel';
import {QuickSlot} from '@/client/console/consoleQuickModel';

/** Which input family holds the arm. */
export type WheelArmSource = 'nav' | 'confirm' | 'stick';

/** A live arm: the slot seated under the player's finger right now. */
export type WheelArm = {
  slot: QuickSlot,
  source: WheelArmSource,
  /** `nav` arms only: the direction whose release commits. */
  dir?: NavDirection,
  /** The armed entry is unavailable — pressed against the stop. */
  blocked: boolean,
};

/** The lifecycle events the shell feeds in (already layout-remapped). */
export type WheelArmEvent =
  | {type: 'navDown', dir: NavDirection, repeat: boolean, analog: boolean}
  | {type: 'navUp', dir: NavDirection}
  | {type: 'confirmDown'}
  | {type: 'confirmUp'}
  /** AIM protocol: the stick engaged / crossed into this sector. */
  | {type: 'aim', dir: NavDirection}
  /** AIM protocol: confirmed neutral — the analog commit edge. */
  | {type: 'aimEnd'}
  /** B — disarm and close, never commit. */
  | {type: 'cancel'}
  /** LT↔RT switch / wheel closed by the shell — the arm dissolves. */
  | {type: 'reset'};

export type WheelArmEffect =
  /** Execute this slot NOW (the commit edge matched its arm). */
  | {kind: 'commit', slot: QuickSlot}
  /** The commit edge matched a BLOCKED arm — surface the reason, stay open. */
  | {kind: 'refuse', slot: QuickSlot}
  /** Close the wheel without executing (B). */
  | {kind: 'dismiss'}
  | {kind: 'none'};

export type WheelArmResult = {
  arm: WheelArm | undefined,
  effect: WheelArmEffect,
};

/**
 * Advance the arm through one event. `slots` comes from the live wheel
 * model: a direction with NO entry in its slot arms nothing.
 */
export function reduceWheelArm(
  arm: WheelArm | undefined,
  event: WheelArmEvent,
  slots: {has: (slot: QuickSlot) => boolean, available: (slot: QuickSlot) => boolean},
): WheelArmResult {
  const none: WheelArmResult = {arm, effect: {kind: 'none'}};
  const armAt = (slot: QuickSlot, source: WheelArmSource, dir?: NavDirection): WheelArmResult => ({
    arm: {slot, source, dir, blocked: !slots.available(slot)},
    effect: {kind: 'none'},
  });
  const commitOf = (a: WheelArm): WheelArmResult => ({
    arm: undefined,
    effect: a.blocked ? {kind: 'refuse', slot: a.slot} : {kind: 'commit', slot: a.slot},
  });
  switch (event.type) {
  case 'navDown': {
    if (event.repeat || event.analog) {
      // Hold-repeat is list-navigation ergonomics; a stick-sourced nav is
      // the aim protocol's territory — neither ever digital-arms.
      return none;
    }
    if (arm !== undefined && arm.source === 'confirm') {
      return none; // first-wins: A already holds the centre
    }
    const slot: QuickSlot = event.dir;
    if (!slots.has(slot)) {
      return none;
    }
    // Fresh digital arm, a d-pad rock re-arm — or the deliberate d-pad
    // TAKEOVER of a stick-tracked focus (the stick's aimEnd then drops).
    return armAt(slot, 'nav', event.dir);
  }
  case 'navUp': {
    if (arm === undefined || arm.source !== 'nav' || arm.dir !== event.dir) {
      return none; // stale release (rocked away / armed elsewhere / no arm)
    }
    return commitOf(arm);
  }
  case 'aim': {
    if (arm !== undefined && (arm.source === 'confirm' || arm.source === 'nav')) {
      return none; // A holds the centre / the d-pad took the arm over
    }
    const slot: QuickSlot = event.dir;
    if (!slots.has(slot)) {
      // The stick points at an empty sector — the previous focus dissolves
      // (committing a slot the player has visibly left would be a lie).
      return {arm: undefined, effect: {kind: 'none'}};
    }
    return armAt(slot, 'stick', event.dir);
  }
  case 'aimEnd': {
    if (arm === undefined || arm.source !== 'stick') {
      return none; // cancelled / taken over / never engaged
    }
    return commitOf(arm);
  }
  case 'confirmDown': {
    if (arm !== undefined && (arm.source === 'nav' || arm.source === 'stick')) {
      return none; // first-wins: a direction already holds its slot
    }
    if (!slots.has('center')) {
      return none;
    }
    // A re-press while already confirm-armed simply refreshes the same arm
    // (self-heals a release swallowed by a cinematic input gate).
    return armAt('center', 'confirm');
  }
  case 'confirmUp': {
    if (arm === undefined || arm.source !== 'confirm') {
      return none;
    }
    return commitOf(arm);
  }
  case 'cancel':
    return {arm: undefined, effect: {kind: 'dismiss'}};
  case 'reset':
    return {arm: undefined, effect: {kind: 'none'}};
  default:
    return none;
  }
}
