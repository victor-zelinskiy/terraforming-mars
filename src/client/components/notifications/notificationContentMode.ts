/**
 * @console-shared LIVE — the NOTIFICATION CONTENT MODE preference (TR59 «ОДИН ВЗГЛЯД»).
 *
 * The second notification setting. «Быстрые уведомления» (`notificationFeedMode.ts`) decides WHICH toasts present;
 * this one decides WHAT a presented toast carries beyond its answer to the viewer:
 *
 *  - `brief` (default, «Кратко») — the answer (what changed for YOU, why, whose turn) + ONE quiet line of what the
 *    actor got (≤ 2 chips), a third player's line, a third player's skipped effect; everything else is the journal's.
 *  - `mine` («Только моё») — the answer alone: no actor line, no third players, no skipped effect that is not the
 *    viewer's.
 *
 * What NO mode may cut — the viewer's band (gains AND losses), its cause, the actor chip, the viewer's own skipped
 * effect, an attack on the viewer, warnings, the turn prompts — is the policy's contract
 * (`notificationContentPolicy.ts`), not this module's.
 *
 * LEAF module (imports nothing from the notification system), like the feed mode. Config: localStorage
 * `tm_notification_content` → default 'brief'. Pure client presentation — never game state, never sent anywhere.
 */
import {reactive} from 'vue';

const STORAGE_KEY = 'tm_notification_content';

export type NotificationContentMode = 'brief' | 'mine';
export const CONTENT_MODE_CHOICES: ReadonlyArray<NotificationContentMode> = ['brief', 'mine'];

/** English i18n keys for the settings ring (translated at render). */
export const CONTENT_MODE_LABELS: Readonly<Record<NotificationContentMode, string>> = {
  brief: 'Brief',
  mine: 'Only mine',
};

function storage(): Storage | undefined {
  try {
    return (globalThis as {localStorage?: Storage}).localStorage;
  } catch (err) {
    return undefined;
  }
}

function readInitial(): NotificationContentMode {
  return storage()?.getItem(STORAGE_KEY) === 'mine' ? 'mine' : 'brief';
}

/** Reactive so the Options row and the presentation gate read one value. */
export const notificationContentModeState = reactive({mode: readInitial()});

/**
 * Persist + apply. A VISIBLE card is never re-rendered by a mode change (ITERATION 3 — what is on screen does not
 * change in place); the policy is applied as each card leaves the queue, so the next card reads the new mode.
 */
export function setNotificationContentMode(mode: NotificationContentMode): void {
  notificationContentModeState.mode = mode;
  try {
    storage()?.setItem(STORAGE_KEY, mode);
  } catch (err) {
    // Private mode etc. — the in-session value still applies.
  }
}
