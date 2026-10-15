import {IPlayer} from '../IPlayer';
import {IProjectCard} from '../cards/IProjectCard';
import {armedPlayEffectsOf} from '../cards/armedPlayEffects';
import {requirementEasingOf} from './requirementEasing';
import {ArmedPlayConsumption, ArmedPlayForecast} from '../../common/models/ArmedPlayEffectModel';

/**
 * THE PLAY'S READING OF THE ONE-PLAY CLASS (TR49) — read before the press, by
 * the same readers the engine pays with: what playing `card` SPENDS (every
 * armed effect — a play spends it needed or not) and whether `card` USES each
 * one (a requirement met only thanks to it; a price it lowers on a card that
 * costs anything), plus the card's requirements under every modifier.
 * `undefined` when nothing is armed and no modifier touches a requirement.
 * Read-only.
 */
export function armedPlayForecastOf(player: IPlayer, card: IProjectCard): ArmedPlayForecast | undefined {
  const armed = armedPlayEffectsOf(player);
  const easings = requirementEasingOf(player, card);
  if (armed.length === 0 && easings.length === 0) {
    return undefined;
  }
  const breakdown = armed.some((a) => a.effect.kind === 'discount') ? player.getCardCostBreakdown(card) : undefined;
  const consumes: Array<ArmedPlayConsumption> = armed.map((a) => {
    if (a.effect.kind === 'discount') {
      const lowered = breakdown?.discounts.some((d) => (d.source.kind === 'card' || d.source.kind === 'corporation') && d.source.card === a.source && d.amount > 0) ?? false;
      return {armed: a, used: lowered && card.cost > 0};
    }
    const used = easings.some((e) => e.decisive && e.sources.some((s) => (s.source.kind === 'card' || s.source.kind === 'corporation') && s.source.card === a.source));
    return {armed: a, used};
  });
  return {consumes, easings};
}
