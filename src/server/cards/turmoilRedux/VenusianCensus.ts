import {IProjectCard} from '../IProjectCard';
import {IActionCard} from '../ICard';
import {IPlayer} from '../../IPlayer';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardResource} from '../../../common/CardResource';
import {PartyName} from '../../../common/turmoil/PartyName';
import {GlobalParameter} from '../../../common/GlobalParameter';
import {CardRenderer} from '../render/CardRenderer';
import {all} from '../Options';
import {PlayerInput} from '../../PlayerInput';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import {EffectForecastGrant} from '../EffectForecastContext';
import {GlobalParameterRaise} from '../GlobalParameterRaise';
import {recordScaleStepReward} from '../scaleStepReward';
import * as actionPreviews from '../actionPreviews';
import * as forecast from '../effectForecastPreviews';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import {censusAction, censusActionPreview, censusActionRows, censusCanAct, censusUnavailableReason, DATA_CENSUS} from './censusAction';

/** The printed rate — data on THIS card per Venus step made. */
export const VENUSIAN_CENSUS_DATA_PER_STEP = 2;

/**
 * TR24 — VENUSIAN CENSUS («Венерианская перепись»), a Turmoil Redux PROJECT
 * card — the set's FIRST card with a Venus tag (`compatibility: 'venus'`), and
 * the first card of the fork whose effect answers A STEP OF A SCALE, whoever
 * made it (`ICard.onGlobalParameterRaised`, the dispatcher Aphrodite now shares;
 * docs/TURMOIL_REDUX_VENUSIAN_CENSUS.md). SISTER: TR15 Martian Census — the
 * action is printed word for word on both and lives in `censusAction.ts`.
 *
 * SCAN READING — cost 6; one tag in the corner (the blue disc with the «V»:
 * Venus). The orange MIN plate beside the cost holds Unity's emblem (three
 * rings): the REQUIREMENT, never a tag. No VP badge. One row split by a
 * vertical rule: on the left the EFFECT — the Venus scale gauge in the red-and-
 * yellow «any player» halo (the frame TR15's city and TR23's colony wear;
 * Aphrodite's `venus(1, {all})`) : two data icons stacked (two icons, never
 * «2×»); on the right the ACTION, TR15's «→ [data] OR» / «3 [data] →
 * [delegate]». Bottom left: the Venus Next icon (`compatibility: 'venus'` —
 * rulebook p.8: without Venus Next «remove the appropriate Turmoil Redux
 * cards… The Venus cards in question have a Venus Next icon on them») and the
 * purple Turmoil hexagon (the module itself — never `compatibility:
 * 'turmoil'`, see TR02). Flavour (printed): «I can bet good money none of them
 * are afraid of heights!». The rulebook does not mention the card; the
 * readings below stand on the engine's precedents (Aphrodite).
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/VenusianCensus.spec.ts):
 *  1. The requirement is Unity's plate (`{party: UNITY}`, the class of TR15):
 *     Unity rules, or 2 of the player's delegates stand on its resolution.
 *     Checked at the PLAY only.
 *  2. THE TRIGGER is every RAISE of the Venus scale — by anyone and by anything:
 *     the owner, an opponent, MarsBot, a trade with Redux Venus («terraform Venus
 *     1 step»), a resolution winner's step, a resolution's WORLD move with no TR
 *     (RX12 Gas Export) and the World Government's Solar Phase terraforming.
 *     That is Aphrodite's position in the engine (outside the reward gate — RX12
 *     says so: «what the World Government still pays, this still pays»). A
 *     lowering (the Reds' P3) is no trigger.
 *  3. +2 data PER STEP MADE: a raise of 2 steps → 4 data; at 28 % a raise «by 2»
 *     makes one step → 2 data; at 30 % nothing (the engine returns 0 before any
 *     payout). A Venus step is 2 % — the hook counts STEPS, never percent.
 *  4. The data land on THIS card (a fixed self-target — the auto-select
 *     exemption); no deck, no supply needed.
 *  5. The play places nothing: the effect works on steps made AFTER the card
 *     is in the tableau (the card raises no Venus itself — no «including this»).
 *  6. THE ACTION is the shared census action (`censusAction.ts`): A «+1 data»
 *     always; B «3 data → a delegate on a resolution of the voting area», refused
 *     by ONE reason in order (data < 3 → no resolution → no delegate in the
 *     reserve), staged in «Действия карт». Once per generation.
 *  7. The Venus tag is an ordinary tag (RX12's chairman quest «play 2 Venus
 *     tags», other cards' Venus-tag requirements, awards).
 *  8. The data are ordinary data: the owner's TR18 Martian Fiber pays +1 M€ per
 *     data the owner places — an opponent's raise pays the owner through it.
 *  9. The journal: one effect line of the owner's under the raise; under an
 *     opponent's raise, in the owner's own feed as «you gained» (the
 *     dispatcher's `withEffect` for a foreign owner); a world move with no
 *     author — a line with no raising player.
 * 10. MarsBot never plays the card; its Venus raises ARE triggers (rule 2).
 */
