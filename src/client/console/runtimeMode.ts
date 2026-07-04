/*
 * RUNTIME MODE detection — the console-native pre-game shell (P10).
 *
 * ONE place that answers "where are we running?" so pre-game components
 * never touch Electron APIs directly: browser / Xbox-browser builds see a
 * missing `window.desktopBridge` and every capability degrades to false;
 * the Electron shell exposes the narrow bridge via its sandboxed preload
 * (electron/preload.ts → desktopBridge). Capabilities are FEATURE-DETECTED
 * per method (an older installed shell may predate quitApp/setFullscreen).
 */

import {desktopBridge, isDesktop} from '@/client/components/desktop/desktopUpdateState';

/** Running inside the Electron shell (any version)? */
export function isElectronApp(): boolean {
  return isDesktop();
}

/** The shell supports the safe IPC quit (the ВЫЙТИ menu item is shown iff true). */
export function supportsNativeQuit(): boolean {
  return typeof desktopBridge()?.quitApp === 'function';
}

/** The shell supports native window fullscreen (preferred over the browser API). */
export function supportsNativeFullscreen(): boolean {
  return typeof desktopBridge()?.setFullscreen === 'function';
}

/** Quit through the Electron bridge — a no-op outside the shell. */
export function quitApp(): void {
  void desktopBridge()?.quitApp?.();
}

/** Native window fullscreen — a no-op outside the shell. */
export function setNativeFullscreen(value: boolean): void {
  void desktopBridge()?.setFullscreen?.(value);
}

/**
 * Linux platform — the Steam Deck AppImage ships on it. Used to anchor the
 * HANDHELD-viewport console-first heuristic: a small-screen WINDOWS laptop
 * running the desktop shell must NOT be mistaken for a Deck, while the Deck
 * (SteamOS = Linux, 1280×800 fullscreen) must boot console-first even when
 * Chromium hides the pad pre-input / Steam Input emulates a mouse.
 */
export function isLinuxPlatform(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  const ua = navigator.userAgent;
  return /\bLinux\b/.test(ua) && !/\bAndroid\b/.test(ua);
}

/**
 * Is a REAL gamepad already connected right now? Used by the Electron
 * bootstrap (launching with a pad in hand → console mode immediately, no
 * prompt) and by the pre-game shell's initial-focus pass. `getGamepads()`
 * can hold null slots and, pre-interaction, some browsers return an empty
 * list — both read as "not detected" (the `gamepadconnected` path catches
 * a later wake-up).
 */
export function initialGamepadDetected(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
    return false;
  }
  try {
    for (const pad of navigator.getGamepads()) {
      if (pad !== null && pad.connected) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}
