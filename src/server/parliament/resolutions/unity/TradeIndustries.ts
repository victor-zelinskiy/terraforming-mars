/*
 * TRADE INDUSTRIES (Unity) — Turmoil Redux resolution RX28: the second card
 * with an ACTION, and the first action that COSTS something
 * (docs/TURMOIL_REDUX_TRADE_INDUSTRIES.md).
 *
 * Printed: «Action: Pay 12 M€ to gain an extra trade fleet. You can pay for
 * this with titanium, and you get a M€ discount equal to 2 times your
 * Influence.» Chairman quest: trade 2 times (decision Q-4 — see below).
 * Colonies are mandatory in Redux, so the card declares no compatibility
 * (Colony Contest's reading of the colony symbol in the scan's field).
 *
 * THE READINGS FIXED HERE:
 *  · THE PRICE IS ONE FUNCTION. `12 − 2 × influence`, floored at zero
 *    (influence 6 buys the fleet for nothing) — `actionBillPrice` over the
 *    card's DECLARED bill (`actionBill`, `common/parliament/actionBill.ts`),
 *    read by the action's own gate, by the bill the commit defers, by the
 *    tile's result chips and by every client surface. Nothing here prices
 *    the fleet twice.
 *  · PAY, THEN GAIN — the vote's own order (`ParliamentHandler`: «PAY, THEN
 *    PLACE»). The answer to the confirm DEFERS the bill through the family's
 *    paid funnel (`runPaidResolutionAction`); the header, the USE and the
 *    fleet all wait in the bill's `andThen`. A bill never settled (a reload
 *    drops the deferred queue) spends nothing, grants nothing, and the action
 *    is offered again — the honest state of «nothing happened».
 *  · TITANIUM PAYS at the ENGINE's rate — `SelectPaymentDeferred`'s own
 *    `canUseTitanium`, the same lane every card with a titanium clause
 *    uses. No titanium path of the card's own; the panel offers the lane
 *    when the seat has titanium, and auto-pays in M€ when it has none.
 *  · THE FLEET is the engine's `increaseFleetSize` (Huan's and the behavior
 *    `addTradeFleet`'s one call), and it CAPS silently — so the action's gate
 *    names a full fleet («already at its maximum») instead of charging for
 *    nothing (invariant 4: no silent loss).
 *  · UNAVAILABLE WITH A REASON, never hidden: not enough to pay — with the
 *    PRICE named and what the seat can put toward it (M€ plus titanium at
 *    its value); a full fleet; a spent use; a seat outside the parliament.
 *  · ONCE PER GENERATION, like every action of the Parliament — the use is
 *    recorded when the bill is settled, never when the prompt is built or
 *    the confirm answered.
 *  · THE CHAIRMAN QUEST IS «TRADE 2 TIMES» (decision Q-4, closed by this
 *    card): the footnote's glyph is the BLACK fleet-with-arrow — the TRADE
 *    symbol, printed differently from the light fleet marker the rule prints
 *    for «gain a fleet» a line above; every quest of the catalog is a DEED
 *    of the seat's own turn, never a state; and «gain 2 fleets in one
 *    generation» would be dead (this very card sells one for 12 M€). A trade
 *    is reported by `Colony.trade` — the one door every trade enters by, the
 *    Unity party's FREE trade included (a trade of the seat's own turn; only
 *    a resolution SOURCE on the stack is cut by decision Q5). A bot's trade
 *    never counts (no seat), nor one outside the action phase.
 */
