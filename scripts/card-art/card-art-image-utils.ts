// Image helpers for the v2 mask-first pipeline: loading, card-boundary detection,
// polygon-mask rasterization, alpha cutting (dest-in), tight-crop to the opaque
// region, and alpha WebP export. NO UI effects are baked in — clean art only.

import sharp, {type Sharp} from 'sharp';
import type {CardBounds, CliOptions, MaskShape, Point, VariantPaths, VariantSizes} from './card-art-types';

/** Width (px) the raw scan is downscaled to for card-boundary detection. */
const BOUNDS_ANALYSIS_WIDTH = 420;
/** Width (px) the card-bounds crop is downscaled to for art-feature analysis. */
export const ART_ANALYSIS_WIDTH = 520;

export interface RawImage {
  data: Buffer; // RGB, 3 bytes/pixel
  width: number;
  height: number;
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export async function rawRGB(input: string | Buffer | Sharp, width: number): Promise<RawImage> {
  const pipeline = (typeof input === 'string' || Buffer.isBuffer(input) ? sharp(input).rotate() : input)
    .removeAlpha()
    .resize({width, fit: 'inside', withoutEnlargement: false, kernel: 'lanczos3'});
  const {data, info} = await pipeline.raw().toBuffer({resolveWithObject: true});
  return {data, width: info.width, height: info.height};
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

function colorDistance(a: RGB, r: number, g: number, b: number): number {
  return Math.abs(a.r - r) + Math.abs(a.g - g) + Math.abs(a.b - b);
}

function estimateBackground(img: RawImage): RGB {
  const {data, width, height} = img;
  const ring = Math.max(2, Math.round(Math.min(width, height) * 0.012));
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x < ring || x >= width - ring || y < ring || y >= height - ring) {
        const i = (y * width + x) * 3;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        n++;
      }
    }
  }
  return {r: r / n, g: g / n, b: b / n};
}

/**
 * Detect the card rectangle inside a raw scan via its saturated coloured FRAME
 * (full-perimeter), which separates the card from the (white or dark) scan
 * background. Works for white-on-white scans and dark viewer backgrounds alike.
 */
export async function detectCardBounds(filePath: string): Promise<CardBounds> {
  const meta = await sharp(filePath).metadata();
  let origW = meta.width ?? 0;
  let origH = meta.height ?? 0;
  if (meta.orientation && meta.orientation >= 5) {
    const t = origW;
    origW = origH;
    origH = t;
  }
  const fallback: CardBounds = {left: 0, top: 0, width: origW, height: origH, uncertain: true};
  if (!origW || !origH) return fallback;

  const img = await rawRGB(filePath, BOUNDS_ANALYSIS_WIDTH);
  const {data, width, height} = img;
  const bg = estimateBackground(img);
  const thr = 44;

  const colCov = new Float32Array(width);
  const rowCov = new Float32Array(height);
  for (let y = 0; y < height; y++) {
    let rowCount = 0;
    const rowBase = y * width * 3;
    for (let x = 0; x < width; x++) {
      const i = rowBase + x * 3;
      const non = colorDistance(bg, data[i], data[i + 1], data[i + 2]) > thr ? 1 : 0;
      colCov[x] += non;
      rowCount += non;
    }
    rowCov[y] = rowCount / width;
  }
  for (let x = 0; x < width; x++) colCov[x] /= height;

  const COVERAGE = 0.45;
  const firstAbove = (arr: Float32Array, len: number): number => {
    for (let i = 0; i < len; i++) if (arr[i] >= COVERAGE) return i;
    return -1;
  };
  const lastAbove = (arr: Float32Array, len: number): number => {
    for (let i = len - 1; i >= 0; i--) if (arr[i] >= COVERAGE) return i;
    return -1;
  };

  let left = firstAbove(colCov, width);
  let right = lastAbove(colCov, width);
  let top = firstAbove(rowCov, height);
  let bottom = lastAbove(rowCov, height);

  const okX = left >= 0 && right > left && (right - left) / width > 0.5;
  const okY = top >= 0 && bottom > top && (bottom - top) / height > 0.5;
  if (!okX || !okY) return fallback;

  const scaleX = origW / width;
  const scaleY = origH / height;
  const padX = Math.round(width * 0.004);
  const padY = Math.round(height * 0.004);
  left = clamp(left - padX, 0, width - 1);
  right = clamp(right + padX, 0, width - 1);
  top = clamp(top - padY, 0, height - 1);
  bottom = clamp(bottom + padY, 0, height - 1);

  const pxLeft = Math.round(left * scaleX);
  const pxTop = Math.round(top * scaleY);
  const pxRight = Math.round((right + 1) * scaleX);
  const pxBottom = Math.round((bottom + 1) * scaleY);

  return {
    left: clamp(pxLeft, 0, origW - 1),
    top: clamp(pxTop, 0, origH - 1),
    width: clamp(pxRight - pxLeft, 1, origW),
    height: clamp(pxBottom - pxTop, 1, origH),
    uncertain: false,
  };
}

