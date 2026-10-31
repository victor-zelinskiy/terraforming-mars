import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import ConsoleCountedWhy from '@/client/components/console/ConsoleCountedWhy.vue';
import {countGlyphOf, countedWhyOf} from '@/client/console/countedPlay';
import {CardRenderItemType} from '@/common/cards/render/CardRenderItemType';
import {CardResource} from '@/common/CardResource';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {Tag} from '@/common/cards/Tag';

/**
 * P69 Cloud Tourism — the «ПОЧЕМУ» of a count of PAIRS: ONE term, each SIDE its printed tag and its OWN number, what
 * it includes named on it (the wild tags the card dealt there, the card's own tag), then the number of sets. Never a
 * sum of the sides («2 + 2 → +2» is false arithmetic), never one number for a row of tags.
 */
describe('ConsoleCountedWhy — a SET count (P69)', () => {
  const pairs: ActionEffect = {
    direction: 'gain', icon: 'megacredits', amount: 2, current: 1, resulting: 3, note: 'production',
    basis: [{count: 2, label: 'Your tag sets', set: [{tag: Tag.EARTH, count: 2}, {tag: Tag.VENUS, count: 2, wild: 1, self: 1}]}],
  };
  const none: ActionEffect = {
    direction: 'gain', icon: 'megacredits', amount: 0, current: 1, resulting: 1, note: 'production',
    basis: [{count: 0, label: 'Your tag sets', set: [{tag: Tag.EARTH, count: 0}, {tag: Tag.VENUS, count: 1, self: 1}], zero: 'No Earth tags'}],
  };

  it('every side with its own number, the wild tag and this card NAMED on the Venus side, then «→ 2 pairs», the total = the sets', () => {
    const wrapper = mount(ConsoleCountedWhy, {props: {why: countedWhyOf([pairs])!}, global: {mocks: {$t: (key: string) => key}}});
    const sides = wrapper.findAll('[data-count-set-side]');
    expect(sides.map((s) => [s.attributes('data-count-set-side'), s.attributes('data-count-set-side-n')])).deep.eq([[Tag.EARTH, '2'], [Tag.VENUS, '2']]);
    expect(sides[0].find('[data-count-wild]').exists(), 'nothing dealt to Earth').is.false;
    expect(sides[1].find('[data-count-wild]').attributes('data-count-wild')).eq('1');
    expect(sides[1].find('[data-count-self]').attributes('data-count-self')).eq('1');
    expect(wrapper.find('[data-count-sets]').attributes('data-count-sets-n')).eq('2');
    expect(wrapper.find('[data-count-why]').attributes('data-count-why-total')).eq('2');
    expect(wrapper.findAll('[data-count-term]'), 'not a sum of terms').has.length(0);
    expect(wrapper.find('[data-count-result]').text()).contains('+2');
  });

  it('no pair: the sides stand, the empty side is named in the server\'s words, no «→ N pairs»', () => {
    const wrapper = mount(ConsoleCountedWhy, {props: {why: countedWhyOf([none])!}, global: {mocks: {$t: (key: string) => key}}});
    expect(wrapper.findAll('[data-count-set-side]')).has.length(2);
    expect(wrapper.find('[data-count-sets]').exists()).is.false;
    expect(wrapper.find('[data-count-zero]').text()).eq('No Earth tags');
    expect(wrapper.find('.con-cwhy').classes()).contains('con-cwhy--zero');
  });
});

/**
 * P81 Soil Studies — «1 plant per Venus tag, plant tag (INCLUDING THIS ONE) and colony»: the tag term of a SUMMED basis
 * names the played card's own share with the SAME word a set side speaks («в т.ч. эта карта 1»), beside the wild share,
 * so «[V][plant] 4» adds up against the three tags on the table; the colony term follows after «+».
 */
