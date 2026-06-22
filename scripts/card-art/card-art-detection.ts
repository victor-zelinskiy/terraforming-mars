// Structural / layout-based art-panel detector (v3).
//
// This is NOT semantic segmentation (SAM) and NOT "find a photo rectangle" (v1).
// The art panel is defined by the card's LAYOUT, so we detect the layout:
//   - sides   = inner edges of the coloured card FRAME
//   - top     = bottom of the TITLE bar (and, on ACTIVE cards, the ACTION panel)
//   - bottom  = top of the decorative SEPARATOR arc (the code-capsule band)
// We take the WHOLE art panel inside those boundaries (coverage-first). Thin
// frame/separator remnants left at the boundary are removed afterwards by the
// accent edge-cleanup pass (cleanupAccentEdges) — NOT by shrinking the mask.
//
// Credits printed INSIDE the art (NASA / ESA / artist) are KEPT — they are part
// of the illustration; only card UI is removed.

import type {RawImage} from './card-art-image-utils';
import {clamp} from './card-art-image-utils';
import type {ExtractionPlan, MaskShape, NormalizedRect, Point} from './card-art-types';

const METHOD = 'structural-detector-v3';

interface HSV {
  h: number;
  s: number;
  v: number;
}

function rgb2hsv(r: number, g: number, b: number): HSV {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn), d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return {h, s: max === 0 ? 0 : d / max, v: max};
}