export async function extractAnalysisBuffer(filePath: string, bounds: CardBounds): Promise<RawImage> {
  const pipeline = sharp(filePath).rotate().extract({
    left: bounds.left,
    top: bounds.top,
    width: bounds.width,
    height: bounds.height,
  });
  return rawRGB(pipeline, ART_ANALYSIS_WIDTH);
}

export async function normalizedCardPng(
  filePath: string,
  bounds: CardBounds,
  width: number,
): Promise<{buffer: Buffer; width: number; height: number}> {
  const {data, info} = await sharp(filePath)
    .rotate()
    .extract({left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height})
    .resize({width, withoutEnlargement: true, kernel: 'lanczos3'})
    .png({compressionLevel: 8})
    .toBuffer({resolveWithObject: true});
  return {buffer: data, width: info.width, height: info.height};
}

// --------------------------------------------------------------------------
// Mask rasterization
// --------------------------------------------------------------------------

const ELLIPSE_SEGMENTS = 48;

/** Reduce any mask shape to a CARD-normalized polygon ring. */
export function shapeToPolygon(shape: MaskShape): Point[] {
  if (shape.type === 'polygon') return shape.points;
  if (shape.type === 'rect') {
    const {x, y, w, h} = shape;
    return [
      {x, y},
      {x: x + w, y},
      {x: x + w, y: y + h},
      {x, y: y + h},
    ];
  }
  // ellipse
  const pts: Point[] = [];
  for (let i = 0; i < ELLIPSE_SEGMENTS; i++) {
    const a = (i / ELLIPSE_SEGMENTS) * Math.PI * 2;
    pts.push({x: shape.cx + Math.cos(a) * shape.rx, y: shape.cy + Math.sin(a) * shape.ry});
  }
  return pts;
}

function ringPath(points: Point[], w: number, h: number): string {
  if (points.length === 0) return '';
  const pt = (p: Point) => `${clamp(p.x, 0, 1) * w} ${clamp(p.y, 0, 1) * h}`;
  return 'M' + points.map(pt).join(' L') + ' Z';
}

