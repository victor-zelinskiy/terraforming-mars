/*
 * Controller GLYPH SETS (GAMEPAD_SUPPORT_DESIGN.md §6) — semantic control →
 * presentation. The rest of the subsystem speaks ONLY semantics
 * ('confirm'/'back'/…); platform naming (Xbox letters, colors) lives here,
 * so adding a PlayStation / Switch set later is one more entry + a settings
 * knob — no other file changes.
 */

import {SemanticButton} from '@/client/gamepad/gamepadPollModel';

/** Everything a hint can reference: semantic buttons + composite controls.
 * The four directional d-pad glyphs (P27) let the quick selectors hint a
 * SINGLE direction («↑ Действия карт») instead of the generic cross. */
export type GlyphControl = SemanticButton | 'dpad' | 'dpadH' | 'dpadU' | 'dpadD' | 'dpadL' | 'dpadR' | 'stickMove' | 'stickScroll';

export type GlyphSpec = {
  /** Badge text (letter / abbreviation / symbol). */
  label: string,
  /** Accent tone (empty = neutral steel). */
  tone: string,
  /** round = face button, pill = bumper/trigger/system, cross = d-pad, stick. */
  shape: 'round' | 'pill' | 'cross' | 'stick',
};

export type GlyphSetId = 'xbox';

/** Xbox face-button tones, desaturated toward the fork's dark-glass palette. */
const XBOX: Record<GlyphControl, GlyphSpec> = {
  confirm: {label: 'A', tone: '#6fbf4b', shape: 'round'},
  back: {label: 'B', tone: '#e0564d', shape: 'round'},
  secondary: {label: 'X', tone: '#4f9fe0', shape: 'round'},
  inspect: {label: 'Y', tone: '#e6c34a', shape: 'round'},
  bumperL: {label: 'LB', tone: '', shape: 'pill'},
  bumperR: {label: 'RB', tone: '', shape: 'pill'},
  triggerL: {label: 'LT', tone: '', shape: 'pill'},
  triggerR: {label: 'RT', tone: '', shape: 'pill'},
  view: {label: '⧉', tone: '', shape: 'round'},
  menu: {label: '≡', tone: '', shape: 'round'},
  stickL: {label: 'L3', tone: '', shape: 'stick'},
  stickR: {label: 'R3', tone: '', shape: 'stick'},
  dpad: {label: '✚', tone: '', shape: 'cross'},
  dpadH: {label: '◄►', tone: '', shape: 'cross'},
  dpadU: {label: '▲', tone: '', shape: 'cross'},
  dpadD: {label: '▼', tone: '', shape: 'cross'},
  dpadL: {label: '◄', tone: '', shape: 'cross'},
  dpadR: {label: '►', tone: '', shape: 'cross'},
  stickMove: {label: 'L', tone: '', shape: 'stick'},
  stickScroll: {label: 'R', tone: '', shape: 'stick'},
};

export const GLYPH_SETS: Record<GlyphSetId, Record<GlyphControl, GlyphSpec>> = {
  xbox: XBOX,
};

/** The active glyph set (Xbox-only today; a future setting switches this). */
export function activeGlyphSet(): Record<GlyphControl, GlyphSpec> {
  return GLYPH_SETS.xbox;
}
