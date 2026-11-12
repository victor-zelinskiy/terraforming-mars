import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import PrivateScoreMask from '@/client/components/overview/PrivateScoreMask.vue';

/*
 * THE MASKED STAND-IN for the viewer's own VP on its own: one prop (`compact`), no emit, nothing exposed. What it
 * renders is the slashed eye and a label that says the score is hidden — and NO number anywhere (text, `title`,
 * `aria-label`), which is the component's whole reason to exist.
 */
describe('PrivateScoreMask', () => {
  it('the root is the mask itself — an image role with the slashed eye inside', () => {
    const wrapper = mount(PrivateScoreMask);
    expect(wrapper.element.tagName).to.eq('SPAN');
    expect(wrapper.classes()).to.include('vp-private');
    expect(wrapper.classes()).to.not.include('vp-private--compact');
    expect(wrapper.attributes('role')).to.eq('img');
    const eye = wrapper.find('svg.vp-private__eye');
    expect(eye.exists()).to.eq(true);
    expect(eye.attributes('aria-hidden')).to.eq('true');
    expect(eye.find('.vp-private__eye-shape').exists()).to.eq(true);
    expect(eye.find('.vp-private__eye-pupil').exists()).to.eq(true);
    expect(eye.find('.vp-private__eye-slash').exists()).to.eq(true);
  });

  it('`compact` is the smaller variant — a modifier class, the same drawing', async () => {
    const wrapper = mount(PrivateScoreMask, {props: {compact: true}});
    expect(wrapper.classes()).to.include('vp-private--compact');
    expect(wrapper.find('svg.vp-private__eye').exists()).to.eq(true);

    await wrapper.setProps({compact: false});
    expect(wrapper.classes()).to.not.include('vp-private--compact');
  });

  it('says the score is hidden through the translator it imports — and carries NO number anywhere', () => {
    // No `$t` mock and no i18n plugin: a `<script setup>` component brings its own translator.
    const wrapper = mount(PrivateScoreMask);
    const label = wrapper.attributes('aria-label') ?? '';
    expect(label).to.not.eq('');
    expect(label, 'the value cannot leak through the label').to.not.match(/\d/);
    expect(wrapper.text(), 'nor through the text').to.eq('');
    expect(wrapper.attributes('title'), 'the native title is banned').to.eq(undefined);
  });
});
