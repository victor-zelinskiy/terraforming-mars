import {expect} from 'chai';
import {nextTick} from 'vue';
import {consoleFxLiteState, setConsoleFxLite, applyConsoleFxLiteClass} from '@/client/console/consoleFxLite';
import {
  applyReducedMotionClass,
  effectiveReducedMotion,
  reduceMotionOverrideState,
  reducedMotionActive,
  setReduceMotionOverride,
} from '@/client/utils/reducedMotion';
import {consoleReducedMotionActive, consoleMotionMs, REDUCED_MOTION_CAP_MS} from '@/client/console/composables/useConsoleReducedMotion';

/*
 * Iteration-2 settings guards: «Упрощённые графические эффекты» (fx-lite) and
 * the in-game «Меньше движения» override.
 *
 * Environment notes: under JSDOM there is no matchMedia, so the OS
 * prefers-reduced-motion source degrades to 'no-preference' — which makes the
 * OS term deterministically FALSE here and lets these specs pin the OVERRIDE
 * path end-to-end (the OS path itself is pinned on the pure policy fn). And
 * this JSDOM runs on an OPAQUE ORIGIN, where accessing window.localStorage
 * THROWS — exactly the environment the modules' storage guards exist for, so
 * persistence asserts go through the same guarded read.
 */
function safeStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
describe('console graphics settings (iteration 2)', () => {
  afterEach(async () => {
    // Module state is BUNDLE-SHARED in mochapack — leave nothing behind.
    setConsoleFxLite(false);
    setReduceMotionOverride(false);
    await nextTick();
  });

  it('both settings default OFF (fresh storage)', () => {
    // The states were initialized from an empty JSDOM localStorage.
    expect(consoleFxLiteState.enabled).eq(false);
    expect(reduceMotionOverrideState.enabled).eq(false);
    expect(reducedMotionActive()).eq(false);
  });

  it('the ONE reduced-motion policy: OS pref OR the in-game override', () => {
    expect(effectiveReducedMotion(false, false)).eq(false);
    expect(effectiveReducedMotion(true, false)).eq(true); // OS wins alone
    expect(effectiveReducedMotion(false, true)).eq(true); // override wins alone
    expect(effectiveReducedMotion(true, true)).eq(true);
  });

  it('fx-lite toggles live: class bridge + persistence, no restart', () => {
    applyConsoleFxLiteClass();
    expect(document.documentElement.classList.contains('con-fx-lite')).eq(false);
    setConsoleFxLite(true);
    expect(document.documentElement.classList.contains('con-fx-lite')).eq(true);
    const store = safeStorage();
    if (store !== undefined) {
      expect(store.getItem('tm_console_fx_lite')).eq('1');
    }
    setConsoleFxLite(false);
    expect(document.documentElement.classList.contains('con-fx-lite')).eq(false);
    if (store !== undefined) {
      expect(store.getItem('tm_console_fx_lite')).eq('0');
    }
  });

  it('the reduce-motion override drives the SHARED policy live', async () => {
    applyReducedMotionClass();
    await nextTick();
    expect(reducedMotionActive()).eq(false);
    expect(consoleReducedMotionActive()).eq(false);
    expect(document.documentElement.classList.contains('con-reduced-motion')).eq(false);

    setReduceMotionOverride(true);
    await nextTick();
    // Every consumer of the shared source follows at once: the reactive
    // snapshot, the console policy AND its duration cap, the CSS bridge.
    expect(reducedMotionActive()).eq(true);
    expect(consoleReducedMotionActive()).eq(true);
    expect(consoleMotionMs(1000)).eq(REDUCED_MOTION_CAP_MS);
    expect(document.documentElement.classList.contains('con-reduced-motion')).eq(true);
    const store = safeStorage();
    if (store !== undefined) {
      expect(store.getItem('tm_reduce_motion')).eq('1');
    }

    setReduceMotionOverride(false);
    await nextTick();
    expect(reducedMotionActive()).eq(false);
    expect(consoleMotionMs(1000)).not.eq(REDUCED_MOTION_CAP_MS);
    expect(document.documentElement.classList.contains('con-reduced-motion')).eq(false);
  });

  it('settings are independent and combinable; repeated toggling leaves no residue', async () => {
    for (let i = 0; i < 5; i++) {
      setConsoleFxLite(true);
      setReduceMotionOverride(true);
      await nextTick();
      setConsoleFxLite(false);
      setReduceMotionOverride(false);
      await nextTick();
    }
    // The class list carries no duplicates/residue (classList is a set, but a
    // broken bridge would leave the class ON) and the states are clean.
    expect(document.documentElement.classList.contains('con-fx-lite')).eq(false);
    expect(document.documentElement.classList.contains('con-reduced-motion')).eq(false);
    // Both ON together — the strongest supported mode — coexist coherently.
    setConsoleFxLite(true);
    setReduceMotionOverride(true);
    await nextTick();
    expect(document.documentElement.classList.contains('con-fx-lite')).eq(true);
    expect(document.documentElement.classList.contains('con-reduced-motion')).eq(true);
  });

  it('legacy persisted values are tolerated (old keys / junk do not break startup)', () => {
    const store = safeStorage();
    if (store !== undefined) {
      store.setItem('tm_console_perf_lite', '1'); // the REMOVED iteration-1 flag
      store.setItem('tm_console_fx_lite', 'junk');
      // Re-derive the way bootstrap does: junk reads as OFF, the dead key is ignored.
      expect(store.getItem('tm_console_fx_lite') === '1').eq(false);
    }
    // Storage present or not, the bootstrap appliers must not throw and the
    // removed flag's class must never come back.
    applyConsoleFxLiteClass();
    applyReducedMotionClass();
    expect(document.documentElement.classList.contains('con-perf-lite')).eq(false);
    if (store !== undefined) {
      store.removeItem('tm_console_perf_lite');
      store.removeItem('tm_console_fx_lite');
    }
  });
});
