/*
 * THE INFORMATION WORKSPACE state (Y).
 *
 * The console-native "what do I need to know" overlay: a read-only player
 * dossier (participant summary, VP breakdown, played cards, extra resources,
 * the bot's internals screen) with LB/RB participant switching and a
 * semantic route model (`infoRoute.ts`). NEVER submits anything, NEVER
 * mutates game state.
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
import {consoleState} from '@/client/console/consoleRouter';
import {BotScreenEntry, InfoRouteId, InfoZoneId} from '@/client/console/infoRoute';

/**
 * What LT-open captures and LT-close restores.
 *
 * WHERE the player stands is NOT in here any more: `section` / `sheet` are
 * projections of the workspace stack, and Info Mode renders OVER whatever is
 * open without touching it — so the screen is still exactly where it was when
 * the mode closes, and there is nothing to put back. Only the transient
 * CURSORS (which row, which card, which cell, which sale picks) need saving.
 */
export type ConsoleContextSnapshot = {
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
  /**
   * The dismiss transition is still playing (open already false). The shell
   * keeps the WORKSPACE stacking state (`.con-main--info`) alive on
   * `open || closing` — dropping it at close START would trap the departing
   * panel's z-index back at the `.con-main` level and let a band surface
   * (sheet / task host) pop OVER the fading workspace. Cleared by the
   * shell's after-leave hook (settleInfoModeClose) and by a re-open.
   */
  closing: false,
  /** Whose profile is displayed (defaults to the viewer on open). */
  playerColor: undefined as Color | undefined,
  /**
   * WHERE the player stands inside the panel — a SEMANTIC route
   * (`infoRoute.ts`). It survives an LB/RB seat switch by contract: a route
   * the new participant cannot serve keeps the route and presents the
   * fallback, so cycling the table never loses the player's place.
   */
  route: 'summary' as InfoRouteId,
  /** The summary focus ring — which zone the cursor stands on. */
  summaryFocus: 'vp' as InfoZoneId,
  /** The «Экран бота» focus ring — which deep reference the cursor is on. */
  botScreenFocus: 'botBoard' as BotScreenEntry,
  /**
   * The score explorer's route PARAMS (`vpCategory` / `vpCards` routes).
   * Kept beside the route so an LB/RB seat switch preserves the SEMANTIC
   * depth («Карты» stay «Картами», «Ресурсные» — «Ресурсными»); the
   * invariant «params valid for the route» is owned by the write sites
   * (the explorer's descend verbs + the shell's infoBack).
   */
  vpCategoryKey: undefined as string | undefined,
  vpCardsGroup: undefined as string | undefined,
  snapshot: undefined as ConsoleContextSnapshot | undefined,
});

/** PURE-ish: capture the current console navigation context. */
export function captureConsoleSnapshot(cellFocused: boolean): ConsoleContextSnapshot {
  return {
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
  infoModeState.route = 'summary';
  infoModeState.summaryFocus = 'vp';
  infoModeState.botScreenFocus = 'botBoard';
  infoModeState.vpCategoryKey = undefined;
  infoModeState.vpCardsGroup = undefined;
  infoModeState.closing = false; // a re-open mid-dismiss reclaims the stage
  infoModeState.open = true;
}

/** Close + hand the snapshot back (undefined when nothing was captured). */
export function closeInfoMode(): ConsoleContextSnapshot | undefined {
  const snap = infoModeState.snapshot;
  infoModeState.open = false;
  infoModeState.closing = true;
  infoModeState.route = 'summary';
  infoModeState.vpCategoryKey = undefined;
  infoModeState.vpCardsGroup = undefined;
  infoModeState.snapshot = undefined;
  return snap;
}

/** The dismiss transition finished — release the workspace stacking state. */
export function settleInfoModeClose(): void {
  infoModeState.closing = false;
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
