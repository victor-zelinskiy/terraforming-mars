/*
 * CONSOLE LAYOUT PROFILES — the Steam Deck / handheld iteration (P12)
 * + the TV-native iteration (TV-3: living-room 4K TVs).
 *
 * The console UI was composed for TV distance; a 1280×800 handheld
 * (Steam Deck through Electron fullscreen is the flagship target) needs a
 * RECOMPOSED presentation — tighter chrome, narrower side panels, smaller
 * card hero-zooms — NOT a global scale. This module only CLASSIFIES the
 * viewport; every visual decision lives in console.less / console_tv.less
 * under the `html.con-profile-<name>` classes (applied by GamepadLayer next
 * to `console-mode`), so desktop modern-premium-ui and the legacy UI are
 * structurally unreachable.
 *
 *  - handheld: Steam Deck–like small screens (≤860px tall or ≤1366 wide —
 *    covers 1280×800/720p handhelds and similar; deliberately NOT an
 *    exact-device sniff).
 *  - standard: the shipped console design, byte-identical (1080p desktop
 *    fullscreen / small TV) — the do-no-harm baseline.
 *  - large: big desktop monitors (1440p-class and ultrawide) — a gentle
 *    readability boost only.
 *  - tv: living-room TVs (flagship: LG OLED42C34LA — 42" 3840×2160 16:9,
 *    couch distance ~1.5–2m). A REAL 10-foot recomposition living in
 *    console_tv.less, built on a 1920×1080 LOGICAL layout space: the
 *    dynamic `--con-ui-scale` (min(vw/1920, vh/1080)) keeps the interface
 *    the SAME physical size on that panel no matter how the OS maps it —
 *    4K@100% (viewport 3840×2160, scale 2), 4K@150% (2560×1440, scale
 *    1.33), 4K@200% (1920×1080, scale 1). Auto-detection keys on the
 *    PHYSICAL panel (CSS screen size × devicePixelRatio): a 16:9 panel of
 *    4K class is a TV-class display for the console shell; a bare 1080p
 *    output (physical 1920×1080 — indistinguishable from a desktop
 *    monitor) is NOT auto-promoted — use the in-game System menu display
 *    picker (or `?consoleProfile=tv`) there.
 *
 * PROFILE SELECTION PRIORITY (highest wins):
 *  1. The user's explicit pick (System menu → Display; persisted to
 *     `tm_console_profile`, the same store the debug override uses).
 *  2. `?consoleProfile=handheld|standard|large|tv` URL override
 *     (persists; `?consoleProfile=auto` clears back to heuristics).
 *  3. The viewport/physical-panel heuristic (resolveProfile).
 *
 * The scale variable `--con-ui-scale` is owned HERE (syncDisplayCssVars) —
 * components/styles must consume it, never re-derive min(vw/1920,…)
 * locally. JS code that needs the scale reads `consoleLayoutState.uiScale`
 * (or the `conUiScale()` helper) — the two can never diverge.
 */

import {reactive} from 'vue';
import {desktopBridge} from '@/client/components/desktop/desktopUpdateState';

export type ConsoleLayoutProfile = 'handheld' | 'standard' | 'large' | 'tv';

const STORAGE_KEY = 'tm_console_profile';
const PROFILES: ReadonlyArray<ConsoleLayoutProfile> = ['handheld', 'standard', 'large', 'tv'];

/* ── TV logical layout space ──────────────────────────────────────────
 * The TV profile lays out in a 1920×1080 LOGICAL design space; the UI
 * scale maps it onto the real viewport uniformly (same factor for X and
 * Y — the extra 16:9 width is used by COMPOSITION, never by stretching).
 */
export const TV_LOGICAL_WIDTH = 1920;
export const TV_LOGICAL_HEIGHT = 1080;
/** Scale clamps. <1 happens whenever the OS maps the panel to a viewport
 * SMALLER than the 1920×1080 logical space (e.g. a 4K monitor at 300% OS
 * scale → viewport 1280×720 → scale 2/3) — the scale must follow honestly
 * or the logical layout physically cannot fit (the ROG overflow bug); the
 * floor is a technical zero-guard only. 2.5 covers anything up to
 * 5K-class panels without letting a mis-report explode. */
export const TV_SCALE_MIN = 0.4;
export const TV_SCALE_MAX = 2.5;

/* TV auto-detection thresholds (physical panel, not viewport):
 * - 4K-class height (≥2000 physical rows) — a 3840×2160 TV at ANY OS
 *   scale factor qualifies; 1440p desktop monitors (1440) and 3200×1800
 *   laptop panels (1800) deliberately do NOT.
 * - ~16:9 aspect (1.69–1.87; 16:9 = 1.778) — excludes 16:10 laptop/deck
 *   panels and ultrawides (those stay `large` when big enough). */
