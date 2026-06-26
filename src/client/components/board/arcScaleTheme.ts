/**
 * Per-scale THEME for the dynamic global-parameter scales.
 *
 * One premium FAMILY, four distinct IDENTITIES. Every scale shares the same
 * material build (rail / channel / water-or-energy fill / edge / sheen / segment
 * dividers / identity badge — see ArcScale.vue + arc_scale.less); the theme only
 * swaps colours, the fill gradient, and the identity glyph so the player reads
 * "oxygen / temperature / Venus / oceans" at a glance.
 *
 * Colours are emitted as CSS custom properties (ArcScale binds them inline) so
 * there is ONE stylesheet driven by `var(--arc-*)`. The fill gradient stops are
 * rendered as SVG <stop>s; for Temperature they travel cold→warm along the band
 * (the "Mars warming up" thermal progression), for the others they're a calm
 * mono depth gradient.
 *
 * Identity glyphs reuse the SAME icon assets as the RIGHT SIDEBAR metric icons
 * (`temperature-tile` / `oxygen-tile` / `ocean-tile` / `venus-tile`, defined in
 * cards.less) so the scale badge and the sidebar speak ONE icon language — no
 * invented per-scale icons. The badge is just a calmer, scale-tinted treatment
 * of that same icon (a scale-TYPE badge, never a bonus/reward marker).
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
  /** Right-bar icon CLASS for the identity glyph (same asset as the sidebar). */
  glyphClass: string;
  /** Fill gradient stops (cold→warm for temperature; depth otherwise). */
  gradient: ReadonlyArray<GradientStop>;
  /** CSS custom properties consumed by arc_scale.less. */
  vars: Record<string, string>;
};

export const ARC_SCALE_THEMES: Record<ArcScaleName, ArcScaleTheme> = {
  // Deep aqua / water — the established reference (matches OceanArcScale).
  oceans: {
    name: 'oceans', accent: 'oceans', title: 'Ocean scale', noun: 'Oceans', description: 'Shows the number of oceans placed.', unit: '',
    glyphClass: 'ocean-tile',
    // Gradient runs LOW value → HIGH value along the arc (deep → bright).
    // Deep, saturated water — heaviest glow + darkest channel of the blues.
    gradient: [{offset: 0, color: '#0c5280'}, {offset: 52, color: '#2aa6dd'}, {offset: 100, color: '#74d8f4'}],
    vars: {
      '--arc-deep': '#0c5280', '--arc-glow': 'rgba(58, 188, 240, 0.7)', '--arc-glow-soft': 'rgba(58, 188, 240, 0.34)',
      '--arc-rail': 'rgba(2, 10, 20, 0.6)', '--arc-channel': 'rgba(9, 40, 64, 0.84)',
      '--arc-edge': 'rgba(120, 216, 244, 0.5)', '--arc-rim': 'rgba(170, 228, 250, 0.66)',
      '--arc-accent': '#74d8f4', '--arc-digit': '#bcd8ea', '--arc-digit-on': '#eef9ff', '--arc-divider': 'rgba(4, 18, 30, 0.62)',
    },
  },
  // Airy, dry luminous cyan — lighter / cleaner than oceans (atmosphere, not water).
  oxygen: {
    name: 'oxygen', accent: 'oxygen', title: 'Oxygen scale', noun: 'Oxygen', description: 'Shows the atmospheric oxygen level.', unit: '%',
    glyphClass: 'oxygen-tile',
    // Airy / dry: lighter + MORE TRANSPARENT channel (atmosphere, not water),
    // a crisp near-white cyan fill, a clean edge — deliberately less glassy
    // depth + less glow than oceans so the two blues never read alike.
    gradient: [{offset: 0, color: '#4aa6c8'}, {offset: 55, color: '#8fe0f6'}, {offset: 100, color: '#eafcff'}],
    vars: {
      '--arc-deep': '#4aa6c8', '--arc-glow': 'rgba(168, 234, 252, 0.46)', '--arc-glow-soft': 'rgba(168, 234, 252, 0.2)',
      '--arc-rail': 'rgba(8, 20, 30, 0.4)', '--arc-channel': 'rgba(40, 70, 90, 0.58)',
      '--arc-edge': 'rgba(214, 248, 255, 0.6)', '--arc-rim': 'rgba(234, 252, 255, 0.68)',
      '--arc-accent': '#dffaff', '--arc-digit': '#bcd6e6', '--arc-digit-on': '#f4fcff', '--arc-divider': 'rgba(14, 30, 42, 0.5)',
    },
  },
  // Thermal gradient — cold blue-violet → warm ember (Mars heating up).
  temperature: {
    name: 'temperature', accent: 'temperature', title: 'Temperature scale', noun: 'Temperature', description: 'Shows the planet temperature.', unit: '°C',
    glyphClass: 'temperature-tile',
    // The most expressive scale: a real thermal journey along the fill — icy
    // blue-violet (cold, -30) → magenta-rose (mid) → ember-orange (hot, +8).
    // The inactive channel is a COLD dark blue-violet so the not-yet-warmed end
    // reads frozen; the warm glow lives on the filled (heated) portion.
    gradient: [{offset: 0, color: '#5566df'}, {offset: 34, color: '#9a55c2'}, {offset: 64, color: '#dc5448'}, {offset: 100, color: '#ff8a36'}],
    vars: {
      '--arc-deep': '#5566df', '--arc-glow': 'rgba(244, 122, 70, 0.58)', '--arc-glow-soft': 'rgba(244, 122, 70, 0.28)',
      '--arc-rail': 'rgba(12, 10, 28, 0.58)', '--arc-channel': 'rgba(26, 28, 56, 0.82)',
      '--arc-edge': 'rgba(255, 192, 150, 0.44)', '--arc-rim': 'rgba(210, 200, 240, 0.5)',
      '--arc-accent': '#f4926a', '--arc-digit': '#c9c2dc', '--arc-digit-on': '#ffe6d8', '--arc-divider': 'rgba(12, 10, 28, 0.58)',
    },
  },
  // Warm atmospheric gold — dense, sunlit, denser than the others.
  venus: {
    name: 'venus', accent: 'venus', title: 'Venus scale', noun: 'Venus', description: 'Shows the Venus terraforming level.', unit: '%',
    glyphClass: 'venus-tile',
    // Dense golden ATMOSPHERE (not fire): warm amber channel, sunlit-gold fill,
    // a strong soft gold HAZE around it. Warm but never red/ember — that's
    // temperature's lane.
    gradient: [{offset: 0, color: '#9c6c1c'}, {offset: 55, color: '#e8ad3a'}, {offset: 100, color: '#ffe8ac'}],
    vars: {
      '--arc-deep': '#9c6c1c', '--arc-glow': 'rgba(250, 212, 112, 0.66)', '--arc-glow-soft': 'rgba(250, 206, 120, 0.36)',
      '--arc-rail': 'rgba(22, 14, 4, 0.58)', '--arc-channel': 'rgba(54, 38, 14, 0.82)',
      '--arc-edge': 'rgba(255, 228, 158, 0.5)', '--arc-rim': 'rgba(255, 238, 190, 0.64)',
      '--arc-accent': '#ffe6a6', '--arc-digit': '#ddccaa', '--arc-digit-on': '#fff3d8', '--arc-divider': 'rgba(22, 14, 4, 0.58)',
    },
  },
};
