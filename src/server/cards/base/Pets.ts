import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {Space} from '../../boards/Space';
import {CardResource} from '../../../common/CardResource';
import {CardName} from '../../../common/cards/CardName';
import {Priority} from '../../deferredActions/Priority';
import {AddResourcesToCard} from '../../deferredActions/AddResourcesToCard';
import {Board} from '../../boards/Board';
import {CardRenderer} from '../render/CardRenderer';
import {Size} from '../../../common/cards/render/Size';
import {all} from '../Options';

export class Pets extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.PETS,
      tags: [Tag.EARTH, Tag.ANIMAL],
      cost: 10,
      resourceType: CardResource.ANIMAL,
      protectedResources: true,

      victoryPoints: {resourcesHere: {}, per: 2},

      behavior: {
        addResources: 1,
      },

      metadata: {
        cardNumber: '172',
        renderData: CardRenderer.builder((b) => {
          // Effect frame (city → animal) + the passive protection EFFECT frame
          // both render in the ЭФФЕКТ block; the on-play «add 1 animal» + the VP
          // line auto-derive from behavior / vpText — no authored infoText needed.
          b.effect('When any city tile is placed, add an animal to this card.', (eb) => {
            eb.city({size: Size.SMALL, all}).startEffect.resource(CardResource.ANIMAL);
          }).br;
          b.resource(CardResource.ANIMAL).br;
          b.effect('Animals may not be removed from this card.', (eb) => {
            eb.resource(CardResource.ANIMAL).startEffect.protection();
          }).br;
          b.vpText('1 VP per 2 animals here.');
        }),
        description: {text: 'Add 1 animal to this card.', align: 'left'},
      },
    });
  }


  public onTilePlaced(cardOwner: IPlayer, activePlayer: IPlayer, space: Space) {
    if (Board.isCitySpace(space)) {
      cardOwner.game.defer(
        new AddResourcesToCard(cardOwner, CardResource.ANIMAL, {filter: (c) => c.name === this.name}),
        cardOwner.id !== activePlayer.id ? Priority.OPPONENT_TRIGGER : undefined,
      );
    }
  }
}
