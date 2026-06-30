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

// "Natural" pixel dimensions used to derive the scale that makes the
// PLANET fill the available central viewport area — NOT the full
// .board-cont box.
//
// The `.board-cont` box is wider/taller than the planet itself: it
// includes 85 px of top margin where outer-cells (Maxwell Base etc.)
// live above the Mars image. If we divide by the box height (685 ≈
// planet 600 + margin 85), the scale targets the box, which means the
// planet only fills ~600/685 = 87% of the available vertical — and the
// player sees that 13 % empty band as "wasted space" above/below the
// planet.
//
// Using the planet's intrinsic dimensions (Mars image is 620 × 600 via
// `background-size: 620px 600px`) makes the planet itself fill the
// available area. The outer cells move proportionally with the same
// transform-scale but extend slightly above/below the planet — comfortably
// within the chrome reservation as long as the breather above the top
// button bar is preserved.
//
// HEIGHT = 610 (planet 600 + 10 px tolerance) is the balance point:
//   - planet visually fills ~99 % of available V on widescreen monitors
//   - outer-cell row 0 (Maxwell Base, margin-top: -13 px in .board-cont
//     coords) keeps ~30-50 px clearance from the top button bar even at
//     the largest scales we hit (3.0+).
const BOARD_NATURAL_WIDTH = 670;
// HEIGHT = 576: pushed BELOW the planet's 600px native height so the planet
// slightly OVER-fills the available area — the dark northern cap tucks a hair
// behind the top bar (no content there; the Venus scale stays clear) and the
// ocean arc (pulled in to radius 242) just reaches the free bottom-centre gap
// without clipping. This squeezes out the last ~5% of vertical so the hex tiles
// are as large as the chrome allows. The geometry that bounds it: at this value
// the Venus arc (native y≈20) lands ~15px below the top bar and the ocean arc's
// deepest chip (native y≈588) lands ~14px above the viewport bottom — going
// HEIGHT = 582: with the scale now symmetric around the planet centre
// (transform-origin fix in board.less) and the arcs pulled in 4% (globs.less),
// the planet disc fills the inter-bar space with its dark edges tucking a few
// px behind the bars (no content there) while the hex grid + arcs clear them.
// Was 576; nudged up slightly so the bottom hex row keeps a safe margin above
// the (full-width) bottom bar.
const BOARD_NATURAL_HEIGHT = 582;

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
function readVerticalReserved(cs: CSSStyleDeclaration): number {
  const buttonH = parsePx(cs.getPropertyValue('--bottom-bar-button-height')) || 36;
  // Top breather trimmed to +2: the three topmost outer cells (Maxwell Base,
  // Stanford Torus, Dawn City — formerly at top -13..17) were RELOCATED down to
  // the side colony rows (board_items_positions.less), so nothing pokes above
  // the planet's top rim anymore. With the top cleared, the Venus scale (top of
  // the planet) can rise flush against the top button bar. Keep in lockstep with
  // `#player-home { padding-top }` + `.player_home_block--board { top }`.
  const topPadding = buttonH + 2;
  // SYMMETRIC with the top (buttonH + 2): the bottom bar buttons span the FULL
  // width (КАРТЫ / ДЕЙСТВИЯ / … left group + КОЛОНИИ / ЖУРНАЛ right group), NOT
  // just the corners — so the ocean arc at the bottom-centre DOES collide with
  // them. A 10px gap let it slip under the bar. Reserving the bar height + 2 so
  // the ocean arc clears it, and matching the top reservation so the centring
  // box is symmetric (the board no longer sits low). Kept in lockstep with
  // `.player_home_block--board { bottom }` (player_home.less).
  const bottomPadding = buttonH + 2;
  // Minimal 4px safety so the bottom edge of the board doesn't touch
  // the bottom button bar at maximum scale.
  return topPadding + bottomPadding + 4;
}

function readHorizontalReserved(cs: CSSStyleDeclaration): number {
  // Same calc as `#player-home`'s `padding-left/right`: panel + 20px
  // breather on each side.
  const leftW = parsePx(cs.getPropertyValue('--left-panel-width')) || 160;
  const rightW = parsePx(cs.getPropertyValue('--right-sidebar-width')) || 62;
  return leftW + 20 + rightW + 20;
}

function parsePx(s: string): number {
  const trimmed = s.trim();
  if (trimmed.endsWith('px')) {
    return parseFloat(trimmed);
  }
  return parseFloat(trimmed) || 0;
}

let rafHandle = 0;
let refCount = 0;
let resizeObserver: ResizeObserver | undefined;
// Last value written to `--board-scale`. Used to skip redundant writes
// (see computeAndApply). Reset on teardown so a fresh install recomputes.
let lastAppliedScale = '';

function computeAndApply(): void {
  rafHandle = 0;
  // Single getComputedStyle read for BOTH reservation calcs — each used to
  // call it separately, i.e. two forced style recalcs per pass. (perf B7)
  const cs = getComputedStyle(document.documentElement);
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const reservedH = readHorizontalReserved(cs);
  const reservedV = readVerticalReserved(cs);
  const availableW = vw - reservedH;
  const availableV = vh - reservedV;
  if (availableW <= 0 || availableV <= 0) {
    return;
  }

  const scaleW = availableW / BOARD_NATURAL_WIDTH;
  const scaleV = availableV / BOARD_NATURAL_HEIGHT;
  const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.min(scaleW, scaleV)));

  // Round to 3 decimals — avoids subpixel reflow churn from float jitter
  // when viewport size changes by sub-pixel fractions (browser DPR).
  const next = scale.toFixed(3);
  // Skip the write when the value is unchanged. A no-op setProperty still
  // dirties documentElement's style and can re-fire the ResizeObserver
  // below, which would feed itself; guarding the write breaks that
  // potential observer→write→observer loop. (perf B7)
  if (next === lastAppliedScale) {
    return;
  }
  lastAppliedScale = next;
  document.documentElement.style.setProperty('--board-scale', next);
}

function schedule(): void {
  if (rafHandle !== 0) {
    return;
  }
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
    // Forget the cached value so the next install writes fresh (the
    // property was just removed). (perf B7)
    lastAppliedScale = '';
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
