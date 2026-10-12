import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {PatentSaleModel} from '@/common/models/PatentSaleModel';
import {EffectForecastFact} from '@/common/models/EffectForecastModel';
import {
  answerTransferSpec, patentSaleAnswers, patentSaleReceivers, patentSaleRowForecast, patentSaleSummary,
} from '@/client/console/patentSale/patentSaleAnswers';
import {abortPatentSale, armPatentSale, patentSaleState} from '@/client/console/patentSale/consolePatentSale';

/**
 * THE TABLE ANSWERS THE SALE (TR46): the client multiplies the server's rate
 * (`SelectCardModel.patentSale`) and keeps none of its own (K-S1). The model
 * below is the server's own shape for Research Startups + Martian Fiber
 * (`tests/models/patentSaleModel.spec.ts` pins the server half).
 */
const RS = CardName.RESEARCH_STARTUPS;
const FIBER = CardName.MARTIAN_FIBER;

function fact(id: string, name: CardName, effects: EffectForecastFact['effects'], certainty: EffectForecastFact['certainty'] = 'exact'): EffectForecastFact {
  return {
    id,
    source: {kind: 'card', name, owner: 'blue', channel: 'standard-project'},
    certainty,
    recipient: {kind: 'you'},
    timing: 'immediate',
    effects,
    reason: 'You sell patents',
    note: 'For each card sold',
  };
}

const MODEL: PatentSaleModel = {
  megacreditsPerCard: 1,
  answers: [
    fact('a', RS, [{direction: 'gain', icon: 'data', amount: 1, note: 'on this card', host: RS}]),
    fact('b', FIBER, [{direction: 'gain', icon: 'megacredits', amount: 1}]),
  ],
};

describe('patentSaleAnswers — the server\'s rate × the cards picked', () => {
  it('the answers in the server\'s order, each × the count, with their channel', () => {
    const answers = patentSaleAnswers(MODEL, 4);
    expect(answers.map((a) => [a.source, a.icon, a.amount, a.channel, a.host ?? null])).deep.eq([
      [RS, 'data', 4, 'card-resource', RS],
      [FIBER, 'megacredits', 4, 'stock', null],
    ]);
  });

  it('the summary: the project\'s money + every M€ answer of the seller in the wallet\'s after', () => {
    expect(patentSaleSummary(MODEL, 4, 20)).deep.include({count: 4, payout: 4, before: 20, after: 28});
    const bare = patentSaleSummary({megacreditsPerCard: 1}, 3, 10);
    expect(bare).deep.include({payout: 3, after: 13});
    expect(bare.answers).deep.eq([]);
  });

  it('zero picks: an honest no-op on the wallet; no model: no rate of the client\'s own', () => {
    expect(patentSaleSummary(MODEL, 0, 15)).deep.include({payout: 0, before: 15, after: 15});
    expect(patentSaleSummary(undefined, 5, 15)).deep.include({payout: 0, after: 15});
  });

  it('an unknown answer keeps its row (named, no chip) and flies nothing', () => {
    const model: PatentSaleModel = {megacreditsPerCard: 1, answers: [fact('u', RS, [], 'unknown')]};
    const [row] = patentSaleAnswers(model, 2);
    expect(row).deep.include({source: RS, amount: 0, certainty: 'unknown', channel: 'other'});
    expect(answerTransferSpec(row)).is.undefined;
    expect(patentSaleReceivers([row])).deep.eq([]);
  });

  it('the terminal\'s flights: data into its host\'s capsule, the Fiber\'s M€ onto the rail — and who stands up', () => {
    const answers = patentSaleAnswers(MODEL, 4);
    expect(answers.map(answerTransferSpec)).deep.eq([
      {channel: 'card-resource', resource: 'data', amount: 4, targetCard: RS},
      {channel: 'stock', resource: 'megacredits', amount: 4},
    ]);
    expect(patentSaleReceivers(answers), 'the card the data land ON, then the card whose chip it is').deep.eq([RS, FIBER]);
  });

  it('the standard-projects row\'s door reads the per-card facts; nothing answers → no door', () => {
    expect(patentSaleRowForecast(MODEL)?.facts).has.length(2);
    expect(patentSaleRowForecast(MODEL)?.coverage).eq('complete');
    expect(patentSaleRowForecast({megacreditsPerCard: 1})).is.undefined;
  });
});

describe('consolePatentSale — the receivers the terminal stands up', () => {
  afterEach(() => abortPatentSale());

  it('arm freezes the answers and the receivers with their capsule; abort clears them', () => {
    armPatentSale({
      cards: [CardName.TREES, CardName.FISH, CardName.BIRDS, CardName.ANTS],
      payoutPerCard: 1,
      answers: patentSaleAnswers(MODEL, 4),
      capsuleOf: (name) => (name === RS ? 2 : 0),
    });
    expect(patentSaleState.payout).eq(4);
    expect(patentSaleState.receivers).deep.eq([{card: RS, before: 2}, {card: FIBER, before: 0}]);
    expect(patentSaleState.answers.map((a) => a.amount)).deep.eq([4, 4]);
    abortPatentSale();
    expect(patentSaleState.active).is.false;
  });

  it('a sale nothing answers stands nobody up (the scene it always was)', () => {
    armPatentSale({cards: [CardName.TREES], payoutPerCard: 1});
    expect(patentSaleState.receivers).deep.eq([]);
    expect(patentSaleState.receiversUp).is.false;
  });
});