const TV_MIN_PHYSICAL_HEIGHT = 2000;
const TV_ASPECT_MIN = 1.69;
const TV_ASPECT_MAX = 1.87;
/** The window must essentially BE the screen (fullscreen / borderless) —
 * a small window dragged onto a TV keeps the desktop-friendly profiles. */
const TV_COVERAGE_MIN = 0.94;

/** Everything the classifier may consider beyond the raw viewport.
 * All optional — absent signals degrade to viewport-only classification. */
export type DisplaySignals = {
  /** window.devicePixelRatio (carries the OS scale factor in Electron). */
  devicePixelRatio?: number;
  /** window.screen.width/height (CSS px of the CURRENT screen). */
  screenWidth?: number;
  screenHeight?: number;
};

export type ProfileDecision = {
  profile: ConsoleLayoutProfile;
  /** Human-readable WHY — surfaced by the display diagnostics. */
  reason: string;
};

/** PURE viewport/panel classification (unit-tested). */
export function explainProfile(width: number, height: number, signals?: DisplaySignals): ProfileDecision {
  const dpr = signals?.devicePixelRatio !== undefined && signals.devicePixelRatio > 0 ? signals.devicePixelRatio : 1;
  const screenW = signals?.screenWidth !== undefined && signals.screenWidth > 0 ? signals.screenWidth : width;
  const screenH = signals?.screenHeight !== undefined && signals.screenHeight > 0 ? signals.screenHeight : height;
  const physicalW = Math.round(screenW * dpr);
  const physicalH = Math.round(screenH * dpr);
  const aspect = physicalH > 0 ? physicalW / physicalH : 0;
  const covers = width >= screenW * TV_COVERAGE_MIN && height >= screenH * (TV_COVERAGE_MIN - 0.04);
  // The PHYSICAL-panel check runs FIRST: a 4K-class 16:9 panel is a
  // TV-class display even when a high OS scale maps it to a SMALL viewport
  // (a 4K monitor at 300% → viewport 1280×720 — the tv logical space
  // scales down to fit). A real handheld (Steam Deck: physical 1280×800)
  // can never pass the physical-height gate, so the branches don't fight.
  if (physicalH >= TV_MIN_PHYSICAL_HEIGHT && aspect >= TV_ASPECT_MIN && aspect <= TV_ASPECT_MAX && covers) {
    return {
      profile: 'tv',
      reason: `tv: 4K-class 16:9 panel ${physicalW}×${physicalH} (viewport ${width}×${height}, dpr ${dpr})`,
    };
  }
  // Small screens are handhelds no matter what panel they physically are —
  // the compact recomposition wins on any tight budget.
  if (height <= 860 || width <= 1366) {
    return {profile: 'handheld', reason: `handheld: small viewport ${width}×${height}`};
  }
  if (width >= 2400) {
    return {profile: 'large', reason: `large: wide viewport ${width}×${height}`};
  }
  return {profile: 'standard', reason: `standard: baseline ${width}×${height}`};
}

/** PURE classification (kept as the stable API; unit-tested). */
export function resolveProfile(width: number, height: number, signals?: DisplaySignals): ConsoleLayoutProfile {
  return explainProfile(width, height, signals).profile;
}

/** The TV logical-space UI scale for a viewport (PURE, unit-tested).
 * min() keeps X/Y uniform — the interface never stretches anisotropically. */
export function computeTvUiScale(width: number, height: number): number {
  const raw = Math.min(width / TV_LOGICAL_WIDTH, height / TV_LOGICAL_HEIGHT);
  const clamped = Math.min(TV_SCALE_MAX, Math.max(TV_SCALE_MIN, raw));
  return Math.round(clamped * 10000) / 10000;
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
  /** True when the profile is FORCED (user pick / debug override) — the
   * auto heuristic stops re-classifying, but the UI SCALE keeps tracking
   * the live viewport (a forced tv profile in a resized window must not
   * keep a stale scale). */
  forced: false,
  /** The live TV logical-space scale (1 on every non-tv profile). */
  uiScale: 1,
  /** Why the current profile was chosen (diagnostics). */
  reason: 'standard: baseline',
});

function readSignals(): DisplaySignals {
  return {
    devicePixelRatio: window.devicePixelRatio,
    screenWidth: window.screen?.width,
    screenHeight: window.screen?.height,
  };
}

/** The authoritative Electron view of the panel (diagnostics only — the
 * heuristic runs on renderer signals so the web build behaves the same). */
let electronDisplay = '';
function fetchElectronDisplayInfo(): void {
  try {
    desktopBridge()?.getDisplayInfo?.()?.then((d) => {
      if (d !== undefined) {
        electronDisplay =
          `${d.physicalWidth}×${d.physicalHeight} @×${d.scaleFactor}` +
          `${d.internal ? ' internal' : ' external'}${d.fullscreen ? ' fullscreen' : ''}`;
      }
    }).catch(() => {});
  } catch {
    // web build / older shell — no Electron display info
  }
}

