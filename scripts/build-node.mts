#!/usr/bin/env node
/*
 * THE NODE LANES — every script of this project that runs in Node, bundled by Vite (Rolldown) as CommonJS
 * (docs/claude/stack.md § 2). Node runs this file as it is (its own type stripping).
 *
 *   node scripts/build-node.mts server      build/src/server/server.js       the game server (npm start · Docker · Heroku)
 *   node scripts/build-node.mts embedded    build/electron/embedded-server.js the server the desktop app hosts (utilityProcess)
 *   node scripts/build-node.mts hub         build/electron/diagnostics-hub.js the diagnostics hub, `require`d by the main process
 *   node scripts/build-node.mts electron    build/electron/{main,preload,curtainPreload}.js — the Electron main process
 *   node scripts/build-node.mts desktop     electron + hub + embedded (what `build:desktop` packs)
 *
 * WHAT EACH LANE BUNDLES, AND WHY:
 *   · server    — our code only; every npm package stays a `require` of node_modules (the image and Heroku install
 *                 the production dependencies; the database drivers load lazily — `database/Database.ts`).
 *   · embedded  — EVERYTHING (the packaged app ships no server node_modules), except the optional native accelerators
 *                 of `ws` and the two database drivers it never loads (it forces the filesystem backend).
 *   · hub       — everything (the shared `src/common/diagnostics` layer and the one piece of `@sentry/core` it uses);
 *                 a CommonJS module whose export is `createDiagnosticsHub` (electron/diagnosticsMain.ts).
 *   · electron  — one self-contained file per entry: a SANDBOXED preload may `require` nothing but `electron`, so
 *                 nothing is shared between the three. `electron` and `velopack` (native, shipped unpacked) stay
 *                 runtime requires; the main process reaches the hub and the embedded server by path at runtime.
 * Every lane writes a source map (never shipped — electron-builder drops `*.map`; the release uploads them so a stack
 * resolves to `src/…:line`, docs/claude/diagnostics.md § 6) and keeps function / class NAMES (`keepNames`): a bundle
 * renames a clashing top-level binding, and a diagnostic label such as `deferred:${action.constructor.name}` must
 * read the class, never `Foo$1`.
 *
 * No `typescript` package is involved: the transpile is Oxc's. Type checking is `npm run typecheck`.
 */
import fs from 'node:fs';
import {builtinModules} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build, type InlineConfig} from 'vite';
import {clientResolve} from '../vite.config.mts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

type Lane = {entry: string, outDir: string, fileName: string, external: Array<string | RegExp>, bundleDependencies: boolean, exports?: 'named'};

/** The optional native modules of `ws` and the database drivers (never loaded where they are external). */
const OPTIONAL_NATIVE = ['bufferutil', 'utf-8-validate', 'pg', 'pg-native', 'better-sqlite3'];

const ELECTRON_EXTERNAL = ['electron', 'velopack'];

const LANES: Record<string, Array<Lane>> = {
  server: [{entry: 'src/server/server.ts', outDir: 'build/src/server', fileName: 'server.js', external: [], bundleDependencies: false}],
  embedded: [{entry: 'src/server/embedded/embeddedServerMain.ts', outDir: 'build/electron', fileName: 'embedded-server.js', external: OPTIONAL_NATIVE, bundleDependencies: true}],
  hub: [{entry: 'src/server/diagnostics/hub/index.ts', outDir: 'build/electron', fileName: 'diagnostics-hub.js', external: [], bundleDependencies: true, exports: 'named'}],
  electron: ['main', 'preload', 'curtainPreload'].map((name) => ({
    entry: `electron/${name}.ts`, outDir: 'build/electron', fileName: `${name}.js`, external: ELECTRON_EXTERNAL, bundleDependencies: true,
  })),
};
LANES.desktop = [...LANES.electron, ...LANES.hub, ...LANES.embedded];

