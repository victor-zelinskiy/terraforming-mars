import {IPlayer} from '../IPlayer';
import {ICard} from '../cards/ICard';
import {ParliamentHandler} from '../parliament/ParliamentHandler';
import {TradeDestinationSource} from './ITradeDestination';
import {EffectForecastFact} from '../../common/models/EffectForecastModel';
import {CardName} from '../../common/cards/CardName';
import {Resource} from '../../common/Resource';
import {TradeReactorGainModel} from '../../common/models/ColonyTradeManifestModel';
import * as forecast from '../cards/effectForecastPreviews';

/**
 * «A TRADE WAS PERFORMED» — ONE module for every destination a trade can go to.
 *
 * The fact of a trade has two consumers, and until a trade could go somewhere
 * other than a colony both were written inside `Colony`: the chairman quest
 * («trade N times» — `ParliamentHandler.onTrade`) and the cards that ANSWER a
 * trade (Venus Trade Hub: «when you trade, gain 3 M€»). A fleet dock
 * (`FleetDock.ts`) is a trade with no colony in it, so the two moved here and
 * BOTH destinations call them:
 *
 *  · `reportTrade` — the trade became a fact (the fee is paid, the fleet is
 *    committed). A colony reports it before its track question, a dock before
 *    the fleet lands — the same beat.
 *  · `fireTradeHooks` — after the destination's own income is granted: every
 *    card of the trader's tableau with an `onTrade` hook answers, each inside
 *    ITS OWN passive-effect scope (trigger `'trade'`) — so the gain is the
 *    card's (the journal's cause, the card-reaction record the console plays,
 *    the effect stats) on every door alike, never the colony's or the dock's.
 *
 * They stay two calls, not one, because the colony keeps each at its historical
 * point (the order of its events is unchanged); the dock calls them around its
 * own landing in the same order.
 *
 * The hook is the CARD's (co-located — `ICard.onTrade` / `tradeForecast`), never
 * a list of names here: an upstream change to a card meets its hook in the same
 * file. ONE fact of a trade fires the hooks ONCE — the Pathfinders' Mercury
 * «copy a trade» (`COPY_TRADE`, out of scope) re-runs a colony's income, which
 * reaches this call a second time; that is the copied trade's own rule, not a
 * second trade's.
 */

/** What a card answering a trade is told about it — where the fleet went. */
export type TradeContext = {destination: TradeDestinationSource};

/** The trade is a fact: the chairman quest counts it (the tracker's own eligibility judges whose trade it was). */
export function reportTrade(player: IPlayer): void {
  ParliamentHandler.onTrade(player);
}

/** The trader's cards that answer a trade, in tableau order — the live walk and its forecast twin read the same list. */
function tradeReactors(player: IPlayer): Array<ICard> {
  return [...player.tableau].filter((card) => card.onTrade !== undefined);
}

/** The cards that answer the trade — each under its own effect scope, the destination as the cause. */
export function fireTradeHooks(player: IPlayer, trade: TradeContext): void {
  for (const card of tradeReactors(player)) {
    player.game.events.withEffect(player, card, 'trade', () => card.onTrade?.(player, trade), {trade: trade.destination});
  }
}

/**
 * WHAT THE TRADER'S TABLE WILL ANSWER to a trade with `destination` — the
 * forecast twins of the hooks `fireTradeHooks` fires, in the same order; a
 * card with the live hook and no twin is an honest `unknown`. Read-only (the
 * trade previews: the colony's and the dock's).
 */
export function tradeReactorFacts(player: IPlayer, trade: TradeContext): Array<EffectForecastFact> {
  const facts: Array<EffectForecastFact> = [];
  for (const card of tradeReactors(player)) {
    const own = card.tradeForecast?.(player, trade);
    facts.push(...(own ?? [forecast.unknown(forecast.sourceOf(card, player, 'trade'), 'This card reacts to the trade, but its result is not described', {
      recipient: forecast.recipientOf(player, player),
    })]));
  }
  return facts;
}

/**
 * The reactors' own STOCK gains, in the wire form both the previews (`flatBonuses` — «СОСТАВ НАГРАДЫ») and the
 * trade manifest (`reactorGains` — the console's trade scene holds and declares these rows as the card's answer)
 * read: off their EXACT facts for the trader, so a promise and the scene's plan state one number.
 */
export function reactorGainsOf(facts: ReadonlyArray<EffectForecastFact>): Array<TradeReactorGainModel> {
  const out: Array<TradeReactorGainModel> = [];
  for (const fact of facts) {
    if (fact.certainty !== 'exact' || fact.recipient.kind !== 'you' || fact.source.kind === 'rule') {
      continue;
    }
    for (const effect of fact.effects) {
      if (effect.direction === 'gain' && effect.note === undefined && effect.icon !== undefined && Object.values(Resource).includes(effect.icon as Resource)) {
        out.push({card: fact.source.name as CardName, resource: effect.icon, amount: effect.amount ?? 0});
      }
    }
  }
  return out;
}
