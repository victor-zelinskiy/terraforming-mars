import {CanAffordOptions, IPlayer} from '../IPlayer';
import {oceanMoveOffer, oceanMoveReasoner} from '../boards/oceanMove';
import type {SkippedEffect} from '../cards/actionPreviews';
import {CardName} from '../../common/cards/CardName';
import {TileType} from '../../common/TileType';
import {MoveTile, TileMoveRule, skippedTileMove} from './MoveTile';

/**
 * The prompt's title — an English i18n key, mirrored by the staged preview. It
 * names the rule of the destination (the family's voice — TR16): the board
 * lights ocean reserves AND land beside the oceans, and the placement panel
 * prints this title as its action line.
 */
export const MOVE_OCEAN_TILE_TITLE = 'Move any ocean tile to an adjacent space reserved for ocean or not reserved at all';

/** The muted constraint tail of the play preview's «then: place it on the board» line. */
export const MOVE_OCEAN_TILE_CONSTRAINT = 'to an adjacent space reserved for ocean or not reserved at all';

/** Why no move exists — no plain ocean on the board has a legal cell beside it (a board without oceans included). */
export const NO_SPACE_TO_MOVE_AN_OCEAN_REASON = 'No ocean tile on the board has a free adjacent space';

/** The skip label — the effect a lost «move an ocean» is NAMED by. */
export const OCEAN_MOVE_LABEL = 'Move an ocean';

/**
 * THE OCEAN'S RULE of the shared move step (Turmoil Redux TR39 Canyon
 * Carving): who may move and where is `boards/oceanMove.ts`, the writer
 * `Game.moveOceanTile` — the one that pays the move's TR itself and never
 * touches the ocean parameter.
 */
export const OCEAN_MOVE_RULE: TileMoveRule = {
  placementType: 'ocean-move',
  tileType: TileType.OCEAN,
  offer: oceanMoveOffer,
  reasoner: oceanMoveReasoner,
  move: (game, player, from, to) => game.moveOceanTile(player, from, to),
  title: MOVE_OCEAN_TILE_TITLE,
  constraint: MOVE_OCEAN_TILE_CONSTRAINT,
  noMoveReason: NO_SPACE_TO_MOVE_AN_OCEAN_REASON,
  skipLabel: OCEAN_MOVE_LABEL,
};

/** What a lost move is named by — no magnitude: a tile is not an amount. */
export function skippedOceanMove(): {reason: string, skipped: SkippedEffect} {
  return skippedTileMove(OCEAN_MOVE_RULE);
}

/**
 * «REMOVE ANY 1 OCEAN TILE FROM THE BOARD AND PLACE IT IN AN ADJACENT SPACE
 * THAT'S RESERVED FOR OCEAN OR NOT RESERVED AT ALL» (Turmoil Redux TR39
 * Canyon Carving) — the shared move step (`MoveTile`) under the ocean's rule.
 * Everything about the question is the step's; this class only names the rule.
 */
export class MoveOceanTile extends MoveTile {
  constructor(
    player: IPlayer,
    cause: {kind: 'card', card: CardName},
    options: {canAffordOptions?: CanAffordOptions} = {},
  ) {
    super(player, cause, OCEAN_MOVE_RULE, options);
  }
}
