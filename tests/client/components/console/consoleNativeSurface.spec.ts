import {expect} from 'chai';
import {
  acquireConsoleNativeSurface,
  consoleNativeActive,
  consoleNativeState,
  resetConsoleNativeSurfaceForTest,
} from '@/client/console/composables/consoleNativeSurface';

/**
 * Foundation layer (CONSOLE_FOUNDATION.md §3): the refcounted page-level
 * overflow lock — `html.console-native` + the VueUse body scroll lock.
 * Module state is bundle-shared in mochapack → every test resets.
 */
describe('consoleNativeSurface (foundation)', () => {
  beforeEach(() => {
    resetConsoleNativeSurfaceForTest();
  });
  afterEach(() => {
    resetConsoleNativeSurfaceForTest();
  });

  it('acquire toggles html.console-native + locks body scroll', () => {
    expect(document.documentElement.classList.contains('console-native')).to.eq(false);
    const release = acquireConsoleNativeSurface();
    expect(consoleNativeActive()).to.eq(true);
    expect(document.documentElement.classList.contains('console-native')).to.eq(true);
    // VueUse useScrollLock sets the inline overflow style (belt-and-braces
    // next to the CSS class).
    expect(document.body.style.overflow).to.eq('hidden');
    release();
    expect(consoleNativeActive()).to.eq(false);
    expect(document.documentElement.classList.contains('console-native')).to.eq(false);
    expect(document.body.style.overflow).to.not.eq('hidden');
  });

  it('refcounts overlapping surfaces (screen switches stay seamless)', () => {
    const releaseA = acquireConsoleNativeSurface();
    const releaseB = acquireConsoleNativeSurface();
    expect(consoleNativeState.surfaces).to.eq(2);
    releaseA();
    // B still holds the lock.
    expect(consoleNativeActive()).to.eq(true);
    expect(document.documentElement.classList.contains('console-native')).to.eq(true);
    releaseB();
    expect(consoleNativeActive()).to.eq(false);
  });

  it('release is idempotent — a double call cannot underflow the count', () => {
    const releaseA = acquireConsoleNativeSurface();
    const releaseB = acquireConsoleNativeSurface();
    releaseA();
    releaseA();
    releaseA();
    expect(consoleNativeState.surfaces).to.eq(1);
    expect(consoleNativeActive()).to.eq(true);
    releaseB();
    expect(consoleNativeState.surfaces).to.eq(0);
  });
});
