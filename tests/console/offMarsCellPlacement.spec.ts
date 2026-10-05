import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {SpaceName} from '../../src/common/boards/SpaceName';
import {expansionSpaceColonies} from '../../src/common/boards/expansionSpaceColonies';
import {isHostedSpace} from '../../src/common/boards/hostedSpaces';
import {getSpecialCellInfo} from '../../src/client/components/board/specialCellInfo';
import {BoardName} from '../../src/common/boards/BoardName';
import {SpaceId} from '../../src/common/Types';

/*
 * THE OFF-MARS CELLS — a cell the board builder lays is a cell the board DRAWS, unless it is hosted.
 *
 * Every space colony is a row of `expansionSpaceColonies` (plus the two every board carries), and the board draws
 * each one BY NAME (`Board.vue`) — a row with no template line is a city the engine places and the player never sees.
 * A HOSTED cell (`hostedSpaces.ts` — Nova City, whose tile lies on a colony tile) is the one exception, and the
 * board must NOT draw it. Turmoil Redux TR27 Aurora Station is not hosted: its cell is the fifth of the Venus flank.
 *
 * And the console's flank is a CONSTRUCTION, never a nudge: every off-Mars cell it positions is board px-space
 * (`keep-px` — the planet's `transform: scale` owns the size), and no two of them stand closer than the flank's own
 * arm (≈59 px between centres, 58 at its tightest: the 46×51 hexes then never touch). A cell moved «a little» onto its neighbour fails here.
 */
const ROOT = path.resolve(__dirname, '..', '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const BOARD_VUE = read('src/client/components/Board.vue');
const CONSOLE_LESS = read('src/styles/console.less');

const SPACE_KEYS = Object.entries(SpaceName) as Array<[string, string]>;
const keyOf = (id: string) => SPACE_KEYS.find(([, value]) => value === id)?.[0];

/** Every off-Mars cell a game can lay: the two every board carries, then the module table. */
const OFF_MARS: ReadonlyArray<SpaceId> = [
  SpaceName.GANYMEDE_COLONY,
  SpaceName.PHOBOS_SPACE_HAVEN,
  ...expansionSpaceColonies.map((row) => row.name),
];

/** The console's positioned off-Mars cells: id → the margin's (top, left) in board px-space. */
function consoleCells(): Map<string, {top: number, left: number, line: string}> {
  const cells = new Map<string, {top: number, left: number, line: string}>();
  for (const line of CONSOLE_LESS.split('\n')) {
    const match = /\.board-space-(\d\d)\s*\{\s*margin:\s*([^;]+);\s*\}/.exec(line);
    if (match === null || !OFF_MARS.includes(match[1] as SpaceId)) {
      continue;
    }
    const parts = match[2].trim().split(/\s+/);
    expect(parts.every((part) => /^-?\d+(px)?$/.test(part)), `${match[1]}: ${line.trim()}`).is.true;
    expect(line, `${match[1]} is board px-space and says so`).contains('keep-px');
    cells.set(match[1], {top: parseFloat(parts[0]), left: parseFloat(parts[3]), line: line.trim()});
  }
  return cells;
}

describe('off-Mars cells — drawn by name, placed by construction', () => {
  it('every cell the builder can lay is drawn by the board, except a hosted one', () => {
    expect(OFF_MARS.length, 'anti-vacuous: the two base cells + the module table').gte(12);
    for (const id of OFF_MARS) {
      const key = keyOf(id);
      expect(key, `${id} is a SpaceName`).is.not.undefined;
      const drawn = BOARD_VUE.includes(`hasSpace(SpaceName.${key})`);
      expect(drawn, `${key} (${id}) ${isHostedSpace(id) ? 'is HOSTED and must not be drawn' : 'must be drawn by Board.vue'}`)
        .eq(!isHostedSpace(id));
    }
  });

  // Only the console places it: the shell is unconditional (`html.console-mode` always stands), so a desktop margin
  // in `board_items_positions.less` would be dead weight — and the desktop arc's next step lands on Ceres Spaceport.
  it('Aurora Station: an ordinary drawn cell with its name, positioned by the console', () => {
    expect(isHostedSpace(SpaceName.AURORA_STATION)).is.false;
    expect(getSpecialCellInfo(SpaceName.AURORA_STATION, BoardName.THARSIS)?.title).eq('Aurora Station');
    expect(getSpecialCellInfo(SpaceName.AURORA_STATION, BoardName.ELYSIUM)?.title, 'every board').eq('Aurora Station');
    expect(consoleCells().has(SpaceName.AURORA_STATION), 'console.less positions it').is.true;
  });

  it('the console flank is board px-space and no two cells stand closer than its arm', () => {
    const cells = [...consoleCells().entries()];
    expect(cells.length, 'anti-vacuous: the Venus flank, its mirror and Aurora').gte(8);
    const ARM = 58; // the arm is ≈59 (Stanford ↔ Ganymede reads 58.8 after the left flank's +6 px oxygen-rail clearance)
    for (let i = 0; i < cells.length; i++) {
      for (let j = i + 1; j < cells.length; j++) {
        const [a, pa] = cells[i];
        const [b, pb] = cells[j];
        const distance = Math.hypot(pa.left - pb.left, pa.top - pb.top);
        expect(distance, `${a} ↔ ${b}: ${distance.toFixed(1)} px\n  ${pa.line}\n  ${pb.line}`).gte(ARM);
      }
    }
  });

  it('Aurora Station closes the Venus flank as Dawn City does — the mirror of Maxwell about Dawn', () => {
    const cells = consoleCells();
    const maxwell = cells.get(SpaceName.MAXWELL_BASE)!;
    const dawn = cells.get(SpaceName.DAWN_CITY)!;
    const aurora = cells.get(SpaceName.AURORA_STATION)!;
    expect(aurora.top, 'Maxwell\'s row').eq(maxwell.top);
    expect(aurora.left - dawn.left, 'the same arm as Dawn − Maxwell').eq(dawn.left - maxwell.left);
  });
});
