import {CorporationCard} from './CorporationCard';
import {Tag} from '../../../common/cards/Tag';
import {IPlayer} from '../../IPlayer';
import {SpaceType} from '../../../common/boards/SpaceType';
import {Space} from '../../boards/Space';
import {Resource} from '../../../common/Resource';
import {CardName} from '../../../common/cards/CardName';
import {Priority} from '../../deferredActions/Priority';
import {GainResourcesDeferred} from '../../deferredActions/GainResourcesDeferred';
import {GainProduction} from '../../deferredActions/GainProduction';
import {Board} from '../../boards/Board';
import {CardRenderer} from '../render/CardRenderer';
import {Size} from '../../../common/cards/render/Size';
import {all} from '../Options';
import {ICorporationCard} from './ICorporationCard';
import {BoardFact} from '../../../common/boards/BoardInformationFacts';
import {PlacementPreviewContext} from '../../boards/PlacementPreviewContext';
import * as placementPreviews from '../placementPreviews';
import * as actionPreviews from '../actionPreviews';
import * as forecast from '../effectForecastPreviews';
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import {EffectForecastTile} from '../EffectForecastContext';

export class TharsisRepublic extends CorporationCard implements ICorporationCard {
  constructor() {
    super({
      name: CardName.THARSIS_REPUBLIC,
      tags: [Tag.BUILDING],
      startingMegaCredits: 40,

      firstAction: {
        text: 'Place a city tile',
        city: {},
      },

      metadata: {
        cardNumber: 'R31',
        description: 'You start with 40 M€. As your first action in the game, place a city tile.',
        infoText: [
          {text: 'As your first action in the game, place a city tile.', tokens: ['city']},
          {kind: 'effect-short', text: 'Any city on Mars: +1 M€ production, yours: +3 M€'},
        ],
        renderData: CardRenderer.builder((b) => {
          b.br.br;
          b.megacredits(40).nbsp.city();
          b.corpBox('effect', (ce) => {
            ce.effect('When any city tile is placed ON MARS, increase your M€ production 1 step. When you place a city tile, gain 3 M€.', (eb) => {
              eb.city({size: Size.SMALL, all}).asterix().colon();
              eb.production((pb) => pb.megacredits(1)).nbsp;
              eb.city({size: Size.SMALL}).startEffect.megacredits(3);
            });
          });
        }),
      },
    });
  }

  public onTilePlaced(cardOwner: IPlayer, activePlayer: IPlayer, space: Space) {
    if (Board.isCitySpace(space)) {
      if (cardOwner.id === activePlayer.id) {
        cardOwner.game.defer(new GainResourcesDeferred(cardOwner, Resource.MEGACREDITS, {count: 3, log: true}));
      }
      if (space.spaceType !== SpaceType.COLONY) {
        cardOwner.game.defer(
          new GainProduction(cardOwner, Resource.MEGACREDITS, {log: true}),
          cardOwner.id !== activePlayer.id ? Priority.OPPONENT_TRIGGER : undefined,
        );
      }
    }
    return;
  }

  /**
   * The forecast mirror of `onTilePlaced` — the same two independent effects:
   * 3 M€ for the OWNER's own city, and +1 M€ production for any city ON MARS
   * (an off-Mars reserved slot pays no production — `space.spaceType`).
   */
  public tilePlacedForecast(cardOwner: IPlayer, activePlayer: IPlayer, tile: EffectForecastTile): ReadonlyArray<EffectForecastFact> {
    if (!tile.countsAsCity) {
      return [];
    }
    const source = forecast.sourceOf(this, cardOwner, 'tile-placed');
    const recipient = forecast.recipientOf(activePlayer, cardOwner);
    const sequence = forecast.triggerSequence(cardOwner, activePlayer);
    const facts: Array<EffectForecastFact> = [];
    if (cardOwner.id === activePlayer.id) {
      facts.push(forecast.deferred(source,
        [actionPreviews.stockGain(cardOwner, Resource.MEGACREDITS, 3 * tile.count)],
        'You place a city tile', {id: 'cash', recipient, sequence}));
    }
    if (!tile.offMars) {
      facts.push(forecast.deferred(source,
        [actionPreviews.productionChange(cardOwner, Resource.MEGACREDITS, tile.count)],
        'A city tile is placed on Mars', {id: 'prod', recipient, sequence}));
    }
    return facts;
  }

  /**
   * Mirrors `onTilePlaced` — two independent effects off the same city, so two
   * facts with explicit ids (they share the card and the M€ pool and would
   * otherwise collide on the auto id).
   */
  public tilePlacedPreview(cardOwner: IPlayer, activePlayer: IPlayer, space: Space, ctx: PlacementPreviewContext): ReadonlyArray<BoardFact> {
    if (!ctx.countsAsCity) {
      return [];
    }
    const recipient = placementPreviews.recipientOf(activePlayer, cardOwner);
    const facts: Array<BoardFact> = [];
    if (cardOwner.id === activePlayer.id) {
      facts.push(placementPreviews.stockChange(cardOwner, this, Resource.MEGACREDITS, 3,
        'City placed by you', {id: 'tharsis-cash', recipient}));
    }
    if (space.spaceType !== SpaceType.COLONY) {
      facts.push(placementPreviews.productionChange(cardOwner, this, Resource.MEGACREDITS, 1,
        'City placed on Mars', {id: 'tharsis-prod', recipient}));
    }
    return facts;
  }

  public override bespokePlay(player: IPlayer) {
    if (player.game.isSoloMode()) {
      // Get bonus for 2 neutral cities
      player.production.add(Resource.MEGACREDITS, 2, {log: true});
    }
    return undefined;
  }
}
