/*
 * CardLorePlayground — the DEV-ONLY stand of the fullscreen ARCHIVE ENTRY (`?lorePlayground`): every text shape of the
 * lore block at once, in both locales. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md). The
 * block itself is CardLoreAside's subject; this spec reads the stand: its cells, what each hands the block, and its
 * two controls (the locale, «revealed»).
 */
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {PreferencesManager} from '@/client/utils/PreferencesManager';
import CardLorePlayground from '@/client/components/card/CardLorePlayground.vue';

// The lore block has its own spec; this one reads what the stand HANDS it.
// (A render function, not a template string: the runtime compiler is not in this build.)
const AsideStub = defineComponent({
  name: 'CardLoreAside',
  props: ['model', 'nonce'],
  render: () => h('i', {class: 'aside-stub'}),
});

function stand(props: Record<string, unknown> = {}) {
  return mount(CardLorePlayground, {
    ...globalConfig,
    props,
    global: {...globalConfig.global, stubs: {CardLoreAside: AsideStub}},
  });
}

/** The suite's storage, when a spec of the bundle installed one (this runner has no `localStorage` of its own). */
function storage(): Storage | undefined {
  return (globalThis as {localStorage?: Storage}).localStorage;
}

describe('CardLorePlayground — the archive entry\'s stand', () => {
  let langBefore: string;
  let storedBefore: string | null;

  beforeEach(() => {
    langBefore = PreferencesManager.INSTANCE.values().lang;
    storedBefore = storage()?.getItem('lang') ?? null;
  });

  afterEach(() => {
    // The stand writes the player's locale (module state, and the storage behind it) — put back what the suite had.
    PreferencesManager.INSTANCE.set('lang', langBefore);
    if (storedBefore === null) {
      storage()?.removeItem('lang');
    } else {
      storage()?.setItem('lang', storedBefore);
    }
  });

  it('one captioned cell per text shape — each hands the block a finished model, revealed', () => {
    const w = stand();
    expect(w.classes()).to.deep.eq(['lore-playground']);
    const cells = w.findAll('.lore-playground__grid > .lore-playground__cell');
    expect(cells).to.have.length(14);
    const keys = cells.map((cell) => cell.find('.lore-playground__caption > b').text());
    expect(keys.slice(0, 2)).to.deep.eq(['short', 'short · slogan']);
    expect(keys.slice(-3)).to.deep.eq(['fallback', 'party · longest', 'party · shortest']);
    expect(new Set(keys).size, 'every cell has a key of its own').to.eq(14);
    for (const cell of cells) {
      expect(cell.find('.lore-playground__caption > span').text()).to.not.eq('');
      expect(cell.find('.lore-playground__gutter > .aside-stub').exists()).to.eq(true);
      expect(cell.find('.lore-playground__gutter > .lore-playground__cardedge').attributes('aria-hidden')).to.eq('true');
    }

    const asides = w.findAllComponents(AsideStub);
    expect(asides).to.have.length(14);
    for (const aside of asides) {
      expect(aside.props('nonce')).to.eq(1);
      expect(aside.props('model').text).to.be.a('string').and.not.eq('');
    }
    const fallback = asides[keys.indexOf('fallback')].props('model');
    expect(fallback.fallback, 'a card with no entry gets the honest notice').to.eq(true);
    expect(asides[0].props('model').fallback).to.eq(false);
  });

  it('«revealed» drives the block\'s settle signal', async () => {
    const w = stand();
    const toggle = w.find('.lore-playground__toggle > input[type="checkbox"]');
    expect((toggle.element as HTMLInputElement).checked).to.eq(true);

    await toggle.setValue(false);
    expect(w.findAllComponents(AsideStub).map((aside) => aside.props('nonce'))).to.deep.eq(new Array(14).fill(0));

    await toggle.setValue(true);
    expect(w.findAllComponents(AsideStub).map((aside) => aside.props('nonce'))).to.deep.eq(new Array(14).fill(1));
  });

  it('the locale buttons: the player\'s locale is lit, a press switches it and writes the preference', async () => {
    PreferencesManager.INSTANCE.set('lang', 'ru');
    const w = stand();
    const buttons = w.findAll('.lore-playground__bar > .lore-playground__loc');
    expect(buttons.map((button) => button.text())).to.deep.eq(['RU', 'EN']);
    expect(buttons.map((button) => button.classes().includes('lore-playground__loc--on'))).to.deep.eq([true, false]);

    await buttons[1].trigger('click');
    expect(PreferencesManager.INSTANCE.values().lang).to.eq('en');
    expect(buttons.map((button) => button.classes().includes('lore-playground__loc--on'))).to.deep.eq([false, true]);
    expect(w.findAllComponents(AsideStub), 'every cell is rebuilt for the locale').to.have.length(14);

    await buttons[0].trigger('click');
    expect(PreferencesManager.INSTANCE.values().lang).to.eq('ru');
    expect(buttons.map((button) => button.classes().includes('lore-playground__loc--on'))).to.deep.eq([true, false]);
  });

  it('hosted in the console stand it says so on its root', async () => {
    const w = stand({embedded: true});
    expect(w.classes()).to.deep.eq(['lore-playground', 'lore-playground--embedded']);

    await w.setProps({embedded: false});
    expect(w.classes()).to.deep.eq(['lore-playground']);
  });
});
