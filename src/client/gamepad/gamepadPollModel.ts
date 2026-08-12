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
  /** `analog` marks a LEFT-STICK-sourced direction (absent = d-pad). List
   *  navigation treats both identically; press→release surfaces (the quick
   *  wheel) ignore analog nav and speak the `aim` protocol instead. */
  | {kind: 'nav', dir: NavDirection, repeat: boolean, analog?: boolean}
  /** The directional FALLING edge (d-pad / stick let go, or rocked away from
   *  `dir`). Consumed by press→release surfaces (the quick wheel's armed
   *  slots); every list-navigation consumer ignores it. */
  | {kind: 'navEnd', dir: NavDirection, analog?: boolean}
  /**
   * The WHEEL-GRADE left-stick protocol (independent of `nav` so list
   * cadence and wheel focus can never fight): `aim` fires when the stick
   * CONFIDENTLY engages a sector or crosses into a new one (angular
   * hysteresis applied — no flicker at diagonal borders); `aimEnd` fires
   * once when the stick has CONFIRMED neutral (held inside the release
   * radius for {@link AIM_NEUTRAL_MS}) — the commit edge. A noise blip, a
   * release flick through the opposite sector, stick drift below the engage
   * radius: none of them produce an aim/aimEnd pair.
   */
  | {kind: 'aim', dir: NavDirection}
  | {kind: 'aimEnd'}
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
 * The AIM protocol's radial thresholds (hysteresis pair): a sector ENGAGES
 * only past the deliberate-deflection radius; NEUTRAL requires falling back
 * inside the release radius. Deliberately wider apart than the nav deadzone —
 * a wheel commit rides this edge, so noise, drift and half-hearted deflection
 * must all stay outside the protocol entirely.
 */
export const AIM_ENGAGE_AT = 0.45;
export const AIM_RELEASE_AT = 0.3;
/** Neutral must HOLD this long before `aimEnd` fires — a single noisy polling
 *  frame (or the spring-back overshoot of a flicked stick) never commits. */
export const AIM_NEUTRAL_MS = 45;
/**
 * Angular hysteresis at sector borders: the current sector keeps ownership
 * until the stick points this many degrees PAST the 45° diagonal boundary —
 * circling the stick hands focus over decisively, never flickering on the
 * border between two neighbours.
 */
export const AIM_HYSTERESIS_DEG = 12;
/** During the neutral-confirm window a REDEFLECTION must sustain this many
 *  consecutive polls to re-aim — the release flick's momentary swing through
 *  the opposite sector (1-2 fast frames) is ignored. */
export const AIM_REAIM_FRAMES = 3;

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
  /** AIM protocol: the engaged sector ('' = tracking not engaged). */
  aimSector: NavDirection | '',
  /** When the stick first settled inside the release radius (0 = not settling). */
  aimNeutralSince: number,
  /** A mid-settle redeflection candidate + how many polls it has sustained. */
  aimCandidate: NavDirection | '',
  aimCandidateFrames: number,
};

export function initialPollState(): PollState {
  return {
    heldDir: undefined, nextRepeatAt: 0, triggerLDown: false, triggerRDown: false,
    aimSector: '', aimNeutralSince: 0, aimCandidate: '', aimCandidateFrames: 0,
  };
}

/**
 * A protocol is mid-flight in the carry state (a held direction, a digital
 * trigger, an engaged aim sector). The poll loop's idle early-out MUST keep
 * diffing while this is true: the aim protocol's neutral-confirm timer needs
 * frames AFTER the stick already reads as at-rest — an early-out there would
 * freeze the engaged sector and swallow the `aimEnd` commit edge forever.
 */
