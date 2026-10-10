import {SpaceType} from '../../../common/boards/SpaceType';
import {Board, isSpecialTileSpace} from '../../boards/Board';
import {Space} from '../../boards/Space';
import {IGame} from '../../IGame';
import {IPlayer} from '../../IPlayer';
import {Suburbian} from '../../awards/modular/Suburbian';

/**
 * The placement REGIONS a bot rule names — a helper's HARD constraint («a greenery in the Southern Region»), and,
 * from the generator's map layer on, a rule's placement preference. Each id delegates to the board's own predicate
 * (`Board.isSouthernRegion`, `MarsBoard.isEdge`, `isSpecialTileSpace`, …) — the very one the award counts and the
 * map's tiebreaker rewards — so the helper, the score and the tiebreak can never disagree about a hex.
 */
export type PlacementRegionId =
  | 'southern' // Elysium's Desert Settler — the four bottom rows
  | 'oceanAdjacent' // Estate Dealer — beside an ocean tile
  | 'edge' // Edgedancer — the board edge (`MarsBoard.isEdge`)
  | 'suburbianEdge' // Suburbian — the award's own edge set (`Suburbian.onEdge`)
  | 'specialTileAdjacent' // Founder — beside a special tile (the Neural Instance included)
  | 'notOceanAdjacent' // Highlander — beside no ocean tile and no space reserved for one
  | 'ownCityAdjacent' // Urbanist — beside one of the bot's own cities
  | 'allNeighboursEmpty' // Tourist — every neighbour empty
  | 'volcanicOrAdjacent'; // Geologist — a volcanic area or a space beside one (Vastitas Nova's «+1 icon» bullet)

export function placementRegion(id: PlacementRegionId, game: IGame, bot: IPlayer): (space: Space) => boolean {
  const board = game.board;
  switch (id) {
  case 'southern':
    return Board.isSouthernRegion;
  case 'oceanAdjacent':
    return (space) => board.getAdjacentSpaces(space).some(Board.isOceanSpace);
  case 'edge':
    return (space) => board.isEdge(space);
  case 'suburbianEdge':
    return (space) => Suburbian.onEdge(board, space);
  case 'specialTileAdjacent':
    return (space) => board.getAdjacentSpaces(space).some(isSpecialTileSpace);
  case 'notOceanAdjacent':
    // «…not adjacent to an ocean OR A SPACE RESERVED FOR AN OCEAN» (Adding Expansions p.12): a reserved space
    // counts whether or not its ocean is down yet, and an ocean on a land space counts too.
    return (space) => !board.getAdjacentSpaces(space).some((adj) =>
      adj.spaceType === SpaceType.OCEAN || Board.isOceanSpace(adj));
  case 'ownCityAdjacent':
    return (space) => board.getAdjacentSpaces(space).some((adj) => Board.isCitySpace(adj) && adj.player === bot);
  case 'volcanicOrAdjacent':
    return (space) => space.volcanic === true || board.getAdjacentSpaces(space).some((s) => s.volcanic === true);
  case 'allNeighboursEmpty':
    return (space) => board.getAdjacentSpaces(space).every((adj) => adj.tile === undefined);
  }
}
