import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {
  HEX_H, HEX_PITCH_X, HEX_PITCH_Y, HEX_W, LARGE_BOARD_ROWS, arcConfigsFor, boardLayoutKind, largeBoardHexMargins,
} from '../../src/client/components/board/largeBoardLayout';
import {DynamicArcConfig, LARGE_ARCS, STANDARD_ARCS} from '../../src/client/components/board/arcScaleConfigs';
import {scaleBonusZoneViews} from '../../src/client/components/board/scaleBonusZones';
import {BoardName} from '../../src/common/boards/BoardName';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {AmazonisPlanitiaBoard} from '../../src/server/boards/AmazonisPlanitiaBoard';
import {DEFAULT_GAME_OPTIONS} from '../../src/server/game/GameOptions';
import {SeededRandom} from '../../src/common/utils/Random';

/*
 * THE ELEVEN-ROW FIELD IS A CONSTRUCTION (Amazonis Planitia, phase 1 — `docs/claude/amazonis-planitia-phase-1.md` §
 * the field). The hex margins in `board_large_positions.less` are recomputed from `largeBoardHexMargins()` line by line,
 * the grid matches the server's own board row by row, and the four dials (`LARGE_ARCS`) are checked against the grid
 * the same way they were solved: every band edge clears every hex by ≥ 12 px, every Venus chip (the alternative board's
 * full row — 13 chips) by ≥ 6 px, the dials do not touch one another, and the content's height stays within the budget
 * that keeps the hex ≈ 94 % of its Tharsis size on screen (the owner, 2026-11-06: «гексы предельно крупные»).
 */
const ROOT = path.resolve(__dirname, '..', '..');
const LESS = fs.readFileSync(path.join(ROOT, 'src/styles/board_large_positions.less'), 'utf8');

/** The grid's hexes as polygons in `.global-numbers` space (the dials' space): `.board` + (93, 85) − (16, 11). */
function gridPolygons(): Array<Array<{x: number, y: number}>> {
  return largeBoardHexMargins().map(({top, left}) => {
    const cx = left + HEX_W / 2 + 93 - 16;
    const cy = top + HEX_H / 2 + 85 - 11;
    const hw = HEX_W / 2;
    const hh = HEX_H / 2;
    return [
      {x: cx, y: cy - hh}, {x: cx + hw, y: cy - hh / 2}, {x: cx + hw, y: cy + hh / 2},
      {x: cx, y: cy + hh}, {x: cx - hw, y: cy + hh / 2}, {x: cx - hw, y: cy - hh / 2},
    ];
  });
}

function segmentDistance(p: {x: number, y: number}, a: {x: number, y: number}, b: {x: number, y: number}): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function inside(p: {x: number, y: number}, poly: ReadonlyArray<{x: number, y: number}>): boolean {
  let sign = 0;
  for (let k = 0; k < poly.length; k++) {
    const a = poly[k];
    const b = poly[(k + 1) % poly.length];
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    const s = Math.sign(cross);
    if (s !== 0 && sign !== 0 && s !== sign) {
      return false;
    }
    sign = s === 0 ? sign : s;
  }
  return true;
}

function gridClearance(p: {x: number, y: number}, grid: ReadonlyArray<ReadonlyArray<{x: number, y: number}>>): number {
  let best = Infinity;
  for (const poly of grid) {
    if (inside(p, poly)) {
      return 0;
    }
    for (let k = 0; k < poly.length; k++) {
      best = Math.min(best, segmentDistance(p, poly[k], poly[(k + 1) % poly.length]));
    }
  }
  return best;
}

function bandEdge(cfg: DynamicArcConfig, offset: number, samples = 40): Array<{x: number, y: number}> {
  const out: Array<{x: number, y: number}> = [];
  for (let k = 0; k <= samples; k++) {
    const a = (cfg.startAngle + (cfg.endAngle - cfg.startAngle) * k / samples) * Math.PI / 180;
    out.push({x: cfg.center.x + (cfg.bandRadius + offset) * Math.cos(a), y: cfg.center.y + (cfg.bandRadius + offset) * Math.sin(a)});
  }
  return out;
}

