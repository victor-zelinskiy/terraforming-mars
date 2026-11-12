import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import BarButtonIcon from '@/client/components/overview/BarButtonIcon.vue';

/*
 * THE HUD BAR'S ICON on its own: one prop (`name`), no emit, nothing exposed. What it renders for that prop is the
 * whole component — ONE shared <svg> wrapper whose modifier class names the icon, and the inner paths of that icon
 * alone (an unknown name is the bare wrapper, never an error).
 */
describe('BarButtonIcon', () => {
  it('the root IS the shared svg wrapper — its class names the icon, it is hidden from assistive tech', () => {
    const wrapper = mount(BarButtonIcon, {props: {name: 'milestones'}});
    expect(wrapper.element.tagName.toLowerCase()).to.eq('svg');
    expect(wrapper.classes()).to.include('bar-btn-icon');
    expect(wrapper.classes()).to.include('bar-btn-icon--milestones');
    expect(wrapper.attributes('viewBox')).to.eq('0 0 24 24');
    expect(wrapper.attributes('stroke')).to.eq('currentColor');
    expect(wrapper.attributes('aria-hidden')).to.eq('true');
    expect(wrapper.attributes('focusable')).to.eq('false');
  });

  it('draws the inner shapes of the named icon ONLY', () => {
    const milestones = mount(BarButtonIcon, {props: {name: 'milestones'}});
    expect(milestones.findAll('path')).to.have.length(2);
    expect(milestones.find('circle').exists()).to.eq(false);

    const colonies = mount(BarButtonIcon, {props: {name: 'colonies'}});
    expect(colonies.findAll('circle')).to.have.length(1);
    expect(colonies.findAll('ellipse')).to.have.length(1);
    expect(colonies.find('path').exists()).to.eq(false);

    const cards = mount(BarButtonIcon, {props: {name: 'cards'}});
    expect(cards.findAll('rect')).to.have.length(2);
    expect(cards.find('path').exists()).to.eq(false);
  });

  it('follows a change of `name` — the class and the drawing swap together', async () => {
    const wrapper = mount(BarButtonIcon, {props: {name: 'log'}});
    expect(wrapper.classes()).to.include('bar-btn-icon--log');
    expect(wrapper.findAll('path')).to.have.length(3);

    await wrapper.setProps({name: 'penalty'});
    expect(wrapper.classes()).to.include('bar-btn-icon--penalty');
    expect(wrapper.classes()).to.not.include('bar-btn-icon--log');
    expect(wrapper.findAll('circle')).to.have.length(1);
    expect(wrapper.findAll('path')).to.have.length(1);
  });

  it('an unknown name is the bare wrapper — classed, with nothing drawn inside', () => {
    const wrapper = mount(BarButtonIcon, {props: {name: 'no-such-icon'}});
    expect(wrapper.classes()).to.include('bar-btn-icon--no-such-icon');
    expect(wrapper.element.children).to.have.length(0);
  });
});
