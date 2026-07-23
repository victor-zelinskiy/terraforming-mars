/**
 * PURE gamepad poll model — the testable half of the input core
 * (design: docs/GAMEPAD_SUPPORT_DESIGN.md §4.1).
 *
 * Turns two consecutive W3C "standard"-mapping gamepad snapshots into
 * SEMANTIC intents. No DOM, no Vue, no Date.now() — the caller supplies
 * `now`, so every rule (edge detection, directional hold-repeat, trigger
 * hysteresis, deadzones) is deterministic and unit-tested under the server
 * mocha runner (tests/client/components/gamepad/gamepadPollModel.spec.ts).
 *
 * Platform names (Xbox/PS/Switch) NEVER appear here — semantics only; the
 * glyph layer owns presentation (glyphSets.ts).
 */

/** Semantic controls of the STANDARD mapping (https://www.w3.org/TR/gamepad/#remapping). */
export type SemanticButton =
  | 'confirm' // A (index 0)
  | 'back' // B (1)
  | 'secondary' // X (2)
  | 'inspect' // Y (3)
  | 'bumperL' // LB (4)
  | 'bumperR' // RB (5)
  | 'triggerL' // LT (6, analog)
  | 'triggerR' // RT (7, analog)
  | 'view' // View/Back/Select (8)
  | 'menu' // Menu/Start (9)
  | 'stickL' // L3 (10)
  | 'stickR'; // R3 (11)

export type NavDirection = 'up' | 'down' | 'left' | 'right';

export type GamepadIntent =
  | {kind: 'press', button: SemanticButton}
  | {kind: 'release', button: SemanticButton}
  | {kind: 'nav', dir: NavDirection, repeat: boolean}
  | {kind: 'scroll', dx: number, dy: number};

/** A plain copy of a Gamepad's inputs — never retain the live object. */
export type GamepadSnapshot = {
  buttons: ReadonlyArray<{pressed: boolean, value: number}>,
  axes: ReadonlyArray<number>,
};

/** The subset of the live Gamepad interface we read (test-friendly). */
export type GamepadLike = {
  buttons: ReadonlyArray<{pressed: boolean, value: number}>,
  axes: ReadonlyArray<number>,
};

/** Standard-mapping digital buttons → semantics (triggers 6/7 are analog, handled apart). */
const BUTTON_SEMANTICS: ReadonlyArray<readonly [number, SemanticButton]> = [
  [0, 'confirm'],
  [1, 'back'],
  [2, 'secondary'],
  [3, 'inspect'],
  [4, 'bumperL'],
  [5, 'bumperR'],
  [8, 'view'],
  [9, 'menu'],
  [10, 'stickL'],
  [11, 'stickR'],
] as const;

/** Standard-mapping d-pad indices. */
const DPAD: ReadonlyArray<readonly [number, NavDirection]> = [
  [12, 'up'],
  [13, 'down'],
  [14, 'left'],
  [15, 'right'],
] as const;

/** Analog trigger digitalization hysteresis (press above / release below). */
export const TRIGGER_PRESS_AT = 0.55;
export const TRIGGER_RELEASE_AT = 0.45;

/** Radial deadzone for the LEFT stick when it acts as a d-pad. */
export const DEFAULT_DEADZONE = 0.28;
/** Per-axis deadzone for the RIGHT (scroll) stick. */
export const SCROLL_DEADZONE = 0.3;

/**
 * Directional hold-repeat cadence. Deliberately FIXED (not motionMs-scaled):
 * input cadence is ergonomics, not visual choreography (design §4.1).
 */
export const NAV_REPEAT_DELAY_MS = 340;
export const NAV_REPEAT_INTERVAL_MS = 130;

/** Carry-over state between frames (per pad). */
export type PollState = {
  heldDir: NavDirection | undefined,
  nextRepeatAt: number,
  triggerLDown: boolean,
  triggerRDown: boolean,
};

export function initialPollState(): PollState {
  return {heldDir: undefined, nextRepeatAt: 0, triggerLDown: false, triggerRDown: false};
}

export function emptySnapshot(): GamepadSnapshot {
  return {buttons: [], axes: []};
}

/** Copy the live pad's inputs into a plain snapshot. */
export function readSnapshot(pad: GamepadLike): GamepadSnapshot {
  return {
    buttons: pad.buttons.map((b) => ({pressed: b.pressed, value: b.value})),
    axes: pad.axes.slice(),
  };
}

/**
 * Any activity beyond the deadzones? Used for mode entry, active-pad
 * election and the idle early-out in the poll loop.
 */
export function snapshotActivity(s: GamepadSnapshot, deadzone: number = DEFAULT_DEADZONE): boolean {
  for (const b of s.buttons) {
    if (b.pressed || b.value > TRIGGER_RELEASE_AT) {
      return true;
    }
  }
  for (const a of s.axes) {
    if (Math.abs(a) > deadzone) {
      return true;
    }
  }
  return false;
}

function pressedAt(s: GamepadSnapshot, index: number): boolean {
  return s.buttons[index]?.pressed === true;
}

function valueAt(s: GamepadSnapshot, index: number): number {
  return s.buttons[index]?.value ?? 0;
}

