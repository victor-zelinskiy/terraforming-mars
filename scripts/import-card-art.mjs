/**
 * IMPORT ONE CARD ART — the standard way a single illustration enters the
 * project: `node scripts/import-card-art.mjs <source image> <art key>`.
 *
 *   node scripts/import-card-art.mjs "C:/Users/me/Downloads/Mars Arts/Aquifer Contest.png" RX01
 *
 * The art key is the card's printed code (`metadata.cardNumber` for a project
 * card, the resolution's `code` for a Turmoil Redux resolution) — the same key
 * `cardArt.ts` resolves through `cardArtManifest.json`. The file lands as
 * `assets/card-images/<key>.webp` with the corpus' own encoding (lossy WebP
 * q88, effort 6, alpha 100, smart subsampling — `convert-card-art.mjs`'s
 * settings), the ICC profile kept only when the source carries one, every
 * other metadata stripped. The source is never touched.
 *
 * THE FORMAT IS CHECKED, not assumed: the premium art window is authored for
 * 1536×1024 (3:2). A source of another size is refused unless `--force` is
 * given, in which case it is resized (cover, centre) to the standard frame.
 *
 * After the import run `npm run make:cards` — it regenerates the manifest
 * (`make_card_art_manifest.ts`) and the thumb tier (`make-card-art-thumbs.mjs`);
 * nothing is registered by hand.
 */
import sharp from 'sharp';
import {promises as fs} from 'node:fs';
import path from 'node:path';

const DEST_DIR = path.resolve('assets', 'card-images');
const STANDARD = {width: 1536, height: 1024};
const QUALITY = 88;
const KEY_PATTERN = /^[A-Za-z0-9-]+$/;

async function main() {
  const [source, key, ...flags] = process.argv.slice(2);
  if (source === undefined || key === undefined) {
    console.error('usage: node scripts/import-card-art.mjs <source image> <art key> [--force]');
    process.exit(2);
  }
  if (!KEY_PATTERN.test(key) || key === '-1') {
    throw new Error(`Refusing art key "${key}": expected the printed card code (letters, digits, dashes).`);
  }
  const force = flags.includes('--force');
  const src = path.resolve(source);
  const stat = await fs.stat(src).catch(() => null);
  if (!stat || !stat.isFile()) {
    throw new Error(`Source image not found: ${src}`);
  }
  const meta = await sharp(src).metadata();
  const standard = meta.width === STANDARD.width && meta.height === STANDARD.height;
  if (!standard && !force) {
    throw new Error(`Source is ${meta.width}×${meta.height}; the card art frame is ${STANDARD.width}×${STANDARD.height} (3:2). Pass --force to resize (cover, centre).`);
  }
  await fs.mkdir(DEST_DIR, {recursive: true});
  const out = path.join(DEST_DIR, `${key}.webp`);
  let pipe = sharp(src, {failOn: 'error'});
  if (!standard) {
    pipe = pipe.resize({...STANDARD, fit: 'cover', position: 'centre'});
  }
  if (meta.icc) {
    pipe = pipe.keepIccProfile();
  }
  await pipe.webp({quality: QUALITY, effort: 6, alphaQuality: 100, smartSubsample: true}).toFile(out);
  const outMeta = await sharp(out).metadata();
  const outStat = await fs.stat(out);
  console.log(`imported ${path.basename(src)} → ${path.relative(process.cwd(), out)} (${outMeta.width}×${outMeta.height}, ${(outStat.size / 1024).toFixed(0)} KiB${meta.icc ? ', ICC kept' : ''})`);
  console.log('next: npm run make:cards  (manifest + thumb)');
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
