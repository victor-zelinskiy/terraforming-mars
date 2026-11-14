/**
 * @console-shared — «Уведомления разработчика» («Настройки» → ДИАГНОСТИКА).
 *
 * The developer's notice (`ConsoleDevNotice`) puts an error or a stall of the screen ON the screen the moment it is
 * recorded. It is an instrument for whoever develops the game — a window into what the nets do silently by design
 * (the owner, 2026-11-07: a cured stall must look to the player as if there was none) — and noise for a player. So it
 * is an opt-in, OFF by default: nobody inherits it ON, and a player who never opens this category never meets it.
 *
 *  · `off`    — nothing is shown (the journal still records everything);
 *  · `errors` — exceptions and integrity warnings;
 *  · `all`    — those and every stall of the screen.
 *
 * Persisted; applied live. (The other diagnostics setting — automatic reports — is not kept here: it is the HUB's,
 * because it must also govern what the main process sends before any page exists — `diagnosticsHubState.ts`.)
 */
import {reactive} from 'vue';
import {DiagKind} from '@/common/diagnostics/DiagnosticModel';

export type DevNoticeMode = 'off' | 'errors' | 'all';

export const DEV_NOTICE_MODES: ReadonlyArray<DevNoticeMode> = ['off', 'errors', 'all'];

/** The storage key — also for an e2e that arms the notice before boot. */
export const DEV_NOTICE_KEY = 'tm_diag_dev_notices';

function readStored(): DevNoticeMode {
  try {
    const raw = (globalThis as {localStorage?: Storage}).localStorage?.getItem(DEV_NOTICE_KEY);
    return raw === 'errors' || raw === 'all' ? raw : 'off';
  } catch {
    return 'off';
  }
}

export const devNoticeState = reactive({mode: readStored()});

export function setDevNoticeMode(mode: DevNoticeMode): void {
  devNoticeState.mode = mode;
  try {
    const storage = (globalThis as {localStorage?: Storage}).localStorage;
    if (mode === 'off') {
      storage?.removeItem(DEV_NOTICE_KEY);
    } else {
      storage?.setItem(DEV_NOTICE_KEY, mode);
    }
  } catch {
    // storage unavailable — the in-session choice still applies
  }
}

/** Does a record of this kind raise the developer's notice under this mode? Pure. */
export function devNoticeShows(mode: DevNoticeMode, kind: DiagKind): boolean {
  if (mode === 'off') {
    return false;
  }
  if (kind === 'error' || kind === 'integrity') {
    return true;
  }
  return mode === 'all' && kind === 'stall';
}
