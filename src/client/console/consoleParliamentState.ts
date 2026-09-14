import {reactive} from 'vue';
import {ConsoleCommand} from '@/client/console/consoleCommandModel';

/**
 * The Parliament workspace's shell-facing state (Turmoil Redux): the live
 * command contract the section publishes for the ONE command bar. Module
 * state so it survives the section's own remounts; the section writes, the
 * shell reads — the bar never guesses.
 */
export const consoleParliamentUi = reactive({
  commands: [] as Array<ConsoleCommand>,
  /** The results scene already played for this `<viewer>:<generation>` — it plays ONCE per generation. */
  recapSeen: '' as string,
});

export function resetConsoleParliamentUi(): void {
  consoleParliamentUi.commands = [];
  consoleParliamentUi.recapSeen = '';
}
