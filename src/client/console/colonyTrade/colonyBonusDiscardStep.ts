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
import {CardDrawRevealSource, ColonyTradeRevealSegment} from '@/common/models/CardDrawRevealModel';

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
 * THE OUT-OF-TRADE OWNER BONUS — the batch that belongs to the zone although
 * it carries no trade segments.
 *
 * ProductiveOutpost and Yvonne pay Pluto's «draw 1, then discard 1» OUTSIDE
 * any trade window, so the draw carries no trade tag and the batch arrives
 * with `tradeSegments: undefined` — while the mandatory-discard MARKER (what
 * the zones are derived from) rides the prompt exactly as in a trade. The
 * wave split alone then classified the card as ordinary income: it rendered
 * as a bare strip slot BESIDE its own zone, and the cardless ACTIVE zone fell
 * through to the taken-socket branch — a ✓ «this colony has paid» over a card
 * the player had not taken.
 *
 * The structural proof that the batch IS the zone's: the discard marker is
 * pending, the batch's own source names the SAME colony, no segments claim
 * otherwise, and the batch holds exactly the ONE card the rules draw per
 * cube. Anything else (a merged trade batch, a foreign colony's draw, a
 * multi-card payout) keeps the segment-driven split.
 */
export function segmentlessZoneBatch(
  source: CardDrawRevealSource | undefined,
  segments: ReadonlyArray<ColonyTradeRevealSegment> | undefined,
  meta: ColonyBonusDiscardMeta | undefined,
  cardCount: number,
): boolean {
  return meta !== undefined && segments === undefined && cardCount === 1 &&
    source?.type === 'colony' && source.colonyName === meta.colonyName;
}

/**
 * DOES THIS PENDING DISCARD BELONG TO THE BATCH ON THE TABLE?
 *
 * The marker is a property of the SERVER's current prompt; the batch is a
 * property of the screen — and the two are only the same thing when the batch
 * is that colony's payout. They were read as one: every surface derived from
 * `waitingFor.discardPrompt.colonyBonus` alone (the closing step, the zones,
 * the income/bonus split, and — worst — the take path's follow-up hold).
 *
 * A foreign trade's marker can arrive while the viewer is working through a
 * reveal of their OWN (a card action's draw, an unrelated colony's income).
 * Unscoped, that batch grew a «сбросить карту» step it does not owe, rendered
 * bonus ZONES for somebody else's colony, and — because the take path reads
 * «a discard is owed» as «this batch is not finished» — held itself open on
 * its own last card: never released, never acked, no way back.
 *
 * A batch with no source cannot be disowned (there is nothing to judge it by),
 * so it keeps today's behaviour: the step stays reachable rather than stranding
 * the player with a mandatory discard and no door to it.
 */
export function bonusDiscardOwnsBatch(
  meta: ColonyBonusDiscardMeta | undefined,
  source: CardDrawRevealSource | undefined,
): boolean {
  if (meta === undefined) {
    return false;
  }
  return source === undefined ||
    (source.type === 'colony' && source.colonyName === meta.colonyName);
}

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
