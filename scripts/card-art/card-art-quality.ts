// Quality assessment for the structural detector. Grades the two acceptance axes
// — coverage (is the WHOLE art panel captured?) + purity (is all card UI gone?) —
// plus edgeCleanliness (frame/separator remnants at the boundary). Heuristic: it
// guides the status, but the checkerboard visual review is the final authority.

import sharp from 'sharp';
import type {QualityCheckResult, QualityGrade, QualityReport} from './card-art-types';

interface RawRGBA {
  data: Buffer;
  width: number;
  height: number;
  ch: number;
}

function hsv(r: number, g: number, b: number) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn), d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return {h, s: max === 0 ? 0 : d / max, v: max};
}
function hueDist(a: number, b: number) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}
function alpha(img: RawRGBA, x: number, y: number) {
  return img.ch === 4 ? img.data[(y * img.width + x) * img.ch + 3] : 255;
}

/** Over a horizontal band (opaque pixels only): accent / SMOOTH-accent / white / dark / fill. */
function band(img: RawRGBA, accentHue: number, y0: number, y1: number) {
  const L = (x: number, y: number) => {
    const i = (y * img.width + x) * img.ch;
    return (0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2]) / 255;
  };
  let opaque = 0, accent = 0, smoothAccent = 0, white = 0, dark = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < img.width; x++) {
      if (alpha(img, x, y) < 128) continue;
      opaque++;
      const i = (y * img.width + x) * img.ch;
      const p = hsv(img.data[i], img.data[i + 1], img.data[i + 2]);
      const isAcc = p.s > 0.32 && p.v > 0.25 && hueDist(p.h, accentHue) < 28;
      if (isAcc) {
        accent++;
        // a real title/separator band is SMOOTH; textured accent ART is not
        const l = L(x, y);
        let grad = 0;
        if (x > 0) grad = Math.max(grad, Math.abs(l - L(x - 1, y)));
        if (x < img.width - 1) grad = Math.max(grad, Math.abs(l - L(x + 1, y)));
        if (y > y0) grad = Math.max(grad, Math.abs(l - L(x, y - 1)));
        if (y < y1 - 1) grad = Math.max(grad, Math.abs(l - L(x, y + 1)));
        if (grad <= 0.1) smoothAccent++;
      }
      if (p.v > 0.82 && p.s < 0.16) white++;
      if (p.v < 0.34) dark++;
    }
  }
  if (opaque === 0) return {opaque: 0, accent: 0, smoothAccent: 0, white: 0, dark: 0, fill: 0};
  const rowArea = img.width * (y1 - y0);
  return {opaque, accent: accent / opaque, smoothAccent: smoothAccent / opaque, white: white / opaque, dark: dark / opaque, fill: opaque / rowArea};
}

export interface QualityResult {
  report: QualityReport;
  checks: QualityCheckResult[];
  notes: string[];
}

