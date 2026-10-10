import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import {ActionEffect} from '@/common/models/ActionPreviewModel';

function chip(effect: ActionEffect) {
  return mount(ActionEffectChip, {...globalConfig, props: {effect}});
}

/**
 * PL-147 (TR41): a scale step's OWN RATING is stated right after the scale as an
 * IMPLIED chip — a bare «+1», the quiet face. It restates a step another chip of
 * the row already pays, so it must never read as a second thing the card adds:
 * its own class carries the dimmer rim, and no `current → resulting` is drawn.
 */
describe('ActionEffectChip — the implied rating (PL-147)', () => {
  it('wears the implied face and reads as a bare delta', () => {
    const w = chip({direction: 'gain', icon: 'tr', amount: 1, implied: true});
    expect(w.find('.action-effect-chip--implied').exists(), 'the quiet face').to.eq(true);
    expect(w.find('.action-effect-chip--gain').exists(), 'still a gain').to.eq(true);
    expect(w.find('.action-effect-chip__arrow').exists(), 'no pool reading').to.eq(false);
    expect(w.text().replace(/\s/g, '')).to.contain('+1');
    expect(w.find('.action-effect-chip--noeffect').exists(), 'a bare +1 is not a no-op').to.eq(false);
    w.unmount();
  });

  it('an ordinary rating chip keeps the loud face', () => {
    const w = chip({direction: 'gain', icon: 'tr', amount: 1, current: 20, resulting: 21});
    expect(w.find('.action-effect-chip--implied').exists()).to.eq(false);
    expect(w.text().replace(/\s/g, '')).to.contain('20→21');
    w.unmount();
  });
});
