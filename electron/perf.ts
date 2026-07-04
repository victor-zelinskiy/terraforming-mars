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
  // Use the GPU even if the driver is on Chromium's conservative blocklist
  // (frequent false-positives on Windows OEM / laptop drivers).
  sw('ignore-gpu-blocklist');
  // Rasterize paint on the GPU + upload textures zero-copy — directly targets the
  // Paint / Commit / GPUTask costs the trace flagged.
  sw('enable-gpu-rasterization');
  sw('enable-zero-copy');
  // GPU-accelerate 2D canvas (chart.js endgame chart, any canvas art).
  sw('enable-accelerated-2d-canvas');
  // On dual-GPU laptops, request the discrete GPU rather than the integrated one.
  sw('force_high_performance_gpu');

  // Linux GPU backend (Steam Deck / gamescope). On the Deck, Chromium can't create a NATIVE
  // GL context and renders in SOFTWARE. It DOES allow GL via ANGLE (gl=egl-angle), so the flag
  // to try is TM_ELECTRON_GL=angle, plus an ANGLE backend via TM_ELECTRON_ANGLE (vulkan is the
  // best fit — gamescope is Vulkan-native; else gl / default). Opt-in and DECOUPLED so combos
  // can be tested from the wrapper without reinstalls. ⚠ TM_ELECTRON_GL=egl (native EGL) is
  // NOT allowed here — it crash-loops the GPU process; use `angle`.
  const gl = (process.env.TM_ELECTRON_GL ?? '').trim().toLowerCase();
  if (gl !== '') {
    sw('use-gl', gl);
  }
  const angleBackend = (process.env.TM_ELECTRON_ANGLE ?? '').trim().toLowerCase();
  if (angleBackend !== '') {
    sw('use-angle', angleBackend);
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
