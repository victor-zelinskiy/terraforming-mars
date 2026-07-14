// Electron 43 (Chromium ~150) — performance / GPU tuning (main process).
//
// The desktop shell targets ONE known machine class per platform — a Windows box
// with a GPU (fullscreen game on the LG C3 TV) and the Steam Deck (RDNA2 APU
// under gamescope) — so the tuned configuration is the DEFAULT, not an env
// matrix. The old per-knob "flag zoo" is gone; exactly FOUR escape hatches:
//
//   TM_ELECTRON_NO_PERF=1     — vanilla Electron, NOTHING below is applied (the
//                               baseline for any "is it our tuning?" comparison).
//   TM_ELECTRON_SOFTWARE=1    — force the SOFTWARE rendering path (--disable-gpu
//                               + parallel raster threads). The rollback if the
//                               Steam Deck's GPU/Vulkan default misbehaves
//                               (measured-good software path); also a Windows
//                               diagnostic to isolate a GPU-path problem.
//   TM_ELECTRON_FEATURES=...  — REPLACES the default --enable-features list
//                               ("none"/"off" → no list at all). This is the
//                               Graphite / waitable-swap-chain rollback.
//   TM_ELECTRON_SWITCHES=...  — semicolon-separated raw Chromium switches
//                               ("key" or "key=value"), appended LAST so they
//                               override any same-key default. Covers every
//                               retired knob, e.g.:
//                                 "disable-direct-composition"
//                                 "skia-graphite-dawn-backend=d3d12"
//                                 "js-flags=--max-old-space-size=1024"
//                                 "ozone-platform=wayland"
//                                 "disable-frame-rate-limit;disable-gpu-vsync"
//
// Switches MUST be appended BEFORE app 'ready'. Self-contained: imports only the
// electron types. Verify what actually took effect via the renderer-console
// "[TM perf]" echo (main.ts), chrome://gpu, or (Deck) the wrapper's log file —
// logGpuStatus prints the same status to main-process stdout.

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
//  - DXGISwapChainPresentInterval0 — Present with interval 0 (tearing-allowed):
//    on a VRR display (the TARGET: LG C3 42" OLED over HDMI, G-Sync Compatible
//    40–120 Hz; the laptop's internal 120–165 Hz panel is likely G-Sync too) a
//    finished frame is scanned out IMMEDIATELY instead of waiting for the next
//    vsync tick — exactly our pathology (variable 9–14 ms animation frames on a
//    fixed 120 Hz cadence jitter between 8.3/16.7 ms). BeginFrames stay
//    vsync-paced (this is NOT an uncap — no extra heat); the uncap escalation
//    if pacing still wobbles: TM_ELECTRON_SWITCHES="disable-frame-rate-limit".
//    Needs the OS side armed (G-SYNC Compatible on for the display incl.
//    windowed mode, Windows VRR on, TV Game Optimizer/Instant Game Response).
//    RISK: on a VRR-off display in independent flip this can visibly TEAR —
//    if that shows on either panel, roll back via TM_ELECTRON_FEATURES.
const WINDOWS_ENABLED_FEATURES = [
  'SkiaGraphite',
  'SkiaGraphitePrecompilation',
  'DXGIWaitableSwapChain:DXGIWaitableSwapChainMaxQueuedFrames/2',
  'DXGISwapChainPresentInterval0',
].join(',');

