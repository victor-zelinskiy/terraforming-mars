import {CorporationCard} from './CorporationCard';
import {IPlayer} from '../../IPlayer';
import {IProjectCard, isIProjectCard} from '../IProjectCard';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {IStandardProjectCard} from '../IStandardProjectCard';
import {Resource} from '../../../common/Resource';
import {ICorporationCard} from './ICorporationCard';
import {ICard} from '../ICard';
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import * as actionPreviews from '../actionPreviews';
import * as forecast from '../effectForecastPreviews';

export class CrediCor extends CorporationCard implements ICorporationCard {
  constructor() {
    super({
      name: CardName.CREDICOR,
      startingMegaCredits: 57,

      metadata: {
        cardNumber: 'R08',
        infoText: [{kind: 'effect-short', text: 'Card or project of 20+ M€: gain 4 M€'}],
        description: 'You start with 57 M€.',
        renderData: CardRenderer.builder((b) => {
          b.br.br.br;
          b.megacredits(57);
          b.corpBox('effect', (ce) => {
            ce.effect('After you pay for a card or standard project with a basic cost of 20M€ or more, you gain 4 M€.', (eb) => {
              eb.minus().megacredits(20).startEffect.megacredits(4);
            });
          });
        }),
      },
    });
  }
  private effect(player: IPlayer, card: IProjectCard | IStandardProjectCard): void {
    if (card.cost >= 20) {
      player.stock.add(Resource.MEGACREDITS, 4, {log: true});
    }
  }
  public onCardPlayed(player: IPlayer, card: ICard) {
    if (isIProjectCard(card)) {
      this.effect(player, card);
    }
  }
  /** Mirrors `onCardPlayed` + `effect`: the PRINTED cost (never the discounted one) at 20+ pays 4 M€ at once. */
  public cardPlayedForecast(cardOwner: IPlayer, _activePlayer: IPlayer, card: ICard): ReadonlyArray<EffectForecastFact> {
    if (!isIProjectCard(card) || card.cost < 20) {
      return [];
    }
    return [forecast.exact(forecast.sourceOf(this, cardOwner, 'card-played'),
      [actionPreviews.stockGain(cardOwner, Resource.MEGACREDITS, 4)],
      'You play a card with a basic cost of 20 M€ or more')];
  }

  public onStandardProject(player: IPlayer, project: IStandardProjectCard) {
    this.effect(player, project);
  }
}
