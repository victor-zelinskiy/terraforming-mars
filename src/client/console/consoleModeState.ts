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
  }
  try {
    storage()?.setItem(STORAGE_KEY, on ? '1' : '0');
  } catch (err) {
    // Private mode — the in-session value still applies.
  }
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
