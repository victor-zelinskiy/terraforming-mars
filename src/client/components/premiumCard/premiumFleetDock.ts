/*
 * THE FLEET DOCK ON THE PREMIUM FACE — the one injection between the card
 * (`PremiumCard`, which knows the card is a dock and whose fleet stands on it)
 * and its mechanics plate (`PremiumMechNode`, which draws the ▲ of the printed
 * «when you trade, you can send the trade fleet to this card» effect).
 *
 * The ▲ carries a MARK SLOT — `[data-fleet-berth="card:<name>"]`, always laid
 * out, absolutely positioned (zero layout: the face never moves for a fleet).
 * It is two things at once: the flight's measured landing anchor (the trade
 * fleet director lands the proxy exactly here) and the home of the real mark
 * that replaces the proxy once the view applies.
 */

import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';

export const PCARD_FLEET_DOCK_KEY = 'pcardFleetDock';

export type PremiumFleetDockFace = {
  card: CardName,
  /** The fleet on the card (its owner's livery); undefined while the dock is free. */
  color: Color | undefined,
};

/** The berth selector value of a dock card (the flight layer resolves the same string). */
export function fleetDockBerthKey(card: CardName | string): string {
  return 'card:' + card;
}
