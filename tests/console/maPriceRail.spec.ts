import {expect} from 'chai';
import {maPriceSpecs, armMaPrice, maPriceOwed, releaseMaPrice} from '../../src/client/console/maPriceRail';
import {
  closeMaPay, maFocusState, openMaFocus, openMaPay, resetMaFocus, setMaPayCount, setMaPayFocus, beginMaFocusCommit, failMaFocusCommit,
} from '../../src/client/console/consoleMaFocus';

/*
 * PL-1621 / PL-1622 — the milestone / award PRICE leaves the rail first, as PAID; the bill a claim will ask (Helion's
 * heat) stands as «› ОПЛАТА» inside the detail stage — a level of the reversible detail.
 */
describe('MA · the price as paid (PL-1621)', () => {
  afterEach(() => releaseMaPrice('test'));

  it('one LOSS per rail row the bill took — M€ alone, or M€ and Helion\'s heat; nothing for a free claim', () => {
    expect(maPriceSpecs({megacredits: 8})).deep.eq([{channel: 'stock', resource: 'megacredits', amount: 8, direction: 'loss'}]);
    expect(maPriceSpecs({megacredits: 3, heat: 5})).deep.eq([
      {channel: 'stock', resource: 'megacredits', amount: 3, direction: 'loss'},
      {channel: 'stock', resource: 'heat', amount: 5, direction: 'loss'},
    ]);
    expect(maPriceSpecs({megacredits: 0, heat: 0})).deep.eq([]);
  });

  it('a free claim arms nothing; a paid one is owed until flown or released', () => {
    armMaPrice('Terraformer', {});
    expect(maPriceOwed()).eq(false);
    armMaPrice('Terraformer', {megacredits: 8});
    expect(maPriceOwed()).eq(true);
    releaseMaPrice('refused');
    expect(maPriceOwed()).eq(false);
  });
});

describe('MA · «› ОПЛАТА» inside the detail (PL-1622)', () => {
  beforeEach(() => {
    resetMaFocus();
    openMaFocus('milestone', 'Terraformer', 0);
  });
  afterEach(() => resetMaFocus());

  it('stands in the reversible detail, dials, and B folds it with nothing sent', () => {
    openMaPay({megacredits: 3, heat: 5});
    expect(maFocusState.pay?.counts).deep.eq({megacredits: 3, heat: 5});
    setMaPayCount('heat', 4);
    expect(maFocusState.pay?.counts.heat).eq(4);
    expect(maFocusState.pay?.flash).eq(1);
    setMaPayFocus(1);
    expect(maFocusState.pay?.focus).eq(1);
    closeMaPay();
    expect(maFocusState.pay).is.undefined;
    expect(maFocusState.phase).eq('detail');
  });

  it('past the press the counts are frozen; a refusal returns to the SAME payment', () => {
    openMaPay({heat: 8});
    beginMaFocusCommit({gameAge: 1, undoCount: 0});
    setMaPayCount('heat', 2);
    expect(maFocusState.pay?.counts.heat, 'no dial past the commit').eq(8);
    closeMaPay();
    expect(maFocusState.pay, 'no fold past the commit').is.not.undefined;
    failMaFocusCommit('Unavailable right now');
    expect(maFocusState.phase).eq('detail');
    expect(maFocusState.pay?.counts.heat, 'the refusal keeps the composed payment').eq(8);
  });

  it('a new item opens with no payment stage', () => {
    openMaPay({heat: 8});
    openMaFocus('award', 'Banker', 0);
    expect(maFocusState.pay).is.undefined;
  });
});
