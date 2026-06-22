// Structural / layout-based art-panel detector (v4).
//
// This is NOT semantic segmentation (SAM) and NOT "find a photo rectangle" (v1).
// The art panel is defined by the card's LAYOUT, so we detect the layout and cut
// exactly the art window:
//   - sides   = inner edges of the coloured card FRAME
//   - top     = below the TITLE bar AND (on ACTIVE cards) below the ACTION panel
//   - bottom  = top of the decorative SEPARATOR / code-capsule / lower game panel,
//               as a smoothed per-column CURVE (the separator is often an arc)
//
// v4 fixes the two structural failures of v3:
//   1. ACTION-PANEL LEAK — v3's "metallic arc" test was fragile and let the white
//      action text/icon panel into the art on active cards. v4 treats the action
//      panel as a CONTIGUOUS light-UI/text band directly under the title and puts
//      the art top BELOW it (the panel is light + dark-on-light text + smooth
//      borders; the art is colourful/textured edge-to-edge).
//   2. BOTTOM LEAK — v3 used a narrow lower-UI test (white-text rows + code freq)
//      and missed grey effect panels and accent separator arcs, so it cut far too
//      low (keeping separator + code capsule + the whole effect panel). v4 finds
//      the strongest ART→lower-UI transition with a BROAD lower-UI classifier
//      (text/code/white-panel/grey-panel/smooth-accent-band), then refines it to a
//      per-column curve (median-filtered + smoothed → outlier-robust).
//
// We take the WHOLE art panel inside those boundaries (coverage-first). Thin
// frame/separator remnants left at the boundary are removed afterwards by the
// accent edge-cleanup pass (peelAccentEdges) — NOT by shrinking the mask. Several
// geometry candidates (top × bottom variants) are scored by a pixel validator so a
// single heuristic miss can't ruin a card; the candidate that keeps the MOST art
// with clean art-only edges wins (a small "safe" crop never wins).
//
// Credits printed INSIDE the art (NASA / ESA / artist) are KEPT — they are part
// of the illustration; only card UI is removed.

import type {RawImage} from './card-art-image-utils';
import {clamp} from './card-art-image-utils';
import type {ExtractionPlan, GeometryLogEntry, MaskShape, NormalizedRect, Point} from './card-art-types';

const METHOD = 'structural-detector-v4';

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

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
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
  rawColorVar: number; // un-normalized colour texture
  rawVarL: number; // un-normalized luminance texture
  text: number; // dark-on-light horizontal edge density (text / icons), 0..1
  code: number; // central horizontal-edge density (binary code capsule), 0..1
}

function rowFeatures(img: RawImage, accent: HSV, x0: number, x1: number): RowFeat[] {
  const W = img.width, H = img.height, inner = Math.max(1, x1 - x0);
  const cx0 = Math.round(W * 0.3), cx1 = Math.round(W * 0.7);
  const rawCV: number[] = new Array(H);
  const rawVL: number[] = new Array(H);
  const acc: number[] = new Array(H);
  const sat: number[] = new Array(H);
  const wht: number[] = new Array(H);
  const drk: number[] = new Array(H);
  const mv: number[] = new Array(H);
  const ms: number[] = new Array(H);
  const txt: number[] = new Array(H);
  const cod: number[] = new Array(H);
  for (let y = 0; y < H; y++) {
    let a = 0, sa = 0, w = 0, dk = 0, sumV = 0, sumS = 0, sumL = 0, sumL2 = 0, sumRg = 0, sumRg2 = 0, sumYb = 0, sumYb2 = 0;
    let textEdges = 0, codeEdges = 0, codeN = 0;
    const base = y * W * 3;
    let prevL = -1;
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
      // dark-on-light horizontal edge: text / icon ink over a light panel background.
      if (prevL >= 0) {
        const lo = Math.min(prevL, L), hi = Math.max(prevL, L);
        if (hi - lo > 0.25 && lo < 0.42 && hi > 0.55) textEdges++;
        if (x >= cx0 && x < cx1) { if (Math.abs(prevL - L) > 0.22) codeEdges++; codeN++; }
      }
      prevL = L;
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
    txt[y] = textEdges / inner;
    cod[y] = codeEdges / Math.max(1, codeN);
  }
  const nCV = normalize(rawCV), nVL = normalize(rawVL);
  return acc.map((_, y) => ({
    accent: acc[y], sat: sat[y], white: wht[y], dark: drk[y], meanV: mv[y], meanS: ms[y],
    colorVar: nCV[y], varL: nVL[y], rawColorVar: rawCV[y], rawVarL: rawVL[y], text: txt[y], code: cod[y],
  }));
}

