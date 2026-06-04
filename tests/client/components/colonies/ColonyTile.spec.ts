import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import ColonyTile from '@/client/components/colonies/ColonyTile.vue';
import {ColonyName} from '@/common/colonies/ColonyName';

function factory(props: Record<string, unknown>) {
  return mount(ColonyTile, {
    ...globalConfig,
    global: {...globalConfig.global, stubs: {BuildBenefit: true}},
    props: {
      colony: {colonies: [], isActive: true, name: ColonyName.GANYMEDE, trackPosition: 1, visitor: undefined},
      ...props,
    },
  });
}

describe('ColonyTile — disabled reason chip', () => {
  it('shows the SELECT button when the colony is selectable', () => {
    const w = factory({selectable: true});
    expect(w.find('[data-test="colony-select-' + ColonyName.GANYMEDE + '"]').exists()).to.eq(true);
    expect(w.find('[data-test="colony-reason-' + ColonyName.GANYMEDE + '"]').exists()).to.eq(false);
  });

  it('replaces the button with a visible reason chip when disabled with a reason', () => {
    const w = factory({selectable: false, disabledReason: 'Colony is full'});
    const chip = w.find('[data-test="colony-reason-' + ColonyName.GANYMEDE + '"]');
    expect(chip.exists()).to.eq(true);
    expect(chip.text()).to.include('Colony is full');
    expect(chip.attributes('data-hint')).to.eq('Colony is full');
    expect(w.find('[data-test="colony-select-' + ColonyName.GANYMEDE + '"]').exists()).to.eq(false);
  });

  it('keeps the (disabled) SELECT button when disabled without a reason', () => {
    const w = factory({selectable: false, disabledReason: ''});
    expect(w.find('[data-test="colony-reason-' + ColonyName.GANYMEDE + '"]').exists()).to.eq(false);
    const btn = w.find('[data-test="colony-select-' + ColonyName.GANYMEDE + '"]');
    expect(btn.exists()).to.eq(true);
    expect((btn.element as HTMLButtonElement).disabled).to.eq(true);
  });

  it('labels the action button for trading in trade mode', () => {
    const trade = factory({selectable: true, mode: 'trade'});
    const view = factory({selectable: true, mode: 'view'});
    const tradeLabel = trade.find('[data-test="colony-select-' + ColonyName.GANYMEDE + '"]').text();
    const viewLabel = view.find('[data-test="colony-select-' + ColonyName.GANYMEDE + '"]').text();
    expect(tradeLabel).to.not.eq(viewLabel);
    expect(tradeLabel.toLowerCase()).to.satisfy((t: string) => t.includes('trade') || t.includes('торгов'));
  });
});
