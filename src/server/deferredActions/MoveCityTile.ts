import {CanAffordOptions, IPlayer} from '../IPlayer';
import {cityMoveOffer, cityMoveReasoner} from '../boards/cityMove';
import type {SkippedEffect} from '../cards/actionPreviews';
import {CardName} from '../../common/cards/CardName';
import {TileType} from '../../common/TileType';
import {MoveTile, TileMoveRule, skippedTileMove} from './MoveTile';

/**
 * The prompt's title — an English i18n key, mirrored by the staged preview. It
 * names the LIFTED rule too (the family's voice — TR16): the board lights
 * cells beside other cities, and the placement panel prints this title as its
 * action line.
 */
export const MOVE_CITY_TILE_TITLE = 'Move your city to an adjacent non-reserved space — other placement restrictions do not apply';

/** The muted constraint tail of the play preview's «then: place it on the board» line. */
export const MOVE_CITY_TILE_CONSTRAINT = 'to an adjacent non-reserved space, ignoring other placement restrictions';

/** Why no move exists — no city of the player's own has a legal cell beside it. */
export const NO_SPACE_TO_MOVE_A_CITY_REASON = 'None of your cities has a free adjacent space to move to';

/** The skip label — the effect a lost «move one of your cities» is NAMED by. */
export const CITY_MOVE_LABEL = 'Move a city';

/**
 * THE CITY'S RULE of the shared move step (Turmoil Redux TR14 Re-settlement):
 * who may move and where is `boards/cityMove.ts`, the writer `Game.moveCityTile`.
 */
export const CITY_MOVE_RULE: TileMoveRule = {
  placementType: 'city-move',
  tileType: TileType.CITY,
  offer: cityMoveOffer,
  reasoner: cityMoveReasoner,
  move: (game, player, from, to) => game.moveCityTile(player, from, to),
  title: MOVE_CITY_TILE_TITLE,
  constraint: MOVE_CITY_TILE_CONSTRAINT,
  noMoveReason: NO_SPACE_TO_MOVE_A_CITY_REASON,
  skipLabel: CITY_MOVE_LABEL,
};

/** What a lost move is named by — no magnitude: a tile is not an amount. */
export function skippedCityMove(): {reason: string, skipped: SkippedEffect} {
  return skippedTileMove(CITY_MOVE_RULE);
}

/**
 * «REMOVE A CITY TILE YOU OWN ON MARS AND PLACE IT IN AN ADJACENT,
 * NON-RESERVED, UNOCCUPIED SPACE, IGNORING OTHER PLACEMENT RESTRICTIONS»
 * (Turmoil Redux TR14 Re-settlement) — the shared move step (`MoveTile`)
 * under the city's rule. Everything about the question — one prompt, one
 * answer naming both cells, no auto-select, the named skip, the staged twin —
 * is the step's; this class only names the rule.
 */
export class MoveCityTile extends MoveTile {
  constructor(
    player: IPlayer,
    cause: {kind: 'card', card: CardName},
    options: {canAffordOptions?: CanAffordOptions} = {},
  ) {
    super(player, cause, CITY_MOVE_RULE, options);
  }
}
