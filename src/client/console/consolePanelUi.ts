/**
 * consolePanelUi — the ONE mirror through which a mounted console panel
 * publishes its live command contract to the shell's command bar
 * (CONSOLE_TV_PREMIUM_PLAN.md §3.2: a hint lives EITHER on the object OR
 * in the bar — never in a panel-local footer AND the bar at once).
 *
 * The former per-panel `.con-*__foot` hint rows (TaskHost / Government
 * Support / Production Loss / Info Mode) are deleted; each panel now syncs
 * its contextual hints here (watch → setPanelCommands on mount/update,
 * clearPanelCommands on unmount), and ConsoleShell.commands() renders them
 * through the ONE ConsoleCommandBar. Panels never coexist (they share the
 * task slot / cover each other), so a single owner slot suffices; the
 * owner key guards against an unmount racing the next panel's mount.
 */
import {reactive} from 'vue';
import type {ConsoleCommand} from '@/client/console/consoleCommandModel';

type PanelOwner = 'taskHost' | 'govSupport' | 'productionLoss' | 'infoMode' | 'cardActions' | 'actionComposer';

export const consolePanelUi = reactive({
  owner: undefined as PanelOwner | undefined,
  commands: [] as Array<ConsoleCommand>,
});

export function setPanelCommands(owner: PanelOwner, commands: ReadonlyArray<ConsoleCommand>): void {
  consolePanelUi.owner = owner;
  consolePanelUi.commands = [...commands];
}

export function clearPanelCommands(owner: PanelOwner): void {
  if (consolePanelUi.owner === owner) {
    consolePanelUi.owner = undefined;
    consolePanelUi.commands = [];
  }
}

/** The shell-side read: the panel's live contract, or undefined when the
 *  expected panel hasn't published (fallback to the static set). */
export function panelCommands(owner: PanelOwner): ReadonlyArray<ConsoleCommand> | undefined {
  return consolePanelUi.owner === owner && consolePanelUi.commands.length > 0 ?
    consolePanelUi.commands : undefined;
}
