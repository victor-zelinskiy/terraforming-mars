/**
 * FRAME SYMBOLS — what lets the game's OWN diagnostics journal show `src/client/console/…/handStage.ts:412` instead of
 * `E  main.js:1:2208616` (docs/claude/diagnostics.md § 5 — «the frames of our own code are readable»).
 *
 * The client's bundle is minified, and its source maps are never shipped (they carry the whole source text, three
 * megabytes per megabyte of code). What a frame needs is a fraction of a map: the list of sources, the names, and the
 * mappings. This script writes exactly that beside the two initial chunks —
 *
 *     <out>/main.js.symbols.json      <out>/vendors.js.symbols.json        ({version, sources, names, mappings})
 *
 * — about 2 MB + 1 MB for the whole client (0.7 MB + 0.3 MB compressed in the installer), fetched by the journal only
 * when a record is opened (`src/client/diagnostics/frameSymbols.ts`). Lazy chunks are not covered: a frame inside one
 * stays as V8 printed it.
 *
 * WHEN IT RUNS: at the end of `npm run build:client` (so every build has symbols that match its bundle), and AGAIN in
 * the release workflow after the scripts are stamped with their debug ids — the stamp adds a line at the top of each
 * script and rewrites its map, and the symbols must be cut from THAT map. Idempotent: it overwrites.
 *
 * <out> is `build-desktop/` for a desktop build (DESKTOP_BUILD=1), `build/` otherwise — the same rule as webpack's.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, process.env.DESKTOP_BUILD === '1' ? 'build-desktop' : 'build');

let written = 0;
for (const script of ['main.js', 'vendors.js']) {
  const mapFile = path.join(out, `${script}.map`);
  if (!fs.existsSync(mapFile)) {
    console.log(`[frame-symbols] ${path.relative(root, mapFile)} is absent — no symbols for ${script}`);
    continue;
  }
  const map = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
  const symbols = {version: 3, sources: map.sources ?? [], names: map.names ?? [], mappings: map.mappings ?? ''};
  const target = path.join(out, `${script}.symbols.json`);
  fs.writeFileSync(target, JSON.stringify(symbols));
  written++;
  console.log(`[frame-symbols] ${path.relative(root, target)} — ${(fs.statSync(target).size / 1024 / 1024).toFixed(2)} MB, ${symbols.sources.length} sources`);
}
if (written === 0) {
  console.log('[frame-symbols] nothing written — the journal shows frames as V8 printed them');
}
