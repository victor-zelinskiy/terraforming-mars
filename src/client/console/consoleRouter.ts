/*
 * Console Mode router state + intent bridge (CONSOLE_MODE_CONCEPT.md §5/§13).
 *
 * The console shell's navigation model is Zones → Objects → Commands: this
 * module owns the module-level reactive state (survives console↔desktop
 * toggles) and the intent registration bridge GamepadLayer dispatches
 * through. The actual handling lives in ConsoleShell (it owns the DOM +
 * submission refs); the PURE pieces (section cycling, list stepping) live
 * here for unit tests.
 *
 * Fallback arbitration: the shell CLAIMS an intent only while no iteration-1
 * scope surface is mounted on top (mandatory modal / dialog / draft / …) —
 * in console mode the desktop scope roots (#player-home, overlays) don't
 * exist, so `resolveScope() !== undefined` EXACTLY means "a fallback surface
 * is open"; those intents fall through to the demoted DOM focus engine.
 */

import {reactive} from 'vue';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';

export type ConsoleSection = 'board' | 'hand';
export type ConsoleSheetId = 'projects' | 'milestones' | 'awards';
export type ConsoleConfirmKind = 'pass' | 'convertHeat';

export const CONSOLE_SECTIONS: ReadonlyArray<ConsoleSection> = ['board', 'hand'];

export const consoleState = reactive({
  section: 'board' as ConsoleSection,
  /** Hand carousel position (per-section memory). */
  handIndex: 0,
  /** Board selection (space id — stable across re-renders). */
  boardSpaceId: undefined as string | undefined,
  /** LT held during placement — inspect ANY cell, not just legal ones. */
  freeRoam: false,
  turnMenuOpen: false,
  turnMenuIndex: 0,
  sheet: undefined as ConsoleSheetId | undefined,
  sheetIndex: 0,
  confirm: undefined as ConsoleConfirmKind | undefined,
  /** True while a fallback (iteration-1) surface owns input — command bar switches its hints. */
  fallbackActive: false,
});

/** Reset transient layers (turn menu / sheets / confirm) — e.g. on submit. */
export function closeConsoleLayers(): void {
  consoleState.turnMenuOpen = false;
  consoleState.sheet = undefined;
  consoleState.sheetIndex = 0;
  consoleState.confirm = undefined;
}

/** PURE: next/prev section in the ring. */
export function cycleSection(current: ConsoleSection, step: 1 | -1): ConsoleSection {
  const idx = CONSOLE_SECTIONS.indexOf(current);
  const next = (idx + step + CONSOLE_SECTIONS.length) % CONSOLE_SECTIONS.length;
  return CONSOLE_SECTIONS[next];
}

/** PURE: clamp-step a list index (no wrap — the edge is felt). */
export function stepIndex(current: number, step: number, length: number): number {
  if (length <= 0) {
    return 0;
  }
  return Math.min(length - 1, Math.max(0, current + step));
}

// --- intent bridge (GamepadLayer → ConsoleShell) ---------------------------

type ConsoleIntentHandler = (intent: GamepadIntent) => boolean;

let handler: ConsoleIntentHandler | undefined;

export function registerConsoleIntentHandler(fn: ConsoleIntentHandler): () => void {
  handler = fn;
  return () => {
    if (handler === fn) {
      handler = undefined;
    }
  };
}

/** Returns true when the console shell consumed the intent. */
export function dispatchConsoleIntent(intent: GamepadIntent): boolean {
  return handler !== undefined ? handler(intent) : false;
}
