export const INVALID_RUN_ID = '#invalid-run-id' as const;
/**
 * The submitted input was prepared against a prompt the server no longer
 * holds — the game state moved (a rebuilt action menu after a cache-evicted
 * game reloads, an undo, a bot's paced turn) while the client was still
 * showing the old one. The action was NOT applied; the client's recovery is
 * to refetch the player view and let the player retry against fresh state.
 */
export const STALE_PROMPT = '#stale-prompt' as const;
export type AppErrorId = '#invalid-run-id' | '#stale-prompt';

export type AppErrorResponse = {
  id: AppErrorId | undefined;
  message: string;
}
