import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import ColonyTradePaymentModal from '@/client/components/colonies/ColonyTradePaymentModal.vue';
import {ColonyName} from '@/common/colonies/ColonyName';

function factory(props: Record<string, unknown>, onSelect = (_idx: number) => {}, onCancel = () => {}) {
  return mount(ColonyTradePaymentModal, {
    ...globalConfig,
    global: {...globalConfig.global, stubs: {BenefitGlyph: true}},
    props: {
      colony: undefined,
      colonyName: ColonyName.IO,
      options: [],
      disabledOptions: [],
      ...props,
      onSelect,
      onCancel,
    },
  });
}

describe('ColonyTradePaymentModal — premium trade payment', () => {
  const affordable = {
    type: 'option', title: 'Pay 3 titanium', buttonLabel: '',
    metadata: {kind: 'resourceRemoval', icon: 'titanium', amount: 3, resource: {current: 5, resulting: 2}},
  };
  const unaffordable = {
    title: 'Pay 3 energy',
    metadata: {kind: 'resourceRemoval', icon: 'energy', amount: 3, resource: {current: 2, resulting: 0}},
    reason: 'Not enough energy',
  };

  it('select → confirm; nothing commits before confirm', async () => {
    let selected: number | undefined;
    const w = factory({options: [affordable]}, (idx) => {
      selected = idx;
    });
    // Confirm starts disabled (no selection yet).
    const confirm = w.find('[data-test="colony-trade-pay-confirm"]');
    expect((confirm.element as HTMLButtonElement).disabled).to.eq(true);
    // Click the option → selects, still not submitted.
    await w.find('[data-test="colony-trade-pay-opt-0"]').trigger('click');
    expect(selected).to.eq(undefined);
    expect((confirm.element as HTMLButtonElement).disabled).to.eq(false);
    // Confirm → emits the selected index.
    await confirm.trigger('click');
    expect(selected).to.eq(0);
  });

  it('renders unaffordable payment paths as disabled cards with a reason', () => {
    const w = factory({options: [affordable], disabledOptions: [unaffordable]});
    const disabled = w.find('[data-test="colony-trade-pay-disabled-0"]');
    expect(disabled.exists()).to.eq(true);
    expect(disabled.text()).to.include('Not enough energy');
    // It is not one of the selectable options.
    expect(w.find('[data-test="colony-trade-pay-opt-1"]').exists()).to.eq(false);
  });

  it('cancel emits without selecting', async () => {
    let cancelled = false;
    const w = factory({options: [affordable]}, () => {}, () => {
      cancelled = true;
    });
    await w.find('[data-test="colony-trade-pay-cancel"]').trigger('click');
    expect(cancelled).to.eq(true);
  });
});
