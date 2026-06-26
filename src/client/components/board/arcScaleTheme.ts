/**
 * Per-scale THEME for the dynamic global-parameter scales.
 *
 * One premium FAMILY, four distinct IDENTITIES. Every scale shares the same
 * material build (rail / channel / water-or-energy fill / edge / sheen / ticks /
 * caps / identity badge — see ArcScale.vue + arc_scale.less); the theme only
 * swaps colours, the fill gradient, and the identity glyph so the player reads
 * "oxygen / temperature / Venus / oceans" at a glance.
 *
 * Colours are emitted as CSS custom properties (ArcScale binds them inline) so
 * there is ONE stylesheet driven by `var(--arc-*)`. The fill gradient stops are
 * rendered as SVG <stop>s; for Temperature they travel cold→warm along the band
 * (the "Mars warming up" thermal progression), for the others they're a calm
 * mono depth gradient.
 *
 * Identity glyphs are inline SVG data-URLs (no asset dependency, crisp at any
 * board scale): oceans = droplet, oxygen = O₂ molecule, temperature =
 * thermometer, venus = the ♀ planetary symbol. None is a bonus/reward icon —
 * each is a scale-TYPE badge.
 */

export type ArcScaleName = 'oceans' | 'oxygen' | 'temperature' | 'venus';

export type GradientStop = {offset: number; color: string};

export type ArcScaleTheme = {
  name: ArcScaleName;
  /** AnimatedScaleMarker accent (the moving indicator palette). */
  accent: 'oceans' | 'oxygen' | 'temperature' | 'venus';
  /** Title i18n key for the identity badge tooltip. */
  title: string;
  /** Parameter noun i18n key for the count line (e.g. "Oxygen"). */
  noun: string;
  /** Short i18n description for the identity badge tooltip. */
  description: string;
  /** i18n unit label for the count line (e.g. "%", "°C", "/9"); '' = none. */
  unit: string;
  /** Inline SVG data-URL for the identity glyph (a scale-TYPE badge, not a bonus). */
  glyph: string;
  /** Fill gradient stops (cold→warm for temperature; depth otherwise). */
  gradient: ReadonlyArray<GradientStop>;
  /** CSS custom properties consumed by arc_scale.less. */
  vars: Record<string, string>;
};

// ── Identity glyphs (inline SVG; scale-TYPE badges) ────────────────────────
const DROPLET = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><defs><linearGradient id='d' x1='0' y1='0' x2='0' y2='1'><stop offset='0%25' stop-color='%23a6ecff'/><stop offset='60%25' stop-color='%2348b6e6'/><stop offset='100%25' stop-color='%231f7fb8'/></linearGradient></defs><path d='M12 2.5 C12 2.5 5 10.5 5 15.4 a7 7 0 0 0 14 0 C19 10.5 12 2.5 12 2.5 Z' fill='url(%23d)' stroke='%23cdf2ff' stroke-width='0.7'/><ellipse cx='9.6' cy='14.4' rx='1.5' ry='2.4' fill='%23ffffff' opacity='0.5'/></svg>\")";

const O2_MOLECULE = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='9' cy='11.5' r='5.4' fill='rgba(120,210,238,0.16)' stroke='%23cdf2ff' stroke-width='1.9'/><circle cx='15.5' cy='13' r='5.4' fill='rgba(120,210,238,0.16)' stroke='%23bfeeff' stroke-width='1.9'/></svg>\")";

const THERMOMETER = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 3 a3 3 0 0 1 3 3 v8.2 a4.6 4.6 0 1 1 -6 0 V6 a3 3 0 0 1 3 -3 Z' fill='none' stroke='%23ffd9b0' stroke-width='1.7'/><circle cx='12' cy='18.2' r='2.7' fill='%23ff7a4a'/><rect x='11' y='8.5' width='2' height='8' rx='1' fill='%23ff7a4a'/></svg>\")";

const VENUS_SYMBOL = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='12' cy='8.4' r='4.9' fill='rgba(245,210,120,0.16)' stroke='%23ffe6a6' stroke-width='2'/><line x1='12' y1='13.3' x2='12' y2='21' stroke='%23ffe6a6' stroke-width='2' stroke-linecap='round'/><line x1='8.6' y1='17.6' x2='15.4' y2='17.6' stroke='%23ffe6a6' stroke-width='2' stroke-linecap='round'/></svg>\")";

