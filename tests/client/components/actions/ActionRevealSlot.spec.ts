import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ActionRevealSlot from '@/client/components/actions/ActionRevealSlot.vue';

const REVEAL = {
  deck: 'project',
  check: {tag: 'microbe', label: 'Microbe tag'},
  reward: {direction: 'gain', icon: 'science', amount: 1},
  vp: {from: 0, to: 3},
};

function factory(props: any) {
  return mount(ActionRevealSlot, {
    ...globalConfig,
    global: {...globalConfig.global, stubs: {Card: true, CardTag: true}},
    props,
  });
}

describe('ActionRevealSlot', () => {
  it('empty: a "card opens here" placeholder + the looking-for check', () => {
    const c = factory({state: 'empty', reveal: REVEAL});
    expect(c.find('.action-reveal__placeholder').exists()).is.true;
    expect(c.find('.action-reveal__check').exists()).is.true;
  });

  it('result (miss): NO over-card marker; a ✕ badge LEADS the "condition not met" line', () => {
    const c = factory({state: 'result', result: {revealed: {name: 'Solar Power'}, conditionMet: false}});
    // The buggy semi-transparent over-card marker is GONE.
    expect(c.find('.action-reveal__marker').exists()).is.false;
    // The success/fail shows as a solid badge on the outcome line + the miss slot frame.
    const badge = c.find('.action-reveal__outcome-badge');
    expect(badge.exists()).is.true;
    expect(badge.classes()).to.include('action-reveal__outcome-badge--miss');
    expect(badge.text()).to.eq('✕');
    expect(c.find('.action-reveal__slot--miss').exists()).is.true;
  });

  it('result (met): a ✓ badge + the reward chip + the met slot frame', () => {
    const c = factory({state: 'result', result: {revealed: {name: 'Ants'}, conditionMet: true, reward: {direction: 'gain', icon: 'science', amount: 1}}});
    expect(c.find('.action-reveal__marker').exists()).is.false;
    const badge = c.find('.action-reveal__outcome-badge');
    expect(badge.classes()).to.include('action-reveal__outcome-badge--met');
    expect(badge.text()).to.eq('✓');
    expect(c.find('.action-reveal__slot--met').exists()).is.true;
  });
});