function hueDist(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function px(img: RawImage, x: number, y: number): HSV {
  const i = (y * img.width + x) * 3;
  return rgb2hsv(img.data[i], img.data[i + 1], img.data[i + 2]);
}

function meanHue(samples: HSV[]): HSV {
  let hx = 0, hy = 0, s = 0, v = 0, n = 0;
  for (const p of samples) {
    if (p.s > 0.28 && p.v > 0.2 && p.v < 0.97) {
      hx += Math.cos((p.h * Math.PI) / 180);
      hy += Math.sin((p.h * Math.PI) / 180);
      s += p.s; v += p.v; n++;
    }
  }
  if (n === 0) return {h: 130, s: 0.5, v: 0.6};
  let h = (Math.atan2(hy, hx) * 180) / Math.PI;
  if (h < 0) h += 360;
  return {h, s: s / n, v: v / n};
}

function isAccent(p: HSV, accent: HSV, hueTol = 28): boolean {
  return p.s > 0.3 && p.v > 0.2 && p.v < 0.97 && hueDist(p.h, accent.h) < hueTol;
}

function normalize(arr: number[]): number[] {
  const s = [...arr].sort((a, b) => a - b);
  const lo = s[Math.floor(s.length * 0.05)] ?? 0;
  const hi = s[Math.floor(s.length * 0.95)] ?? 1;
  const span = hi - lo;
  if (span <= 1e-6) return arr.map(() => 0);
  return arr.map((v) => clamp((v - lo) / span, 0, 1));
}

interface RowFeat {
  accent: number; // accentFrac (band hue), 0..1
  sat: number; // satFrac: fraction of saturated pixels (any hue), 0..1
  white: number; // bright low-sat fraction, 0..1
  dark: number; // dark-ink fraction (v<0.34), 0..1
  meanV: number; // mean brightness, 0..1
  meanS: number; // mean saturation, 0..1
  colorVar: number; // normalized colour texture, 0..1
  varL: number; // normalized luminance texture, 0..1
}

function rowFeatures(img: RawImage, accent: HSV, x0: number, x1: number): RowFeat[] {
  const W = img.width, H = img.height, inner = Math.max(1, x1 - x0);
  const rawCV: number[] = new Array(H);
  const rawVL: number[] = new Array(H);
  const acc: number[] = new Array(H);
  const sat: number[] = new Array(H);
  const wht: number[] = new Array(H);
  const drk: number[] = new Array(H);
  const mv: number[] = new Array(H);
  const ms: number[] = new Array(H);
  for (let y = 0; y < H; y++) {
    let a = 0, sa = 0, w = 0, dk = 0, sumV = 0, sumS = 0, sumL = 0, sumL2 = 0, sumRg = 0, sumRg2 = 0, sumYb = 0, sumYb2 = 0;
    const base = y * W * 3;
    for (let x = x0; x < x1; x++) {
      const i = base + x * 3;
      const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
      const p = rgb2hsv(r, g, b);
      if (isAccent(p, accent)) a++;
      if (p.s > 0.35 && p.v > 0.25) sa++;
      if (p.v > 0.82 && p.s < 0.15) w++;
      if (p.v < 0.34) dk++;
      sumV += p.v; sumS += p.s;
      const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const rg = r - g, yb = 0.5 * (r + g) - b;
      sumL += L; sumL2 += L * L; sumRg += rg; sumRg2 += rg * rg; sumYb += yb; sumYb2 += yb * yb;
    }
    const meanL = sumL / inner;
    rawVL[y] = Math.max(0, sumL2 / inner - meanL * meanL);
    const mRg = sumRg / inner, mYb = sumYb / inner;
    rawCV[y] = Math.sqrt(Math.max(0, sumRg2 / inner - mRg * mRg) + Math.max(0, sumYb2 / inner - mYb * mYb));
    acc[y] = a / inner;
    sat[y] = sa / inner;
    wht[y] = w / inner;
    drk[y] = dk / inner;
    mv[y] = sumV / inner;
    ms[y] = sumS / inner;
  }
  const nCV = normalize(rawCV), nVL = normalize(rawVL);
  return acc.map((_, y) => ({accent: acc[y], sat: sat[y], white: wht[y], dark: drk[y], meanV: mv[y], meanS: ms[y], colorVar: nCV[y], varL: nVL[y]}));
}

export interface StructuralResult {
  includeMasks: MaskShape[];
  canvas: NormalizedRect;
  accent: {hue: number; sat: number};
  diagnostics: Record<string, number | string>;
  warnings: string[];
}

export function detectStructural(img: RawImage): StructuralResult {
  const W = img.width, H = img.height;
  const warnings: string[] = [];

  // --- accent colours: frame (sides) + band (title/separator) ---
  const frameSamples: HSV[] = [];
  for (let y = Math.round(H * 0.25); y < Math.round(H * 0.75); y++)
    for (let x = 2; x < Math.round(W * 0.02); x++) frameSamples.push(px(img, x, y));
  const frameAccent = meanHue(frameSamples);
  const bandSamples: HSV[] = [];
  for (let y = Math.round(H * 0.09); y < Math.round(H * 0.135); y++)
    for (let x = Math.round(W * 0.15); x < Math.round(W * 0.85); x++) bandSamples.push(px(img, x, y));
  const bandAccent = meanHue(bandSamples);

  // --- side inner-frame edges: skip the leading card-stock margin, traverse the
  //     coloured frame (incl. its inner glow — accent-tinted AND vertically SMOOTH),
  //     and stop at the first real ART column (textured). Uniformity is what
  //     separates the frame/glow from textured art that shares the accent hue. ---
  const colStats = (x: number) => {
    let acc = 0, n = 0, sumL = 0, sumL2 = 0;
    for (let y = Math.round(H * 0.32); y < Math.round(H * 0.68); y++) {
      const p = px(img, x, y);
      if (isAccent(p, frameAccent, 34)) acc++;
      sumL += p.v; sumL2 += p.v * p.v; n++;
    }
    return {accent: acc / n, varL: sumL2 / n - (sumL / n) ** 2};
  };
  // A frame column is STRONGLY accent + vertically very UNIFORM (full-height
  // solid colour). Textured accent ART (an orange fireball reaching the edge) is
  // not uniform → never mistaken for frame. Search only the outer ~10% and DEFAULT
  // to a near-edge boundary if no clean inner edge is found (keep full coverage).
  const isFrameCol = (x: number): boolean => {
    const s = colStats(x);
    return s.accent > 0.45 && s.varL < 0.025;
  };
  let left = Math.round(W * 0.035);
  {
    let seen = false;
    for (let x = 0; x < Math.round(W * 0.1); x++) {
      if (isFrameCol(x)) seen = true;
      else if (seen) { left = x; break; }
    }
  }
  let right = W - 1 - Math.round(W * 0.035);
  {
    let seen = false;
    for (let x = W - 1; x > Math.round(W * 0.9); x--) {
      if (isFrameCol(x)) seen = true;
      else if (seen) { right = x; break; }
    }
  }
  const fx0 = left, fx1 = right;

  const rows = rowFeatures(img, bandAccent, fx0, fx1);

  // --- title band bottom: contiguous full-width accent + UNIFORM band [0.05,0.24] ---
  let titleBottom = -1;
  for (let y = Math.round(H * 0.05); y < Math.round(H * 0.24); y++) {
    if (rows[y].accent > 0.45 && rows[y].varL < 0.35) titleBottom = y;
    else if (titleBottom >= 0 && rows[y].accent < 0.3) break;
  }
  if (titleBottom < 0) { titleBottom = Math.round(H * 0.14); warnings.push('title band not found'); }

  // --- art top: an ACTION/effect panel is recognised by its METALLIC curved
  //     BORDER (a smooth full-width gray arc) with a light-UI background above it.
  //     This keys on the panel's structure, not the art's hue, so orange/blue/dark
  //     art is never mistaken for a panel and textured art is never cut. ---
  const lightUI = (f: RowFeat) => f.meanV > 0.62 && f.meanS < 0.24 && f.varL < 0.35;
  const metallic = (f: RowFeat) =>
    f.meanS < 0.18 && f.meanV > 0.5 && f.meanV < 0.86 && f.colorVar < 0.22 && f.varL < 0.32;
  const smoothAccent = (f: RowFeat) => f.accent > 0.4 && f.varL < 0.3;
  let borderY = -1;
  for (let y = titleBottom + Math.round(H * 0.03); y < Math.round(H * 0.34); y++) {
    if (metallic(rows[y])) borderY = y; // lowest metallic arc in the panel zone
  }
  let lightAbove = 0;
  if (borderY > 0) for (let y = titleBottom; y < borderY; y++) if (lightUI(rows[y]) || metallic(rows[y])) lightAbove++;
  const hasActionPanel = borderY > 0 && lightAbove / Math.max(1, borderY - titleBottom) > 0.35;
  let artTop: number;
  if (hasActionPanel) {
    artTop = borderY + Math.round(H * 0.008);
  } else {
    artTop = titleBottom + 1;
    const trimLimit = titleBottom + Math.round(H * 0.04);
    while (artTop < trimLimit && smoothAccent(rows[artTop])) artTop++; // skip the title border only
  }

  // --- BOTTOM boundary (curve-aware). Step 1: COARSE bottom = the lowest straight
  //     cut whose kept-art bottom strip contains NO lower UI. "Lower UI" is detected
  //     by RELIABLE signals only — dark-on-light TEXT and the binary CODE row (high
  //     central horizontal edge frequency) — NOT the heterogeneous separator itself.
  //     This robustly excludes separator/code/text panels regardless of art hue. ---
  const ccx0 = Math.round(W * 0.28), ccx1 = Math.round(W * 0.72);
  const codeFreq = (y: number): number => {
    let e = 0;
    for (let x = ccx0; x < ccx1 - 1; x++) if (Math.abs(px(img, x, y).v - px(img, x + 1, y).v) > 0.22) e++;
    return e / Math.max(1, ccx1 - ccx0 - 1);
  };
  const textRow = (f: RowFeat) => f.meanV > 0.6 && f.meanS < 0.3 && f.white > 0.12 && f.dark > 0.02 && f.dark < 0.35;
  const isUIRow = (y: number) => textRow(rows[y]) || codeFreq(y) > 0.16;
  const bottomMin = artTop + Math.round(H * 0.2);
  const bottomMax = Math.round(H * 0.82);
  const stripH = Math.round(H * 0.06);
  let coarseBottom = -1;
  for (let y = bottomMax; y >= bottomMin; y--) {
    let ui = 0;
    for (let k = Math.max(0, y - stripH); k < y; k++) if (isUIRow(k)) ui++;
    if (ui / Math.max(1, stripH) < 0.1) { coarseBottom = y; break; }
  }
  if (coarseBottom < 0) { coarseBottom = Math.round(H * 0.62); warnings.push('art bottom not found'); }

  // Step 2: refine to a per-column CURVE — the smooth SEPARATOR band just below the
  //     art. Anchored in a narrow window around the coarse bottom, so it follows the
  //     arc (recovering art in its dips) without false stops deep in the art.
  const winA = Math.max(artTop + 4, coarseBottom - Math.round(H * 0.05));
  const winB = Math.min(H - 7, coarseBottom + Math.round(H * 0.05));
  const colBottom: number[] = [];
  for (let x = fx0; x < fx1; x++) {
    let b = coarseBottom;
    for (let y = winA; y <= winB; y++) {
      const v0 = px(img, x, y).v, v3 = px(img, x, y + 3).v, v6 = px(img, x, y + 6).v;
      if (Math.abs(v0 - v3) < 0.05 && Math.abs(v3 - v6) < 0.06) { b = y; break; } // uniform → separator top
    }
    colBottom.push(b);
  }
  const sm = Math.max(2, Math.round((fx1 - fx0) * 0.05));
  const botS = colBottom.map((_, i) => {
    let s = 0, n = 0;
    for (let j = Math.max(0, i - sm); j <= Math.min(colBottom.length - 1, i + sm); j++) { s += colBottom[j]; n++; }
    return clamp(s / n, winA, winB);
  });
  const sepAnchor = coarseBottom;

  // --- include polygon (full coverage): straight top, frame sides, CURVED bottom ---
  const topN = artTop / H;
  const pts: Point[] = [{x: fx0 / W, y: topN}, {x: (fx1 - 1) / W, y: topN}];
  const step = Math.max(1, Math.round((fx1 - fx0) / 64));
  for (let i = fx1 - fx0 - 1; i >= 0; i -= step) pts.push({x: (fx0 + i) / W, y: clamp(botS[i] / H, 0, 1)});

  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const canvas: NormalizedRect = {
    x: Math.min(...xs), y: Math.min(...ys),
    w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys),
  };

  return {
    includeMasks: [{type: 'polygon', points: pts}],
    canvas,
    accent: {hue: frameAccent.h, sat: frameAccent.s},
    diagnostics: {
      frameLeft: +(fx0 / W).toFixed(3), frameRight: +(fx1 / W).toFixed(3),
      titleBottom: +(titleBottom / H).toFixed(3), artTop: +topN.toFixed(3),
      separator: +(sepAnchor / H).toFixed(3), hasActionPanel: hasActionPanel ? 1 : 0,
      bandHue: +bandAccent.h.toFixed(0), frameHue: +frameAccent.h.toFixed(0),
    },
    warnings,
  };
}

export function autoPlan(
  img: RawImage,
  cardCode: string,
  sourceFile: string,
  cardBounds: NormalizedRect,
): ExtractionPlan {
  const r = detectStructural(img);
  return {
    cardCode,
    sourceFile,
    cardBounds,
    canvas: r.canvas,
    includeMasks: r.includeMasks,
    excludeMasks: [],
    focus: {x: 0.5, y: 0.45},
    confidence: 0.7,
    status: 'needs-edge-cleanup',
    method: METHOD,
    warnings: r.warnings,
    qualityChecks: [],
    accent: r.accent,
    diagnostics: r.diagnostics,
  };
}
