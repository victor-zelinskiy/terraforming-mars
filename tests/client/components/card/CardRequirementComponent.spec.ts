import {shallowMount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import CardRequirementComponent from '@/client/components/card/CardRequirementComponent.vue';
import {Tag} from '@/common/cards/Tag';
import {PreferencesManager} from '@/client/utils/PreferencesManager';

describe('CardRequirementComponent', () => {
  afterEach(() => {
    PreferencesManager.resetForTest();
  });

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

  describe('non-RU locale keeps math glyphs', () => {
    beforeEach(() => {
      PreferencesManager.resetForTest();
      PreferencesManager.INSTANCE.set('lang', 'en');
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

  describe('RU locale replaces math glyphs with uniform «от / до» (display only)', () => {
    beforeEach(() => {
      PreferencesManager.resetForTest();
      PreferencesManager.INSTANCE.set('lang', 'ru');
    });

    it('global-parameter minimum reads «от N» — no glyph, value unchanged, prominent operator', () => {
      const wrapper = shallowMount(CardRequirementComponent, {
        ...globalConfig,
        props: {
          requirement: {venus: 12, count: 12},
        },
      });
      const text = wrapper.text();
      expect(text).to.include('от');
      expect(text).to.include('12');
      expect(text).to.not.include('≥');
      expect(text).to.not.include('≤');
      expect(wrapper.find('.card-venus--req').exists()).to.be.true;
      // Inclusive «от» gets the prominent modifier.
      expect(wrapper.find('.card-req-operator--inclusive').exists()).to.be.true;
    });

    it('global-parameter maximum reads «до N»', () => {
      const wrapper = shallowMount(CardRequirementComponent, {
        ...globalConfig,
        props: {
          requirement: {oxygen: 10, count: 10, max: true},
        },
      });
      const text = wrapper.text();
      expect(text).to.include('до');
      expect(text).to.include('10');
      expect(text).to.not.include('≤');
    });

    it('oceans read as «от N»', () => {
      const wrapper = shallowMount(CardRequirementComponent, {
        ...globalConfig,
        props: {
          requirement: {oceans: 3, count: 3},
        },
      });
      expect(wrapper.text()).to.include('от');
      expect(wrapper.text()).to.include('3');
    });

    it('tag minimum reads «от N» (not «минимум N»)', () => {
      const wrapper = shallowMount(CardRequirementComponent, {
        ...globalConfig,
        props: {
          requirement: {tag: Tag.SCIENCE, count: 3},
        },
      });
      const text = wrapper.text();
      expect(text).to.include('от');
      expect(text).to.include('3');
      expect(text).to.not.include('минимум');
      expect(text).to.not.include('≥');
      expect(wrapper.find('.card-req-operator--inclusive').exists()).to.be.true;
    });

    it('cities maximum reads «до N» (not «максимум N»)', () => {
      const wrapper = shallowMount(CardRequirementComponent, {
        ...globalConfig,
        props: {
          requirement: {cities: 1, count: 1, max: true},
        },
      });
      const text = wrapper.text();
      expect(text).to.include('до');
      expect(text).to.include('1');
      expect(text).to.not.include('максимум');
      expect(text).to.not.include('≤');
    });

    it('production requirement reads «от N» with the production icon', () => {
      const wrapper = shallowMount(CardRequirementComponent, {
        ...globalConfig,
        props: {
          requirement: {production: 'energy', count: 1},
        },
      });
      const text = wrapper.text();
      expect(text).to.include('от');
      expect(text).to.include('1');
      expect(text).to.not.include('минимум');
      expect(wrapper.find('.card-production-box--req').exists()).to.be.true;
    });
  });
});