/** Resolve the current navigation direction: d-pad wins, else left stick past the radial deadzone. */
function navDirection(s: GamepadSnapshot, deadzone: number): NavDirection | undefined {
  for (const [idx, dir] of DPAD) {
    if (pressedAt(s, idx)) {
      return dir;
    }
  }
  const x = s.axes[0] ?? 0;
  const y = s.axes[1] ?? 0;
  if (Math.hypot(x, y) <= deadzone) {
    return undefined;
  }
  if (Math.abs(x) >= Math.abs(y)) {
    return x < 0 ? 'left' : 'right';
  }
  return y < 0 ? 'up' : 'down';
}

/** Rescale an axis value past the deadzone into 0..1 (sign preserved). */
function normalizeAxis(v: number, deadzone: number): number {
  const mag = Math.abs(v);
  if (mag <= deadzone) {
    return 0;
  }
  const scaled = (mag - deadzone) / (1 - deadzone);
  return Math.sign(v) * Math.min(1, scaled);
}

/**
 * The heart of the model: previous+current snapshots + carry state + now →
 * semantic intents + new carry state. Never mutates its inputs.
 */
export function diffSnapshots(
  prev: GamepadSnapshot,
  next: GamepadSnapshot,
  state: PollState,
  now: number,
  deadzone: number = DEFAULT_DEADZONE,
): {intents: Array<GamepadIntent>, state: PollState} {
  const intents: Array<GamepadIntent> = [];
  const out: PollState = {...state};

  // 1. Digital button edges.
  for (const [idx, button] of BUTTON_SEMANTICS) {
    const was = pressedAt(prev, idx);
    const is = pressedAt(next, idx);
    if (!was && is) {
      intents.push({kind: 'press', button});
    } else if (was && !is) {
      intents.push({kind: 'release', button});
    }
  }

  // 2. Analog triggers with hysteresis.
  const lt = valueAt(next, 6);
  if (!out.triggerLDown && lt >= TRIGGER_PRESS_AT) {
    out.triggerLDown = true;
    intents.push({kind: 'press', button: 'triggerL'});
  } else if (out.triggerLDown && lt <= TRIGGER_RELEASE_AT) {
    out.triggerLDown = false;
    intents.push({kind: 'release', button: 'triggerL'});
  }
  const rt = valueAt(next, 7);
  if (!out.triggerRDown && rt >= TRIGGER_PRESS_AT) {
    out.triggerRDown = true;
    intents.push({kind: 'press', button: 'triggerR'});
  } else if (out.triggerRDown && rt <= TRIGGER_RELEASE_AT) {
    out.triggerRDown = false;
    intents.push({kind: 'release', button: 'triggerR'});
  }

  // 3. Directional navigation with hold-repeat (d-pad OR left stick).
  const dir = navDirection(next, deadzone);
  if (dir === undefined) {
    out.heldDir = undefined;
  } else if (dir !== out.heldDir) {
    // Fresh direction (or a direction change) fires immediately.
    out.heldDir = dir;
    out.nextRepeatAt = now + NAV_REPEAT_DELAY_MS;
    intents.push({kind: 'nav', dir, repeat: false});
  } else if (now >= out.nextRepeatAt) {
    out.nextRepeatAt = now + NAV_REPEAT_INTERVAL_MS;
    intents.push({kind: 'nav', dir, repeat: true});
  }

  // 4. Right stick → scroll (analog, per-frame while deflected).
  const dx = normalizeAxis(next.axes[2] ?? 0, SCROLL_DEADZONE);
  const dy = normalizeAxis(next.axes[3] ?? 0, SCROLL_DEADZONE);
  if (dx !== 0 || dy !== 0) {
    intents.push({kind: 'scroll', dx, dy});
  }

  return {intents, state: out};
}

/** One pad's contribution to a poll frame (index + whether it produced activity). */
export type PadFrame = {index: number, active: boolean};

/**
 * Choose the SINGLE pad that drives the UI this frame.
 *
 * `engaged` lists the pads that are NOT idle this frame (they produced input or
 * are releasing a held control — i.e. exactly the pads the poll loop diffed).
 * The rule is STICKY: while the current `incumbent` is still engaged it keeps
 * driving; only when it is fully idle/gone does the last other ACTIVE pad take
 * over (the "put one controller down, pick another up" story).
 *
 * ── WHY A SINGLE ELECTION IS LOAD-BEARING (the Steam Machine double-input) ──
 * Steam Input frequently exposes ONE physical controller as TWO "standard"
 * gamepads to the page — the raw device AND its virtual remap — both reporting
 * every button press. Without a single sticky election the poll loop dispatched
 * the SAME edge from BOTH mirrors, so one d-pad tap moved the cursor TWO rows
 * and a toggle control (the in-game quick wheel) opened-then-closed on one
 * press (read as "the bumper does nothing"). Electing exactly one driver and
 * dispatching only its intents makes a mirrored duplicate inert. A genuine
 * second controller still works — it takes over the instant the first is idle.
 */
export function electActivePad(engaged: ReadonlyArray<PadFrame>, incumbent: number): number {
  if (engaged.some((p) => p.index === incumbent)) {
    return incumbent;
  }
  const next = engaged.find((p) => p.active);
  return next !== undefined ? next.index : incumbent;
}
