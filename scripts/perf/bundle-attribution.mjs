/**
 * Attribute webpack bundle module sizes by client subtree — the measurement
 * behind the desktop-removal waves (which subgraphs actually weigh what).
 * Run: npx webpack --config webpack.config.js --mode production --json=bundle-stats.json
 *      node scripts/perf/bundle-attribution.mjs [bundle-stats.json]
 */
import fs from 'fs';

const statsPath = process.argv[2] ?? 'bundle-stats.json';
const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
const mods = (stats.modules ?? []).flatMap((m) => m.modules ?? [m]);

const buckets = new Map();
const add = (k, s) => buckets.set(k, (buckets.get(k) ?? 0) + s);

for (const m of mods) {
  const n = String(m.name ?? '').replace(/\\/g, '/');
  const s = m.size ?? 0;
  if (!n.includes('src/client')) {
    if (n.includes('node_modules')) {
      const pkg = /node_modules\/((?:@[^/]+\/)?[^/]+)/.exec(n)?.[1] ?? 'other';
      add('vendor:' + pkg, s);
    } else if (n.includes('src/common')) {
      add('src/common', s);
    } else if (n.includes('src/locales') || n.includes('genfiles')) {
      add('locales+genfiles', s);
    }
    continue;
  }
  const seg =
    /src\/client\/components\/console\//.test(n) ? 'client:console-components' :
    /src\/client\/console\//.test(n) ? 'client:console-modules' :
    /src\/client\/gamepad\//.test(n) ? 'client:gamepad' :
    /PlayerHome\.vue/.test(n) ? 'client:PlayerHome.vue' :
    /src\/client\/components\/([^/]+)\//.exec(n)?.[1] !== undefined ?
      'client:components/' + /src\/client\/components\/([^/]+)\//.exec(n)[1] :
    /src\/client\/components\/[^/]+$/.test(n) ? 'client:components-root' :
    /src\/client\/([^/]+)\//.exec(n)?.[1] !== undefined ?
      'client:' + /src\/client\/([^/]+)\//.exec(n)[1] :
    'client:root';
  add(seg, s);
}

const rows = [...buckets.entries()].sort((a, b) => b[1] - a[1]);
let total = 0;
let vendors = 0;
let client = 0;
for (const [k, v] of rows) {
  total += v;
  if (k.startsWith('vendor:')) {
    vendors += v;
  }
  if (k.startsWith('client:')) {
    client += v;
  }
}
for (const [k, v] of rows) {
  if (v > 8 * 1024) {
    console.log(String((v / 1024).toFixed(0)).padStart(7) + ' KB  ' + k);
  }
}
console.log('---');
console.log('client total: ' + (client / 1024 / 1024).toFixed(2) + ' MB, vendors: ' +
  (vendors / 1024 / 1024).toFixed(2) + ' MB, grand: ' + (total / 1024 / 1024).toFixed(2) + ' MB (unminified module sizes)');
