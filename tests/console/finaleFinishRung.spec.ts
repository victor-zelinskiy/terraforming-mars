import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/*
 * THE FINALE's «FINISH» IS THE BOARD's OWN VERB — offered where the board's bar offers it, and nowhere else (source
 * guard of `padRouterController.routeIntent`).
 *
 * The rung stands HIGH in the pad's ladder — above the wheels — because RT at the finale's cell choice is the finish
 * (a hold) and never the actions wheel. Standing that high it took RT off every screen opened OVER the pick, under a
 * bar that showed that screen's commands: an open inspection (Information Mode), a sheet or the hand (the real
 * browser's reading of the bar against the pad, 2026-11-21) — and an OPEN WHEEL, whose strip promises «RT — the other
 * wheel»: the first gated pass of whole games (2026-11-24, `bar-APART · quick > section:board`, nine presses of one
 * game) began the irreversible verb's hold nine times under it. Each of those screens is a condition of the rung.
 */
describe('the finale\'s finish rung of the pad — the board\'s own verb, never under a screen opened over the pick', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'client', 'console', 'shell', 'padRouterController.ts'), 'utf8');
  const at = source.indexOf('shell.beginFinalGreeneryFinish()');
  const rung = source.slice(source.lastIndexOf('if (shell.finalGreeneryPickPending', at), at);

  it('the rung exists and is the board section\'s', () => {
    expect(at, '«beginFinalGreeneryFinish» is still called from the pad').greaterThan(-1);
    expect(rung).to.include(`notePadRung('section:board')`);
    expect(rung).to.include(`intent.button === 'triggerR'`);
  });

  it('it stands only where the BOARD\'s bar stands: no inspection, no sheet, another section — and no open wheel', () => {
    for (const condition of ['!infoModeState.open', 'consoleState.quick === undefined', `consoleState.section === 'board'`, 'consoleState.sheet === undefined']) {
      expect(rung, condition).to.include(condition);
    }
  });
});
