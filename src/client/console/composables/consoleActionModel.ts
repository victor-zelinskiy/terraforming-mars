/*
 * CONSOLE ACTION MODEL — the PURE semantic vocabulary of the console-native
 * UI (foundation layer; rules in CONSOLE_FOUNDATION.md §2).
 *
 * Three layers, strictly ordered:
 *   physical input (KeyboardEvent / Gamepad API)
 *     → SemanticButton / GamepadIntent   (gamepadPollModel — device semantics)
 *       → ConsoleAction                  (THIS module — screen semantics)
 *
 * Components of the console-native flow are expected to speak ConsoleAction
 * (via `consoleActionOf` or `useConsoleInput`), NEVER raw KeyboardEvent and
 * ideally not raw button names — so a binding change (or a future remapping
 * setting) is a table edit here, not a per-component hunt.
 *
 * This module is deliberately PURE: no DOM, no Vue reactivity, no VueUse —
 * unit-testable under any runner. The ONE keyboard map of the whole console
 * flow also lives here (`CONSOLE_KEY_NAV` / `CONSOLE_KEY_BUTTON`): the
 * pre-game menu bridge and the global console key bridge both read it, so
 * desktop-fallback hotkeys can never drift between screens.
 */

import {GamepadIntent, NavDirection, SemanticButton} from '@/client/gamepad/gamepadPollModel';

/**
 * The screen-level semantic actions of the console-native UI.
 *
 * The BASE actions are what the default button map produces; the CONTEXTUAL
 * refinements (`confirm`/`cancel`/`launch`/the wheels) are the same physical
 * controls re-labelled by a specific screen via `ConsoleActionOverrides` —
 * e.g. a confirm dialog maps `primary → confirm`, the create-game screen maps
 * `inspect → launch`, the in-game shell maps the triggers to its quick wheels.
 */
export type ConsoleAction =
  // Base vocabulary (the default map).
  | 'primary' // A / Enter — activate the cursored element
  | 'back' // B / Escape — one level up
  | 'inspect' // X — «Осмотреть» (the console-wide inspect verb)
  | 'fullscreen' // Y — fullscreen / secondary view
  | 'prevSection' // LB / Q — section ring left
  | 'nextSection' // RB / E — section ring right
  | 'prevTab' // LT / [ — tab / filter left
  | 'nextTab' // RT / ] — tab / filter right
  | 'reset' // View / R — reset filters / defaults
  | 'system' // Menu / Start — the system overlay (owned by GamepadLayer)
  // Contextual refinements (per-screen overrides of the same controls).
  | 'confirm' // a dialog's explicit accept
  | 'cancel' // a dialog's explicit dismiss
  | 'launch' // create-game: launch the mission
  | 'openActionsWheel' // in-game RT quick selector
  | 'openStandardProjectsWheel'; // in-game LT quick selector

/**
 * The DEFAULT button → action map. Screens with a different contextual
 * meaning override entries via `ConsoleActionOverrides` — they never invent
 * a new physical binding locally.
 */
export const BASE_ACTION_OF_BUTTON: Readonly<Partial<Record<SemanticButton, ConsoleAction>>> = {
  confirm: 'primary',
  back: 'back',
  secondary: 'inspect',
  inspect: 'fullscreen',
  bumperL: 'prevSection',
  bumperR: 'nextSection',
  triggerL: 'prevTab',
  triggerR: 'nextTab',
  view: 'reset',
  menu: 'system',
  // stickL / stickR stay screen-specific (board inspection / free roam) —
  // no default action; screens read the raw intent for those.
};

/** Per-screen contextual re-labelling of the default map. */
export type ConsoleActionOverrides = Partial<Record<SemanticButton, ConsoleAction>>;

/**
 * Resolve a press intent to its semantic action (undefined for releases,
 * nav, scroll and unmapped buttons — those stay raw-intent territory).
 */
export function consoleActionOf(
  intent: GamepadIntent,
  overrides?: ConsoleActionOverrides,
): ConsoleAction | undefined {
  if (intent.kind !== 'press') {
    return undefined;
  }
  return overrides?.[intent.button] ?? BASE_ACTION_OF_BUTTON[intent.button];
}

/** Convenience predicate for hand-written intent handlers. */
export function isConsoleAction(
  intent: GamepadIntent,
  action: ConsoleAction,
  overrides?: ConsoleActionOverrides,
): boolean {
  return consoleActionOf(intent, overrides) === action;
}

// ── The ONE keyboard map of the console flow ───────────────────────────────
// (desktop debugging + mouse/keyboard users who forced ?console=1; the Deck
// itself always speaks the Gamepad API). Key names are KeyboardEvent.code.

export const CONSOLE_KEY_NAV: Readonly<Record<string, NavDirection>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

export const CONSOLE_KEY_BUTTON: Readonly<Record<string, SemanticButton>> = {
  Enter: 'confirm',
  NumpadEnter: 'confirm',
  Escape: 'back',
  KeyQ: 'bumperL',
  KeyE: 'bumperR',
  BracketLeft: 'bumperL',
  BracketRight: 'bumperR',
  Comma: 'triggerL',
  Period: 'triggerR',
  KeyX: 'secondary',
  KeyY: 'inspect',
  KeyR: 'view',
};

/**
 * Synthesize the GamepadIntent a keyboard event stands for (undefined =
 * not a console key; the event belongs to whoever else wants it).
 * Key REPEAT repeats navigation (mirrors the pad's hold-repeat) but never
 * re-fires a button press (mirrors the pad's edge detection).
 */
export function keyboardConsoleIntent(code: string, repeat: boolean): GamepadIntent | undefined {
  const dir = CONSOLE_KEY_NAV[code];
  if (dir !== undefined) {
    return {kind: 'nav', dir, repeat};
  }
  if (repeat) {
    return undefined;
  }
  const button = CONSOLE_KEY_BUTTON[code];
  return button !== undefined ? {kind: 'press', button} : undefined;
}
