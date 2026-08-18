/**
 * CARD-ART THUMB TIER — build-time downscale of every card art to a grid-sized
 * variant: `assets/card-images/<key>.webp` (1536×1024, ~284 KiB, ~6 MiB
 * decoded RGBA) → `assets/card-images/thumb/<key>.webp` (512×341, ~20-40 KiB,
 * ~0.7 MiB decoded — 9× less decode CPU and resident bitmap per card).
 *
 * WHY. Dense card surfaces (the «Разыграно» tableau piles, category grids,
 * flight proxies) paint the art at ≤ ~520 CSS px width on every profile; the
 * full-res file buys nothing there but decode spikes and GPU memory — on a
 * 200-card tableau the difference is hundreds of MiB of decoded surface on a
 * Steam-Deck-class shared-memory device. Large renders (fullscreen viewer,
 * the single-card category stage, hero cinematics) keep the full tier.
 *
 * The thumb set mirrors the full set 1:1 (fallback `-1.webp` included), so
 * availability needs no second manifest — `cardArtManifest.json` answers for
 * both tiers. Incremental: an up-to-date thumb (newer than its source) is
 * skipped, so re-runs are cheap.
 *
 * Run: node scripts/make-card-art-thumbs.mjs   (chained into `npm run make:cards`)
 */
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const SRC_DIR = path.resolve('assets', 'card-images');
const OUT_DIR = path.join(SRC_DIR, 'thumb');
const THUMB_WIDTH = 512;
const QUALITY = 78;

async function main() {
  fs.mkdirSync(OUT_DIR, {recursive: true});
  const entries = fs.readdirSync(SRC_DIR, {withFileTypes: true})
    .filter((d) => d.isFile() && d.name.endsWith('.webp'));

  let made = 0;
  let skipped = 0;
  let failed = 0;
  const queue = [...entries];
  const CONCURRENCY = 8;

  async function worker() {
    for (;;) {
      const entry = queue.shift();
      if (entry === undefined) {
        return;
      }
      const src = path.join(SRC_DIR, entry.name);
      const out = path.join(OUT_DIR, entry.name);
      try {
        const srcStat = fs.statSync(src);
        const outStat = fs.existsSync(out) ? fs.statSync(out) : undefined;
        if (outStat !== undefined && outStat.mtimeMs >= srcStat.mtimeMs) {
          skipped++;
          continue;
        }
        await sharp(src)
          .resize({width: THUMB_WIDTH, withoutEnlargement: true})
          .webp({quality: QUALITY, effort: 6})
          .toFile(out);
        made++;
      } catch (err) {
        failed++;
        console.error(`thumb failed: ${entry.name}:`, err.message);
      }
    }
  }

  await Promise.all(Array.from({length: CONCURRENCY}, worker));
  const outBytes = fs.readdirSync(OUT_DIR)
    .filter((f) => f.endsWith('.webp'))
    .reduce((sum, f) => sum + fs.statSync(path.join(OUT_DIR, f)).size, 0);
  console.log(`card-art thumbs: ${made} made, ${skipped} up-to-date, ${failed} failed; tier total ${(outBytes / 1024 / 1024).toFixed(1)} MiB`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();