import {CardRenderer} from '../../../cards/render/CardRenderer';
import {PartyName} from '../../../../common/turmoil/PartyName';
import {Size} from '../../../../common/cards/render/Size';
import {AltSecondaryTag} from '../../../../common/cards/render/AltSecondaryTag';
import {MAX_FLEET_SIZE} from '../../../../common/constants';
import {ResolutionCode, ResolutionId} from '../../../../common/parliament/ParliamentTypes';
import {ActionBillPrice, actionBillPrice, ResolutionActionBill} from '../../../../common/parliament/actionBill';
import {ChoiceContextSource} from '../../../../common/models/PlayerInputModel';
import {ActionEffect} from '../../../../common/models/ActionPreviewModel';
import {message} from '../../../logs/MessageBuilder';
import {SelectOption} from '../../../inputs/SelectOption';
import {IPlayer} from '../../../IPlayer';
import {ResolutionAction, ResolutionDefinition} from '../IResolution';
import {runPaidResolutionAction} from '../ResolutionAction';

export const TRADE_INDUSTRIES_ID: ResolutionId = 'RDX_UNITY_TRADE_INDUSTRIES';
export const TRADE_INDUSTRIES_CODE: ResolutionCode = 'RX28';
/** The printed bill: 12 M€, 2 M€ off per point of influence, titanium accepted. */
export const TRADE_INDUSTRIES_BILL: ResolutionActionBill = {amount: 12, discountPerInfluence: 2, titanium: true};
/** Once per generation, as every action of the Parliament. */
export const TRADE_INDUSTRIES_USES_PER_GENERATION = 1;
/** The action's own gates. */
export const TRADE_INDUSTRIES_FLEET_FULL_REASON = 'Your trade fleet is already at its maximum';
export const TRADE_INDUSTRIES_UNAFFORDABLE_KEY = 'Need ${0} M€ for the trade fleet, you can pay ${1}';
/** The icon key of the fleet chip — the shared fleet sprite (`card-resource-trade-fleet`). */
export const TRADE_FLEET_ICON = 'trade-fleet';

const SOURCE: ChoiceContextSource = {kind: 'resolution', resolution: TRADE_INDUSTRIES_ID};

/** THE PRICE for this seat, right now — the one reading every surface and the bill itself stand on. */
export function tradeIndustriesPrice(player: IPlayer): ActionBillPrice {
  return actionBillPrice(TRADE_INDUSTRIES_BILL, player.game.parliament?.influence(player) ?? 0);
}

/** What the seat can put toward the bill: its spendable M€ plus its titanium at the engine's own value. */
export function tradeIndustriesFunds(player: IPlayer): number {
  return player.spendableMegacredits() + player.titanium * player.getTitaniumValue();
}

/**
 * THE GAIN, after the bill: one fleet through the engine's own call, the
 * journal naming the price and its arithmetic and the fleet count before and
 * after. Returns the count it moved between.
 */
export function grantTradeFleet(player: IPlayer, price: ActionBillPrice): {from: number, to: number} {
  const from = player.colonies.getFleetSize();
  player.colonies.increaseFleetSize();
  const to = player.colonies.getFleetSize();
  player.game.log('${0} gains a trade fleet from ${1} for ${2} M€ (${3} − ${4} for influence ${5}): fleets ${6} → ${7}', (b) =>
    b.player(player).resolution(TRADE_INDUSTRIES_ID).number(price.price).number(price.printed).number(price.discount).number(price.influence).number(from).number(to));
  return {from, to};
}