/** Push the display CSS variables the stylesheets consume. Owned here so
 * the LESS side and the JS side can never disagree about the scale. */
function syncDisplayCssVars(): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.documentElement.style.setProperty('--con-ui-scale', String(consoleLayoutState.uiScale));
}

function recompute(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (!consoleLayoutState.forced) {
    const decision = explainProfile(w, h, readSignals());
    consoleLayoutState.profile = decision.profile;
    consoleLayoutState.reason = decision.reason;
  }
  consoleLayoutState.uiScale = consoleLayoutState.profile === 'tv' ? computeTvUiScale(w, h) : 1;
  syncDisplayCssVars();
}

/** The current console UI scale for JS geometry (fit-engine ceilings,
 * scroll steps, animation offsets). 1 everywhere except the tv profile. */
export function conUiScale(): number {
  return consoleLayoutState.uiScale;
}

/**
 * Set (or clear) the persistent user profile pick — the System-menu
 * display picker rides this. Uses the SAME store as the debug override,
 * so `?consoleProfile=` and the picker can never fight.
 */
export function setConsoleProfileOverride(profile: ConsoleLayoutProfile | 'auto'): void {
  try {
    if (profile === 'auto') {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, profile);
    }
  } catch {
    // localStorage unavailable — the in-session override still applies.
  }
  if (profile === 'auto') {
    consoleLayoutState.forced = false;
  } else {
    consoleLayoutState.forced = true;
    consoleLayoutState.profile = profile;
    consoleLayoutState.reason = `override: user picked '${profile}'`;
  }
  if (typeof window !== 'undefined') {
    recompute();
    logDecision();
  }
}

/** The System-menu display picker cycles auto → handheld → standard →
 * large → tv → auto. 'auto' = heuristics own the choice again. */
export function currentProfileOverride(): ConsoleLayoutProfile | 'auto' {
  return consoleLayoutState.forced ? consoleLayoutState.profile : 'auto';
}

export function cycleConsoleProfileOverride(): ConsoleLayoutProfile | 'auto' {
  const ring: ReadonlyArray<ConsoleLayoutProfile | 'auto'> = ['auto', ...PROFILES];
  const next = ring[(ring.indexOf(currentProfileOverride()) + 1) % ring.length];
  setConsoleProfileOverride(next);
  return next;
}

/** One structured snapshot for the diagnostics surfaces (System menu /
 * gamepad debug HUD / console log). */
export function consoleDisplayDiagnostics() {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
  const screenW = typeof window !== 'undefined' ? (window.screen?.width ?? 0) : 0;
  const screenH = typeof window !== 'undefined' ? (window.screen?.height ?? 0) : 0;
  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 0;
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 0;
  let safeX = '';
  let safeY = '';
  if (typeof document !== 'undefined' && typeof getComputedStyle === 'function') {
    const cs = getComputedStyle(document.documentElement);
    safeX = cs.getPropertyValue('--con-safe-x').trim();
    safeY = cs.getPropertyValue('--con-safe-y').trim();
  }
  return {
    profile: consoleLayoutState.profile,
    forced: consoleLayoutState.forced,
    reason: consoleLayoutState.reason,
    viewport: `${viewportW}×${viewportH}`,
    screen: `${screenW}×${screenH}`,
    devicePixelRatio: dpr,
    physical: electronDisplay !== '' ? electronDisplay : `${Math.round(screenW * dpr)}×${Math.round(screenH * dpr)}`,
    uiScale: consoleLayoutState.uiScale,
    safeArea: safeX !== '' || safeY !== '' ? `${safeX} / ${safeY}` : '(profile default)',
  };
}

function logDecision(): void {
  try {
    const d = consoleDisplayDiagnostics();
    // One calm line per decision — the always-available diagnostic trail.
    console.info(
      `[console-display] profile=${d.profile}${d.forced ? ' (forced)' : ''} scale=${d.uiScale} ` +
      `viewport=${d.viewport} physical=${d.physical} dpr=${d.devicePixelRatio} — ${d.reason}`);
  } catch {
    // diagnostics must never break the app
  }
}

let installed = false;
let rafPending = false;

/** Idempotent bootstrap: read the override, else track the viewport.
 * Either way the UI scale keeps tracking resizes. */
export function installConsoleLayoutProfile(): void {
  if (installed || typeof window === 'undefined') {
    return;
  }
  installed = true;
  const override = readOverride();
  if (override !== undefined) {
    consoleLayoutState.profile = override;
    consoleLayoutState.forced = true;
    consoleLayoutState.reason = `override: '${override}' (tm_console_profile / ?consoleProfile=)`;
  }
  fetchElectronDisplayInfo();
  recompute();
  logDecision();
  window.addEventListener('resize', () => {
    if (rafPending) {
      return;
    }
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      const before = consoleLayoutState.profile;
      recompute();
      if (consoleLayoutState.profile !== before) {
        logDecision();
      }
    });
  });
}
