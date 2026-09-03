import {reactive} from 'vue';
import {apiUrl} from '@/client/utils/runtimeConfig';
import {paths} from '@/common/app/paths';
import {GameId} from '@/common/Types';
import {
  AdminRollbackGameSummary,
  AdminRollbackHistory,
  AdminRollbackResult,
} from '@/common/models/AdminRollbackModel';

/**
 * Module-reactive state for the local game-rollback tool (the console
 * main-menu «Откат партий» plate → ConsoleAdminRollback.vue). Module-level so it
 * survives the overlay's `v-if` mount/unmount, mirroring lobbyState.
 *
 * All calls carry the player's display `name` — the server admits a LOOPBACK
 * connection regardless of the name (local games belong to the machine's
 * owner), or the ADMIN_NAME identity from anywhere (`rollbackAuthorized` in
 * src/server/models/adminRollback.ts).
 */
type AdminRollbackState = {
  games: ReadonlyArray<AdminRollbackGameSummary>;
  loadingGames: boolean;
  loadedGamesOnce: boolean;
  gamesError: boolean;

  history: AdminRollbackHistory | undefined;
  loadingHistory: boolean;
  historyError: boolean;

  submitting: boolean;
  submitError: boolean;
};

export const adminRollbackState: AdminRollbackState = reactive({
  games: [],
  loadingGames: false,
  loadedGamesOnce: false,
  gamesError: false,

  history: undefined,
  loadingHistory: false,
  historyError: false,

  submitting: false,
  submitError: false,
});

function nameQuery(name: string): string {
  return 'name=' + encodeURIComponent(name);
}

/** Load the full games list (fresh generation per game). */
export async function loadAdminGames(name: string): Promise<void> {
  adminRollbackState.loadingGames = true;
  adminRollbackState.gamesError = false;
  try {
    const resp = await fetch(apiUrl(paths.API_ADMIN_ROLLBACK_GAMES + '?' + nameQuery(name)));
    if (!resp.ok) {
      throw new Error(`status ${resp.status}`);
    }
    adminRollbackState.games = await resp.json() as ReadonlyArray<AdminRollbackGameSummary>;
  } catch (err) {
    console.error('loadAdminGames failed', err);
    adminRollbackState.gamesError = true;
  } finally {
    adminRollbackState.loadingGames = false;
    adminRollbackState.loadedGamesOnce = true;
  }
}

/** Load one game's full save history. */
export async function loadAdminHistory(name: string, gameId: GameId): Promise<void> {
  adminRollbackState.loadingHistory = true;
  adminRollbackState.historyError = false;
  adminRollbackState.history = undefined;
  try {
    const resp = await fetch(apiUrl(paths.API_ADMIN_ROLLBACK_HISTORY + '?id=' + encodeURIComponent(gameId) + '&' + nameQuery(name)));
    if (!resp.ok) {
      throw new Error(`status ${resp.status}`);
    }
    adminRollbackState.history = await resp.json() as AdminRollbackHistory;
  } catch (err) {
    console.error('loadAdminHistory failed', err);
    adminRollbackState.historyError = true;
  } finally {
    adminRollbackState.loadingHistory = false;
  }
}

/** Perform the rollback. Returns the fresh result, or undefined on failure. */
export async function performAdminRollback(name: string, gameId: GameId, saveId: number): Promise<AdminRollbackResult | undefined> {
  adminRollbackState.submitting = true;
  adminRollbackState.submitError = false;
  try {
    const resp = await fetch(
      apiUrl(paths.API_ADMIN_ROLLBACK + '?id=' + encodeURIComponent(gameId) + '&saveId=' + saveId + '&' + nameQuery(name)),
      {method: 'POST'});
    if (!resp.ok) {
      throw new Error(`status ${resp.status}`);
    }
    return await resp.json() as AdminRollbackResult;
  } catch (err) {
    console.error('performAdminRollback failed', err);
    adminRollbackState.submitError = true;
    return undefined;
  } finally {
    adminRollbackState.submitting = false;
  }
}

/** Clear the detail view state (on leaving a game / closing the tool). */
export function clearAdminHistory(): void {
  adminRollbackState.history = undefined;
  adminRollbackState.historyError = false;
  adminRollbackState.submitError = false;
}
