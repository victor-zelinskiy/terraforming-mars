import {expect} from 'chai';
import {PreferencesManager} from '@/client/utils/PreferencesManager';
import {translateCardName, translateText, translateTextNode} from '@/client/directives/i18n';

describe('i18n', () => {
  let originalTranslations: unknown;
  let originalConsoleLog: typeof console.log;
  let logs: Array<string>;

  beforeEach(() => {
    PreferencesManager.resetForTest();
    PreferencesManager.INSTANCE.set('lang', 'ru');
    originalTranslations = (window as any)._translations;
    (window as any)._translations = {};
    originalConsoleLog = console.log;
    logs = [];
    console.log = (message?: unknown) => {
      logs.push(String(message));
    };
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    (window as any)._translations = originalTranslations;
    PreferencesManager.resetForTest();
  });

  it('does not report card-render multiplier glyphs as missing translations', () => {
    expect(translateText('x')).eq('x');
    expect(translateText('3x')).eq('3x');

    expect(logs).deep.eq([]);
  });

  // A variant card id (`Name:promo` / `Name:ares` / a Turmoil Redux replacement's `Name:redux`) is keyed by its
  // BASE name only — the replacement reads as the classic card's localized name, never a `:redux` duplicate key.
  it('translates a `:redux` replacement id through the classic card\'s name', () => {
    (window as any)._translations = {'Aerial Lenses': 'Воздушные линзы'};
    expect(translateText('Aerial Lenses:redux')).eq('Воздушные линзы');
    expect(translateCardName('Aerial Lenses:redux')).eq('Воздушные линзы');
    (window as any)._translations = {'Sponsored Mohole': 'Грант на скважину'};
    expect(translateCardName('Sponsored Mohole:redux')).eq('Грант на скважину');
    expect(logs).deep.eq([]);
  });

  it('still reports ordinary missing text', () => {
    expect(translateText('Missing i18n smoke test phrase')).eq('Missing i18n smoke test phrase');

    expect(logs).deep.eq(['ru - please translate: "Missing i18n smoke test phrase"']);
  });

  /**
   * `v-i18n` REWRITES the text node in place. When only the PARAMS change and the
   * English template is identical (a board fact whose `${0}` goes 1 → 2 as the
   * cursor moves between cells), Vue leaves the text node alone — so a directive
   * that re-reads its own already-substituted output can never see `${0}` again
   * and freezes the FIRST number on screen. It must re-translate from the source.
   */
  describe('v-i18n param re-substitution', () => {
    it('re-substitutes when only the params change (text node reused)', () => {
      (window as any)._translations = {'Reduce production by ${0}': 'Снизить производство на ${0}'};
      const el = document.createElement('div');
      el.textContent = 'Reduce production by ${0}';

      translateTextNode(el, {value: ['1']});
      expect(el.textContent).eq('Снизить производство на 1');

      translateTextNode(el, {value: ['2']});
      expect(el.textContent).eq('Снизить производство на 2');
    });

    it('re-substitutes untranslated (English) text too', () => {
      const el = document.createElement('div');
      el.textContent = 'Reduce production by ${0}';

      translateTextNode(el, {value: ['1']});
      expect(el.textContent).eq('Reduce production by 1');

      translateTextNode(el, {value: ['3']});
      expect(el.textContent).eq('Reduce production by 3');
    });

    it('picks up a NEW English source written by Vue', () => {
      (window as any)._translations = {
        'Reduce production by ${0}': 'Снизить производство на ${0}',
        'Gain ${0} M€': 'Получите ${0} M€',
      };
      const el = document.createElement('div');
      el.textContent = 'Reduce production by ${0}';
      translateTextNode(el, {value: ['1']});
      expect(el.textContent).eq('Снизить производство на 1');

      el.textContent = 'Gain ${0} M€';
      translateTextNode(el, {value: ['4']});
      expect(el.textContent).eq('Получите 4 M€');
    });

    it('is stable when nothing changes (no double substitution)', () => {
      (window as any)._translations = {'Reduce production by ${0}': 'Снизить производство на ${0}'};
      const el = document.createElement('div');
      el.textContent = 'Reduce production by ${0}';
      translateTextNode(el, {value: ['2']});
      translateTextNode(el, {value: ['2']});
      translateTextNode(el, {value: ['2']});
      expect(el.textContent).eq('Снизить производство на 2');
    });
  });
});