export async function assessQuality(
  artPng: Buffer,
  transparentRatio: number,
  accentHue: number,
  coverageRatio = 1,
  holesRemaining = 0,
): Promise<QualityResult> {
  const {data, info} = await sharp(artPng).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  const img: RawRGBA = {data, width: info.width, height: info.height, ch: info.channels};
  const H = info.height, W = info.width;
  const checks: QualityCheckResult[] = [];
  const notes: string[] = [];

  // --- PURITY: a full-width ACCENT band at the very top/bottom of the masked art
  //     is a title/separator LEAK (the layout boundary was placed wrong). ---
  const top = band(img, accentHue, 0, Math.max(1, Math.round(H * 0.07)));
  const bot = band(img, accentHue, Math.round(H * 0.9), H);
  const titleLeak = top.fill > 0.6 && top.smoothAccent > 0.4;
  const sepLeak = bot.fill > 0.6 && bot.smoothAccent > 0.4;
  // white text panel anywhere in the lower third
  const lower = band(img, accentHue, Math.round(H * 0.78), H);
  const textPanel = lower.fill > 0.6 && lower.white > 0.4 && lower.dark > 0.03;

  let purity: QualityReport['purity'] = 'pass';
  if (titleLeak) { purity = 'fail'; notes.push('title-bar accent band at top of art (layout)'); }
  if (sepLeak) { purity = 'fail'; notes.push('separator accent band at bottom of art (layout)'); }
  if (textPanel) { purity = 'fail'; notes.push('white text panel inside art'); }
  checks.push({name: 'no-title-leak', status: titleLeak ? 'fail' : 'pass'});
  checks.push({name: 'no-separator-leak', status: sepLeak ? 'fail' : 'pass'});
  checks.push({name: 'no-text-panel', status: textPanel ? 'fail' : 'pass'});

  // --- EDGE CLEANLINESS: SMOOTH accent pixels on the alpha boundary = frame/sep
  //     remnant. Textured accent ART at the edge (lit tunnel wall, credit text) is
  //     not a remnant, so we require local smoothness to count it. ---
  const lumAt = (x: number, y: number) => {
    const i = (y * W + x) * img.ch;
    return (0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2]) / 255;
  };
  let boundary = 0, boundaryAccent = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (alpha(img, x, y) < 128) continue;
      const edge = x === 0 || y === 0 || x === W - 1 || y === H - 1 ||
        alpha(img, x - 1, y) < 128 || alpha(img, x + 1, y) < 128 ||
        alpha(img, x, y - 1) < 128 || alpha(img, x, y + 1) < 128;
      if (!edge) continue;
      boundary++;
      const i = (y * W + x) * img.ch;
      const p = hsv(img.data[i], img.data[i + 1], img.data[i + 2]);
      if (!(p.s > 0.32 && p.v > 0.25 && hueDist(p.h, accentHue) < 28)) continue;
      const L = lumAt(x, y);
      let grad = 0;
      if (x > 0) grad = Math.max(grad, Math.abs(L - lumAt(x - 1, y)));
      if (x < W - 1) grad = Math.max(grad, Math.abs(L - lumAt(x + 1, y)));
      if (y > 0) grad = Math.max(grad, Math.abs(L - lumAt(x, y - 1)));
      if (y < H - 1) grad = Math.max(grad, Math.abs(L - lumAt(x, y + 1)));
      if (grad <= 0.12) boundaryAccent++; // smooth accent → frame/separator remnant
    }
  }
  const edgeAccentRatio = boundary ? boundaryAccent / boundary : 0;
  let edgeCleanliness: QualityReport['edgeCleanliness'] = 'pass';
  if (edgeAccentRatio > 0.18) { edgeCleanliness = 'fail'; notes.push(`accent remnants on ${(edgeAccentRatio * 100).toFixed(0)}% of edge`); }
  else if (edgeAccentRatio > 0.08) { edgeCleanliness = 'warning'; notes.push(`minor accent on ${(edgeAccentRatio * 100).toFixed(0)}% of edge`); }
  checks.push({name: 'edge-accent', status: edgeCleanliness, detail: `${(edgeAccentRatio * 100).toFixed(0)}%`});

  // --- COVERAGE: the cleanup must not have eaten art. coverageRatio is opaque
  //     pixels relative to the no-cleanup base — a big drop means the peel removed
  //     real art, not just the frame rind. (Final coverage is judged visually.) ---
  let coverage: QualityReport['coverage'] = 'pass';
  if (coverageRatio < 0.9) { coverage = 'fail'; notes.push(`cleanup removed ${((1 - coverageRatio) * 100).toFixed(0)}% vs base — art likely eaten`); }
  else if (coverageRatio < 0.95) { coverage = 'warning'; notes.push(`cleanup removed ${((1 - coverageRatio) * 100).toFixed(0)}% vs base`); }
  if (transparentRatio > 0.6 && coverage === 'pass') { coverage = 'warning'; notes.push('mask covers little of its bbox — possible under-crop'); }
  checks.push({name: 'coverage', status: coverage, detail: `kept ${(coverageRatio * 100).toFixed(0)}% of base`});

  // --- NO HOLES: transparent islands inside the art are forbidden (we auto-fill,
  //     so any remaining holes signal a real failure). ---
  let noHoles: QualityReport['noHoles'] = 'pass';
  if (holesRemaining > 0) { noHoles = 'fail'; notes.push(`${holesRemaining} interior hole pixels remain`); }
  checks.push({name: 'no-holes', status: noHoles, detail: holesRemaining ? `${holesRemaining}px` : 'clean'});

  return {report: {coverage, purity, edgeCleanliness, noHoles}, checks, notes};
}

export function statusFromQuality(q: QualityReport): import('./card-art-types').ExtractionStatus {
  if (q.noHoles === 'fail') return 'holes-detected';
  if (q.coverage === 'fail') return 'needs-more-coverage';
  if (q.purity === 'fail') return 'needs-layout-fix';
  if (q.coverage === 'warning') return 'needs-more-coverage';
  if (q.purity === 'warning' || q.edgeCleanliness === 'fail') return 'needs-edge-cleanup';
  if (q.edgeCleanliness === 'warning') return 'needs-edge-cleanup';
  return 'accepted';
}

/** Numeric quality score for candidate comparison (higher = better balance). */
export function scoreQuality(q: QualityReport, coverageRatio: number): number {
  const g = (x: QualityGrade) => (x === 'pass' ? 1 : x === 'warning' ? 0.5 : 0);
  // purity + no-holes are hard gates; edge next; coverage rewards keeping art.
  return 3 * g(q.purity) + 3 * g(q.noHoles) + 2 * g(q.edgeCleanliness) + 1.5 * g(q.coverage) + coverageRatio;
}
