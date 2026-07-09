import {JSONObject} from '@/common/Types';

// The persisted "last create-game setup" lives under this key. In the vize1215
// fork the premium create screen (PremiumCreateGame.vue → createGameState.ts)
// is the only reader/writer; it stores the compact premium `config` object here.
const SETTINGS_KEY = 'tm_last_game_settings';

function getLocalStorage(): Storage | undefined {
  try {
    // Access can throw a SecurityError for opaque origins, and `localStorage`
    // is undefined under SSR / the JSDOM test runner unless registered.
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

// A cloned-game id is a one-shot handle to a specific game — it must never be
// restored into a fresh setup. (Harmless no-op for a premium config, which has
// no such field; kept so the helper stays a faithful, reusable persister.)
function settingsWithoutClonedGameId(settings: JSONObject): JSONObject {
  const sanitized = {...settings};
  delete sanitized.clonedGamedId;
  return sanitized;
}

/**
 * A tiny, backend-injectable persister for the last create-game setup.
 *
 * The backend defaults to `localStorage` (which, in the Electron desktop
 * client, is persisted per-origin under the app's userData partition and so
 * survives a restart — no extra IPC plumbing needed). Every access is guarded:
 * a missing / locked-down storage degrades to a silent no-op, and a corrupt
 * blob loads as `undefined` rather than throwing.
 */
export class CreateGameSettingsStorage {
  constructor(private readonly storage?: Storage) {
  }

  public saveSettings(settings: JSONObject): void {
    const storage = this.storage ?? getLocalStorage();
    if (storage === undefined) {
      return;
    }
    try {
      storage.setItem(SETTINGS_KEY, JSON.stringify(settingsWithoutClonedGameId(settings)));
    } catch (err) {
      console.warn('Unable to save create game settings:', err);
    }
  }

  public loadSettings(): JSONObject | undefined {
    const storage = this.storage ?? getLocalStorage();
    if (storage === undefined) {
      return undefined;
    }
    try {
      const data = storage.getItem(SETTINGS_KEY);
      if (data === null) {
        return undefined;
      }
      return JSON.parse(data) as JSONObject;
    } catch (err) {
      console.warn('Unable to load create game settings:', err);
      return undefined;
    }
  }

  public clearSettings(): void {
    const storage = this.storage ?? getLocalStorage();
    if (storage === undefined) {
      return;
    }
    try {
      storage.removeItem(SETTINGS_KEY);
    } catch (err) {
      console.warn('Unable to clear create game settings:', err);
    }
  }
}
