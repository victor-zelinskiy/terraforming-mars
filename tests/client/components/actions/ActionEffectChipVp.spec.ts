import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import {ActionEffect} from '@/common/models/ActionPreviewModel';

function chip(effect: ActionEffect) {
  return mount(ActionEffectChip, {...globalConfig, props: {effect}});
}

/**
 * VICTORY POINTS ARE THE ONE READING WITH NO ART.
 *
 * Every other chip carries a sprite; VP are drawn as the card's own printed
 * badge, which is not an inline icon. Left to the normal resolution the key fell
 * through to `card-resource-vp` — a class no stylesheet defines — so the chip
 * reserved a 22px hole with nothing in it. The identity is carried by type
 * instead, the same answer the colony trade panel already gives for TR.
 */
describe('ActionEffectChip — the VP reading', () => {
  it('renders a typographic badge, never an empty icon box', () => {
    const w = chip({direction: 'gain', icon: 'vp', amount: 1, current: 4, resulting: 5});
    expect(w.find('.action-effect-chip__vp').exists(), 'the badge is drawn').to.eq(true);
    expect(w.find('.action-effect-chip__icon').exists(), 'and no empty sprite box is reserved').to.eq(false);
    expect(w.text().replace(/\s/g, ''), 'the reading itself still shows').to.contain('4→5');
    w.unmount();
  });

  /**
   * THE COLLISION THIS EXISTS FOR. A capped gain renders `noEffect`, which
   * REPLACES the chip's note with «нет эффекта». Had the VP identity ridden the
   * note — the obvious first implementation — a card scoring 1 VP per TWO
   * microbes at an even count would render as a bare «1 → 1 · нет эффекта» with
   * no word about WHAT did not change, on the very screen built to explain it.
   */
  it('keeps the badge when the gain pays nothing this time', () => {
    const w = chip({direction: 'gain', icon: 'vp', amount: 0, current: 1, resulting: 1});
    expect(w.find('.action-effect-chip--noeffect').exists(), 'the muted no-op treatment still applies').to.eq(true);
    expect(w.find('.action-effect-chip__vp').exists(), 'and the reading still names itself').to.eq(true);
    w.unmount();
  });

  /** A sprite-backed effect is untouched — this adds a path, it does not fork one. */
  it('leaves a normal sprite chip alone', () => {
    const w = chip({direction: 'cost', icon: 'megacredits', amount: 4, current: 47, resulting: 43});
    expect(w.find('.action-effect-chip__vp').exists()).to.eq(false);
    expect(w.find('.action-effect-chip__icon').exists()).to.eq(true);
    expect(w.find('.action-effect-chip--bare').exists(), 'and it never takes the no-sprite padding').to.eq(false);
    w.unmount();
  });
});
