/*
 * BOOT WARM-UP state — a premium app-launch loading screen that also PRE-WARMS
 * the GPU rasterizer.
 *
 * WHY: on Windows the fork runs Skia Graphite (electron/perf.ts). Graphite
 * compiles a GPU pipeline the FIRST time it meets an effect (drop-shadow,
 * box-shadow, backdrop-filter, an animated transform, …). That first compile is
 * a synchronous hitch — the "first animation of the game lagged, the rest were
 * smooth" symptom. This screen renders a hidden scene exercising those exact
 * effects while a calm premium loader is shown, so the pipelines are already
 * compiled by the time the player reaches real gameplay.
 *
 * ONCE PER SESSION: the game boundary is a deliberate full reload, but
 * sessionStorage survives it, so the loader shows only on the FIRST launch of
 * the window/tab — never again on the in-game reloads. A fresh app launch (new
 * Electron window) starts a new session → shows once more.
 *
 * Module-level reactive — App reads `bootWarmupState.active`; the flag lives
 * here (not in App data) so it is independent of the playerkey remount.
 */

import {reactive} from 'vue';

const WARMUP_DONE_FLAG = 'tm_boot_warmup_done';

export const bootWarmupState = reactive({
  active: false,
});

/**
 * `?fastboot=1` — THE E2E BOOT (the e2e speed iteration, 2026-10-21): no warm-up phases, no curtain minima.
 * A functional e2e test is a fresh browser context every time, so the pipelines the warm-up compiles die
 * with it and the curtain's readable-dwell protects nobody — measured as ≈ 4.5 s of every 6 s boot, an
 * hour over the suite. Never the player's road (no setting, no persistence: the URL alone); the
 * storyboard / timing class does NOT pass it — the first-draw shader stall is what it measures (PL-625).
 */
export function fastBootRequested(): boolean {
  try {
    return typeof window !== 'undefined' && /[?&]fastboot=1(&|$)/.test(window.location.search);
  } catch {
    return false;
  }
}

/** True only the first time in this session (survives the game-boundary reload) — and never under `fastboot`. */
export function shouldRunBootWarmup(): boolean {
  if (fastBootRequested()) {
    return false;
  }
  try {
    return sessionStorage.getItem(WARMUP_DONE_FLAG) !== '1';
  } catch {
    // sessionStorage unavailable (private mode / Electron edge) — show it once, best effort.
    return true;
  }
}

export function beginBootWarmup(): void {
  bootWarmupState.active = true;
}

/** Mark done for the session + hide. Idempotent. */
export function finishBootWarmup(): void {
  bootWarmupState.active = false;
  try {
    sessionStorage.setItem(WARMUP_DONE_FLAG, '1');
  } catch {
    // ignore — worst case the loader shows again on the next reload this session.
  }
}
