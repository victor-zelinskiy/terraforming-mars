// One-off batch converter: PNG (and other raster) card art -> lossy WebP q88.
// - Preserves resolution / proportions / orientation / transparency.
// - Color-safe metadata policy: keeps an embedded ICC profile ONLY when present
//   (stripping it could shift colors); strips EXIF/XMP otherwise.
// - Never touches source files; only writes into DEST.
import sharp from 'sharp';
import {promises as fs} from 'node:fs';
import path from 'node:path';

const SRC = 'C:/Users/zelin/Downloads/Mars Arts';
const DEST = 'C:/Projects/Mods/terraforming-mars/assets/card-images';
const QUALITY = 88;
const SUPPORTED = new Set(['.png', '.jpg', '.jpeg', '.tif', '.tiff', '.webp', '.gif', '.avif']);

const mb = (n) => (n / 1048576).toFixed(2) + ' MB';

async function main() {
  const srcReal = path.resolve(SRC);
  const destReal = path.resolve(DEST);

  // --- Safety guards ---------------------------------------------------------
  if (srcReal.toLowerCase() === destReal.toLowerCase()) {
    throw new Error('Source and destination directories are identical — aborting.');
  }
  const withSep = (p) => p.endsWith(path.sep) ? p : p + path.sep;
  if (withSep(destReal).toLowerCase().startsWith(withSep(srcReal).toLowerCase())) {
    throw new Error('Destination is inside the source directory — aborting to avoid touching source.');
  }
  const srcStat = await fs.stat(srcReal).catch(() => null);
  if (!srcStat || !srcStat.isDirectory()) throw new Error('Source directory does not exist: ' + srcReal);
  await fs.mkdir(destReal, {recursive: true});

  const entries = await fs.readdir(srcReal, {withFileTypes: true});
  const images = entries
    .filter((e) => e.isFile() && SUPPORTED.has(path.extname(e.name).toLowerCase()))
    .map((e) => e.name)
    .sort();
  const unsupported = entries
    .filter((e) => e.isFile() && !SUPPORTED.has(path.extname(e.name).toLowerCase()))
    .map((e) => e.name);

  let converted = 0, srcBytes = 0, dstBytes = 0, iccKept = 0;
  const failed = [];
  const skipped = unsupported.map((n) => ({name: n, reason: 'unsupported extension'}));

  for (const name of images) {
    const inPath = path.join(srcReal, name);
    const outName = name.slice(0, name.length - path.extname(name).length) + '.webp';
    const outPath = path.join(destReal, outName);
    try {
      const [inStat, meta] = await Promise.all([fs.stat(inPath), sharp(inPath).metadata()]);
      let pipe = sharp(inPath, {failOn: 'error'}); // do NOT call .rotate() -> orientation preserved as-stored
      if (meta.icc) {
        pipe = pipe.keepIccProfile(); // color-safe: preserve embedded profile, strip other metadata
        iccKept++;
      }
      await pipe
        .webp({quality: QUALITY, effort: 6, alphaQuality: 100, smartSubsample: true})
        .toFile(outPath);
      const outStat = await fs.stat(outPath);
      srcBytes += inStat.size;
      dstBytes += outStat.size;
      converted++;
      process.stdout.write(`  [${String(converted).padStart(3)}/${images.length}] ${name} -> ${outName}  (${mb(inStat.size)} -> ${mb(outStat.size)})\n`);
    } catch (err) {
      failed.push({name, error: err.message});
      process.stdout.write(`  [FAIL] ${name}: ${err.message}\n`);
    }
  }

  const saved = srcBytes - dstBytes;
  const pct = srcBytes > 0 ? (saved / srcBytes) * 100 : 0;

  console.log('\n============================ REPORT ============================');
  console.log('Source dir      :', srcReal);
  console.log('Destination dir :', destReal);
  console.log('WebP settings   : lossy, quality=' + QUALITY + ', effort=6, alphaQuality=100, smartSubsample');
  console.log('Images found    :', images.length);
  console.log('Converted OK    :', converted);
  console.log('Skipped         :', skipped.length, skipped.length ? JSON.stringify(skipped) : '');
  console.log('Failed          :', failed.length, failed.length ? JSON.stringify(failed) : '');
  console.log('ICC kept        :', iccKept, '(color-safe; EXIF/XMP stripped)');
  console.log('Source total    :', mb(srcBytes), '(' + srcBytes + ' bytes)');
  console.log('WebP total      :', mb(dstBytes), '(' + dstBytes + ' bytes)');
  console.log('Space saved     :', mb(saved), '(' + pct.toFixed(2) + '%)');
  console.log('===============================================================');

  // Machine-readable tail for the assistant to parse reliably.
  console.log('JSON_REPORT=' + JSON.stringify({
    found: images.length, converted, skipped: skipped.length, failed,
    iccKept, srcBytes, dstBytes, saved, pct: Number(pct.toFixed(2)),
  }));
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
