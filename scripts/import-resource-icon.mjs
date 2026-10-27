/**
 * IMPORT ONE CARD-RESOURCE ICON — the standard way a premium resource sprite
 * enters the project: `node scripts/import-resource-icon.mjs <source image> <resource>`.
 *
 *   node scripts/import-resource-icon.mjs "C:/Users/me/Downloads/Mars Arts/Leverage.png" Leverage
 *
 * `<resource>` is the `CardResource` LITERAL ('Leverage', 'Syndicate Fleet') — the file name is derived from it the
 * way every reader derives it (`cardResourceIconUrl`, the `@card_resource_types` LESS list, the commit impulse's
 * needles): lower case, spaces → dashes. The icon lands as `assets/resources/<name>.png`, 512×512 RGBA — the size
 * of the premium family (`mech.png`, `graphene.png`, `camp.png`); a non-square source is fitted (contain) on a
 * transparent canvas, never cropped. The source is never touched; `assets/resources/original` is never written.
 */
import sharp from 'sharp';
import {promises as fs} from 'node:fs';
import path from 'node:path';

const DEST_DIR = path.resolve('assets', 'resources');
const SIZE = 512;

async function main() {
  const [source, resource] = process.argv.slice(2);
  if (source === undefined || resource === undefined) {
    console.error('usage: node scripts/import-resource-icon.mjs <source image> <CardResource literal>');
    process.exit(2);
  }
  const name = resource.toLowerCase().replaceAll(' ', '-');
  if (!/^[a-z0-9-]+$/.test(name)) {
    throw new Error(`Refusing resource "${resource}": expected the CardResource literal (letters, digits, spaces).`);
  }
  const src = path.resolve(source);
  const stat = await fs.stat(src).catch(() => null);
  if (!stat || !stat.isFile()) {
    throw new Error(`Source image not found: ${src}`);
  }
  const out = path.join(DEST_DIR, `${name}.png`);
  await sharp(src, {failOn: 'error'})
    .ensureAlpha()
    .resize({width: SIZE, height: SIZE, fit: 'contain', background: {r: 0, g: 0, b: 0, alpha: 0}, kernel: 'lanczos3'})
    .png({compressionLevel: 9, adaptiveFiltering: true})
    .toFile(out);
  const meta = await sharp(out).metadata();
  console.log(`${path.relative(process.cwd(), out)} — ${meta.width}×${meta.height}, ${meta.channels} channels`);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
