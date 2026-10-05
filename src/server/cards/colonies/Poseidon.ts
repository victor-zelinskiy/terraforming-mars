import {CorporationCard} from '../corporation/CorporationCard';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {all} from '../Options';
import {IPlayer} from '../../IPlayer';
import {Resource} from '../../../common/Resource';
import {ICorporationCard} from '../corporation/ICorporationCard';
import {EffectForecastGrant} from '../EffectForecastContext';
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import * as actionPreviews from '../actionPreviews';
import * as forecast from '../effectForecastPreviews';

export class Poseidon extends CorporationCard implements ICorporationCard {
  constructor() {
    super({
      name: CardName.POSEIDON,
      startingMegaCredits: 45,

      firstAction: {
        text: 'Place a colony',
        // title: 'Poseidon first action - Select where to build colony
        colonies: {buildColony: {}},
      },
      metadata: {
        cardNumber: 'R02',
        description: 'You start with 45 M€. As your first action, place a colony.',
        infoText: [
          {text: 'As your first action, place a colony.', tokens: ['colonies']},
          {kind: 'effect-short', text: 'Any colony placed: +1 M€ production'},
        ],
        renderData: CardRenderer.builder((b) => {
          b.br.br;
          b.megacredits(45).nbsp.colonies(1);
          b.corpBox('effect', (ce) => {
            ce.effect('When any colony is placed, including this, raise your M€ production 1 step.', (eb) => {
              eb.colonies(1, {all}).startEffect.production((pb) => pb.megacredits(1));
            });
          });
        }),
      },
    });
  }

  public onColonyAddedByAnyPlayer(cardOwner: IPlayer) {
    cardOwner.production.add(Resource.MEGACREDITS, 1, {log: true});
  }

  /** The forecast twin of `onColonyAddedByAnyPlayer`: every colony the operation builds raises M€ production 1 step, whoever builds. */
  public grantForecast(cardOwner: IPlayer, _activePlayer: IPlayer, grant: EffectForecastGrant): ReadonlyArray<EffectForecastFact> {
    if (grant.kind !== 'colony' || grant.count <= 0) {
      return [];
    }
    return [forecast.exact(forecast.sourceOf(this, cardOwner, 'colony-added'),
      [actionPreviews.productionChange(cardOwner, Resource.MEGACREDITS, grant.count)],
      'A colony is placed')];
  }
}
