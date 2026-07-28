/*
 * QUICK-WHEEL ARM MODEL — the PURE press→release lifecycle of the RT/LT
 * quick selectors (no Vue / DOM / GSAP; unit-tested under the server runner).
 *
 * The wheel is a direct-input command layer: every slot answers to ONE
 * physical control (A = centre, a d-pad direction = its slot). This module
 * turns that from "fires on the rising edge of the press" into a real
 * mechanism: the DOWN edge ARMS the slot (the tile visibly seats under the
 * player's thumb), the UP edge of the SAME control COMMITS it. A fast tap
 * arms and commits within its natural ~80 ms — no artificial hold threshold,
 * no timer anywhere in this file.
 *
 * The rules (each one closes a real double-input / repeat / conflict hole):
 *  - REPEAT never arms: a held direction's hold-repeat (`nav` with
 *    `repeat: true`) is ignored, so a d-pad held from before the wheel opened
 *    can never ghost-arm a slot.
 *  - FIRST-WINS across sources: while A holds the centre, d-pad presses are
 *    ignored (and vice versa) — two thumbs can never double-commit.
 *  - ROCKING re-arms within the d-pad: up → right re-arms the arm to the
 *    live direction; the stale direction's `navEnd` no longer matches and is
 *    dropped. Commit happens when the FINAL direction lets go.
 *  - A release that matches nothing (the control was already down when the
 *    wheel opened, or the arm was cancelled) is silently dropped — no
 *    phantom commits, ever.
 *  - CANCEL (B) always disarms AND closes; a later release of the previously
 *    armed control is a no-op because the arm is gone.
 *  - A DISABLED slot arms in `blocked` mode (the mechanism physically
 *    resists) and its release REFUSES instead of committing — the shell
 *    surfaces the honest reason; nothing executes.
 */

import {NavDirection} from '@/client/gamepad/gamepadPollModel';
import {QuickSlot} from '@/client/console/consoleQuickModel';

/** Which physical control holds the arm. */
export type WheelArmSource = 'nav' | 'confirm';

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
  | {type: 'navDown', dir: NavDirection, repeat: boolean}
  | {type: 'navUp', dir: NavDirection}
  | {type: 'confirmDown'}
  | {type: 'confirmUp'}
  /** B — disarm and close, never commit. */
  | {type: 'cancel'}
  /** LT↔RT switch / wheel closed by the shell — the arm dissolves. */
  | {type: 'reset'};

export type WheelArmEffect =
  /** Execute this slot NOW (the release matched its arm). */
  | {kind: 'commit', slot: QuickSlot}
  /** The release matched a BLOCKED arm — surface the reason, stay open. */
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
  switch (event.type) {
  case 'navDown': {
    if (event.repeat) {
      return none; // hold-repeat is list-navigation ergonomics, never an arm
    }
    if (arm !== undefined && arm.source === 'confirm') {
      return none; // first-wins: A already holds the centre
    }
    const slot: QuickSlot = event.dir;
    if (!slots.has(slot)) {
      return none;
    }
    // Fresh arm, or a d-pad rock re-arming onto the live direction.
    return {
      arm: {slot, source: 'nav', dir: event.dir, blocked: !slots.available(slot)},
      effect: {kind: 'none'},
    };
  }
  case 'navUp': {
    if (arm === undefined || arm.source !== 'nav' || arm.dir !== event.dir) {
      return none; // stale release (rocked away / armed elsewhere / no arm)
    }
    return {
      arm: undefined,
      effect: arm.blocked ? {kind: 'refuse', slot: arm.slot} : {kind: 'commit', slot: arm.slot},
    };
  }
  case 'confirmDown': {
    if (arm !== undefined && arm.source === 'nav') {
      return none; // first-wins: a direction already holds its slot
    }
    if (!slots.has('center')) {
      return none;
    }
    // A re-press while already confirm-armed simply refreshes the same arm
    // (self-heals a release swallowed by a cinematic input gate).
    return {
      arm: {slot: 'center', source: 'confirm', blocked: !slots.available('center')},
      effect: {kind: 'none'},
    };
  }
  case 'confirmUp': {
    if (arm === undefined || arm.source !== 'confirm') {
      return none;
    }
    return {
      arm: undefined,
      effect: arm.blocked ? {kind: 'refuse', slot: arm.slot} : {kind: 'commit', slot: arm.slot},
    };
  }
  case 'cancel':
    return {arm: undefined, effect: {kind: 'dismiss'}};
  case 'reset':
    return {arm: undefined, effect: {kind: 'none'}};
  default:
    return none;
  }
}
