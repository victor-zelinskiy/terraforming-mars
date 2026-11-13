import {expect} from 'chai';
import * as taskHostLogic from '@/client/components/console/consoleTaskHostLogic';
import {CardName} from '@/common/cards/CardName';
import {SelectPaymentModel} from '@/common/models/PlayerInputModel';
import {discardOpenCards} from '@/client/console/cardDiscard/discardOpenCard';
import {discardPileState, openDiscardPile, resetDiscardPile} from '@/client/console/discardPile/discardPile';

/**
 * PICK-THEN-PAY IS ONE DECISION (P88 · PL-1411) and THE OPEN-CARD DISCARD TELLS THE PILE THE TRUTH (PL-1410).
 *
 * A workspace purchase whose price the SERVER asks (Helion's heat — the deck-pick marker's `payment`) stands its
 * payment as the purchase's own second stage and answers both prompts in ONE batch, the payment ADDRESSED to the
 * reveal's card: the payment never rises as a band of its own after the workspace folded. The host's members
 * (`consoleTaskHostLogic.ts` — the component delegates to them over its port) and the batch are exercised against a
 * stub of that port (the point is WHICH prompt they read and WHAT they send).
 */

type Fns = Record<string, (self: unknown, ...args: Array<unknown>) => unknown>;
const c = taskHostLogic as unknown as Fns;
const m = taskHostLogic as unknown as Fns;

const ONE_CARD_PAYMENT = {
  type: 'payment', title: 'x', amount: 3,
  paymentOptions: {heat: true},
} as unknown as SelectPaymentModel;

function stub(o: {embedded: boolean, payment?: SelectPaymentModel, picks: number}) {
  const self: Record<string, unknown> = {
    embedded: o.embedded,
    isBuyMode: true,
    picks: new Array(o.picks).fill(CardName.RESEARCH),
    buyTotal: o.picks * 3,
    buyStage: 'pick',
    cardModel: {deckPickPrompt: {mode: 'buy', payment: o.payment, source: {kind: 'card', card: CardName.VENUS_ORBITAL_SURVEY}}},
  };
  Object.defineProperty(self, 'buyPaysByPrompt', {get: () => c.buyPaysByPrompt(self)});
  Object.defineProperty(self, 'buyPaymentPrompt', {get: () => c.buyPaymentPrompt(self)});
  Object.defineProperty(self, 'buyPayStage', {get: () => c.buyPayStage(self)});
  return self;
}

describe('the purchase pays in its own stage (PL-1411)', () => {
  it('a purchase whose price the server asks owes a pay stage — embedded only, never for M€-only', () => {
    expect(stub({embedded: true, payment: ONE_CARD_PAYMENT, picks: 1}).buyPaysByPrompt).is.true;
    expect(stub({embedded: true, payment: undefined, picks: 1}).buyPaysByPrompt, 'M€ only: paid automatically').is.false;
    expect(stub({embedded: false, payment: ONE_CARD_PAYMENT, picks: 1}).buyPaysByPrompt, 'the research buy keeps its flow').is.false;
  });

  it('the payment is priced for the picks (one card\'s preview × N), and absent with nothing picked', () => {
    expect((stub({embedded: true, payment: ONE_CARD_PAYMENT, picks: 2}).buyPaymentPrompt as SelectPaymentModel).amount).eq(6);
    expect(stub({embedded: true, payment: ONE_CARD_PAYMENT, picks: 0}).buyPaymentPrompt).is.undefined;
  });

  it('the pay stage stands only while a payment is owed', () => {
    const s = stub({embedded: true, payment: ONE_CARD_PAYMENT, picks: 1});
    expect(s.buyPayStage).is.false;
    s.buyStage = 'pay';
    expect(s.buyPayStage).is.true;
    s.picks = [];
    expect(s.buyPayStage, 'no picks — nothing to pay').is.false;
  });

  it('ONE batch: the card pick, then the payment ADDRESSED to the reveal\'s card', () => {
    const emitted: Array<[string, unknown]> = [];
    const s = {
      ...stub({embedded: true, payment: ONE_CARD_PAYMENT, picks: 1}),
      submitting: false,
      buyPayLanes: [],
      payCounts: {heat: 3},
      megacreditsOnHand: 10,
      $emit: (name: string, payload?: unknown) => emitted.push([name, payload]),
    };
    m.submitBuyBatch(s);
    expect(emitted.map(([name]) => name)).deep.eq(['result-detached', 'submit-batch']);
    const batch = emitted[1][1] as Array<Record<string, unknown>>;
    expect(batch).has.length(2);
    expect(batch[0]).deep.eq({type: 'card', cards: [CardName.RESEARCH]});
    expect(batch[1].type).eq('payment');
    expect(batch[1].for).deep.eq({source: {kind: 'card', card: CardName.VENUS_ORBITAL_SURVEY}, role: 'payment'});
    // A second press while the batch is in flight sends nothing.
    m.submitBuyBatch(s);
    expect(emitted).has.length(2);
  });
});

describe('the open-card discard tells the pile the truth (PL-1410)', () => {
  afterEach(() => resetDiscardPile());

  it('a refused card the pile receives is COUNTED on it — even when no flight could be measured', async () => {
    resetDiscardPile();
    openDiscardPile('test-holder');
    expect(discardPileState.count).eq(0);
    // JSDOM: no layout, so no proxy can be measured — the degenerate path must still read the server's truth.
    await discardOpenCards([{name: CardName.RESEARCH}, {name: CardName.ASTEROID}]);
    expect(discardPileState.count).eq(2);
  });
});
