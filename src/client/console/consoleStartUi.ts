/*
 * The start-scene's bottom command-bar mirror.
 *
 * Hints live ONLY in the shell's ONE bottom command bar (never inline) — same
 * contract as the play-card composer (`consolePlayCardUi`) and the colony-trade
 * composer (`consoleColoniesUi`). ConsoleStartScene computes its CONTEXTUAL
 * controls (`footHints` — wizard step vs. summary vs. ceremony: Navigate, A
 * select/act, X inspect, RT continue / begin, LB prev step, B minimize) and
 * publishes them here; the shell's `commands()` reads them verbatim for the
 * `startTask` surface. This replaces the old hard-coded, DIVERGED command list
 * (which showed X = «Продолжить» while X actually INSPECTS, and never surfaced
 * the RT «Начать партию» / «Продолжить» that the scene's footer already had).
 */
import {reactive} from 'vue';
import type {GlyphControl} from '@/client/gamepad/glyphSets';

// A structural subset of the command bar's `ConsoleCommand`, so the shell can
// render these verbatim.
export type StartCommand = {control: GlyphControl, label: string, enabled?: boolean};

export const consoleStartUi = reactive({
  /** The scene's live footer hints, ready for the command bar. */
  commands: [] as ReadonlyArray<StartCommand>,
});

export function setConsoleStartCommands(commands: ReadonlyArray<StartCommand>): void {
  consoleStartUi.commands = commands;
}

export function resetConsoleStartUi(): void {
  consoleStartUi.commands = [];
}
