import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import ColonyFleetPad from '@/client/components/colonies/ColonyFleetPad.vue';

/*
 * THE TRADE-FLEET LAUNCH PAD — a stateless berth: the owner's hue and «a fleet berths here» are its whole reading.
 * The template starts with its root (the `<svg>`), so the wrapper IS the pad and a host's class lands on it.
 */
function pad(props: Record<string, unknown>, attrs: Record<string, unknown> = {}) {
  return mount(ColonyFleetPad, {
    ...globalConfig,
    props: {color: 'red', ...props},
    attrs,
  });
}

describe('ColonyFleetPad', () => {
  it('an EMPTY pad: the plate, the deck line and the ticks in the owner\'s hue, nothing berthed', () => {
    const w = pad({color: 'blue'});
    expect(w.element.tagName.toLowerCase()).to.eq('svg');
    expect(w.classes()).to.include('colony-fleet-pad');
    expect(w.classes()).to.include('fleet-hue--blue');
    expect(w.classes()).to.not.include('colony-fleet-pad--occupied');
    expect(w.attributes('aria-hidden')).to.eq('true');
    expect(w.find('.cfp-base').exists()).to.eq(true);
    expect(w.find('.cfp-deck').exists()).to.eq(true);
    expect(w.find('.cfp-tick').exists()).to.eq(true);
  });

  it('an OCCUPIED pad says so by its class', () => {
    const w = pad({occupied: true});
    expect(w.classes()).to.include('fleet-hue--red');
    expect(w.classes()).to.include('colony-fleet-pad--occupied');
  });

  it('follows its props: the fleet leaves, the owner changes', async () => {
    const w = pad({occupied: true});
    await w.setProps({occupied: false, color: 'green'});
    expect(w.classes()).to.not.include('colony-fleet-pad--occupied');
    expect(w.classes()).to.include('fleet-hue--green');
    expect(w.classes()).to.not.include('fleet-hue--red');
  });

  it('a class its host lets fall through lands on the pad itself', () => {
    const w = pad({}, {class: 'host-berth'});
    expect(w.classes()).to.include('host-berth');
    expect(w.classes()).to.include('colony-fleet-pad');
  });
});