export const ARC_SCALE_THEMES: Record<ArcScaleName, ArcScaleTheme> = {
  // Deep aqua / water — the established reference (matches OceanArcScale).
  oceans: {
    name: 'oceans', accent: 'oceans', title: 'Ocean scale', noun: 'Oceans', description: 'Shows the number of oceans placed.', unit: '',
    glyph: DROPLET,
    // Gradient runs LOW value → HIGH value along the arc (deep → bright).
    // Deep, saturated water — heaviest glow + darkest channel of the blues.
    gradient: [{offset: 0, color: '#0c5280'}, {offset: 52, color: '#2aa6dd'}, {offset: 100, color: '#74d8f4'}],
    vars: {
      '--arc-deep': '#0c5280', '--arc-glow': 'rgba(58, 188, 240, 0.7)', '--arc-glow-soft': 'rgba(58, 188, 240, 0.34)',
      '--arc-rail': 'rgba(2, 10, 20, 0.6)', '--arc-channel': 'rgba(9, 40, 64, 0.84)',
      '--arc-edge': 'rgba(120, 216, 244, 0.5)', '--arc-rim': 'rgba(170, 228, 250, 0.66)',
      '--arc-cap': 'rgba(150, 224, 250, 0.95)', '--arc-tick': 'rgba(140, 192, 224, 0.32)',
      '--arc-accent': '#74d8f4', '--arc-digit': '#bcd8ea', '--arc-digit-on': '#eef9ff',
    },
  },
  // Airy, dry luminous cyan — lighter / cleaner than oceans (atmosphere, not water).
  oxygen: {
    name: 'oxygen', accent: 'oxygen', title: 'Oxygen scale', noun: 'Oxygen', description: 'Shows the atmospheric oxygen level.', unit: '%',
    glyph: O2_MOLECULE,
    // Airy / dry: lighter + MORE TRANSPARENT channel (atmosphere, not water),
    // a crisp near-white cyan fill, a clean edge — deliberately less glassy
    // depth + less glow than oceans so the two blues never read alike.
    gradient: [{offset: 0, color: '#4aa6c8'}, {offset: 55, color: '#8fe0f6'}, {offset: 100, color: '#eafcff'}],
    vars: {
      '--arc-deep': '#4aa6c8', '--arc-glow': 'rgba(168, 234, 252, 0.46)', '--arc-glow-soft': 'rgba(168, 234, 252, 0.2)',
      '--arc-rail': 'rgba(8, 20, 30, 0.4)', '--arc-channel': 'rgba(40, 70, 90, 0.58)',
      '--arc-edge': 'rgba(214, 248, 255, 0.6)', '--arc-rim': 'rgba(234, 252, 255, 0.68)',
      '--arc-cap': 'rgba(220, 250, 255, 0.95)', '--arc-tick': 'rgba(200, 232, 246, 0.36)',
      '--arc-accent': '#dffaff', '--arc-digit': '#bcd6e6', '--arc-digit-on': '#f4fcff',
    },
  },
  // Thermal gradient — cold blue-violet → warm ember (Mars heating up).
  temperature: {
    name: 'temperature', accent: 'temperature', title: 'Temperature scale', noun: 'Temperature', description: 'Shows the planet temperature.', unit: '°C',
    glyph: THERMOMETER,
    // The most expressive scale: a real thermal journey along the fill — icy
    // blue-violet (cold, -30) → magenta-rose (mid) → ember-orange (hot, +8).
    // The inactive channel is a COLD dark blue-violet so the not-yet-warmed end
    // reads frozen; the warm glow lives on the filled (heated) portion.
    gradient: [{offset: 0, color: '#5566df'}, {offset: 34, color: '#9a55c2'}, {offset: 64, color: '#dc5448'}, {offset: 100, color: '#ff8a36'}],
    vars: {
      '--arc-deep': '#5566df', '--arc-glow': 'rgba(244, 122, 70, 0.58)', '--arc-glow-soft': 'rgba(244, 122, 70, 0.28)',
      '--arc-rail': 'rgba(12, 10, 28, 0.58)', '--arc-channel': 'rgba(26, 28, 56, 0.82)',
      '--arc-edge': 'rgba(255, 192, 150, 0.44)', '--arc-rim': 'rgba(210, 200, 240, 0.5)',
      '--arc-cap': 'rgba(255, 180, 138, 0.92)', '--arc-tick': 'rgba(190, 182, 214, 0.32)',
      '--arc-accent': '#f4926a', '--arc-digit': '#c9c2dc', '--arc-digit-on': '#ffe6d8',
    },
  },
  // Warm atmospheric gold — dense, sunlit, denser than the others.
  venus: {
    name: 'venus', accent: 'venus', title: 'Venus scale', noun: 'Venus', description: 'Shows the Venus terraforming level.', unit: '%',
    glyph: VENUS_SYMBOL,
    // Dense golden ATMOSPHERE (not fire): warm amber channel, sunlit-gold fill,
    // a strong soft gold HAZE around it. Warm but never red/ember — that's
    // temperature's lane.
    gradient: [{offset: 0, color: '#9c6c1c'}, {offset: 55, color: '#e8ad3a'}, {offset: 100, color: '#ffe8ac'}],
    vars: {
      '--arc-deep': '#9c6c1c', '--arc-glow': 'rgba(250, 212, 112, 0.66)', '--arc-glow-soft': 'rgba(250, 206, 120, 0.36)',
      '--arc-rail': 'rgba(22, 14, 4, 0.58)', '--arc-channel': 'rgba(54, 38, 14, 0.82)',
      '--arc-edge': 'rgba(255, 228, 158, 0.5)', '--arc-rim': 'rgba(255, 238, 190, 0.64)',
      '--arc-cap': 'rgba(255, 226, 150, 0.95)', '--arc-tick': 'rgba(230, 200, 148, 0.34)',
      '--arc-accent': '#ffe6a6', '--arc-digit': '#ddccaa', '--arc-digit-on': '#fff3d8',
    },
  },
};
