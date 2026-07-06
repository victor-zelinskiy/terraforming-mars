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
import {HandTagFilter} from '@/client/components/console/consoleHandFilter';

export type ConsoleSection = 'board' | 'hand' | 'colonies' | 'hydro';
export type ConsoleSheetId = 'milestones' | 'awards' | 'cardActions' | 'standardProjects' | 'hydroPick';
export type ConsoleConfirmKind = 'pass' | 'convertHeat';
/** P27: which QUICK SELECTOR is open — RT (categories) / LT (basic actions). */
export type ConsoleQuickId = 'actions' | 'basics';

export const CONSOLE_SECTIONS: ReadonlyArray<ConsoleSection> = ['board', 'hand'];

export const consoleState = reactive({
  section: 'board' as ConsoleSection,
  /** Hand grid selection position (per-section memory). */
  handIndex: 0,
  /** Hand tag filter (LT/RT cycle, R3 reset). `'all'` = no narrowing. */
  handTagFilter: 'all' as HandTagFilter,
  /** Board selection (space id — stable across re-renders). */
  boardSpaceId: undefined as string | undefined,
  /** Colonies screen selection. */
  colonyIndex: 0,
  /** R3 toggle during placement — inspect ANY cell, not just legal ones. */
  freeRoam: false,
  /**
   * P27: BOARD INSPECTION MODE (L3). On the board home the cells are NOT
   * part of the normal command loop — the player enters inspection
   * explicitly; placement mode keeps its own automatic cell navigation.
   */
  inspecting: false,
  /** P27b: SCALE INSPECTION MODE (R3) — the cursor cycles the track bonuses. */
  scaleInspecting: false,
  /** P27: the focused global-parameter TRACK marker key (scale inspection). */
  trackMarker: undefined as string | undefined,
  /** P27: the open quick selector (RT = categories / LT = basic actions). */
  quick: undefined as ConsoleQuickId | undefined,
  sheet: undefined as ConsoleSheetId | undefined,
  sheetIndex: 0,
  confirm: undefined as ConsoleConfirmKind | undefined,
  /** Sell-patents mode of the hand carousel (A toggles, X confirms). */
  sale: {active: false, selected: [] as Array<string>},
  /** True while a fallback (iteration-1) surface owns input — command bar switches its hints. */
  fallbackActive: false,
  /** WHICH fallback scope owns input (lifecycle-aware command-bar naming). */
  fallbackScopeId: '' as string,
  /** ConsoleShell presence (the layer shows the generic hint bar elsewhere). */
  shellMounted: false,
  /** CTS task-host UI state: B defers the task to inspect the board. */
  task: {deferred: false},
});

/** Reset transient layers (quick selectors / sheets / confirm / sale) — e.g. on submit. */
export function closeConsoleLayers(): void {
  consoleState.quick = undefined;
  consoleState.sheet = undefined;
  consoleState.sheetIndex = 0;
  consoleState.confirm = undefined;
  consoleState.sale.active = false;
  consoleState.sale.selected = [];
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

/**
 * PURE: step across a list that contains non-selectable rows (sheet group
 * headers): move `step` from `current`, landing only on selectable indices;
 * stays put when nothing selectable lies in that direction. `current` may
 * itself be non-selectable (fresh open) — the first move normalizes it.
 */
export function stepSelectable(
  current: number,
  step: -1 | 1 | 0,
  selectable: ReadonlyArray<boolean>,
): number {
  const n = selectable.length;
  if (n === 0) {
    return 0;
  }
  if (step === 0) {
    // Normalize: current if selectable, else the first selectable at/after it, else before it.
    for (let i = Math.min(current, n - 1); i < n; i++) {
      if (selectable[i]) {
        return i;
      }
    }
    for (let i = Math.min(current, n - 1); i >= 0; i--) {
      if (selectable[i]) {
        return i;
      }
    }
    return 0;
  }
  for (let i = current + step; i >= 0 && i < n; i += step) {
    if (selectable[i]) {
      return i;
    }
  }
  return current;
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
