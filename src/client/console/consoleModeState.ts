/*
 * Console Mode state (docs/CONSOLE_MODE_CONCEPT.md §13).
 *
 * DESKTOP-REMOVAL WAVE 1 (2026-08-22): the console is the ONE shell —
 * `enabled` is unconditionally true. The frozen desktop <player-home> branch
 * was cut from App.vue (the future desktop UI will be built FROM the console
 * shell), so the old flag ladder (`?console=0`, stored `tm_console_mode='0'`,
 * the Options → Interface switch, hold-Menu toggle) lost its OFF direction:
 * stored opt-outs are never read again (the `tm_console_perf_lite`
 * precedent), `setConsoleMode(false)` is a no-op, and the consented entry
 * prompt can never fire (it only ever offered the way back in). The module
 * keeps its API shape because the Electron auto-enable heuristics and the
 * fullscreen plumbing still ride it.
 */

import {reactive} from 'vue';
import {supportsNativeFullscreen} from '@/client/console/runtimeMode';

const STORAGE_KEY = 'tm_console_mode';

function storage(): Storage | undefined {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined;
  } catch (err) {
    return undefined;
  }
}

function initialEnabled(): boolean {
  // Desktop-removal wave 1 (2026-08-22): the console is UNCONDITIONAL — the
  // frozen desktop shell was cut from App.vue, so there is nothing to fall
  // back to. A stored '0' (the old Options → Interface → Desktop opt-out)
  // and `?console=0` are simply never honoured again — the
  // `tm_console_perf_lite` precedent: old installs boot normally, the key
  // just stops being read.
  return true;
}

/**
 * Desktop-removal wave 1: the OFF direction died with the desktop shell —
 * nothing can explicitly disable the console any more. Kept (always false)
 * because the Electron auto-enable heuristics still consult it.
 */
export function consoleModeExplicitlyDisabled(): boolean {
  return false;
}

export const consoleModeState = reactive({
  enabled: initialEnabled(),
  /** The consented-entry prompt («Перейти в режим контроллера?»). */
  entryPromptVisible: false,
  /** Dismissed this session — don't re-offer on every pad input. */
  entryPromptDismissed: false,
});

export function setConsoleMode(on: boolean): void {
  // Desktop-removal wave 1: the OFF direction is gone — the console is the
  // only shell, so «switch to desktop» has no destination. The ON direction
  // keeps its side effects (fullscreen + persistence) for the auto-enable
  // heuristics that still call it.
  if (!on) {
    return;
  }
  consoleModeState.enabled = true;
  consoleModeState.entryPromptVisible = false;
  consoleModeState.entryPromptDismissed = false;
  requestConsoleFullscreen();
  try {
    storage()?.setItem(STORAGE_KEY, '1');
  } catch (err) {
    // Private mode — the in-session value still applies.
  }
}

/*
 * Fullscreen for the TV mode. CAVEAT (honest): the Fullscreen API needs a
 * TRUSTED user activation, and gamepad input does NOT grant one in
 * Chromium — so the direct attempt can fail on the web when the mode was
 * entered from the pad. Fallback: a one-shot listener grabs the NEXT
 * trusted gesture (mouse/keyboard) and retries. In the Electron shell the
 * window is fullscreen by default, so this is a no-op there.
 */
let fullscreenRetryArmed = false;

function retryOnTrustedGesture(): void {
  if (fullscreenRetryArmed || typeof window === 'undefined') {
    return;
  }
  fullscreenRetryArmed = true;
  const attempt = (e: Event) => {
    if (!e.isTrusted) {
      return;
    }
    window.removeEventListener('pointerdown', attempt, {capture: true});
    window.removeEventListener('keydown', attempt, {capture: true});
    fullscreenRetryArmed = false;
    if (consoleModeState.enabled) {
      requestConsoleFullscreen();
    }
  };
  window.addEventListener('pointerdown', attempt, {capture: true, passive: true});
  window.addEventListener('keydown', attempt, {capture: true, passive: true});
}

export function requestConsoleFullscreen(): void {
  // The NATIVE shell owns its window: Electron is fullscreen at the WINDOW
  // level and that survives every game-boundary reload. Entering DOM
  // fullscreen ON TOP of it is what used to feed the «Восстановить
  // полноэкранный режим» loop: the DOM state dies at every navigation BY
  // SPEC, the boot flags then read «fullscreen was lost», the curtain shows
  // the restore plate, its retry re-enters DOM fullscreen — and the next
  // transition repeats the whole cycle. In the shell this is a strict no-op.
  if (supportsNativeFullscreen()) {
    return;
  }
  if (typeof document === 'undefined' || document.fullscreenElement !== null) {
    return;
  }
  const root = document.documentElement;
  if (typeof root.requestFullscreen !== 'function') {
    return;
  }
  root.requestFullscreen({navigationUI: 'hide'}).catch(() => retryOnTrustedGesture());
}

/** First gamepad activity in desktop mode → offer the switch (once per
 *  session). Unreachable since wave 1 (`enabled` is always true) — kept for
 *  the GamepadLayer call sites until their own removal wave. */
export function maybeOfferConsoleMode(): void {
  if (consoleModeState.enabled || consoleModeState.entryPromptDismissed || consoleModeState.entryPromptVisible) {
    return;
  }
  consoleModeState.entryPromptVisible = true;
}

export function dismissConsoleOffer(): void {
  consoleModeState.entryPromptVisible = false;
  consoleModeState.entryPromptDismissed = true;
}
