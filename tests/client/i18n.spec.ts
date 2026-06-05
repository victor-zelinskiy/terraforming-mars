import {expect} from 'chai';
import {PreferencesManager} from '@/client/utils/PreferencesManager';
import {translateText} from '@/client/directives/i18n';

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

  it('still reports ordinary missing text', () => {
    expect(translateText('Missing i18n smoke test phrase')).eq('Missing i18n smoke test phrase');

    expect(logs).deep.eq(['ru - please translate: "Missing i18n smoke test phrase"']);
  });
});
