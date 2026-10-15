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
   * A READING SHORT OF THE NEXT POINT IS NOT «NO EFFECT» (the owner's decision of 2026-10-15). A card scoring 1 VP
   * per TWO microbes at an even count reads «1 → 1» — and the microbe still lands on the card. It used to take the
   * muted no-op paint («нет эффекта»), which read as a wasted action; it is the NEUTRAL register now, the badge names
   * WHAT did not move, and the server's note says how many more buy the point.
   */
  it('a reading short of the next point is NEUTRAL — never the muted «no effect»', () => {
    const w = chip({direction: 'gain', icon: 'vp', amount: 0, current: 1, resulting: 1});
    expect(w.find('.action-effect-chip--noeffect').exists(), 'no «no effect» paint').to.eq(false);
    expect(w.find('.action-effect-chip--steady').exists(), 'the neutral register').to.eq(true);
    expect(w.find('.action-effect-chip__vp').exists(), 'the reading still names itself').to.eq(true);
    expect(w.find('[data-chip-vp-steady]').exists(), 'with no server note it still says «VP unchanged»').to.eq(true);
    w.unmount();
  });

  it('the server note (how many more buy the point) replaces the bare fallback', () => {
    const w = chip({direction: 'gain', icon: 'vp', amount: 0, current: 0, resulting: 0,
      note: 'No new VP yet · ${0} more for the next', noteParams: ['1']});
    expect(w.find('.action-effect-chip--steady').exists()).to.eq(true);
    expect(w.find('[data-chip-vp-steady]').exists(), 'one note, never two').to.eq(false);
    expect(w.find('.action-effect-chip__note--sentence').exists(), 'the note is a sentence').to.eq(true);
    w.unmount();
  });

  it('a parameter at its limit keeps the muted «no effect»', () => {
    const w = chip({direction: 'gain', icon: 'oxygen', amount: 1, current: 14, resulting: 14, unit: '%'});
    expect(w.find('.action-effect-chip--noeffect').exists()).to.eq(true);
    expect(w.find('.action-effect-chip--steady').exists()).to.eq(false);
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
