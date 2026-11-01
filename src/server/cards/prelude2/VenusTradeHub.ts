import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {IProjectCard} from '../IProjectCard';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {Resource} from '../../../common/Resource';
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import {IPlayer} from '../../IPlayer';
import {TradeContext} from '../../colonies/tradePerformed';
import * as actionPreviews from '../actionPreviews';
import * as forecast from '../effectForecastPreviews';

/** What one trade pays — the printed «3 M€», read by the live hook and its forecast twin alike. */
export const VENUS_TRADE_HUB_MEGACREDITS = 3;

export class VenusTradeHub extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.VENUS_TRADE_HUB,
      cost: 12,
      tags: [Tag.VENUS, Tag.SPACE],
      type: CardType.ACTIVE,
      victoryPoints: 1,
      requirements: [{tag: Tag.VENUS, count: 2}],

      metadata: {
        cardNumber: 'P90',
        renderData: CardRenderer.builder((b) => {
          b.effect('When you trade, gain 3 M€.', (eb) => eb.trade().startEffect.megacredits(VENUS_TRADE_HUB_MEGACREDITS));
        }),
        description: 'Requires 2 Venus tags.',
      },
    });
  }

  /**
   * Every trade of the owner — a colony's and a fleet dock's alike. Paid inline under the `'trade'` effect scope
   * `tradePerformed.fireTradeHooks` opens: the scope names this card, so the gain is never the colony's or the dock's.
   */
  public onTrade(player: IPlayer, _trade: TradeContext): void {
    player.stock.add(Resource.MEGACREDITS, VENUS_TRADE_HUB_MEGACREDITS, {log: true});
  }

  /** The mirror: the same rule, one exact fact on the printed effect row. */
  public tradeForecast(owner: IPlayer, _trade: TradeContext): ReadonlyArray<EffectForecastFact> {
    return [forecast.exact(
      {...forecast.sourceOf(this, owner, 'trade'), printedEffect: 0},
      [actionPreviews.stockGain(owner, Resource.MEGACREDITS, VENUS_TRADE_HUB_MEGACREDITS)],
      'You trade')];
  }
}