export interface StructuralResult {
  includeMasks: MaskShape[];
  canvas: NormalizedRect;
  accent: {hue: number; sat: number};
  diagnostics: Record<string, number | string>;
  warnings: string[];
  geometryLog: GeometryLogEntry[];
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

  // --- art-content reference: the CENTRE band of the card is art in EVERY layout
  //     family (blueprint / photo / city / fireball), so its texture sets the
  //     adaptive thresholds that distinguish ART from flat UI panels per-card. ---
  const cRef0 = Math.round(H * 0.4), cRef1 = Math.round(H * 0.6);
  const artColorRef = Math.max(6, median(rows.slice(cRef0, cRef1).map((f) => f.rawColorVar)));
  const artVarRef = Math.max(0.0025, median(rows.slice(cRef0, cRef1).map((f) => f.rawVarL)));

  // Row classifiers (adaptive, relative to the per-card art reference).
  const lowerUI = (y: number): boolean => {
    const f = rows[y];
    const textPanel = f.text > 0.04 && f.meanV > 0.5; // dark-on-light text (effect/flavor panel)
    const codeBand = f.code > 0.16; // binary code capsule
    const whitePanel = f.white > 0.32; // bright effect/text panel
    const greyPanel = f.meanV > 0.48 && f.meanV < 0.96 && f.meanS < 0.24 &&
      f.rawColorVar < artColorRef * 0.5 && f.rawVarL < artVarRef * 0.7; // smooth grey panel
    const sepBand = f.accent > 0.5 && f.rawVarL < artVarRef * 0.55; // smooth accent separator arc
    return textPanel || codeBand || whitePanel || greyPanel || sepBand;
  };
  const artRow = (y: number): boolean => {
    const f = rows[y];
    if (lowerUI(y)) return false;
    return f.rawColorVar > artColorRef * 0.35 || f.rawVarL > artVarRef * 0.35 || f.meanS > 0.28;
  };
  // Action-panel detection. The trap (v3 + first v4 try): bright ART (a flaming
  // asteroid, a white-glass city, clouds) also has high brightness / white pixels,
  // so "bright" or "white present" wrongly flags art as panel. The robust ANCHOR is
  // the action panel's FLAT-WHITE BACKGROUND: high V, VERY low saturation, AND very
  // low texture. Bright art is either SATURATED (fireball) or TEXTURED (city) — it
  // is never a flat low-saturation low-texture sheet. So:
  //   panelCore = the flat-white panel background (the anchor — must exist near the
  //               title for an action panel to be declared);
  //   panelBand = core OR dark-on-light action text OR the title's accent rind OR a
  //               low-saturation white-bleed row — used to EXTEND the band through
  //               the interleaved icon/text rows once a core anchor is found.
  // ABSOLUTE flatness thresholds (NOT art-relative — artColorRef swings wildly per
  // card, e.g. a grey rover centre vs a red train centre, which made a relative core
  // threshold miss the panel on some cards). A flat-white panel sheet is an absolute
  // property: bright, near-zero saturation, near-zero texture.
  const panelCore = (y: number): boolean => {
    const f = rows[y];
    return f.meanV > 0.64 && f.meanS < 0.12 && f.rawColorVar < 12 && f.rawVarL < 0.011;
  };
  const panelBand = (y: number): boolean => {
    const f = rows[y];
    if (panelCore(y)) return true;
    const textLine = f.text > 0.03 && f.meanV > 0.5 && f.meanS < 0.3; // dark-on-light action text
    const accentRind = f.accent > 0.4 && f.rawVarL < artVarRef * 0.7; // title border
    // white bg showing between the action's COLOURED icons — key on the white
    // fraction, NOT colour-variance (the icons spike variance). Only ever consulted
    // AFTER a flat-white core anchor is found, so it can't grab bright art.
    const whiteBleed = f.white > 0.12 && f.meanS < 0.32;
    return textLine || accentRind || whiteBleed;
  };

