/*
 * Strategy VISUAL THEMES (rework §30 — light themes).
 *
 * Maps the game's MAIN strategy archetype to a light visual motif for the hero / main
 * story card: an accent colour, a monochrome geometric glyph, and a motif class that
 * `endgame.less` renders as ONE shared, tinted parametric background pattern (orbit /
 * biodome / lab-grid / clouds / trade-routes …). Deliberately restrained — premium and
 * readable, never the heavy/cartoonish art the spec warns against.
 *
 * PURE — no Vue/DOM/i18n. Returns CSS-ready tokens; the styling lives in endgame.less.
 */
import type {StrategyArchetype} from '@/client/components/endgame/strategyArchetypes';

/** The motif class suffix → `.eg-theme--<motif>` in endgame.less. */
export type StrategyMotif =
  | 'jovian' | 'bio' | 'lab' | 'clouds' | 'scan' | 'routes' | 'city' | 'parameters' | 'orbital' | 'neutral';

export type StrategyVisualTheme = {
  motif: StrategyMotif;
  /** CSS accent colour (hex) — tints the motif + the hero rim. */
  accent: string;
  /** A monochrome geometric glyph (tinted via CSS — NOT an emoji). */
  glyph: string;
};

const THEME_BY_ARCHETYPE: Readonly<Record<StrategyArchetype, StrategyVisualTheme>> = {
  jovian: {motif: 'jovian', accent: '#e3b341', glyph: '◍'},
  animals: {motif: 'bio', accent: '#7fc16b', glyph: '❀'},
  microbes: {motif: 'lab', accent: '#5fc7b0', glyph: '⊛'},
  floaters: {motif: 'clouds', accent: '#9bc7e6', glyph: '◌'},
  scienceDraw: {motif: 'scan', accent: '#6ab0e6', glyph: '⊙'},
  colonyTrade: {motif: 'routes', accent: '#b08ce0', glyph: '◉'},
  cityGreenery: {motif: 'city', accent: '#86c06a', glyph: '⬡'},
  globalParams: {motif: 'parameters', accent: '#e08a5a', glyph: '◐'},
  spaceTitanium: {motif: 'orbital', accent: '#9fb3c8', glyph: '✦'},
  earthDiscounts: {motif: 'neutral', accent: '#6cc4d6', glyph: '⊛'},
  standardProjects: {motif: 'city', accent: '#9fb3c8', glyph: '⬡'},
  milestonesAwards: {motif: 'neutral', accent: '#e3b341', glyph: '✷'},
  venus: {motif: 'clouds', accent: '#d59ad6', glyph: '◌'},
  cardResources: {motif: 'bio', accent: '#7fc16b', glyph: '◈'},
};

const NEUTRAL_THEME: StrategyVisualTheme = {motif: 'neutral', accent: '#6ab0e6', glyph: '✦'};

export function themeForArchetype(a: StrategyArchetype | undefined): StrategyVisualTheme {
  return a !== undefined ? THEME_BY_ARCHETYPE[a] : NEUTRAL_THEME;
}
