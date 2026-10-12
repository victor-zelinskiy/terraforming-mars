import {IPlayer} from '../IPlayer';
import {ICard} from '../cards/ICard';
import {ActionEffect} from '../../common/models/ActionPreviewModel';
import {EffectForecastFact} from '../../common/models/EffectForecastModel';
import {PatentSaleModel} from '../../common/models/PatentSaleModel';
import {SELL_PATENTS_MEGACREDITS_PER_CARD} from '../cards/base/standardProjects/patentSale';
import {patentSaleFacts} from './effectForecast';

/** The note every answer carries — its chips are per card sold. */
export const PER_CARD_SOLD_NOTE = 'For each card sold';

/**
 * READ-ONLY: THE PATENT SALE'S RATE for the sale prompt (`SelectCardModel.
 * patentSale`) — the M€ one card sold pays, and the table's answers to ONE card
 * sold (`effectForecast.patentSaleFacts(player, project, 1)`), each chip
 * stripped of its `current → resulting`: that pool belongs to the count the
 * player picks, and the client computes it from the rate (the summary's
 * «M€ before → after» sums the project's rate and every M€ answer of the seller).
 *
 * Linearity is the model's contract, not a hope: `tests/models/patentSaleModel.
 * spec.ts` executes sales of 1…5 cards and compares each with «rate × N».
 */
export function patentSaleModel(player: IPlayer, project: ICard): PatentSaleModel {
  const answers = patentSaleFacts(player, project, 1).map(perCard);
  return {
    megacreditsPerCard: SELL_PATENTS_MEGACREDITS_PER_CARD,
    ...(answers.length > 0 ? {answers} : {}),
  };
}

function perCard(fact: EffectForecastFact): EffectForecastFact {
  const strip = (effect: ActionEffect): ActionEffect => {
    const {current: _current, resulting: _resulting, ...rest} = effect;
    return rest;
  };
  return {
    ...fact,
    // The count is not chosen yet: every reading of this list (the row's forecast layer) says the chip is per card.
    note: fact.note ?? PER_CARD_SOLD_NOTE,
    effects: fact.effects.map(strip),
    alternatives: fact.alternatives?.map((a) => ({...a, effects: a.effects.map(strip)})),
  };
}