export function pollStatePending(state: PollState): boolean {
  return state.heldDir !== undefined || state.triggerLDown || state.triggerRDown ||
    state.aimSector !== '';
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

/** The held d-pad direction (undefined = no d-pad input). */
function dpadDirection(s: GamepadSnapshot): NavDirection | undefined {
  for (const [idx, dir] of DPAD) {
    if (pressedAt(s, idx)) {
      return dir;
    }
  }
  return undefined;
}

/** The left stick as a coarse d-pad (dominant axis past the radial deadzone). */
function stickDirection(s: GamepadSnapshot, deadzone: number): NavDirection | undefined {
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

// ── the AIM protocol's pure geometry ────────────────────────────────────────

/** Stick angle in degrees, 0 = right, 90 = down (screen Y), normalized 0..360. */
function aimAngleOf(x: number, y: number): number {
  const a = Math.atan2(y, x) * (180 / Math.PI);
  return a < 0 ? a + 360 : a;
}

const AIM_SECTOR_CENTER: Readonly<Record<NavDirection, number>> = {
  right: 0, down: 90, left: 180, up: 270,
};

function angularDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** The sector an angle plainly falls into (45° diagonals). */
function plainAimSector(angle: number): NavDirection {
  if (angle >= 315 || angle < 45) {
    return 'right';
  }
  if (angle < 135) {
    return 'down';
  }
  if (angle < 225) {
    return 'left';
  }
  return 'up';
}

/**
 * Sector resolution with ANGULAR HYSTERESIS: the current sector keeps
 * ownership until the stick points {@link AIM_HYSTERESIS_DEG} degrees past
 * the diagonal border — circling hands focus over decisively; resting near a
 * border never flickers between neighbours.
 */
function hysteresisAimSector(angle: number, current: NavDirection | ''): NavDirection {
  if (current !== '' && angularDistance(angle, AIM_SECTOR_CENTER[current]) <= 45 + AIM_HYSTERESIS_DEG) {
    return current;
  }
  return plainAimSector(angle);
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

  // 3. Directional navigation with hold-repeat (d-pad OR left stick; d-pad
  //    wins while both are engaged). The FALLING edge (`navEnd`) is emitted
  //    both on full release and on a direction change (the old direction
  //    ends, the new one begins) — the press→release consumers see a
  //    coherent down/up pairing per direction. `analog` marks the frames the
  //    STICK sources the direction (the wheel never digital-arms on those).
  const dpadDir = dpadDirection(next);
  const dir = dpadDir ?? stickDirection(next, deadzone);
  const analog = dpadDir === undefined;
  if (dir === undefined) {
    if (out.heldDir !== undefined) {
      intents.push({kind: 'navEnd', dir: out.heldDir, analog});
    }
    out.heldDir = undefined;
  } else if (dir !== out.heldDir) {
    // Fresh direction (or a direction change) fires immediately.
    if (out.heldDir !== undefined) {
      intents.push({kind: 'navEnd', dir: out.heldDir, analog});
    }
    out.heldDir = dir;
    out.nextRepeatAt = now + NAV_REPEAT_DELAY_MS;
    intents.push({kind: 'nav', dir, repeat: false, analog});
  } else if (now >= out.nextRepeatAt) {
    out.nextRepeatAt = now + NAV_REPEAT_INTERVAL_MS;
    intents.push({kind: 'nav', dir, repeat: true, analog});
  }

  // 3.5. The AIM protocol — the left stick as the quick wheel's focus hand.
  //      Sector events only on CONFIDENT transitions; the commit edge
  //      (`aimEnd`) only after a CONFIRMED neutral. See the intent docs for
  //      the exact guarantees (noise / flick / drift safety).
  {
    const ax = next.axes[0] ?? 0;
    const ay = next.axes[1] ?? 0;
    const mag = Math.hypot(ax, ay);
    const angle = aimAngleOf(ax, ay);
    if (out.aimSector === '') {
      // Engage only on a deliberate deflection — and never while the d-pad
      // holds a direction (the digital press owns the wheel then).
      if (mag >= AIM_ENGAGE_AT && dpadDir === undefined) {
        out.aimSector = plainAimSector(angle);
        out.aimNeutralSince = 0;
        out.aimCandidate = '';
        out.aimCandidateFrames = 0;
        intents.push({kind: 'aim', dir: out.aimSector});
      }
    } else if (mag <= AIM_RELEASE_AT) {
      // Inside the release radius — start / continue confirming neutral.
      out.aimCandidate = '';
      out.aimCandidateFrames = 0;
      if (out.aimNeutralSince === 0) {
        out.aimNeutralSince = now;
      } else if (now - out.aimNeutralSince >= AIM_NEUTRAL_MS) {
        out.aimSector = '';
        out.aimNeutralSince = 0;
        intents.push({kind: 'aimEnd'});
      }
    } else if (out.aimNeutralSince !== 0) {
      // Re-deflection DURING the neutral confirm: a release flick swings
      // through the far sector for a frame or two — only a SUSTAINED
      // deflection re-aims; returning to the held sector resumes tracking.
      if (mag >= AIM_ENGAGE_AT) {
        const sec = hysteresisAimSector(angle, out.aimSector);
        if (sec === out.aimSector) {
          out.aimNeutralSince = 0;
          out.aimCandidate = '';
          out.aimCandidateFrames = 0;
        } else if (out.aimCandidate === sec) {
          out.aimCandidateFrames++;
          if (out.aimCandidateFrames >= AIM_REAIM_FRAMES) {
            out.aimSector = sec;
            out.aimNeutralSince = 0;
            out.aimCandidate = '';
            out.aimCandidateFrames = 0;
            intents.push({kind: 'aim', dir: sec});
          }
        } else {
          out.aimCandidate = sec;
          out.aimCandidateFrames = 1;
        }
      } else {
        // The in-between band interrupts the neutral confirm — a finger
        // resting there is neither neutral nor a deflection.
        out.aimNeutralSince = 0;
      }
    } else {
      // Normal tracking: retarget on a confident cross into a neighbour
      // (angular hysteresis); the in-between band keeps the current sector.
      if (mag >= AIM_ENGAGE_AT) {
        const sec = hysteresisAimSector(angle, out.aimSector);
        if (sec !== out.aimSector) {
          out.aimSector = sec;
          intents.push({kind: 'aim', dir: sec});
        }
      }
    }
  }

  // 4. Right stick → scroll (analog, per-frame while deflected).
  const dx = normalizeAxis(next.axes[2] ?? 0, SCROLL_DEADZONE);
  const dy = normalizeAxis(next.axes[3] ?? 0, SCROLL_DEADZONE);
  if (dx !== 0 || dy !== 0) {
    intents.push({kind: 'scroll', dx, dy});
  }

  return {intents, state: out};
}

/** One pad's contribution to a poll frame. */
export type PadFrame = {
  index: number,
  active: boolean,
  /**
   * Did this pad produce a DECISIVE edge this frame — something a human
   * deliberately DID (see {@link decisiveEdge})? Drift, hold-repeat and analog
   * scroll are deliberately NOT decisive: they are exactly what a neglected pad
   * emits forever while nobody touches it.
   */
  edge?: boolean,
};

/** The election's carry state: who drives, and when they last actually acted. */
export type ElectionState = {
  /** Index of the pad driving the UI (-1 = none elected yet). */
  index: number,
  /** `now` of the incumbent's last decisive edge (0 = it has never acted). */
  edgeAt: number,
};

export function initialElectionState(): ElectionState {
  return {index: -1, edgeAt: 0};
}

/**
 * How long the incumbent must have gone WITHOUT a decisive edge before another
 * pad's edge may take the wheel. Two constraints pin this value: it must be
 * far ABOVE the poll period (8ms) so two mirrored views of ONE controller can
 * never ping-pong mid-press, and far BELOW human "put this pad down, pick that
 * one up" time so a real controller swap feels instant.
 */
export const HANDOVER_SILENCE_MS = 400;

/**
 * Did this frame's intents contain a DELIBERATE act? Only a fresh press, a
 * fresh (non-repeat) direction or an aim engage counts.
 *
 * What is excluded is the whole point: `scroll` and repeat `nav` are emitted
 * CONTINUOUSLY by a pad nobody is holding — a stick resting off-centre, a
 * trigger with a non-zero rest value, a wet/worn sensor. Treating those as
 * "this pad is in use" is what let an untouched pad hold the wheel forever.
 */
export function decisiveEdge(intents: ReadonlyArray<GamepadIntent>): boolean {
  return intents.some((i) =>
    i.kind === 'press' || i.kind === 'aim' || (i.kind === 'nav' && !i.repeat));
}

/**
 * Choose the SINGLE pad that drives the UI this frame.
 *
 * `engaged` lists the pads that are NOT idle this frame (they produced input or
 * are releasing a held control — i.e. exactly the pads the poll loop diffed).
 *
 * ── WHY A SINGLE ELECTION IS LOAD-BEARING (the Steam Machine double-input) ──
 * Steam Input frequently exposes ONE physical controller as TWO "standard"
 * gamepads to the page — the raw device AND its virtual remap — both reporting
 * every button press. Without a single election the poll loop dispatched the
 * SAME edge from BOTH mirrors, so one d-pad tap moved the cursor TWO rows and a
 * toggle control (the in-game quick wheel) opened-then-closed on one press
 * (read as "the bumper does nothing"). Electing exactly one driver and
 * dispatching only its intents makes a mirrored duplicate inert.
 *
 * ── WHY THE HANDOVER RULE IS AN EDGE, NOT MERE "ENGAGEMENT" (the Deck bug) ──
 * Handing over only once the incumbent falls fully idle sounds equivalent, and
 * is not: `engaged` is true for a pad whose stick merely rests off-centre, whose
 * trigger reports a non-zero value at rest, or whose aim protocol is mid-flight.
 * Such a pad is engaged on EVERY frame forever, so the incumbency became
 * PERMANENT and a genuine second controller could never take the wheel — every
 * one of its presses was diffed, then dropped undispatched. On a docked Steam
 * Deck that is precisely the report: the built-in controls keep working and an
 * external pad does nothing, even though the page sees it.
 *
 * So the incumbent holds the wheel while it keeps ACTING, and a challenger that
 * ACTS takes over once the incumbent has been decision-silent for
 * {@link HANDOVER_SILENCE_MS}. Mirrors stay inert (a mirror's edge arrives
 * within a poll or two of the driver's own, far inside the silence window),
 * while an untouched pad — however noisy — can no longer hold anything.
 */
export function electActivePad(
  engaged: ReadonlyArray<PadFrame>,
  election: ElectionState,
  now: number,
): ElectionState {
  const incumbent = engaged.find((p) => p.index === election.index);

  // 1. The incumbent ACTED — it keeps the wheel, and its mirror stays inert.
  if (incumbent?.edge === true) {
    return {index: election.index, edgeAt: now};
  }

  // 2. Someone else ACTED while the incumbent has been decision-silent (or has
  //    never acted / does not exist): the wheel changes hands THIS frame, so
  //    the press that won the election is also the press that gets dispatched.
  const challenger = engaged.find((p) => p.edge === true && p.index !== election.index);
  const silent = election.index === -1 || election.edgeAt === 0 ||
    now - election.edgeAt >= HANDOVER_SILENCE_MS;
  if (challenger !== undefined && silent) {
    return {index: challenger.index, edgeAt: now};
  }

  // 3. No decisive edge to arbitrate: stay sticky. The incumbent keeps the
  //    wheel while it is engaged at all (so its RELEASE still dispatches);
  //    otherwise the last merely-active pad drives, inheriting the silence
  //    timer — it has not acted, so it must not be able to lock anyone out.
  if (incumbent !== undefined) {
    return election;
  }
  const next = engaged.find((p) => p.active);
  return next !== undefined ? {index: next.index, edgeAt: election.edgeAt} : election;
}
