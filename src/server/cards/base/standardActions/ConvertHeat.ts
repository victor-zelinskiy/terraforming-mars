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
import {parameterMaxed} from '../../actionFutilities';
import {divertEffects, divertedFutility} from '../../../models/divertedTerraforming';
import {vetoEffects} from '../../../models/vetoedRating';
import * as divertedGate from '../../../parliament/divertedTerraformingGate';

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
  // Turmoil Redux (RX35): the family's exit pass FIRST — a replacing law strikes the step and pre-collects the «where»
  // — then the rating pass, which states no rating for a struck chip.
  const diverted = divertEffects(player, [
    actionPreviews.stockCost(player, Resource.HEAT, heat),
    actionPreviews.globalGain(player, 'temperature', 1),
  ], []);
  // …then the rating veto (RX42): the step's rating struck for a seat first by rating — the step itself moves.
  const effects = vetoEffects(player, actionPreviews.withImpliedRating(diverted.effects));
  const forecast = rewardReactionForecast(player, undefined, effects);
  // NO EFFECT at the temperature's maximum: the step moves nothing and the engine pays nothing for it (no TR, no party
  // reward, no reaction) — the console must not count or warn about the conversion as an opportunity (never a block).
  // Under the replacing law the step becomes data, and only a want of a holder makes it nothing.
  const futile = diverted.data > 0 ? divertedFutility(player) : parameterMaxed(player, 'temperature');
  return {
    kind: 'globalParameter', icon: 'temperature', amount: 1, effects,
    ...(forecast !== undefined ? {forecast} : {}),
    ...(futile !== undefined ? {futile} : {}),
    ...(diverted.steps.length > 0 ? {steps: diverted.steps} : {}),
  };
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
    // The ceiling wastes nothing under a law that REPLACES the step (RX35, decision Р5): no warning then.
    if (player.game.getTemperature() === MAX_TEMPERATURE && !divertedGate.divertsTerraforming(player)) {
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