describe('ConsoleCountedWhy — «this card» on a flat tag term (P81)', () => {
  const soil: ActionEffect = {
    direction: 'gain', icon: 'plants', amount: 5, current: 0, resulting: 5,
    basis: [{count: 4, label: 'Your tags', tags: [Tag.VENUS, Tag.PLANT], self: 1}, {count: 1, label: 'Your colonies'}],
  };
  const wild: ActionEffect = {
    direction: 'gain', icon: 'plants', amount: 2, current: 0, resulting: 2,
    basis: [{count: 2, label: 'Your tags', tags: [Tag.VENUS, Tag.PLANT], wild: 1, self: 1}],
  };

  it('two terms joined by «+»: the tag row with «incl. this card 1», then the colonies; the result once', () => {
    const wrapper = mount(ConsoleCountedWhy, {props: {why: countedWhyOf([soil])!}, global: {mocks: {$t: (key: string) => key}}});
    const terms = wrapper.findAll('[data-count-term]');
    expect(terms.map((t) => t.attributes('data-count-term-n'))).deep.eq(['4', '1']);
    expect(terms[0].find('[data-count-self]').attributes('data-count-self')).eq('1');
    expect(terms[0].find('[data-count-self]').text()).contains('this card');
    expect(terms[0].find('[data-count-wild]').exists(), 'no wild tag on this table').is.false;
    expect(terms[1].find('[data-count-self]').exists(), 'a colony has no «this card»').is.false;
    expect(wrapper.find('[data-count-result]').text()).contains('+5');
  });

  it('a single term with both shares: «incl. [wild] 1 · this card 1»', () => {
    const wrapper = mount(ConsoleCountedWhy, {props: {why: countedWhyOf([wild])!}, global: {mocks: {$t: (key: string) => key}}});
    expect(wrapper.find('[data-count-wild]').attributes('data-count-wild')).eq('1');
    expect(wrapper.find('[data-count-self]').attributes('data-count-self')).eq('1');
    expect(wrapper.find('.con-cwhy__wild').text().indexOf('incl.'), 'one «incl.» for both').eq(wrapper.find('.con-cwhy__wild').text().lastIndexOf('incl.'));
  });
});

/**
 * P75 GHG Shipment — «1 heat for each floater you have»: the face prints «[heat] / [floater]», so the «ПОЧЕМУ» begins
 * with the SAME floater item (`resource(FLOATER)`), never the words «Your floaters». Floater Leasing (per 3) reads the
 * same term and wears the same glyph.
 */
describe('ConsoleCountedWhy — the floater term wears the printed floater (P75)', () => {
  const heat: ActionEffect = {
    direction: 'gain', icon: 'heat', amount: 5, current: 2, resulting: 7,
    basis: [{count: 5, label: 'Your floaters'}],
  };

  it('the term\'s glyph is the face\'s `resource(FLOATER)` item', () => {
    expect(countGlyphOf({count: 5, label: 'Your floaters'})).deep.eq({is: 'item', type: CardRenderItemType.RESOURCE, amount: 1, resource: CardResource.FLOATER});
    expect(countGlyphOf({count: 2, label: 'Resources on this card'}), 'no single printed item — words').is.undefined;
  });

  it('the strip is NAMED «Расчёт» — a word, never the result a second time (the owner, 2026-10-30)', () => {
    const wrapper = mount(ConsoleCountedWhy, {props: {why: countedWhyOf([heat])!}, global: {mocks: {$t: (key: string) => key}}});
    expect(wrapper.find('.con-cwhy__kicker').text()).eq('Calculation');
    expect(wrapper.text().match(/\+5/g), 'the result stands once, at the end').has.length(1);
  });

  it('the strip draws the floater, then «5 → +5»', () => {
    const why = countedWhyOf([heat])!;
    expect(why.glyphs).has.length(1);
    const wrapper = mount(ConsoleCountedWhy, {props: {why}, global: {mocks: {$t: (key: string) => key}}});
    const g = wrapper.find('[data-count-glyph]');
    expect(g.exists(), wrapper.html()).is.true;
    expect(g.html()).contains('floater');
    expect(wrapper.find('[data-count-why]').attributes('data-count-why-total')).eq('5');
    expect(wrapper.find('[data-count-result]').text()).contains('+5');
  });
});
