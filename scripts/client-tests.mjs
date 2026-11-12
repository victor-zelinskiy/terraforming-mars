#!/usr/bin/env node
/*
 * THE CLIENT UNIT RUNNER — `npm run test:client` (the whole suite, behind the count floor of run-tests.mjs) and
 * `npm run test:client:one -- <spec or glob…>` (one file, no floor).
 *
 * WHAT IT DOES: builds ONE webpack bundle of the given specs with `webpack.test.config.js` (the production client
 * config as a single chunk — that file's header says why), then runs that bundle in THIS node process under mocha,
 * inside the jsdom environment of `tests/client/components/setup.ts`. The in-bundle setup
 * (`tests/client/components/bundleSetup.ts` — auto-unmount, the reactivity scan, the Vapor interop plugin) is the
 * bundle's first module, so it shares one `@vue/test-utils` instance with every spec.
 *
 * WHY IT IS OURS (2026-11-12, the Vue 3.6 stage — docs/claude/vapor/ROADMAP.md §3.7). This used to be `mochapack`
 * 2.1.5: its last release is from 2021, and it deep-requires the internals of BOTH tools it glues —
 * `webpack/lib/Watching` (moved in webpack 5.112.0) and `mocha/lib/cli/run-helpers` (gone in mocha 12). It was the one
 * package holding the build tool and the test framework a major behind, and the reason for a «ceiling» note in two
 * configs. What it did for a single run is forty lines against the two tools' PUBLIC APIs:
 *
 *   webpack(config with the specs as its entry)  →  one file on disk  →  new Mocha().addFile(it).run()
 *
 * The two flags every direct invocation used to need (`--webpack-config webpack.test.config.js`, without which the
 * run silently collected ZERO tests, and `--include …/bundleSetup.ts`) are not flags any more — they are what this
 * file does.
 *
 * NOT here, on purpose: a watch mode (nobody ran one), a second reporter, parallelism (the specs share module state —
 * tests.md § Traps).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SETUP = path.join(ROOT, 'tests/client/components/setup.ts');
const BUNDLE_SETUP = path.join(ROOT, 'tests/client/components/bundleSetup.ts');

const patterns = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
if (patterns.length === 0) {
  console.error('client-tests: give the spec file(s) or glob(s), e.g. `npm run test:client:one -- tests/client/components/Board.spec.ts`');
  process.exit(2);
}
const specs = [...new Set(patterns.flatMap((pattern) => fs.globSync(pattern.replace(/\\/g, '/'), {cwd: ROOT})))]
  .map((file) => file.split(path.sep).join('/'))
  .filter((file) => fs.statSync(path.resolve(ROOT, file)).isFile())
  // THE ORDER IS PART OF THE RUN: the specs share one bundle and one module-state graph, so the suite runs in ONE
  // fixed order on every machine — by path, compared the way the old runner's glob compared them (`localeCompare`:
  // `consoleX` and `ConsoleY` interleave). A spec that passes only in this order is a leak to fix in the spec that
  // leaves the state behind, never a reason to reorder: run it alone (`npm run test:client:one -- <spec>`) to tell.
  .sort((a, b) => a.localeCompare(b, 'en'))
  .map((file) => path.resolve(ROOT, file));
if (specs.length === 0) {
  console.error(`client-tests: no file matches ${patterns.join(' ')}`);
  process.exit(2);
}

// Stack traces of the bundle are mapped back to the sources (the config emits a source map beside the file).
process.setSourceMapsEnabled(true);

const out = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-client-tests-'));
const dispose = () => fs.rmSync(out, {recursive: true, force: true});
process.on('exit', dispose);

const webpack = require('webpack');
const base = require(path.join(ROOT, 'webpack.test.config.js'));
const config = {
  ...base,
  // The in-bundle setup first, then every spec — one entry, one chunk, executed in this order.
  entry: {'client-tests': [BUNDLE_SETUP, ...specs]},
  output: {...base.output, path: out, filename: '[name].js', clean: false},
};

console.log(` WEBPACK  Compiling ${specs.length} spec file(s)…`);
const started = Date.now();
const stats = await new Promise((resolve, reject) => {
  webpack(config, (error, result) => (error ? reject(error) : resolve(result)));
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
if (stats.hasErrors()) {
  console.error(stats.toString({all: false, errors: true, colors: process.stdout.isTTY}));
  console.error(' WEBPACK  Failed to compile');
  process.exit(1);
}
const warnings = stats.toString({all: false, warnings: true, colors: process.stdout.isTTY});
if (warnings.trim() !== '') {
  console.log(warnings);
}
console.log(` WEBPACK  Compiled successfully in ${Date.now() - started}ms`);

const bundle = path.join(out, 'client-tests.js');
const chunks = fs.readdirSync(out).filter((file) => file.endsWith('.js'));
if (chunks.length !== 1 || !fs.existsSync(bundle)) {
  // ONE chunk is the contract of webpack.test.config.js. A second one (a split `vendors`, an async chunk) means the
  // entry would wait for a chunk nobody loads and register no test at all — the «0 passing, exit 0» that config's
  // header describes. Said here, by name, instead of being left to the count floor.
  console.error(`client-tests: the test build must be ONE chunk — got ${chunks.join(', ') || 'nothing'} (see webpack.test.config.js)`);
  process.exit(1);
}

// The jsdom environment — before mocha loads the bundle, as node loaded it before mocha's globals existed.
require(SETUP);

const Mocha = require('mocha');
const mocha = new Mocha({ui: 'bdd', reporter: 'spec', color: process.stdout.isTTY === true});
mocha.addFile(bundle);
console.log(' MOCHA  Testing...');
mocha.run((failures) => {
  console.log(failures === 0 ? ' MOCHA  Tests completed successfully' : ` MOCHA  Tests completed with ${failures} failure(s)`);
  // The suite leaves timers of the page behind (jsdom, a stray wait of a spec) — the verdict is in, the process ends.
  process.exit(failures === 0 ? 0 : 1);
});
