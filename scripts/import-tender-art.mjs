/**
 * IMPORT TENDER ART — the standard way a tender's blueprint enters the project:
 *
 *   node scripts/import-tender-art.mjs <tender id> [source image]
 *   node scripts/import-tender-art.mjs projectReview
 *
 * The source defaults to `C:/Users/<you>/Downloads/Mars Arts/tenders/<id>.png` (the path every art prompt names —
 * docs/claude/campaign/tender-face.md §5). The result lands as `assets/campaign/tenders/<id>.webp`: centre-cropped to
 * the face's 4 : 3 window, 1200 × 900 (the viewer's reader face paints the window ≈ 830 device px wide on a 4K TV),
 * WebP q86. The source is never touched. Then add `<id>: true` to `TENDER_ART` (`src/client/console/campaign/tenderArt.ts`)
 * — the script prints the reminder and refuses an id that is not a tender.
 */
import sharp from 'sharp';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const W = 1200;
const H = 900;

const [id, srcArg] = process.argv.slice(2);
if (id === undefined || !/^[a-zA-Z]+$/.test(id)) {
  console.error('usage: node scripts/import-tender-art.mjs <tender id> [source image]');
  process.exit(2);
}
const tenders = await fs.readFile('src/common/campaign/tenders.ts', 'utf8');
if (!new RegExp(`\\| '${id}'`).test(tenders)) {
  console.error(`«${id}» is not a TenderId (src/common/campaign/tenders.ts)`);
  process.exit(2);
}
const src = srcArg ?? path.join(os.homedir(), 'Downloads', 'Mars Arts', 'tenders', `${id}.png`);
const out = path.join('assets', 'campaign', 'tenders', `${id}.webp`);
await fs.mkdir(path.dirname(out), {recursive: true});

const meta = await sharp(src).metadata();
await sharp(src)
  .resize(W, H, {fit: 'cover', position: 'centre'})
  .webp({quality: 86})
  .toFile(out);
const {size} = await fs.stat(out);
console.log(`${src} (${meta.width}×${meta.height}) → ${out} (${W}×${H}, ${Math.round(size / 1024)} KB)`);
const art = await fs.readFile('src/client/console/campaign/tenderArt.ts', 'utf8');
if (!new RegExp(`\\b${id}: true`).test(art)) {
  console.log(`next: add «${id}: true» to TENDER_ART in src/client/console/campaign/tenderArt.ts`);
}
