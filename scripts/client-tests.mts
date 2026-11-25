#!/usr/bin/env node
/*
 * THE CLIENT UNIT RUNNER — `npm run test:client` (the whole suite, behind the count floor of run-tests.mjs) and
 * `npm run test:client:one -- <spec or glob…>` (one file or a glob, no floor). Node runs this file as it is (its own
 * type stripping — no tsx, no build step).
 *
 * WHAT IT DOES: builds ONE ES-module bundle of the given specs with VITE — the product's own bundler, the product's
 * own `@vitejs/plugin-vue` options (`vuePluginOptions` / `clientResolve` of vite.config.mts) — then runs that bundle
 * in THIS node process under mocha, inside the jsdom environment of `tests/client/components/setup.ts`. The in-bundle
 * setup (`tests/client/components/bundleSetup.ts` — auto-unmount, the reactivity scan, the Vapor interop plugin) is the
 * bundle's first module, so it shares one `@vue/test-utils` instance with every spec.
 *
 * A TEMPLATE IS COMPILED AS IT SHIPS (decision S3 of docs/claude/stack.md): the product's build compiles a
 * `<script setup>` component's template INLINE in its setup (`compileScript` with `inlineTemplate`), and so does this
 * bundle — plugin-vue is told the build is a production one (`sfcAsShipped` below), while the RUNTIME stays Vue's
 * development build (`process.env.NODE_ENV` is "development" inside the bundle: warnings, dev-only checks). Guard:
 * tests/client/vapor/sfcCompileParity.spec.ts.
 *
 * WHY MOCHA OVER A BUNDLE, not Vitest (decision S2): Vitest runs modules through Vite's DEV pipeline (a module runner,
 * the dev server's transforms — the template NOT inlined), a different road from the product's production bundle; and
 * the suite is deliberately ONE ordered module graph in one process (tests.md § Traps) with mocha's API in 900 files.
 * A bundle built by the product's bundler is the shortest road to «tested as shipped».
 *
 * THE ONE CHUNK: dynamic `import()`s are inlined (`codeSplitting: false`) — a lazy component's module is in the bundle,
 * and `import()` resolves without a fetch. The runner refuses an output that is not one script.
 *
 * NOT here, on purpose: a watch mode (nobody ran one), a second reporter, parallelism (the specs share module state).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {build, type Plugin} from 'vite';
import vue from '@vitejs/plugin-vue';
import {babelParse, extractIdentifiers, MagicString, parse as parseSfc} from 'vue/compiler-sfc';
import {clientResolve, vuePluginOptions} from '../vite.config.mts';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SETUP = path.join(ROOT, 'tests/client/components/setup.ts');
const BUNDLE_SETUP = path.join(ROOT, 'tests/client/components/bundleSetup.ts');
const TESTING = path.join(ROOT, 'tests/client/testing');

const patterns = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
if (patterns.length === 0) {
  console.error('client-tests: give the spec file(s) or glob(s), e.g. `npm run test:client:one -- tests/client/components/Board.spec.ts`');
  process.exit(2);
}
const specs = [...new Set(patterns.flatMap((pattern) => fs.globSync(pattern.replace(/\\/g, '/'), {cwd: ROOT})))]
  .map((file) => file.split(path.sep).join('/'))
  .filter((file) => fs.statSync(path.resolve(ROOT, file)).isFile())
  // THE ORDER IS PART OF THE RUN: the specs share one bundle and one module-state graph, so the suite runs in ONE
  // fixed order on every machine — by path, compared with `localeCompare` (`consoleX` and `ConsoleY` interleave). A
  // spec that passes only in this order is a leak to fix in the spec that leaves the state behind, never a reason to
  // reorder: run it alone (`npm run test:client:one -- <spec>`) to tell.
  .sort((a, b) => a.localeCompare(b, 'en'))
  .map((file) => path.resolve(ROOT, file));
if (specs.length === 0) {
  console.error(`client-tests: no file matches ${patterns.join(' ')}`);
  process.exit(2);
}

// Stack traces of the bundle are mapped back to the sources (the build writes a source map beside the script).
process.setSourceMapsEnabled(true);

const out = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-client-tests-'));
// `TM_KEEP_TEST_BUNDLE=1` keeps the bundle (and its map) for a look after the run; its path is printed.
if (process.env.TM_KEEP_TEST_BUNDLE === '1') {
  console.log(` VITE  The bundle stays in ${out}`);
} else {
  process.on('exit', () => fs.rmSync(out, {recursive: true, force: true}));
}

// The bundle's ONE entry: the in-bundle setup first, then every spec — executed in this order.
const entry = path.join(out, 'entry.ts');
const importLine = (file: string): string => `import ${JSON.stringify(file.split(path.sep).join('/'))};`;
fs.writeFileSync(entry, [BUNDLE_SETUP, ...specs].map(importLine).join('\n') + '\n');

/**
 * plugin-vue decides «production» from the build's mode; this bundle's mode is development (its runtime is), so the
 * plugin is told — through its public `api.options` — that the COMPILE is the shipped one: template inlined, no
 * devtools metadata. Nothing else of the build changes.
 */
