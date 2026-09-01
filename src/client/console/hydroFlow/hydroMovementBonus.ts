/*
 * @console-shared LIVE — console native stands on this file, so it is NOT covered
 * by the desktop-UI deprecation. Full quality bar applies (tests, guards, i18n).
 *
 * THE MOVEMENT'S PASSIVE HALF — «ДОПОЛНИТЕЛЬНО».
 *
 * A tableau card may pay its owner for MOVEMENT on the Hydronetwork itself,
 * whoever moved (Social Heating: heat per actual step). When the viewer plans
 * their OWN move, that payment is part of the outcome, so it belongs beside
 * the stage reward — before the confirm, and again in the result.
 *
 * WHAT THIS MODULE IS ALLOWED TO DO, and what it deliberately cannot:
 *  - it SHAPES a server-authored projection (`DeltaMovementBonusProjection` —
 *    which card, what resource, how much, before → after) into the two things
 *    the console needs: a reading and a flight;
 *  - it NEVER computes an amount. There is no tableau lookup here, no step
 *    multiplication, no card table. The server asked the very
 *    `deltaMovementBonus` hooks the commit pays out; the numbers below are
 *    that answer, carried unchanged. A promise this makes IS the payout.
 *
 * WHERE THE HEAT FLIES FROM, AND WHEN. The bonus is caused by the MOVEMENT,
 * not by the landed stage — so it rides the marker's own arrival wave rather
 * than opening a scene of its own: one aggregate delivery, at the destination,
 * after the token has actually travelled. On a multi-cell traversal that means
 * the LAST leg (the destination), never one chip per crossed cell — «the
 * player must understand the source and the total», not watch ten conflicting
 * overlays. The card is named in the reading; the wave is the physical
 * consequence of the move that earned it.
 *
 * PURE — no Vue / DOM / i18n; unit-tested next to the other hydro mappers.
 */
import type {DeltaMovementBonusProjection} from '@/common/models/DeltaTrackPreviewModel';
import {
  ResourceTransferSpec, mergeTransferSpecs,
} from '@/client/console/resourceTransfer/resourceTransferModel';

/** One leg of an armed traversal, as far as this module cares. */
type LegWithTransfers = {transfers: ReadonlyArray<ResourceTransferSpec>};

/**
 * The panel-bound flight for the projected bonuses: a STOCK chip per resource,
 * merged. Every bonus resource is a standard resource with a live metric in the
 * always-visible panel, so nothing degrades silently here; a future bonus in a
 * pool with no metric would simply contribute no chip (the reading still names
 * it), exactly like the Jovian tag in `hydroRewardTransfers`.
 */
export function movementBonusTransfers(
  bonuses: ReadonlyArray<DeltaMovementBonusProjection> | undefined,
): Array<ResourceTransferSpec> {
  if (bonuses === undefined || bonuses.length === 0) {
    return [];
  }
  return mergeTransferSpecs(bonuses
    .filter((b) => b.amount > 0)
    .map((b): ResourceTransferSpec => ({channel: 'stock', resource: b.resource, amount: b.amount})));
}

/**
 * Append the movement's own wave to the DESTINATION leg of a traversal plan —
 * one aggregate delivery when the marker finally stops, never a chip per cell.
 * Returns the legs unchanged when nothing is owed, so the historical plan is
 * byte-identical.
 */
export function withMovementBonusOnLastLeg<T extends LegWithTransfers>(
  legs: ReadonlyArray<T>,
  bonuses: ReadonlyArray<DeltaMovementBonusProjection> | undefined,
): Array<T> {
  const specs = movementBonusTransfers(bonuses);
  const out = [...legs];
  if (specs.length === 0 || out.length === 0) {
    return out;
  }
  const last = out[out.length - 1];
  out[out.length - 1] = {...last, transfers: mergeTransferSpecs([...last.transfers, ...specs])};
  return out;
}

/**
 * The total per resource — the result summary's own check that what the rail
 * shows and what the server granted are the same number.
 */
export function movementBonusTotal(
  bonuses: ReadonlyArray<DeltaMovementBonusProjection> | undefined,
): number {
  return (bonuses ?? []).reduce((sum, b) => sum + Math.max(0, b.amount), 0);
}
