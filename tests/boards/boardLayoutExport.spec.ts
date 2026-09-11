import {expect} from 'chai';
import {buildBoardLayout, buildBoardLayouts} from '../../src/server/boards/boardLayoutExport';
import {BoardName} from '../../src/common/boards/BoardName';
import {SpaceType} from '../../src/common/boards/SpaceType';

/**
 * Guard for the static board-layout export consumed by the client board
 * miniatures (`src/genfiles/boardLayouts.json`, written by make:cards).
 * If an upstream board definition changes shape in a way the miniature
 * renderer cannot draw, this is where it fails — with the board named.
 */
describe('boardLayoutExport', () => {
  const ROWS = [5, 6, 7, 8, 9, 8, 7, 6, 5];

  it('exports every board with the full 61-hex Mars silhouette', () => {
    const layouts = buildBoardLayouts();
    for (const name of Object.values(BoardName)) {
      const layout = layouts[name];
      expect(layout, name).to.not.be.undefined;
      expect(layout.length, name).to.eq(61);
      for (let y = 0; y < ROWS.length; y++) {
        const row = layout.filter((s) => s.y === y);
        expect(row.length, `${name} row ${y}`).to.eq(ROWS[y]);
        const xOffset = 9 - ROWS[y];
        const xs = row.map((s) => s.x).sort((a, b) => a - b);
        expect(xs, `${name} row ${y} xs`).to.deep.eq(
          Array.from({length: ROWS[y]}, (_, i) => xOffset + i));
      }
    }
  });

  it('carries only Mars space types and numeric bonuses (JSON-safe)', () => {
    const layouts = buildBoardLayouts();
    const marsTypes = new Set([
      SpaceType.LAND, SpaceType.OCEAN, SpaceType.COVE,
      SpaceType.RESTRICTED, SpaceType.DEFLECTION_ZONE,
    ]);
    for (const name of Object.values(BoardName)) {
      for (const space of layouts[name]) {
        expect(marsTypes.has(space.t), `${name} type ${space.t}`).to.eq(true);
        for (const bonus of space.b) {
          expect(typeof bonus, `${name} bonus`).to.eq('number');
        }
      }
    }
  });

  it('reflects the real printed boards (spot checks)', () => {
    const tharsis = buildBoardLayout(BoardName.THARSIS);
    // Tharsis prints 12 ocean spaces and the three named volcanoes + Noctis row volcano.
    expect(tharsis.filter((s) => s.t === SpaceType.OCEAN).length).to.eq(12);
    expect(tharsis.filter((s) => s.v === true).length).to.be.greaterThan(0);

    const amazonis = buildBoardLayout(BoardName.AMAZONIS);
    expect(amazonis.some((s) => s.t === SpaceType.RESTRICTED)).to.eq(true);

    const hollandia = buildBoardLayout(BoardName.HOLLANDIA);
    expect(hollandia.some((s) => s.t === SpaceType.DEFLECTION_ZONE)).to.eq(true);
  });

  it('is deterministic (the unshuffled printed board)', () => {
    const a = buildBoardLayout(BoardName.HELLAS);
    const b = buildBoardLayout(BoardName.HELLAS);
    expect(a).to.deep.eq(b);
  });
});