  // --- title band bottom. The title bar is the SOLID, highly-SATURATED accent band
  //     at the top (the bar is filled with the pure accent colour + white name text).
  //     The art below it is LESS saturated — even on EVENT cards where the art shares
  //     the title's HUE (an orange fireball under an orange title bar): the bar is
  //     ~0.85 saturated, the fireball ~0.5. Hue alone never ends the band there, but
  //     saturation does. Capped at 0.17H (title bars never exceed that). ---
  if (process.env.CARDART_DEBUG_TITLE) {
    for (let y = Math.round(H * 0.04); y < Math.round(H * 0.27); y += 2) {
      const f = rows[y];
      // eslint-disable-next-line no-console
      console.error(`y=${(y / H).toFixed(3)} acc=${f.accent.toFixed(2)} cv=${f.rawColorVar.toFixed(0)} vL=${f.rawVarL.toFixed(4)} mV=${f.meanV.toFixed(2)} mS=${f.meanS.toFixed(2)}`);
    }
  }
  let titleBottom = -1;
  const titleMax = Math.round(H * 0.17);
  for (let y = Math.round(H * 0.05); y < titleMax; y++) {
    const f = rows[y];
    const isTitle = f.accent > 0.5 && f.meanS > 0.55; // solid saturated accent bar
    if (isTitle) titleBottom = y;
    else if (titleBottom >= 0) break; // first non-title row after the bar = boundary
  }
  if (titleBottom < 0) { titleBottom = Math.round(H * 0.14); warnings.push('title band not found'); }

  // --- ART TOP: skip the CONTIGUOUS title+action UI band that begins at the title.
  //     The action panel (active cards) is a light/text band right under the title;
  //     on normal/event cards the art starts immediately (band length ~0). Stop at
  //     the first SUSTAINED art run; never skip past 0.42H (can't eat deep art). ---
  const maxTopSkip = Math.round(H * 0.42);
  if (process.env.CARDART_DEBUG_TOP) {
    for (let y = titleBottom; y < Math.round(H * 0.4); y += 2) {
      const f = rows[y];
      // eslint-disable-next-line no-console
      console.error(`y=${(y / H).toFixed(3)} mV=${f.meanV.toFixed(2)} mS=${f.meanS.toFixed(2)} cv=${f.rawColorVar.toFixed(0)} vL=${f.rawVarL.toFixed(4)} wht=${f.white.toFixed(2)} txt=${f.text.toFixed(3)} acc=${f.accent.toFixed(2)} | core=${panelCore(y)?1:0} band=${panelBand(y)?1:0} art=${artRow(y)?1:0} lUI=${lowerUI(y)?1:0}`);
    }
  }
  // ART TOP. The action panel is declared ONLY if a flat-white CORE anchor appears
  // within a short lead-in of the title; otherwise the art starts immediately under
  // the title (normal / event card). When anchored, extend the panel band downward
  // gap-tolerantly (through icon/text rows), then drop to the first real art row.
  const topStart = titleBottom + Math.max(2, Math.round(H * 0.008));
  const leadIn = Math.round(H * 0.07);
  const maxGap = Math.round(H * 0.035);
  let firstCore = -1;
  for (let y = topStart; y < Math.min(maxTopSkip, topStart + leadIn); y++) if (panelCore(y)) { firstCore = y; break; }
  let artTop: number;
  let lastPanelDbg = -1;
  if (firstCore < 0) {
    artTop = topStart; // no action panel — art is right below the title
  } else {
    let lastPanel = firstCore, gap = 0;
    for (let y = firstCore + 1; y < maxTopSkip; y++) {
      if (panelBand(y)) { lastPanel = y; gap = 0; }
      else if (++gap > maxGap) break;
    }
    lastPanelDbg = lastPanel;
    artTop = lastPanel + 1;
  }
  // advance past any trailing white / text / and the action panel's grey METALLIC
  // RIM (a low-saturation bevelled frame just under the panel — only on active cards)
  // to the first real, saturated art row.
  const metallicRim = (y: number): boolean => {
    const f = rows[y];
    return f.meanS < 0.22 && f.meanV > 0.4 && f.meanV < 0.85 && f.white < 0.15 && f.rawColorVar < 26;
  };
  const advLimit = Math.min(maxTopSkip, artTop + Math.round(H * 0.06));
  while (artTop < advLimit && (!artRow(artTop) || panelBand(artTop) || (firstCore >= 0 && metallicRim(artTop)))) artTop++;
  if (process.env.CARDART_DEBUG_TOP) {
    // eslint-disable-next-line no-console
    console.error(`firstCore=${firstCore < 0 ? -1 : (firstCore / H).toFixed(3)} lastPanel=${lastPanelDbg < 0 ? -1 : (lastPanelDbg / H).toFixed(3)} artTop=${(artTop / H).toFixed(3)}`);
  }
  const actionSkipH = artTop - topStart;
  const hasActionPanel = firstCore >= 0 && actionSkipH > Math.round(H * 0.135);

