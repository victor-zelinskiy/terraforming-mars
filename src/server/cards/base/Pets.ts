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
        // Authored info blocks: on a project card authored `infoText` REPLACES
        // the behavior-derived immediate, so the «add 1 animal» play effect is
        // re-stated here alongside the protection rule (which lived ONLY in the
        // render text and was otherwise absent from the fullscreen rule blocks).
        // The effect frame (city → animal) + the VP line are auto-derived.
        infoText: [
          {kind: 'immediate', text: 'Add 1 animal to this card.', tokens: ['res-animal']},
          {kind: 'effect', text: 'Animals may not be removed from this card.', tokens: ['protection']},
        ],
        cardNumber: '172',
        renderData: CardRenderer.builder((b) => {
          b.effect('When any city tile is placed, add an animal to this card.', (eb) => {
            eb.city({size: Size.SMALL, all}).startEffect.resource(CardResource.ANIMAL);
          }).br;
          b.resource(CardResource.ANIMAL).br;
          b.protection().resource(CardResource.ANIMAL).br;
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
