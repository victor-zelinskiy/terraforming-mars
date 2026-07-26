/*
 * THE COLONY BONUS SEQUENCE — pure.
 *
 * Pluto's colony bonus pays "draw 1, then discard 1", and by the rules EACH
 * colony resolves separately and in FULL before the next one is revealed. A
 * player with three cubes therefore answers three payouts in a row, and must
 * never see all three cards before choosing what to throw away.
 *
 * The console shows that sequence as one premium table: one ZONE per colony,
 * exactly one of them active. The whole layout is derived from the server's
 * structural marker on the pending discard prompt (`{colonyName, index, total}`)
 * plus the reveal batch that arrived with it — nothing is carried across
 * batches, because `index`/`total` already say where in the sequence we are.
 *
 * Both surfaces that render the step (the reveal modal and the shell's command
 * bar) read these helpers, so they can never disagree.
 */

import {ColonyBonusDiscardMeta} from '@/common/models/PlayerInputModel';

/**
 * done   — this colony's card was taken and its discard answered (earlier in
 *          the sequence). A calm completion mark, no actions, out of nav.
 * active — the colony resolving right now: its card is on the table (flipping
 *          open, then takeable) and its own discard button lives under it.
 * future — a colony whose bonus has not started. Its card is NOT known yet
 *          (the server draws it only after this one finishes), so the zone
 *          shows a face-down placeholder: "there is another bonus coming".
 */
export type BonusZoneState = 'done' | 'active' | 'future';

export type BonusZone = {
  /** 1-based position in the recipient's sequence of colonies on this tile. */
  index: number,
  total: number,
  state: BonusZoneState,
};

/**
 * One zone per colony the recipient owns on this tile, in resolution order.
 * A single cube yields a single (active) zone — the ordinary case is unchanged.
 */
export function bonusZones(meta: ColonyBonusDiscardMeta | undefined): ReadonlyArray<BonusZone> {
  if (meta === undefined) {
    return [];
  }
  const total = Math.max(1, meta.total);
  const current = Math.min(Math.max(1, meta.index), total);
  const zones: Array<BonusZone> = [];
  for (let index = 1; index <= total; index++) {
    zones.push({
      index,
      total,
      state: index < current ? 'done' : index === current ? 'active' : 'future',
    });
  }
  return zones;
}

export type BonusDiscardStep = {
  /** Which colony of the sequence this step closes (1-based) and of how many. */
  index: number,
  total: number,
  /**
   * English i18n key. Deliberately NOT the prompt's own
   * 'Select a card to discard' (an imperative sentence): this is a BUTTON that
   * takes the player to the pick. Always singular — one colony, one card.
   */
  label: string,
  /**
   * Unlocked once every card currently on the table has been taken: this
   * colony's bonus card, and (on the trade's first payout) the trade income
   * that arrived with it. Choosing what to throw away before taking what you
   * were given would be the wrong order.
   */
  ready: boolean,
  /** Honest reason while locked ('' when ready) — never a dead control. */
  lockedReason: string,
};

export const BONUS_DISCARD_LOCKED_REASON = 'Take every card first';
export const BONUS_DISCARD_LABEL = 'Pick a card to discard';

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
  const total = Math.max(1, meta.total);
  const ready = untakenCards <= 0;
  return {
    index: Math.min(Math.max(1, meta.index), total),
    total,
    label: BONUS_DISCARD_LABEL,
    ready,
    lockedReason: ready ? '' : BONUS_DISCARD_LOCKED_REASON,
  };
}
