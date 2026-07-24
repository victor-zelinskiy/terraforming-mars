/**
 * @console-shared LIVE — console-native PERFORMANCE MODE ("perf-lite").
 *
 * Cuts the expensive DECORATIVE paint — CSS `filter` (blur / drop-shadow: each
 * forces a compositing layer + costly raster, feeding the Layerize bottleneck)
 * and box/text shadows (heavy per-frame paint) — for smoothness on weaker /
 * Windows-hybrid setups where the renderer is paint/Layerize-bound.
 *
 * MOTION IS UNTOUCHED: every transform, opacity and animation keeps running
 * identically — only the per-frame paint/layer cost drops. This is a smoothness-
 * over-gloss trade for TESTING/weak hardware, fully opt-in and reversible from
 * the main-menu Options. The CSS lives in `src/styles/console_perf.less`, gated
 * on `html.console-native.con-perf-lite` so it can never touch the desktop UI.
 *
 * Config: URL `?perfLite=1|0` → localStorage `tm_console_perf_lite` → default off.
 */
import {reactive} from 'vue';

const STORAGE_KEY = 'tm_console_perf_lite';
const HTML_CLASS = 'con-perf-lite';

function storage(): Storage | undefined {
  try {
    return (globalThis as {localStorage?: Storage}).localStorage;
  } catch (err) {
    return undefined;
  }
}

function readInitial(): boolean {
  try {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const fromUrl = /[?&]perfLite=([01])/.exec(search)?.[1];
    if (fromUrl !== undefined) {
      return fromUrl === '1';
    }
  } catch (err) {
    // ignore — fall through to storage
  }
  return storage()?.getItem(STORAGE_KEY) === '1';
}

/** Reactive so the Options row + any surface reacts to a toggle. */
export const consolePerfState = reactive({enabled: readInitial()});

/**
 * Write the `<html>` class bridge (adds/removes `con-perf-lite`). Call once at
 * bootstrap and after every `setConsolePerfLite`. No-op under SSR/tests.
 */
export function applyConsolePerfClass(): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.documentElement.classList.toggle(HTML_CLASS, consolePerfState.enabled);
}

/** Persist + apply the perf-mode preference live. */
export function setConsolePerfLite(on: boolean): void {
  consolePerfState.enabled = on;
  try {
    storage()?.setItem(STORAGE_KEY, on ? '1' : '0');
  } catch (err) {
    // Private mode etc. — the in-session value still applies.
  }
  applyConsolePerfClass();
}
