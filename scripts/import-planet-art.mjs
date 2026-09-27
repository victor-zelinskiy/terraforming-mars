/**
 * IMPORT ONE COLONY PLANET ART — the standard way a planet disc enters the
 * project: `node scripts/import-planet-art.mjs <source image> <colony key>`.
 *
 *   node scripts/import-planet-art.mjs "C:/Users/me/Downloads/Mars Arts/planets/io.png" io
 *
 * The colony key is the asset's basename in `assets/colonies-planets/` — the
 * file the `.<Name>-background` rule in `src/styles/colonies.less` points at.
 * The result lands as `assets/colonies-planets/<key>.webp`; the source is
 * never touched, and the LESS rule is NOT rewritten (do that by hand once,
 * when the extension changes).
 *
 * WHY THIS IS NOT A PLAIN CONVERT. Every live console surface renders the
 * planet as `background-size: cover` + `background-position: center` inside a
 * `border-radius: 50%` box (the hero on the colony focus stage is 13.6rem =
 * 544 device px on a 4K TV), and paints its OWN key light, atmosphere rim and
 * terminator on top. That makes three properties of the source load-bearing,
 * none of which a converter would give you:
 *
 *   1. The disc must be CIRCULAR. Generators inherit the reference photo's
 *      foreshortening — the shipped Enceladus reference is an egg (V/H 1.24)
 *      and its regenerated master still came back at 1.065. An ellipse in a
 *      circular clip leaves transparent gaps on two sides, so the disc is
 *      resampled back to a circle here, the correction split across both axes
 *      to halve the distortion.
 *   2. The disc must FILL the frame (98%). At 85% the planet floats inside
 *      the CSS rim with a ring of dead space and reads as a pasted photo.
 *   3. The limb must be CLEAN. Resampling a disc that sits on black bleeds
 *      the background inward: measured on Enceladus, the outer 6 px came back
 *      at luminance 42 against 105 just inside it. Under the console's cyan
 *      `__planet-rim` that dark fringe reads as a doubled contour, so the
 *      alpha circle is cut INSET px inside the limb.
 *
 * Two source defects are refused outright rather than silently baked in, both
 * seen in the shipped assets: a disc CROPPED by the frame edge (the old
 * io.jpg ran off the right edge) and a disc that is not a filled circle —
 * i.e. half of it sits in a deep terminator (the same file, its lit chord 201
 * px against a 271 px height). Neither can be repaired downstream. Pass
 * `--force` only when you have looked at the image and know better.
 */
import sharp from 'sharp';
import {promises as fs} from 'node:fs';
import path from 'node:path';

const DEST_DIR = path.resolve('assets', 'colonies-planets');
/** The shipped square. Covers the 544 px hero with 1.9× headroom and a ~1000 px
 *  inspect hero at 1:1; 2048 would quadruple the decoded bitmap (16.8 MB per
 *  planet, ×7 dealt colonies held by the tile grid) for a disc that is 108 px
 *  most of the time. */
const TARGET = 1024;
/** Visible disc diameter as a share of the frame. */
const FILL = 0.98;
/** Pixels of blended limb discarded by the alpha cut (see 3. above). */
const INSET = 5;
/** Alpha feather — one soft pixel, never a baked halo: the CSS rim is the halo. */
const FEATHER = 1.2;
const QUALITY = 88;
const KEY_PATTERN = /^[a-z0-9-]+$/;
/** Below this, the lit region is not a filled disc — a terminator ate part of it.
 *  Calibrated, not guessed: the shipped io.jpg, a genuine half-lit crescent,
 *  measures 0.639, while every accepted master sits at 0.96–0.99 (Pluto's
 *  gentle lower-right falloff is the lowest at 0.961). A tighter bar rejects
 *  honest shading on a high-contrast world; this one only catches a crescent. */
const MIN_ROUNDNESS = 0.90;
/** Mean per-channel distance (0-255) allowed between the source disc and the
 *  written one. Resampling + q88 lands near 2; a shredded buffer lands near 40. */
const MAX_DRIFT = 10;

/** Locate the disc: its bounding box, how round the lit region is, and whether
 *  it runs off the frame. Threshold rides the corners so a source whose
 *  "black" is not quite black still measures honestly. */