const TRADE_INDUSTRIES_ACTION: ResolutionAction = {
  usesPerGeneration: () => TRADE_INDUSTRIES_USES_PER_GENERATION,
  canAct(player) {
    if (player.colonies.getFleetSize() >= MAX_FLEET_SIZE) {
      return {available: false, reason: TRADE_INDUSTRIES_FLEET_FULL_REASON};
    }
    const {price} = tradeIndustriesPrice(player);
    // The engine's own affordability, titanium included — the reason names the price and the seat's means.
    if (price > 0 && !player.canAfford({cost: price, titanium: TRADE_INDUSTRIES_BILL.titanium})) {
      return {available: false, reason: message(TRADE_INDUSTRIES_UNAFFORDABLE_KEY, (b) => b.number(price).number(tradeIndustriesFunds(player)))};
    }
    return {available: true};
  },
  // THE COMMIT CONTRACT: building the prompt changes nothing; the answer
  // DEFERS THE BILL, and the bill's settlement is the commit (the use, the
  // fleet). The price on the prompt is the price the bill will charge — one
  // reading, taken again at the answer (the seat's influence is read live).
  execute(player, parliament, meta) {
    const price = tradeIndustriesPrice(player);
    return new SelectOption(
      message('Pay ${0} M€ for an extra trade fleet (Trade Industries)', (b) => b.number(price.price)),
      'Buy fleet')
      .withMetadata({kind: 'generic', icon: 'megacredits', amount: price.price, effects: TRADE_INDUSTRIES_ACTION.preview(player)})
      .markChoiceContext({source: SOURCE, trigger: 'Resolution action', mode: 'effect-choice'})
      .markResolutionActionPrompt(meta)
      .andThen(() => {
        const bill = tradeIndustriesPrice(player);
        runPaidResolutionAction(player, parliament, TRADE_INDUSTRIES_ID, {
          amount: bill.price,
          canUseTitanium: TRADE_INDUSTRIES_BILL.titanium,
          title: message('Select how to pay ${0} M€ for the trade fleet', (b) => b.number(bill.price)),
          meta,
        }, () => {
          grantTradeFleet(player, bill);
        });
        return undefined;
      });
  },
  // THE PRICE AS THE SEAT SEES IT: the discounted sum against the seat's M€
  // — the influence and the discount it bought as the chip's basis, so the
  // tile reads «−8 M€ · influence 2 · discount 4» under the printed 12 —
  // and the fleet it buys. Without a seat (the manifest) — the printed sum,
  // no discount.
  preview(player) {
    const price = player === undefined ? actionBillPrice(TRADE_INDUSTRIES_BILL, 0) : tradeIndustriesPrice(player);
    const cost: ActionEffect = {direction: 'cost', icon: 'megacredits', amount: price.price, note: 'titanium accepted'};
    const fleet: ActionEffect = {direction: 'gain', icon: TRADE_FLEET_ICON, amount: 1};
    if (player !== undefined) {
      const current = player.spendableMegacredits();
      cost.current = current;
      cost.resulting = Math.max(0, current - price.price);
      cost.basis = [{count: price.influence, label: 'Influence'}, {count: price.discount, label: 'Discount'}];
      const fleets = player.colonies.getFleetSize();
      fleet.current = fleets;
      fleet.resulting = Math.min(MAX_FLEET_SIZE, fleets + 1);
    }
    return [cost, fleet];
  },
};

export const TRADE_INDUSTRIES: ResolutionDefinition = {
  id: TRADE_INDUSTRIES_ID,
  code: TRADE_INDUSTRIES_CODE,
  module: 'turmoilRedux',
  party: PartyName.UNITY,
  copies: 1,
  // THE FACE as printed: the ACTION row alone — «12 M€ [influence] → [fleet]»,
  // the price wearing the TITANIUM CORNER (the scan's «you can pay for this
  // with titanium»: a secondary tag on the M€ square, drawn by both
  // renderers as the corner bubble), the influence beside it (what
  // discounts it), the fleet as the fork's own marker.
  renderData: CardRenderer.builder((b) => {
    b.action(undefined, (ab) => ab.megacredits(TRADE_INDUSTRIES_BILL.amount, {secondaryTag: AltSecondaryTag.TITANIUM}).influence({size: Size.SMALL}).startAction.tradeFleet());
  }),
  text: {
    name: 'Trade Industries',
    // The per-generation limit is structural (`usesPerGeneration`), never a
    // clause of the sentence — every surface prints it beside the live uses.
    action: 'Pay 12 M€ to gain an extra trade fleet. You may pay with titanium, and the price is 2 M€ less per influence.',
    quest: 'Trade 2 times',
  },
  quest: {goal: {kind: 'trade'}, count: 2},
  action: TRADE_INDUSTRIES_ACTION,
  actionBill: TRADE_INDUSTRIES_BILL,
};
