import {expect} from 'chai';
import {buildStartStatusPreview} from '@/client/console/startStatusPreview';
import {CardName} from '@/common/cards/CardName';

/**
 * STARTUP STATUS PREVIEW — the summary panel's pure model. A QUICK DECISION
 * summary only: the financial core + the two set counts. Values are
 * authoritative (the shared initialDraftMoney brain); tags / production
 * previews are deliberately NOT part of this model — the cards themselves
 * state their effects, and the panel must never grow into a pre-game
 * simulator of the Player Rail.
 */
describe('startStatusPreview (the summary quick-decision panel)', () => {
  it('no corporation → no preview (there is no start identity to preview)', () => {
    expect(buildStartStatusPreview({corp: undefined, preludes: [], ceo: undefined, projects: []})).to.eq(undefined);
  });

  it('financial core: start / projects cost / remaining ride the shared money brain', () => {
    const p = buildStartStatusPreview({
      corp: CardName.CREDICOR,
      preludes: [],
      ceo: undefined,
      projects: [CardName.BIRDS, CardName.ANTS],
    });
    expect(p).to.not.eq(undefined);
    expect(p?.start).to.eq(57); // CrediCor's printed 57 M€
    expect(p?.buys).to.eq(2);
    expect(p?.cardCost).to.eq(3);
    expect(p?.projectsCost).to.eq(6);
    expect(p?.remaining).to.eq(51);
    expect(p?.handSize).to.eq(2);
  });

  it('prelude M€ effects fold into the remaining (printed startingMegaCredits)', () => {
    const none = buildStartStatusPreview({corp: CardName.CREDICOR, preludes: [], ceo: undefined, projects: []});
    const withLoan = buildStartStatusPreview({corp: CardName.CREDICOR, preludes: [CardName.LOAN], ceo: undefined, projects: []});
    expect(none?.preludeDelta).to.eq(0);
    expect(withLoan?.preludeDelta).to.be.greaterThan(0);
    expect((withLoan?.remaining ?? 0) - (none?.remaining ?? 0)).to.eq(withLoan?.preludeDelta);
    expect(withLoan?.preludeCount).to.eq(1);
  });

  it('the model is MINIMAL by contract — no tags, no production forecast', () => {
    const p = buildStartStatusPreview({corp: CardName.MINING_GUILD, preludes: [], ceo: undefined, projects: []});
    expect(p).to.not.eq(undefined);
    expect(Object.keys(p as object).sort()).to.deep.eq([
      'buys', 'cardCost', 'corp', 'handSize', 'preludeCount', 'preludeDelta', 'projectsCost', 'remaining', 'start',
    ]);
  });
});
