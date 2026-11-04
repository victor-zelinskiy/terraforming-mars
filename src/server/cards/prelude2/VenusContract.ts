import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {IPlayer} from '../../IPlayer';
import {Resource} from '../../../common/Resource';
import {PreludeCard} from '../prelude/PreludeCard';
import {GlobalParameter} from '../../../common/GlobalParameter';
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import {EffectForecastGrant} from '../EffectForecastContext';
import * as actionPreviews from '../actionPreviews';
import * as forecast from '../effectForecastPreviews';

/** «Each step you raise Venus, gain 3 M€» — per step, read by the live hook and its forecast twin alike. */
export const VENUS_CONTRACT_MC_PER_STEP = 3;

/**
 * P65 — VENUS CONTRACT: «Draw 1 Venus card and raise your TR 1 step» (a search — `drawCard: {count: 1, tag: VENUS}`)
 * + «Effect: each step you raise Venus, gain 3 M€». RULE READINGS (pinned by tests/cards/prelude2/VenusContract.spec.ts):
 *  1. «YOU RAISE» — the hook is `onGlobalParameterIncrease`, which the engine calls ONLY for the RAISER's own played
 *     cards and ONLY inside the reward gate (`Game.increaseVenusScaleLevel` — `rewarded`): the World Government's step
 *     (SOLAR) and a resolution's WORLD move (`unrewarded`) pay nothing; a resolution's WINNER raising Venus on the
 *     sitting (`WinnerParameterStep`) is a rewarded raise and pays. `steps` are the steps MADE (clamped at the
 *     maximum), so a raise the ceiling cuts pays only what moved. A law that REPLACES the raise (RX35) moves no scale,
 *     so the hook never runs; the UNMI veto (RX42) refuses the RATING, not the scale — the card still pays.
 *  2. Paid SYNCHRONOUSLY with the card as its source (`from: {card: this}`) inside the dispatcher's `global-parameter`
 *     scope — the reaction record and the standard log line.
 *  3. THE FORECAST TWIN — `grantForecast` on the engine's scale pass (`{kind: 'global'}`, asked of the RAISER's
 *     reactors only and never for a world move — `scaleRaiseFacts`), Homeostasis Bureau's shape: one exact
 *     «+3 M€ × steps» on the effect row (`printedEffect: 0`), silent for anything but the owner's own Venus steps.
 */
export class VenusContract extends PreludeCard {
  constructor() {
    super({
      name: CardName.VENUS_CONTRACT,
      tags: [Tag.VENUS],

      behavior: {
        drawCard: {count: 1, tag: Tag.VENUS},
        tr: 1,
      },

      metadata: {
        cardNumber: 'P65',
        description: 'Draw 1 Venus card and raise your TR 1 step.',
        renderData: CardRenderer.builder((b) => {
          b.effect('Each step you raise Venus, gain 3 M€.', (eb) => {
            eb.venus(1).startEffect.megacredits(VENUS_CONTRACT_MC_PER_STEP);
          });
          b.br;
          b.cards(1, {secondaryTag: Tag.VENUS}).tr(1);
        }),
      },
    });
  }

  /** Rules 1 · 2. */
  public onGlobalParameterIncrease(player: IPlayer, parameter: GlobalParameter, steps: number) {
    if (parameter === GlobalParameter.VENUS) {
      player.stock.add(Resource.MEGACREDITS, VENUS_CONTRACT_MC_PER_STEP * steps, {log: true, from: {card: this}});
    }
  }

  /** Rule 3 — the mirror: the owner's own Venus steps, one exact fact on the effect row. */
  public grantForecast(cardOwner: IPlayer, activePlayer: IPlayer, grant: EffectForecastGrant): ReadonlyArray<EffectForecastFact> {
    if (grant.kind !== 'global' || grant.parameter !== GlobalParameter.VENUS || grant.steps <= 0 || cardOwner.id !== activePlayer.id) {
      return [];
    }
    return [forecast.exact(
      {...forecast.sourceOf(this, cardOwner, 'global-parameter'), printedEffect: 0},
      [actionPreviews.stockGain(cardOwner, Resource.MEGACREDITS, VENUS_CONTRACT_MC_PER_STEP * grant.steps)],
      'You raise Venus a step')];
  }
}
