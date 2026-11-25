/*
 * THE BOOT MOUNTS IN TWO HALVES — the structure that keeps the console shell's first mount out of one long task
 * (FREEZE ZERO, the autopilot's zero bar: `[long-frame] 0.5 – 0.9 s … resolve-promise «import.then»` at the start of one
 * game in six on the box and on CI's runner — `wiringController.boardHalfMounted`).
 *
 * The board's half — the two rails, the board, and everything that binds the board's cells (the transport's binder,
 * the nested board inputs) — mounts one painted frame after the hull, in a task of its own. Two things would undo it
 * silently, and both are read here: a board-bound element that stands in the hull (it would bind cells that are not
 * there yet — or start the transport over no board), and a half that mounts in the hull's own task (a microtask, a
 * frame callback alone: no paint between the halves, one long frame again).
 */
import {expect} from 'chai';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');
const SHELL = path.join(ROOT, 'src/client/components/console/ConsoleShell.vue');
const WIRING = path.join(ROOT, 'src/client/console/shell/wiringController.ts');

/** The elements of the board's half: the rails, the board, and every binder of its cells. */
const BOARD_HALF = ['ConsoleResourcePanel', 'ConsoleBoardSection', 'ConsoleStrategyRail', 'console-board-binder', 'console-board-input'];

describe('the boot mounts in two halves — the board\'s half after the hull\'s painted frame', () => {
  const shell = fs.readFileSync(SHELL, 'utf8').replace(/\r\n/g, '\n');
  const template = shell.slice(shell.indexOf('<template>'), shell.lastIndexOf('</template>'));
  const wiring = fs.readFileSync(WIRING, 'utf8').replace(/\r\n/g, '\n');

  it('every element of the board\'s half is mounted by `boardHalfMounted` — none stands in the hull', () => {
    const openings = template.split('\n').filter((line) => BOARD_HALF.some((tag) => new RegExp(`<${tag}[\\s>]`).test(line)));
    expect(openings.length, 'the half\'s elements are found (anti-vacuous)').to.be.at.least(BOARD_HALF.length);
    const loose = openings.filter((line) => !/v-if="boardHalfMounted\b/.test(line)).map((line) => line.trim());
    expect(loose, 'a board-bound element in the hull binds cells that are not there yet (or starts the transport over no board)').to.deep.equal([]);
  });

  it('outside a boot curtain both halves mount at once; under it the half waits', () => {
    expect(wiring).to.match(/const boardHalfMounted = ref\(loadingScreenState\.phase !== 'covering'\);/);
  });

  it('the half mounts in a TASK of its own after a PAINTED frame (a frame callback, then a timer) — and at a bound where no frame paints', () => {
    const at = wiring.indexOf('function mountBoardHalf(): void {');
    expect(at, 'mountBoardHalf stands').to.be.greaterThan(0);
    const body = wiring.slice(at, wiring.indexOf('\n  }\n', at));
    expect(body, 'the curtain holds for the half').to.match(/deferSceneReveal\('boot-mount'/);
    expect(body, 'a frame callback first, a timer task inside it').to.match(/scope\.afterFrame\([^]*?scope\.after\(0,[^]*?mount\)/);
    expect(body, 'a page that paints no frame mounts it at the bound').to.match(/scope\.after\(BOARD_HALF_UNPAINTED_MS,/);
    expect(body, 'no microtask road into the half (it would be the hull\'s own task)').to.not.match(/queueMicrotask|Promise\.resolve\(\)\.then/);
  });
});