/** White-filled SVG of the given mask shapes (nonzero fill). */
function maskShapesSvg(masks: MaskShape[], w: number, h: number): string {
  const d = masks.map((m) => ringPath(shapeToPolygon(m), w, h)).filter(Boolean).join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><path d="${d}" fill="#ffffff"/></svg>`;
}

/**
 * Build the binary alpha mask PNG (opaque where art is KEPT): render the include
 * union, then DEST-OUT the exclude shapes. Separate operations (not one even-odd
 * path) so edge-touching excludes — e.g. an author-credit notch at the very art
 * boundary — subtract reliably regardless of edge alignment.
 */
export async function buildMaskPng(
  includeMasks: MaskShape[],
  excludeMasks: MaskShape[],
  w: number,
  h: number,
): Promise<Buffer> {
  let mask = sharp(Buffer.from(maskShapesSvg(includeMasks, w, h))).ensureAlpha();
  if (excludeMasks.length) {
    const excPng = await sharp(Buffer.from(maskShapesSvg(excludeMasks, w, h))).png().toBuffer();
    mask = mask.composite([{input: excPng, blend: 'dest-out'}]);
  }
  return mask.png().toBuffer();
}

export interface MaskedArt {
  /** RGBA PNG of the masked, tight-cropped art (transparent outside the mask). */
  png: Buffer;
  width: number;
  height: number;
  /** fraction of the tight-cropped canvas that is transparent. */
  transparentRatio: number;
}

/**
 * Apply the mask to the card crop, cut alpha (dest-in), and tight-crop to the
 * opaque bounding box. Returns the clean art layer (RGBA).
 */
/** Accent edge-cleanup config (two-phase peel — see peelAccentEdges). */
export interface EdgeCleanup {
  hue: number;
  sat: number;
  /** Phase 1: max px of accent + SMOOTH rind to peel (the solid frame/title/separator). */
  uniformPeel: number;
  /** Phase 2: extra px of accent (any texture) to peel — the gradient frame GLOW. */
  glowPeel: number;
}

function hueDist(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Peel thin FRAME/SEPARATOR remnants off the alpha boundary: a boundary pixel is
 * removed iff it is accent-coloured AND locally SMOOTH (frame/separator are flat
 * uniform colour). Textured art — even accent-coloured art like a lit green tunnel
 * wall — has local luminance variation and is KEPT. Operates in-place on RGBA.
 */
function peelAccentEdges(data: Buffer, w: number, h: number, ch: number, cfg: EdgeCleanup): number {
  let peeled = 0;
  const alphaIdx = (x: number, y: number) => (y * w + x) * ch + (ch - 1);
  const lum = (x: number, y: number) => {
    const i = (y * w + x) * ch;
    return (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
  };
  const accentHue = (x: number, y: number): boolean => {
    const i = (y * w + x) * ch;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const s = max === 0 ? 0 : (max - min) / max;
    if (s < 0.3 || max / 255 < 0.2) return false;
    let hue = 0;
    const d = (max - min) / 255;
    if (d > 0) {
      const rn = r / 255, gn = g / 255, bn = b / 255, mx = max / 255;
      if (mx === rn) hue = ((gn - bn) / d) % 6;
      else if (mx === gn) hue = (bn - rn) / d + 2;
      else hue = (rn - gn) / d + 4;
      hue *= 60; if (hue < 0) hue += 360;
    }
    return hueDist(hue, cfg.hue) <= 32;
  };
  const isBoundary = (x: number, y: number): boolean =>
    x === 0 || y === 0 || x === w - 1 || y === h - 1 ||
    data[alphaIdx(x - 1, y)] <= 16 || data[alphaIdx(x + 1, y)] <= 16 ||
    data[alphaIdx(x, y - 1)] <= 16 || data[alphaIdx(x, y + 1)] <= 16;
  const smooth = (x: number, y: number): boolean => {
    const L = lum(x, y);
    let grad = 0;
    if (x > 0) grad = Math.max(grad, Math.abs(L - lum(x - 1, y)));
    if (x < w - 1) grad = Math.max(grad, Math.abs(L - lum(x + 1, y)));
    if (y > 0) grad = Math.max(grad, Math.abs(L - lum(x, y - 1)));
    if (y < h - 1) grad = Math.max(grad, Math.abs(L - lum(x, y + 1)));
    return grad <= 0.1;
  };
  const pass = (iters: number, requireSmooth: boolean) => {
    for (let it = 0; it < iters; it++) {
      const toClear: number[] = [];
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const ai = alphaIdx(x, y);
          if (data[ai] <= 16 || !isBoundary(x, y)) continue;
          if (!accentHue(x, y)) continue; // not frame/separator hue → art, keep
          if (requireSmooth && !smooth(x, y)) continue; // textured accent art → keep
          toClear.push(ai);
        }
      }
      if (toClear.length === 0) break;
      for (const ai of toClear) data[ai] = 0;
      peeled += toClear.length;
    }
  };
  // Phase 1: peel the solid accent rind (frame / title border / separator), but
  // only where SMOOTH so textured accent ART (e.g. a lit green tunnel wall) is kept.
  pass(cfg.uniformPeel, true);
  // Phase 2: peel the thin gradient GLOW at the very boundary (a few px, any texture).
  pass(cfg.glowPeel, false);
  return peeled;
}

/**
 * Apply the mask to the card crop, cut alpha (dest-in), optionally peel accent
 * edge remnants, then tight-crop to the opaque bounding box.
 */
export async function maskAndCrop(
  filePath: string,
  bounds: CardBounds,
  includeMasks: MaskShape[],
  excludeMasks: MaskShape[],
  cleanup?: EdgeCleanup,
): Promise<MaskedArt> {
  const pxW = bounds.width;
  const pxH = bounds.height;
  const card = sharp(filePath)
    .rotate()
    .extract({left: bounds.left, top: bounds.top, width: pxW, height: pxH})
    .ensureAlpha();
  const maskPng = await buildMaskPng(includeMasks, excludeMasks, pxW, pxH);
  const masked = await card.composite([{input: maskPng, blend: 'dest-in'}]).png().toBuffer();

  // Work on the raw RGBA so cleanup + bbox happen in one pass without re-encodes.
  const {data, info} = await sharp(masked).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  const ch = info.channels;
  if (cleanup && (cleanup.uniformPeel > 0 || cleanup.glowPeel > 0)) {
    peelAccentEdges(data, info.width, info.height, ch, cleanup);
  }

  let minX = info.width, minY = info.height, maxX = -1, maxY = -1, opaque = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * ch + (ch - 1)] > 16) {
        opaque++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const rawSharp = () => sharp(data, {raw: {width: info.width, height: info.height, channels: ch as 3 | 4}});
  if (maxX < 0) {
    return {png: await rawSharp().png().toBuffer(), width: info.width, height: info.height, transparentRatio: 1};
  }
  const cw = maxX - minX + 1;
  const cwh = maxY - minY + 1;
  const cropped = await rawSharp().extract({left: minX, top: minY, width: cw, height: cwh}).png().toBuffer();
  const transparentRatio = 1 - opaque / (cw * cwh);
  return {png: cropped, width: cw, height: cwh, transparentRatio: +transparentRatio.toFixed(3)};
}

/**
 * Fill interior transparent HOLES (transparent pixels NOT reachable from the
 * image border) by making them opaque. Guarantees the art layer never has
 * transparent islands inside it. Returns the number of hole pixels filled.
 */
export function fillInteriorHoles(data: Buffer, w: number, h: number, ch: number): number {
  const a = (x: number, y: number) => data[(y * w + x) * ch + (ch - 1)];
  const outside = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    const idx = y * w + x;
    if (!outside[idx] && a(x, y) <= 16) { outside[idx] = 1; stack.push(idx); }
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const idx = stack.pop()!;
    const x = idx % w, y = (idx / w) | 0;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
  let filled = 0;
  for (let i = 0; i < w * h; i++) {
    if (!outside[i] && data[i * ch + (ch - 1)] <= 16) { data[i * ch + (ch - 1)] = 255; filled++; }
  }
  return filled;
}

/** Count interior transparent holes (regions not reachable from the border). */
export function countInteriorHoles(data: Buffer, w: number, h: number, ch: number): number {
  const a = (x: number, y: number) => data[(y * w + x) * ch + (ch - 1)];
  const outside = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    const idx = y * w + x;
    if (!outside[idx] && a(x, y) <= 16) { outside[idx] = 1; stack.push(idx); }
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const idx = stack.pop()!;
    const x = idx % w, y = (idx / w) | 0;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
  let holePixels = 0;
  for (let i = 0; i < w * h; i++) if (!outside[i] && data[i * ch + (ch - 1)] <= 16) holePixels++;
  return holePixels;
}

function countOpaque(data: Buffer, w: number, h: number, ch: number): number {
  let n = 0;
  for (let i = 0; i < w * h; i++) if (data[i * ch + (ch - 1)] > 16) n++;
  return n;
}

async function tightCropRaw(data: Buffer, w: number, h: number, ch: number): Promise<{png: Buffer; width: number; height: number; transparentRatio: number}> {
  let minX = w, minY = h, maxX = -1, maxY = -1, opaque = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * ch + (ch - 1)] > 16) {
        opaque++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const rawSharp = () => sharp(data, {raw: {width: w, height: h, channels: ch as 3 | 4}});
  if (maxX < 0) return {png: await rawSharp().png().toBuffer(), width: w, height: h, transparentRatio: 1};
  const cw = maxX - minX + 1, cwh = maxY - minY + 1;
  const png = await rawSharp().extract({left: minX, top: minY, width: cw, height: cwh}).png().toBuffer();
  return {png, width: cw, height: cwh, transparentRatio: +(1 - opaque / (cw * cwh)).toFixed(3)};
}

export interface Candidate {
  png: Buffer;
  width: number;
  height: number;
  transparentRatio: number;
  /** opaque pixels relative to the no-cleanup base (1 = nothing removed). */
  coverageRatio: number;
  holesFilled: number;
  /** interior holes remaining AFTER fill (should be 0). */
  holesRemaining: number;
  strength: number;
}

/**
 * HQ candidate generator: build the full-coverage art mask once (mask + hole-fill,
 * NO peel), then produce cleanup candidates at increasing peel strengths. Each
 * candidate is hole-filled again (safety) and tight-cropped. The caller scores
 * them and picks the lightest cleanup that yields clean edges (max coverage).
 */
export async function generateCandidates(
  filePath: string,
  bounds: CardBounds,
  includeMasks: MaskShape[],
  excludeMasks: MaskShape[],
  accent: {hue: number; sat: number} | undefined,
  strengths: number[],
): Promise<Candidate[]> {
  const pxW = bounds.width, pxH = bounds.height;
  const card = sharp(filePath).rotate().extract({left: bounds.left, top: bounds.top, width: pxW, height: pxH}).ensureAlpha();
  const maskPng = await buildMaskPng(includeMasks, excludeMasks, pxW, pxH);
  const masked = await card.composite([{input: maskPng, blend: 'dest-in'}]).png().toBuffer();
  const {data: base, info} = await sharp(masked).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  const ch = info.channels, w = info.width, h = info.height;
  fillInteriorHoles(base, w, h, ch);
  const baseOpaque = Math.max(1, countOpaque(base, w, h, ch));

  const out: Candidate[] = [];
  for (const s of strengths) {
    const data = Buffer.from(base);
    let holesFilled = 0;
    if (accent && s > 0) {
      peelAccentEdges(data, w, h, ch, {
        hue: accent.hue,
        sat: accent.sat,
        uniformPeel: Math.round(w * 0.011 * s),
        glowPeel: Math.round(w * 0.0025 * s),
      });
      holesFilled = fillInteriorHoles(data, w, h, ch);
    }
    const holesRemaining = countInteriorHoles(data, w, h, ch);
    const opaque = countOpaque(data, w, h, ch);
    const crop = await tightCropRaw(data, w, h, ch);
    out.push({
      png: crop.png,
      width: crop.width,
      height: crop.height,
      transparentRatio: crop.transparentRatio,
      coverageRatio: +(opaque / baseOpaque).toFixed(3),
      holesFilled,
      holesRemaining,
      strength: s,
    });
  }
  return out;
}

function toHex(n: number): string {
  return clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
}

/** Dominant colour + average luminance computed over OPAQUE pixels only. */
export async function artColorStats(artPng: Buffer): Promise<{dominantColor: string; averageLuminance: number}> {
  const {data, info} = await sharp(artPng).raw().toBuffer({resolveWithObject: true});
  const ch = info.channels;
  // Coarse colour histogram (4 bits/channel) over opaque pixels.
  const hist = new Map<number, number>();
  let lum = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += ch) {
    const a = ch === 4 ? data[i + 3] : 255;
    if (a < 128) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    hist.set(key, (hist.get(key) ?? 0) + 1);
    lum += 0.299 * r + 0.587 * g + 0.114 * b;
    n++;
  }
  let best = 0;
  let bestKey = 0;
  for (const [k, c] of hist) if (c > best) ((best = c), (bestKey = k));
  const r = ((bestKey >> 8) & 0xf) * 17;
  const g = ((bestKey >> 4) & 0xf) * 17;
  const b = (bestKey & 0xf) * 17;
  return {
    dominantColor: `#${toHex(r)}${toHex(g)}${toHex(b)}`,
    averageLuminance: n ? +(lum / n / 255).toFixed(3) : 0,
  };
}