async function measure(src) {
  const {data, info} = await sharp(src).removeAlpha().raw().toBuffer({resolveWithObject: true});
  const {width, height, channels} = info;
  const lum = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const o = i * channels;
    lum[i] = (data[o] + data[o + 1] + data[o + 2]) / 3;
  }
  const corner = (x0, y0) => {
    let sum = 0;
    for (let y = y0; y < y0 + 10; y++) for (let x = x0; x < x0 + 10; x++) sum += lum[y * width + x];
    return sum / 100;
  };
  const floor = Math.max(corner(0, 0), corner(width - 10, 0), corner(0, height - 10), corner(width - 10, height - 10));
  const threshold = Math.max(3, floor + 6);

  let x0 = width; let y0 = height; let x1 = -1; let y1 = -1; let area = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (lum[y * width + x] <= threshold) continue;
      area++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) {
    throw new Error('No disc found — the image is uniformly dark.');
  }
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  return {
    width, height, threshold, x0, y0, w, h,
    roundness: area / (Math.PI * (w / 2) * (h / 2)),
    cropped: x0 === 0 || y0 === 0 || x1 === width - 1 || y1 === height - 1,
  };
}

/** The circular alpha: opaque inside `radius`, one feathered pixel, then gone. */
function alphaCircle(size, radius) {
  const mask = Buffer.alloc(size * size);
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c);
      const a = Math.min(1, Math.max(0, (radius - d) / FEATHER + 0.5));
      mask[y * size + x] = Math.round(a * 255);
    }
  }
  return mask;
}

/** Verify the WRITTEN file through its ALPHA, not its colour: everything
 *  outside the mask still carries the rendered limb in RGB, so a colour probe
 *  would report the pre-mask disc and call a broken cut correct. */
async function verify(file) {
  const {data, info} = await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  const {width, height, channels} = info;
  let x0 = width; let y0 = height; let x1 = -1; let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * channels + 3] <= 250) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  const alphaAt = (x, y) => data[(y * width + x) * channels + 3];
  return {
    w: x1 - x0 + 1,
    h: y1 - y0 + 1,
    dx: (x0 + x1) / 2 - (width - 1) / 2,
    dy: (y0 + y1) / 2 - (height - 1) / 2,
    cornersClear: alphaAt(0, 0) === 0 && alphaAt(width - 1, 0) === 0 && alphaAt(0, height - 1) === 0 && alphaAt(width - 1, height - 1) === 0,
  };
}

/** Does the disc that came OUT still look like the disc that went IN? The alpha
 *  probe above is blind to colour, and a stride mismatch shreds the picture
 *  while leaving the mask perfect — that shipped once. Both discs are reduced
 *  to a 32×32 thumbnail and compared over their inscribed circle, which
 *  survives resampling and q88 but not a scrambled buffer. */
async function fidelity(src, m, out, visible) {
  const N = 32;
  const thumb = (pipe) => pipe.resize(N, N, {fit: 'fill'}).removeAlpha().raw().toBuffer();
  const a = await thumb(sharp(src).extract({left: m.x0, top: m.y0, width: m.w, height: m.h}));
  const offset = Math.round((TARGET - visible) / 2);
  const b = await thumb(sharp(out).extract({left: offset, top: offset, width: visible, height: visible}));
  let sum = 0; let n = 0;
  const c = (N - 1) / 2;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (Math.hypot(x - c, y - c) > N * 0.42) continue;
      for (let ch = 0; ch < 3; ch++) {
        sum += Math.abs(a[(y * N + x) * 3 + ch] - b[(y * N + x) * 3 + ch]);
        n++;
      }
    }
  }
  return sum / n;
}

