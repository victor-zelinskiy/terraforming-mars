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
    gradient: [{offset: 0, color: '#0f5a86'}, {offset: 55, color: '#2fa6dd'}, {offset: 100, color: '#7fdcf6'}],
    vars: {
      '--arc-deep': '#0f5a86', '--arc-glow': 'rgba(70, 196, 240, 0.62)', '--arc-glow-soft': 'rgba(70, 196, 240, 0.30)',
      '--arc-rail': 'rgba(3, 12, 22, 0.55)', '--arc-channel': 'rgba(12, 44, 68, 0.78)',
      '--arc-edge': 'rgba(126, 220, 246, 0.42)', '--arc-rim': 'rgba(170, 226, 250, 0.6)',
      '--arc-cap': 'rgba(150, 224, 250, 0.92)', '--arc-tick': 'rgba(150, 196, 226, 0.30)',
      '--arc-accent': '#7fdcf6',
    },
  },
  // Airy, dry luminous cyan — lighter / cleaner than oceans (atmosphere, not water).
  oxygen: {
    name: 'oxygen', accent: 'oxygen', title: 'Oxygen scale', noun: 'Oxygen', description: 'Shows the atmospheric oxygen level.', unit: '%',
    glyph: O2_MOLECULE,
    gradient: [{offset: 0, color: '#3a93b4'}, {offset: 55, color: '#7fd4ee'}, {offset: 100, color: '#dffaff'}],
    vars: {
      '--arc-deep': '#3a93b4', '--arc-glow': 'rgba(170, 232, 252, 0.55)', '--arc-glow-soft': 'rgba(170, 232, 252, 0.26)',
      '--arc-rail': 'rgba(6, 16, 26, 0.5)', '--arc-channel': 'rgba(20, 46, 62, 0.93)',
      '--arc-edge': 'rgba(206, 244, 255, 0.5)', '--arc-rim': 'rgba(224, 248, 255, 0.62)',
      '--arc-cap': 'rgba(206, 244, 255, 0.92)', '--arc-tick': 'rgba(186, 222, 240, 0.32)',
      '--arc-accent': '#cdf2ff',
    },
  },
  // Thermal gradient — cold blue-violet → warm ember (Mars heating up).
  temperature: {
    name: 'temperature', accent: 'temperature', title: 'Temperature scale', noun: 'Temperature', description: 'Shows the planet temperature.', unit: '°C',
    glyph: THERMOMETER,
    gradient: [{offset: 0, color: '#7b74d6'}, {offset: 38, color: '#b85a9e'}, {offset: 72, color: '#e0664e'}, {offset: 100, color: '#f3953e'}],
    vars: {
      '--arc-deep': '#5a4a86', '--arc-glow': 'rgba(232, 120, 96, 0.5)', '--arc-glow-soft': 'rgba(232, 120, 96, 0.24)',
      '--arc-rail': 'rgba(14, 8, 20, 0.55)', '--arc-channel': 'rgba(32, 22, 42, 0.93)',
      '--arc-edge': 'rgba(255, 196, 150, 0.42)', '--arc-rim': 'rgba(255, 214, 196, 0.55)',
      '--arc-cap': 'rgba(255, 184, 140, 0.92)', '--arc-tick': 'rgba(214, 170, 180, 0.3)',
      '--arc-accent': '#f0a07a',
    },
  },
  // Warm atmospheric gold — dense, sunlit, denser than the others.
  venus: {
    name: 'venus', accent: 'venus', title: 'Venus scale', noun: 'Venus', description: 'Shows the Venus terraforming level.', unit: '%',
    glyph: VENUS_SYMBOL,
    gradient: [{offset: 0, color: '#9a6a1e'}, {offset: 55, color: '#e0a83a'}, {offset: 100, color: '#ffe6a6'}],
    vars: {
      '--arc-deep': '#9a6a1e', '--arc-glow': 'rgba(245, 206, 110, 0.55)', '--arc-glow-soft': 'rgba(245, 206, 110, 0.26)',
      '--arc-rail': 'rgba(20, 12, 4, 0.55)', '--arc-channel': 'rgba(46, 32, 10, 0.93)',
      '--arc-edge': 'rgba(255, 224, 150, 0.45)', '--arc-rim': 'rgba(255, 234, 180, 0.6)',
      '--arc-cap': 'rgba(255, 224, 150, 0.92)', '--arc-tick': 'rgba(226, 196, 140, 0.32)',
      '--arc-accent': '#ffe6a6',
    },
  },
};
