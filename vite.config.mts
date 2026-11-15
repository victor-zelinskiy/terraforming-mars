/*
 * THE CLIENT BUILD — Vite 8 (Rolldown) + @vitejs/plugin-vue (docs/claude/stack.md).
 *
 *   npm run build:client            → build/          (the web build: precompressed .br / .gz beside every script)
 *   npm run build:client:desktop    → build-desktop/  (the Electron renderer, read off disk by `app://` — no copies)
 *   npm run dev:client              → the Vite dev server with HMR, proxying the game server (§ dev below)
 *
 * The SAME options compile every single-file component of the product and of the unit-test bundle: the test build
 * (scripts/client-tests.mts) takes `vuePluginOptions` and `clientResolve` from this file, so a template is compiled
 * in one mode for the player and for the specs — the template INLINE in the component's setup, as `compileScript`
 * does for a production build (guard: tests/client/vapor/sfcCompileParity.spec.ts).
 *
 * WHAT THE OUTPUT MUST KEEP — fixed names, because four readers key on them (decision S4 of the stack journal):
 *   index.html                  the SPA shell (src/client/index.html, processed: the module script, its preloads and
 *                               the components' own CSS injected) — served for every SPA route by the server
 *                               (routes/ServeAsset.ts) and by `app://` (electron/protocol.ts)
 *   main.js · vendors.js        the two initial scripts — the server's whitelist, the frame symbols the in-game
 *                               journal resolves a stack with (scripts/make-frame-symbols.mjs), the e2e harness's
 *                               «is this build stale» (tests/e2e/consoleTest.ts)
 *   chunks/<name>.js            every lazy chunk, named after the component (or module) that opens it
 *   sw.js                       the (empty) service worker, registered on http(s) only
 * Everything is an ES module loaded by RELATIVE URL (`base: './'`), so the one output runs under `http://host/` and
 * under `app://bundle/` alike — the desktop build differs only in its directory and in carrying no compressed copies.
 */
import path from 'node:path';
import zlib from 'node:zlib';
import {promisify} from 'node:util';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {defineConfig, type Plugin, type ResolveOptions, type UserConfig} from 'vite';
import vue, {type Options as VueOptions} from '@vitejs/plugin-vue';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

/**
 * How every `.vue` file is compiled — the product AND the unit bundle. A `<script setup vapor>` component is a Vapor
 * component: plugin-vue reads the attribute off the descriptor itself (no wrapper compiler of ours).
 */
export const vuePluginOptions: VueOptions = {
  template: {
    // A template's `src="assets/…"` is a GAME-SERVER path (the card art, the icons — served from `assets/`, by the
    // server and by `app://`), never a module to bundle: no URL in a template is rewritten into an import.
    transformAssetUrls: false,
  },
  features: {
    // No Options-API component is left (the readiness ledger, `options-api: 0`): the runtime drops that code path.
    // (The unit bundle turns it back ON for `@vue/test-utils`' own scaffolding — scripts/client-tests.mts.)
    optionsAPI: false,
    prodDevtools: false,
    prodHydrationMismatchDetails: false,
  },
};

/** `@/` → `src/` from tsconfig.json's own `paths` — the ONE source of the alias (tsc, tsx, vue-tsc, Vite). */
export const clientResolve: ResolveOptions = {
  tsconfigPaths: true,
};

/** The two initial chunks — at the root of the output, by these names (the four readers of the header). */
const INITIAL_CHUNKS = new Set(['main', 'vendors']);

/** A lazy chunk is named after the module that opens it: `ConsoleShell.vue` → `chunks/console-shell.js`. */
function chunkName(facade: string | null | undefined, name: string): string {
  const base = (facade ? path.basename(facade) : name).replace(/\.(vue|ts|js|mjs|css)(\?.*)?$/, '');
  return base.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[^A-Za-z0-9-]+/g, '-').toLowerCase();
}

