// Electron 43 (Chromium ~150) — performance / GPU tuning (main process).
//
// The desktop shell targets ONE known machine class per platform — a Windows box
// with a GPU (fullscreen game) and the Steam Deck (software compositor under
// gamescope) — so the tuned configuration is the DEFAULT, not an env matrix.
// The old per-knob "flag zoo" (TM_ELECTRON_GPU / _ANGLE / _GL / _OZONE /
// _UNCAP_FPS / _FORCE_GPU / _JS_FLAGS / _RASTER_THREADS / _KEEP_GPU) is gone;
// exactly THREE escape hatches remain:
//
//   TM_ELECTRON_NO_PERF=1     — vanilla Electron, NOTHING below is applied (the
//                               baseline for any "is it our tuning?" comparison).
//   TM_ELECTRON_FEATURES=...  — REPLACES the default --enable-features list
//                               ("none"/"off" → no list at all). This is the
//                               Graphite / waitable-swap-chain rollback.
//   TM_ELECTRON_SWITCHES=...  — semicolon-separated raw Chromium switches
//                               ("key" or "key=value"), appended LAST so they
//                               override any same-key default. Covers every
//                               retired knob, e.g.:
//                                 "disable-direct-composition"
//                                 "use-angle=d3d9"
//                                 "js-flags=--max-old-space-size=1024"
//                                 "ozone-platform=wayland;use-angle=vulkan"
//                                 "disable-frame-rate-limit;disable-gpu-vsync"
//
// Switches MUST be appended BEFORE app 'ready'. Self-contained: imports only the
// electron types. Verify what actually took effect via the renderer-console
// "[TM perf]" echo (main.ts) or chrome://gpu.

import type {App} from 'electron';

/** One parsed `--key[=value]` token from TM_ELECTRON_SWITCHES. */
export interface ExtraSwitch {
  key: string;
  value?: string;
}

/**
 * Parse the TM_ELECTRON_SWITCHES escape hatch: semicolon-separated Chromium
 * switches, each `key` or `key=value`. The value may itself contain `=`
 * (js-flags=--max-old-space-size=1024) — only the FIRST `=` splits. A leading
 * `--` is tolerated; blank segments are skipped. Pure (unit-tested).
 */
export function parseExtraSwitches(raw: string): ExtraSwitch[] {
  const out: ExtraSwitch[] = [];
  for (const segment of raw.split(';')) {
    const token = segment.trim().replace(/^--/, '');
    if (token === '') {
      continue;
    }
    const eq = token.indexOf('=');
    if (eq === -1) {
      out.push({key: token});
    } else {
      out.push({key: token.slice(0, eq).trim(), value: token.slice(eq + 1).trim()});
    }
  }
  return out;
}

// The default --enable-features list on the Windows GPU path:
//  - SkiaGraphite + SkiaGraphitePrecompilation — the proven big win on this app:
//    Chrome's next-gen multi-threaded rasterizer (Dawn/D3D11) manages the
//    layer-heavy premium UI far better than Ganesh/GL under DirectComposition,
//    plus up-front pipeline compilation against the first-use shader stutter.
//  - DXGIWaitableSwapChain (MaxQueuedFrames=2) — waitable root swap chain: the
//    compositor waits for DWM readiness instead of blind-queueing Presents, the
//    canonical DXGI 1.3 frame-pacing/latency mechanism for games. Targets the
//    "low-FPS app on a 120–165 Hz hybrid box" pacing wobble. 2 = the feature's
//    own default: bounded queue with one frame of slack (resilient to per-frame
//    cost spikes during deal cinematics); drop to /1 via TM_ELECTRON_FEATURES
//    if input latency ever matters more than spike tolerance.
//    NOTE: mutually exclusive with a `disable-direct-composition` experiment —
//    that switch tears down the DComp/DXGI presentation path this feature tunes.
//    DISABLED_BY_DEFAULT in Chromium ~150 (verified ui/gl/gl_switches.cc).
const WINDOWS_ENABLED_FEATURES = [
  'SkiaGraphite',
  'SkiaGraphitePrecompilation',
  'DXGIWaitableSwapChain:DXGIWaitableSwapChainMaxQueuedFrames/2',
].join(',');

