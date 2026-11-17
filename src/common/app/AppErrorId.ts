export const INVALID_RUN_ID = '#invalid-run-id' as const;
/**
 * The submitted input was prepared against a prompt the server no longer
 * holds — the game state moved (a rebuilt action menu after a cache-evicted
 * game reloads, an undo, a bot's paced turn) while the client was still
 * showing the old one. The action was NOT applied; the client's recovery is
 * to refetch the player view and let the player retry against fresh state.
 */
export const STALE_PROMPT = '#stale-prompt' as const;
/**
 * The action led to a question that has no possible answer («pick one card» of none) — the server REFUSED to ask it
 * (`server/liveness/UnanswerablePrompt.ts`): the action failed where it ran and the seat keeps the question it had.
 * The server's `message` is a diagnostic line in English; the client says it in its OWN words, by this id, in the
 * player's language (`UNANSWERABLE_QUESTION_TEXT` — an i18n key).
 */
export const UNANSWERABLE_QUESTION = '#unanswerable-question' as const;
/** What the player reads for `UNANSWERABLE_QUESTION` — the English text is the i18n key. */
export const UNANSWERABLE_QUESTION_TEXT = 'This action could not be completed: it led to a choice with no possible answer. Choose another action.';
export type AppErrorId = '#invalid-run-id' | '#stale-prompt' | '#unanswerable-question';

export type AppErrorResponse = {
  id: AppErrorId | undefined;
  message: string;
}
