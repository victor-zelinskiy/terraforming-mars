/*
 * QUICK-WHEEL INPUT MODEL — the PURE lifecycle of the RT/LT quick selectors
 * under BOTH control styles (no Vue / DOM / GSAP; unit-tested).
 *
 * ONE machine, one state `{focus, arm}`, two strategies (wheelControlMode):
 *
 *  QUICK-SELECT (the expert default — the shipped press→release model):
 *   - d-pad DOWN arms the slot, UP of the SAME control commits;
 *   - the stick speaks the AIM protocol: `aim` tracks the sector, the
 *     CONFIRMED neutral (`aimEnd`) commits;
 *   - A press→release arms/commits the CENTRE tile;
 *   - repeats never arm, stale releases drop, first-wins across families
 *     with the deliberate d-pad takeover of a stick focus.
 *
 *  FOCUS-CONFIRM (the deliberate alternative):
 *   - directions and the stick only MOVE the persistent `focus`
 *     (d-pad = the spatial neighbourhood map below; stick = direct sector);
 *   - a direction's release / the stick's neutral do NOTHING;
 *   - A DOWN fixes the action (arm = the focused slot at that instant —
 *     navigation freezes while A is held, so later movement can never swap
 *     the confirmed action), A UP commits it;
 *   - every open / LT↔RT switch / mode change starts at the FIXED home
 *     focus: the CENTRE tile (LT = Standard Projects, RT = Cards) — never a
 *     remembered position.
 *
 * Shared guarantees (both styles): B always disarms AND closes without
 * executing; `reset` (wheel switch / mode change) dissolves everything
 * silently; a blocked slot's commit edge REFUSES (and availability is
 * RE-CHECKED live at the commit edge — an action that died between press
 * and release refuses instead of firing); the commit effect fires at most
 * once per gesture (the arm clears on commit, stale edges no-op).
 */

import {NavDirection} from '@/client/gamepad/gamepadPollModel';
import {QuickSlot} from '@/client/console/consoleQuickModel';
import {WheelControlMode} from '@/client/console/quickWheel/wheelControlMode';

/** Which input family holds the arm. */
export type WheelArmSource = 'nav' | 'confirm' | 'stick';

/** A live arm: the slot seated / pressed under the player's finger. */
export type WheelArm = {
  slot: QuickSlot,
  source: WheelArmSource,
  /** `nav` arms only: the direction whose release commits. */
  dir?: NavDirection,
  /** The armed entry was unavailable at press — pressed against the stop. */
  blocked: boolean,
};

/** The machine's whole state. `focus` is the FOCUS-CONFIRM persistent
 *  cursor (always defined; quick-select simply ignores it). */
export type WheelInputState = {
  focus: QuickSlot,
  arm: WheelArm | undefined,
};

/** Every wheel opens at the fixed HOME focus — the centre tile. */
export function initialWheelInput(): WheelInputState {
  return {focus: 'center', arm: undefined};
}

/** The lifecycle events the shell feeds in (already layout-remapped). */
export type WheelArmEvent =
  | {type: 'navDown', dir: NavDirection, repeat: boolean, analog: boolean}
  | {type: 'navUp', dir: NavDirection}
  | {type: 'confirmDown'}
  | {type: 'confirmUp'}
  /** AIM protocol: the stick engaged / crossed into this sector. */
  | {type: 'aim', dir: NavDirection}
  /** AIM protocol: confirmed neutral — quick-select's analog commit edge. */
  | {type: 'aimEnd'}
  /** B — disarm and close, never commit. */
  | {type: 'cancel'}
  /** LT↔RT switch / mode change / wheel closed — everything dissolves. */
  | {type: 'reset'};

export type WheelArmEffect =
  /** Execute this slot NOW (the commit edge matched its arm). */
  | {kind: 'commit', slot: QuickSlot}
  /** The commit edge matched a BLOCKED arm — surface the reason, stay open. */
  | {kind: 'refuse', slot: QuickSlot}
  /** Close the wheel without executing (B). */
  | {kind: 'dismiss'}
  | {kind: 'none'};

export type WheelReduceResult = {
  state: WheelInputState,
  effect: WheelArmEffect,
};

export type WheelSlots = {
  has: (slot: QuickSlot) => boolean,
  available: (slot: QuickSlot) => boolean,
};

/**
 * FOCUS-CONFIRM's spatial d-pad map — explicit and total, never DOM order:
 *  - from the CENTRE a direction reaches its arm tile;
 *  - from an arm tile the OPPOSITE direction returns to the centre;
 *  - a PERPENDICULAR direction crosses to that side's arm tile;
 *  - the SAME direction is the felt edge (focus stays);
 *  - a missing slot keeps the focus (never a jump to an unrelated tile).
 */
