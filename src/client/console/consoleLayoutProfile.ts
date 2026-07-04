/*
 * CONSOLE LAYOUT PROFILES — the Steam Deck / handheld iteration (P12).
 *
 * The console UI was composed for TV distance; a 1280×800 handheld
 * (Steam Deck through Electron fullscreen is the flagship target) needs a
 * RECOMPOSED presentation — tighter chrome, narrower side panels, smaller
 * card hero-zooms — NOT a global scale. This module only CLASSIFIES the
 * viewport; every visual decision lives in console.less under the
 * `html.con-profile-<name>` classes (applied by GamepadLayer next to
 * `console-mode`), so desktop modern-premium-ui and the legacy UI are
 * structurally unreachable.
 *
 *  - handheld: Steam Deck–like small screens (≤860px tall or ≤1366 wide —
 *    covers 1280×800/720p handhelds and similar; deliberately NOT an
 *    exact-device sniff).
 *  - standard: the shipped console design, byte-identical (1080p desktop
 *    fullscreen / small TV) — the do-no-harm baseline.
 *  - large: big TV / 4K — a gentle readability boost only.
 *
 * DEBUG OVERRIDE (project style, like `?console=` / `tm_console_mode`):
 * `?consoleProfile=handheld|standard|large` (persisted to
 * `tm_console_profile`; `?consoleProfile=auto` clears it) — so the Steam
 * Deck layout is testable in any desktop browser window.
 */

import {reactive} from 'vue';

export type ConsoleLayoutProfile = 'handheld' | 'standard' | 'large';

const STORAGE_KEY = 'tm_console_profile';
const PROFILES: ReadonlyArray<ConsoleLayoutProfile> = ['handheld', 'standard', 'large'];

/** PURE viewport classification (unit-tested). */
export function resolveProfile(width: number, height: number): ConsoleLayoutProfile {
  if (height <= 860 || width <= 1366) {
    return 'handheld';
  }
  if (width >= 2400) {
    return 'large';
  }
  return 'standard';
}

function isProfile(v: string | null): v is ConsoleLayoutProfile {
  return v !== null && (PROFILES as ReadonlyArray<string>).includes(v);
}

/** The ?consoleProfile= / tm_console_profile override, if any. */
function readOverride(): ConsoleLayoutProfile | undefined {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('consoleProfile');
    if (fromUrl === 'auto') {
      window.localStorage.removeItem(STORAGE_KEY);
      return undefined;
    }
    if (isProfile(fromUrl)) {
      window.localStorage.setItem(STORAGE_KEY, fromUrl);
      return fromUrl;
    }
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isProfile(stored) ? stored : undefined;
  } catch {
    return undefined;
  }
}

export const consoleLayoutState = reactive({
  profile: 'standard' as ConsoleLayoutProfile,
  /** True when the profile is FORCED by the debug override (no auto-resize). */
  forced: false,
});

function applyFromViewport(): void {
  consoleLayoutState.profile = resolveProfile(window.innerWidth, window.innerHeight);
}

let installed = false;
let rafPending = false;

/** Idempotent bootstrap: read the override, else track the viewport. */
export function installConsoleLayoutProfile(): void {
  if (installed || typeof window === 'undefined') {
    return;
  }
  installed = true;
  const override = readOverride();
  if (override !== undefined) {
    consoleLayoutState.profile = override;
    consoleLayoutState.forced = true;
    return;
  }
  applyFromViewport();
  window.addEventListener('resize', () => {
    if (rafPending) {
      return;
    }
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      if (!consoleLayoutState.forced) {
        applyFromViewport();
      }
    });
  });
}
