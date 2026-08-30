/*
 * Console-native Hydronetwork UI state (the console-only layer OVER the shared
 * hydroNetworkState plan brain). Module-level reactive so it survives the
 * workspace's own unmount (a park / a lateral move): the pre-commit DRAFT —
 * the stage-7 composition — and the live command contract both live here.
 *
 * `commands` is the DEDICATED command store (the consoleStartUi idiom): the
 * hydro section coexists with surfaces that can steal the bar (the embedded
 * deck pick, the repeat browser), so it publishes into its own slot and the
 * shell's ladder reads it only when the hydro frame genuinely owns the bar.
 *
 * Transient by design: reset on leaving the flow. Never persisted.
 */
import {reactive} from 'vue';
import type {CardName} from '@/common/cards/CardName';
import type {ConsoleCommand} from '@/client/console/consoleCommandModel';
import type {ConsoleRepeatPickResult} from '@/client/console/consoleRepeatPick';

export const consoleHydroUi = reactive({
  /** The live command contract of the hydro screen (the bar never guesses). */
  commands: [] as Array<ConsoleCommand>,
  /** The COMPOSED stage-7 repeat pick (chosen action + its pre-collected
   *  responses, from the ДЕЙСТВИЯ КАРТ repeat surface). Console-only — the
   *  shared plan brain keeps just `selectedCard`; the batch tail uses this
   *  ONLY while its `chosenCard` still matches the plan's selected card
   *  (a stale composition silently degrades to the bare card pick, whose
   *  follow-ups then arrive as native tasks — the legacy contract). */
  repeatResult: undefined as ConsoleRepeatPickResult | undefined,
  /** Candidates the ORDERED RESOURCE PLAN cannot feed under any payment
   *  composition of the current move — handed to the repeat browser as its
   *  greyed rows (name + the pre-translated honest reason). Written by the
   *  section on the pick emit; read once by the shell's browser opener. */
  repeatDisabled: [] as Array<{name: CardName, reason: string}>,
});

export function resetConsoleHydroUi(): void {
  consoleHydroUi.commands = [];
  consoleHydroUi.repeatResult = undefined;
  consoleHydroUi.repeatDisabled = [];
}

// (The flow-record half of the console hydro state lives in
// hydroFlow/consoleHydroFlow.ts — this module keeps only what must survive
// the workspace's own unmount.)
