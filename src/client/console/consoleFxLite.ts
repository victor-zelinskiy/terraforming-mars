/**
 * @console-shared LIVE — «Упрощённые графические эффекты» (fx-lite).
 *
 * The OPT-IN reduced-graphics setting of the second Steam-Deck performance
 * iteration. Unlike the (removed) old performance mode, the PAINT BASELINE
 * (filter/text-shadow cut) is permanent and unconditional — this axis cuts
 * the NEXT tier of measured cost, which IS a visible reduction and therefore
 * a user choice:
 *
 *   - the ambient DECORATIVE loops that keep the compositor awake on an idle
 *     board (measured census: 7 infinite animations on a late-game board —
 *     status-dot pulse, convert-glow rows, strategy-rail medal breathing);
 *   - the action wheel's large gradient halo (re-rastered under the entry
 *     scale tween);
 *   - the shade's focus vignette layer;
 *   - the heaviest multi-layer decorative shadows on card faces.
 *
 * Rules (console_fx_lite.less, gated `html.console-native.con-fx-lite`):
 * functional information NEVER leaves — focus/selection rings, availability
 * colours, whose-turn state and every gameplay cue keep their static paint.
 *
 * Default OFF; never auto-enabled by device detection; persisted; applied
 * live (a class flip — no remount, no restart).
 */
import {reactive} from 'vue';

const STORAGE_KEY = 'tm_console_fx_lite';
const HTML_CLASS = 'con-fx-lite';

function storage(): Storage | undefined {
  try {
    return (globalThis as {localStorage?: Storage}).localStorage;
  } catch {
    return undefined;
  }
}

/** Reactive so the settings row + any surface reacts to a toggle. */
export const consoleFxLiteState = reactive({enabled: storage()?.getItem(STORAGE_KEY) === '1'});

/**
 * Write the `<html>` class bridge. Call once at bootstrap and after every
 * `setConsoleFxLite`. No-op under SSR/tests.
 */
export function applyConsoleFxLiteClass(): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.documentElement.classList.toggle(HTML_CLASS, consoleFxLiteState.enabled);
}

/** Persist + apply the reduced-graphics preference live. */
export function setConsoleFxLite(on: boolean): void {
  consoleFxLiteState.enabled = on;
  try {
    storage()?.setItem(STORAGE_KEY, on ? '1' : '0');
  } catch {
    // Private mode etc. — the in-session value still applies.
  }
  applyConsoleFxLiteClass();
}
