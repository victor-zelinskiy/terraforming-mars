import {ScaleStepRewardGain} from '../../common/models/ScaleStepRewardModel';
import {IPlayer} from '../IPlayer';
import {ICard} from './ICard';
import {GlobalParameterRaise} from './GlobalParameterRaise';

/**
 * «THE SCALE STEP PAYS» — the one writer of the board scene's record
 * (`IGame.scaleStepRewards`, Turmoil Redux TR24 Venusian Census and
 * Aphrodite; docs/TURMOIL_REDUX_VENUSIAN_CENSUS.md).
 *
 * A card answering `onGlobalParameterRaised` pays its owner the ordinary way
 * (`addResourceTo` / `stock.add`, logged, inside the dispatcher's effect scope)
 * and then calls this with WHAT it paid. The record carries the raise's own
 * levels (`before` → `after`, the marker's glide) so the client never infers
 * «this was the census» from a counter's delta, and never re-derives where the
 * tokens are born or how many there are. Purely presentational: a restart
 * loses the animation, never the rule.
 */
export function recordScaleStepReward(cardOwner: IPlayer, card: ICard, raise: GlobalParameterRaise, gain: ScaleStepRewardGain): void {
  if (gain.amount <= 0) {
    return;
  }
  cardOwner.game.publishScaleStepReward({
    parameter: raise.parameter,
    steps: raise.steps,
    before: raise.before,
    after: raise.after,
    owner: cardOwner.color,
    card: card.name,
    gain,
    ...(raise.by !== undefined ? {by: raise.by.color} : {}),
  });
}
