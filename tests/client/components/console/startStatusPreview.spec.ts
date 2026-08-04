import {expect} from 'chai';
import {buildStartStatusPreview} from '@/client/console/startStatusPreview';
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';

/**
 * EXPANDED STARTUP STATUS PREVIEW — the summary panel's pure model. Values
 * must be AUTHORITATIVE only: the shared initialDraftMoney brain for money,
 * the cards' printed productionBox / tags for the materialization forecast.
 */
describe('startStatusPreview (Expanded Startup Status Preview)', () => {
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
    // Loan's printed +30 M€ — whatever the exact pairing math, the delta must
    // be POSITIVE and the remaining must move by exactly that delta.
    expect(withLoan?.preludeDelta).to.be.greaterThan(0);
    expect((withLoan?.remaining ?? 0) - (none?.remaining ?? 0)).to.eq(withLoan?.preludeDelta);
    expect(withLoan?.preludeCount).to.eq(1);
  });

  it('the materialization forecast: printed production + tags of the DEPLOYING cards only', () => {
    // Mining Guild prints +1 steel production and building×2 tags.
    const p = buildStartStatusPreview({
      corp: CardName.MINING_GUILD,
      preludes: [],
      ceo: undefined,
      projects: [CardName.BIRDS], // a bought project goes to HAND — no tags here
    });
    const steel = p?.production.find((r) => r.resource === 'steel');
    expect(steel?.amount).to.eq(1);
    const building = p?.tags.find((t) => t.tag === Tag.BUILDING);
    expect(building?.count).to.eq(2);
    // Birds' animal tag must NOT leak in (it is not deploying at start).
    expect(p?.tags.some((t) => t.tag === Tag.ANIMAL)).to.eq(false);
  });
});
