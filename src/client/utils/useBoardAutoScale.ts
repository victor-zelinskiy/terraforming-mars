import {onMounted, onBeforeUnmount} from 'vue';

/**
 * Mars board auto-scale.
 *
 * Replaces the legacy hardcoded `--board-scale: 1.4` (`player_home.less`)
 * with a runtime calculation that fills the available central viewport
 * area between the left player panel and right sidebar (and the top /
 * bottom UI bars). Result is written to the `--board-scale` CSS
 * variable on `document.documentElement` so `.board-cont`'s existing
 * `transform: scale(var(--board-scale))` automatically picks it up.
 *
 * Why a CSS variable rather than per-element style: the whole board
 * subtree (hex tiles, outer-spaces, SVG legend, info markers, placement
 * overlay, bonus icons) is already inside `.board-cont` and inherits the
 * single transform. Writing one variable rescales the entire visual +
 * interactive layer with zero hitbox / coordinate drift — CSS transform
 * scales pointer-event geometry along with the paint.
 *
 * Reservation values come from the same CSS variables the chrome uses
 * (`--left-panel-width`, `--right-sidebar-width`, `--bottom-bar-button-
 * height`), so if those change, the scale picks up the new values on
 * the next recompute.
 *
 * Triggers:
 *   - `window.resize` (browser window resize, F11)
 *   - `visualViewport.resize` (pinch-zoom, on-screen keyboard, mobile
 *     URL bar hide/show)
 *   - `ResizeObserver` on `documentElement` (catches CSS-only layout
 *     shifts the window events miss)
 *
 * Throttling: every trigger schedules a single `requestAnimationFrame`
 * callback; multiple events between frames coalesce to one DOM write.
 *
 * Lifecycle: refcount-based. The first `useBoardAutoScale()` caller
 * installs listeners; the last unmount tears them down and restores
 * the CSS fallback by removing the inline override.
 */

// Natural pixel dimensions of `.board-cont` BEFORE the transform scale.
// Width: `.board-cont { width: 670px; }`. Height ≈ planet image (600) +
// top margin/padding for outer-cell captions (~85). The 685 number is
// the same magic value that already lives in `player_home.less`'s
// `.player_home_block--board { padding-bottom: calc((scale-1) * 685px) }`
// — keep them in sync.
const BOARD_NATURAL_WIDTH = 670;
const BOARD_NATURAL_HEIGHT = 685;

// Hard limits so the auto-scale never goes absurd on edge viewports.
// MIN_SCALE: at narrower-than-default laptops, the board may visually
// overflow the column slightly rather than become unreadable.
// MAX_SCALE: 4.0 covers 4K with the new fixed/flex-centered layout
// (board now uses BOTH halves of the central viewport vertically, not
// just the lower half it got under the old top-anchored layout). At
// 4.0 the board is ~2680×2740 — fits 2160p comfortably; ultrawide
// 5120×2160 still picks the height-limited 3.0-ish scale.
const MIN_SCALE = 0.8;
const MAX_SCALE = 4.0;

// Vertical chrome reservation in pixels — top: bottom-bar-button + 20
// (matches `padding-top: calc(var(--bottom-bar-button-height) + 20px)`
// on `#player-home`). Bottom: bottom-bar-button. The legacy `+80`
// breather was there for old persistent text labels on the upper Mars
// rim — those are now hover-only info markers (small i-badges), so the
// huge top padding just wasted vertical space at 4K. A modest 20px
// gap keeps the topmost outer cells (Maxwell Base etc., margin-top:
// -13px) clear of the top button bar with comfortable breathing room.
function readVerticalReserved(): number {
  const cs = getComputedStyle(document.documentElement);
  const buttonH = parsePx(cs.getPropertyValue('--bottom-bar-button-height')) || 36;
  const topPadding = buttonH + 20;
  const bottomPadding = buttonH;
  // Minimal 4px safety so the bottom edge of the board doesn't touch
  // the bottom button bar at maximum scale.
  return topPadding + bottomPadding + 4;
}

function readHorizontalReserved(): number {
  const cs = getComputedStyle(document.documentElement);
  // Same calc as `#player-home`'s `padding-left/right`: panel + 20px
  // breather on each side.
  const leftW = parsePx(cs.getPropertyValue('--left-panel-width')) || 160;
  const rightW = parsePx(cs.getPropertyValue('--right-sidebar-width')) || 60;
  return leftW + 20 + rightW + 20;
}

function parsePx(s: string): number {
  const trimmed = s.trim();
  if (trimmed.endsWith('px')) return parseFloat(trimmed);
  return parseFloat(trimmed) || 0;
}

let rafHandle = 0;
let refCount = 0;
let resizeObserver: ResizeObserver | undefined;

function computeAndApply(): void {
  rafHandle = 0;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const reservedH = readHorizontalReserved();
  const reservedV = readVerticalReserved();
  const availableW = vw - reservedH;
  const availableV = vh - reservedV;
  if (availableW <= 0 || availableV <= 0) return;

  const scaleW = availableW / BOARD_NATURAL_WIDTH;
  const scaleV = availableV / BOARD_NATURAL_HEIGHT;
  const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.min(scaleW, scaleV)));

  // Round to 3 decimals — avoids subpixel reflow churn from float jitter
  // when viewport size changes by sub-pixel fractions (browser DPR).
  document.documentElement.style.setProperty('--board-scale', scale.toFixed(3));
}

function schedule(): void {
  if (rafHandle !== 0) return;
  rafHandle = requestAnimationFrame(computeAndApply);
}

function install(): void {
  if (refCount === 0) {
    window.addEventListener('resize', schedule);
    if (window.visualViewport !== null && window.visualViewport !== undefined) {
      window.visualViewport.addEventListener('resize', schedule);
    }
    // ResizeObserver on documentElement catches layout shifts triggered
    // by CSS-only changes (e.g. preferences sidebar opening, font-load
    // reflow) that window.resize doesn't fire for.
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(schedule);
      resizeObserver.observe(document.documentElement);
    }
    computeAndApply();
  }
  refCount++;
}

function uninstall(): void {
  refCount--;
  if (refCount === 0) {
    window.removeEventListener('resize', schedule);
    if (window.visualViewport !== null && window.visualViewport !== undefined) {
      window.visualViewport.removeEventListener('resize', schedule);
    }
    if (resizeObserver !== undefined) {
      resizeObserver.disconnect();
      resizeObserver = undefined;
    }
    if (rafHandle !== 0) {
      cancelAnimationFrame(rafHandle);
      rafHandle = 0;
    }
    // Removing the inline override drops back to the `:root` CSS
    // fallback (`--board-scale: 1.4` in player_home.less) — safer than
    // leaving a stale runtime-computed value behind.
    document.documentElement.style.removeProperty('--board-scale');
  }
}

/**
 * Vue composable. Call from `setup()` / Options API `mounted()` via
 * the wrapper exported below. Installs listeners on first mount,
 * tears them down on last unmount.
 */
export function useBoardAutoScale(): void {
  onMounted(install);
  onBeforeUnmount(uninstall);
}
