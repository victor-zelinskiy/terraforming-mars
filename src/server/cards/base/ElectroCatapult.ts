import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {ActionCard} from '../ActionCard';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {max} from '../Options';

export class ElectroCatapult extends ActionCard implements IProjectCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.ELECTRO_CATAPULT,
      tags: [Tag.BUILDING],
      cost: 17,

      behavior: {
        production: {energy: -1},
      },

      action: {
        or: {
          autoSelect: true,
          behaviors: [{
            title: 'Spend 1 plant to gain 7 M€.',
            spend: {plants: 1},
            stock: {megacredits: 7},
          },
          {
            title: 'Spend 1 steel to gain 7 M€.',
            spend: {steel: 1},
            stock: {megacredits: 7},
          }],
        },
      },

      victoryPoints: 1,

      requirements: {oxygen: 8, max},
      metadata: {
        cardNumber: '069',
        description: {
          text: 'Oxygen must be 8% or less. Decrease your energy production 1 step.',
          align: 'left',
        },
        renderData: CardRenderer.builder((b) => {
          // TWO action rows (one per `or` branch) so each choice maps to its OWN
          // icon graphic in the ActionsOverlay / confirm modal instead of falling
          // back to title text (the combined "plant / steel → 7 M€" was one node
          // for two branches). Titles match the `or` behavior titles.
          b.action('Spend 1 plant to gain 7 M€.', (eb) => {
            eb.plants(1).startAction.megacredits(7);
          }).br;
          b.action('Spend 1 steel to gain 7 M€.', (eb) => {
            eb.steel(1).startAction.megacredits(7);
          }).br;
          b.production((pb) => pb.minus().energy(1));
        }),
      },
    });
  }

  // KEEP THIS
  // private log(player: IPlayer, resource: Resources) {
  //   player.game.log('${0} spent 1 ${1} to gain 7 M€', (b) => b.player(player).string(resource));
  // }
}
