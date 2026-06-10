import {mount} from '@vue/test-utils';
import {globalConfig} from './getLocalVue';
import {expect} from 'chai';
import PaymentRowV2 from '@/client/components/payment/PaymentRowV2.vue';

function mountRow(props: Record<string, unknown>) {
  return mount(PaymentRowV2, {
    ...globalConfig,
    props: {description: 'Titanium', reserved: false, ...props},
  });
}

describe('PaymentRowV2 — premium row', () => {
  it('shows current → after stock, the contribution and the conversion chip for an alt resource', () => {
    const w = mountRow({unit: 'titanium', modelValue: 4, available: 4, max: 4, rate: 3});
    expect(w.find('.payment-v2-row__count-value').text()).eq('4');
    expect(w.find('.payment-v2-row__stock-cur').text()).eq('4');
    expect(w.find('.payment-v2-row__stock-after').text()).eq('0'); // 4 → 0
    expect(w.find('.payment-v2-row__contrib-value').text()).eq('12'); // 4 × 3
    expect(w.find('.payment-v2-row__rate').text()).eq('×3');
    expect(w.find('.payment-v2-row--active').exists()).is.true;
  });

  it('mixed spend: titanium 2 of 4 leaves 2, contributes 6', () => {
    const w = mountRow({unit: 'titanium', modelValue: 2, available: 4, max: 4, rate: 3});
    expect(w.find('.payment-v2-row__stock-after').text()).eq('2');
    expect(w.find('.payment-v2-row__contrib-value').text()).eq('6');
  });

  it('unused M€ reads 135 → 135, contributes 0, no conversion chip, quiet', () => {
    const w = mountRow({unit: 'megacredits', modelValue: 0, available: 135, max: 135, rate: 1});
    expect(w.find('.payment-v2-row__stock-cur').text()).eq('135');
    expect(w.find('.payment-v2-row__stock-after').text()).eq('135');
    expect(w.find('.payment-v2-row__contrib-value').text()).eq('0');
    expect(w.find('.payment-v2-row__rate').exists()).is.false;
    expect(w.find('.payment-v2-row__contrib--zero').exists()).is.true;
    expect(w.find('.payment-v2-row--active').exists()).is.false;
  });

  it('keeps the −/+/МАКС. stepper hooks and emits on click', async () => {
    const w = mountRow({unit: 'megacredits', modelValue: 1, available: 10, max: 10, rate: 1});
    await w.find('.payment-v2-step--plus').trigger('click');
    await w.find('.payment-v2-step--minus').trigger('click');
    await w.find('.payment-v2-step--max').trigger('click');
    expect(w.emitted('plus')).has.length(1);
    expect(w.emitted('minus')).has.length(1);
    expect(w.emitted('max')).has.length(1);
  });
});
