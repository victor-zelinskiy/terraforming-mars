import {expect} from 'chai';
import {resolveUserKeyboardLayouts} from '@/client/components/console/menu/consoleKeyboardLayouts';

/** Override navigator.languages + navigator.language (jsdom exposes them read-only). */
function setLanguages(langs: ReadonlyArray<string>): void {
  Object.defineProperty(navigator, 'languages', {value: [...langs], configurable: true});
  // navigatorLangs() falls back to `navigator.language` when the list is empty —
  // stub it too so the fork's ru jsdom locale can't leak into the assertions.
  Object.defineProperty(navigator, 'language', {value: langs[0] ?? '', configurable: true});
}

// jsdom runs on an opaque origin here, so the real `window.localStorage` throws
// SecurityError — install a tiny in-memory fake so the override path is testable
// (the resolver reads window.localStorage through a try/catch).
const store = new Map<string, string>();
const fakeStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
} as unknown as Storage;

describe('resolveUserKeyboardLayouts', () => {
  // The environment is BUNDLE-SHARED (tests.md): every property this spec
  // stubs on `window` / `navigator` must be restored EXACTLY, or later specs
  // inherit a poisoned world. This bit for real: the un-restored fake left
  // `window.localStorage` NON-THROWING (jsdom's real one throws on the opaque
  // origin) while the settings modules kept writing to `globalThis` — and
  // consoleGraphicsSettings' persistence asserts started running against the
  // wrong storage, failing ONLY when the CI bundle order put this spec first.
  // jsdom hosts `localStorage` as an OWN accessor on the window (capture →
  // redefine), while `navigator.languages/.language` live on the prototype
  // (the stubbed own property is simply deleted).
  const originalStorageDesc = Object.getOwnPropertyDescriptor(window, 'localStorage');
  const originalLanguagesDesc = Object.getOwnPropertyDescriptor(navigator, 'languages');
  const originalLanguageDesc = Object.getOwnPropertyDescriptor(navigator, 'language');

  before(() => {
    Object.defineProperty(window, 'localStorage', {value: fakeStorage, configurable: true});
  });
  after(() => {
    if (originalStorageDesc === undefined) {
      delete (window as {localStorage?: unknown}).localStorage;
    } else {
      Object.defineProperty(window, 'localStorage', originalStorageDesc);
    }
    if (originalLanguagesDesc === undefined) {
      delete (navigator as unknown as {languages?: unknown}).languages;
    } else {
      Object.defineProperty(navigator, 'languages', originalLanguagesDesc);
    }
    if (originalLanguageDesc === undefined) {
      delete (navigator as unknown as {language?: unknown}).language;
    } else {
      Object.defineProperty(navigator, 'language', originalLanguageDesc);
    }
  });
  beforeEach(() => {
    store.clear();
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
