import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import PremiumCardWarnings from '@/client/components/card/PremiumCardWarnings.vue';
import {CardName} from '@/common/cards/CardName';

describe('PremiumCardWarnings', () => {
  it('renders nothing when there are no notices', () => {
    const wrapper = mount(PremiumCardWarnings, {...globalConfig, props: {warnings: []}});
    expect(wrapper.find('.card-notices').exists()).to.be.false;
  });

  it('classifies a maxed-parameter warning as the calm no-effect level', () => {
    const wrapper = mount(PremiumCardWarnings, {...globalConfig, props: {warnings: ['maxtemp']}});
    const items = wrapper.findAll('.card-notices__item');
    expect(items).to.have.lengthOf(1);
    expect(items[0].classes()).to.include('card-notices__item--noEffect');
  });

  it('classifies self-harm as the warning level', () => {
    const wrapper = mount(PremiumCardWarnings, {...globalConfig, props: {warnings: ['removeOwnPlants']}});
    const items = wrapper.findAll('.card-notices__item');
    expect(items).to.have.lengthOf(1);
    expect(items[0].classes()).to.include('card-notices__item--warning');
  });

  it('renders an additional-project-cost notice (Reds tax) as a warning', () => {
    const wrapper = mount(PremiumCardWarnings, {
      ...globalConfig,
      props: {warnings: [], additionalCosts: {redsCost: 3}, cardName: CardName.COMET},
    });
    const items = wrapper.findAll('.card-notices__item');
    expect(items.length).to.be.greaterThan(0);
    expect(items[0].classes()).to.include('card-notices__item--warning');
  });

  it('renders multiple notices together (a warning flag + Reds tax)', () => {
    const wrapper = mount(PremiumCardWarnings, {
      ...globalConfig,
      props: {warnings: ['maxtemp'], additionalCosts: {redsCost: 2}, cardName: CardName.COMET},
    });
    expect(wrapper.findAll('.card-notices__item')).to.have.lengthOf(2);
  });
});
