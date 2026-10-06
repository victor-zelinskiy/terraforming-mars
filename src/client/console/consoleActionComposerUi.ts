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
  /* (No headline `mode` here any more: the stage's name follows its PHASE —
     `focusKicker` in consoleActionFlow, read by BOTH the frame header and the
     command bar. The old mode was published by the composer from
     `hasDecisions`, which depends on the async preview, so the title changed
     under the entering animation.) */
  /**
   * The action card whose deck-check REVEAL the focus stage presents
   * IN-FRAME ('' = none). Set at confirm time for a branch that carries a
   * reveal descriptor; the shell reads it to (a) keep the stage mounted when
   * the reveal lands (no closeConsoleLayers / no phase swap to the
   * standalone overlay) and (b) suppress the standalone reveal-result
   * overlay for exactly this reveal. Cleared on ack / stage unmount.
   */
  revealClaim: '' as string,
  /**
   * The action was SENT and its phrase is playing with no outcome stage of its own (PL-062): the stage is
   * «Выполнение». Published by the hosting «Действия карт» (which knows a real send from a capture), read by the
   * command bar beside `revealClaim` — the bar and the crumb name the stage from the same fact.
   */
  executing: false,
});

export function setConsoleActionComposerCommands(commands: ReadonlyArray<ConsoleCommand>): void {
  consoleActionComposerUi.open = true;
  consoleActionComposerUi.commands = commands;
}

export function setConsoleActionRevealClaim(cardName: string): void {
  consoleActionComposerUi.revealClaim = cardName;
}

export function setConsoleActionComposerExecuting(on: boolean): void {
  consoleActionComposerUi.executing = on;
}

export function resetConsoleActionRevealClaim(): void {
  consoleActionComposerUi.revealClaim = '';
}

export function resetConsoleActionComposerUi(): void {
  consoleActionComposerUi.open = false;
  consoleActionComposerUi.commands = [];
  consoleActionComposerUi.revealClaim = '';
  consoleActionComposerUi.executing = false;
}
