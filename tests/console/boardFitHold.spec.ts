import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/**
 * THE BOOT CURTAIN's «BOARD FIT» HOLD IS RELEASED BY EVERY WAY ITS CONVERGENCE ENDS.
 *
 * `scene-transition/hold-bound/board-fit` — «hold "board-fit" hit its 6000ms bound — force-released» — stood under six
 * GREEN tests of the whole suite (CI, 2026-11-22: `console-effect-decision`, `console-card-discard` ×3,
 * `console-hydro-bonus-order`, `console-rail-value-badges`). The hold was released in ONE branch only — «the
 * calibration found no drift» — and at the mount when the stage was already hidden. Whenever the calibration was
 * never going to run, the curtain waited its whole bound: six seconds of loading screen for a player who reloaded
 * into a pending decision.
 */
describe('the board-fit hold of the boot curtain — every end of the convergence releases it', () => {
  const section = fs.readFileSync(path.resolve(__dirname, '../../src/client/components/console/ConsoleBoardSection.vue'), 'utf8').replace(/\r\n/g, '\n');
  const body = (from: string, to: string): string => section.slice(section.indexOf(from), section.indexOf(to, section.indexOf(from)));

  it('the hold is armed only under the boot curtain, bounded, and released at the mount by a hidden stage', () => {
    expect(section).to.match(/if \(loadingScreenState\.phase === 'covering'\) \{\s+fitSettleRelease = deferSceneReveal\('board-fit', 6000\);/);
    expect(section).to.match(/fitBoard\(\);\s+if \(stageKey\(\) === undefined\) \{\s+releaseFitSettleHold\(\);/);
  });

  it('a board that goes HIDDEN after its mount releases it (a boot into a workspace)', () => {
    const fit = body('function scheduleFit(): void {', 'function calibrate(): void {');
    expect(fit).to.match(/if \(key === undefined\) \{[\s\S]{0,260}releaseFitSettleHold\(\);\s+return;/);
  });

  it('a framing REPLAYED from memory is converged for the curtain too (a reload)', () => {
    const calibrate = body('function calibrate(): void {', 'function cellEl(');
    expect(calibrate).to.match(/calibrateLock\.value\.w === window\.innerWidth && calibrateLock\.value\.h === window\.innerHeight\) \{\s+releaseFitSettleHold\(\);/);
  });

  it('a boot into a live placement releases it — the focus fit is deterministic; a transient ban keeps the hold', () => {
    const calibrate = body('function calibrate(): void {', 'function cellEl(');
    expect(calibrate).to.match(/if \(planetFocusState\.phase !== 'idle'\) \{\s+releaseFitSettleHold\(\);\s+\}\s+return;/);
    // …and the settled pass, as ever.
    expect(calibrate).to.match(/if \(!sizeDrift && !offsetDrift\) \{\s+releaseFitSettleHold\(\);/);
  });

  it('…and an unmounting stage never strands the curtain', () => {
    expect(section).to.match(/releaseFitSettleHold\(\); \/\/ never strand the curtain on an unmounting stage/);
  });
});