// Features disabled on EVERY platform (unknown names are silently ignored, so
// the Windows-only entries are safe no-ops on Linux). A single list applied in
// ONE appendSwitch call — appendSwitch REPLACES same-key values, so building
// the list here (not appending twice) is load-bearing.
//  - CalculateNativeWinOcclusion — Windows native occlusion tracker; Chromium's
//    own embedder-dev guidance says to turn it off for embedded Chromium. When
//    it decides the window is occluded the renderer is treated as background
//    (freeze/throttle bug class: RDP, lock screen, monitor switches). Our
//    no-throttle switches cover the CONSEQUENCES; this kills the tracker itself.
//  - OverscrollHistoryNavigation — a touchpad back-swipe would history.back()
//    (same-origin → navGuard allows it) = accidental game-boundary reload
//    mid-game. A game shell has no history UX; off.
//  - BackForwardCache — the game-boundary full reload must not keep the
//    previous heavy game document (module singletons, decoded atlases) alive
//    in a hidden cache; pure memory win for a kiosk-style app.
//  - IntensiveWakeUpThrottling — belt-and-suspenders next to the no-throttle
//    switches: never quantize this app's timers to 1/min.
//  - MediaRouter / DialMediaRouteProvider — Cast/DIAL discovery (periodic mDNS).
//  - OptimizationHints — Chrome's optimization-guide fetch/eval.
//  - Translate — page-translation machinery.
//  - HardwareMediaKeyHandling — don't grab OS media keys (they keep controlling
//    the user's music player instead of a game with no media UI).
//  - SpareRendererForSitePerProcess — a pre-warmed SPARE renderer process is
//    pure waste for a single-window app (a whole process competing for cores).
const DISABLED_FEATURES = [
  'CalculateNativeWinOcclusion',
  'OverscrollHistoryNavigation',
  'BackForwardCache',
  'IntensiveWakeUpThrottling',
  'MediaRouter',
  'DialMediaRouteProvider',
  'OptimizationHints',
  'Translate',
  'HardwareMediaKeyHandling',
  'SpareRendererForSitePerProcess',
];

/**
 * Append the tuned command-line switches. Call once, before 'ready'. Returns
 * the applied switches as `--key[=value]` strings (echoed into the renderer
 * console by main.ts so a packaged build can confirm what took effect).
 */
