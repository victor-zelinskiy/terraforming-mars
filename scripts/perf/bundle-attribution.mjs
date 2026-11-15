/**
 * Attribute the client bundle's BYTES by client subtree — the measurement behind the desktop-removal waves (which
 * subgraphs actually weigh what), read off the build's own source maps: every generated character of a script is
 * counted for the source its mapping segment names (what the minifier left of that module, not its source size).
 *
 * Run: npm run build:client          (or any `vite build` — the maps sit beside the scripts)
 *      node scripts/perf/bundle-attribution.mjs [build-dir]      (default: build)
 */
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve(process.argv[2] ?? 'build');
const scripts = [
  ...['main.js', 'vendors.js'].map((file) => path.join(dir, file)),
  ...(fs.existsSync(path.join(dir, 'chunks')) ? fs.readdirSync(path.join(dir, 'chunks')).filter((file) => file.endsWith('.js')).map((file) => path.join(dir, 'chunks', file)) : []),
].filter((file) => fs.existsSync(file) && fs.existsSync(file + '.map'));

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const DIGIT = new Map([...B64].map((char, index) => [char, index]));

/** The `[generatedColumn, sourceIndex]` of every segment of every line (sourceIndex −1 for an unmapped segment). */
function* segments(mappings) {
  let source = 0;
  for (const line of mappings.split(';')) {
    let column = 0;
    for (const segment of line.split(',')) {
      if (segment === '') {
        continue;
      }
      const values = [];
      let value = 0;
      let shift = 0;
      for (const char of segment) {
        const digit = DIGIT.get(char);
        value += (digit & 31) << shift;
        if (digit & 32) {
          shift += 5;
        } else {
          values.push(value & 1 ? -(value >>> 1) : value >>> 1);
          value = 0;
          shift = 0;
        }
      }
      column += values[0];
      if (values.length > 1) {
        source += values[1];
      }
      yield [column, values.length > 1 ? source : -1];
    }
    yield [Infinity, -1]; // end of line
  }
}

const buckets = new Map();
const add = (key, size) => buckets.set(key, (buckets.get(key) ?? 0) + size);

function bucketOf(source) {
  const name = source.replace(/\\/g, '/');
  if (!name.includes('src/client')) {
    if (name.includes('node_modules')) {
      return 'vendor:' + (/node_modules\/((?:@[^/]+\/)?[^/]+)/.exec(name)?.[1] ?? 'other');
    }
    if (name.includes('src/common')) {
      return 'src/common';
    }
    if (name.includes('src/locales') || name.includes('genfiles')) {
      return 'locales+genfiles';
    }
    return 'other';
  }
  return /src\/client\/components\/console\//.test(name) ? 'client:console-components' :
    /src\/client\/console\//.test(name) ? 'client:console-modules' :
    /src\/client\/gamepad\//.test(name) ? 'client:gamepad' :
    /src\/client\/components\/([^/]+)\//.exec(name) !== null ? 'client:components/' + /src\/client\/components\/([^/]+)\//.exec(name)[1] :
    /src\/client\/components\/[^/]+$/.test(name) ? 'client:components-root' :
    /src\/client\/([^/]+)\//.exec(name) !== null ? 'client:' + /src\/client\/([^/]+)\//.exec(name)[1] :
    'client:root';
}

for (const script of scripts) {
  const lines = fs.readFileSync(script, 'utf8').split('\n');
  const map = JSON.parse(fs.readFileSync(script + '.map', 'utf8'));
  let line = 0;
  let previous;
  for (const [column, source] of segments(map.mappings ?? '')) {
    if (previous !== undefined) {
      const end = column === Infinity ? (lines[line]?.length ?? 0) : column;
      if (previous.source >= 0) {
        add(bucketOf(map.sources[previous.source] ?? ''), Math.max(0, end - previous.column));
      }
    }
    if (column === Infinity) {
      line++;
      previous = undefined;
    } else {
      previous = {column, source};
    }
  }
}

const rows = [...buckets.entries()].sort((a, b) => b[1] - a[1]);
const sum = (prefix) => rows.filter(([key]) => key.startsWith(prefix)).reduce((total, [, size]) => total + size, 0);
for (const [key, size] of rows) {
  if (size > 8 * 1024) {
    console.log(String((size / 1024).toFixed(0)).padStart(7) + ' KB  ' + key);
  }
}
console.log('---');
console.log(`client total: ${(sum('client:') / 1024 / 1024).toFixed(2)} MB, vendors: ${(sum('vendor:') / 1024 / 1024).toFixed(2)} MB, ` +
  `grand: ${(rows.reduce((total, [, size]) => total + size, 0) / 1024 / 1024).toFixed(2)} MB (minified bytes, ${scripts.length} scripts)`);
