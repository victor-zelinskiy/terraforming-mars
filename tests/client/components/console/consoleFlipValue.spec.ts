import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import ConsoleFlipValue from '@/client/components/console/ConsoleFlipValue.vue';

describe('ConsoleFlipValue', () => {
  it('mounts silently — the value renders, no flip is playing', () => {
    const wrapper = mount(ConsoleFlipValue, {props: {value: 3}});
    expect(wrapper.text()).to.contain('3');
    expect(wrapper.classes()).to.not.contain('con-flipval--flip');
    expect(wrapper.find('.con-flipval__card--out').exists()).to.eq(false);
    wrapper.unmount();
  });

  it('an INCREASE plays the one-shot flip: old card folds out, new card in, flash', async () => {
    const wrapper = mount(ConsoleFlipValue, {props: {value: 3}});
    await wrapper.setProps({value: 4});
    expect(wrapper.classes()).to.contain('con-flipval--flip');
    const out = wrapper.find('.con-flipval__card--out');
    expect(out.exists()).to.eq(true);
    expect(out.text()).to.eq('3');
    expect(wrapper.find('.con-flipval__card--in').text()).to.eq('4');
    expect(wrapper.find('.con-flipval__flash').exists()).to.eq(true);
    wrapper.unmount();
  });

  it('flips the FORMATTED readout — both faces carry their own units', async () => {
    const wrapper = mount(ConsoleFlipValue, {props: {value: -8, text: '-8°C'}});
    expect(wrapper.text()).to.contain('-8°C');
    await wrapper.setProps({value: -6, text: '-6°C'});
    expect(wrapper.find('.con-flipval__card--out').text()).to.eq('-8°C');
    expect(wrapper.find('.con-flipval__card--in').text()).to.eq('-6°C');
    wrapper.unmount();
  });

  it('carries the accent for the one-shot beat', () => {
    const wrapper = mount(ConsoleFlipValue, {props: {value: 78, text: '78%', accent: 'mint'}});
    expect(wrapper.classes()).to.contain('con-flipval--mint');
    expect(wrapper.classes()).to.not.contain('con-flipval--cyan');
    wrapper.unmount();
  });

  it('defaults to the cyan accent', () => {
    const wrapper = mount(ConsoleFlipValue, {props: {value: 1}});
    expect(wrapper.classes()).to.contain('con-flipval--cyan');
    wrapper.unmount();
  });

  it('a DECREASE (undo / another game opened) snaps silently — never a celebration', async () => {
    const wrapper = mount(ConsoleFlipValue, {props: {value: 5, text: '5/9'}});
    await wrapper.setProps({value: 2, text: '2/9'});
    expect(wrapper.classes()).to.not.contain('con-flipval--flip');
    expect(wrapper.text()).to.contain('2/9');
    expect(wrapper.find('.con-flipval__card--out').exists()).to.eq(false);
    wrapper.unmount();
  });

  it('flipOnDecrease: a DECREASE plays the same calm flip (deck-style readouts)', async () => {
    const wrapper = mount(ConsoleFlipValue, {props: {value: 30, flipOnDecrease: true}});
    await wrapper.setProps({value: 27});
    expect(wrapper.classes()).to.contain('con-flipval--flip');
    expect(wrapper.find('.con-flipval__card--out').text()).to.eq('30');
    expect(wrapper.find('.con-flipval__card--in').text()).to.eq('27');
    wrapper.unmount();
  });

  it('a re-formatted text at the SAME value re-faces without flipping', async () => {
    const wrapper = mount(ConsoleFlipValue, {props: {value: 7, text: '7/9'}});
    await wrapper.setProps({value: 7, text: '7 of 9'});
    expect(wrapper.classes()).to.not.contain('con-flipval--flip');
    expect(wrapper.text()).to.contain('7 of 9');
    wrapper.unmount();
  });

  it('a rapid second increase restarts the flip from the CURRENTLY shown value', async () => {
    const wrapper = mount(ConsoleFlipValue, {props: {value: 1}});
    await wrapper.setProps({value: 2});
    await wrapper.setProps({value: 3});
    expect(wrapper.classes()).to.contain('con-flipval--flip');
    expect(wrapper.find('.con-flipval__card--out').text()).to.eq('2');
    expect(wrapper.find('.con-flipval__card--in').text()).to.eq('3');
    wrapper.unmount();
  });
});