export function applyPerformanceSwitches(app: App): string[] {
  // DIAGNOSTIC kill-switch: TM_ELECTRON_NO_PERF=1 skips ALL of our tuning, so a run can be
  // compared against the vanilla-Electron GPU path. If the GPU falls back to software ONLY with
  // our switches on (e.g. a flag crashes the GPU process on this driver), this run isolates that.
  if (process.env.TM_ELECTRON_NO_PERF === '1') {
    return [];
  }

  const applied: string[] = [];
  const sw = (key: string, value?: string): void => {
    if (value === undefined) {
      app.commandLine.appendSwitch(key);
      applied.push(`--${key}`);
    } else {
      app.commandLine.appendSwitch(key, value);
      applied.push(`--${key}=${value}`);
    }
  };

  const extras = parseExtraSwitches(process.env.TM_ELECTRON_SWITCHES ?? '');

  // A Linux GPU experiment is declared by passing a GL/display switch through
  // TM_ELECTRON_SWITCHES (e.g. "ozone-platform=wayland;use-angle=vulkan" — the
  // documented Steam Deck native-Wayland/Vulkan ladder). Then we must NOT apply
  // --disable-gpu, and the GPU switch block applies instead.
  const linuxGpuTest = process.platform === 'linux' &&
    extras.some((s) => s.key === 'ozone-platform' || s.key === 'use-gl' || s.key === 'use-angle');

  // ── GPU path (Windows default; Linux only under an explicit experiment) ──
  // The Steam Deck DEFAULT stays clean software rendering: measured on-device,
  // under XWayland Chromium can't create a usable GL/EGL context, so forcing
  // the GPU just spawns a process that fails and falls back to software with
  // extra churn. Native Wayland (via TM_ELECTRON_SWITCHES) is the only thing
  // that might enable it.
  if (process.platform === 'win32' || linuxGpuTest) {
    sw('ignore-gpu-blocklist');         // use the GPU even if the driver is blocklisted
    sw('enable-gpu-rasterization');     // rasterize paint on the GPU (Paint/Commit/GPUTask)
    sw('enable-zero-copy');             // zero-copy texture upload
    sw('enable-accelerated-2d-canvas'); // GPU-accelerate 2D canvas (endgame chart)
    // Discrete GPU preference. NOTE (measured on the target hybrid laptop): this
    // Chromium preference does NOT override a Windows/driver-level GPU forcing —
    // the RELIABLE per-exe selector is Windows Settings → Display → Graphics.
    // Kept because on machines without an OS-level override it picks the right
    // card for a game, and it's harmless when the OS decides anyway.
    sw('force_high_performance_gpu');
    // Raise cc's GPU memory budget: overlays mount 250-350 composited layers and
    // the board is a huge layer at 3200×2000 — a conservative budget evicts and
    // re-rasterizes tiles on every overlay open/close. Cheap on the known 8 GB
    // dGPU / UMA iGPU targets.
    sw('force-gpu-mem-available-mb', '4096');
    // The GPU dump showed the `exit_on_context_lost` workaround: a D3D context
    // loss (monitor hotplug / dock / driver reset) exits the GPU process. By
    // default Chromium PERMANENTLY falls back to software after a few such
    // crashes; a long-lived fullscreen session should keep recovering instead.
    sw('disable-gpu-process-crash-limit');
  }

  // Linux / Steam Deck DEFAULT: skip the GPU entirely (see above) and give the
  // SOFTWARE rasterizer explicit worker threads so tile raster runs in parallel
  // across the Deck's 4 physical cores — the single biggest smoothness lever
  // once the GPU is off. (Previously env-tunable; 4 measured best on-device.)
  if (process.platform === 'linux' && !linuxGpuTest) {
    sw('disable-gpu');
    sw('num-raster-threads', '4');
  }

  // ── Feature lists (ONE call each — appendSwitch replaces same-key values) ─
  const featuresRaw = (process.env.TM_ELECTRON_FEATURES ?? '').trim();
  let features: string;
  if (featuresRaw === '') {
    features = process.platform === 'win32' ? WINDOWS_ENABLED_FEATURES : '';
  } else if (featuresRaw.toLowerCase() === 'none' || featuresRaw.toLowerCase() === 'off') {
    features = '';
  } else {
    features = featuresRaw;
  }
  if (features !== '') {
    sw('enable-features', features);
  }
  sw('disable-features', DISABLED_FEATURES.join(','));

  // Graphite is PINNED to Dawn's D3D11 backend — the MEASURED winner on the
  // target box (2026-07-14 A/B: d3d12 ran WORSE than d3d11; stock Chrome's
  // Windows bring-up is also primarily tested on D3D11). Pinned explicitly
  // rather than left to Chromium's default because upstream is preparing to
  // flip the Windows default toward D3D12 — a future Electron major must not
  // silently move us off the known-good backend. Re-test D3D12 on a new
  // Electron/driver without a rebuild:
  //   TM_ELECTRON_SWITCHES="skia-graphite-dawn-backend=d3d12"
  // (With Graphite off entirely — TM_ELECTRON_FEATURES=none — this is inert.
  // Windows-only: the Linux/Deck Graphite experiment targets Vulkan instead.)
  if (process.platform === 'win32') {
    sw('skia-graphite-dawn-backend', 'd3d11');
  }

  // ── No renderer throttling (fullscreen game) ─────────────────────────────
  // A fullscreen game must stay at full rate when briefly occluded / unfocused
  // (Alt-Tab, an OS notification, a second monitor) — otherwise rAF-driven
  // animations (marker glides, delta chips, energy→heat) stutter on return.
  sw('disable-background-timer-throttling');
  sw('disable-renderer-backgrounding');
  sw('disable-backgrounding-occluded-windows');

  // ── Trim background work (both platforms now) ─────────────────────────────
  // A local, self-hosted game client needs NONE of Chromium's background network
  // services — safe-browsing list updates, component updater, domain reliability
  // beacons, field-trial fetches. They wake the CPU for nothing and add timer
  // jitter. Our OWN API/WS traffic + the updater are UNAFFECTED — those are
  // explicit app requests, not Chromium "background networking".
  sw('disable-background-networking');

  // ── Input path ────────────────────────────────────────────────────────────
  // The IPC flooding protection quantizes dense input bursts — built against
  // hostile web pages, pointless for trusted content, and the console mode
  // synthesizes dense gamepad→nav/scroll event streams.
  sw('disable-ipc-flooding-protection');
  // No accessibility-tree consumer exists for a personal game shell, but any
  // external probe (Narrator, TabTip, some AV/overlay tools) can flip the
  // renderer into a11y mode — building the tree over hundreds of card nodes is
  // a periodic main-thread jank source that looks like "random freezes".
  sw('disable-renderer-accessibility');

  // ── Raster / color consistency ────────────────────────────────────────────
  // The game art is authored sRGB; on wide-gamut/HDR laptop panels Chromium's
  // color management adds per-frame conversion and can pick costlier surface
  // formats. Forcing sRGB removes that tax and renders identically everywhere.
  // (If colors ever look subtly duller than intended on a wide-gamut panel,
  // this is the switch to revisit — override via TM_ELECTRON_SWITCHES.)
  sw('force-color-profile', 'srgb');

  // ── V8: calmer young-generation GC ───────────────────────────────────────
  // Mount bursts (50-card overlays, deal cinematics) churn short-lived objects;
  // a 64 MB semi-space cuts minor-GC frequency ~4× during them. This was the
  // Steam Deck wrapper's measured tuning — now the built-in default on both
  // platforms (the wrapper's TM_ELECTRON_JS_FLAGS export is obsolete/inert).
  sw('js-flags', '--max-semi-space-size=64');

  // ── TM_ELECTRON_SWITCHES escape hatch — LAST, so same-key extras override ─
  for (const extra of extras) {
    sw(extra.key, extra.value);
  }

  return applied;
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
