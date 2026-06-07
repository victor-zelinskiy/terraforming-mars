import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CanAffordOptions, IPlayer} from '../../IPlayer';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {TileType} from '../../../common/TileType';
import {createMarsSelectSpace} from '../../boards/marsSelectSpaceHelper';
import {Board} from '../../boards/Board';

export class KaguyaTech extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.AUTOMATED,
      name: CardName.KAGUYA_TECH,
      tags: [Tag.CITY, Tag.PLANT],
      cost: 10,

      behavior: {
        production: {megacredits: 2},
        drawCard: 1,
      },

      metadata: {
        cardNumber: 'X58',
        renderData: CardRenderer.builder((b) => {
          b.production((pb) => pb.megacredits(2)).cards(1).br;
          b.minus().greenery({withO2: false}).plus().city().asterix().br;
          b.plainText('Increase M€ production 2 steps. Draw 1 card. ' +
          'Remove 1 of your greenery tiles (does not affect oxygen.) ' +
          'Place a city tile there, regardless of placement rules. ' +
          'Gain placement bonuses as usual.');
        }),
      },
    });
  }

  private availableSpaces(player: IPlayer, canAffordOptions?: CanAffordOptions) {
    const greeneries = player.game.board.getGreeneries(player);
    const filtered = greeneries.filter((space) => player.game.board.canAfford(player, space, canAffordOptions));
    return filtered;
  }

  public override bespokeCanPlay(player: IPlayer, canAffordOptions: CanAffordOptions): boolean {
    const availableSpaces = this.availableSpaces(player, canAffordOptions);
    if (availableSpaces.every((space) => space.tile?.tileType !== TileType.GREENERY)) {
      this.warnings.add('kaguyaTech');
    }
    return availableSpaces.length > 0;
  }

  public override bespokePlay(player: IPlayer) {
    const greeneries = this.availableSpaces(player);
    // KaguyaTech operates on tiles (your greeneries), NOT empty spaces.
    // The generic 'occupied' reason would fire for EVERY cell with a
    // tile — wrong tooltip ("already has a tile" sounds like "can't
    // place"). Use customReasoner to surface card-specific reasons:
    //   - other-player greenery / wrong tile type → 'not-your-greenery'
    //   - empty cell → 'wrong-terrain' (not a greenery at all)
    //   - your greenery you can't afford bonus on → 'cannot-afford-bonus'
    return createMarsSelectSpace(player, 'Select a greenery to convert to a city.', greeneries, {
      customReasoner: (space) => {
        // Empty cell: not a greenery target → wrong-terrain reads OK.
        if (space.tile === undefined) {
          return 'wrong-terrain';
        }
        // Has tile but not a greenery, or someone else's greenery.
        if (!Board.isGreenerySpace(space) || space.player !== player) {
          return 'not-your-greenery';
        }
        // Your greenery but bonus unaffordable.
        if (!player.game.board.canAfford(player, space)) {
          return 'cannot-afford-bonus';
        }
        return undefined;
      },
    })
      .andThen((space) => {
        player.game.removeTile(space.id);
        player.game.addCity(player, space, this.name);
        return undefined;
      });
  }
}
