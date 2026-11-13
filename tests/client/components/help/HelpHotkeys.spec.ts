/*
 * HelpHotkeys — the hotkeys page of the help: the four places the keys lead to, beside the keyboard picture. A
 * `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): no props, no emits, nothing exposed — so the
 * spec is what it renders, and that its labels are translated by the `v-i18n` it IMPORTS (the new tests mount it
 * WITHOUT the i18n plugin on purpose: a Vue warning — an unresolved directive — fails the test).
 */
import {mount, shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {PreferencesManager} from '@/client/utils/PreferencesManager';
import HelpHotkeys from '@/client/components/help/HelpHotkeys.vue';

/** The spec's own dictionary — the page's four keys in another language (not the product's copy). */
const RU: Record<string, string> = {
  'Main Board': 'Карта Марса',
  'Players Overview Table': 'Игроки',
  'Cards in Hand': 'Карты в руке',
  'Colonies': 'Колонии',
};

function page() {
  return mount(HelpHotkeys, {global: {config: globalConfig.global.config}});
}

describe('HelpHotkeys', () => {
  it('mounts without errors', () => {
    const wrapper = shallowMount(HelpHotkeys, {
      ...globalConfig,
    });
    expect(wrapper.exists()).to.be.true;
  });

  it('names the four places the hotkeys lead to, in their order', () => {
    const w = page();
    const labels = w.findAll('.help-hotkeys > .keys > div');
    expect(labels.map((label) => label.text()))
      .to.deep.eq([$t('Main Board'), $t('Players Overview Table'), $t('Cards in Hand'), $t('Colonies')]);
    expect(labels.every((label) => label.attributes('tm-has-i18n') === 'true'), 'each label went through the imported directive').to.eq(true);
    expect(w.findAll('.help-hotkeys > *').map((child) => child.classes()), 'nothing but the keys in the block').to.deep.eq([['keys']]);
  });

  it('is TWO roots — the labels\' block, then the keyboard picture the stylesheet draws', () => {
    const w = page();
    // A multi-root component: its wrapper's element is the mount container, so the roots are its children.
    const roots = Array.from((w.element as HTMLElement).children);
    expect(roots.map((root) => root.className)).to.deep.eq(['help-hotkeys', 'help-hotkeys-example']);
    expect(roots[1].childNodes.length, 'the picture holds no markup of its own').to.eq(0);
  });

  describe('in the player\'s language', () => {
    let originalTranslations: unknown;
    beforeEach(() => {
      originalTranslations = (window as unknown as {_translations: unknown})._translations;
      (window as unknown as {_translations: unknown})._translations = RU;
      PreferencesManager.INSTANCE.set('lang', 'ru');
    });
    afterEach(() => {
      (window as unknown as {_translations: unknown})._translations = originalTranslations;
      PreferencesManager.INSTANCE.set('lang', 'en');
    });

    it('the labels are translated at the first frame — with no i18n plugin behind the component', () => {
      const w = page();
      expect(w.findAll('.help-hotkeys > .keys > div').map((label) => label.text()))
        .to.deep.eq(['Карта Марса', 'Игроки', 'Карты в руке', 'Колонии']);
    });
  });
});
