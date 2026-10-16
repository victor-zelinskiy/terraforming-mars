/*
 * @console-shared LIVE — THE «ДЕЙСТВИЯ» ZONE'S cursor and command contract (TR60, the Information workspace).
 *
 * The zone hosts the «Действия карт» tiles read-only (`ConsoleInfoActionGallery`): a cursor over the cards (the page
 * is derived from it — no second page state), X opens the face. Module state so the shell routes the pad and the
 * Information workspace republishes the bar verbatim — the extras / effects explorers' pattern. Reset on every
 * Information open (`ConsoleShell.openInfoMode`), so a reopened zone starts on its first card.
 */
import {reactive} from 'vue';
import type {ConsoleCommand} from '@/client/console/consoleCommandModel';

export const infoActionsUi = reactive({
  /** The card the cursor stands on (index into the zone's groups, status order). */
  cursor: 0,
  /** The zone's live command contract (undefined = not publishing). */
  barCommands: undefined as ReadonlyArray<ConsoleCommand> | undefined,
});

export function resetInfoActions(): void {
  infoActionsUi.cursor = 0;
  infoActionsUi.barCommands = undefined;
}
