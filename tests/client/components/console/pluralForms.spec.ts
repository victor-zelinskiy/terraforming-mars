import {expect} from 'chai';
import {pluralForm, resolvePluralGroups} from '@/client/i18n/pluralForms';

/**
 * THE LOCALIZATION PIPELINE'S PLURAL FORMS — the mechanism that retired
 * «Оставьте себе 2 карт(ы)»: a translation inlines its forms as
 * `{карту|карты|карт}` and the group resolves against the nearest number to
 * its left under the ACTIVE language's own rules.
 */
describe('pluralForms', () => {
  it('Russian three-form rule: 1/21 · 2–4/22–24 · the rest (11–14 are many)', () => {
    expect(pluralForm(1, 'ru')).to.eq('one');
    expect(pluralForm(21, 'ru')).to.eq('one');
    expect(pluralForm(2, 'ru')).to.eq('few');
    expect(pluralForm(4, 'ru')).to.eq('few');
    expect(pluralForm(22, 'ru')).to.eq('few');
    expect(pluralForm(5, 'ru')).to.eq('many');
    expect(pluralForm(0, 'ru')).to.eq('many');
    expect(pluralForm(11, 'ru')).to.eq('many');
    expect(pluralForm(12, 'ru')).to.eq('many');
    expect(pluralForm(14, 'ru')).to.eq('many');
    expect(pluralForm(111, 'ru')).to.eq('many');
  });

  it('English-like rule: exactly one vs everything else', () => {
    expect(pluralForm(1, 'en')).to.eq('one');
    expect(pluralForm(0, 'en')).to.eq('many');
    expect(pluralForm(2, 'en')).to.eq('many');
  });

  it('«Оставьте себе N карт(ы)» is no longer expressible', () => {
    const t = 'Оставьте себе ${n} {карту|карты|карт}';
    const at = (n: number) => resolvePluralGroups(t.replace('${n}', String(n)), 'ru');
    expect(at(1)).to.eq('Оставьте себе 1 карту');
    expect(at(2)).to.eq('Оставьте себе 2 карты');
    expect(at(5)).to.eq('Оставьте себе 5 карт');
    expect(at(21)).to.eq('Оставьте себе 21 карту');
    expect(at(12)).to.eq('Оставьте себе 12 карт');
  });

  it('a two-form group serves an English dictionary', () => {
    expect(resolvePluralGroups('Keep 1 {card|cards}', 'en')).to.eq('Keep 1 card');
    expect(resolvePluralGroups('Keep 3 {card|cards}', 'en')).to.eq('Keep 3 cards');
  });

  it('each group binds to ITS OWN nearest number', () => {
    const s = resolvePluralGroups('2 {карты|карт|карт} и 5 {жетон|жетона|жетонов}', 'ru');
    expect(s).to.eq('2 карт и 5 жетонов');
  });

  it('no number to the left → the ONE form, never the raw group', () => {
    expect(resolvePluralGroups('Возьмите {карту|карты|карт}', 'ru')).to.eq('Возьмите карту');
  });

  it('strings without groups pass through untouched (the whole corpus)', () => {
    expect(resolvePluralGroups('ОПЛАЧЕНО 1 / 1', 'ru')).to.eq('ОПЛАЧЕНО 1 / 1');
    expect(resolvePluralGroups('A | B plain pipe', 'ru')).to.eq('A | B plain pipe');
    expect(resolvePluralGroups('{наведите|}', 'ru')).to.eq('наведите');
  });

  it('a group holding an unsubstituted ${0} is never eaten', () => {
    expect(resolvePluralGroups('Keep 2 {${0} left|none}', 'en')).to.eq('Keep 2 {${0} left|none}');
  });
});
