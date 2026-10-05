import {SpaceName} from './SpaceName';
import {CardName} from '../cards/CardName';

/**
 * The off-Mars cells a game lays down beyond the two every board carries, by
 * the MODULES that call for them (or the card, when it is explicitly
 * included). `expansion` names ONE module or SEVERAL — a cell whose card needs
 * two modules at once exists only where every one of them is on (Turmoil Redux
 * TR27 Aurora Station: its card is in the Redux deck AND needs Venus Next, so
 * its cell is never laid in a game where it could never be played).
 */
export const expansionSpaceColonies = [
  {name: SpaceName.STANFORD_TORUS, expansion: 'promo', card: CardName.STANFORD_TORUS},
  {name: SpaceName.DAWN_CITY, expansion: 'venus', card: CardName.DAWN_CITY},
  {name: SpaceName.LUNA_METROPOLIS, expansion: 'venus', card: CardName.LUNA_METROPOLIS},
  {name: SpaceName.MAXWELL_BASE, expansion: 'venus', card: CardName.MAXWELL_BASE},
  {name: SpaceName.STRATOPOLIS, expansion: 'venus', card: CardName.STRATOPOLIS},
  {name: SpaceName.CERES_SPACEPORT, expansion: 'pathfinders', card: CardName.CERES_SPACEPORT},
  {name: SpaceName.DYSON_SCREENS, expansion: 'pathfinders', card: CardName.DYSON_SCREENS},
  {name: SpaceName.LUNAR_EMBASSY, expansion: 'pathfinders', card: CardName.LUNAR_EMBASSY},
  {name: SpaceName.VENERA_BASE, expansion: 'pathfinders', card: CardName.VENERA_BASE},
  {name: SpaceName.NOVA_CITY, expansion: 'turmoilRedux', card: CardName.NOVA_CITY},
  {name: SpaceName.AURORA_STATION, expansion: ['turmoilRedux', 'venus'], card: CardName.AURORA_STATION},
] as const;