describe('the eleven-row field (Amazonis Planitia) — a construction', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(20_000);

  it('only Amazonis Planitia is large; every other board keeps the classic ring', () => {
    for (const board of Object.values(BoardName)) {
      expect(boardLayoutKind(board), board).eq(board === BoardName.AMAZONIS_PLANITIA ? 'large' : 'standard');
      expect(arcConfigsFor(board), board).eq(board === BoardName.AMAZONIS_PLANITIA ? LARGE_ARCS : STANDARD_ARCS);
    }
  });

  it('the grid is the server board, row for row, at the standard hex and pitch', () => {
    const board = AmazonisPlanitiaBoard.newInstance({...DEFAULT_GAME_OPTIONS, boardName: BoardName.AMAZONIS_PLANITIA}, new SeededRandom(1));
    const mars = board.spaces.filter((s) => s.spaceType !== SpaceType.COLONY);
    const margins = largeBoardHexMargins();
    expect(margins.map((m) => m.id)).deep.eq(mars.map((s) => s.id));
    const rows = LARGE_BOARD_ROWS.map((_, y) => mars.filter((s) => s.y === y).length);
    expect(rows).deep.eq([...LARGE_BOARD_ROWS]);
    expect([HEX_W, HEX_H, HEX_PITCH_X, HEX_PITCH_Y], 'the Tharsis hex, never shrunk').deep.eq([46, 51, 49, 41]);
  });

  it('every margin of board_large_positions.less is the construction\'s', () => {
    const px = (v: number) => (Number.isInteger(v) ? String(v) : String(v)) + 'px';
    for (const m of largeBoardHexMargins()) {
      const line = `.board-space-${m.id} { margin: ${px(m.top)} 0 0 ${px(m.left)}; }`;
      expect(LESS, `${m.id}`).contains(line);
    }
    const lines = LESS.split('\n').filter((l) => /\.board-space-\d\d\s*\{/.test(l));
    expect(lines.length, 'one line per Mars cell, nothing else').eq(91);
  });

  it('every dial clears the grid: band edges ≥ 12 px, the alternative Venus row\'s chips ≥ 6 px', () => {
    const grid = gridPolygons();
    for (const [name, cfg] of Object.entries(LARGE_ARCS)) {
      const worst = Math.min(...bandEdge(cfg, -cfg.bandWidth / 2).map((p) => gridClearance(p, grid)));
      expect(worst, `${name}: the band's inner edge off the grid`).gte(12);
    }
    const chips = scaleBonusZoneViews({venus: true, altVenus: true}, BoardName.AMAZONIS_PLANITIA).filter((z) => z.scale === 'venus');
    expect(chips.length, 'anti-vacuous: card · colony · TR · ten resource cells').eq(13);
    const venus = LARGE_ARCS.venus;
    const step = (venus.endAngle - venus.startAngle) / (venus.digits.length - 1);
    for (const chip of chips) {
      const centre = {x: chip.left + chip.size / 2, y: chip.top + chip.size / 2};
      expect(gridClearance(centre, grid) - chip.size / 2, `${chip.key} off the grid`).gte(6);
      // …and the row stays on its own track: no chip past half a step beyond the 0 % / 33 % ends.
      const angle = Math.atan2(centre.y - venus.center.y, centre.x - venus.center.x) * 180 / Math.PI;
      expect(angle, `${chip.key} within the track`).within(venus.startAngle - step / 2, venus.endAngle + step / 2);
    }
    for (let i = 0; i < chips.length; i++) {
      for (let j = i + 1; j < chips.length; j++) {
        const d = Math.hypot(chips[i].left - chips[j].left, chips[i].top - chips[j].top);
        expect(d, `${chips[i].key} ↔ ${chips[j].key} never overlap`).gte(chips[i].size);
      }
    }
  });

  it('the dials keep their distance from one another (≥ 16 px between bands)', () => {
    const entries = Object.entries(LARGE_ARCS);
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const [na, a] = entries[i];
        const [nb, b] = entries[j];
        const pa = [...bandEdge(a, -a.bandWidth / 2), ...bandEdge(a, a.bandWidth / 2)];
        const pb = [...bandEdge(b, -b.bandWidth / 2), ...bandEdge(b, b.bandWidth / 2)];
        const d = Math.min(...pa.flatMap((p) => pb.map((q) => Math.hypot(p.x - q.x, p.y - q.y))));
        expect(d, `${na} ↔ ${nb}`).gte(16);
      }
    }
  });

  it('every step is readable on the dial (≥ 22 px between values) and the content height stays within budget', () => {
    for (const [name, cfg] of Object.entries(LARGE_ARCS)) {
      const spacing = cfg.bandRadius * Math.abs(cfg.endAngle - cfg.startAngle) * Math.PI / 180 / (cfg.digits.length - 1);
      expect(spacing, name).gte(22);
    }
    const ys = Object.values(LARGE_ARCS).flatMap((cfg) => [...bandEdge(cfg, -cfg.bandWidth / 2), ...bandEdge(cfg, cfg.bandWidth / 2)].map((p) => p.y));
    const height = Math.max(...ys) - Math.min(...ys);
    // Tharsis measures 554; the field's budget is +8 % (the hex keeps ≥ 92 % of its size on screen).
    expect(height, 'the dials\' height in board px').lte(600);
  });
});
