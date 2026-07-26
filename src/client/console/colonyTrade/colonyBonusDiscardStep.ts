/*
 * THE COLONY BONUS'S CLOSING STEP — pure.
 *
 * Pluto's colony bonus pays "draw N, then discard N". The draw and the discard
 * are ONE payout, so the console reveal modal hosts the discard as its final,
 * mandatory step instead of letting it arrive as a detached prompt the player
 * cannot connect to the trade they just made.
 *
 * This is the shared derivation behind that step: the reveal overlay renders it
 * and the shell's command bar labels A with it, so the two can never disagree
 * about whether the step is unlocked or how it is called.
 */

import {ColonyBonusDiscardMeta} from '@/common/models/PlayerInputModel';

export type BonusDiscardStep = {
  /** How many cards must go — one per cube the recipient owns on the colony. */
  count: number,
  /**
   * English i18n key. Deliberately NOT the prompt's own
   * 'Select a card to discard' (an imperative sentence): this is a BUTTON that
   * takes the player to the pick.
   */
  label: string,
  /**
   * Unlocked only once every card of the payout has been taken — the bonus
   * cards AND the trade income. Choosing what to throw away before seeing
   * everything that arrived would be the wrong order.
   */
  ready: boolean,
  /** Honest reason while locked ('' when ready) — never a dead control. */
  lockedReason: string,
};

export const BONUS_DISCARD_LOCKED_REASON = 'Take every card first';

/**
 * @param meta the server's structural marker on the pending discard prompt
 * @param untakenCards cards of the reveal batch the player has not taken yet
 */
export function bonusDiscardStep(
  meta: ColonyBonusDiscardMeta | undefined,
  untakenCards: number,
): BonusDiscardStep | undefined {
  if (meta === undefined) {
    return undefined;
  }
  const count = Math.max(1, meta.count);
  const ready = untakenCards <= 0;
  return {
    count,
    label: count > 1 ? 'Pick cards to discard' : 'Pick a card to discard',
    ready,
    lockedReason: ready ? '' : BONUS_DISCARD_LOCKED_REASON,
  };
}
