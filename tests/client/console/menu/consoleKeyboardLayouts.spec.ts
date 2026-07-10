import {expect} from 'chai';
import {resolveUserKeyboardLayouts} from '@/client/components/console/menu/consoleKeyboardLayouts';

/** Override navigator.languages + navigator.language (jsdom exposes them read-only). */
function setLanguages(langs: ReadonlyArray<string>): void {
  Object.defineProperty(navigator, 'languages', {value: [...langs], configurable: true});
  // navigatorLangs() falls back to `navigator.language` when the list is empty —
  // stub it too so the fork's ru jsdom locale can't leak into the assertions.
  Object.defineProperty(navigator, 'language', {value: langs[0] ?? '', configurable: true});
}

describe('resolveUserKeyboardLayouts', () => {
  beforeEach(() => {
    try {
      window.localStorage.removeItem('tm_kb_layouts');
    } catch { /* private mode */ }
    setLanguages([]);
  });

  it('always returns at least the Latin fallback, never empty', () => {
    setLanguages([]);
    const ids = resolveUserKeyboardLayouts().map((l) => l.id);
    expect(ids).to.deep.eq(['en']);
  });

  it('derives layouts from the user language preferences (not game languages)', () => {
    setLanguages(['ru-RU', 'ru', 'en-US']);
    expect(resolveUserKeyboardLayouts().map((l) => l.id)).to.deep.eq(['ru', 'en']);
  });

  it('maps Ukrainian and keeps the Latin fallback', () => {
    setLanguages(['uk-UA']);
    expect(resolveUserKeyboardLayouts().map((l) => l.id)).to.deep.eq(['uk', 'en']);
  });

  it('falls back to Latin for languages without a shipped layout', () => {
    setLanguages(['de-DE', 'fr-FR']);
    expect(resolveUserKeyboardLayouts().map((l) => l.id)).to.deep.eq(['en']);
  });

  it('preserves the user priority order and dedupes', () => {
    setLanguages(['en-GB', 'ru', 'en', 'uk']);
    expect(resolveUserKeyboardLayouts().map((l) => l.id)).to.deep.eq(['en', 'ru', 'uk']);
  });

  it('honours an explicit localStorage override over navigator', () => {
    setLanguages(['ru-RU']);
    window.localStorage.setItem('tm_kb_layouts', 'uk, en');
    expect(resolveUserKeyboardLayouts().map((l) => l.id)).to.deep.eq(['uk', 'en']);
  });

  it('ignores unknown ids in the override and still guarantees the fallback', () => {
    window.localStorage.setItem('tm_kb_layouts', 'zz, ru');
    expect(resolveUserKeyboardLayouts().map((l) => l.id)).to.deep.eq(['ru', 'en']);
  });

  it('exposes a badge code + character rows per layout', () => {
    setLanguages(['ru']);
    const ru = resolveUserKeyboardLayouts().find((l) => l.id === 'ru');
    expect(ru?.code).to.eq('РУС');
    expect(ru?.rows).to.have.length(4);
    expect(ru?.shiftRows).to.have.length(4);
  });
});
