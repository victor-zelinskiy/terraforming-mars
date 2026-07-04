import {expect} from 'chai';
import {resolveProfile} from '@/client/console/consoleLayoutProfile';

/**
 * P12: the console layout profile classification. Steam Deck (1280×800,
 * Electron fullscreen) is the handheld FLAGSHIP, but the rule is a
 * viewport heuristic — similar handhelds benefit, docked/large screens
 * never accidentally get the compact composition, and the shipped
 * standard design stays the 1080p default.
 */
describe('consoleLayoutProfile (P12)', () => {
  it('Steam Deck / handheld class → handheld', () => {
    expect(resolveProfile(1280, 800)).to.eq('handheld'); // the flagship
    expect(resolveProfile(1280, 720)).to.eq('handheld'); // 720p handhelds
    expect(resolveProfile(1366, 768)).to.eq('handheld'); // small laptops/TV boxes
    expect(resolveProfile(1152, 720)).to.eq('handheld');
  });

  it('1080p / desktop fullscreen → standard (do-no-harm baseline)', () => {
    expect(resolveProfile(1920, 1080)).to.eq('standard');
    expect(resolveProfile(1600, 900)).to.eq('standard');
    expect(resolveProfile(2048, 1152)).to.eq('standard');
  });

  it('4K / big TV → large', () => {
    expect(resolveProfile(3840, 2160)).to.eq('large');
    expect(resolveProfile(2560, 1440)).to.eq('large');
  });

  it('docked Deck (external 1080p) is NOT handheld', () => {
    // Docked = the window IS the big screen — the compact composition
    // must never leak there.
    expect(resolveProfile(1920, 1080)).to.eq('standard');
  });

  it('short-but-wide windows still read as handheld (height rules)', () => {
    expect(resolveProfile(1920, 800)).to.eq('handheld');
  });
});
