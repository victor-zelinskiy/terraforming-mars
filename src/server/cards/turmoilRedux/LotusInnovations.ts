import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {CardResource} from '../../../common/CardResource';
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import {IPlayer} from '../../IPlayer';
import {CorporationCard} from '../corporation/CorporationCard';
import {ICorporationCard} from '../corporation/ICorporationCard';
import {CardRenderer} from '../render/CardRenderer';
import {EffectForecastContext, EffectForecastGrant} from '../EffectForecastContext';
import * as actionPreviews from '../actionPreviews';
import * as forecast from '../effectForecastPreviews';

/** «As your first action, increase your TR 2 steps» — the first action's rating. */
export const LOTUS_FIRST_ACTION_TR = 2;
/** «Add 1 data resource to this card» — per step of the owner's rating. */
export const LOTUS_DATA_PER_TR_STEP = 1;
/** «1 VP per 4 data resources here». */
export const LOTUS_DATA_PER_VP = 4;
/** The forecast's reason — ONE i18n key (RU in `effect_forecast.json`). */
export const LOTUS_REASON = 'You raise your terraform rating';

/**
 * TR81 — LOTUS INNOVATIONS («Lotus Innovations»), the FOURTH of the eight NEW corporations of Turmoil Redux (not a
 * replacement — `common/cards/turmoilReduxCorporations.ts`, numbered TR81 by the order of the scan folder). Its own
 * art and its own printed lore, both keyed TR81; no `reimplements`.
 *
 * SCAN READING — the Science tag (the atom) in the corner; «46» + TWO terraform-rating plates — «You start with 46 M€.
 * As your first action, increase your TR 2 steps» (the plates ARE the first action, drawn as printed: two plates, never
 * one «2»). The EFFECT box, one row: «[TR] : [data]» — «After each time you increase your TR by 1, including from this,
 * add 1 data resource to this card». The VP badge «1/4 [data]» — «1 VP per 4 data resources here». Printed lore:
 * «Lotus Innovations started out with just one college grad…». No production, no action. The purple Turmoil diamond
 * at the bottom left is the module itself (no `compatibility`).
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/LotusInnovations.spec.ts):
 *  1. THE FIRST ACTION is declarative (`firstAction: {tr: 2}` — the Executor's own rating step, under the
 *     corporation's own event scope): one call of the rating funnel for two steps.
 *  2. «AFTER EACH TIME YOU INCREASE YOUR TR BY 1» — the ONE funnel every rating gain of the game goes through
 *     (`Player.increaseTerraformRating`) asks `onIncreaseTerraformRatingByAnyPlayer` of every seat's tableau under the
 *     card's effect scope (`tr-increase`); this card answers its OWNER's gain only (`cardOwner === player` — a rival's
 *     rating, MarsBot's included, is nobody's here) with ONE data per step, all the steps of one call at once
 *     (`steps` — «+2 TR» is two data in one record). Whatever raises the rating counts: a card's printed TR, a scale
 *     step (temperature, oxygen, Venus, an ocean — the engine's own `{global: true}` raise), the Venus 16 % bonus, a
 *     standard project, a step of the Career, the final greenery. What the funnel REFUSES pays nothing, because the
 *     hook never runs: the UNMI veto (RX42 — a seat first by rating gains no rating), the Reds' tax unpaid, the step
 *     Preservation Program eats (the rest of the call is counted).
 *  3. «INCLUDING FROM THIS» — the corporation is in the tableau when its own first action raises the rating, so the
 *     first action pays its own two data (no special case: the same hook).
 *  4. THE FORECAST TWIN (`grantForecast` on a `{kind: 'tr'}` grant) — the engine's RATING PASS
 *     (`effectForecast.ratingStepsOf`: the explicit TR chips + every scale step + the bonus steps crossed − the veto,
 *     the very sum the ruling Greens are paid on) offers the operation's rating as ONE grant; this card answers its
 *     owner's with one `exact` fact on its effect row (`printedEffect: 0`) — «+N [data]» on this card — and a rival's
 *     with nothing (no `no` fact: the card is not «almost» on it). A tile's step the play places is offered as its own
 *     grant after the placement (the pass marks it `deferred`).
 *  5. 1 VP PER 4 DATA HERE (`victoryPoints: {resourcesHere: {}, per: 4}` — the Arklight form: the badge, the score's
 *     breakdown and the finale read it). The data are ordinary data: a holder for «data on ANY card», never spent
 *     from here by anything but the owner's own cards.
 *  6. MarsBot never holds the card (no twin).
 */
export class LotusInnovations extends CorporationCard implements ICorporationCard {
  constructor() {
    super({
      name: CardName.LOTUS_INNOVATIONS,
      tags: [Tag.SCIENCE],
      startingMegaCredits: 46,
      resourceType: CardResource.DATA,
      victoryPoints: {resourcesHere: {}, per: LOTUS_DATA_PER_VP},

      firstAction: {
        text: 'Increase your TR 2 steps',
        tr: LOTUS_FIRST_ACTION_TR,
      },

      metadata: {
        cardNumber: 'TR81',
        description: 'You start with 46 M€. As your first action, increase your TR 2 steps. 1 VP per 4 data resources here.',
        infoText: [
          {text: 'As your first action, increase your TR 2 steps.', tokens: ['tr']},
          // ONE effect frame: the caption addresses it without `tokens` (the generator's unambiguous case).
          {kind: 'effect-short', text: 'Each TR step you gain: +1 data here'},
        ],
        renderData: CardRenderer.builder((b) => {
          b.br;
          // The scan's TWO plates — the first action's two steps, as printed.
          b.megacredits(46).nbsp.tr(1).tr(1);
          b.corpBox('effect', (ce) => {
            ce.effect('After each time you increase your TR by 1, including from this, add 1 data resource to this card.', (eb) => {
              eb.tr(1).startEffect.resource(CardResource.DATA);
            });
            ce.vSpace(); // offsets the description up a little, as on Arklight's face
          });
        }),
      },
    });
  }

  /** Rule 2 — one data per step of the OWNER's own rating, every step of the call at once. */
  public onIncreaseTerraformRatingByAnyPlayer(cardOwner: IPlayer, player: IPlayer, steps: number): void {
    if (cardOwner.id !== player.id || steps <= 0) {
      return;
    }
    cardOwner.addResourceTo(this, {qty: steps * LOTUS_DATA_PER_TR_STEP, log: true});
  }

  /** Rule 4 — the mirror: the owner's rating grant, one exact fact on the effect row. */
  public grantForecast(cardOwner: IPlayer, activePlayer: IPlayer, grant: EffectForecastGrant, _ctx: EffectForecastContext): ReadonlyArray<EffectForecastFact> {
    if (grant.kind !== 'tr' || grant.amount <= 0 || cardOwner.id !== activePlayer.id) {
      return [];
    }
    return [forecast.exact(
      {...forecast.sourceOf(this, cardOwner, 'tr-increase'), printedEffect: 0},
      [actionPreviews.cardGain(this, grant.amount * LOTUS_DATA_PER_TR_STEP)],
      LOTUS_REASON)];
  }
}
