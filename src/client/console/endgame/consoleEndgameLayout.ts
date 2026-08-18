/*
 * CONSOLE FINAL SCORING — the pure GEOMETRY of the shared-scale bar.
 *
 * Everything the template needs to paint a row's track is solved HERE, once
 * per VM (and once per measured track width for the labels) — never per
 * frame, never against a moving layout:
 *
 *  · SEGMENTS — one box per top-level category, absolute [leftPct, widthPct]
 *    against the SHARED maxTotal scale; sub-segments nested as fractions of
 *    their parent. The DOM renders ALL of them from the first frame; the
 *    ceremony only toggles classes (fill = scaleX — paint, never layout).
 *  · THE PENALTY RECLAIM — a subtractive category is not «one more segment»:
 *    the bar's tip physically RETREATS from the gross sum back to the net
 *    total, leaving a hatched scar over the reclaimed strip. The scar's
 *    geometry is [netPct … grossPct].
 *  · VALUE LABELS — every category's exact value, ANCHORED to its segment:
 *    inside the segment when the box affords the digits, on the rail below
 *    otherwise, with deterministic collision nudges (a label may never
 *    overlap its neighbour or leave the track). Zero values keep a small
 *    honest «0» at the position the segment would have had.
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

/** The bar-edge percent after the first `n` categories (the «+N» chip rides
 *  this edge; sub progress moves it inside the active category). */
export function progressEdgePct(
  vm: ConsoleEndgameVm,
  color: Color,
  catsSettled: number,
  activeCatIdx: number,
  subsOnForActive: number,
): number {
  const max = Math.max(1, vm.maxTotal);
  let cum = 0;
  vm.categories.forEach((cat, idx) => {
    const value = cat.values[color] ?? 0;
    if (idx < catsSettled) {
      cum += value;
      return;
    }
    if (idx !== activeCatIdx) {
      return;
    }
    if (cat.subs.length > 1) {
      for (let s = 0; s < subsOnForActive && s < cat.subs.length; s++) {
        cum += cat.subs[s].values[color] ?? 0;
      }
    } else {
      cum += value;
    }
  });
  return Math.min(100, Math.max(0, (cum / max) * 100));
}

// ── value labels ───────────────────────────────────────────────────────────

export type EndgameValueLabel = {
  /** The category this value belongs to (label identity + settle timing). */
  catIdx: number;
  key: string;
  accent: string;
  value: number;
  /** INSIDE the segment box (wide enough) or on the rail BELOW the bar. */
  mode: 'inside' | 'below';
  /** Anchor centre, percent of the track. */
  xPct: number;
  /** Deterministic collision nudge, px (below-rail labels only). */
  nudgePx: number;
  /** A zero-value entry (rendered small and dim — honest, never loud). */
  zero: boolean;
};

export type ValueLabelOptions = {
  /** Measured track width, px. */
  trackPx: number;
  /** Approximate width of one digit glyph, px (tabular-nums). */
  charPx: number;
  /** Horizontal padding a label needs inside a segment, px (both sides). */
  insidePadPx: number;
  /** Minimal clear gap between neighbouring below-rail labels, px. */
  minGapPx: number;
};

function labelTextWidthPx(value: number, charPx: number): number {
  const digits = String(Math.abs(value)).length + (value < 0 ? 1 : 0);
  return digits * charPx;
}

/**
 * Plan the settled value labels for one row. Deterministic:
 *  1. wide-enough segments take their value INSIDE the box;
 *  2. everything else drops to the rail below, anchored at its segment's
 *     centre (zero categories anchor at the boundary the segment would
 *     occupy), then a left-to-right sweep resolves collisions by nudging
 *     rightward, and a final clamp+backward sweep keeps the tail on-track.
 */
export function planValueLabels(
  vm: ConsoleEndgameVm,
  color: Color,
  geo: EndgameRowGeo,
  opts: ValueLabelOptions,
): Array<EndgameValueLabel> {
  const {trackPx, charPx, insidePadPx, minGapPx} = opts;
  const labels: Array<EndgameValueLabel> = [];
  const segByCat = new Map(geo.segs.map((s) => [s.catIdx, s]));

  let cumPct = 0;
  vm.categories.forEach((cat, catIdx) => {
    const value = cat.values[color] ?? 0;
    if (cat.penalty) {
      if (geo.reclaim !== undefined && geo.reclaim.catIdx === catIdx) {
        labels.push({
          catIdx, key: cat.key, accent: cat.accent, value: geo.reclaim.value,
          mode: 'below',
          xPct: geo.reclaim.leftPct + geo.reclaim.widthPct / 2,
          nudgePx: 0, zero: false,
        });
      } else {
        // An honest 0 for the penalty category too — anchored at the tip.
        labels.push({
          catIdx, key: cat.key, accent: cat.accent, value: 0,
          mode: 'below', xPct: cumPct, nudgePx: 0, zero: true,
        });
      }
      return;
    }
    const seg = segByCat.get(catIdx);
    if (seg === undefined) {
      // Zero-value category: a small honest 0 at the boundary position.
      labels.push({
        catIdx, key: cat.key, accent: cat.accent, value: 0,
        mode: 'below', xPct: cumPct, nudgePx: 0, zero: true,
      });
      return;
    }
    const segPx = (seg.widthPct / 100) * trackPx;
    const needPx = labelTextWidthPx(value, charPx) + insidePadPx;
    const centre = seg.leftPct + seg.widthPct / 2;
    if (segPx >= needPx) {
      labels.push({
        catIdx, key: cat.key, accent: cat.accent, value,
        mode: 'inside', xPct: centre, nudgePx: 0, zero: false,
      });
    } else {
      labels.push({
        catIdx, key: cat.key, accent: cat.accent, value,
        mode: 'below', xPct: centre, nudgePx: 0, zero: false,
      });
    }
    cumPct = seg.leftPct + seg.widthPct;
  });

  // Collision resolution for the below-rail labels (inside labels live in
  // their own boxes and cannot collide). Work in px centres.
  const below = labels.filter((l) => l.mode === 'below');
  const halfW = (l: EndgameValueLabel) =>
    (labelTextWidthPx(l.value, charPx) + (l.zero ? 0 : minGapPx)) / 2;
  const centres = below.map((l) => (l.xPct / 100) * trackPx);
  // Forward sweep: push right until every neighbour pair clears.
  for (let i = 1; i < below.length; i++) {
    const minCentre = centres[i - 1] + halfW(below[i - 1]) + halfW(below[i]);
    if (centres[i] < minCentre) {
      centres[i] = minCentre;
    }
  }
  // Clamp the tail onto the track, then a backward sweep keeps the order.
  for (let i = below.length - 1; i >= 0; i--) {
    const maxCentre = trackPx - halfW(below[i]);
    if (centres[i] > maxCentre) {
      centres[i] = maxCentre;
    }
    if (i < below.length - 1) {
      const limit = centres[i + 1] - halfW(below[i + 1]) - halfW(below[i]);
      if (centres[i] > limit) {
        centres[i] = limit;
      }
    }
  }
  // Head clamp (a crowd shoved leftward may not leave the track either).
  for (let i = 0; i < below.length; i++) {
    const minCentre = halfW(below[i]);
    if (centres[i] < minCentre) {
      centres[i] = minCentre;
    }
    below[i].nudgePx = centres[i] - (below[i].xPct / 100) * trackPx;
  }
  return labels;
}
