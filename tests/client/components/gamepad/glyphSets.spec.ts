import {expect} from 'chai';
import {
  GLYPHSET_CHOICES,
  GLYPH_SETS,
  activeGlyphSet,
  currentGlyphSetChoice,
  cycleGlyphSetOverride,
  detectGlyphSet,
  resolveGlyphSetId,
  setGlyphSetOverride,
  updateDetectedGlyphSet,
} from '@/client/gamepad/glyphSets';

describe('glyphSets', () => {
  beforeEach(() => {
    // Deterministic baseline: follow detection, seeded to Xbox.
    setGlyphSetOverride('auto');
    updateDetectedGlyphSet('Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)');
  });

  describe('detectGlyphSet', () => {
    it('maps Xbox pads (and unknown/empty) to xbox', () => {
      expect(detectGlyphSet('Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)')).to.eq('xbox');
      expect(detectGlyphSet('Xbox Wireless Controller (Vendor: 045e Product: 0b12)')).to.eq('xbox');
      expect(detectGlyphSet('Standard Gamepad')).to.eq('xbox');
      expect(detectGlyphSet('')).to.eq('xbox');
    });

    it('maps Sony pads to playstation by vendor id or name', () => {
      expect(detectGlyphSet('Sony DualSense (Vendor: 054c Product: 0ce6)')).to.eq('playstation');
      expect(detectGlyphSet('DualShock 4 Wireless Controller')).to.eq('playstation');
      // Firefox id format: "vvvv-pppp-name".
      expect(detectGlyphSet('054c-0ce6-DualSense Wireless Controller')).to.eq('playstation');
    });

    it('maps Valve pads to steam by vendor id or explicit name', () => {
      expect(detectGlyphSet('Steam Controller (Vendor: 28de Product: 1102)')).to.eq('steam');
      expect(detectGlyphSet('Valve Steam Deck (Vendor: 28de Product: 1205)')).to.eq('steam');
    });

    it('leaves a Steam-Input-virtualized Xbox pad on xbox (its buttons are Xbox-mapped)', () => {
      expect(detectGlyphSet('Steam Virtual Gamepad')).to.eq('xbox');
      expect(detectGlyphSet('Microsoft X-Box 360 pad (Vendor: 045e Product: 028e)')).to.eq('xbox');
    });
  });

  describe('override vs detection', () => {
    it('follows the detected pad while on auto', () => {
      expect(currentGlyphSetChoice()).to.eq('auto');
      updateDetectedGlyphSet('Sony DualSense (Vendor: 054c Product: 0ce6)');
      expect(resolveGlyphSetId()).to.eq('playstation');
      updateDetectedGlyphSet('Steam Controller (Vendor: 28de Product: 1102)');
      expect(resolveGlyphSetId()).to.eq('steam');
    });

    it('a manual override wins over detection', () => {
      updateDetectedGlyphSet('Sony DualSense (Vendor: 054c Product: 0ce6)');
      setGlyphSetOverride('xbox');
      expect(resolveGlyphSetId()).to.eq('xbox');
      expect(activeGlyphSet().confirm.label).to.eq('A');
    });

    it('an empty id never changes the detected set', () => {
      updateDetectedGlyphSet('Sony DualSense (Vendor: 054c Product: 0ce6)');
      updateDetectedGlyphSet('');
      expect(resolveGlyphSetId()).to.eq('playstation');
    });

    it('cycles Auto → Xbox → PlayStation → Steam → Auto', () => {
      expect(currentGlyphSetChoice()).to.eq('auto');
      const seen = GLYPHSET_CHOICES.map(() => cycleGlyphSetOverride());
      expect(seen).to.deep.eq(['xbox', 'playstation', 'steam', 'auto']);
    });
  });

  it('every set defines the same controls, with PS shapes and Steam L1/L2 labels', () => {
    const xboxKeys = Object.keys(GLYPH_SETS.xbox).sort();
    expect(Object.keys(GLYPH_SETS.playstation).sort()).to.deep.eq(xboxKeys);
    expect(Object.keys(GLYPH_SETS.steam).sort()).to.deep.eq(xboxKeys);
    // PlayStation face buttons are shapes lined up with the physical layout.
    expect(GLYPH_SETS.playstation.confirm.label).to.eq('✕');
    expect(GLYPH_SETS.playstation.back.label).to.eq('◯');
    // Steam keeps Xbox letters but shows L1/L2 shoulders like its own prompts.
    expect(GLYPH_SETS.steam.confirm.label).to.eq('A');
    expect(GLYPH_SETS.steam.bumperL.label).to.eq('L1');
    expect(GLYPH_SETS.steam.triggerL.label).to.eq('L2');
  });
});