const brotli = promisify(zlib.brotliCompress);
const gzip = promisify(zlib.gzip);

/** What the client build owns in its output directory — and nothing else there (build/ holds the server and styles). */
const CLIENT_OUTPUTS = /^(index\.html|(main|vendors|sw)\.js(\.map)?(\.symbols\.json)?(\.br|\.gz)?)$/;

/**
 * A build starts from an EMPTY client output: the previous build's files go — its `chunks/` whole (a lazy chunk that
 * is not written again would otherwise linger and be served), its initial scripts and shell — while the rest of the
 * directory (the server's `build/src`, `styles.css`, `build/electron`) is never touched.
 */
function cleanClientOutput(): Plugin {
  let outDir = '';
  return {
    name: 'tm:clean-client-output',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    async buildStart() {
      await fs.rm(path.join(outDir, 'chunks'), {recursive: true, force: true});
      const present = await fs.readdir(outDir).catch(() => [] as Array<string>);
      await Promise.all(present.filter((file) => CLIENT_OUTPUTS.test(file)).map((file) => fs.rm(path.join(outDir, file), {force: true})));
    },
  };
}

/**
 * The WEB build's pre-compressed copies (`<file>.br`, `<file>.gz`): the game server serves them by Accept-Encoding
 * (routes/ServeAsset.ts `toMainFile`). Never for the desktop build — `app://` reads the plain files, and the release
 * stamps debug ids into them after the build (docs/claude/diagnostics.md § 6), which would leave copies stale.
 */
function precompress(): Plugin {
  return {
    name: 'tm:precompress',
    apply: 'build',
    async writeBundle(options, bundle) {
      const outDir = options.dir as string;
      await Promise.all(Object.keys(bundle)
        .filter((file) => /\.(js|css|map)$/.test(file))
        .map(async (file) => {
          const full = path.join(outDir, file);
          const data = await fs.readFile(full);
          // A script or a stylesheet is fetched by every player: the densest Brotli. A source map is fetched only by a
          // developer's tools (and the journal's fallback): a fast level — maximum quality on 30 MB of maps cost the
          // build over a minute and saved nobody a byte that matters.
          const quality = file.endsWith('.map') ? 5 : zlib.constants.BROTLI_MAX_QUALITY;
          const [br, gz] = await Promise.all([
            brotli(data, {params: {[zlib.constants.BROTLI_PARAM_QUALITY]: quality, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: data.length}}),
            gzip(data, {level: file.endsWith('.map') ? 6 : 9}),
          ]);
          await Promise.all([fs.writeFile(full + '.br', br), fs.writeFile(full + '.gz', gz)]);
        }));
    },
  };
}

/**
 * THE DEV SERVER'S DOOR TO THE GAME SERVER (`npm run dev:client` beside `npm run dev:server`). The page is Vite's
 * (the module graph with HMR); every game-server route is proxied to it, so the page talks to ONE origin — no CORS, no
 * second `runtimeConfig`. A browser NAVIGATION to an SPA route stays Vite's (its `index.html`, with the HMR client).
 */
const GAME_SERVER = process.env.TM_GAME_SERVER ?? 'http://localhost:8080';
const SERVER_ROUTES = [
  'api', 'player', 'game', 'games-overview', 'load', 'load_game', 'login', 'reset', 'autopass', 'auth', 'cards', 'help',
  'admin', 'campaign', 'new-game', 'create-game', 'the-end', 'legacy', 'assets', 'styles.css', 'favicon.ico',
];
/** Files the game server owns outright (never a module of the page). */
const SERVER_FILES = new Set(['assets', 'styles.css', 'favicon.ico']);

/**
 * Who answers a request under a server route: `undefined` → the game server; a path → Vite. A browser navigation is
 * the SPA shell; a path WITH an extension is a module of the page (`src/client/cards/…` shares its first segment with
 * the server's `/cards` page); everything else — the extensionless API — is the game server's.
 */
