/*
 * THE CARD THE DRAW JUST BROUGHT, in the album of a question LEFT FOR AFTER THE DRAW (2026-10-15 — «Конференция на
 * Олимпе» × «Марсианский университет»).
 *
 * The player skipped the university's question in the composer precisely to see the card Olympus draws first; when
 * the question comes, live, that card must be findable among the rest of the hand — it wears «НОВАЯ КАРТА» (the colony
 * bonus's own badge, `con-hand__fresh`). The composer ARMS this at its commit with the askers it handed on and the hand
 * it left; the album reads the cards in the hand that were not in it.
 *
 * Scoped to ONE action: the arm carries the action's key (the generation + the player's actions taken — the server
 * counts an action only once its whole chain has resolved, so the key holds across every question of the play and
 * moves on with the next action). A later question of the same asker in another action reads nothing.
 */
import {reactive} from 'vue';

export const deferredDiscardState = reactive({
  askers: [] as Array<string>,
  handBefore: [] as Array<string>,
  key: '',
});

/** The action's key: the generation and the player's actions taken this game. */
export function deferredDiscardKey(generation: number, actionsTaken: number): string {
  return `${generation}:${actionsTaken}`;
}

/** The composer's commit handed these askers on: remember the hand it left (the played card already out of it). */
export function armDeferredDiscards(askers: ReadonlyArray<string>, handBefore: ReadonlyArray<string>, key: string): void {
  deferredDiscardState.askers = [...askers];
  deferredDiscardState.handBefore = [...handBefore];
  deferredDiscardState.key = key;
}

export function clearDeferredDiscards(): void {
  deferredDiscardState.askers = [];
  deferredDiscardState.handBefore = [];
  deferredDiscardState.key = '';
}

/**
 * The cards of `hand` the draw brought since the commit — for a discard asked by `asker` within the same action;
 * empty otherwise.
 */
export function freshCardsForDeferredDiscard(asker: string | undefined, hand: ReadonlyArray<string>, key: string): Array<string> {
  if (asker === undefined || key === '' || deferredDiscardState.key !== key || !deferredDiscardState.askers.includes(asker)) {
    return [];
  }
  const before = new Set(deferredDiscardState.handBefore);
  return hand.filter((name) => !before.has(name));
}
