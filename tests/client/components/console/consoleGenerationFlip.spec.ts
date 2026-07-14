import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import ConsoleGenerationFlip from '@/client/components/console/ConsoleGenerationFlip.vue';

describe('ConsoleGenerationFlip', () => {
  it('mounts silently — the value renders, no flip is playing', () => {
    const wrapper = mount(ConsoleGenerationFlip, {props: {value: 3}});
    expect(wrapper.text()).to.contain('3');
    expect(wrapper.classes()).to.not.contain('con-genflip--flip');
    expect(wrapper.find('.con-genflip__card--out').exists()).to.eq(false);
    wrapper.unmount();
  });

  it('an INCREASE plays the one-shot flip: old card folds out, new card in, flash', async () => {
    const wrapper = mount(ConsoleGenerationFlip, {props: {value: 3}});
    await wrapper.setProps({value: 4});
    expect(wrapper.classes()).to.contain('con-genflip--flip');
    const out = wrapper.find('.con-genflip__card--out');
    expect(out.exists()).to.eq(true);
    expect(out.text()).to.eq('3');
    expect(wrapper.find('.con-genflip__card--in').text()).to.eq('4');
    expect(wrapper.find('.con-genflip__flash').exists()).to.eq(true);
    wrapper.unmount();
  });

  it('the final generation arrives with the gold accent', async () => {
    const wrapper = mount(ConsoleGenerationFlip, {props: {value: 6, final: false}});
    await wrapper.setProps({value: 7, final: true});
    expect(wrapper.classes()).to.contain('con-genflip--final');
    expect(wrapper.classes()).to.contain('con-genflip--flip');
    wrapper.unmount();
  });

  it('a DECREASE (undo / another game opened) snaps silently — never a celebration', async () => {
    const wrapper = mount(ConsoleGenerationFlip, {props: {value: 5}});
    await wrapper.setProps({value: 2});
    expect(wrapper.classes()).to.not.contain('con-genflip--flip');
    expect(wrapper.text()).to.contain('2');
    expect(wrapper.find('.con-genflip__card--out').exists()).to.eq(false);
    wrapper.unmount();
  });

  it('a rapid second increase restarts the flip from the CURRENTLY shown value', async () => {
    const wrapper = mount(ConsoleGenerationFlip, {props: {value: 1}});
    await wrapper.setProps({value: 2});
    await wrapper.setProps({value: 3});
    expect(wrapper.classes()).to.contain('con-genflip--flip');
    expect(wrapper.find('.con-genflip__card--out').text()).to.eq('2');
    expect(wrapper.find('.con-genflip__card--in').text()).to.eq('3');
    wrapper.unmount();
  });
});
