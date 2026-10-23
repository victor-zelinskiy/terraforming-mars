import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {getCard} from '@/client/cards/ClientCardManifest';
import {purchasePriceHint, purchasePriceSource, startPurchasePriceSource} from '@/client/console/purchasePriceSource';

/**
 * WHO SET THE BUY PRICE (R14 Terralabs Research). The surfaces print the
 * server's number; this names the cards behind a number that is not 3 M€ —
 * the server's list in play, the corporations' printed price before one is
 * played. Nothing here computes a price.
 */
describe('purchasePriceSource', () => {
  it('the corporation\'s printed price reaches the client: Terralabs 1, Polyphemos 5, a plain corporation none', () => {
    expect(getCard(CardName.TERRALABS_RESEARCH)?.cardCost).eq(1);
    expect(getCard(CardName.POLYPHEMOS)?.cardCost).eq(5);
    expect(getCard(CardName.CREDICOR)?.cardCost).is.undefined;
  });

  it('in play: the server\'s price and sources; a plain table names nothing', () => {
    expect(purchasePriceSource({cardCost: 1, cardCostSources: [CardName.TERRALABS_RESEARCH]}))
      .deep.eq({price: 1, sources: [CardName.TERRALABS_RESEARCH]});
    expect(purchasePriceSource({cardCost: 3, cardCostSources: []})).is.undefined;
    expect(purchasePriceSource({cardCost: 3})).is.undefined;
  });

  it('before the play: the pick and the lineage whose printed price replaces the base, each once', () => {
    expect(startPurchasePriceSource(1, [CardName.TERRALABS_RESEARCH])).deep.eq({price: 1, sources: [CardName.TERRALABS_RESEARCH]});
    expect(startPurchasePriceSource(3, [CardName.CREDICOR, undefined])).is.undefined;
    expect(startPurchasePriceSource(3, [CardName.POLYPHEMOS, CardName.TERRALABS_RESEARCH, CardName.TERRALABS_RESEARCH]))
      .deep.eq({price: 3, sources: [CardName.POLYPHEMOS, CardName.TERRALABS_RESEARCH]});
  });

  it('the hint names the price and every source; no source, no hint', () => {
    const hint = purchasePriceHint({price: 0, sources: [CardName.TERRALABS_RESEARCH, CardName.QUANTUM_RESEARCH]});
    expect(hint).contains('0');
    expect(hint).contains(CardName.TERRALABS_RESEARCH);
    expect(hint).contains(CardName.QUANTUM_RESEARCH);
    expect(hint).not.contains('${');
    expect(purchasePriceHint(undefined)).eq('');
  });
});
