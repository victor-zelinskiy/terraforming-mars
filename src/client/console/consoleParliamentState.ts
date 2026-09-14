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

/*
 * «ONCE PER GENERATION» OUTLIVES A RELOAD. The results scene retells what
 * already happened; replaying it because the page reloaded (or the app
 * resumed the game) is replaying history. The marks live on this device,
 * bounded — the newest few `<viewer>:<generation>` keys — and a storage that
 * cannot be read degrades to the in-memory mark alone.
 */
const RECAP_SEEN_STORAGE = 'tm_parliament_recap_seen';
const RECAP_SEEN_LIMIT = 24;

function storedRecapMarks(): Array<string> {
  try {
    const raw = typeof window === 'undefined' ? null : window.localStorage.getItem(RECAP_SEEN_STORAGE);
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

export function parliamentRecapSeen(key: string): boolean {
  return consoleParliamentUi.recapSeen === key || storedRecapMarks().includes(key);
}

export function markParliamentRecapSeen(key: string): void {
  consoleParliamentUi.recapSeen = key;
  try {
    const marks = storedRecapMarks().filter((mark) => mark !== key);
    marks.push(key);
    window.localStorage.setItem(RECAP_SEEN_STORAGE, JSON.stringify(marks.slice(-RECAP_SEEN_LIMIT)));
  } catch {
    // No storage on this host: the in-memory mark still holds for the session.
  }
}
