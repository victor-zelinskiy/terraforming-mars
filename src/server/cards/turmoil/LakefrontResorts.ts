import {CorporationCard} from '../corporation/CorporationCard';
import {Tag} from '../../../common/cards/Tag';
import {IPlayer} from '../../IPlayer';
import {Space} from '../../boards/Space';
import {Resource} from '../../../common/Resource';
import {CardName} from '../../../common/cards/CardName';
import {Priority} from '../../deferredActions/Priority';
import {GainProduction} from '../../deferredActions/GainProduction';
import {CardRenderer} from '../render/CardRenderer';
import {Size} from '../../../common/cards/render/Size';
import {all} from '../Options';
import {Board} from '../../boards/Board';
import {ICorporationCard} from '../corporation/ICorporationCard';
import {BoardFact} from '../../../common/boards/BoardInformationFacts';
import {PlacementPreviewContext} from '../../boards/PlacementPreviewContext';
import * as placementPreviews from '../placementPreviews';
import * as actionPreviews from '../actionPreviews';
import * as forecast from '../effectForecastPreviews';
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import {EffectForecastTile} from '../EffectForecastContext';

export class LakefrontResorts extends CorporationCard implements ICorporationCard {
  constructor() {
    super({
      name: CardName.LAKEFRONT_RESORTS,
      tags: [Tag.BUILDING],
      startingMegaCredits: 54,

      metadata: {
        cardNumber: 'R38',
        description: 'You start with 54 M€.',
        infoText: [
          {kind: 'effect-short', text: 'Any ocean placed: +1 M€ production'},
          {kind: 'effect-short', text: 'Ocean adjacency: 3 M€ instead of 2'},
        ],
        renderData: CardRenderer.builder((b) => {
          b.br.br.br;
          b.megacredits(54);
          b.corpBox('effect', (ce) => {
            ce.vSpace(Size.MEDIUM);
            ce.effect('When any ocean tile is placed, increase your M€ production 1 step. Your bonus for placing adjacent to oceans is 3 M€ instead of 2 M€.', (eb) => {
              eb.oceans(1, {size: Size.SMALL, all}).colon().production((pb) => pb.megacredits(1));
              eb.emptyTile('normal', {size: Size.SMALL}).oceans(1, {size: Size.SMALL});
              eb.startEffect.megacredits(3);
            });
          });
        }),
      },
    });
  }

  /**
   * The adjacency half of the card lives on the PLAYER (`oceanBonus`, serialized), so
   * every reader of the neighbourhood — `MarsBoard` placement bonus, the cell dossier
   * (`BoardInformationEngine`), the payout beat's server breakdown — counts 3 M€ per
   * ocean with no per-card branch.
   */
  public override bespokePlay(player: IPlayer) {
    player.oceanBonus = 3;
    return undefined;
  }

  public override onDiscard(player: IPlayer) {
    player.oceanBonus = 2;
  }

  public onTilePlaced(cardOwner: IPlayer, activePlayer: IPlayer, space: Space) {
    if (Board.isUncoveredOceanSpace(space)) {
      cardOwner.game.defer(
        new GainProduction(cardOwner, Resource.MEGACREDITS, {log: true}),
        cardOwner.id !== activePlayer.id ? Priority.OPPONENT_TRIGGER : undefined,
      );
    }
  }

  /** The forecast mirror of `onTilePlaced`: +1 M€ production per PLAIN ocean the operation places, whoever places it. */
  public tilePlacedForecast(cardOwner: IPlayer, activePlayer: IPlayer, tile: EffectForecastTile): ReadonlyArray<EffectForecastFact> {
    if (!forecast.placesUncoveredOcean(tile)) {
      return [];
    }
    return [forecast.deferred(forecast.sourceOf(this, cardOwner, 'tile-placed'),
      [actionPreviews.productionChange(cardOwner, Resource.MEGACREDITS, tile.count)],
      'An ocean tile is placed', {
        recipient: forecast.recipientOf(activePlayer, cardOwner),
        sequence: forecast.triggerSequence(cardOwner, activePlayer),
      })];
  }

  /** Mirrors `onTilePlaced` on the cell: the plain ocean that would land here pays the owner +1 M€ production. */
  public tilePlacedPreview(cardOwner: IPlayer, activePlayer: IPlayer, _space: Space, ctx: PlacementPreviewContext): ReadonlyArray<BoardFact> {
    if (!placementPreviews.placesUncoveredOcean(ctx)) {
      return [];
    }
    return [placementPreviews.productionChange(cardOwner, this, Resource.MEGACREDITS, 1, 'Ocean placed anywhere', {
      recipient: placementPreviews.recipientOf(activePlayer, cardOwner),
    })];
  }
}
