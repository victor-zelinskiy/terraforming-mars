import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {Space} from '../../boards/Space';
import {CardName} from '../../../common/cards/CardName';
import {Resource} from '../../../common/Resource';
import {Priority} from '../../deferredActions/Priority';
import {GainResourcesDeferred} from '../../deferredActions/GainResourcesDeferred';
import {CardRenderer} from '../render/CardRenderer';
import {all, max} from '../Options';
import {Board} from '../../boards/Board';
import {BoardFact} from '../../../common/boards/BoardInformationFacts';
import {PlacementPreviewContext} from '../../boards/PlacementPreviewContext';
import * as placementPreviews from '../placementPreviews';
import * as actionPreviews from '../actionPreviews';
import * as forecast from '../effectForecastPreviews';
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import {EffectForecastTile} from '../EffectForecastContext';

export class ArcticAlgae extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.ARCTIC_ALGAE,
      tags: [Tag.PLANT],
      cost: 12,

      behavior: {
        stock: {plants: 1},
      },

      requirements: {temperature: -12, max},
      metadata: {
        description: 'It must be -12 C or colder to play. Gain 1 plant.',
        cardNumber: '023',
        infoText: [{kind: 'effect-short', text: 'Any ocean placed: gain 2 plants'}],
        renderData: CardRenderer.builder((b) => {
          b.effect('When anyone places an ocean tile, gain 2 plants.', (be) => be.oceans(1, {all}).startEffect.plants(2)).br;
          b.plants(1);
        }),
      },
    });
  }

  public onTilePlaced(cardOwner: IPlayer, activePlayer: IPlayer, space: Space) {
    if (Board.isUncoveredOceanSpace(space)) {
      cardOwner.game.defer(
        new GainResourcesDeferred(cardOwner, Resource.PLANTS, {count: 2}).andThen(() => activePlayer.game.log(
          '${0} gained 2 ${1} from ${2}',
          (b) => b.player(cardOwner).string(Resource.PLANTS).cardName(this.name))),
        cardOwner.id !== activePlayer.id ? Priority.OPPONENT_TRIGGER : undefined);
    }
  }

  /** The forecast mirror of `onTilePlaced`: 2 plants per PLAIN ocean the operation places, whoever places it. */
  public tilePlacedForecast(cardOwner: IPlayer, activePlayer: IPlayer, tile: EffectForecastTile): ReadonlyArray<EffectForecastFact> {
    if (!forecast.placesUncoveredOcean(tile)) {
      return [];
    }
    return [forecast.deferred(forecast.sourceOf(this, cardOwner, 'tile-placed'),
      [actionPreviews.stockGain(cardOwner, Resource.PLANTS, 2 * tile.count)],
      'An ocean tile is placed', {
        recipient: forecast.recipientOf(activePlayer, cardOwner),
        sequence: forecast.triggerSequence(cardOwner, activePlayer),
      })];
  }

  public tilePlacedPreview(cardOwner: IPlayer, activePlayer: IPlayer, _space: Space, ctx: PlacementPreviewContext): ReadonlyArray<BoardFact> {
    if (!placementPreviews.placesUncoveredOcean(ctx)) {
      return [];
    }
    return [placementPreviews.stockChange(cardOwner, this, Resource.PLANTS, 2, 'Ocean placed anywhere', {
      recipient: placementPreviews.recipientOf(activePlayer, cardOwner),
    })];
  }
}
