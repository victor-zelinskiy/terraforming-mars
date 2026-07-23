/**
 * @console-shared LIVE — the console cinematics (card deal / FLIP directors)
 * run on GSAP, and this bridge lets the player's Animation-rate preference
 * actually reach them. Not covered by the desktop-UI deprecation.
 *
 * Bridge the motion FPS cap (motionTokens `motionFpsCap`) onto GSAP's GLOBAL
 * ticker. `motionFpsCap` natively only throttles `createFrameGate`-based rAF
 * loops (marker glides, count-ups) — but the HEAVY animations the player feels
 * (card deals, overlay-open FLIP handoffs) run on GSAP tweens, paced by GSAP's
 * OWN ticker: by default one tick per rAF, i.e. ~160/sec on a 160 Hz panel —
 * 160 sets of tween math + style writes per second. On a CPU-bound main thread
 * (a hybrid laptop under a light GPU load) that per-second cost is the dominant
 * animation load, so letting the player cap it (Options → «Плавность анимаций»)
 * is the app-side CPU lever paired with the electron process-priority raise.
 *
 * 'auto' leaves GSAP at native rAF (240 ≈ uncapped for any real display), so the
 * default is byte-identical to today; 60 / 30 halve or quarter the tween-math
 * rate. gsap is DYNAMICALLY imported so this stays out of the initial bundle
 * when the cap is 'auto' at boot (the directors pull gsap in their own async
 * chunks); it degrades to a no-op under JSDOM/tests where gsap isn't present.
 */
import {motionFpsCap, type MotionFpsCap} from './motionTokens';

// Above any real display refresh → GSAP runs every rAF (its native default).
const AUTO_TICKER_FPS = 240;

/**
 * Apply the FPS cap to GSAP's global ticker. Call at bootstrap and whenever the
 * player changes the Animation-rate setting. Fire-and-forget (async import).
 */
export function applyGsapTickerFps(cap: MotionFpsCap = motionFpsCap()): void {
  const fps = cap === 'auto' ? AUTO_TICKER_FPS : cap;
  void import('gsap')
    .then(({gsap}) => gsap.ticker.fps(fps))
    .catch(() => {/* gsap unavailable (SSR / unit tests) — no-op */});
}