// The --enable-features list for the Linux/Steam Deck GPU path — the FULL,
// research-grounded ANGLE-Vulkan recipe (the AMD/RADV known-good set), on
// X11/XWayland. The first Deck attempt logged `gl_surface_egl.cc: No suitable
// EGL configs found` and fell to software because the set was INCOMPLETE:
//  - Vulkan — Chromium's Vulkan backend for the display compositor
//    (SkiaRenderer-on-Vulkan): present via the Vulkan swapchain (gamescope's
//    WSI already accepts it) with NO GL/EGL surface. (kVulkan)
//  - DefaultANGLEVulkan — makes ANGLE DEFAULT to its Vulkan backend. THE piece
//    that was missing: `--use-angle=vulkan` alone didn't route ANGLE's EGL
//    config selection through Vulkan, so it tried native EGL (no configs under
//    XWayland) → the fatal fallback. (kDefaultANGLEVulkan, DISABLED_BY_DEFAULT.)
//  - VulkanFromANGLE — shares ONE Vulkan device/queue between Chromium's
//    compositor and ANGLE, so they don't init two conflicting devices.
//    (kVulkanFromANGLE, DISABLED_BY_DEFAULT.)
//  - SkiaGraphite + SkiaGraphitePrecompilation — Graphite on Dawn/Vulkan (RADV).
// STAY ON X11/XWayland — Vulkan is INCOMPATIBLE with `--ozone-platform=wayland`
// (Chromium: "Vulkan is not compatible with the Wayland platform"), so native
// Wayland is NOT the lever here; it would force GL and drop Vulkan/Graphite.
// The D3D presentation features (waitable swap chain / present interval) are
// Windows-only concepts — under gamescope, frame pacing belongs to gamescope.
const LINUX_ENABLED_FEATURES = [
  'Vulkan',
  'DefaultANGLEVulkan',
  'VulkanFromANGLE',
  'SkiaGraphite',
  'SkiaGraphitePrecompilation',
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
//  - OverscrollHistoryNavigation — a touchpad/touchscreen back-swipe would
//    history.back() (same-origin → navGuard allows it) = accidental
//    game-boundary reload mid-game. A game shell has no history UX; off.
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
  const forceSoftware = process.env.TM_ELECTRON_SOFTWARE === '1';
  // BOTH Windows and the Steam Deck default to the GPU path. The Deck's recipe
  // is the full ANGLE-Vulkan set (LINUX_ENABLED_FEATURES) on X11/XWayland — the
  // earlier software-fallback was a missing-flags bug (DefaultANGLEVulkan /
  // VulkanFromANGLE), not a platform limit. TM_ELECTRON_SOFTWARE=1 forces the
  // software path (the graceful rollback if the GPU recipe ever misbehaves).
  const useGpu = !forceSoftware &&
    (process.platform === 'win32' || process.platform === 'linux');

  if (useGpu) {
    // ── GPU path ──────────────────────────────────────────────────────────
    sw('ignore-gpu-blocklist');         // use the GPU even if the driver is blocklisted
    sw('enable-gpu-rasterization');     // rasterize paint on the GPU (Paint/Commit/GPUTask)
    sw('enable-zero-copy');             // zero-copy texture upload
    sw('enable-accelerated-2d-canvas'); // GPU-accelerate 2D canvas (endgame chart)
    // Raise cc's GPU memory budget: overlays mount 250-350 composited layers and
    // the board is a huge layer at 4K — a conservative budget evicts and
    // re-rasterizes tiles on every overlay open/close. Cheap on the known 8 GB
    // dGPU / UMA targets (Deck: 16 GB shared).
    sw('force-gpu-mem-available-mb', '4096');
    // A GPU context loss (monitor hotplug / dock / driver reset / gamescope
    // restart) exits the GPU process. By default Chromium PERMANENTLY falls
    // back to software after a few such crashes; a long-lived fullscreen
    // session should keep recovering instead.
    sw('disable-gpu-process-crash-limit');
    if (process.platform === 'win32') {
      // Discrete GPU preference. NOTE (measured on the target hybrid laptop):
      // this Chromium preference does NOT override a Windows/driver-level GPU
      // forcing — the RELIABLE per-exe selector is Windows Settings → Display →
      // Graphics. Kept because on machines without an OS-level override it
      // picks the right card for a game, and it's harmless otherwise.
      sw('force_high_performance_gpu');
    }
    if (process.platform === 'linux') {
      // The ANGLE-Vulkan switch pair (paired with the DefaultANGLEVulkan /
      // VulkanFromANGLE features above): route GL through ANGLE, ANGLE through
      // Vulkan. Together they make ANGLE's EGL config selection use Vulkan
      // instead of the native EGL path that has no configs under XWayland.
      sw('use-gl', 'angle');
      sw('use-angle', 'vulkan');
    }
  } else if (forceSoftware) {
    // ── Software path (TM_ELECTRON_SOFTWARE=1 — the rollback) ───────────────
    // A clean software compositor, skipping the GPU process entirely, with the
    // software rasterizer given explicit worker threads so tile raster runs in
    // parallel (4 = the Deck's physical cores; measured best on-device).
    sw('disable-gpu');
    sw('num-raster-threads', '4');
  }

  // ── Feature lists (ONE call each — appendSwitch replaces same-key values) ─
  const featuresRaw = (process.env.TM_ELECTRON_FEATURES ?? '').trim();
  let features: string;
  if (featuresRaw === '') {
    if (!useGpu) {
      features = ''; // Graphite is meaningless without the GPU process
    } else if (process.platform === 'win32') {
      features = WINDOWS_ENABLED_FEATURES;
    } else if (process.platform === 'linux') {
      features = LINUX_ENABLED_FEATURES;
    } else {
      features = '';
    }
  } else if (featuresRaw.toLowerCase() === 'none' || featuresRaw.toLowerCase() === 'off') {
    features = '';
  } else {
    features = featuresRaw;
  }
  if (features !== '') {
    sw('enable-features', features);
  }
  sw('disable-features', DISABLED_FEATURES.join(','));

  if (useGpu) {
    if (process.platform === 'win32') {
      // Graphite is PINNED to Dawn's D3D11 backend — the MEASURED winner on the
      // target box (2026-07-14 A/B: d3d12 ran WORSE than d3d11; stock Chrome's
      // Windows bring-up is also primarily tested on D3D11). Pinned explicitly
      // rather than left to Chromium's default because upstream is preparing to
      // flip the Windows default toward D3D12 — a future Electron major must not
      // silently move us off the known-good backend. Re-test D3D12 on a new
      // Electron/driver without a rebuild:
      //   TM_ELECTRON_SWITCHES="skia-graphite-dawn-backend=d3d12"
      sw('skia-graphite-dawn-backend', 'd3d11');
    } else if (process.platform === 'linux') {
      // Vulkan is the only sensible Dawn backend on Linux — pinned explicitly
      // for determinism and [TM perf] readability (mirrors the Windows pin).
      sw('skia-graphite-dawn-backend', 'vulkan');
    }
  }

  // ── No renderer throttling (fullscreen game) ─────────────────────────────
  // A fullscreen game must stay at full rate when briefly occluded / unfocused
  // (Alt-Tab, an OS notification, a second monitor) — otherwise rAF-driven
  // animations (marker glides, delta chips, energy→heat) stutter on return.
  sw('disable-background-timer-throttling');
  sw('disable-renderer-backgrounding');
  sw('disable-backgrounding-occluded-windows');

  // ── Trim background work (both platforms) ─────────────────────────────────
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
  // The game art is authored sRGB; on wide-gamut/HDR panels Chromium's color
  // management adds per-frame conversion and can pick costlier surface formats.
  // Forcing sRGB removes that tax and renders identically everywhere.
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
 * software path. Cheap + one line; safe to always run. On the Deck this lands
 * in the wrapper's log file (terraforming-mars-steam.log).
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