function devRouteBypass(route: string) {
  return (req: {method?: string, url?: string, headers: {accept?: string}}): string | undefined => {
    if (SERVER_FILES.has(route)) {
      return undefined;
    }
    if (req.method === 'GET' && (req.headers.accept ?? '').includes('text/html')) {
      return '/index.html';
    }
    const pathname = (req.url ?? '').split('?')[0];
    return /\.[A-Za-z0-9]+$/.test(pathname) ? req.url : undefined;
  };
}

export default defineConfig(({mode}): UserConfig => {
  const desktop = mode === 'desktop';
  return {
    root: path.join(ROOT, 'src', 'client'),
    base: './',
    publicDir: false,
    // The env files of the repository root are the SERVER's (.env — routes, databases): nothing of them reaches the page.
    envDir: false,
    logLevel: 'info',
    resolve: clientResolve,
    plugins: [cleanClientOutput(), vue(vuePluginOptions), ...(desktop ? [] : [precompress()])],
    build: {
      outDir: path.join(ROOT, desktop ? 'build-desktop' : 'build'),
      // build/ also holds the server's own output and styles.css — never wiped by the client build.
      emptyOutDir: false,
      sourcemap: true,
      // The syntax level the webpack build emitted (ts-loader at tsconfig's es2021): Electron 45's Chromium 156 takes
      // anything, but the WEB build is played in browsers the player brings — the move changes no syntax they meet.
      target: 'es2021',
      reportCompressedSize: false,
      chunkSizeWarningLimit: 4096,
      modulePreload: {polyfill: false},
      rolldownOptions: {
        input: {
          index: path.join(ROOT, 'src', 'client', 'index.html'),
          sw: path.join(ROOT, 'src', 'client', 'sw.ts'),
        },
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: (chunk) => (INITIAL_CHUNKS.has(chunk.name) ? '[name].js' : `chunks/${chunkName(chunk.facadeModuleId, chunk.name)}.js`),
          assetFileNames: (asset) => `chunks/${chunkName(undefined, asset.names[0] ?? 'asset')}${path.extname(asset.names[0] ?? '')}`,
          // THE PARTITION (decision S5 of the stack journal). Left to itself Rolldown splits every module shared
          // between the entry and a lazy chunk into a chunk of its own — 700 files, 60 preloads before the first
          // frame. Three groups say what the partition IS instead:
          codeSplitting: {
            groups: [
              // chart.js — the endgame VP chart's one library — stays OUT of the initial vendors (BND-1,
              // docs/PERFORMANCE_AUDIT.md): its own lazy chunk, fetched when the chart opens.
              {name: 'chartjs', test: /[\\/]node_modules[\\/](chart\.js|@kurkle)[\\/]/, priority: 20},
              // every library — `vendors.js`, beside the app: what changes rarely is cached apart from what changes on
              // every commit. (Rolldown's own helpers — `chunks/rolldown-runtime.js`, < 1 KB — are not a module a
              // group can capture: the bundler keeps them in a chunk of their own when two chunks share them.)
              {name: 'vendors', test: /[\\/]node_modules[\\/]/, priority: 10},
              // everything the entry imports STATICALLY — `main.js`, the page's initial app code in one file (the
              // frame symbols cover it whole: scripts/make-frame-symbols.mjs). What is left are the lazy chunks.
              {name: 'main', tags: ['$initial'], priority: 5},
            ],
          },
        },
      },
    },
    server: {
      port: Number(process.env.TM_VITE_PORT ?? 5173),
      strictPort: true,
      fs: {allow: [ROOT]},
      proxy: {
        ...Object.fromEntries(SERVER_ROUTES.map((route) => [`/${route}`, {target: GAME_SERVER, bypass: devRouteBypass(route)}])),
        '/ws': {target: GAME_SERVER, ws: true},
      },
    },
  };
});
