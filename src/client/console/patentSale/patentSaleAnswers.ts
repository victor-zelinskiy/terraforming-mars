/*
 * @console-shared LIVE — the patent sale's view-model (pure, DOM-free).
 *
 * THE TABLE ANSWERS THE SALE (Turmoil Redux TR46 Research Startups): the sale
 * prompt carries the server's RATE (`SelectCardModel.patentSale` —
 * `common/models/PatentSaleModel.ts`): the M€ one card sold pays and the
 * table's answers to ONE card sold, in the live walk's order (the seller's
 * `onPatentsSold` reactors, then what answers THEM — Martian Fiber after the
 * data, PL-189). This module multiplies that rate by the cards picked — and
 * does nothing else: no rate, no reactor and no rule lives on the client (K-S1
 * — the summary used to keep its own 1 M€ constant).
 *
 * Read by three surfaces, one reading: the hand's live sale summary
 * (`.con-hand__salebar`), the standard-projects row's forecast door, and the
 * trade terminal's payout (the receiver cards and their tokens).
 */
import {CardName} from '@/common/cards/CardName';
import {PatentSaleModel} from '@/common/models/PatentSaleModel';
import {EffectForecast, EffectForecastCertainty, emptyEffectForecast, forecastSourceIsCardless} from '@/common/models/EffectForecastModel';
import {ResourceTransferSpec} from '@/client/console/resourceTransfer/resourceTransferModel';

/** One answer of the table to the sale of `count` cards — a chip with its card. */
export type PatentSaleAnswer = {
  /** Stable within one sale (the fact id + the chip's position). */
  key: string;
  /** The answering source's name (a card name, or a cardless rule / party / law key). */
  source: string;
  /** The answering card, when the source IS a card (a corporation included) — the terminal shows it. */
  card?: CardName;
  /** The chip's icon key (`data`, `megacredits`, …). */
  icon: string;
  /** What the sale of `count` cards pays — the rate × count. */
  amount: number;
  /** Where the chip lands: a card's own pool (`host`), the seller's stock, or a pool the terminal does not fly to. */
  channel: 'card-resource' | 'stock' | 'other';
  /** The card a card-resource chip lands on (the server's `host` stamp). */
  host?: CardName;
  certainty: EffectForecastCertainty;
};

const STANDARD_RESOURCES: ReadonlySet<string> = new Set(['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat']);

/** The answers the sale of `count` cards draws, in the server's order. Unknown facts keep a row with no chip. */
export function patentSaleAnswers(model: PatentSaleModel | undefined, count: number): Array<PatentSaleAnswer> {
  const out: Array<PatentSaleAnswer> = [];
  for (const fact of model?.answers ?? []) {
    if (fact.recipient.kind !== 'you') {
      continue; // nothing in scope answers the seller's sale on another seat — and the terminal pays the seller only
    }
    const card = forecastSourceIsCardless(fact.source) ? undefined : fact.source.name as CardName;
    const base = {source: fact.source.name, ...(card !== undefined ? {card} : {}), certainty: fact.certainty};
    if (fact.effects.length === 0) {
      out.push({key: `${fact.id}|0`, ...base, icon: '', amount: 0, channel: 'other'});
      continue;
    }
    fact.effects.forEach((effect, i) => {
      if (effect.direction !== 'gain') {
        return;
      }
      const host = effect.host as CardName | undefined;
      const channel: PatentSaleAnswer['channel'] = host !== undefined ? 'card-resource' :
        STANDARD_RESOURCES.has(effect.icon) && effect.note !== 'production' ? 'stock' : 'other';
      out.push({key: `${fact.id}|${i}`, ...base, icon: effect.icon, amount: effect.amount * count, channel, ...(host !== undefined ? {host} : {})});
    });
  }
  return out;
}

export type PatentSaleSummary = {
  count: number;
  /** The project's own M€ for `count` cards. */
  payout: number;
  /** The table's answers, in order. */
  answers: ReadonlyArray<PatentSaleAnswer>;
  /** The seller's M€ before → after: the project AND every M€ answer of the seller's stock. */
  before: number;
  after: number;
};

/** The live sale summary — every number the server's rate times the cards picked. */
export function patentSaleSummary(model: PatentSaleModel | undefined, count: number, megacredits: number): PatentSaleSummary {
  const payout = count * (model?.megacreditsPerCard ?? 0);
  const answers = patentSaleAnswers(model, count);
  const answered = answers.reduce((sum, a) => sum + (a.channel === 'stock' && a.icon === 'megacredits' ? a.amount : 0), 0);
  return {count, payout, answers, before: megacredits, after: megacredits + payout + answered};
}

/**
 * The answers as ONE forecast for the standard-projects row's door (R3 «Эффекты»):
 * the facts of ONE card sold, each with the per-card note (the sale's count is
 * not chosen yet). `undefined` when nothing answers.
 */
export function patentSaleRowForecast(model: PatentSaleModel | undefined): EffectForecast | undefined {
  const facts = model?.answers ?? [];
  if (facts.length === 0) {
    return undefined;
  }
  return {...emptyEffectForecast(), facts, coverage: facts.some((f) => f.certainty === 'unknown') ? 'partial' : 'complete'};
}

/** The terminal's flight of one answer — a card-resource chip into its host's capsule, a stock chip onto the rail. */
export function answerTransferSpec(answer: PatentSaleAnswer): ResourceTransferSpec | undefined {
  if (answer.amount <= 0 || answer.certainty === 'unknown') {
    return undefined;
  }
  if (answer.channel === 'card-resource' && answer.host !== undefined) {
    return {channel: 'card-resource', resource: answer.icon, amount: answer.amount, targetCard: answer.host};
  }
  if (answer.channel === 'stock') {
    return {channel: 'stock', resource: answer.icon, amount: answer.amount};
  }
  return undefined;
}

/**
 * THE CARDS THE TERMINAL STANDS UP — every card the answers name, in their
 * order: the card a chip lands ON (TR46 — its capsule is the counter that
 * ticks) and the card a stock chip comes FROM (Martian Fiber — its face is the
 * chip's birth point). A cardless source stands nothing.
 */
export function patentSaleReceivers(answers: ReadonlyArray<PatentSaleAnswer>): Array<CardName> {
  const out: Array<CardName> = [];
  for (const answer of answers) {
    if (answerTransferSpec(answer) === undefined) {
      continue;
    }
    const card = answer.channel === 'card-resource' ? answer.host : answer.card;
    if (card !== undefined && !out.includes(card)) {
      out.push(card);
    }
  }
  return out;
}
