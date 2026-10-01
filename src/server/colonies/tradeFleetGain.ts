import {MAX_FLEET_SIZE} from '../../common/constants';
import {TRADE_FLEET_ICON} from '../../common/colonies/tradeFleet';
import {ActionEffect} from '../../common/models/ActionPreviewModel';
import {IPlayer} from '../IPlayer';

/**
 * «GAIN A TRADE FLEET» — ONE reading for the promise and the grant.
 *
 * The engine's `Colonies.increaseFleetSize` CAPS SILENTLY at `MAX_FLEET_SIZE`:
 * a card printing «gain an extra trade fleet» played by a seat that already
 * has four simply did nothing, and nothing said so (invariant 4 — no silent
 * loss). This module is the arithmetic both halves stand on:
 *  · the play preview's chip (`effectsForBehavior` — `behavior.colonies.
 *    addTradeFleet`): fleets `current → resulting`, noted «limit» when the cap
 *    cuts it, and the warning that NAMES the fleets lost;
 *  · the grant (`Executor`): the same count of lost fleets, recorded as an
 *    `effect-skipped` fact in the preview's own words.
 *
 * Deliberately dependency-free (the Executor imports it): no card builders,
 * no deferred actions.
 */

/** The icon key of the fleet chip (`common/colonies/tradeFleet.ts` — the client's journal draws the same one). */
export {TRADE_FLEET_ICON};
/** The effect's name in a «skipped» statement (the preview's warning, the journal's row). */
export const GAIN_TRADE_FLEET_LABEL = 'Gain a trade fleet';
/** Why a fleet gain is cut — the cap, in the words the Parliament's fleet action already uses. */
export const FLEET_LIMIT_REASON = 'Your trade fleet is already at its maximum';
/** The chip's note when the cap cuts the gain. */
export const FLEET_LIMIT_NOTE = 'limit';

/** How many of `amount` fleets the cap would cut for this player right now. READ-ONLY. */
export function tradeFleetsLost(player: IPlayer, amount: number): number {
  const room = Math.max(0, MAX_FLEET_SIZE - player.colonies.getFleetSize());
  return Math.max(0, amount - room);
}

/** The gain as a chip: fleets `current → resulting`, honest about the cap («4 → 4 · limit»). READ-ONLY. */
export function tradeFleetGainChip(player: IPlayer, amount: number): ActionEffect {
  const current = player.colonies.getFleetSize();
  const resulting = Math.min(MAX_FLEET_SIZE, current + amount);
  return {
    direction: 'gain', icon: TRADE_FLEET_ICON, amount, current, resulting,
    ...(tradeFleetsLost(player, amount) > 0 ? {note: FLEET_LIMIT_NOTE} : {}),
  };
}

/** WHAT a cut fleet gain loses — the one description the warning and the live record share. */
export function skippedTradeFleet(lost: number): {label: string, effect: ActionEffect} {
  return {label: GAIN_TRADE_FLEET_LABEL, effect: {direction: 'gain', icon: TRADE_FLEET_ICON, amount: lost}};
}
