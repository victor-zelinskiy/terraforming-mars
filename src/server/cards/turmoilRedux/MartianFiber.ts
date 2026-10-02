import {IActionCard, ICard} from '../ICard';
import {IPlayer} from '../../IPlayer';
import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {CardResource} from '../../../common/CardResource';
import {CardName} from '../../../common/cards/CardName';
import {Resource} from '../../../common/Resource';
import {PartyName} from '../../../common/turmoil/PartyName';
import {CardRenderer} from '../render/CardRenderer';
import {ActionCard} from '../ActionCard';
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import {EffectForecastGrant} from '../EffectForecastContext';
import * as actionPreviews from '../actionPreviews';
import * as forecast from '../effectForecastPreviews';

/** The printed «also gain 1 M€» — per data added. */
export const MEGACREDITS_PER_DATA = 1;

/**
 * TR18 — MARTIAN FIBER («Марсианское оптоволокно»).
 *
 * No new mechanic: Meat Industry's twin (`promo/MeatIndustry.ts` — «whenever
 * you add an animal to ANY card, +2 M€»: the `onResourceAdded` hook and its
 * `grantForecast` twin) for DATA at 1 M€, plus a free «+1 data here» action
 * (TR15's branch A), Ants' «1 VP per 2 resources here» and TR15's Mars First
 * plate. The set's fourth data holder (TR02, TR05, TR15).
 *
 * SCAN READING — cost 12; two tags in the corner, Mars and Building (the
 * scan's order). The orange MIN plate beside the cost holds the MARS FIRST
 * emblem: the REQUIREMENT («Requires Mars First to be ruling or that you have
 * 2 delegates there»), never a tag. One row split by a vertical rule: the
 * EFFECT «[data]* : [1 M€]» | the ACTION «→ [data]». The VP badge «1/2 [data]»
 * — the planet under it is the badge's backdrop. The purple Turmoil symbol at
 * the bottom left is the module itself (no `compatibility`).
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/MartianFiber.spec.ts):
 *  1. The requirement is `{party: MARS}` (the TR15 class): Mars First rules, or
 *     2 of your delegates on its resolution — checked at the PLAY only.
 *  2. The effect pays PER DATA: +1 M€ for each data added (TR01's 4 data → +4
 *     M€), as Meat Industry pays per animal. Only an ADDITION (`count > 0` —
 *     `Player.addResourceTo` calls the hook for nothing else); data spent or
 *     removed pay nothing. Any other resource pays nothing.
 *  3. «ANY card» is any card of the PLAYER that holds data: this one (its own
 *     action pays), TR02, TR05, TR15, a data corporation. The hook fires on the
 *     owner of the RECEIVING card — `addResourceTo` walks the adding player's
 *     own tableau — so data an effect puts on your card in another player's
 *     turn (TR15: an opponent's city on Mars) pay you, and an opponent adding
 *     data to their own card pays you nothing (Meat Industry with Pets).
 *  4. The action is free, once per generation: +1 data here
 *     (`action: {addResources: 1}`), and the effect answers it at once with
 *     +1 M€. Never unavailable but for «already used».
 *  5. VP: 1 per 2 data on THIS card (`victoryPoints: {resourcesHere: {}, per: 2}`).
 *  6. The M€ name this card as their source: the hook runs inside
 *     `events.withEffect(…, 'resource-added')` (the effects overlay), the stock
 *     gain carries `from: {card}` (the event's source; the log line reads
 *     «because of Martian Fiber»), the forecast's source is the card.
 *  7. MarsBot never plays the card.
 */
export class MartianFiber extends ActionCard implements IActionCard {
  constructor() {
    super({
      name: CardName.MARTIAN_FIBER,
      type: CardType.ACTIVE,
      tags: [Tag.MARS, Tag.BUILDING],
      cost: 12,
      resourceType: CardResource.DATA,
      requirements: {party: PartyName.MARS},
      victoryPoints: {resourcesHere: {}, per: 2},

      action: {
        addResources: 1,
      },

      metadata: {
        cardNumber: 'TR18',
        // The printed effect is 61 (RU ≈ 82) — over the browser's caption budget of 52.
        infoText: [{kind: 'effect-short', text: 'Data added to any card: +1 M€ each'}],
        // The scan splits the row with a vertical rule (the effect | the action); the DSL has no vertical
        // divider, so the effect stands on its own row above the action — as TR15 does.
        renderData: CardRenderer.builder((b) => {
          b.effect('Whenever you add a data resource to ANY card, also gain 1 M€.', (eb) => {
            eb.resource(CardResource.DATA).asterix().startEffect.megacredits(MEGACREDITS_PER_DATA);
          }).br;
          b.action('Add 1 data resource to this card.', (eb) => {
            eb.empty().startAction.resource(CardResource.DATA);
          }).br;
          b.vpText('1 VP per 2 data resources here.');
        }),
      },
    });
  }

  /** Rules 2, 3, 6 — every data added to any of the owner's cards: 1 M€ each, from this card. */
  public onResourceAdded(player: IPlayer, card: ICard, count: number) {
    if (card.resourceType === CardResource.DATA) {
      player.stock.add(Resource.MEGACREDITS, count * MEGACREDITS_PER_DATA, {log: true, from: {card: this}});
    }
  }

  /** Mirrors `onResourceAdded`: 1 M€ per data added to any of the owner's cards, at once. */
  public grantForecast(cardOwner: IPlayer, _activePlayer: IPlayer, grant: EffectForecastGrant): ReadonlyArray<EffectForecastFact> {
    if (grant.kind !== 'cardResource' || grant.resource !== CardResource.DATA || grant.amount <= 0) {
      return [];
    }
    return [forecast.exact(forecast.sourceOf(this, cardOwner, 'resource-added'),
      [actionPreviews.stockGain(cardOwner, Resource.MEGACREDITS, grant.amount * MEGACREDITS_PER_DATA)],
      'You add data to a card')];
  }
}