export interface ExportResult {
  variants: VariantPaths;
  sizeBytes: VariantSizes;
  width: number;
  height: number;
  aspectRatio: number;
}

/** Export the masked art as 512/1024 WebP WITH ALPHA. */
export async function exportArtVariants(
  artPng: Buffer,
  outDir: string,
  cardCode: string,
  publicBase: string,
  opts: CliOptions,
  writeFile: (path: string, data: Buffer) => Promise<void>,
  joinPath: (...parts: string[]) => string,
): Promise<ExportResult> {
  const makeWebp = async (width: number, quality: number) => {
    let p = sharp(artPng).resize({width, withoutEnlargement: true, kernel: 'lanczos3'});
    if (opts.sharpen === 'mild') p = p.sharpen({sigma: 0.5});
    return p
      .webp({
        quality,
        alphaQuality: opts.alphaQuality,
        effort: opts.webpEffort,
        smartSubsample: true,
        lossless: false,
      })
      .toBuffer({resolveWithObject: true});
  };

  const [large, preview] = await Promise.all([
    makeWebp(opts.largeWidth, opts.qualityLarge),
    makeWebp(opts.previewWidth, opts.qualityPreview),
  ]);

  const previewPath = joinPath(outDir, `${cardCode}-${opts.previewWidth}.webp`);
  const largePath = joinPath(outDir, `${cardCode}-${opts.largeWidth}.webp`);
  await Promise.all([writeFile(previewPath, preview.data), writeFile(largePath, large.data)]);

  const width = large.info.width;
  const height = large.info.height;
  return {
    variants: {
      preview: `${publicBase}/${cardCode}-${opts.previewWidth}.webp`,
      large: `${publicBase}/${cardCode}-${opts.largeWidth}.webp`,
    },
    sizeBytes: {preview: preview.data.length, large: large.data.length},
    width,
    height,
    aspectRatio: +(width / height).toFixed(3),
  };
}
