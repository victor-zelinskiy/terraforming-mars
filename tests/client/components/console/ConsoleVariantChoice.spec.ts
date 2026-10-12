import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import ConsoleVariantChoice from '@/client/components/console/foundation/ConsoleVariantChoice.vue';
import {VariantChoiceOption} from '@/client/console/variantChoiceModel';
import {CardRenderItemType} from '@/common/cards/render/CardRenderItemType';
import {ItemType} from '@/common/cards/render/Types';

/*
 * THE VARIANT CHOICE — the ONE grammar of «choose one of these» (TR51). The component renders the three facts as
 * three paints (the cursor, the answer — the ONE seal —, the rules with the reason inside the tile), the «ИЛИ»
 * medallion between mutually exclusive results only, the card's printed row when the host hands it, and the
 * radiogroup's ARIA; a click SELECTS (emits `pick`), never commits.
 */
const SCIENCE: ItemType = {is: 'item', type: CardRenderItemType.RESOURCE, amount: -1, resource: 'Science'} as unknown as ItemType;

function option(key: string, focused: boolean, selected: boolean, off: boolean, extra: Partial<VariantChoiceOption> = {}): VariantChoiceOption {
  return {key, state: {focused, selected, off}, title: key, ...extra};
}

function make(options: ReadonlyArray<VariantChoiceOption>, props: Record<string, unknown> = {}) {
  return mount(ConsoleVariantChoice, {...globalConfig, props: {options, label: 'Choose', ...props}});
}

describe('ConsoleVariantChoice', () => {
  it('a radiogroup of radios — aria-checked is the ANSWER, aria-disabled the rules', () => {
    const w = make([option('a', true, false, false), option('b', false, true, false), option('c', false, false, true, {reason: 'No card'})]);
    expect(w.find('.con-vchoice').attributes('role')).eq('radiogroup');
    const radios = w.findAll('[role="radio"]');
    expect(radios.map((r) => r.attributes('aria-checked'))).deep.eq(['false', 'true', 'false']);
    expect(radios.map((r) => r.attributes('aria-disabled'))).deep.eq(['false', 'false', 'true']);
  });

  it('ONE mark of the answer: the seal is on the selected option only, and it is paint, not text', () => {
    const w = make([option('a', true, false, false), option('b', false, true, false)]);
    expect(w.findAll('.con-vchoice__seal--on')).has.length(1);
    expect(w.findAll('.con-vchoice__opt')[1].find('.con-vchoice__seal--on').exists()).is.true;
    expect(w.text()).not.to.contain('✓');
  });

  it('a decided group RECEDES its other live options — never the cursor\'s, never a refused one', () => {
    const w = make([option('a', false, true, false), option('b', false, false, false), option('c', true, false, false), option('d', false, false, true)]);
    const recede = w.findAll('.con-vchoice__opt').map((o) => o.classes().includes('con-vchoice__opt--recede'));
    expect(recede).deep.eq([false, true, false, false]);
  });

  it('a refused option carries its reason INSIDE the tile; a refused option without one says nothing (one loss, one voice)', () => {
    const w = make([option('a', false, false, true, {reason: 'No card to add the resource to'}), option('b', false, false, true)]);
    const reasons = w.findAll('.con-vchoice__reason');
    expect(reasons).has.length(1);
    expect(reasons[0].text()).to.contain('No card to add the resource to');
  });

  it('«ИЛИ» stands between EXCLUSIVE results only — a pick list has none', () => {
    expect(make([option('a', false, false, false), option('b', false, false, false), option('c', false, false, false)]).findAll('.con-vchoice__or')).has.length(2);
    expect(make([option('a', false, false, false), option('b', false, false, false)], {exclusive: false, layout: 'list'}).findAll('.con-vchoice__or')).has.length(0);
  });

  it('the printed row renders the face nodes it is handed; a door draws its ›; the host\'s attributes ride the tile', () => {
    const w = make([
      option('a', false, false, false, {printed: [SCIENCE], title: ''}),
      option('b', false, false, false, {door: true, attrs: {'data-branch-pos': '1'}}),
    ]);
    const [a, b] = w.findAll('.con-vchoice__opt');
    expect(a.find('[data-vchoice-print]').exists()).is.true;
    expect(a.find('.con-vchoice__head').exists(), 'no words, no head — the print speaks alone').is.false;
    expect(b.find('.con-vchoice__door').exists()).is.true;
    expect(b.attributes('data-branch-pos')).eq('1');
  });

  it('a click SELECTS — it emits the option\'s index, it never commits', async () => {
    const w = make([option('a', false, false, false), option('b', false, false, false)]);
    await w.findAll('.con-vchoice__opt')[1].trigger('click');
    expect(w.emitted('pick')).deep.eq([[1]]);
  });

  it('the layout is a class of the group (compare · column · list)', () => {
    expect(make([option('a', false, false, false)], {layout: 'column'}).classes()).to.include('con-vchoice--column');
    expect(make([option('a', false, false, false)], {layout: 'list'}).classes()).to.include('con-vchoice--list');
    expect(make([option('a', false, false, false)]).classes()).to.include('con-vchoice--compare');
  });
});
