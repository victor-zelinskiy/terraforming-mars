/*
 * LT INFORMATION MODE state (feedback iteration 3, priority 1).
 *
 * The console-native "what do I need to know" mode: a read-only, full-screen
 * player dashboard (resources/production, tags, extra card resources, cards/
 * actions/effects availability, VP) with LB/RB player switching and hotkey
 * details. NEVER submits anything, NEVER mutates game state.
 *
 * Context restore: opening captures a SNAPSHOT of the console navigation
 * state; closing restores it EXACTLY (screen, sheet, indices, board cell,
 * sale picks). Restoration is validated by the shell's existing clamps
 * (stepIndex / stepSelectable / spotlight re-apply), so a server update
 * that invalidated something degrades to the nearest valid state, never a
 * broken screen. A mandatory prompt is untouched — the fallback surfaces
 * render ABOVE this mode and keep claiming input.
 */

import {reactive} from 'vue';
import {Color} from '@/common/Color';
import {consoleState, ConsoleSection, ConsoleSheetId} from '@/client/console/consoleRouter';

// The bot-specific details replace the human ones while the viewed
// participant is MarsBot: its printed board (tracks), the played pile and
// the open bonus piles — the human extras/actions/effects don't exist for it.
export type InfoDetail = 'extras' | 'actions' | 'effects' | 'vp' | 'botBoard' | 'botPlayed' | 'botBonus';

/** What LT-open captures and LT-close restores. */
export type ConsoleContextSnapshot = {
  section: ConsoleSection,
  sheet: ConsoleSheetId | undefined,
  sheetIndex: number,
  handIndex: number,
  boardSpaceId: string | undefined,
  colonyIndex: number,
  cellFocused: boolean,
  saleActive: boolean,
  saleSelected: Array<string>,
};

export const infoModeState = reactive({
  open: false,
  /** Whose profile is displayed (defaults to the viewer on open). */
  playerColor: undefined as Color | undefined,
  detail: undefined as InfoDetail | undefined,
  snapshot: undefined as ConsoleContextSnapshot | undefined,
});

/** PURE-ish: capture the current console navigation context. */
export function captureConsoleSnapshot(cellFocused: boolean): ConsoleContextSnapshot {
  return {
    section: consoleState.section,
    sheet: consoleState.sheet,
    sheetIndex: consoleState.sheetIndex,
    handIndex: consoleState.handIndex,
    boardSpaceId: consoleState.boardSpaceId,
    colonyIndex: consoleState.colonyIndex,
    cellFocused,
    saleActive: consoleState.sale.active,
    saleSelected: [...consoleState.sale.selected],
  };
}

/**
 * Restore the captured context into consoleState. Returns the restored
 * `cellFocused` flag (owned by the shell). The shell's reactive clamps
 * (index steppers, spotlight watcher, sheet row rebuild) re-validate every
 * field against the CURRENT game state — a vanished sheet row / cell / card
 * degrades to the nearest valid selection instead of a broken state.
 */
export function restoreConsoleSnapshot(snap: ConsoleContextSnapshot): boolean {
  consoleState.section = snap.section;
  consoleState.sheet = snap.sheet;
  consoleState.sheetIndex = snap.sheetIndex;
  consoleState.handIndex = snap.handIndex;
  consoleState.boardSpaceId = snap.boardSpaceId;
  consoleState.colonyIndex = snap.colonyIndex;
  consoleState.sale.active = snap.saleActive;
  consoleState.sale.selected = [...snap.saleSelected];
  return snap.cellFocused;
}

export function openInfoMode(viewer: Color, cellFocused: boolean): void {
  if (infoModeState.open) {
    return;
  }
  infoModeState.snapshot = captureConsoleSnapshot(cellFocused);
  infoModeState.playerColor = viewer;
  infoModeState.detail = undefined;
  infoModeState.open = true;
}

/** Close + hand the snapshot back (undefined when nothing was captured). */
export function closeInfoMode(): ConsoleContextSnapshot | undefined {
  const snap = infoModeState.snapshot;
  infoModeState.open = false;
  infoModeState.detail = undefined;
  infoModeState.snapshot = undefined;
  return snap;
}

/** PURE: cycle the viewed player. */
export function cyclePlayer(colors: ReadonlyArray<Color>, current: Color | undefined, step: 1 | -1): Color | undefined {
  if (colors.length === 0) {
    return undefined;
  }
  const at = current !== undefined ? colors.indexOf(current) : -1;
  if (at === -1) {
    return colors[0];
  }
  return colors[(at + step + colors.length) % colors.length];
}
