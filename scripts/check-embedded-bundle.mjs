/**
 * EMBEDDED-BUNDLE CODEGEN GUARD — fails the build on a webpack interop bug that
 * is invisible at compile time and fatal at runtime.
 *
 * WHAT IT CATCHES. webpack 5.110.x inlines a deferred CJS namespace
 * (`__webpack_require__.cw`) into a `new` expression WITHOUT parenthesising it:
 *
 *     new gauge_namespaceFn()({name: 'realtime_rooms', ...})
 *
 * JS parses that as `(new gauge_namespaceFn())({...})` — it constructs the
 * wrapper itself, then calls the result — instead of the intended
 * `new (gauge_namespaceFn())({...})`. webpack reports "compiled successfully";
 * the bundle then dies on load with `TypeError: X_namespaceFn is not a
 * constructor`, the embedded server never starts, and the desktop app silently
 * DOWNGRADES to remote mode (electron/main.ts) — so the visible symptom is
 * "games can't be created" against the hosted server, nowhere near the cause.
 *
 * It hit 22 sites in one build: prom-client's Gauge/Counter/Histogram and ws's
 * WebSocketServer. The pattern only appears in this node-target,
 * non-minimised bundle — the client bundles never emit `_namespaceFn`.
 *
 * `webpack` is therefore pinned EXACTLY (no caret) in package.json. This guard
 * is what makes the next bump safe: if a future webpack reintroduces the bug,
 * the build fails here instead of shipping a broken auto-update.
 *
 * Run: node scripts/check-embedded-bundle.mjs   (chained into `npm run build:embedded`)
 */
import fs from 'fs';
import path from 'path';

const BUNDLE = path.resolve('build', 'electron', 'embedded-server.js');
/** `new <ident>_namespaceFn()(` — the mis-parenthesised construction. */
const BROKEN_NEW = /new\s+([A-Za-z0-9_$]+_namespaceFn)\(\)\(/g;

if (!fs.existsSync(BUNDLE)) {
  console.error(`embedded-bundle guard: ${path.relative(process.cwd(), BUNDLE)} not found — did webpack run?`);
  process.exit(1);
}

const source = fs.readFileSync(BUNDLE, 'utf8');
const hits = [...source.matchAll(BROKEN_NEW)];

if (hits.length === 0) {
  console.log('embedded-bundle guard: OK (no mis-parenthesised namespace constructions)');
  process.exit(0);
}

const byName = new Map();
for (const hit of hits) {
  byName.set(hit[1], (byName.get(hit[1]) ?? 0) + 1);
}

console.error(
  `embedded-bundle guard: FAILED — ${hits.length} mis-parenthesised namespace construction(s).\n` +
  `webpack emitted \`new X_namespaceFn()(…)\`, which constructs the wrapper instead of the class.\n` +
  'The bundle compiles but throws "is not a constructor" on load, and the desktop app then\n' +
  'downgrades to remote mode instead of starting the embedded server.\n\n' +
  [...byName.entries()].map(([name, count]) => `  ${count}× new ${name}()(`).join('\n') +
  `\n\nwebpack in use: ${readWebpackVersion()}. Pin \`webpack\` to a version without this bug\n` +
  '(5.109.2 is known good; 5.110.2 is known bad) — see scripts/check-embedded-bundle.mjs.',
);
process.exit(1);

function readWebpackVersion() {
  try {
    return JSON.parse(fs.readFileSync(path.resolve('node_modules', 'webpack', 'package.json'), 'utf8')).version;
  } catch {
    return 'unknown';
  }
}
