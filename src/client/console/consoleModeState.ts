/*
 * Console Mode state (CONSOLE_MODE_CONCEPT.md §13) — the runtime SHELL SPLIT
 * flag. When enabled, App.vue mounts <ConsoleShell> INSTEAD of <PlayerHome>:
 * same game brain (playerView, WaitingFor transport, module states), a
 * console-first TV shell.
 *
 * Flag ladder (mirrors the motion/gamepad systems): URL `?console=1|0` wins,
 * then localStorage `tm_console_mode`, default OFF. `?console=0` doubles as
 * the session kill switch. Entry is CONSENTED: the first gamepad input while
 * in desktop mode raises a premium prompt (A = switch) instead of silently
 * swapping the layout.
 */

import {reactive} from 'vue';

const STORAGE_KEY = 'tm_console_mode';

function storage(): Storage | undefined {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined;
  } catch (err) {
    return undefined;
  }
}

function initialEnabled(): boolean {
  const search = typeof window !== 'undefined' ? window.location.search : '';
  const fromUrl = /[?&]console=([01])/.exec(search)?.[1];
  if (fromUrl !== undefined) {
    return fromUrl === '1';
  }
  return storage()?.getItem(STORAGE_KEY) === '1';
}

/**
 * The player explicitly turned console mode OFF — the Electron auto-enable
 * heuristics must never force it back. Two explicit signals: the session
 * kill switch `?console=0` (wins for this page load) and a stored '0'
 * (hold-Menu → off / a declined entry prompt persisted the choice).
 */
export function consoleModeExplicitlyDisabled(): boolean {
  const search = typeof window !== 'undefined' ? window.location.search : '';
  if (/[?&]console=0(?:&|$)/.test(search)) {
    return true;
  }
  try {
    return storage()?.getItem(STORAGE_KEY) === '0';
  } catch {
    return false;
  }
}

export const consoleModeState = reactive({
  enabled: initialEnabled(),
  /** The consented-entry prompt («Перейти в режим контроллера?»). */
  entryPromptVisible: false,
  /** Dismissed this session — don't re-offer on every pad input. */
  entryPromptDismissed: false,
});

export function setConsoleMode(on: boolean): void {
  consoleModeState.enabled = on;
  consoleModeState.entryPromptVisible = false;
  if (on) {
    consoleModeState.entryPromptDismissed = false;
    requestConsoleFullscreen();
  } else {
    exitConsoleFullscreen();
  }
  try {
    storage()?.setItem(STORAGE_KEY, on ? '1' : '0');
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
  if (typeof document === 'undefined' || document.fullscreenElement !== null) {
    return;
  }
  const root = document.documentElement;
  if (typeof root.requestFullscreen !== 'function') {
    return;
  }
  root.requestFullscreen({navigationUI: 'hide'}).catch(() => retryOnTrustedGesture());
}

function exitConsoleFullscreen(): void {
  if (typeof document === 'undefined' || document.fullscreenElement === null) {
    return;
  }
  document.exitFullscreen().catch(() => {
    // Nothing to do — the player can leave with Esc/F11.
  });
}

/** First gamepad activity in desktop mode → offer the switch (once per session). */
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
