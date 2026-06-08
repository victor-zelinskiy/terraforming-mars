import {shallowMount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import CardRequirementComponent from '@/client/components/card/CardRequirementComponent.vue';
import {Tag} from '@/common/cards/Tag';

describe('CardRequirementComponent', () => {
  it('renders temperature requirement', () => {
    const wrapper = shallowMount(CardRequirementComponent, {
      ...globalConfig,
      props: {
        requirement: {temperature: -14, count: -14},
      },
    });
    expect(wrapper.text()).to.include('-14');
    expect(wrapper.find('.card-temperature--req').exists()).to.be.true;
  });

  it('renders tag requirement with explicit count', () => {
    const wrapper = shallowMount(CardRequirementComponent, {
      ...globalConfig,
      props: {
        requirement: {tag: Tag.SCIENCE, count: 2},
      },
    });
    expect(wrapper.find('.card-tag-science').exists()).to.be.true;
    expect(wrapper.text()).to.include('2');
  });

  it('renders tag requirement without count as ≥ 1, not ≥ 0', () => {
    // Cards like Solarpedia use {tag: Tag.VENUS} with no explicit count.
    // The server populateCount() does not fill count for TAG requirements,
    // so count arrives as undefined. The component must default to 1.
    const wrapper = shallowMount(CardRequirementComponent, {
      ...globalConfig,
      props: {
        requirement: {tag: Tag.SCIENCE},
      },
    });
    expect(wrapper.find('.card-tag-science').exists()).to.be.true;
    expect(wrapper.text()).to.include('1');
    expect(wrapper.text()).not.to.include('0');
  });

  it('renders minimum requirement with ≥ operator', () => {
    const wrapper = shallowMount(CardRequirementComponent, {
      ...globalConfig,
      props: {
        requirement: {oxygen: 6, count: 6},
      },
    });
    expect(wrapper.text()).to.include('≥');
    expect(wrapper.text()).to.include('6');
  });

  it('renders maximum requirement with ≤ operator', () => {
    const wrapper = shallowMount(CardRequirementComponent, {
      ...globalConfig,
      props: {
        requirement: {oxygen: 4, count: 4, max: true},
      },
    });
    expect(wrapper.text()).to.include('≤');
    expect(wrapper.text()).to.include('4');
  });
});
