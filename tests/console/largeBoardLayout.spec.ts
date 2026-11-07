import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {
  HEX_H, HEX_PITCH_X, HEX_PITCH_Y, HEX_W, LARGE_BOARD_ROWS, LARGE_CHIP_CLEARANCE, arcConfigsFor, boardLayoutKind, largeBoardGridPolygons,
  largeBoardHexMargins, largeChipClearance, largeGridClearance,
} from '../../src/client/components/board/largeBoardLayout';
import {DynamicArcConfig, LARGE_ARCS, LARGE_RING_GAP, LARGE_RING_RADIUS, STANDARD_ARCS} from '../../src/client/components/board/arcScaleConfigs';
import {scaleBonusZoneViews} from '../../src/client/components/board/scaleBonusZones';
import {BoardName} from '../../src/common/boards/BoardName';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {AmazonisPlanitiaBoard} from '../../src/server/boards/AmazonisPlanitiaBoard';
import {DEFAULT_GAME_OPTIONS} from '../../src/server/game/GameOptions';
import {SeededRandom} from '../../src/common/utils/Random';

/*
 * THE ELEVEN-ROW FIELD IS A CONSTRUCTION (Amazonis Planitia, phase 1 — `docs/claude/amazonis-planitia-phase-1.md` §
 * the field). The hex margins in `board_large_positions.less` are recomputed from `largeBoardHexMargins()` line by line,
 * the grid matches the server's own board row by row, and the four dials (`LARGE_ARCS`) are ONE RING (the owner,
 * 2026-11-07: «each scale looks at the next one by its EDGES», as on the classic board) checked against the grid the way
 * it was solved: one centre and one radius, one gap between every two ends, every band edge ≥ 6 px off every hex, every
 * Venus chip (the alternative board's full row — 10 chips) ≥ 4 px off it, every step readable, and the ring's height —
 * the binding axis of the fit — no taller than its radius allows (the owner: «гексы предельно крупные»).
 */
const ROOT = path.resolve(__dirname, '..', '..');
const LESS = fs.readFileSync(path.join(ROOT, 'src/styles/board_large_positions.less'), 'utf8');

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

  it('the four dials are ONE ring: one centre, one radius, one gap between every two ends, Venus and the oceans centred', () => {
    const {venus, oxygen, temperature, oceans} = LARGE_ARCS;
    for (const [name, cfg] of Object.entries(LARGE_ARCS)) {
      expect([cfg.center, cfg.bandRadius], name).deep.eq([venus.center, LARGE_RING_RADIUS]);
    }
    const gap = (a: number, b: number) => Math.round(Math.abs(((a - b) % 360 + 540) % 360 - 180) * 1000) / 1000;
    expect(gap(venus.startAngle, oxygen.endAngle), 'Venus 0 % ↔ oxygen 18 %').eq(LARGE_RING_GAP);
    expect(gap(venus.endAngle, temperature.endAngle), 'Venus 33 % ↔ +14 °C').eq(LARGE_RING_GAP);
    expect(gap(oceans.startAngle, oxygen.startAngle), 'the first ocean ↔ oxygen 0 %').eq(LARGE_RING_GAP);
    expect(gap(oceans.endAngle, temperature.startAngle), 'the eleventh ocean ↔ −30 °C').eq(LARGE_RING_GAP);
    expect((venus.startAngle + venus.endAngle) / 2, 'Venus over 12 o\'clock').closeTo(-90, 1e-9);
    expect((oceans.startAngle + oceans.endAngle) / 2, 'the oceans under 6 o\'clock').closeTo(90, 1e-9);
    expect(Math.abs(oxygen.endAngle - oxygen.startAngle), 'the side dials mirror each other').closeTo(Math.abs(temperature.endAngle - temperature.startAngle), 1e-9);
  });

  it('every dial clears the grid: band edges ≥ 6 px, the alternative Venus row\'s chips ≥ 4 px', () => {
    const grid = largeBoardGridPolygons();
    for (const [name, cfg] of Object.entries(LARGE_ARCS)) {
      const worst = Math.min(...bandEdge(cfg, -cfg.bandWidth / 2).map((p) => largeGridClearance(p, grid)));
      expect(worst, `${name}: the band's inner edge off the grid`).gte(6);
    }
    const chips = scaleBonusZoneViews({venus: true, altVenus: true}, BoardName.AMAZONIS_PLANITIA).filter((z) => z.scale === 'venus');
    expect(chips.map((c) => c.step), 'card · colony · TR · the alternative board\'s seven cells, starting later (24 %)')
      .deep.eq([8, 16, 22, 24, 26, 28, 30, 31, 32, 33]);
    const venus = LARGE_ARCS.venus;
    const step = (venus.endAngle - venus.startAngle) / (venus.digits.length - 1);
    for (const chip of chips) {
      const centre = {x: chip.left + chip.size / 2, y: chip.top + chip.size / 2};
      // ½ px for the chip's margin rounded to whole pixels.
      expect(largeChipClearance(centre, chip.size, grid), `${chip.key} off the grid`).gte(LARGE_CHIP_CLEARANCE - 0.5);
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
    // Tharsis measures 554; the ring is its diameter plus the band — nothing stands above or below it.
    expect(height, 'the dials\' height in board px').closeTo(2 * LARGE_RING_RADIUS + 22, 0.5);
  });
});
