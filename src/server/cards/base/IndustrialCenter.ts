import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {ActionCard} from '../ActionCard';
import {CardType} from '../../../common/cards/CardType';
import {CanAffordOptions, IPlayer} from '../../IPlayer';
import {TileType} from '../../../common/TileType';
import {PlaceTile} from '../../../server/deferredActions/PlaceTile';
import {Space} from '../../boards/Space';
import {CardName} from '../../../common/cards/CardName';
import {Board} from '../../boards/Board';
import {AdjacencyBonus} from '../../ares/AdjacencyBonus';
import {CardRenderer} from '../render/CardRenderer';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import * as reason from '../actionReasons';

export class IndustrialCenter extends ActionCard implements IProjectCard {
  constructor(
    name = CardName.INDUSTRIAL_CENTER,
    adjacencyBonus: AdjacencyBonus | undefined = undefined,
    metadata = {
      cardNumber: '123',
      renderData: CardRenderer.builder((b) => {
        b.action('Spend 7 M€ to increase your steel production 1 step.', (eb) => {
          eb.megacredits(7).startAction.production((pb) => pb.steel(1));
        }).br;
        b.tile(TileType.INDUSTRIAL_CENTER, true, false).asterix();
      }),
      description: 'Place this tile adjacent to a city tile.',
    }) {
    super({
      type: CardType.ACTIVE,
      name,
      tags: [Tag.BUILDING],
      cost: 4,
      adjacencyBonus,

      action: {
        spend: {megacredits: 7},
        production: {steel: 1},
      },
      metadata,
    });
  }

  private getAvailableSpaces(player: IPlayer, canAffordOptions?: CanAffordOptions): Array<Space> {
    return player.game.board.getAvailableSpacesOnLand(player, canAffordOptions)
      .filter((space) => player.game.board.getAdjacentSpaces(space).some((adjacentSpace) => Board.isCitySpace(adjacentSpace)));
  }
  public override bespokeCanPlay(player: IPlayer, canAffordOptions: CanAffordOptions): boolean {
    return this.getAvailableSpaces(player, canAffordOptions).length > 0;
  }

  // The bespoke tile placement (adjacent to a city) isn't declarative `behavior`,
  // so name it instead of falling through to the generic "unmet conditions".
  public unplayableReason(player: IPlayer): UnplayableReason | undefined {
    if (this.getAvailableSpaces(player).length === 0) {
      return reason.placementReason('No space adjacent to a city');
    }
    return undefined;
  }
  public override bespokePlay(player: IPlayer) {
    const board = player.game.board;
    const placeable = new Set(board.getAvailableSpacesOnLand(player).map((s) => s.id));
    player.game.defer(
      new PlaceTile(player, {
        tile: {tileType: TileType.INDUSTRIAL_CENTER, card: this.name},
        on: () => this.getAvailableSpaces(player),
        title: 'Select space adjacent to a city tile',
        adjacencyBonus: this.adjacencyBonus,
        placementType: 'land',
        customReasoner: (space) => {
          if (placeable.has(space.id) && !board.getAdjacentSpaces(space).some((s) => Board.isCitySpace(s))) {
            return 'requires-adjacent-city';
          }
          return undefined;
        },
      }));
    return undefined;
  }
}
