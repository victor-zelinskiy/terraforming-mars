import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/*
 * THE FLEET-DOCK SCENE KEEPS ONE CLOCK (docs/TURMOIL_REDUX_WATER_HAULING.md §8;
 * docs/claude/gameplay-polish-ledger.md PL-003). Its beats are GSAP timelines
 * (the card's answer, the reward's flight) and compositor transitions (the
 * card's departure, the workspace's leave); the waits BETWEEN them ran on
 * `window.setTimeout` — a wall clock that keeps going through a starved frame
 * and a hidden tab, so the read ended before the answer had been painted and
 * the workspace was sent away under a card still in the middle of its beat.
 * Every wait of the scene is `gsap.delayedCall` now, and its hold is released
 * by the workspace root leaving the document (an observer) — never a timer.
 * Static, so a regression fails in seconds and names the line.
 */
const ROOT = path.join(__dirname, '..', '..');
const FILES = [
  path.join('src', 'client', 'components', 'console', 'ConsoleFleetDockStage.vue'),
  path.join('src', 'client', 'console', 'colonyTrade', 'fleetDockScene.ts'),
];

/** Strip line + block comments so the rule never fires on prose about itself. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('the fleet-dock scene — one clock (static guard)', () => {
  it('no setTimeout / setInterval in the stage and its scene module', () => {
    const offenders: Array<string> = [];
    for (const rel of FILES) {
      const lines = stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8')).split('\n');
      lines.forEach((line, i) => {
        if (/\b(setTimeout|setInterval)\s*\(/.test(line)) {
          offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(offenders, 'wall-clock timers in the dock scene (wait on gsap.delayedCall; release a hold by its own completion signal):\n' + offenders.join('\n')).deep.eq([]);
  });

  it('the stage\'s waits are on the animation clock', () => {
    const stage = stripComments(fs.readFileSync(path.join(ROOT, FILES[0]), 'utf8'));
    expect(stage, 'the scene waits through gsap.delayedCall').to.match(/gsap\.delayedCall\(/);
  });
});
