import {reactive} from 'vue';
import {AddToSteamResult, desktopBridge} from '@/client/components/desktop/desktopUpdateState';

/**
 * Shared "Add to Steam" state for the desktop shell (Windows only). ONE source of truth for:
 *  - the first-run OPT-IN prompt (shown once, and never if already added or previously dismissed),
 *  - the persistent "Add to Steam library" button in the desktop footer + the console menu
 *    (hidden once the shortcut is added).
 *
 * Everything is inert off the desktop shell / off Windows / on older shells (feature-detected),
 * so the web + Linux/Steam Deck never render any of it (on the Deck the install script owns the
 * shortcut). Mirrors the module-state pattern of desktopUpdateState.
 */

interface SteamShortcutState {
  /** The state has been fetched from the main process at least once. */
  loaded: boolean;
  /** Windows desktop shell that exposes the Steam bridge — everything is gated on this. */
  available: boolean;
  added: boolean;
  dismissed: boolean;
  firstRun: boolean;
  /** An add-to-Steam call is in flight. */
  busy: boolean;
  /** Last action outcome for transient button feedback ('' | 'failed'; success hides the button). */
  result: '' | 'failed';
}

export const steamShortcutState = reactive<SteamShortcutState>({
  loaded: false,
  available: false,
  added: false,
  dismissed: false,
  firstRun: false,
  busy: false,
  result: '',
});

let initialized = false;

/** Fetch the Steam state once. Idempotent — safe to call from every menu that renders the UI. */
export function initSteamShortcut(): void {
  if (initialized) {
    return;
  }
  initialized = true;
  const bridge = desktopBridge();
  if (
    bridge === undefined ||
    bridge.platform !== 'win32' ||
    typeof bridge.getSteamState !== 'function' ||
    typeof bridge.addToSteam !== 'function'
  ) {
    // Non-Windows / web / older shell — stays unavailable, nothing renders.
    steamShortcutState.loaded = true;
    return;
  }
  steamShortcutState.available = true;
  void bridge
    .getSteamState()
    .then((s) => {
      if (s !== undefined && s !== null) {
        steamShortcutState.added = s.added === true;
        steamShortcutState.dismissed = s.dismissed === true;
        steamShortcutState.firstRun = s.firstRun === true;
      }
      steamShortcutState.loaded = true;
    })
    .catch(() => {
      // On a fetch failure keep the button available (fail-open) but suppress the prompt.
      steamShortcutState.loaded = true;
    });
}

/** The persistent button is shown on Windows desktop until the shortcut is added. */
export function steamButtonVisible(): boolean {
  return steamShortcutState.available && steamShortcutState.loaded && !steamShortcutState.added;
}

/** The first-run prompt is shown once: Windows first launch, not yet added, not dismissed. */
export function steamPromptVisible(): boolean {
  return (
    steamShortcutState.available &&
    steamShortcutState.loaded &&
    steamShortcutState.firstRun &&
    !steamShortcutState.added &&
    !steamShortcutState.dismissed
  );
}

/** Register the shortcut. On success `added` flips true → the button + prompt disappear. */
export function addToSteam(): Promise<void> {
  const bridge = desktopBridge();
  if (bridge?.addToSteam === undefined || steamShortcutState.busy) {
    return Promise.resolve();
  }
  steamShortcutState.busy = true;
  steamShortcutState.result = '';
  return bridge
    .addToSteam()
    .then((result) => {
      const ok = (result as AddToSteamResult | undefined)?.ok === true;
      steamShortcutState.busy = false;
      steamShortcutState.result = ok ? '' : 'failed';
      if (ok) {
        steamShortcutState.added = true;
      }
    })
    .catch(() => {
      steamShortcutState.busy = false;
      steamShortcutState.result = 'failed';
    });
}

/** Record the "Not now" choice (persisted in the main process) so the prompt never returns. */
export function dismissSteamPrompt(): void {
  steamShortcutState.dismissed = true;
  void desktopBridge()?.dismissSteamPrompt?.();
}