function laneConfig(lane: Lane): InlineConfig {
  return {
    configFile: false,
    root: ROOT,
    mode: 'production',
    logLevel: 'warn',
    envDir: false,
    publicDir: false,
    resolve: clientResolve,
    ssr: {
      target: 'node',
      // `true`: every dependency inside the file; otherwise each npm package stays a `require` of node_modules.
      noExternal: lane.bundleDependencies ? true : undefined,
      external: lane.bundleDependencies ? lane.external.filter((name): name is string => typeof name === 'string') : undefined,
    },
    build: {
      ssr: path.join(ROOT, lane.entry),
      outDir: path.join(ROOT, lane.outDir),
      emptyOutDir: false,
      sourcemap: true,
      minify: false,
      // Node 24 — the runtime of the server, of Electron 45's main process and of its utilityProcess.
      target: 'node24',
      reportCompressedSize: false,
      copyPublicDir: false,
      rolldownOptions: {
        external: lane.external,
        output: {
          format: 'cjs',
          entryFileNames: lane.fileName,
          codeSplitting: false,
          keepNames: true,
          exports: lane.exports ?? 'auto',
        },
      },
    },
  };
}

const requested = process.argv.slice(2);
if (requested.length === 0 || requested.some((name) => LANES[name] === undefined)) {
  console.error(`build-node: name the lane(s) — ${Object.keys(LANES).join(' · ')}`);
  process.exit(2);
}

const lanes = requested.flatMap((name) => LANES[name]);
const started = Date.now();
// The server's output is ONE file now; whatever an older build left under build/src (a per-file `tsc` emit) goes.
if (requested.includes('server')) {
  fs.rmSync(path.join(ROOT, 'build', 'src'), {recursive: true, force: true});
}
// …and so is each Electron script: a module the main process used to load file by file (a per-file emit) must not
// linger beside the bundles and be mistaken for one of them.
if (lanes.some((lane) => lane.outDir === 'build/electron')) {
  const owned = new Set(Object.values(LANES).flat().filter((lane) => lane.outDir === 'build/electron').map((lane) => lane.fileName));
  const dir = path.join(ROOT, 'build', 'electron');
  for (const file of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    const script = file.replace(/\.map$/, '');
    if (script.endsWith('.js') && !owned.has(script)) {
      fs.rmSync(path.join(dir, file), {force: true});
    }
  }
}
for (const lane of lanes) {
  await build(laneConfig(lane));
  console.log(`[build-node] ${path.join(lane.outDir, lane.fileName)}`);
}

// WHAT THE SERVER BUNDLE LEAVES TO node_modules MUST BE A RUNTIME DEPENDENCY. The image (`npm ci --omit=dev`) and Heroku
// (devDependencies pruned after the build) run the server with `dependencies` + `optionalDependencies` only: a server
// module importing a devDependency builds clean and dies on the first `require` in production. Said here, by name.
if (requested.includes('server')) {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {dependencies?: Record<string, string>, optionalDependencies?: Record<string, string>};
  const runtime = new Set([...Object.keys(manifest.dependencies ?? {}), ...Object.keys(manifest.optionalDependencies ?? {})]);
  const bundle = fs.readFileSync(path.join(ROOT, 'build', 'src', 'server', 'server.js'), 'utf8');
  const packageOf = (id: string): string => (id.startsWith('@') ? id.split('/').slice(0, 2).join('/') : id.split('/')[0]);
  const missing = [...new Set([...bundle.matchAll(/require\("([^".][^"]*)"\)/g)].map((match) => packageOf(match[1])))]
    .filter((id) => !id.startsWith('node:') && !builtinModules.includes(id) && !runtime.has(id));
  if (missing.length > 0) {
    console.error(`[build-node] ✖ the server requires ${missing.join(', ')} at run time, and package.json has it only as a devDependency (or not at all) — move it to \`dependencies\``);
    process.exit(1);
  }
}

// The SERVER's build identity beside it (`build/src/genfiles/settings.json`): the e2e harness and its snapshot read
// which commit a served build is (tests/e2e/consoleTest.ts `buildStamp`) — the server itself has it inlined.
if (requested.includes('server')) {
  const genfiles = path.join(ROOT, 'build', 'src', 'genfiles');
  fs.mkdirSync(genfiles, {recursive: true});
  fs.copyFileSync(path.join(ROOT, 'src', 'genfiles', 'settings.json'), path.join(genfiles, 'settings.json'));
}
console.log(`[build-node] ${requested.join(' + ')} in ${Date.now() - started}ms`);
