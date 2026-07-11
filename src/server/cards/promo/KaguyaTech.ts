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
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import * as reason from '../actionReasons';

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

        infoText: [

          {text: 'Increase your M€ production 2 steps and draw 1 card.', tokens: ['production(']},

          {text: 'Remove 1 of your greenery tiles (oxygen is not affected) and place a city tile there, regardless of placement rules. Gain placement bonuses as usual.', tokens: ['greenery']},

        ],
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

  // The card converts one of YOUR OWN greenery tiles into a city; with no such
  // (affordable) greenery there's nothing to convert — name it precisely.
  public unplayableReason(player: IPlayer): UnplayableReason | undefined {
    if (this.availableSpaces(player).length === 0) {
      return reason.targetReason('No greenery tile of yours to convert into a city');
    }
    return undefined;
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
    // hideExistingTile: the chosen greenery is physically removed before the
    // city is placed, so during selection the doomed greenery graphic is
    // hidden and the cell's placement bonus is shown instead (the player gains
    // those bonuses "as usual" — that's the relevant info, not the lost tile).
    return createMarsSelectSpace(player, 'Select a greenery to convert to a city.', greeneries, {
      // A city is placed here — drives the premium placement preview (cost / the
      // cell bonus gained "as usual" / +VP for adjacent greeneries). The cell is
      // a remove-and-replace target (hideExistingTile), so the preview grants the
      // bonus instead of reading the doomed greenery as a covering "no bonus".
      placementType: 'city',
      hideExistingTile: true,
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
