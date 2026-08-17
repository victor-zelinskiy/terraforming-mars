/**
 * @console-shared LIVE — the QUICK-NOTIFICATION FEED MODE preference.
 *
 * Which of the EXISTING top-right transient toasts the player wants to see:
 *
 *  - `all` (default) — every toast the feed produces today. Backward
 *    compatible: this mode must stay byte-equivalent to the pre-setting
 *    behaviour.
 *  - `personal` — only toasts that DIRECTLY involve the viewer (they are the
 *    target of an action/effect, they gain or lose something, their personal
 *    state changes) plus the exempt families the setting never touches
 *    (hostile losses, warnings, turn prompts, game-completion announcements).
 *
 * The decision itself lives in ONE place — `notificationFeedPolicy.ts`,
 * applied by `notificationState.pushTransient` — this module only owns the
 * persisted MODE. It filters PRESENTATION only: the journal, the event
 * stream, visual commits and mandatory surfaces are never affected.
 *
 * LEAF module (imports nothing from the notification system) so the store,
 * the policy and the settings model can all read it without a cycle.
 *
 * Config: localStorage `tm_notification_feed` → default 'all'. Pure client
 * presentation — never part of game state, never sent to the server.
 */
import {reactive} from 'vue';

const STORAGE_KEY = 'tm_notification_feed';

export type NotificationFeedMode = 'all' | 'personal';
export const FEED_MODE_CHOICES: ReadonlyArray<NotificationFeedMode> = ['all', 'personal'];

/** English i18n keys for the settings ring (translated at render). */
export const FEED_MODE_LABELS: Readonly<Record<NotificationFeedMode, string>> = {
  all: 'All events',
  personal: 'Only involving me',
};

function storage(): Storage | undefined {
  try {
    return (globalThis as {localStorage?: Storage}).localStorage;
  } catch (err) {
    return undefined;
  }
}

function readInitial(): NotificationFeedMode {
  const raw = storage()?.getItem(STORAGE_KEY);
  return raw === 'personal' ? 'personal' : 'all';
}

/** Reactive so the Options row, the push gate and the queue reconciler react. */
export const notificationFeedModeState = reactive({mode: readInitial()});

/**
 * Persist + apply the feed mode. Already-VISIBLE toasts are deliberately not
 * touched (they finish their own lifecycle); the store's mode watcher
 * re-checks only the QUEUED (not-yet-shown) models against the new mode.
 */
export function setNotificationFeedMode(mode: NotificationFeedMode): void {
  notificationFeedModeState.mode = mode;
  try {
    storage()?.setItem(STORAGE_KEY, mode);
  } catch (err) {
    // Private mode etc. — the in-session value still applies.
  }
}
