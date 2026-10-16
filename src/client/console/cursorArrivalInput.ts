/*
 * The INPUT half of the cursor's arrival (TR58, `cursorArrival.ts`): a non-consuming observer of every console intent
 * — a step or a press during an arrival releases the gates at once, so the press lands on a posed cursor and input
 * never waits for a ring to finish arriving. Installed once by the shell.
 */
import {observeConsoleIntents} from '@/client/console/consoleRouter';
import {releaseCursorsOnInput} from '@/client/console/cursorArrival';

let uninstall: (() => void) | undefined;

export function installCursorArrivalInput(): void {
  if (uninstall !== undefined) {
    return;
  }
  uninstall = observeConsoleIntents((intent) => {
    if (intent.kind === 'nav' || intent.kind === 'press') {
      releaseCursorsOnInput();
    }
  });
}
