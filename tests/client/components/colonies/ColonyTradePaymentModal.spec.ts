import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import ColonyTradePaymentModal from '@/client/components/colonies/ColonyTradePaymentModal.vue';
import {ColonyName} from '@/common/colonies/ColonyName';

type SelectPayload = {paymentIndex: number, steps: ReadonlyArray<unknown>, captures: Record<number, unknown>};

function factory(props: Record<string, unknown>, onSelect = (_payload: SelectPayload) => {}, onCancel = () => {}) {
  return mount(ColonyTradePaymentModal, {
    ...globalConfig,
    // action-target-card is a GLOBAL async component (main.ts) — stubbed here
    // exactly like the other main.ts-registered hosts in component specs.
    global: {...globalConfig.global, stubs: {'BenefitGlyph': true, 'action-target-card': true}},
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
    let selected: SelectPayload | undefined;
    const w = factory({options: [affordable]}, (payload) => {
      selected = payload;
    });
    // Confirm starts disabled (no selection yet).
    const confirm = w.find('[data-test="colony-trade-pay-confirm"]');
    expect((confirm.element as HTMLButtonElement).disabled).to.eq(true);
    // Click the option → selects, still not submitted.
    await w.find('[data-test="colony-trade-pay-opt-0"]').trigger('click');
    expect(selected).to.eq(undefined);
    expect((confirm.element as HTMLButtonElement).disabled).to.eq(false);
    // Confirm → emits the chosen payment path (+ the pre-collected steps).
    await confirm.trigger('click');
    expect(selected?.paymentIndex).to.eq(0);
    expect(selected?.steps).to.deep.eq([]);
  });

  it('renders unaffordable payment paths as disabled cards with a reason', () => {
    const w = factory({options: [affordable], disabledOptions: [unaffordable]});
    const disabled = w.find('[data-test="colony-trade-pay-disabled-0"]');
    expect(disabled.exists()).to.eq(true);
    expect(disabled.text()).to.include('Not enough energy');
    // It is not one of the selectable options.
    expect(w.find('[data-test="colony-trade-pay-opt-1"]').exists()).to.eq(false);
  });

  it('shows the track-offset block (track +N) when the player has a trade offset', () => {
    // IO's trade track has a different reward per position, so a +1 offset both
    // advances the track AND changes the reward → the without-advance line shows.
    const w = factory({
      colony: {trackPosition: 0, colonies: []},
      colonyName: ColonyName.IO,
      options: [affordable],
      tradeOffset: 1,
    });
    const block = w.find('[data-test="colony-trade-track-offset"]');
    expect(block.exists()).to.eq(true);
    expect(block.text()).to.include('+1');
  });

  it('no track-offset block when the player has no trade offset', () => {
    const w = factory({
      colony: {trackPosition: 0, colonies: []},
      colonyName: ColonyName.IO,
      options: [affordable],
      tradeOffset: 0,
    });
    expect(w.find('[data-test="colony-trade-track-offset"]').exists()).to.eq(false);
  });

  it('caps the track advance at the track maximum (no over-advance shown)', () => {
    // Already at the max track position → the offset can't advance it further.
    const w = factory({
      colony: {trackPosition: 6, colonies: []},
      colonyName: ColonyName.IO,
      options: [affordable],
      tradeOffset: 2,
    });
    expect(w.find('[data-test="colony-trade-track-offset"]').exists()).to.eq(false);
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