async function main() {
  const [source, key, ...flags] = process.argv.slice(2);
  if (source === undefined || key === undefined) {
    console.error('usage: node scripts/import-planet-art.mjs <source image> <colony key> [--force]');
    process.exit(2);
  }
  if (!KEY_PATTERN.test(key)) {
    throw new Error(`Refusing colony key "${key}": expected the asset basename (lowercase letters, digits, dashes).`);
  }
  const force = flags.includes('--force');
  const src = path.resolve(source);
  const stat = await fs.stat(src).catch(() => null);
  if (!stat || !stat.isFile()) {
    throw new Error(`Source image not found: ${src}`);
  }

  const m = await measure(src);
  const ratio = m.h / m.w;
  console.log(`source ${m.width}×${m.height}  disc ${m.w}×${m.h} (V/H ${ratio.toFixed(4)})  fill ${(100 * m.w / m.width).toFixed(1)}% × ${(100 * m.h / m.height).toFixed(1)}%  roundness ${m.roundness.toFixed(3)}`);
  if (m.cropped && !force) {
    throw new Error('The disc runs off the frame edge — the planet is cropped and cannot be completed here. Regenerate with the whole globe inside the frame, or pass --force.');
  }
  if (m.roundness < MIN_ROUNDNESS && !force) {
    throw new Error(`The lit region is not a filled disc (roundness ${m.roundness.toFixed(3)} < ${MIN_ROUNDNESS}) — a deep terminator has eaten part of the globe. Regenerate evenly lit, or pass --force.`);
  }
  if (Math.abs(ratio - 1) > 0.15) {
    console.warn(`  ! the disc is ${((ratio - 1) * 100).toFixed(1)}% out of round; correcting it will visibly distort surface features`);
  }

  const visible = 2 * Math.round(TARGET * FILL / 2);
  const rendered = visible + 2 * INSET;
  const offset = Math.round((TARGET - rendered) / 2);
  const disc = await sharp(src)
    .removeAlpha()
    .extract({left: m.x0, top: m.y0, width: m.w, height: m.h})
    .resize(rendered, rendered, {fit: 'fill', kernel: 'lanczos3'})
    .toBuffer();
  // `composite` may hand back four channels even when the base was created with
  // three, and a raw buffer read with the wrong channel count is a stride
  // mismatch: the file still measures correct through its alpha while its
  // colour is shredded into an interleaved grid. Take the channel count sharp
  // actually produced, and force it back to RGB so `joinChannel` builds RGBA.
  const {data: canvas, info: canvasInfo} = await sharp({create: {width: TARGET, height: TARGET, channels: 3, background: {r: 0, g: 0, b: 0}}})
    .composite([{input: disc, left: offset, top: offset}])
    .removeAlpha()
    .raw()
    .toBuffer({resolveWithObject: true});
  if (canvasInfo.channels !== 3) {
    throw new Error(`Composited canvas came back with ${canvasInfo.channels} channels, expected 3.`);
  }

  await fs.mkdir(DEST_DIR, {recursive: true});
  const out = path.join(DEST_DIR, `${key}.webp`);
  await sharp(canvas, {raw: {width: TARGET, height: TARGET, channels: 3}})
    .joinChannel(alphaCircle(TARGET, visible / 2), {raw: {width: TARGET, height: TARGET, channels: 1}})
    .webp({quality: QUALITY, effort: 6, alphaQuality: 100, smartSubsample: true})
    .toFile(out);

  const check = await verify(out);
  const drift = await fidelity(src, m, out, visible);
  if (drift > MAX_DRIFT) {
    throw new Error(`The written disc does not match the source (mean channel drift ${drift.toFixed(1)} > ${MAX_DRIFT}) — the pixels were mangled, not merely recompressed. ${path.relative(process.cwd(), out)} is NOT usable.`);
  }
  const outStat = await fs.stat(out);
  console.log(`imported ${path.basename(src)} → ${path.relative(process.cwd(), out)} (${TARGET}×${TARGET}, ${(outStat.size / 1024).toFixed(0)} KiB)`);
  console.log(`  opaque disc ${check.w}×${check.h} = ${(100 * check.w / TARGET).toFixed(1)}% of frame, off-centre by (${check.dx.toFixed(1)}, ${check.dy.toFixed(1)}) px, corners clear: ${check.cornersClear}`);
  console.log(`  fidelity drift ${drift.toFixed(1)}/255 against the source disc`);
  console.log(`next: point src/styles/colonies.less at ${key}.webp if it still names ${key}.png/.jpg, then npm run make:css`);
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
