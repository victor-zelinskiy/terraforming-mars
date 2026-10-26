import {ICard} from './ICard';

/**
 * «A CARD THAT PLACES A TILE» — THE ONE PRINTED CLASS OF A CARD (Turmoil Redux
 * TR80 Hartlan Heating: «after you play a green project card that places a
 * tile»). A fact of the CARD, read off its declaration, never of the game's
 * state: a two-ocean card at the ninth ocean is still a card that places a
 * tile (the owner's decision 1 — the printed class, not «a tile really
 * landed»), and a card whose only tile sits in one option of an OR is one too.
 *
 * ONE predicate for every reader: the LIVE hook (`onCardPlayed`), its forecast
 * twin (`cardPlayedForecast`) and the worklist guard
 * (`tests/cards/greenTilePlacers.spec.ts`) — so the promise before the press
 * and the gain after it agree BY CONSTRUCTION (the forecast's `ctx.tiles` is
 * the OPERATION's tile list, clamped at the ocean ceiling and split by
 * branch; it is not this class).
 *
 *  · a DECLARATIVE placement — `behavior.tile` / `city` / `greenery` / `ocean`
 *    (and the Moon's tiles, outside the premium scope but stated honestly);
 *  · a BESPOKE placement — the card file declares `placesTile: true` beside
 *    its `bespokePlay` (Noctis City, Urbanized Area, Kaguya Tech, the mining
 *    cards, Lava Tube Settlement, Great Dam, Solar Farm, TR21 Arboretum, TR22
 *    Nova City, Sponsored Settlement …): co-located, never a central table.
 *
 * A card that MOVES a tile (TR14 Re-settlement, TR39 Canyon Carving) places
 * none — «a moved tile is not a new one» (`EventRecorder.recordTileMoved`).
 */
export function cardPlacesTile(card: ICard): boolean {
  const behavior = card.behavior;
  if (behavior !== undefined) {
    if (behavior.tile !== undefined || behavior.city !== undefined || behavior.greenery !== undefined || behavior.ocean !== undefined) {
      return true;
    }
    const moon = behavior.moon;
    if (moon !== undefined && (moon.tile !== undefined || moon.habitatTile !== undefined || moon.mineTile !== undefined || moon.roadTile !== undefined)) {
      return true;
    }
  }
  return card.placesTile === true;
}
