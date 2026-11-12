/*
 * GameExitButton — the persistent «to main menu» corner button. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): what it renders. It has no props and emits nothing; its click enters the ONE exit
 * funnel (`exitGameToMenu`), which ends in a navigation the unit runner's page cannot make — the funnel is not walked
 * here. The mount under `failOnVueWarning` is the witness that the template's handler resolves.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from './getLocalVue';
import {$t} from '@/client/directives/i18n';
import GameExitButton from '@/client/components/GameExitButton.vue';

describe('GameExitButton — the exit to the main menu', () => {
  it('is a plain button that names itself', () => {
    const w = mount(GameExitButton, {...globalConfig});
    expect(w.element.tagName).to.eq('BUTTON');
    expect(w.classes()).to.deep.eq(['game-exit-btn']);
    expect(w.attributes('type')).to.eq('button');
    expect(w.attributes('aria-label')).to.eq($t('To main menu'));
  });

  it('prints its translated label beside a glyph assistive tech does not read', () => {
    const w = mount(GameExitButton, {...globalConfig});
    expect(w.find('.game-exit-btn__label').text()).to.eq($t('Menu'));
    const glyph = w.find('.game-exit-btn__glyph');
    expect(glyph.attributes('aria-hidden')).to.eq('true');
    expect(glyph.find('svg > path').exists()).to.eq(true);
  });
});
