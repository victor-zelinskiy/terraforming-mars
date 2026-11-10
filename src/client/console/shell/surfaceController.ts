/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE SURFACE SHADE CONTROLLER — the shade behind a workspace surface and the transition hooks every surface's
 * `<Transition>` in the shell's template is given (`consoleSurfaceMotion`).
 *
 * Taken out of ConsoleShell.vue by scripts/shell-extract.mjs (architecture v2 — docs/claude/console/architecture-v2/
 * PLAN.md §5 · S2): the members are verbatim, every `this.` rewritten — own members are locals, the rest of the shell
 * is the PORT below. The template still lives in the shell and reads these members by name.
 */
import {computed} from 'vue';
import {promptReceiveState} from '@/client/console/cardReceive/promptReceive';
import {draftTrayState} from '@/client/console/cardDeal/consoleDraftTray';
import {isTradeFleetActive} from '@/client/console/colonyFleet/consoleTradeFleet';
import {surfaceShadeOn} from '@/client/console/surfaceMotion/surfaceMotionState';
import {surfaceEnterHook, surfaceLeaveHook, surfaceEnterCancelledHook, surfaceLeaveCancelledHook} from '@/client/console/surfaceMotion/surfaceMotionDirector';

export function createSurfaceController() {
  // ── derived ──────────────────────────────────────────────────────────────────────────────────────────────────────
  /** The surface-motion shade (`.con-shade--on`): ≥1 migrated band surface
   *  owns the foreground, a committed submit is awaiting its answer, or
   *  the trade-fleet flight keeps its thin veil over the colony grid. */
  const surfaceShadeVisible = computed((): boolean => {
    return surfaceShadeOn() || isTradeFleetActive();
  });

  /** The shade thins to a light veil: the task host's table beat (draft
   *  tray owns the screen) and the trade-fleet launch (ship focal, grid
   *  readable) — mirrors the retired per-surface backdrop rules. */
  const surfaceShadeVeil = computed((): boolean => {
    return draftTrayState.tableView || isTradeFleetActive();
  });

  /**
   * The FIELD owns the screen for a live pick's answer (TR53 iteration — the card the player chose is carried out
   * of the plate onto the board, beside the cell that pays it): the dim lets go entirely, the board is the stage.
   */
  const surfaceShadeClear = computed((): boolean => {
    return promptReceiveState.board;
  });

  return {
    surfaceShadeVisible,
    surfaceShadeVeil,
    surfaceShadeClear,
    surfaceEnterHook,
    surfaceLeaveHook,
    surfaceEnterCancelledHook,
    surfaceLeaveCancelledHook,
  };
}

export type SurfaceController = ReturnType<typeof createSurfaceController>;
