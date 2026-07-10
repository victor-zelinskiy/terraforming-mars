/*
 * The play-card composer's bottom command-bar mirror.
 *
 * Hints live ONLY in the shell's ONE bottom command bar (never inline) — same
 * contract as the colony-trade composer (`consoleColoniesUi`). The play
 * composer (ConsolePlayCardConfirm) computes its CONTEXTUAL controls
 * (`playComposerFootHints` — LB/RB only where a value dials, LT only when the
 * payment is configurable, A the smart primary, Y to change a resolved choice,
 * X inspect, B cancel) and publishes them here; the shell's `commands()` reads
 * them verbatim for the `pendingPlayCard` surface. This replaces the old
 * hard-coded, DIVERGED command list (which showed X = «Разыграть» while A
 * actually plays, and static LB/RB −1/+1 even in a pure-auto payment).
 */
import {reactive} from 'vue';
import type {FootHint} from '@/client/console/consolePlayCardComposer';

// `FootHint` ({control, control2?, label, enabled?}) is a structural subset of
// the command bar's `ConsoleCommand`, so the shell can render these verbatim.
// (Imported from the pure .ts composer — NOT the .vue command bar — because the
// webpack `*.vue` shim exposes only the default export.)

export const consolePlayCardUi = reactive({
  /** The composer's live footer hints, ready for the command bar. */
  commands: [] as ReadonlyArray<FootHint>,
});

export function setConsolePlayCardCommands(commands: ReadonlyArray<FootHint>): void {
  consolePlayCardUi.commands = commands;
}

export function resetConsolePlayCardUi(): void {
  consolePlayCardUi.commands = [];
}
