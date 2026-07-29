import {expect} from 'chai';
import {applyGlyphCssVars, glyphCssVars, glyphLabelVar, glyphToneVar} from '@/client/gamepad/glyphCssBridge';
import {setGlyphSetOverride, updateDetectedGlyphSet} from '@/client/gamepad/glyphSets';
import {setButtonLayout} from '@/client/gamepad/buttonLayout';

/**
 * The CSS side of the glyph layer: badges painted by a pseudo-element on DOM we
 * don't own (the virtual keyboard's simple-keyboard keys) read the active set
 * from custom properties instead of hardcoding «Y» / «RT».
 */
describe('glyphCssBridge', () => {
  beforeEach(() => {
    setGlyphSetOverride('auto');
    setButtonLayout('standard');
    updateDetectedGlyphSet('Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)');
  });
  // Module state is bundle-shared under mochapack — never leak a set/layout.
  after(() => {
    setGlyphSetOverride('auto');
    setButtonLayout('standard');
  });

  it('publishes every label pre-quoted, ready for `content:`', () => {
    const vars = glyphCssVars();
    expect(vars[glyphLabelVar('triggerL')]).to.eq('"LT"');
    expect(vars[glyphLabelVar('inspect')]).to.eq('"Y"');
    setGlyphSetOverride('steam');
    expect(glyphCssVars()[glyphLabelVar('triggerL')]).to.eq('"L2"');
    setGlyphSetOverride('playstation');
    expect(glyphCssVars()[glyphLabelVar('inspect')]).to.eq('"△"');
  });

  it('publishes a tone only where the set defines one', () => {
    const vars = glyphCssVars();
    expect(vars[glyphToneVar('inspect')]).to.eq('#e6c34a');
    // Triggers are neutral steel — no tone, so a `var(…, @fallback)` in LESS
    // resolves to its fallback instead of an invalid empty value.
    expect(vars[glyphToneVar('triggerL')]).to.eq(undefined);
  });

  it('follows the A/B layout swap, like the rendered glyph does', () => {
    setButtonLayout('swap-ab');
    const vars = glyphCssVars();
    expect(vars[glyphLabelVar('confirm')]).to.eq('"B"');
    expect(vars[glyphLabelVar('back')]).to.eq('"A"');
  });

  it('writes onto an element, removing tones that no longer apply', () => {
    const el = document.createElement('div');
    applyGlyphCssVars(el);
    expect(el.style.getPropertyValue(glyphLabelVar('triggerR'))).to.eq('"RT"');
    expect(el.style.getPropertyValue(glyphToneVar('inspect'))).to.eq('#e6c34a');

    setGlyphSetOverride('playstation');
    applyGlyphCssVars(el);
    expect(el.style.getPropertyValue(glyphLabelVar('triggerR'))).to.eq('"R2"');
    expect(el.style.getPropertyValue(glyphToneVar('inspect'))).to.eq('#4dbf9f');
    // Neutral controls must be REMOVED, never left as an empty declaration.
    expect(el.style.getPropertyValue(glyphToneVar('triggerR'))).to.eq('');
  });
});
