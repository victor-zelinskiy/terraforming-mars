/* global globalThis */
import {expect} from 'chai';
import {consoleModeExplicitlyDisabled} from '@/client/console/consoleModeState';
import {isLinuxPlatform} from '@/client/console/runtimeMode';

/**
 * P14 (the Steam Deck critical): the Electron shell boots console-first on
 * a robust signal (pad OR Linux+handheld) — these are the guard predicates.
 * Chromium hides an idle pad pre-input and Steam Input may emulate a mouse,
 * so `consoleModeExplicitlyDisabled()` is the ONLY thing allowed to veto
 * the auto-enable: the `?console=0` session kill switch or a stored '0'
 * (hold-Menu → off). `isLinuxPlatform()` anchors the handheld-viewport
 * heuristic to the Deck's platform so a small-screen Windows laptop
 * running the desktop shell is never mistaken for a handheld.
 */

type FakeWindow = {location: {search: string}, localStorage?: {getItem(key: string): string | null}};

function withWindow<T>(win: FakeWindow, fn: () => T): T {
  (globalThis as {window?: unknown}).window = win;
  try {
    return fn();
  } finally {
    delete (globalThis as {window?: unknown}).window;
  }
}

function fakeStorage(value: string | null): {getItem(key: string): string | null} {
  return {getItem: (key: string) => (key === 'tm_console_mode' ? value : null)};
}

function withNavigator<T>(userAgent: string | undefined, fn: () => T): T {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  if (userAgent === undefined) {
    // Simulate a missing navigator (SSR-like) — the predicate must not throw.
    Object.defineProperty(globalThis, 'navigator', {value: undefined, configurable: true});
  } else {
    Object.defineProperty(globalThis, 'navigator', {value: {userAgent}, configurable: true});
  }
  try {
    return fn();
  } finally {
    if (original !== undefined) {
      Object.defineProperty(globalThis, 'navigator', original);
    } else {
      delete (globalThis as {navigator?: unknown}).navigator;
    }
  }
}

describe('console-first boot predicates (P14)', () => {
  it('no window → not explicitly disabled (headless-safe)', () => {
    expect(consoleModeExplicitlyDisabled()).to.eq(false);
  });

  it('?console=0 is a session kill switch — vetoes the auto-enable', () => {
    expect(withWindow({location: {search: '?console=0'}}, () => consoleModeExplicitlyDisabled())).to.eq(true);
    expect(withWindow({location: {search: '?foo=1&console=0'}}, () => consoleModeExplicitlyDisabled())).to.eq(true);
  });

  it('?console=1 / unrelated params do NOT veto', () => {
    expect(withWindow({location: {search: '?console=1'}}, () => consoleModeExplicitlyDisabled())).to.eq(false);
    expect(withWindow({location: {search: '?foo=0'}}, () => consoleModeExplicitlyDisabled())).to.eq(false);
  });

  it('stored "0" (hold-Menu → off) vetoes; stored "1" / never-set do not', () => {
    expect(withWindow({location: {search: ''}, localStorage: fakeStorage('0')}, () => consoleModeExplicitlyDisabled())).to.eq(true);
    expect(withWindow({location: {search: ''}, localStorage: fakeStorage('1')}, () => consoleModeExplicitlyDisabled())).to.eq(false);
    expect(withWindow({location: {search: ''}, localStorage: fakeStorage(null)}, () => consoleModeExplicitlyDisabled())).to.eq(false);
  });

  it('isLinuxPlatform: SteamOS/Linux Electron UA → true; Windows / Android / missing → false', () => {
    const linuxUa = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) terraforming-mars/1.0.4 Chrome/142.0.0.0 Electron/43.0.0 Safari/537.36';
    const windowsUa = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Electron/43.0.0 Safari/537.36';
    const androidUa = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36';
    expect(withNavigator(linuxUa, () => isLinuxPlatform())).to.eq(true);
    expect(withNavigator(windowsUa, () => isLinuxPlatform())).to.eq(false);
    expect(withNavigator(androidUa, () => isLinuxPlatform())).to.eq(false);
    expect(withNavigator(undefined, () => isLinuxPlatform())).to.eq(false);
  });
});
