/*
 * consoleHandSelectModel — PURE, DOM-free derivation of the MANDATORY
 * hand-SELECT mode (the server `handSelect` task: discard / reveal / keep /
 * place a card FROM the player's own hand). The console routes any SelectCard
 * whose candidates are all already in hand to the hand carousel in select mode
 * — the console twin of the desktop КАРТЫ В РУКЕ select overlay — instead of the
 * generic card browser.
 *
 * The shell feeds the raw `SelectCardModel` + every card shown in the carousel
 * (cardsInHand + Self-Replicating-Robots hosts); this module derives the
 * pickable set, the single-vs-multi flag (min===max===1 → A submits in one
 * press), whether the prompt is a CONDITIONAL subset of the hand (→ the
 * "suitable only" filter is meaningful), and the per-card «why not» reasons.
 *
 * i18n is INJECTED (`translateReason`) so the module stays manifest- and
 * locale-free and runs under the server test runner. Unit-tested by
 * tests/client/components/console/consoleHandSelectModel.spec.ts.
 */

import {Message} from '@/common/logs/Message';
import {SelectCardModel} from '@/common/models/PlayerInputModel';

export interface HandSelectDerivation {
  /** Candidate (pickable) card names — the prompt's `cards`. */
  selectable: ReadonlyArray<string>;
  /** min===max===1 → A submits the focused card directly (no toggle+confirm). */
  single: boolean;
  /** The candidates are a STRICT subset of the shown hand (some cards can't be
   *  picked) → the "suitable only" filter is meaningful. */
  filtered: boolean;
  /** Per-card pre-translated «why not» reason for a NON-candidate hand card
   *  (the server's `disabledReason` when supplied, else the generic fallback). */
  reasons: Record<string, string>;
}

/**
 * Derive the select-mode facts from the prompt + the hand.
 *
 * @param model      the top-level SelectCard whose candidates are all in hand.
 * @param handNames  every card name shown in the carousel (cardsInHand + SRR).
 * @param translateReason  localizes a card's `disabledReason` (a `string` key /
 *   a `Message`) OR — when passed `undefined` — returns the generic
 *   "can't be chosen" fallback line. Injected so this module is i18n-free.
 */
export function deriveHandSelect(
  model: SelectCardModel,
  handNames: ReadonlyArray<string>,
  translateReason: (reason: string | Message | undefined) => string,
): HandSelectDerivation {
  const selectable = model.cards.map((c) => c.name);
  const selectableSet = new Set<string>(selectable);
  const reasons: Record<string, string> = {};
  // Server-supplied disabled candidates carry their own reason.
  for (const d of model.disabledCards ?? []) {
    reasons[d.name] = translateReason(d.disabledReason);
  }
  // Every OTHER hand card the prompt didn't offer gets the honest generic line
  // (the server didn't expose the concrete rule for these).
  for (const name of handNames) {
    if (!selectableSet.has(name) && reasons[name] === undefined) {
      reasons[name] = translateReason(undefined);
    }
  }
  return {
    selectable,
    single: model.min === 1 && model.max === 1,
    filtered: selectable.length < handNames.length,
    reasons,
  };
}

/** The accumulated multi-select picks satisfy the prompt bounds → RT confirms. */
export function handSelectPicksValid(bounds: {min: number, max: number}, pickedCount: number): boolean {
  return pickedCount >= bounds.min && pickedCount <= bounds.max;
}
