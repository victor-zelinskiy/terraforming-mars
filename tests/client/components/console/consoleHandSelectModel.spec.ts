import {expect} from 'chai';
import {deriveHandSelect, handSelectPicksValid} from '@/client/components/console/consoleHandSelectModel';
import {SelectCardModel} from '@/common/models/PlayerInputModel';

/* Minimal synthetic SelectCard — only the fields the derivation reads. */
function model(opts: {
  cards: Array<string>,
  min: number,
  max: number,
  disabled?: Array<{name: string, reason?: string | {message: string}}>,
}): SelectCardModel {
  return {
    type: 'card',
    cards: opts.cards.map((name) => ({name})),
    min: opts.min,
    max: opts.max,
    disabledCards: (opts.disabled ?? []).map((d) => ({name: d.name, disabledReason: d.reason})),
  } as unknown as SelectCardModel;
}

/** A translate that PREFIXES so the origin of each reason is visible in asserts. */
const tr = (r: string | {message: string} | undefined): string =>
  r === undefined ? 'GENERIC' : (typeof r === 'string' ? `KEY:${r}` : `MSG:${r.message}`);

describe('consoleHandSelectModel.deriveHandSelect', () => {
  it('single-card pick (min===max===1) → single, not filtered when all in hand', () => {
    const d = deriveHandSelect(model({cards: ['Birds', 'Zeppelins'], min: 1, max: 1}), ['Birds', 'Zeppelins'], tr as any);
    expect(d.single).to.eq(true);
    expect(d.filtered).to.eq(false);
    expect(d.selectable).to.deep.eq(['Birds', 'Zeppelins']);
    expect(d.reasons).to.deep.eq({});
  });

  it('multi-card pick (max>1) → not single', () => {
    const d = deriveHandSelect(model({cards: ['Birds', 'Zeppelins'], min: 0, max: 2}), ['Birds', 'Zeppelins'], tr as any);
    expect(d.single).to.eq(false);
  });

  it('CONDITIONAL subset (candidates < hand) → filtered, with a generic reason per non-candidate', () => {
    // Only Birds is a candidate; the hand also holds Zeppelins + Comet.
    const d = deriveHandSelect(model({cards: ['Birds'], min: 1, max: 1}), ['Birds', 'Zeppelins', 'Comet'], tr as any);
    expect(d.filtered).to.eq(true);
    expect(d.selectable).to.deep.eq(['Birds']);
    // Non-candidates get the generic "can't be chosen" line; the candidate none.
    expect(d.reasons).to.deep.eq({Zeppelins: 'GENERIC', Comet: 'GENERIC'});
  });

  it('server-supplied disabledReason (string key AND Message) wins over the generic', () => {
    const d = deriveHandSelect(
      model({
        cards: ['Birds'],
        min: 1,
        max: 1,
        disabled: [
          {name: 'Zeppelins', reason: 'No microbe tag'},
          {name: 'Comet', reason: {message: 'Card resources are protected'}},
        ],
      }),
      ['Birds', 'Zeppelins', 'Comet', 'Fish'],
      tr as any,
    );
    expect(d.reasons.Zeppelins).to.eq('KEY:No microbe tag');
    expect(d.reasons.Comet).to.eq('MSG:Card resources are protected');
    // A non-candidate WITHOUT a server reason still gets the generic fallback.
    expect(d.reasons.Fish).to.eq('GENERIC');
    // The candidate is never given a reason.
    expect(d.reasons.Birds).to.eq(undefined);
  });

  it('a disabledCard with NO reason falls back to the generic line', () => {
    const d = deriveHandSelect(
      model({cards: ['Birds'], min: 1, max: 1, disabled: [{name: 'Zeppelins'}]}),
      ['Birds', 'Zeppelins'],
      tr as any,
    );
    expect(d.reasons.Zeppelins).to.eq('GENERIC');
  });
});

describe('consoleHandSelectModel.handSelectPicksValid', () => {
  it('within [min,max] → valid', () => {
    expect(handSelectPicksValid({min: 1, max: 2}, 1)).to.eq(true);
    expect(handSelectPicksValid({min: 1, max: 2}, 2)).to.eq(true);
  });
  it('below min / above max → invalid', () => {
    expect(handSelectPicksValid({min: 1, max: 2}, 0)).to.eq(false);
    expect(handSelectPicksValid({min: 1, max: 2}, 3)).to.eq(false);
  });
  it('optional (min===0): zero picks are valid (reveal nothing)', () => {
    expect(handSelectPicksValid({min: 0, max: 3}, 0)).to.eq(true);
  });
});
