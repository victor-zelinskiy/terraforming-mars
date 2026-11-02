import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import ConsoleCountedWhy from '@/client/components/console/ConsoleCountedWhy.vue';
import {countedWhyOf, discountWhyOf} from '@/client/console/countedPlay';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {Tag} from '@/common/cards/Tag';

/**
 * P89 Venus Shuttles (ledger DZ) — A DISCOUNTED PRICE SPEAKS THE STANDARD PROJECTS' GRAMMAR. The chip reads the price
 * «printed → paid» and wears the discount as the `−N` capsule (`.pcard__cost-delta` language); the composer's
 * «Расчёт» strip reads «12 − [V] 3 → 9 [M€]». Every number is the server's (`ActionEffect.printed`, its basis).
 */
describe('ActionEffectChip — a discounted price (P89)', () => {
  const discounted: ActionEffect = {
    direction: 'cost', icon: 'megacredits', amount: 9, printed: 12, current: 15, resulting: 6,
    basis: [{count: 3, label: 'Your tags', tag: Tag.VENUS}],
  };

  it('reads «12 → 9» with the «−3» capsule', () => {
    const w = mount(ActionEffectChip, {...globalConfig, props: {effect: discounted}});
    expect(w.find('[data-chip-printed]').text()).eq('12');
    expect(w.find('[data-chip-paid]').text()).eq('9');
    const capsule = w.find('[data-chip-discount]');
    expect(capsule.attributes('data-chip-discount-n')).eq('3');
    expect(capsule.text()).eq('−3');
    w.unmount();
  });

  it('a price at zero still reads «12 → 0 · −12»', () => {
    const w = mount(ActionEffectChip, {...globalConfig, props: {effect: {...discounted, amount: 0, resulting: 15, basis: [{count: 12, label: 'Your tags', tag: Tag.VENUS}]}}});
    expect(w.find('[data-chip-paid]').text()).eq('0');
    expect(w.find('[data-chip-discount]').text()).eq('−12');
    w.unmount();
  });

  it('no printed price → no capsule, the wallet reading as before', () => {
    const w = mount(ActionEffectChip, {...globalConfig, props: {effect: {direction: 'cost', icon: 'megacredits', amount: 12, current: 15, resulting: 3}}});
    expect(w.find('[data-chip-discount]').exists()).is.false;
    expect(w.find('.action-effect-chip__cur').text()).eq('15');
    w.unmount();
  });

  it('the «Расчёт» strip: printed − the counted tags → paid; a counted gain is never displaced', () => {
    const why = discountWhyOf([discounted]);
    expect(why?.printed).eq(12);
    const w = mount(ConsoleCountedWhy, {props: {why: why!}, global: {mocks: {$t: (key: string) => key}}});
    expect(w.find('[data-count-printed]').attributes('data-count-printed-n')).eq('12');
    expect(w.find('[data-count-why]').attributes('data-count-why-total')).eq('3');
    expect(w.find('[data-count-result]').text()).contains('9');
    expect(w.find('[data-count-result]').text()).not.contains('+');
    w.unmount();
    expect(countedWhyOf([discounted]), 'a price is not a counted gain').is.undefined;
    expect(discountWhyOf([{...discounted, printed: undefined}])).is.undefined;
  });
});

describe('ActionEffectChip — the Venus step names the alternative board’s bonus door (P89 · EE)', () => {
  it('a step that earns the bonus reads «› Бонус Венеры»; a plain step reads nothing more', () => {
    const step: ActionEffect = {direction: 'gain', icon: 'venus', amount: 2, current: 16, resulting: 18, unit: '%'};
    const w = mount(ActionEffectChip, {...globalConfig, props: {effect: {...step, altVenusBonus: {standard: 1, wild: false, from: 16, to: 18}}}});
    expect(w.find('[data-chip-venus-bonus]').exists()).is.true;
    w.unmount();
    const plain = mount(ActionEffectChip, {...globalConfig, props: {effect: step}});
    expect(plain.find('[data-chip-venus-bonus]').exists()).is.false;
    plain.unmount();
  });
});
