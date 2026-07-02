/* Convert the big runtime textures to webp at high quality (near-lossless).
 * Keeps original DIMENSIONS (sprite background-position offsets stay valid).
 * Run: node scripts/convert-webp.cjs
 */
const sharp = require('sharp');
const fs = require('fs');

// Photographic surfaces (planet / terraformed-Mars art) → high-quality lossy.
// Icon sprite sheets → lossless (crisp edges + exact sprite offsets preserved).
const targets = [
  {file: 'assets/board/mars.png', mode: 'lossy', quality: 90},        // board planet (centrepiece, scaled up)
  {file: 'assets/resources/card.png', mode: 'lossy', quality: 90},    // card resource art (Mars on black)
  {file: 'assets/board_icons_ares.png', mode: 'lossless'},            // Ares board icon sprite (4×)
];

(async () => {
  for (const t of targets) {
    if (!fs.existsSync(t.file)) {
      console.log(`SKIP (missing): ${t.file}`);
      continue;
    }
    const out = t.file.replace(/\.png$/i, '.webp');
    const meta = await sharp(t.file).metadata();
    const opts = t.mode === 'lossless'
      ? {lossless: true, effort: 6}
      : {quality: t.quality, effort: 6, smartSubsample: true};
    await sharp(t.file).webp(opts).toFile(out);
    const oldMB = fs.statSync(t.file).size / 1048576;
    const newMB = fs.statSync(out).size / 1048576;
    console.log(`${t.file}  ${meta.width}x${meta.height} ${t.mode}  ${oldMB.toFixed(2)}MB -> ${out} ${newMB.toFixed(2)}MB  (${Math.round(100 * newMB / (oldMB || 1))}%)`);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
