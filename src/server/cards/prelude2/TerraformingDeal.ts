import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {IPlayer} from '../../IPlayer';
import {IGame} from '../../IGame';
import {Phase} from '../../../common/Phase';
import {Resource} from '../../../common/Resource';
import {PreludeCard} from '../prelude/PreludeCard';
import {IPreludeCard} from '../prelude/IPreludeCard';
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import {EffectForecastGrant} from '../EffectForecastContext';
import * as actionPreviews from '../actionPreviews';
import * as forecast from '../effectForecastPreviews';

/** «Each step your TR is raised, you gain 2 M€» — per step, read by the live hook and its forecast twin alike. */
export const TERRAFORMING_DEAL_MC_PER_STEP = 2;

/**
 * P64 — TERRAFORMING DEAL: the play itself gives NOTHING (no `behavior`, no description — the scan's bottom is lore
 * only); the card IS its effect, «each step your TR is raised, you gain 2 M€» (the Earth tag). RULE READINGS (pinned by
 * tests/cards/prelude2/TerraformingDeal.spec.ts):
 *  1. ONE phase gate — `paysNow`, read by the hook AND the twin. Upstream pays in the ACTION and PRELUDES phases and
 *     while classic Turmoil resolves (`game.inTurmoil` — the global event, the chairman's rating) — i.e. everywhere
 *     but the PRODUCTION phase (the final greenery, its own spec's case). A Turmoil Redux table never sets
 *     `inTurmoil` (`Game.ts` — only under `game.turmoil`): its reading of «the Turmoil phase» is the PARLIAMENT
 *     phase (`ParliamentPhase.start` / `resume`), where a resolution's winner raises a scale for rating
 *     (`WinnerParameterStep`) and a Career step on the sitting pays its rating (`ChairmanSeat.payStep`). The
 *     PRODUCTION phase (the final greenery) and SOLAR (the World Government's step is nobody's rating) pay nothing.
 *  2. THE OWNER'S OWN RATING — `cardOwner.id === player.id`, every step of one call in one payout (`+3 TR` → `+6 M€`
 *     in one record), paid SYNCHRONOUSLY with the card as its source (`from: {card: this}`) inside the hook's
 *     `tr-increase` scope (the reaction record). A rival's rating, MarsBot's included, pays nothing. What the rating
 *     funnel REFUSES pays nothing because the hook never runs: the UNMI veto (RX42), the step Preservation Program eats
 *     (P57 — only the rest of the call is counted). Upstream's TODO about the classic Reds' tax: there is no such tax
 *     on a Redux table (`RedsBudget`).
 *  3. THE FORECAST TWIN — `grantForecast` on the engine's ONE rating pass (`{kind: 'tr'}` — the explicit TR chips +
 *     the scale steps + the bonus steps crossed − the veto: the very sum the ruling Greens are paid on, Lotus
 *     Innovations' shape): one exact «+2 M€ × steps» on the effect row (`printedEffect: 0`), silent for a rival and
 *     wherever rule 1 keeps the hook silent. No `once`: every grant of an operation (`now`, `placed`) pays its own.
 */
export class TerraformingDeal extends PreludeCard implements IPreludeCard {
  constructor() {
    super({
      name: CardName.TERRAFORMING_DEAL,
      tags: [Tag.EARTH],

      metadata: {
        cardNumber: 'P64',
        renderData: CardRenderer.builder((b) => {
          b.effect('Each step your TR is raised, you gain 2 M€.', (eb) => {
            eb.tr(1).startEffect.megacredits(TERRAFORMING_DEAL_MC_PER_STEP);
          });
        }),
      },
    });
  }

  /** Rule 1 — THE phase gate (the classic `inTurmoil` and its Redux reading, the Parliament phase). */
  public static paysNow(game: IGame): boolean {
    const phase = game.phase;
    return phase === Phase.ACTION || phase === Phase.PRELUDES || game.inTurmoil || phase === Phase.PARLIAMENT;
  }

  /** Rules 1 · 2. */
  public onIncreaseTerraformRatingByAnyPlayer(cardOwner: IPlayer, player: IPlayer, steps: number) {
    if (cardOwner.id !== player.id || steps <= 0 || !TerraformingDeal.paysNow(cardOwner.game)) {
      return;
    }
    cardOwner.stock.add(Resource.MEGACREDITS, TERRAFORMING_DEAL_MC_PER_STEP * steps, {log: true, from: {card: this}});
  }

  /** Rule 3 — the mirror: the owner's rating grant, one exact fact on the effect row, silent where the hook is. */
  public grantForecast(cardOwner: IPlayer, activePlayer: IPlayer, grant: EffectForecastGrant): ReadonlyArray<EffectForecastFact> {
    if (grant.kind !== 'tr' || grant.amount <= 0 || cardOwner.id !== activePlayer.id || !TerraformingDeal.paysNow(cardOwner.game)) {
      return [];
    }
    return [forecast.exact(
      {...forecast.sourceOf(this, cardOwner, 'tr-increase'), printedEffect: 0},
      [actionPreviews.stockGain(cardOwner, Resource.MEGACREDITS, TERRAFORMING_DEAL_MC_PER_STEP * grant.amount)],
      'You raise your terraform rating')];
  }
}
