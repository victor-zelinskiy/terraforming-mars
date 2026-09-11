import {BoardName} from './BoardName';
import {SpaceBonus} from './SpaceBonus';
import {SpaceType} from './SpaceType';

/**
 * Static per-board layout data for board miniatures («карточки полей»).
 *
 * Generated at build time from the REAL server board definitions
 * (`src/server/boards/*Board.ts` via `buildBoardLayouts()` — the same
 * BoardBuilder rows a live game deals from, unshuffled), exported into
 * `src/genfiles/boardLayouts.json` by `make:cards`, and consumed by the
 * client miniature renderer. This is what makes a campaign mission card an
 * exact picture of its board — real ocean zones, volcanic sites, restricted
 * cells and printed placement bonuses — instead of a stylized heatmap.
 *
 * The shape is deliberately compact (it ships in the client bundle for all
 * 11 boards): one entry per ON-MARS space, colony spaces excluded.
 */
export type BoardLayoutSpace = {
  /** Column in the server board grid (already carries the row offset). */
  x: number;
  /** Row 0..8. Every Mars board is the 5-6-7-8-9-8-7-6-5 silhouette. */
  y: number;
  /** SpaceType value: 'land' | 'ocean' | 'cove' | 'restricted' | 'deflection'. */
  t: SpaceType;
  /** Volcanic site (Tharsis/Elysium named volcanoes, …). */
  v?: true;
  /** Printed placement bonuses, in printed order. */
  b: ReadonlyArray<SpaceBonus>;
};

export type BoardLayouts = Record<BoardName, ReadonlyArray<BoardLayoutSpace>>;