export function stepWheelFocus(
  focus: QuickSlot,
  dir: NavDirection,
  has: (slot: QuickSlot) => boolean,
): QuickSlot {
  const OPPOSITE: Record<NavDirection, NavDirection> = {up: 'down', down: 'up', left: 'right', right: 'left'};
  let target: QuickSlot;
  if (focus === 'center') {
    target = dir;
  } else if (dir === OPPOSITE[focus as NavDirection]) {
    target = 'center';
  } else if (dir === focus) {
    return focus; // the edge is felt
  } else {
    target = dir; // perpendicular crossing
  }
  return has(target) ? target : focus;
}

/**
 * Advance the machine through one event under the given control mode.
 * `slots` comes from the live wheel model — availability is consulted at
 * BOTH edges (fixed into the arm at press, re-checked at the commit edge).
 */
export function reduceWheel(
  state: WheelInputState,
  event: WheelArmEvent,
  mode: WheelControlMode,
  slots: WheelSlots,
): WheelReduceResult {
  const none: WheelReduceResult = {state, effect: {kind: 'none'}};
  const {focus, arm} = state;
  const armAt = (slot: QuickSlot, source: WheelArmSource, dir?: NavDirection): WheelReduceResult => ({
    state: {focus, arm: {slot, source, dir, blocked: !slots.available(slot)}},
    effect: {kind: 'none'},
  });
  const commitOf = (a: WheelArm): WheelReduceResult => ({
    state: {focus, arm: undefined},
    // The LIVE re-check: an action that became unavailable between the
    // press and the release refuses honestly instead of firing.
    effect: (a.blocked || !slots.available(a.slot)) ?
      {kind: 'refuse', slot: a.slot} : {kind: 'commit', slot: a.slot},
  });

  // ── shared verbs (identical in both styles) ───────────────────────────
  switch (event.type) {
  case 'cancel':
    return {state: {focus, arm: undefined}, effect: {kind: 'dismiss'}};
  case 'reset':
    return {state: initialWheelInput(), effect: {kind: 'none'}};
  default:
    break;
  }

  // ── FOCUS-CONFIRM: navigation moves the focus, A commits it ──────────
  if (mode === 'focus-confirm') {
    switch (event.type) {
    case 'navDown': {
      if (event.repeat || event.analog || arm !== undefined) {
        // Repeats are cadence, the stick speaks `aim`, and a held A freezes
        // navigation (the confirmed action can never be swapped mid-press).
        return none;
      }
      const next = stepWheelFocus(focus, event.dir, slots.has);
      return next === focus ? none : {state: {focus: next, arm}, effect: {kind: 'none'}};
    }
    case 'aim': {
      if (arm !== undefined) {
        return none; // navigation frozen while A is held
      }
      const next: QuickSlot = event.dir;
      return slots.has(next) && next !== focus ?
        {state: {focus: next, arm}, effect: {kind: 'none'}} : none;
    }
    case 'navUp':
    case 'aimEnd':
      return none; // releasing a navigator NEVER executes in this style
    case 'confirmDown':
      // A re-press while already pressed refreshes the SAME fixed slot
      // (self-heal) — never re-targets to a moved focus.
      return arm !== undefined ? armAt(arm.slot, 'confirm') : armAt(focus, 'confirm');
    case 'confirmUp':
      return arm === undefined || arm.source !== 'confirm' ? none : commitOf(arm);
    default:
      return none;
    }
  }

  // ── QUICK-SELECT: the shipped press→release / aim→neutral model ──────
  switch (event.type) {
  case 'navDown': {
    if (event.repeat || event.analog) {
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
      return {state: {focus, arm: undefined}, effect: {kind: 'none'}};
    }
    return armAt(slot, 'stick', event.dir);
  }
  case 'aimEnd': {
    return arm === undefined || arm.source !== 'stick' ? none : commitOf(arm);
  }
  case 'confirmDown': {
    if (arm !== undefined && (arm.source === 'nav' || arm.source === 'stick')) {
      return none; // first-wins: a direction already holds its slot
    }
    if (!slots.has('center')) {
      return none;
    }
    // A re-press while already confirm-armed refreshes the arm (self-heals
    // a release swallowed by a cinematic input gate).
    return armAt('center', 'confirm');
  }
  case 'confirmUp': {
    return arm === undefined || arm.source !== 'confirm' ? none : commitOf(arm);
  }
  default:
    return none;
  }
}
