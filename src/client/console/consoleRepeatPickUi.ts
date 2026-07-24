/*
 * The repeat-action pick surface's bottom command-bar mirror (the twin of
 * `consoleActionComposerUi` / `consolePlayCardUi`). `ConsoleCardActions` (repeat mode)
 * publishes its live contract here — the GRID contract while browsing the
 * candidate actions, or the nested composer's contract while composing the
 * chosen action (received via the composer's `@commands` emit, so the nested
 * composer never touches the shared `consoleActionComposerUi` the OUTER Viron
 * composer owns). The shell reads it whenever `consoleRepeatPickState.active`.
 */
import {reactive} from 'vue';
import type {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {ActionFilterState} from '@/client/components/actions/actionModel';
import {defaultRepeatFilter} from '@/client/console/consoleCardActions';

export const consoleRepeatPickUi = reactive({
  commands: [] as ReadonlyArray<ConsoleCommand>,
  /** The repeat grid's own filter (SEPARATE from the normal `consoleCardActionsUi`
   *  filter — a repeat instance may overlay a normal Action Center [Viron], so
   *  the two must not share the filter state). Defaults to «Активированы + Доступна». */
  filter: defaultRepeatFilter() as ActionFilterState,
});

export function setConsoleRepeatPickCommands(commands: ReadonlyArray<ConsoleCommand>): void {
  consoleRepeatPickUi.commands = commands;
}

export function resetConsoleRepeatPickUi(): void {
  consoleRepeatPickUi.commands = [];
  consoleRepeatPickUi.filter = defaultRepeatFilter();
}
