/*
 * VpProgressBar — the shared «X / N toward the next VP» bar. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): what it renders for its three props. The unit runner renders the English keys.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {$t} from '@/client/directives/i18n';
import VpProgressBar from '@/client/components/common/VpProgressBar.vue';

function bar(props: Record<string, unknown>, attrs: Record<string, unknown> = {}) {
  return mount(VpProgressBar, {...globalConfig, props, attrs});
}

describe('VpProgressBar — the progress toward the next VP', () => {
  it('prints «filled/per», fills the track by the rounded share and names itself', () => {
    const w = bar({filled: 1, per: 3});
    expect(w.classes()).to.deep.eq(['vp-progress']);
    expect(w.attributes('aria-label')).to.eq($t('Progress to next VP'));
    expect(w.find('.vp-progress__text').text()).to.eq('1/3');
    expect(w.find('.vp-progress__track > .vp-progress__fill').attributes('style')).to.eq('width: 33%;');
  });

  it('a threshold of zero is an empty bar — never a division by zero', () => {
    const w = bar({filled: 2, per: 0});
    expect(w.find('.vp-progress__fill').attributes('style')).to.eq('width: 0%;');
    expect(w.find('.vp-progress__text').text()).to.eq('2/0');
  });

  it('`reached` recolours the bar, and the fill follows its props', async () => {
    const w = bar({filled: 2, per: 4});
    expect(w.classes()).to.not.contain('vp-progress--reached');
    expect(w.find('.vp-progress__fill').attributes('style')).to.eq('width: 50%;');
    await w.setProps({filled: 4, reached: true});
    expect(w.classes()).to.include.members(['vp-progress', 'vp-progress--reached']);
    expect(w.find('.vp-progress__fill').attributes('style')).to.eq('width: 100%;');
    expect(w.find('.vp-progress__text').text()).to.eq('4/4');
  });

  it('the template STARTS WITH ITS ROOT — what a host lets fall through lands on the bar itself', () => {
    const w = bar({filled: 0, per: 2}, {'class': 'from-host', 'data-from-host': 'yes'});
    expect((w.element as HTMLElement).tagName).to.eq('DIV');
    expect(w.classes()).to.include.members(['vp-progress', 'from-host']);
    expect(w.attributes('data-from-host')).to.eq('yes');
  });
});