export class VenusianCensus extends Card implements IProjectCard, IActionCard {
  constructor() {
    super({
      name: CardName.VENUSIAN_CENSUS,
      type: CardType.ACTIVE,
      tags: [Tag.VENUS],
      cost: 6,
      resourceType: CardResource.DATA,
      requirements: {party: PartyName.UNITY},

      metadata: {
        cardNumber: 'TR24',
        infoText: [
          {kind: 'effect-short', text: 'Venus step: +2 data here'},
          // B's full rule is over the browser's caption budget — TR15's own short caption, word for word.
          {kind: 'action-short', text: 'Spend 3 data for a delegate on a resolution', tokens: ['delegates']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.effect('After each time Venus is terraformed 1 step, add 2 data resources to this card.', (eb) => {
            // Two data ICONS, as printed (no digit): the face's own reading of «2».
            eb.venus(1, {all}).startEffect.resource(CardResource.DATA, 2);
          }).br;
          censusActionRows(b, DATA_CENSUS);
        }),
      },
    });
  }

  /** The data here buy DELEGATES (`common/cards/holderRole.ts` — the satellite's split, the target step's value line). */
  public readonly resourceRole = {kind: 'delegate'} as const;

  /** Rules 2–4 — every Venus step anyone made: +2 data here per step. */
  public onGlobalParameterRaised(cardOwner: IPlayer, raise: GlobalParameterRaise): void {
    if (raise.parameter !== GlobalParameter.VENUS || raise.steps <= 0) {
      return;
    }
    const amount = VENUSIAN_CENSUS_DATA_PER_STEP * raise.steps;
    cardOwner.addResourceTo(this, {qty: amount, log: true});
    recordScaleStepReward(cardOwner, this, raise, {kind: 'cardResource', resource: CardResource.DATA, amount});
  }

  /** The forecast twin of `onGlobalParameterRaised` — the same predicate, the grant's STEPS. */
  public grantForecast(cardOwner: IPlayer, _activePlayer: IPlayer, grant: EffectForecastGrant): ReadonlyArray<EffectForecastFact> {
    if (grant.kind !== 'global' || grant.parameter !== GlobalParameter.VENUS || grant.steps <= 0) {
      return [];
    }
    return [forecast.exact(forecast.sourceOf(this, cardOwner, 'global-parameter'),
      [actionPreviews.cardGain(this, VENUSIAN_CENSUS_DATA_PER_STEP * grant.steps)],
      'Venus is terraformed a step')];
  }

  /** Branch A is free, so the action is always open (rule 6) — the module says so, from the spec. */
  public canAct(player: IPlayer): boolean {
    return censusCanAct(player, this, DATA_CENSUS);
  }

  /** …and so there is never a reason (the module's TR66 rule has nothing to name here). */
  public actionUnavailableReason(player: IPlayer): UnplayableReason | undefined {
    return censusUnavailableReason(player, this, DATA_CENSUS);
  }

  public action(player: IPlayer): PlayerInput | undefined {
    return censusAction(player, this, DATA_CENSUS);
  }

  public actionPreview(player: IPlayer): ActionPreview {
    return censusActionPreview(player, this, DATA_CENSUS);
  }
}
