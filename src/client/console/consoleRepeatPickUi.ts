/*
 * The repeat-action pick surface's bottom command-bar mirror (the twin of
 * `consoleActionComposerUi` / `consolePlayCardUi`). `ConsoleRepeatActionPick`
 * publishes its live contract here — the GRID contract while browsing the
 * candidate actions, or the nested composer's contract while composing the
 * chosen action (received via the composer's `@commands` emit, so the nested
 * composer never touches the shared `consoleActionComposerUi` the OUTER Viron
 * composer owns). The shell reads it whenever `consoleRepeatPickState.active`.
 */
import {reactive} from 'vue';
import type {ConsoleCommand} from '@/client/console/consoleCommandModel';

export const consoleRepeatPickUi = reactive({
  commands: [] as ReadonlyArray<ConsoleCommand>,
});

export function setConsoleRepeatPickCommands(commands: ReadonlyArray<ConsoleCommand>): void {
  consoleRepeatPickUi.commands = commands;
}

export function resetConsoleRepeatPickUi(): void {
  consoleRepeatPickUi.commands = [];
}
