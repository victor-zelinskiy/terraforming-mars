import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import {ActionEffect} from '@/common/models/ActionPreviewModel';

function chip(effect: ActionEffect) {
  return mount(ActionEffectChip, {...globalConfig, props: {effect}});
}

/**
 * TRP8 Aerospace Company: ONE unit of one of SEVERAL kinds («1 mech OR fighter to a card») is ONE chip naming every
 * kind (`effect.icons`), joined by «/» — never two chips, which would read as a sum.
 */
describe('ActionEffectChip — one unit of several kinds (TRP8)', () => {
  it('draws every kind\'s sprite in one chip, joined by a slash, before one amount', () => {
    const w = chip({direction: 'gain', icon: 'resources', icons: ['mech', 'fighter'], amount: 1, note: 'to a card'});
    const kinds = w.find('[data-chip-kinds]');
    expect(kinds.exists(), 'the kinds group').to.eq(true);
    expect(kinds.findAll('.action-effect-chip__icon').length, 'two sprites').to.eq(2);
    expect(kinds.find('.action-effect-chip__kinds-sep').text()).to.eq('/');
    expect(w.findAll('.action-effect-chip__amount').length, 'one amount').to.eq(1);
    expect(w.text().replace(/\s/g, '')).to.contain('+1');
    w.unmount();
  });

  it('a one-kind chip keeps its single sprite', () => {
    const w = chip({direction: 'gain', icon: 'mech', amount: 1, note: 'to a card'});
    expect(w.find('[data-chip-kinds]').exists()).to.eq(false);
    expect(w.findAll('.action-effect-chip__icon').length).to.eq(1);
    w.unmount();
  });
});
