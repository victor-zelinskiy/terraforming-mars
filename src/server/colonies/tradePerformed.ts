import {CardName} from '../../common/cards/CardName';
import {Resource} from '../../common/Resource';
import {IPlayer} from '../IPlayer';
import {ParliamentHandler} from '../parliament/ParliamentHandler';

/**
 * «A TRADE WAS PERFORMED» — ONE module for every destination a trade can go to.
 *
 * The fact of a trade has two consumers, and until a trade could go somewhere
 * other than a colony both were written inside `Colony`: the chairman quest
 * («trade N times» — `ParliamentHandler.onTrade`) and the flat every-trade card
 * bonus (Venus Trade Hub's +3 M€). A fleet dock (`FleetDock.ts`) is a trade
 * with no colony in it, so the two moved here and BOTH destinations call them:
 *
 *  · `reportTrade` — the trade became a fact (the fee is paid, the fleet is
 *    committed). A colony reports it before its track question, a dock before
 *    the fleet lands — the same beat.
 *  · `payTradeFlatBonuses` — after the destination's own income is granted.
 *
 * They stay two calls, not one, because the colony keeps each at its historical
 * point (the order of its events is unchanged); the dock calls them around its
 * own landing in the same order.
 */

/** One flat every-trade card bonus — what the trade pays on top of its destination's own reward. */
export type TradeFlatBonus = {card: CardName, resource: Resource, amount: number};

/**
 * The flat bonuses EVERY trade of this player pays (Venus Trade Hub: +3 M€).
 * READ-ONLY: the payer below and the trade previews (`colonyTradePreview.ts`)
 * both read this list, so the promise and the payout cannot drift.
 */
export function tradeFlatBonuses(player: IPlayer): ReadonlyArray<TradeFlatBonus> {
  const bonuses: Array<TradeFlatBonus> = [];
  if (player.tableau.has(CardName.VENUS_TRADE_HUB)) {
    bonuses.push({card: CardName.VENUS_TRADE_HUB, resource: Resource.MEGACREDITS, amount: 3});
  }
  return bonuses;
}

/** The trade is a fact: the chairman quest counts it (the tracker's own eligibility judges whose trade it was). */
export function reportTrade(player: IPlayer): void {
  ParliamentHandler.onTrade(player);
}

/**
 * Pay the flat every-trade bonuses. `named` attributes each gain to the card
 * that pays it — a dock's trade is rooted at the DOCK card, so an unnamed gain
 * would read as that card's own; a colony's trade keeps the historical
 * unnamed gain (it reads under the colony's root, as it always has).
 */
export function payTradeFlatBonuses(player: IPlayer, opts: {named?: boolean} = {}): void {
  for (const bonus of tradeFlatBonuses(player)) {
    player.stock.add(bonus.resource, bonus.amount, opts.named === true ? {log: true, from: {card: bonus.card}} : {log: true});
  }
}
