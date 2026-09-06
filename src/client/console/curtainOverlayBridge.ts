/*
 * CURTAIN OVERLAY BRIDGE — the renderer side of the Electron overlay curtain.
 *
 * The overlay is a persistent WebContentsView the MAIN process holds above the
 * game's webContents (electron/curtainOverlay.ts). It renders the very same
 * `.con-load` composition out of the same styles.css, in its OWN renderer
 * process — so its orbital sweep keeps animating while the game document tears
 * down, reloads and parses. The in-page curtains stay the source of truth (and
 * the only curtain outside Electron / on older shells); the overlay merely owns
 * the PIXELS for the boundary window between `navigateWithCurtain` and the next
 * page's reveal.
 *
 * Transport only — no policy here. The director (loadingScreenState.ts) builds
 * the full render recipe (`CurtainOverlayPayload`) and decides when to show and
 * when to hide; this module feature-detects the preload bridge and forwards.
 */

export type CurtainOverlayPayload = {
  /** The original press timestamp — the wall-clock anchor of the text policy. */
  t0: number;
  /** Display profile + scale, so the overlay composes at identical geometry. */
  profile: string;
  uiScale: number;
  /** Orbit period (wall-clock phase: `-(now % orbitMs)` — see ORBIT_MS). */
  orbitMs: number;
  /** Pulse-bar period, motion-scaled by the sender. */
  pulseMs: number;
  /** Absolute wall-clock thresholds of the text policy. */
  textAppearAtMs: number;
  longWaitAtMs: number;
  /** Pre-translated copy — the overlay page has no i18n runtime. */
  kicker: string;
  title: string;
  status: string;
  statusLong: string;
};

type CurtainBridge = {
  curtainShow(payload: CurtainOverlayPayload): Promise<unknown>;
  curtainHide(): Promise<unknown>;
};

function bridge(): CurtainBridge | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  const b = (window as {desktopBridge?: Partial<CurtainBridge>}).desktopBridge;
  // Feature-detect BOTH methods — an older shell exposes neither.
  if (typeof b?.curtainShow === 'function' && typeof b?.curtainHide === 'function') {
    return b as CurtainBridge;
  }
  return undefined;
}

export function curtainOverlayAvailable(): boolean {
  return bridge() !== undefined;
}

/** Resolves once the overlay reports its state PAINTED (or rejects on IPC
 *  failure) — the caller bounds the wait; never let this gate a navigation. */
export function showCurtainOverlay(payload: CurtainOverlayPayload): Promise<void> {
  const b = bridge();
  if (b === undefined) {
    return Promise.resolve();
  }
  return b.curtainShow(payload).then(() => undefined);
}

/** Fire-and-forget: the overlay drops instantly (identical pixels stand
 *  beneath). Safe to call when nothing is shown — idempotent on the main side. */
export function hideCurtainOverlay(): void {
  void bridge()?.curtainHide().catch(() => {
    // The window/IPC is going away — the main-side watchdogs cover it.
  });
}