  // --- BOTTOM (coarse): the TOP of the contiguous bottom GAME-UI block (separator
  //     arc → code capsule → effect panel → flavor text). We find the HIGHEST y whose
  //     band BELOW is SUSTAINED UI (over a wide 0.085H window) while the band ABOVE
  //     is art. Using a wide below-window is what makes this robust to UI-LOOKING ART
  //     INTERIOR (a blueprint's text labels / pseudo-code box): those have ART below
  //     them, so the window never fills with UI and they're skipped — only the real
  //     bottom block (UI all the way down) qualifies. The bottom-UI signals are
  //     RELIABLE ones (code freq / dark-on-light text / white panel / smooth light or
  //     smooth-accent separator) — NOT a colour-variance threshold (which collapses
  //     when the art's centre is desaturated, e.g. a grey rover, and then reads the
  //     separator as art — v4's first-try bug). ---
  const bandH = Math.max(3, Math.round(H * 0.035));
  const bottomMin = artTop + Math.round(H * 0.12);
  const bottomMax = Math.min(H - bandH - 2, Math.round(H * 0.9));
  const frac = (pred: (y: number) => boolean, a: number, b: number): number => {
    // floor/ceil so float boundaries (the smoothed bottom curve) never index rows[] fractionally.
    const lo = Math.max(0, Math.floor(a)), hi = Math.min(H, Math.ceil(b));
    let n = 0, t = 0;
    for (let y = lo; y < hi; y++) { if (pred(y)) n++; t++; }
    return t ? n / t : 0;
  };
  const bottomUI = (y: number): boolean => {
    const f = rows[y];
    if (f.code > 0.12) return true; // binary code capsule
    if (f.text > 0.045 && f.meanV > 0.5) return true; // effect / flavour text on light
    if (f.white > 0.3) return true; // white effect / VP panel
    if (f.meanV > 0.5 && f.rawVarL < 0.016 && f.meanS < 0.3) return true; // smooth light separator / panel
    if (f.accent > 0.5 && f.rawVarL < 0.016) return true; // smooth accent separator arc
    return false;
  };
  if (process.env.CARDART_DEBUG_BOT) {
    for (let y = Math.round(H * 0.55); y < Math.round(H * 0.96); y += 2) {
      const f = rows[y];
      // eslint-disable-next-line no-console
      console.error(`y=${(y / H).toFixed(3)} mV=${f.meanV.toFixed(2)} mS=${f.meanS.toFixed(2)} cv=${f.rawColorVar.toFixed(0)} vL=${f.rawVarL.toFixed(4)} wht=${f.white.toFixed(2)} txt=${f.text.toFixed(3)} code=${f.code.toFixed(2)} acc=${f.accent.toFixed(2)} | bUI=${bottomUI(y)?1:0}`);
    }
  }
  const belowWin = Math.round(H * 0.085);
  let coarseBottom = -1, bestTrans = 0;
  for (let y = bottomMin; y <= bottomMax; y++) {
    const belowUIf = frac(bottomUI, y, Math.min(H, y + belowWin));
    const aboveArtf = frac((yy) => !bottomUI(yy), y - bandH, y);
    if (belowUIf > 0.62 && aboveArtf > 0.55) { coarseBottom = y; bestTrans = belowUIf; break; } // highest qualifying
  }
  if (coarseBottom < 0) {
    // Fallback: the highest sustained bottom-UI row.
    for (let y = bottomMax; y >= bottomMin; y--) {
      if (frac(bottomUI, y, Math.min(H, y + belowWin)) > 0.55) coarseBottom = y;
    }
    if (coarseBottom < 0) coarseBottom = Math.round(H * 0.78);
    warnings.push('weak art/UI transition — using fallback bottom');
  }

