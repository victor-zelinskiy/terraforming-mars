import {BoardName} from '@/common/boards/BoardName';
import {BoardArcConfigs, LARGE_ARCS, STANDARD_ARCS} from '@/client/components/board/arcScaleConfigs';

/**
 * THE BOARD'S LAYOUT FAMILY — the nine-row Mars every board but one shares, or the ELEVEN-ROW field of Amazonis
 * Planitia (91 hexes, rows 6 … 11 … 6). The family decides the hex positions (`board_large_positions.less`, scoped
 * under `.board-cont--large`), the planet's size behind them, the four dials (`LARGE_ARCS`), the off-Mars flank
 * (`console_board_large.less`) and the camera's focus frame. Phase 1 of the board's adaptation
 * (`docs/claude/amazonis-planitia-phase-1.md` § the field).
 */
export type BoardLayoutKind = 'standard' | 'large';

const LARGE_BOARDS: ReadonlySet<BoardName> = new Set([BoardName.AMAZONIS_PLANITIA]);

export function boardLayoutKind(boardName: BoardName | undefined): BoardLayoutKind {
  return boardName !== undefined && LARGE_BOARDS.has(boardName) ? 'large' : 'standard';
}

/** The four dials of a board. */
export function arcConfigsFor(boardName: BoardName | undefined): BoardArcConfigs {
  return boardLayoutKind(boardName) === 'large' ? LARGE_ARCS : STANDARD_ARCS;
}

/**
 * THE ELEVEN-ROW GRID IN BOARD PX — the ONE construction behind `board_large_positions.less` (its guard recomputes
 * every margin from here): the standard hex (46 × 51) at the standard pitch (49 across, 41 down), every row centred
 * on the planet's axis, the whole grid centred on the dials' centre — `.global-numbers` (300, 301), i.e. (223, 227)
 * in `.board`'s own space (`.board` stands at 93 / 85 in `.board-cont`, `.global-numbers` at 16 / 11). The hexes keep
 * their Tharsis size on purpose (the owner, 2026-11-06: «гексы предельно крупные»); the planet grows behind them.
 */
export const LARGE_BOARD_ROWS: ReadonlyArray<number> = [6, 7, 8, 9, 10, 11, 10, 9, 8, 7, 6];
export const HEX_W = 46;
export const HEX_H = 51;
export const HEX_PITCH_X = 49;
export const HEX_PITCH_Y = 41;
const GRID_CENTRE = {x: 223, y: 227};

/** Every Mars cell of the eleven-row grid in id order ('03' …), with its `.board`-space margin (top-left). */
export function largeBoardHexMargins(): Array<{id: string, top: number, left: number}> {
  const out: Array<{id: string, top: number, left: number}> = [];
  const mid = (LARGE_BOARD_ROWS.length - 1) / 2;
  let id = 3;
  LARGE_BOARD_ROWS.forEach((n, row) => {
    for (let i = 0; i < n; i++) {
      out.push({
        id: String(id++).padStart(2, '0'),
        top: GRID_CENTRE.y - HEX_H / 2 + (row - mid) * HEX_PITCH_Y,
        left: GRID_CENTRE.x - HEX_W / 2 + (i - (n - 1) / 2) * HEX_PITCH_X,
      });
    }
  });
  return out;
}
