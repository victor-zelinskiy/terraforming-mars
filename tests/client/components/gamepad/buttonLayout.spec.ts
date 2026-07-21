import {expect} from 'chai';
import {
  BUTTON_LAYOUT_CHOICES,
  buttonLayoutChoice,
  buttonLayoutState,
  cycleButtonLayout,
  layoutSwapPair,
  remapConsoleIntent,
  remapSemanticButton,
  setButtonLayout,
} from '@/client/gamepad/buttonLayout';
import {GLYPH_SETS, activeGlyphSet, setGlyphSetOverride} from '@/client/gamepad/glyphSets';

/**
 * The gamepad button LAYOUT (Console → Options → «Раскладка кнопок»): the
 * confirm/cancel (A↔B) swap applied on two honest axes (intent + glyph) from
 * one shared definition. Pure + reactive — server-runner testable.
 */
describe('buttonLayout (gamepad remap)', () => {
  beforeEach(() => {
    setButtonLayout('standard');
    setGlyphSetOverride('xbox'); // deterministic glyph labels
  });
  after(() => setButtonLayout('standard'));

  describe('remapSemanticButton', () => {
    it('standard is the identity', () => {
      expect(remapSemanticButton('confirm', 'standard')).to.eq('confirm');
      expect(remapSemanticButton('back', 'standard')).to.eq('back');
      expect(remapSemanticButton('inspect', 'standard')).to.eq('inspect');
    });
    it('swap-ab swaps ONLY confirm/back, leaves the rest', () => {
      expect(remapSemanticButton('confirm', 'swap-ab')).to.eq('back');
      expect(remapSemanticButton('back', 'swap-ab')).to.eq('confirm');
      // Every other button is untouched — no self-trap on X/Y/triggers/menu.
      for (const b of ['secondary', 'inspect', 'bumperL', 'triggerR', 'menu', 'view'] as const) {
        expect(remapSemanticButton(b, 'swap-ab')).to.eq(b);
      }
    });
    it('layoutSwapPair exposes the shared pair (undefined for standard)', () => {
      expect(layoutSwapPair('standard')).to.eq(undefined);
      expect(layoutSwapPair('swap-ab')).to.deep.eq(['confirm', 'back']);
    });
  });

  describe('remapConsoleIntent', () => {
    it('standard returns the SAME object (hot-path early-out)', () => {
      const intent = {kind: 'press', button: 'confirm'} as const;
      expect(remapConsoleIntent(intent, 'standard')).to.equal(intent);
    });
    it('swaps press AND release buttons under swap-ab', () => {
      expect(remapConsoleIntent({kind: 'press', button: 'confirm'}, 'swap-ab')).to.deep.eq({kind: 'press', button: 'back'});
      expect(remapConsoleIntent({kind: 'release', button: 'back'}, 'swap-ab')).to.deep.eq({kind: 'release', button: 'confirm'});
    });
    it('passes nav / scroll through untouched', () => {
      const nav = {kind: 'nav', dir: 'up', repeat: false} as const;
      const scroll = {kind: 'scroll', dx: 0, dy: 1} as const;
      expect(remapConsoleIntent(nav, 'swap-ab')).to.deep.eq(nav);
      expect(remapConsoleIntent(scroll, 'swap-ab')).to.deep.eq(scroll);
    });
  });

  describe('glyph swap stays in lockstep (activeGlyphSet)', () => {
    it('standard renders the base set', () => {
      expect(activeGlyphSet().confirm.label).to.eq(GLYPH_SETS.xbox.confirm.label); // 'A'
      expect(activeGlyphSet().back.label).to.eq(GLYPH_SETS.xbox.back.label); // 'B'
    });
    it('swap-ab flips the confirm/back specs so the confirm glyph shows the button that now confirms', () => {
      setButtonLayout('swap-ab');
      // Under swap, physical B produces `confirm`, so the glyph for the confirm
      // control must show B's spec (and back → A) — matching the intent swap.
      expect(activeGlyphSet().confirm.label).to.eq(GLYPH_SETS.xbox.back.label); // 'B'
      expect(activeGlyphSet().back.label).to.eq(GLYPH_SETS.xbox.confirm.label); // 'A'
      // No other control moved.
      expect(activeGlyphSet().secondary.label).to.eq(GLYPH_SETS.xbox.secondary.label); // 'X'
    });
  });

  describe('state + cycle + persistence', () => {
    it('cycles Standard → Swap A/B → Standard', () => {
      expect(buttonLayoutChoice()).to.eq('standard');
      const seen = BUTTON_LAYOUT_CHOICES.map(() => cycleButtonLayout());
      expect(seen).to.deep.eq(['swap-ab', 'standard']);
    });
    it('setButtonLayout updates the reactive state', () => {
      setButtonLayout('swap-ab');
      expect(buttonLayoutState.layout).to.eq('swap-ab');
      expect(buttonLayoutChoice()).to.eq('swap-ab');
    });
  });
});
