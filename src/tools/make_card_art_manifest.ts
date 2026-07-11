/*
 * CARD ART MANIFEST GENERATOR (premium card renderer).
 *
 * Scans `assets/card-images/` for per-card artwork files (named by the card's
 * `metadata.cardNumber`, e.g. `014.webp`) and writes the list of available
 * keys to `src/genfiles/cardArtManifest.json`. The client (`cardArt.ts`)
 * consults this manifest to resolve art URLs WITHOUT firing a 404 per
 * missing file — a card whose number is absent from the manifest resolves
 * straight to the shared fallback `-1.webp`.
 *
 * Runs as part of `make:cards` (see package.json) so the manifest can never
 * go stale relative to a build. Paths are cwd-relative (invoked from the
 * repo root), matching export_card_rendering / make_static_json.
 */
import * as fs from 'fs';

const ART_DIR = 'assets/card-images';
const OUT_FILE = 'src/genfiles/cardArtManifest.json';
const FALLBACK_KEY = '-1';

function generate(): void {
  if (!fs.existsSync('src/genfiles')) {
    fs.mkdirSync('src/genfiles');
  }

  if (!fs.existsSync(ART_DIR)) {
    console.warn(`make_card_art_manifest: ${ART_DIR} does not exist — writing an empty manifest.`);
    fs.writeFileSync(OUT_FILE, '[]\n');
    return;
  }

  const keys: Array<string> = [];
  for (const file of fs.readdirSync(ART_DIR)) {
    if (!file.toLowerCase().endsWith('.webp')) {
      continue;
    }
    const key = file.slice(0, -'.webp'.length);
    if (key === FALLBACK_KEY) {
      continue; // The fallback is implicit — never listed as "real" art.
    }
    keys.push(key);
  }
  keys.sort();

  if (!fs.existsSync(`${ART_DIR}/${FALLBACK_KEY}.webp`)) {
    console.warn(`make_card_art_manifest: fallback art ${FALLBACK_KEY}.webp is MISSING from ${ART_DIR}.`);
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(keys, null, 1) + '\n');
  console.log(`make_card_art_manifest: ${keys.length} art files indexed → ${OUT_FILE}`);
}

generate();
