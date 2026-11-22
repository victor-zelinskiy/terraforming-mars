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

/**
 * …AND THE «START SCENE» HOLD OF THE SAME CURTAIN: `scene-transition/hold-bound/start-scene` — the 8 s bound — under a
 * green `console-rise-to-power` C (a reload INSIDE a step the start hosts full-screen). The hold waited for the scene
 * to be VISIBLE, and a scene standing aside for its own guest is not going to be.
 */
describe('the start-scene hold of the boot curtain — the opening\'s composition stands, visible or aside', () => {
  const wiring = fs.readFileSync(path.resolve(__dirname, '../../src/client/console/shell/wiringController.ts'), 'utf8').replace(/\r\n/g, '\n');

  it('the hold is released by the scene on screen OR the scene mounted and standing aside — never by «visible» alone', () => {
    const at = wiring.indexOf('const releaseStart = deferSceneReveal(\'start-scene\', 8000);');
    expect(at, 'the hold is armed').to.be.greaterThan(0);
    const body = wiring.slice(at, wiring.indexOf('armSceneDestination();', at));
    expect(body).to.contain('const stands = (): boolean => shell.startSceneVisible || shell.startSceneMounted;');
    expect(body).to.match(/if \(stands\(\)\) \{\s+settle\(\);/);
    expect(body).to.match(/const stop = watch\(\s+stands,/);
    expect(body, 'the old wait for the scene\'s own paint alone').to.not.match(/watch\(\s+\(\) => shell\.startSceneVisible,/);
  });
});