  // --- BOTTOM (curve): per-column boundary in a tight window around the coarse cut,
  //     where the column leaves textured art for the smooth separator. Median-filter
  //     (reject outliers) then mean-smooth → an arc-following, robust polyline. ---
  const winA = Math.max(artTop + 4, coarseBottom - Math.round(H * 0.055));
  const winB = Math.min(H - 7, coarseBottom + Math.round(H * 0.055));
  const colBottom: number[] = [];
  for (let x = fx0; x < fx1; x++) {
    let b = coarseBottom;
    for (let y = winA; y <= winB; y++) {
      // separator/panel top: a few vertically-uniform px (art texture has ended).
      const v0 = px(img, x, y).v, v3 = px(img, x, y + 3).v, v6 = px(img, x, y + 6).v;
      if (Math.abs(v0 - v3) < 0.05 && Math.abs(v3 - v6) < 0.06) { b = y; break; }
    }
    colBottom.push(b);
  }
  // 1) median filter — kill single-column outliers (a stray smooth spot in art).
  const mw = Math.max(2, Math.round((fx1 - fx0) * 0.04));
  const colMed = colBottom.map((_, i) => {
    const seg: number[] = [];
    for (let j = Math.max(0, i - mw); j <= Math.min(colBottom.length - 1, i + mw); j++) seg.push(colBottom[j]);
    return median(seg);
  });
  // 2) mean smooth — a gentle arc.
  const sw = Math.max(2, Math.round((fx1 - fx0) * 0.06));
  const botS = colMed.map((_, i) => {
    let s = 0, n = 0;
    for (let j = Math.max(0, i - sw); j <= Math.min(colMed.length - 1, i + sw); j++) { s += colMed[j]; n++; }
    return clamp(s / n, winA, winB);
  });

  // --- multi-candidate geometry search: top × bottom variants, pixel-validated.
  //     A candidate is good when both edges sit on real ART (no action/separator
  //     leak), the cut below the bottom IS lower-UI (we didn't slice art), and it
  //     keeps as much art as possible. A small "safe" crop scores low on coverage;
  //     a leaky crop scores low on inside-art — neither wins. ---
  const dy = Math.round(H * 0.013);
  const shiftCurve = (base: number[], d: number): number[] => base.map((v) => clamp(v + d, artTop + 4, H - 2));
  const flatCurve = (yv: number): number[] => botS.map(() => yv);
  const topCands = [
    {label: 'top', y: artTop},
    {label: 'top+', y: Math.min(maxTopSkip, artTop + dy)},
    {label: 'top-', y: Math.max(titleBottom + 2, artTop - dy)},
  ];
  const botCands = [
    {label: 'bot-curve', c: botS},
    {label: 'bot-curve^', c: shiftCurve(botS, -dy)}, // a touch more conservative (less leak)
    {label: 'bot-flat', c: flatCurve(Math.round(median(botS)))},
  ];

