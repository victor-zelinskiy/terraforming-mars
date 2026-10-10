import {StandardActionCard} from '../../StandardActionCard';
import {CardName} from '../../../../common/cards/CardName';
import {CardRenderer} from '../../render/CardRenderer';
import {IPlayer} from '../../../IPlayer';
import {HEAT_FOR_TEMPERATURE, MAX_TEMPERATURE} from '../../../../common/constants';
import {Units} from '../../../../common/Units';
import {Resource} from '../../../../common/Resource';
import {OptionMetadata} from '../../../../common/models/PlayerInputModel';
import * as actionPreviews from '../../actionPreviews';
import {rewardReactionForecast} from '../../../models/effectForecast';

/**
 * THE OPTION'S READING (PL-067): the price and the step as chips — the step's
 * own rating implied after it, the one formula every door prints — and what
 * the TABLE answers to the step: the forecast engine's own pass (the ruling
 * Greens' 2 M€ per rating step, a bonus step the raise crosses), so the
 * console's one-press conversion can stand up a mini-stage exactly when
 * something reacts and send in one press when nothing does. Shared with the
 * Kelvinists' 6-heat variant (the same formula at another price). Read-only.
 */
export function heatConversionMetadata(player: IPlayer, heat: number): OptionMetadata {
  const effects = actionPreviews.withImpliedRating([
    actionPreviews.stockCost(player, Resource.HEAT, heat),
    actionPreviews.globalGain(player, 'temperature', 1),
  ]);
  const forecast = rewardReactionForecast(player, undefined, effects);
  return {kind: 'globalParameter', icon: 'temperature', amount: 1, effects, ...(forecast !== undefined ? {forecast} : {})};
}


export class ConvertHeat extends StandardActionCard {
  constructor() {
    super({
      name: CardName.CONVERT_HEAT,
      metadata: {
        cardNumber: 'SA2',
        renderData: CardRenderer.builder((b) =>
          b.standardProject('Spend 8 heat to raise temperature 1 step.', (eb) => {
            eb.heat(8).startAction.temperature(1);
          }),
        ),
      },
    });
  }

  public canAct(player: IPlayer): boolean {
    if (player.game.getTemperature() === MAX_TEMPERATURE) {
      this.addWarning('maxtemp');
    }

    // Strictly speaking, this conditional is not necessary, because canAfford manages reserveUnits.
    if (player.availableHeat() < HEAT_FOR_TEMPERATURE) {
      return false;
    }

    return player.canAfford({
      cost: 0,
      tr: {temperature: 1},
      reserveUnits: Units.of({heat: 8}),
    });
  }

  public action(player: IPlayer) {
    return player.spendHeat(HEAT_FOR_TEMPERATURE, () => {
      // Root the chain at the conversion so the temperature rise, TR and any
      // triggered effects group under it in the journal.
      const events = player.game?.events;
      events?.beginAction(player, {kind: 'standardProject', card: this.name}, {category: 'standard-project'});
      try {
        this.actionUsed(player);
        player.game.increaseTemperature(player, 1);
      } finally {
        events?.endScope();
      }
      return undefined;
    });
  }
}
