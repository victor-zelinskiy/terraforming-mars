import {IProjectCard} from '../IProjectCard';
import {Space} from '../../boards/Space';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {CardName} from '../../../common/cards/CardName';
import {Resource} from '../../../common/Resource';
import {Priority} from '../../deferredActions/Priority';
import {GainResourcesDeferred} from '../../deferredActions/GainResourcesDeferred';
import {Board} from '../../boards/Board';
import {CardRenderer} from '../render/CardRenderer';
import {Size} from '../../../common/cards/render/Size';
import {all} from '../Options';
import {BoardFact} from '../../../common/boards/BoardInformationFacts';
import {PlacementPreviewContext} from '../../boards/PlacementPreviewContext';
import * as placementPreviews from '../placementPreviews';

export class RoverConstruction extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.ROVER_CONSTRUCTION,
      tags: [Tag.BUILDING],
      cost: 8,
      victoryPoints: 1,

      metadata: {
        cardNumber: '038',
        renderData: CardRenderer.builder((b) => {
          b.effect('When any city tile is placed, gain 2 M€.', (eb) => {
            eb.city({size: Size.SMALL, all}).startEffect.megacredits(2);
          });
        }),
      },
    });
  }

  public onTilePlaced(cardOwner: IPlayer, activePlayer: IPlayer, space: Space) {
    if (Board.isCitySpace(space)) {
      cardOwner.game.defer(
        new GainResourcesDeferred(cardOwner, Resource.MEGACREDITS, {count: 2, log: true}),
        cardOwner.id !== activePlayer.id ? Priority.OPPONENT_TRIGGER : undefined,
      );
    }
  }

  /** Mirrors `onTilePlaced`: ANY city, placed by anyone, pays the owner 2 M€. */
  public tilePlacedPreview(cardOwner: IPlayer, activePlayer: IPlayer, _space: Space, ctx: PlacementPreviewContext): ReadonlyArray<BoardFact> {
    if (!ctx.countsAsCity) {
      return [];
    }
    return [placementPreviews.stockChange(cardOwner, this, Resource.MEGACREDITS, 2, 'City placed anywhere', {
      recipient: placementPreviews.recipientOf(activePlayer, cardOwner),
    })];
  }
}
