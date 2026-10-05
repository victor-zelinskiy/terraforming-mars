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
import {CardModel} from '@/common/models/CardModel';

export const PCARD_FLEET_DOCK_KEY = 'pcardFleetDock';

export type PremiumFleetDockFace = {
  card: CardName,
  /** The fleet on the card (its owner's livery); undefined while the dock is free. */
  color: Color | undefined,
};

/**
 * THE PUBLIC STATE A PRINTED FACE CARRIES — for a host that draws faces
 * NAME-ONLY on purpose (the «РАЗЫГРАНО» table: «nothing live re-renders a
 * resting pile»). The fleet standing on a dock is not a live counter, it is a
 * piece lying ON the card for the rest of the generation, and it is public:
 * the owner must find it in their own table and a rival in the one they
 * inspect. So such a host hands the face THIS — the card's name and its fleet,
 * nothing else — and only for a card that carries one: every other face stays
 * name-only, and the docked one renders exactly its printed self plus the
 * ship (no stored-resource capsule, no discount chip, no availability).
 */
export function publicFaceModel(card: CardModel | undefined): CardModel | undefined {
  if (card?.fleetDocked === undefined) {
    return undefined;
  }
  // ONE object per (card, livery): a resting pile re-rendering for somebody else's reason must not hand its
  // docked face a «new» model every time — the face would re-render for nothing.
  const key = card.name + '|' + card.fleetDocked;
  let model = publicFaceModels.get(key);
  if (model === undefined) {
    model = {name: card.name, fleetDocked: card.fleetDocked} as CardModel;
    publicFaceModels.set(key, model);
  }
  return model;
}

const publicFaceModels = new Map<string, CardModel>();

/** The berth selector value of a dock card (the flight layer resolves the same string). */
export function fleetDockBerthKey(card: CardName | string): string {
  return 'card:' + card;
}
