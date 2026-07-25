import {expect} from 'chai';
import {mount, VueWrapper} from '@vue/test-utils';
import {CardName} from '@/common/cards/CardName';
import {PreferencesManager} from '@/client/utils/PreferencesManager';
import CardLoreAside from '@/client/components/card/CardLoreAside.vue';
import ruLore from '../../../../src/locales/ru/lore_texts.json';

const RU_LORE: Readonly<Record<string, string>> = ruLore;

const RU_UI: Readonly<Record<string, string>> = {
  'FROM THE ARCHIVES': 'ЗАПИСЬ ИЗ АРХИВА',
  'No archive entry is available.': 'Архивная запись отсутствует.',
};

function setupLocale(lang: string): void {
  PreferencesManager.resetForTest();
  PreferencesManager.INSTANCE.set('lang', lang);
  (window as any)._translations = {...RU_LORE, ...RU_UI};
}

function mountLore(cardName: CardName | string, nonce = 1): VueWrapper<any> {
  return mount(CardLoreAside, {props: {cardName: cardName as CardName, nonce}});
}

describe('CardLoreAside', () => {
  let originalTranslations: unknown;
  let originalWarn: typeof console.warn;

  beforeEach(() => {
    originalTranslations = (window as any)._translations;
    originalWarn = console.warn;
    setupLocale('ru');
  });

  afterEach(() => {
    console.warn = originalWarn;
    (window as any)._translations = originalTranslations;
    PreferencesManager.resetForTest();
  });

  it('renders the localized heading and the localized entry', () => {
    const wrapper = mountLore(CardName.HACKERS);
    expect(wrapper.find('.card-zoom-lore__label-text').text()).to.eq('ЗАПИСЬ ИЗ АРХИВА');
    expect(wrapper.find('.card-zoom-lore__text').text())
      .to.eq('Крайне неэтично. Совершенно незаконно. Баснословно выгодно.');
    // The word "lore" is a code-side term only — it must never be user-facing.
    expect(wrapper.text().toLowerCase()).to.not.include('лор');
  });

  it('localizes an entry the generic render guard would otherwise skip', () => {
    expect(mountLore(CardName.AI_CENTRAL).find('.card-zoom-lore__text').text()).to.eq('Сорок два.');
  });

  it('renders the English entry under the en locale', () => {
    setupLocale('en');
    const wrapper = mountLore(CardName.AI_CENTRAL);
    expect(wrapper.find('.card-zoom-lore__label-text').text()).to.eq('FROM THE ARCHIVES');
    expect(wrapper.find('.card-zoom-lore__text').text()).to.eq('42.');
    expect(wrapper.find('blockquote').attributes('lang')).to.eq('en');
  });

  it('marks the quotation with the active locale', () => {
    expect(mountLore(CardName.HACKERS).find('blockquote').attributes('lang')).to.eq('ru');
  });

  it('never adds real quotation characters to the entry', () => {
    // The two marks are DECORATION (aria-hidden spans with CSS glyphs); the
    // entries already carry their own punctuation.
    const wrapper = mountLore(CardName.TOLL_STATION);
    expect(wrapper.find('.card-zoom-lore__text').text()).to.eq('Лицензировано «правительством».');

    const jfk = mountLore(CardName.CUTTING_EDGE_TECHNOLOGY);
    const text = jfk.find('.card-zoom-lore__text').text();
    expect(text.startsWith('«')).to.eq(true);
    expect(text).to.not.include('«««');
    expect(text).to.eq(RU_LORE['We choose to go to the Moon in this decade and do the other things, not because they are easy, but because they are hard. - JFK.']);
  });

  it('renders BOTH decorative marks, aria-hidden and outside the text', () => {
    const wrapper = mountLore(CardName.HACKERS);
    const marks = wrapper.findAll('.card-zoom-lore__mark');
    expect(marks.length).to.eq(2);
    expect(wrapper.find('.card-zoom-lore__mark--open').attributes('aria-hidden')).to.eq('true');
    expect(wrapper.find('.card-zoom-lore__mark--close').attributes('aria-hidden')).to.eq('true');
    // Decoration carries no text of its own — the glyphs are drawn, never typed.
    marks.forEach((m) => expect(m.text()).to.eq(''));
    expect(wrapper.text()).to.not.match(/[“”❝❞]/);
  });

  it('draws the marks as LOCAL svg — never a font glyph or an emoji', () => {
    // A drawn mark is identical on every platform AND identical in Literata and
    // Newsreader; a font glyph would differ between the two literary faces.
    const wrapper = mountLore(CardName.HACKERS);
    for (const cls of ['--open', '--close']) {
      const mark = wrapper.find(`.card-zoom-lore__mark${cls}`);
      expect(mark.element.tagName.toLowerCase(), cls).to.eq('svg');
      expect(mark.attributes('focusable'), cls).to.eq('false');
      // Two commas: a bowl + a tail each.
      expect(mark.findAll('circle').length, cls).to.eq(2);
      expect(mark.findAll('path').length, cls).to.eq(2);
    }
  });

  it('never re-introduces a quote RULE — no border on the blockquote element', () => {
    // Spectre.css styles every blockquote with a light `border-left`; the block
    // must not carry one inline either. (The stylesheet reset is covered by the
    // e2e, which has real CSS.)
    const quote = mountLore(CardName.HACKERS).find('blockquote');
    expect(quote.attributes('style') ?? '').to.not.include('border');
  });

  it('marks the heading ornaments decorative and keeps the heading readable', () => {
    const wrapper = mountLore(CardName.HACKERS);
    expect(wrapper.find('.card-zoom-lore__spark').attributes('aria-hidden')).to.eq('true');
    expect(wrapper.find('.card-zoom-lore__rule').attributes('aria-hidden')).to.eq('true');
    expect(wrapper.find('.card-zoom-lore__tip').attributes('aria-hidden')).to.eq('true');
    // The label is a real heading, not an aria-hidden graphic.
    expect(wrapper.find('h2.card-zoom-lore__label').exists()).to.eq(true);
    expect(wrapper.find('.card-zoom-lore').attributes('aria-hidden')).to.eq(undefined);
  });

  it('uses semantic markup: an aside wrapping a blockquote', () => {
    const wrapper = mountLore(CardName.HACKERS);
    expect(wrapper.element.tagName).to.eq('ASIDE');
    expect(wrapper.find('blockquote.card-zoom-lore__quote').exists()).to.eq(true);
  });

  it('has nothing focusable — it can never enter tab / controller navigation', () => {
    const wrapper = mountLore(CardName.SATURN_SYSTEMS);
    expect(wrapper.findAll('button, a, input, [tabindex]').length).to.eq(0);
  });

  it('classifies the length tier onto the root', () => {
    expect(mountLore(CardName.AI_CENTRAL).classes()).to.include('card-zoom-lore--short');
    expect(mountLore(CardName.NITROGEN_RICH_ASTEROID).classes()).to.include('card-zoom-lore--regular');
    expect(mountLore(CardName.SATURN_SYSTEMS).classes()).to.include('card-zoom-lore--extended');
  });

  it('picks the literary face from the locale', () => {
    expect(mountLore(CardName.HACKERS).classes()).to.include('card-zoom-lore--cyrillic');
    setupLocale('en');
    expect(mountLore(CardName.HACKERS).classes()).to.include('card-zoom-lore--latin');
  });

  it('falls back to a localized notice, never an empty block', () => {
    console.warn = () => {};
    const wrapper = mountLore('A Card With No Archive Entry');
    expect(wrapper.classes()).to.include('card-zoom-lore--fallback');
    expect(wrapper.find('.card-zoom-lore__text').text()).to.eq('Архивная запись отсутствует.');
    expect(wrapper.find('.card-zoom-lore__label-text').text()).to.eq('ЗАПИСЬ ИЗ АРХИВА');
    // A notice is not a quotation — it carries no decorative marks.
    expect(wrapper.findAll('.card-zoom-lore__mark').length).to.eq(0);
    expect(wrapper.find('.card-zoom-lore__text').text()).to.not.include('???');
  });

  describe('reveal choreography', () => {
    it('stays hidden until the card has landed (nonce 0)', async () => {
      const wrapper = mountLore(CardName.HACKERS, 0);
      expect(wrapper.classes()).to.not.include('card-zoom-lore--in');
      await wrapper.setProps({nonce: 1});
      expect(wrapper.classes()).to.include('card-zoom-lore--in');
    });

    it('keeps the OLD entry visible-but-fading while the next card flies in', async () => {
      const wrapper = mountLore(CardName.HACKERS, 1);
      expect(wrapper.find('.card-zoom-lore__text').text()).to.include('Крайне неэтично');

      // A browse step re-points the card BEFORE it settles.
      await wrapper.setProps({cardName: CardName.AI_CENTRAL});
      expect(wrapper.classes()).to.not.include('card-zoom-lore--in');
      expect(wrapper.find('.card-zoom-lore__text').text()).to.include('Крайне неэтично');

      // The settle nonce swaps the text and reveals it — never two at once.
      await wrapper.setProps({nonce: 2});
      expect(wrapper.classes()).to.include('card-zoom-lore--in');
      expect(wrapper.find('.card-zoom-lore__text').text()).to.eq('Сорок два.');
    });

    it('hides at once when the close flight begins', async () => {
      const wrapper = mountLore(CardName.HACKERS, 1);
      // The reveal class lands on the tick AFTER mount — deliberately, so the
      // CSS transition plays instead of being the element's initial state.
      await wrapper.vm.$nextTick();
      expect(wrapper.classes()).to.include('card-zoom-lore--in');
      await wrapper.setProps({closing: true});
      expect(wrapper.classes()).to.not.include('card-zoom-lore--in');
    });
  });
});
