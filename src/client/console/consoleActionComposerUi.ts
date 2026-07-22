/*
 * The action composer's bottom command-bar mirror (the twin of
 * `consolePlayCardUi`, replacing the composer's use of the SHARED
 * single-owner `consolePanelUi` slot).
 *
 * Why a dedicated store: the shared slot has ONE owner for every panel
 * (taskHost / infoMode / cardActions / …). While the action composer is up,
 * the Action Center deliberately stops publishing, and any ownership steal
 * (an unmount racing a mount, another panel grabbing the slot) left the
 * shell's fallback verbs — or nothing — under the CONFIRM surface. A
 * dedicated store makes the confirm's command contract unstealable: the
 * shell reads it whenever `open` is true, with an honest
 * [A Подтвердить · B Отмена] fallback of its own.
 */
import {reactive} from 'vue';
import type {ConsoleCommand} from '@/client/console/consoleCommandModel';

export const consoleActionComposerUi = reactive({
  /** True while the ACTION FOCUS stage is mounted (drives the shell branch). */
  open: false,
  /** The stage's live contract, ready for the command bar. */
  commands: [] as ReadonlyArray<ConsoleCommand>,
  /** The stage's headline mode — decisions to make («Настройка действия») vs
   *  a bare confirm («Подтверждение»). The frame header + the command-bar
   *  context read it, so the chrome always names the stage honestly. */
  mode: 'setup' as 'setup' | 'confirm',
});

export function setConsoleActionComposerCommands(commands: ReadonlyArray<ConsoleCommand>): void {
  consoleActionComposerUi.open = true;
  consoleActionComposerUi.commands = commands;
}

export function setConsoleActionComposerMode(mode: 'setup' | 'confirm'): void {
  consoleActionComposerUi.mode = mode;
}

export function resetConsoleActionComposerUi(): void {
  consoleActionComposerUi.open = false;
  consoleActionComposerUi.commands = [];
  consoleActionComposerUi.mode = 'setup';
}
