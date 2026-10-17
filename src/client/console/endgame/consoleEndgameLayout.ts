/*
 * CONSOLE FINAL SCORING — the pure GEOMETRY of the shared-scale bar.
 *
 * Everything the template needs to paint a seat's track is solved HERE, once
 * per VM — never per frame, never against a moving layout:
 *
 *  · SEGMENTS — one box per top-level category, absolute [leftPct, widthPct]
 *    against the SHARED maxTotal scale; sub-segments nested as fractions of
 *    their parent. The DOM renders ALL of them from the first frame; the
 *    ceremony only toggles classes (fill = scaleX — paint, never layout).
 *  · THE PENALTY RECLAIM — a subtractive category is not «one more segment»:
 *    the bar's tip physically RETREATS from the gross sum back to the net
 *    total, leaving a hatched scar over the reclaimed strip. The scar's
 *    geometry is [netPct … grossPct].
 *
 * The bar is the podium's counting INSTRUMENT (TR69): every category's exact
 * value stands in the seat's MEDALLION, so the bar carries no labels of its
 * own (the anchored label plan and the «+N» edge chip retired with the rows).
 *
 * NO Vue / DOM here — widths come in as numbers, results go out as numbers.
 */
import type {Color} from '@/common/Color';
import type {ConsoleEndgameVm} from '@/client/console/endgame/consoleEndgameModel';

export type EndgameSubGeo = {
  key: string;
  /** Percent of the PARENT segment. */
  leftPct: number;
  widthPct: number;
  /** Stable shade index (0..2) — dissolved to the parent hue on merge. */
  shade: number;
  /** Sub index inside the category (the reveal order). */
  idx: number;
};

export type EndgameSegGeo = {
  key: string;
  accent: string;
  /** Category index into vm.categories (class/state lookups). */
  catIdx: number;
  /** Percent of the full track (shared maxTotal scale). */
  leftPct: number;
  widthPct: number;
  value: number;
  subs: ReadonlyArray<EndgameSubGeo>;
};

export type EndgameRowGeo = {
  segs: ReadonlyArray<EndgameSegGeo>;
  /** The subtractive scar: [netPct … grossPct]. Absent without penalties. */
  reclaim?: {leftPct: number, widthPct: number, value: number, catIdx: number};
  /** The bar tip BEFORE penalties (percent). */
  grossPct: number;
  /** The bar tip AFTER penalties — the final settled edge (percent). */
  netPct: number;
};

/** Solve one row's full track geometry from the VM alone. */
export function buildRowGeometry(vm: ConsoleEndgameVm, color: Color): EndgameRowGeo {
  const max = Math.max(1, vm.maxTotal);
  const segs: Array<EndgameSegGeo> = [];
  let cum = 0;
  let penalty = 0;
  let penaltyCatIdx = -1;
  vm.categories.forEach((cat, catIdx) => {
    const value = cat.values[color] ?? 0;
    if (cat.penalty) {
      if (value < 0) {
        penalty += value;
        penaltyCatIdx = catIdx;
      }
      return;
    }
    if (value <= 0) {
      return;
    }
    const subs: Array<EndgameSubGeo> = [];
    if (cat.subs.length > 1) {
      let subCum = 0;
      cat.subs.forEach((sub, sidx) => {
        const sv = sub.values[color] ?? 0;
        if (sv > 0) {
          subs.push({
            key: sub.key,
            leftPct: (subCum / value) * 100,
            widthPct: (sv / value) * 100,
            shade: sidx % 3,
            idx: sidx,
          });
          subCum += sv;
        }
      });
    } else {
      subs.push({key: cat.key + ':0', leftPct: 0, widthPct: 100, shade: 0, idx: 0});
    }
    segs.push({
      key: cat.key,
      accent: cat.accent,
      catIdx,
      leftPct: (cum / max) * 100,
      widthPct: (value / max) * 100,
      value,
      subs,
    });
    cum += value;
  });
  const grossPct = (cum / max) * 100;
  const netPct = ((cum + penalty) / max) * 100;
  const geo: EndgameRowGeo = {segs, grossPct, netPct};
  if (penalty < 0) {
    geo.reclaim = {
      leftPct: netPct,
      widthPct: grossPct - netPct,
      value: penalty,
      catIdx: penaltyCatIdx,
    };
  }
  return geo;
}