  const meanArr = (a: number[]) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
  const scoreGeom = (top: number, curve: number[]) => {
    const bMin = Math.min(...curve), bMax = Math.max(...curve), bMean = meanArr(curve);
    const topInsideArt = frac(artRow, top, top + Math.round(H * 0.025));
    const topAboveUI = frac((y) => panelBand(y) || !artRow(y), Math.max(titleBottom, top - Math.round(H * 0.02)), top);
    const bottomInsideArt = frac(artRow, bMin - Math.round(H * 0.03), bMin);
    const bottomBelowUI = frac(lowerUI, Math.round(bMax), Math.round(bMax) + Math.round(H * 0.028));
    const coverage = clamp((bMean - top) / H, 0, 1);
    let score = 2.0 * topInsideArt + 1.0 * topAboveUI + 2.0 * bottomInsideArt + 1.5 * bottomBelowUI + 1.2 * coverage;
    if (topInsideArt < 0.5) score -= 3; // action/title panel leaked into the art
    if (bottomInsideArt < 0.5) score -= 2; // separator/panel leaked into the art
    if (bottomBelowUI < 0.4) score -= 1; // bottom cut into art (below is still art)
    return {score, topInsideArt, bottomInsideArt, bottomBelowUI, coverage, bMean};
  };

  const geometryLog: GeometryLogEntry[] = [];
  let best: {top: number; curve: number[]; s: ReturnType<typeof scoreGeom>} | null = null;
  for (const t of topCands) {
    for (const b of botCands) {
      const s = scoreGeom(t.y, b.c);
      geometryLog.push({
        label: `${t.label}/${b.label}`,
        artTop: +(t.y / H).toFixed(3),
        bottomMean: +(s.bMean / H).toFixed(3),
        topInsideArt: +s.topInsideArt.toFixed(2),
        bottomInsideArt: +s.bottomInsideArt.toFixed(2),
        bottomBelowUI: +s.bottomBelowUI.toFixed(2),
        coverage: +s.coverage.toFixed(3),
        score: +s.score.toFixed(3),
        chosen: false,
      });
      if (!best || s.score > best.s.score) best = {top: t.y, curve: b.c, s};
    }
  }
  const chosenTop = best!.top;
  const chosenCurve = best!.curve;
  // mark the chosen row in the log
  {
    let bi = 0, bs = -Infinity;
    geometryLog.forEach((e, i) => { if (e.score > bs) { bs = e.score; bi = i; } });
    geometryLog[bi].chosen = true;
  }

  // --- include polygon (full coverage): straight top, frame sides, CURVED bottom ---
  const topN = chosenTop / H;
  const pts: Point[] = [{x: fx0 / W, y: topN}, {x: (fx1 - 1) / W, y: topN}];
  const step = Math.max(1, Math.round((fx1 - fx0) / 64));
  for (let i = fx1 - fx0 - 1; i >= 0; i -= step) pts.push({x: (fx0 + i) / W, y: clamp(chosenCurve[i] / H, 0, 1)});

  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const canvas: NormalizedRect = {
    x: Math.min(...xs), y: Math.min(...ys),
    w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys),
  };

  const family = hasActionPanel ? 'active' : (hueDist(frameAccent.h, 20) < 24 ? 'event-like' : 'normal');

  return {
    includeMasks: [{type: 'polygon', points: pts}],
    canvas,
    accent: {hue: frameAccent.h, sat: frameAccent.s},
    diagnostics: {
      family,
      frameLeft: +(fx0 / W).toFixed(3), frameRight: +(fx1 / W).toFixed(3),
      titleBottom: +(titleBottom / H).toFixed(3), artTop: +topN.toFixed(3),
      bottomMean: +(best!.s.bMean / H).toFixed(3), bottomCoarse: +(coarseBottom / H).toFixed(3),
      hasActionPanel: hasActionPanel ? 1 : 0, actionSkip: +(actionSkipH / H).toFixed(3),
      transition: +bestTrans.toFixed(3),
      bandHue: +bandAccent.h.toFixed(0), frameHue: +frameAccent.h.toFixed(0),
      artColorRef: +artColorRef.toFixed(1), artVarRef: +artVarRef.toFixed(4),
    },
    warnings,
    geometryLog,
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
    geometryLog: r.geometryLog,
  };
}
