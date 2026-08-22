/*
 * GUARD: every `wgt-icon--*` class the client can EMIT has a DEFINITION.
 *
 * The family's background-image rules historically lived in
 * mandatory_input_modal.less; desktop-removal wave 2 deleted that file and
 * silently took the only definitions with it — the console status strip's
 * temperature / oxygen / ocean / venus readouts rendered as empty boxes for
 * two waves (console files only SIZE the box by design). The definitions now
 * live in src/styles/wgt_icons.less; this spec pins the contract between the
 * two emitters and that file, so deleting/renaming a rule fails by name
 * instead of by an empty top bar.
 *
 * Pure file-content check (no DOM) — cheap by design; the emitters' variant
 * sets are enumerable, so the contract is exact.
 */
import * as fs from 'fs';
import * as path from 'path';
import {expect} from 'chai';

// Every variant `optionIcons.iconClassFor` can emit for a global parameter
// (GLOBAL_PARAMETER_ICONS + the 'oceans' → 'ocean' alias target), plus every
// variant `consoleGovernmentSupport` builds (the four scales + the Moon rates
// + the Ares hazard pseudo-icon).
const EMITTABLE = [
  'temperature', 'oxygen', 'ocean', 'venus',
  'moon-habitat', 'moon-mining', 'moon-logistics',
  'hazard',
];

describe('wgt-icon definitions', () => {
  it('every emittable wgt-icon variant is defined in wgt_icons.less', () => {
    const less = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'styles', 'wgt_icons.less'), 'utf-8');
    const missing = EMITTABLE.filter((v) => !less.includes(`.wgt-icon--${v}`));
    expect(missing, `wgt_icons.less is missing definitions for: ${missing.join(', ')}`).to.deep.eq([]);
  });

  it('the picture variants carry a background-image (the box is sized by hosts)', () => {
    const less = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'styles', 'wgt_icons.less'), 'utf-8');
    // hazard is a CSS-glyph pseudo-icon by design — every other variant must
    // point at a real asset.
    for (const v of EMITTABLE.filter((x) => x !== 'hazard')) {
      const block = less.split(`.wgt-icon--${v}`)[1]?.split('}')[0] ?? '';
      expect(block, `.wgt-icon--${v} must declare background-image`).to.include('background-image');
    }
  });
});
