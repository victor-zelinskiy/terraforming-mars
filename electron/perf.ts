// Electron 43 — performance / GPU tuning (main process).
//
// The desktop shell targets ONE known machine class (a Windows box with a GPU),
// running a FULLSCREEN game, so we tune aggressively for smoothness — but WITHOUT
// removing the software fallback by default (that stays env-gated), so a GPU-less
// or driver-broken machine still boots. These switches affect the ELECTRON client
// ONLY; the browser build is untouched.
//
// The trace (PERFORMANCE_AUDIT.md) showed the remaining cost is rendering/
// compositing (Paint / Commit / Layerize / GPUTask), so the highest-value lever is
// making Chromium push as much of that to the GPU as possible: GPU rasterization,
// zero-copy texture upload, accelerated 2D canvas, and never throttling the
// renderer while the game is briefly occluded / unfocused.
//
// Switches MUST be appended BEFORE app 'ready'. Self-contained: imports only the
// electron types.

import type {App} from 'electron';

/**
 * Append the GPU / no-throttle command-line switches. Call once, before 'ready'.
 * Env opt-ins (off by default) for the two aggressive-but-risky flags.
 */
export function applyPerformanceSwitches(app: App): void {
  const sw = (key: string, value?: string): void => {
    if (value === undefined) {
      app.commandLine.appendSwitch(key);
    } else {
      app.commandLine.appendSwitch(key, value);
    }
  };

  // ── GPU acceleration ──────────────────────────────────────────────────────
  // Applied on WINDOWS (the GPU works there), and on Linux ONLY when a GPU-test opt-in is set
  // (below). The Steam Deck DEFAULT is clean software rendering: measured on-device, under
  // XWayland Chromium can't create a usable GL/EGL context ("No suitable EGL configs found"),
  // so forcing the GPU just spawns a process that fails and falls back to software with extra
  // churn — it made the Deck WORSE, not better. Native Wayland is the only thing that might
  // actually enable it (opt-in below).
  const linuxGpuTest = process.platform === 'linux' &&
    ((process.env.TM_ELECTRON_OZONE ?? '').trim() !== '' ||
     (process.env.TM_ELECTRON_GL ?? '').trim() !== '');
  if (process.platform === 'win32' || linuxGpuTest) {
    sw('ignore-gpu-blocklist');         // use the GPU even if the driver is blocklisted
    sw('enable-gpu-rasterization');     // rasterize paint on the GPU (Paint/Commit/GPUTask)
    sw('enable-zero-copy');             // zero-copy texture upload
    sw('enable-accelerated-2d-canvas'); // GPU-accelerate 2D canvas (endgame chart)
    sw('force_high_performance_gpu');   // discrete GPU on dual-GPU laptops
  }

  // ── Steam Deck GPU experiments (Linux; opt-in, OFF by default) ────────────
  // The Deck runs under XWayland where EGL config selection fails. Running NATIVELY on Wayland
  // (gamescope IS Wayland) is the most likely fix — try TM_ELECTRON_OZONE=wayland first.
  // Optionally add a GL backend: TM_ELECTRON_GL=angle + TM_ELECTRON_ANGLE=vulkan|gl. A wrong
  // combo just falls back to software (check "gpu_compositing" in the GPU-status log line).
  if (process.platform === 'linux') {
    const ozone = (process.env.TM_ELECTRON_OZONE ?? '').trim().toLowerCase();
    if (ozone !== '') {
      sw('ozone-platform', ozone);
      sw('enable-features', 'UseOzonePlatform');
    }
    const gl = (process.env.TM_ELECTRON_GL ?? '').trim().toLowerCase();
    if (gl !== '') {
      sw('use-gl', gl);
    }
    const angleBackend = (process.env.TM_ELECTRON_ANGLE ?? '').trim().toLowerCase();
    if (angleBackend !== '') {
      sw('use-angle', angleBackend);
    }
  }

  // ── No renderer throttling (fullscreen game) ─────────────────────────────
  // A fullscreen game must stay at full rate when briefly occluded / unfocused
  // (Alt-Tab, an OS notification, a second monitor) — otherwise rAF-driven
  // animations (marker glides, delta chips, energy→heat) stutter on return.
  sw('disable-background-timer-throttling');
  sw('disable-renderer-backgrounding');
  sw('disable-backgrounding-occluded-windows');

  // ── Aggressive opt-ins (env-gated; off by default) ───────────────────────
  // Uncap the frame rate — smoother pointer/scroll, but more GPU/CPU + heat.
  if (process.env.TM_ELECTRON_UNCAP_FPS === '1') {
    sw('disable-frame-rate-limit');
  }
  // Force the GPU path with NO software rasterizer fallback. Squeezes the most
  // out of a known-good GPU, but a blank screen if GPU init ever fails — so it's
  // opt-in, never the default.
  if (process.env.TM_ELECTRON_FORCE_GPU === '1') {
    sw('disable-software-rasterizer');
  }
}

/**
 * Log the RESOLVED GPU feature status once, after 'ready', so it's easy to
 * confirm hardware acceleration is actually live (`gpu_compositing: 'enabled'`,
 * `webgl: 'enabled'`, `rasterization: 'enabled'`, …) rather than silently on the
 * software path. Cheap + one line; safe to always run.
 */
export function logGpuStatus(app: App): void {
  try {
    const status = app.getGPUFeatureStatus();
    // eslint-disable-next-line no-console
    console.log('[electron] GPU feature status:', JSON.stringify(status));
  } catch {
    // getGPUFeatureStatus can throw very early / on some platforms — ignore.
  }
}
