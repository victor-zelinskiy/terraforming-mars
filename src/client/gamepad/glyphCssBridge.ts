/*
 * GLYPH CSS BRIDGE — the ONE sanctioned way for a CSS-painted button badge to
 * follow the player's controller.
 *
 * `GamepadGlyph.vue` covers every badge we render ourselves, and it is what new
 * UI must use. It cannot cover a badge painted by a pseudo-element on markup we
 * do NOT own: the console virtual keyboard's keys are built by simple-keyboard,
 * so its {done} / {lang} hotkey badges have to live in `console_menu.less`.
 * Those hardcoded «Y» / «RT», which froze that one surface to the Xbox set
 * while the rest of the shell followed the player's pick — exactly the class of
 * drift this bridge exists to make impossible.
 *
 * So the ACTIVE set (override → detected, with the A/B layout applied — the
 * very same `activeGlyphSet()` the component reads) is mirrored onto <html>:
 *   --gp-label-<control>  the label as a CSS <string>, ready for `content:`
 *   --gp-tone-<control>   the accent colour; ABSENT when the spec has none, so
 *                         `var(--gp-tone-x, @fallback)` resolves to its
 *                         fallback (an empty custom property would instead make
 *                         the whole declaration invalid at computed-value time)
 * `GamepadLayer` republishes on every set / layout change.
 *
 * RULE (CLAUDE.md): never write a button name into CSS —
 * `content: var(--gp-label-inspect)`, never `content: 'Y'`.
 */

import {GlyphControl, GlyphSpec, activeGlyphSet} from '@/client/gamepad/glyphSets';

export const GLYPH_LABEL_VAR_PREFIX = '--gp-label-';
export const GLYPH_TONE_VAR_PREFIX = '--gp-tone-';

/** Custom-property name for a control's label (`content:`-ready string). */
export function glyphLabelVar(control: GlyphControl): string {
  return `${GLYPH_LABEL_VAR_PREFIX}${control}`;
}

/** Custom-property name for a control's accent tone. */
export function glyphToneVar(control: GlyphControl): string {
  return `${GLYPH_TONE_VAR_PREFIX}${control}`;
}

/**
 * The active set as a flat custom-property map — the PURE core (unit-tested).
 * Tone entries are omitted for neutral-steel controls on purpose (see above).
 */
export function glyphCssVars(): Record<string, string> {
  const set = activeGlyphSet();
  const vars: Record<string, string> = {};
  for (const control of Object.keys(set) as Array<GlyphControl>) {
    const spec: GlyphSpec = set[control];
    // `content:` needs a CSS <string>, so the label ships pre-quoted.
    vars[glyphLabelVar(control)] = `"${spec.label}"`;
    if (spec.tone !== '') {
      vars[glyphToneVar(control)] = spec.tone;
    }
  }
  return vars;
}

/**
 * Publish the active set onto `<html>` (or a given element in tests). Idempotent
 * and cheap — ~20 custom properties, written only when the set or the button
 * layout actually changes.
 */
export function applyGlyphCssVars(target?: HTMLElement): void {
  const el = target ?? (typeof document === 'undefined' ? undefined : document.documentElement);
  if (el === undefined) {
    return;
  }
  const set = activeGlyphSet();
  const vars = glyphCssVars();
  for (const control of Object.keys(set) as Array<GlyphControl>) {
    el.style.setProperty(glyphLabelVar(control), vars[glyphLabelVar(control)]);
    const tone = vars[glyphToneVar(control)];
    if (tone === undefined) {
      el.style.removeProperty(glyphToneVar(control));
    } else {
      el.style.setProperty(glyphToneVar(control), tone);
    }
  }
}
