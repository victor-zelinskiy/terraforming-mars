/**
 * @console-shared LIVE — console-native READING-TEXT SCALE.
 *
 * The couch magnifier for LONG-FORM reading text only (card rules, the
 * archive entry, prompt bodies that consume the reading tokens) — published
 * as the `--con-read-scale` custom property on `<html>`. Chrome, headers,
 * chips and numeric readouts deliberately do NOT ride it: the setting exists
 * for players who want the sentences bigger, not a zoomed UI.
 *
 * The DEFAULT (100%) must already be couch-comfortable — this is a personal
 * comfort dial on top of a correct baseline, never a fix for a bad one
 * (docs/CONSOLE_TV_PREMIUM_PLAN.md · the couch-typography iteration).
 *
 * Config: localStorage `tm_console_read_scale` → default 100.
 */
import {reactive} from 'vue';

const STORAGE_KEY = 'tm_console_read_scale';

export type ConsoleReadingScale = 100 | 115 | 130;
export const READING_SCALE_CHOICES: ReadonlyArray<ConsoleReadingScale> = [100, 115, 130];

function storage(): Storage | undefined {
  try {
    return (globalThis as {localStorage?: Storage}).localStorage;
  } catch (err) {
    return undefined;
  }
}

function readInitial(): ConsoleReadingScale {
  const raw = Number(storage()?.getItem(STORAGE_KEY));
  return (READING_SCALE_CHOICES as ReadonlyArray<number>).includes(raw) ?
    raw as ConsoleReadingScale : 100;
}

/** Reactive so the Options row + any surface reacts to a change. */
export const readingScaleState = reactive({scale: readInitial()});

/**
 * Write the `--con-read-scale` bridge onto `<html>` (inline style wins over
 * the stylesheet default of 1). Call once at bootstrap and after every
 * `setConsoleReadingScale`. No-op under SSR/tests.
 */
export function applyConsoleReadingScale(): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.documentElement.style.setProperty(
    '--con-read-scale', String(readingScaleState.scale / 100));
}

/** Persist + apply the reading-scale preference live. */
export function setConsoleReadingScale(scale: ConsoleReadingScale): void {
  readingScaleState.scale = scale;
  try {
    storage()?.setItem(STORAGE_KEY, String(scale));
  } catch (err) {
    // Private mode etc. — the in-session value still applies.
  }
  applyConsoleReadingScale();
}
