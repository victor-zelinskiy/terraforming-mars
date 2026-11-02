import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {PreludeCard} from '../prelude/PreludeCard';
import {all} from '../Options';
import {IPlayer} from '../../IPlayer';
import {Resource} from '../../../common/Resource';
import {IPreludeCard} from '../prelude/IPreludeCard';
import {EffectForecastGrant} from '../EffectForecastContext';
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import * as actionPreviews from '../actionPreviews';
import * as forecast from '../effectForecastPreviews';

/** What one colony pays — the printed «2 M€», read by the live hook and its forecast twin alike. */
export const COLONY_TRADE_HUB_MEGACREDITS = 2;

export class ColonyTradeHub extends PreludeCard implements IPreludeCard {
  constructor() {
    super({
      name: CardName.COLONY_TRADE_HUB,
      tags: [Tag.SPACE],

      behavior: {
        production: {energy: 1},
        stock: {titanium: 2},
      },

      metadata: {
        cardNumber: 'P46',
        renderData: CardRenderer.builder((b) => {
          b.production((pb) => pb.energy(1)).titanium(2).br;
          b.effect('When any colony is placed, gain 2 M€.', (eb) => eb.colonies(1, {all}).startEffect.megacredits(COLONY_TRADE_HUB_MEGACREDITS));
        }),
        description: 'Increase your energy production 1 step. Gain 2 titanium',
      },
    });
  }

  /**
   * Every colony built by ANY seat — the owner's, a rival's, MarsBot's (`Colony.addColony` and
   * `AutomaColonies.botBuildColony` wrap it in the `'colony-added'` scope with the colony as its cause).
   */
  public onColonyAddedByAnyPlayer(cardOwner: IPlayer) {
    cardOwner.stock.add(Resource.MEGACREDITS, COLONY_TRADE_HUB_MEGACREDITS, {log: true});
  }

  /** The forecast twin (Poseidon's, on the stock): every colony the operation builds pays 2 M€, whoever builds. */
  public grantForecast(cardOwner: IPlayer, _activePlayer: IPlayer, grant: EffectForecastGrant): ReadonlyArray<EffectForecastFact> {
    if (grant.kind !== 'colony' || grant.count <= 0) {
      return [];
    }
    return [forecast.exact(
      {...forecast.sourceOf(this, cardOwner, 'colony-added'), printedEffect: 0},
      [actionPreviews.stockGain(cardOwner, Resource.MEGACREDITS, COLONY_TRADE_HUB_MEGACREDITS * grant.count)],
      'A colony is placed')];
  }
}
