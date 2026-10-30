import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {CardType} from '../../../common/cards/CardType';
import {Card} from '../Card';
import {PartyName} from '../../../common/turmoil/PartyName';
import {CardResource} from '../../../common/CardResource';

export class GhgShipment extends Card {
  constructor() {
    super({
      name: CardName.GHG_SHIPMENT,
      type: CardType.EVENT,
      tags: [Tag.SPACE],
      cost: 3,

      behavior: {
        production: {heat: 1},
        stock: {heat: {floaters: {}}},
      },

      requirements: {party: PartyName.KELVINISTS},

      metadata: {
        cardNumber: 'P75',
        // The requirement stays the printed KELVINISTS (the classic facade reads them as they are); the Redux table
        // has no Kelvinists, so the text names the party the facade reads them as — the Greens (rulebook p.13,
        // `normalizeReduxParty`): the face's plate, the generated line and the hand's reason all say the same.
        description: 'Requires that Greens are ruling or that you have 2 delegates there. ' +
          'Increase your heat production 1 step. Gain 1 heat for each floater you have.',
        // The generator derives the production block, never a COUNTED stock gain (`stock.heat: {floaters}`) — both
        // blocks authored, in the render's (= the executor's) order.
        infoText: [
          {text: 'Increase your heat production 1 step.', tokens: ['production(heat', 'production(']},
          {text: 'Gain 1 heat for each floater you have.', tokens: ['heat', 'floater']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.production((pb) => pb.heat(1)).br;
          b.heat(1).slash().resource(CardResource.FLOATER);
        }),
      },
    });
  }
}