function sfcAsShipped(): Plugin {
  return {
    name: 'tm:sfc-as-shipped',
    configResolved(config) {
      const plugin = config.plugins.find((candidate) => candidate.name === 'vite:vue') as Plugin & {api: {options: Record<string, unknown>}};
      plugin.api.options = {...plugin.api.options, isProduction: true, devToolsEnabled: false};
    },
  };
}

/**
 * THE SETUP BINDINGS, RECORDED (tests/client/testing/scriptSetupState.ts has the whole reasoning). A template compiled
 * inline keeps the bindings to itself; a spec reads them through `wrapper.vm`. So, in THIS bundle only, the end of every
 * `<script setup>` records them — what a separately compiled script would return of them: every binding the script
 * declares (a `let` as a getter with its setter) and every component it imports from a `.vue` file — under the instance
 * being set up.
 * The template, the component's state and its order are untouched: the compile is the shipped one plus one call.
 */
function scriptSetupBindings(): Plugin {
  const recorder = path.join(TESTING, 'scriptSetupState.ts').split(path.sep).join('/');
  return {
    name: 'tm:script-setup-bindings',
    enforce: 'pre',
    transform: {
      filter: {id: /\.vue$/},
      handler(code, id) {
        const {descriptor} = parseSfc(code, {filename: id});
        const block = descriptor.scriptSetup;
        if (block === null) {
          return undefined;
        }
        const entries: Array<string> = [];
        const value = (name: string) => entries.push(name);
        const getter = (name: string, writable: boolean) => entries.push(`get ${name}() { return ${name}; }` + (writable ? `, set ${name}(v) { ${name} = v; }` : ''));
        for (const node of babelParse(block.content, {sourceType: 'module', plugins: ['typescript']}).program.body) {
          // A component imported from a `.vue` file — the name a parent's script binds a child under (a stub by its
          // local name). Any other import is left out: naming it would turn a type imported without `type` into a
          // value import the transpiler can no longer erase (a spec never reads an import off `vm`).
          if (node.type === 'ImportDeclaration' && node.importKind !== 'type' && node.source.value.endsWith('.vue')) {
            // (the DEFAULT import only: a named one off a `.vue` file is one of its exported types)
            for (const specifier of node.specifiers.filter((one) => one.type === 'ImportDefaultSpecifier')) {
              value(specifier.local.name);
            }
          } else if (node.type === 'VariableDeclaration' && !node.declare) {
            for (const declarator of node.declarations) {
              for (const identifier of extractIdentifiers(declarator.id)) {
                if (node.kind === 'const') {
                  value(identifier.name);
                } else {
                  getter(identifier.name, true);
                }
              }
            }
          } else if ((node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration' || node.type === 'TSEnumDeclaration') && node.id) {
            value(node.id.name);
          }
        }
        const edited = new MagicString(code);
        edited.prependLeft(block.loc.start.offset, `import {__tmScriptSetupState} from ${JSON.stringify(recorder)};\n`);
        edited.appendLeft(block.loc.end.offset, `\n__tmScriptSetupState({${entries.join(', ')}});\n`);
        return {code: edited.toString(), map: edited.generateMap({hires: true, source: id})};
      },
    },
  };
}

/**
 * ONE bundle of the unit build: `input` → `<out>/<fileName>`, one file (every `import()` inlined — no chunk a node
 * process would have to fetch).
 */
async function bundleOf(input: string, fileName: string, format: 'es' | 'cjs'): Promise<void> {
  await build({
    configFile: false,
    root: ROOT,
    mode: 'development',
    logLevel: 'warn',
    envDir: false,
    publicDir: false,
    resolve: {
      ...clientResolve,
      alias: [
        // THE SUITE'S LAYER (tests/client/testing/ — docs/claude/vapor/ROADMAP.md § 4b): inside this bundle `vue` and
        // `@vue/test-utils` are the layer, which imports the real packages under the `-real` names. `vue-real` is the
        // build WITH the template compiler: specs stub with string templates (`{template: '<i />'}`).
        {find: /^vue$/, replacement: path.join(TESTING, 'vueForTests.ts')},
        {find: /^vue-real$/, replacement: 'vue/dist/vue.esm-bundler.js'},
        {find: /^@vue\/test-utils$/, replacement: path.join(TESTING, 'vaporTestUtils.ts')},
        {find: /^@vue\/test-utils-real$/, replacement: '@vue/test-utils'},
      ],
    },
    plugins: [
      // `@vue/test-utils` mounts through virtual-DOM scaffolding that leans on the Options API (its own wrapper
      // components): ON in this bundle, OFF in the product.
      vue({...vuePluginOptions, features: {...vuePluginOptions.features, optionsAPI: true}}),
      sfcAsShipped(),
      scriptSetupBindings(),
    ],
    define: {
      // The runtime under test is Vue's DEVELOPMENT build, and so is ours (every `process.env.NODE_ENV` read).
      'process.env.NODE_ENV': JSON.stringify('development'),
    },
    build: {
      outDir: out,
      emptyOutDir: false,
      write: true,
      sourcemap: true,
      minify: false,
      target: 'es2024',
      reportCompressedSize: false,
      chunkSizeWarningLimit: Number.MAX_SAFE_INTEGER,
      modulePreload: false,
      copyPublicDir: false,
      rolldownOptions: {
        input,
        // Node builtins stay node's (a bottle reaches them through `getBuiltinModule` anyway).
        external: [/^node:/],
        // An app build drops what its entry exports; the bottle's page is REQUIRED for its exports (`openPage`).
        preserveEntrySignatures: format === 'cjs' ? 'exports-only' : false,
        output: {format, entryFileNames: fileName, codeSplitting: false},
      },
    },
  });
}

/**
 * THE BOTTLE'S PAGE (tests/client/bottle/consoleBottle.ts § a pristine page): a run with a bottle in it gets a SECOND
 * bundle — `bottlePage.ts` and everything it reaches, as a CommonJS file — which every bottle requires afresh: a new
 * instance of the whole application per page, the suite keeping its own. Named to the suite on `globalThis`.
 */
const withBottle = specs.some((file) => /[\\/]tests[\\/]client[\\/]bottle[\\/]/.test(file));
const pageBundle = path.join(out, 'bottle-page.cjs');

console.log(` VITE  Bundling ${specs.length} spec file(s)${withBottle ? ' and the bottle’s page' : ''}…`);
const started = Date.now();
try {
  await bundleOf(entry, 'client-tests.mjs', 'es');
  if (withBottle) {
    await bundleOf(path.join(ROOT, 'tests/client/bottle/bottlePage.ts'), 'bottle-page.cjs', 'cjs');
  }
} catch (error) {
  console.error(error);
  console.error(' VITE  Failed to bundle');
  process.exit(1);
}
console.log(` VITE  Bundled in ${Date.now() - started}ms`);

const bundle = path.join(out, 'client-tests.mjs');
const expected = withBottle ? ['bottle-page.cjs', 'client-tests.mjs'] : ['client-tests.mjs'];
const scripts = fs.readdirSync(out).filter((file) => /\.(m|c)?js$/.test(file)).sort();
if (scripts.join() !== expected.join()) {
  // ONE script per bundle is the contract: another one would be a chunk nobody loads (`codeSplitting: false`).
  console.error(`client-tests: the test build must be ${expected.join(' + ')} — got ${scripts.join(', ') || 'nothing'}`);
  process.exit(1);
}
if (withBottle) {
  (globalThis as {__TM_BOTTLE_PAGE__?: string}).__TM_BOTTLE_PAGE__ = pageBundle;
}

// THE SUITE AS A CORPUS OF THE KERNEL's STATE SPACE (`TM_UNIT_COVERAGE=<dir>` — see `bundleSetup.ts`): the in-bundle
// setup marks the kernel's trace for the whole run and hands the keys back here, filed as one pass for
// `scripts/kernel-walked.mjs <dir> …` (the shape of a monkey's `cause-classes` file).
const unitCoverageDir = process.env.TM_UNIT_COVERAGE;
if (unitCoverageDir !== undefined && unitCoverageDir !== '') {
  (globalThis as {__TM_UNIT_COVERAGE__?: (keys: ReadonlyArray<string>) => void}).__TM_UNIT_COVERAGE__ = (keys) => {
    const dir = path.join(path.resolve(ROOT, unitCoverageDir), 'cause-classes');
    fs.mkdirSync(dir, {recursive: true});
    fs.writeFileSync(path.join(dir, 'unit-suite.json'), JSON.stringify({
      file: 'unit-suite', title: 'the client unit suite', retry: 0, status: 'passed', specs: specs.length,
      coverage: {keys: [...keys].sort(), machines: {}, frames: []},
    }, null, 1));
    console.log(` COVERAGE  ${keys.length} key(s) of the kernel's state space → ${path.join(dir, 'unit-suite.json')}`);
  };
}

// The jsdom environment — before mocha loads the bundle (the bundle's modules read `document` as they evaluate).
require(SETUP);

const Mocha = require('mocha');
const mocha = new Mocha({ui: 'bdd', reporter: 'spec', color: process.stdout.isTTY === true});
mocha.addFile(bundle);
await mocha.loadFilesAsync();
console.log(' MOCHA  Testing...');
mocha.run((failures: number) => {
  console.log(failures === 0 ? ' MOCHA  Tests completed successfully' : ` MOCHA  Tests completed with ${failures} failure(s)`);
  // The suite leaves timers of the page behind (jsdom, a stray wait of a spec) — the verdict is in, the process ends.
  process.exit(failures === 0 ? 0 : 1);
});
