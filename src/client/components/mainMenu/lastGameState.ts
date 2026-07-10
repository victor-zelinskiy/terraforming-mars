/*
 * "Last game the player actually entered" — the honest signal for the console
 * main menu's CONTINUE action. The joinable-games list only carries
 * `createdTimeMs`, so a naive "newest" would resurface a game the player
 * created but abandoned instead of the one they last SAT DOWN at. This tiny
 * localStorage record fixes that: every time the console flow navigates INTO a
 * game (continue / my-games / a fresh create), it stamps the game id; the
 * menu then prefers that game (when it's still joinable) over newest-created.
 *
 * TEMPORARY / local-only, like the player identity — no auth, one place to
 * funnel reads/writes so a future account/server "resume" endpoint is a swap.
 */

const STORAGE_KEY = 'tm_last_game_entered';

function storage(): Storage | undefined {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

/** Stamp the game the player just entered (call right before navigating in). */
export function recordLastGameEntered(gameId: string): void {
  if (gameId === '') {
    return;
  }
  try {
    storage()?.setItem(STORAGE_KEY, gameId);
  } catch {
    // Private mode / quota — the fallback (newest-created) still applies.
  }
}

/** The last game id the player entered, or '' when none is recorded. */
export function lastGameEntered(): string {
  try {
    return storage()?.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}
