/*
 * ActionVpProgress — «ПРОГРЕСС ПО»: the VP context of a card-resource change (the threshold's progress before → after,
 * the shared bar, the card's VP before → after). A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md):
 * what it renders for its props. The NUMBERS are `actionVpProgress.ts`'s and have their own spec
 * (`actionVpProgress.spec.ts` — hence this file's name); this one reads the face. The unit runner renders the English keys.
 */
import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {translateText} from '@/client/directives/i18n';
import {CardName} from '@/common/cards/CardName';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import ActionVpProgress from '@/client/components/actions/ActionVpProgress.vue';
import VpProgressBar from '@/client/components/common/VpProgressBar.vue';

// Tardigrades: 1 VP per 4 microbes — a THRESHOLD scorer.
function progress(props: Record<string, unknown> = {}, attrs: Record<string, unknown> = {}) {
  return mount(ActionVpProgress, {
    ...globalConfig,
    props: {cardName: CardName.TARDIGRADES, resourceIcon: 'microbe', before: 2, after: 3, ...props},
    attrs,
  });
}

describe('ActionVpProgress — the VP context of a card-resource change', () => {
  it('a threshold scorer: the label, the resource icon, «before/per → after/per», the bar and the card\'s VP', () => {
    const w = progress();
    expect(w.classes()).to.deep.eq(['action-vp']);
    expect(w.find('.action-vp__label').text()).to.eq(translateText('VP progress'));
    const iconClasses = iconClassFor('microbe').split(' ').filter((c) => c !== '');
    expect(iconClasses, 'the icon key resolves to a sprite').to.not.be.empty;
    expect(w.find('.action-vp__icon').classes()).to.include.members(iconClasses);
    expect(w.find('.action-vp__cur').text()).to.eq('2/4');
    expect(w.find('.action-vp__res').text()).to.eq('3/4');
    expect(w.findComponent(VpProgressBar).props()).to.deep.eq({filled: 3, per: 4, reached: false});
    expect(w.find('.action-vp__vp').classes()).to.not.contain('action-vp__vp--up');
    expect(w.find('.action-vp__vp-label').text()).to.eq(translateText('VP from card'));
    expect(w.find('.action-vp__vp-cur').text()).to.eq('0');
    expect(w.find('.action-vp__vp-res').text()).to.eq('0');
  });

  it('follows its props: crossing the threshold fills the bar and lights the VP line', async () => {
    const w = progress();
    await w.setProps({before: 3, after: 4});
    expect(w.find('.action-vp__cur').text()).to.eq('3/4');
    expect(w.find('.action-vp__res').text()).to.eq('4/4');
    expect(w.findComponent(VpProgressBar).props()).to.deep.eq({filled: 4, per: 4, reached: true});
    expect(w.find('.action-vp__vp').classes()).to.contain('action-vp__vp--up');
    expect(w.find('.action-vp__vp-cur').text()).to.eq('0');
    expect(w.find('.action-vp__vp-res').text()).to.eq('1');
  });

  it('a per-resource multiplier shows the VP delta with no threshold bar; a card that scores no resource renders nothing', () => {
    // Physics Complex: 2 VP per science — every resource is already a VP.
    const multiplier = progress({cardName: CardName.PHYSICS_COMPLEX, resourceIcon: 'science', before: 1, after: 2});
    expect(multiplier.find('.action-vp').exists()).to.be.true;
    expect(multiplier.find('.action-vp__head').exists()).to.be.false;
    expect(multiplier.findComponent(VpProgressBar).exists()).to.be.false;
    expect(multiplier.find('.action-vp__vp').classes()).to.contain('action-vp__vp--up');
    expect(multiplier.find('.action-vp__vp-cur').text()).to.eq('2');
    expect(multiplier.find('.action-vp__vp-res').text()).to.eq('4');

    const none = progress({cardName: CardName.POWER_PLANT});
    expect(none.find('.action-vp').exists()).to.be.false;
  });

  it('compact drops the section label and shortens the caption — and the template STARTS WITH ITS ROOT', () => {
    const w = progress({compact: true}, {'class': 'from-host', 'data-from-host': 'yes'});
    expect((w.element as HTMLElement).tagName).to.eq('DIV');
    expect(w.classes()).to.include.members(['action-vp', 'action-vp--compact', 'from-host']);
    expect(w.attributes('data-from-host')).to.eq('yes');
    expect(w.find('.action-vp__label').exists()).to.be.false;
    expect(w.find('.action-vp__vp-label').text()).to.eq(translateText('VP'));
    expect(w.find('.action-vp__cur').text()).to.eq('2/4');
  });
});
