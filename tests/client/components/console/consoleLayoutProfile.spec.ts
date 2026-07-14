import {expect} from 'chai';
import {resolveProfile, explainProfile, computeTvUiScale} from '@/client/console/consoleLayoutProfile';

/**
 * P12: the console layout profile classification. Steam Deck (1280×800,
 * Electron fullscreen) is the handheld FLAGSHIP, but the rule is a
 * viewport heuristic — similar handhelds benefit, docked/large screens
 * never accidentally get the compact composition, and the shipped
 * standard design stays the 1080p default.
 *
 * TV-3: the tv profile keys on the PHYSICAL panel (screen × dpr) — the
 * flagship LG OLED42C34LA (3840×2160 16:9) resolves to `tv` at EVERY OS
 * scale factor, while desktop monitors and 16:10 laptop panels never do.
 */
describe('consoleLayoutProfile (P12 + TV)', () => {
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

  it('4K-class 16:9 panel → tv (the LG C3 42" flagship)', () => {
    // 4K @ OS 100%: viewport IS the panel.
    expect(resolveProfile(3840, 2160)).to.eq('tv');
    // 4K @ OS 150%: viewport 2560×1440, dpr 1.5 → physical 3840×2160.
    expect(resolveProfile(2560, 1440, {devicePixelRatio: 1.5, screenWidth: 2560, screenHeight: 1440})).to.eq('tv');
    // 4K @ OS 200%: viewport 1920×1080, dpr 2 → physical 3840×2160.
    expect(resolveProfile(1920, 1080, {devicePixelRatio: 2, screenWidth: 1920, screenHeight: 1080})).to.eq('tv');
    // 4K @ OS 300% (ROG Strix XG32UQ case): viewport 1280×720, dpr 3 —
    // still a 4K panel; the physical gate beats the small-viewport rule.
    expect(resolveProfile(1280, 720, {devicePixelRatio: 3, screenWidth: 1280, screenHeight: 720})).to.eq('tv');
  });

  it('desktop 1440p / ultrawide stay large (gentle boost, not tv)', () => {
    // A REAL 1440p monitor (dpr 1) is not a 4K-class panel.
    expect(resolveProfile(2560, 1440)).to.eq('large');
    expect(resolveProfile(2560, 1440, {devicePixelRatio: 1, screenWidth: 2560, screenHeight: 1440})).to.eq('large');
    // Ultrawide 3440×1440 — aspect 2.39, never a tv composition.
    expect(resolveProfile(3440, 1440, {devicePixelRatio: 1, screenWidth: 3440, screenHeight: 1440})).to.eq('large');
  });

  it('16:10 laptop hi-dpi panels are NOT tv (aspect gate)', () => {
    // 3200×2000 internal panel @ 200%: viewport 1600×1000 → handheld-ish?
    // No — height 1000 > 860 and width 1600 > 1366, so the aspect gate is
    // what matters: 1.6 is outside the 16:9 band.
    expect(resolveProfile(1600, 1000, {devicePixelRatio: 2, screenWidth: 1600, screenHeight: 1000})).to.eq('standard');
  });

  it('a small window ON a 4K TV is not tv (coverage gate)', () => {
    expect(resolveProfile(1600, 900, {devicePixelRatio: 2, screenWidth: 1920, screenHeight: 1080})).to.eq('standard');
  });

  it('docked Deck (external 1080p) is NOT handheld', () => {
    // Docked = the window IS the big screen — the compact composition
    // must never leak there.
    expect(resolveProfile(1920, 1080)).to.eq('standard');
  });

  it('short-but-wide windows still read as handheld (height rules)', () => {
    expect(resolveProfile(1920, 800)).to.eq('handheld');
  });

  it('explainProfile names the reason', () => {
    expect(explainProfile(3840, 2160).reason).to.contain('tv:');
    expect(explainProfile(1280, 800).reason).to.contain('handheld');
    expect(explainProfile(2560, 1440).reason).to.contain('large');
  });

  it('computeTvUiScale — the 1920×1080 logical space', () => {
    expect(computeTvUiScale(3840, 2160)).to.eq(2);
    expect(computeTvUiScale(1920, 1080)).to.eq(1);
    expect(computeTvUiScale(2560, 1440)).to.be.closeTo(4 / 3, 0.001);
    // Uniform X/Y: the tighter axis wins (no anisotropic stretch).
    expect(computeTvUiScale(3840, 1080)).to.eq(1);
    // A 4K panel at 300% OS scale (viewport 1280×720) must scale DOWN
    // honestly — the logical layout has to fit (the ROG overflow bug).
    expect(computeTvUiScale(1280, 720)).to.be.closeTo(2 / 3, 0.001);
    // Clamps: a technical zero-guard at the bottom…
    expect(computeTvUiScale(500, 400)).to.eq(0.4);
    // …and an absurd report caps at 2.5.
    expect(computeTvUiScale(7680, 4320)).to.eq(2.5);
  });
});
