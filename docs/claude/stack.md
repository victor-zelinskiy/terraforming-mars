# THE STACK — how the project is built, tested and shipped (Vite, since 2026-11-15)

The program that moved the build off webpack (the owner's prompt: `docs/claude/prompts/stack-vite-modernization.md`).
This file is the REFERENCE for the toolchain and the hand-over of the move: what was chosen, why, what was measured,
what is left. What the other sessions do after the move: `stack-migration-notice.md`.

## 0. Where we are (hand-over table — update at every milestone)

| Milestone | State |
| --- | --- |
| M0 baseline measured (webpack, `9539df61b8`, this laptop) | done — § 3 |
| M1 TS 7 readiness on TS 6 | done — § 5 |
| M2 Electron 45.x + Node in sync + guard | done — 45.3.3 / 24.22.3 (S8, S9; 45.3.2 / 24.22.2 at the move, 45.3.3 taken 2026-11-16) |
| M3 client on Vite (product build) | done — `vite.config.mts` |
| M4 unit tests on the Vite pipeline | done — `scripts/client-tests.mts` (9951 collected, the same suite) |
| M5 Node lanes (web server, embedded server, hub, Electron main) | done — `scripts/build-node.mts` |
| M6 webpack removed | done — `npm ls webpack vue-loader ts-loader` is empty |
| M7 dependencies cleaned / updated | done — § 4 |
| M8 CI / release / Docker | done in the files (one action version each, `.nvmrc`, Vite in the release, `ts7-preview`); the verdict is the owner's CI run — Docker cannot be built on this laptop (no daemon) |
| M9 TS 7.1 non-blocking check | done — `scripts/stack/ts7-check.mjs` + CI `ts7-preview` |
| M10 docs, notice, acceptance on the laptop | done — `npm ci` + both builds on a clean clone; lint · typecheck · build:test · test:server (23 062) · test:client (9 953) · test:bottle green; the packed app over `app://` (host mode, a game started, 0 console errors); the dev server with HMR; the diagnostics probe (page · main · server arrived); 53 e2e on the laptop (see the move's report) |

## 1. Decision journal

| # | Decision | Options weighed | Why |
| --- | --- | --- | --- |
| S1 | **Vite 8 (Rolldown) + `@vitejs/plugin-vue` 6 is the ONE bundler** — the client, the unit bundle, every Node lane. webpack, `vue-loader`, `ts-loader`, `fork-ts-checker`, the css/style/less loaders, `compression-webpack-plugin`, `tsconfig-paths-webpack-plugin`, `tsc-alias` and our Vapor workarounds (`sfcTemplateCompiler.cjs`, `unitVaporLoader.cjs`, `unitVaporPolicy.cjs`, the valve `vaporUnit.json`) are gone. Closes ROADMAP §3.7's open question | Rspack 2 (the 2026-10 research's pick — webpack-compatible, kept `vue-loader`); webpack + our compiler hook (status quo) | `vue-loader` is unmaintained and does not know Vapor; plugin-vue reads `vapor` off the descriptor itself. The transpile is Oxc's — no `typescript` package in any build (TS 7 changes only the checks). Build 5× faster (§ 3). The research's worry (Rolldown fragments chunks) is real and is answered by S5 |
| S2 | **Client unit tests: mocha over a Vite bundle** (`scripts/client-tests.mts`: the specs → ONE ES module → mocha in jsdom), not Vitest | Vitest 5 | Vitest executes modules through Vite's DEV pipeline (a module runner, the dev server's transforms): plugin-vue compiles the template SEPARATELY there, and only a hack on its options would inline it — the very gap this move closes. The suite is deliberately ONE ordered module graph in one process (`tests.md` § Traps) with mocha's API in ~900 files and a count floor that parses mocha; a production-shaped bundle of the product's own bundler is the shortest road to «tested as shipped». The same 9951 tests, bundled in ~36 s (webpack: 122 s) |
| S3 | **A unit spec meets the component AS IT SHIPS — the template inline.** The unit bundle tells plugin-vue (its public `api.options`) the compile is the production one (`sfcAsShipped`); the RUNTIME stays Vue's development build. Inline templates keep the setup bindings to themselves, so the bundle — and only it — records them at the end of every `<script setup>` (`scriptSetupBindings` → `tests/client/testing/scriptSetupState.ts`), where the layer reads `wrapper.vm.<binding>` and a stub's local name | keep the separate compile in tests; rewrite the 390 tests (63 files) that read internals through `vm` | Under webpack the two compiled differently (separate template in tests, inline in the product) and nothing said so. The recording is one call per component, no expose, no state — the template is the shipped one. Guard: `tests/client/vapor/sfcCompileParity.spec.ts` (every component of `src/client`, as the unit bundle compiled it: Vapor, no separate render) |
| S4 | **Fixed output names, no hashes**: `index.html` · `main.js` · `vendors.js` · `sw.js` · `chunks/<name>.js|.css` · `chunks/rolldown-runtime.js` | hashed names + `manifest.json` read by the server, `app://`, diagnostics, the e2e harness | Four readers key on these names (the server's whitelist, `app://`, the frame symbols, the harness's «is the build stale»); the cache policy is revalidation (web: ETag + `must-revalidate`; `app://`: code never cached), so a hash buys nothing. Every script is an ES module loaded by RELATIVE url (`base: './'`): ONE output serves `http://host/` and `app://bundle/` — the desktop build differs only in its directory and in carrying no `.br`/`.gz` |
| S5 | **The partition is DECLARED** (`codeSplitting.groups`): `chartjs` (async, BND-1), `vendors` (every `node_modules` module), `main` (tag `$initial` — everything the entry imports statically). A lazy chunk is named after the module that opens it (`ConsoleShell.vue` → `chunks/console-shell.js`); the `webpackChunkName` comments are gone | Rolldown's automatic chunking; `experimentalInlineCommonChunks` | Left to itself Rolldown split every module shared between the entry and a lazy chunk into a chunk of its own: 708 files, 60 `modulepreload`s before the first frame. With the groups: 2 initial scripts + the runtime helpers, 58 lazy chunks. webpack's 4-component `console-menu` group is 4 chunks now (each loads with its screen) |
| S6 | **The SPA shell is a Vite input** (`src/client/index.html` → `build/index.html` · `build-desktop/index.html`); Vite writes the module scripts, their preloads and the components' CSS into it; the game server's own links (`styles.css`, fonts, icon) carry `vite-ignore` | keep the static `assets/index.html` and hand-write `<script type="module">` + preloads + CSS links | The CSS of a component inside `main.js` and the preloads are only known to the build; a hand-written list drifts on the next partition change. ServeApp & co. now rewrite to `/index.html` (served from `build/`) |
| S7 | **Less stays a separate `lessc` step** (`make:css` → `build/styles.css` + `.br` / `.gz`); only the 12 SFC `<style>` blocks go through Vite (`chunks/*.css`) | `import '@/styles/common.less'` into the graph | `styles.css` is a contract of its own: render-blocking in the shell's head, the boot curtain painted from it before any script runs, served identically to the web and the desktop build from `build/`, its `url()`s the game server's paths (Vite would try to resolve 112k lines of them). Bundling it would couple a stylesheet rebuild to a JS build for no gain; `watch:less` stays the dev loop |
| S8 | **The project's Node is the Node Electron carries** — `.nvmrc` (exact), `engines.node` (exact — Heroku installs it), the Dockerfile's `NODE_VERSION`, `@types/node`'s major, CI's `node-version-file: .nvmrc` (one `setup-node` version). Guard: `tests/stack/nodeSync.spec.ts` (+ the binary's own `process.versions.node` where Electron is unpacked — CI unpacks it) | a floating `24` | One Node runs everything: the desktop main process and embedded server ARE Electron's Node; a server or a test on another Node is a difference nobody chose |
| S9 | **Electron 45.3.3** (Node 24.22.3) — 45.3.2 (Node 24.22.2) at the move | — | 45.3.3 was released 2026-11-14 but was NOT on npm on 2026-11-15 (`latest` = 45.3.2), so the move shipped 45.3.2; on 2026-11-16 npm had it and the bump was exactly what this row promised — `ELECTRON_NODE`'s row + `.nvmrc`, `engines.node`, the Dockerfile (Node 24.22.3 is a security release: `docs/ELECTRON_MIGRATION_PLAN.md` § 45.3.1 → 45.3.3) |
| S10 | **Every Node lane is a Vite SSR build** (`scripts/build-node.mts`, CommonJS, `keepNames`): the web server (`build/src/server/server.js` — the same path `npm start`, Docker, Heroku and the e2e harness run), the embedded server, the hub, the Electron main process (one self-contained file per entry: a sandboxed preload may `require` only `electron`) | keep `tsc` emit + `tsc-alias` for the server and `tsc` for Electron | No `typescript` in any build (S1); the server bundle is one file (2 s to build, 5.6 MB; the per-file emit took a minute); the lanes speak one config language. `keepNames`: a bundle renames clashing bindings, and `deferred:${action.constructor.name}` must read the class. The type checks moved to `npm run typecheck` (inside `npm run lint` — the server, the Electron lane and, new, the build's own TypeScript: `tsconfig.tools.json` over `vite.config.mts`, `eslint.config.mts`, `scripts/*.mts`) |
| S11 | **The embedded-server guard RUNS the bundle** (`scripts/check-embedded-bundle.mjs`: the bundle under plain Node with the embedded environment must answer `ready` in 60 s) | the webpack-5.110 pattern grep it replaces | A bundler can fail in a new way; the only question that matters is «does it start» |
| S12 | **The bottle's page is a bundle of its own**, compiled ONCE (`vm.Script`) and RUN per page (`consoleBottle.ts` § a pristine page); a replay reaches the page's modules through `bottle.pageModules` | clearing a module cache (webpack's `__webpack_require__.c` — Rolldown has none); `require` per page | A `require` per page recompiled an 18 MB program and the search ran the process out of heap (4 GB); one compile, many runs is what webpack's module factories did |
| S13 | **Debug ids stay a post-build `sentry-cli sourcemaps inject`** (D5 of `diagnostics.md`), `@sentry/cli` now a pinned devDependency (never `npx --yes @sentry/cli@x` at run time) | `@sentry/vite-plugin` (now possible — every lane is Vite) | One mechanism for every lane, injected only by the release (local and e2e builds unchanged, no token in a build), no plugin tied to Vite's majors |
| S14 | **One version per GitHub action** — the newest ALREADY proven in this repository's runs: `checkout@v6`, `setup-node@v6`, `upload-artifact@v5`, `download-artifact@v5`, `cache@v4`, `setup-dotnet@v4`, `docker/setup-buildx-action@v3`, `docker/build-push-action@v6` | the newest majors (checkout v7, setup-node v7, upload v7, download v8, cache v6, …) | A major of an action is a change nobody can prove from a laptop; the unification is the requirement, the next majors a separate, CI-proven step |
| S15 | **The TypeScript config is a checker's** (`tsconfig.json`): `module: preserve` + `moduleResolution: bundler`, `isolatedModules`, `noEmit`, `useDefineForClassFields: false` stated (the bundler reads it — class fields stay ASSIGNED, as every build of this code did); no `ignoreDeprecations`. Ready for TS 7 as it stands | `module: commonjs` + `moduleResolution: node` (a hard error in TS 7) | Nothing is emitted by `tsc` any more; the config describes the code as the bundler reads it |
| S16 | **The product runs Vue's runtime-only build** (no `vue$ → vue.esm-bundler.js` alias — nothing compiles a template at run time) and `__VUE_OPTIONS_API__: false` (no Options-API component is left). The unit bundle keeps both ON for `@vue/test-utils`' scaffolding and the specs' string-template stubs | — | `vendors.js` −36 % (the template compiler left it) |
| S17 | **Local artifacts of the stack's tools go to ONE ignored folder, `.local/`** (baselines, probes, the TS 7.1 toolchain, `TM_KEEP_TEST_BUNDLE`'s copies stay in the OS temp). The box's snapshots keep their path (`.e2e-<name>/`, `npm run e2e:snapshot` → `e2e:remote`). The root's leftovers of finished sessions — 180 `.e2e-*` snapshots, `screenshots/`, `tmp*`, `test-results/`, `pw-*.log`, `nul`, … — were cleared 2026-11-16 at the owner's word; a snapshot is remade by the next `e2e:snapshot`, the TS 7.1 toolchain by the next `ts7-check` | move the snapshots under `.local/` too | The snapshot path is half of the box's protocol and the box may not be touched in this task, so its compatibility cannot be proven. **A snapshot holds two JUNCTIONS (`assets`, `tests/e2e/fixtures` → the clone's own folders): delete one by removing the links first (`[IO.Directory]::Delete(link, $false)`), then the folder (`rmdir /s /q`) — a recursive delete that follows a link empties the real folder** |

## 2. Build, test, run

**Node** is exactly the one Electron carries: `.nvmrc` (`fnm install` / `fnm use`; in the Bash tool put
`$APPDATA/fnm/node-versions/v<.nvmrc>/installation` first on `PATH`). `npm ci` installs everything; Electron's binary
is unpacked by `node node_modules/electron/install.js` (npm does not — it has no postinstall).

| What | Command | Where it lands |
| --- | --- | --- |
| everything for the web | `npm run build` | `build/` — `index.html`, `main.js`, `vendors.js`, `sw.js`, `chunks/`, `styles.css`, `src/server/server.js` (+ `.br`/`.gz`, maps, frame symbols) |
| the web client only | `npm run build:client` (`vite build` after `make:cards`) | `build/` |
| the desktop app's files | `npm run build:desktop` | `build-desktop/` (the renderer, no compressed copies) + `build/electron/` (`main.js`, `preload.js`, `curtainPreload.js`, `diagnostics-hub.js`, `embedded-server.js`) |
| the server alone | `npm run build:server` (`node scripts/build-node.mts server`) | `build/src/server/server.js` — `npm start` runs it |
| one Node lane | `node scripts/build-node.mts server · embedded · hub · electron · desktop` | |
| the stylesheet | `npm run make:css` (lessc) · `npm run watch:less` | `build/styles.css` |
| the packed app | `npm run pack:dir:win` (build + package) · `npm run pack:only:win` (package the current build) → `npm run electron:run:packed` | `dist-desktop/win-unpacked/` |
| dev: the game server | `npm run dev:server` (tsx watch, :8080) | |
| dev: the client with HMR | `npm run dev:client` (the Vite dev server, :5173 — open `http://localhost:5173/`; it proxies the game server's routes, `TM_GAME_SERVER` / `TM_VITE_PORT` move them) | |
| dev: the desktop window | `npm run electron:dev` (the main process over the Vite dev server) | |
| type checks (the build checks NONE) | `npm run lint:client` (vue-tsc — the only check of templates) · `npm run typecheck` (server + Electron + the build tools) · `npm run build:test` (tests + e2e) — all inside `npm run lint` except `build:test` | |
| unit tests | `npm run test:server` · `npm run test:client` · `npm run test:client:one -- <spec|glob>` (`TM_KEEP_TEST_BUNDLE=1` keeps the bundle) · `npm run test:bottle` | |
| the cost of a build | `node scripts/stack/cold-load.mjs [--root <tree>]` · `node scripts/perf/bundle-attribution.mjs [build]` | |
| the TypeScript 7.1 preview | `node scripts/stack/ts7-check.mjs [trees…] [--checkers N]` (non-blocking, § 5) | `.local/ts7/` |

**Where the configuration lives**: `vite.config.mts` (the client — product, dev server, and the SFC options the unit
bundle reuses) · `scripts/build-node.mts` (the four Node lanes) · `scripts/client-tests.mts` (the unit bundle) ·
`tsconfig.json` (the ONE `@/` alias and the checker's options; `src/` · `electron/` · `tests/` · `tests/e2e/` ·
`tsconfig.vue-tsc.json` extend it) · `eslint.config.mts` · `playwright.config.ts` · `electron-builder.yml`.

**Local artifacts** of the tools (baselines, probes, the TS 7.1 toolchain) go to `.local/` (ignored).

## 3. Cost — before / after (same laptop)

Method: `docs/claude/diagnostics.md` § 9.1 — the baseline is the commit the work stands on (`9539df61b8`), built the old
way on this laptop; the new build is measured on the same machine. Cold load: `node scripts/stack/cold-load.mjs` (a
fresh Chromium context per run, `/` → the main menu, median of 9), the two clients measured ALTERNATELY, twice each,
behind the SAME server bundle (the baseline's own tsc server no longer runs: its packages left) — an earlier pair on a
busy laptop read 433 / 977 ms against 260–320 / 585–690 ms, the same direction.

| | webpack (`9539df61b8`) | Vite |
| --- | --- | --- |
| client production build (web, no type check) | 265 s (+ compression) | ~50 s (with Brotli-11 of every script) |
| desktop client build | 279 s | ~45 s |
| `npm run build` (static + server + client) | ~6 min (lessc + `tsc --build` + webpack 265 s) | 66–79 s |
| `npm run build:desktop` (static + desktop client + the three Node lanes + the start check) | ~6 min (webpack 279 s + 40 s + 2 s + `tsc`) | 58 s |
| embedded server bundle · hub · Electron main | 40 s · 2 s · `tsc` | 2.4 s for the three |
| server build | `tsc --build` + `tsc-alias` | 2 s (bundle) — the type check is `npm run typecheck` |
| `main.js` | 3 019 115 B · 517 575 B br | 2 869 873 B · 503 472 B br (−5 % / −3 %) |
| `vendors.js` | 541 503 B · 165 134 B br | 334 552 B · 102 779 B br (−38 %) |
| lazy chunks | 37 files · 5 317 466 B · 1 107 600 B br | 58 files · 4 605 599 B · 1 070 645 B br |
| cold load — boot mark (`app:bootstrap:start`) | 202–204 ms | 164–173 ms (−17 %) |
| cold load — the main menu laid out | 440–442 ms | 363–376 ms (−15 %) |
| cold load — script bytes fetched (br) | 825 798 B | 691 542 B (−16 %) |
| unit run (`test:client`, 9951 → 9953 tests) | 438 s (bundle 122 s) | 223–351 s (bundle 25–41 s) |
| server suite (`test:server`, 23 058 tests) | — (not re-measured) | 426–473 s |
| type checks | inside `build:server` (`tsc --build`) + `lint:client` | `typecheck` 18–30 s · `lint:client` 82–98 s · `build:test` 113–140 s |

## 4. Dependency inventory (verdict per package, 2026-11-15)

`dependencies` are what RUNS from `node_modules`: the web server's externals (the build fails if the server bundle
`require`s anything else — `scripts/build-node.mts`) and `velopack` (the packaged main process loads it). Everything a
build bundles is a devDependency.

| Package | Verdict | Why |
| --- | --- | --- |
| `console-stamp` · `mnemonist` · `prom-client` · `ws` | **runtime** | the web server requires them (timestamps · MultiSet/MultiMap in 21 files · `/api/metrics` · the realtime gateway) |
| `velopack` | **runtime** | the packaged main process's updater (native, unpacked from the asar) |
| `pg` · `better-sqlite3` | **optional runtime** | the database backends, loaded on demand (`database/Database.ts`; the drivers are `require`d inside the backends — a top-level import becomes a top-level `require` in a bundle) |
| `vue` · `@vueuse/core` · `gsap` · `xstate` · `chart.js` · `simple-keyboard` | dev (bundled into the client) | moved from `dependencies` — the Docker image and Heroku no longer install them at run time |
| `@sentry/core` · `bonjour-service` | dev (bundled into the hub · the embedded server) | moved from `dependencies` |
| `cross-env` | dev | npm scripts only (moved from `dependencies`) |
| `vite` · `@vitejs/plugin-vue` | dev — **new** | the one bundler (S1) |
| `@sentry/cli` | dev — **new, pinned 3.8.2** | the release's debug-id stamp and map upload (was `npx --yes @sentry/cli@3.8.2`) |
| `@jridgewell/trace-mapping` | dev — **new** | the e2e harness's stack mapper (was reached through webpack's tree, and `source-map` through less's) |
| `webpack` · `webpack-cli` · `vue-loader` · `ts-loader` · `fork-ts-checker-webpack-plugin` · `tsconfig-paths-webpack-plugin` · `css-loader` · `style-loader` · `less-loader` · `compression-webpack-plugin` · `tsc-alias` | **removed** | the webpack toolchain (S1); `tsc-alias` rewrote the per-file server emit that no longer exists (S10) |
| `uuid` | **removed** | `crypto.randomUUID()` |
| `ansi-escape-sequences` (+ its `@types`) | **removed** | `util.styleText` |
| `dotenv` | **removed** | `process.loadEnvFile()` |
| `html-escaper` (+ its `@types`) | **removed** | five characters, one local function (`server/responses.ts`) |
| `dialog-polyfill` | **removed** | every runtime has a native `<dialog>` (the script was dead code); its stylesheet styles the native dialogs and is kept VERBATIM in `src/styles/dialog_base.css` |
| `rimraf` | **removed** | `fs.rmSync` in the scripts |
| `spectre.css` | dev — **kept** | `common.less` inlines it: the base typography and the rem the console's logical space rides on; it leaves with the desktop-deletion waves, not with a toolchain change |
| `less` | dev — kept | `make:css` (S7) |
| `mocha` · `chai` · `chai-as-promised` · `tsx` · `fast-check` · `jsdom` · `@vue/test-utils` · `@playwright/test` | dev — kept | the runners (S2); `chai-as-promised` in 4 specs |
| `typescript` · `vue-tsc` | dev — kept (6.x / 3.x) | the checkers; TS 7.1 is § 5 |
| `eslint` · `@eslint/js` · `@typescript-eslint/*` · `eslint-plugin-vue` · `globals` | dev — kept | the lint (`eslint.config.mts`) |
| `electron` · `electron-builder` | dev — kept | 45.3.3 (S9) · `--dir` packaging |
| `sharp` · `png-to-ico` | dev — kept | the asset scripts (card art, the app icon) |
| `@types/*` | dev — kept | `@types/node` 24.x — the Node's major (guard S8) |

**Updated** (within their ranges, floors raised to the installed versions): `@vue/test-utils` 2.6.0 (it hands a mount's slots over COMPILED —
`toCompiledSlots` — so the layer's pinned fact about normalized slots flipped; re-pinned in `vaporTestLayer.spec.ts`), `eslint` 10.15, `ws` 8.23, `better-sqlite3` 13.2,
`electron-builder` 26.18, `tsx` 4.23.15, `chai` 6.3, `less` 4.9.1, `sharp` 0.35.5, … (`npm outdated` is empty but
for the rows below).

**Deliberately NOT updated** (`.github/dependabot.yml` mirrors this list as `ignore` rows, plus `electron` itself — S8/S9;
lifting a hold here removes its row there in the same diff):
- `jsdom` 31 — its CSS engine changes `getComputedStyle`: 3 red specs and an unknown number of green ones quietly
  taking another code path (feature detection must keep seeing the same environment). A migration of its own.
- `typescript` 7.x · `vue-tsc` → `@vue/content-mapper` — § 5.
- `@types/node` 26 — the types follow the Node major we run (24).
- `vue` — the exact RC pin (`3.6.0-rc.15` + `overrides`); a bump is ROADMAP §3.8's protocol, never part of a toolchain move.
- `velopack` — `latest` is a nightly.
- **`@playwright/test` — held at 1.65.0 by the move, 1.65.1 TAKEN 2026-11-16 (pinned EXACTLY; Chromium 159, build
  1255)** once the red it brought was understood. It was the harness's own control, never the product:
  `hung-page-control.spec.ts` C read back no long-animation-frame entry for its 12 s spin. Cause, isolated on this
  laptop with a stand-alone probe over every pair of {Playwright 1.65.0 · 1.65.1} × {Chromium 158 · 159} × {headless
  shell · full browser}: neither Playwright nor the shell — **Chromium 159 records no long-animation-frame entry for a
  frame a debugger pause landed in** (158 recorded it, cut at the pause), and the spin outlived the watch's 10 s, so the
  watch had paused it. The same change reaches the watch itself: a pause it gave up on («never landed» — the thread
  outside JS) cannot be retracted from outside while the thread is stuck (`Debugger.disable`, `setSkipAllPauses`, a
  detach — all wait for the main thread), so it lands on the first JS the thread runs next, often in the stalled frame,
  whose record 159 may then drop (it dropped a rAF callback's frame, kept a ResizeObserver callback's). So: the watch now
  FILES that late landing — «the pause landed N s after it was asked — the thread came back to JS here» with its mapped
  stack — into the same report, whose parts (the native probe, the late stack, the long frames) no longer overwrite each
  other, and an empty long-frame record is said, never left out (`tests/e2e/hungPageWatch.ts`); control C's spin stays
  under the watch's threshold (it reads a frame nobody paused) and a new control D stands the stall outside JS inside a
  frame. Green on 1.65.1 under the shell and the full browser (CI's), 4 / 4 each, and the driver canary.
- **Oxlint** — not added: the lint's rules are mostly STYLISTIC (indent, quotes, spacing — eslint-config-google's), which
  Oxlint does not implement; it would be a second tool next to ESLint for a fraction of the rules. Worth it the day the
  lint moves to type-aware correctness rules (TS 7).
- **GitHub actions' newer majors** (S14).

## 5. TypeScript 7.1 — readiness, the check, the remaining blockers

**Done on TypeScript 6** (the code is clean for 7 as it stands):
- `tsconfig.json`: `module: preserve` + `moduleResolution: bundler` (`node` / node10 is a hard error in 7), no
  `ignoreDeprecations`, `isolatedModules`, `noEmit` (S15); `electron/tsconfig.json` the same (it emitted CommonJS with
  `moduleResolution: node`); the dead `plugins: [{transform: 'transformer-module'}]` and the unused
  `tsconfig.e2e-typecheck.json` removed.
- `import … from '….json' assert {type: 'json'}` (2×) — the attribute dropped (it is a syntax error in 7, and with it
  `tsc` silently skipped the whole semantic check); `cast`'s second overload lost its stray `<T>`; `<a calassc>` in
  `admin/GameOverview.vue` (a real bug the mapper found) fixed; `import X = require('better-sqlite3')` became a type-only
  import (the driver is required lazily).
- The `GlobalDirectives` / `GlobalComponents` declarations the 2026-10-28 probe had to adapt no longer exist (V4: nothing
  is registered globally).
- **No build depends on the `typescript` package** (S1, S10): Vite (Oxc) transpiles every lane; tsx runs the tests.
  Moving to 7.1 changes the checks and the lint only.

**The check** — `node scripts/stack/ts7-check.mjs` (and the CI job `ts7-preview`, `continue-on-error`): the same trees
with TS 6 and with TS 7.1 (+ `@vue/content-mapper` for the client), the DIFFERENCE printed; `--checkers N` for the
mapper's speed. The 7.1 toolchain is an isolated install in `.local/ts7/` (pins in the script).

**The first reading (2026-11-15, this laptop, TS 6.0.3 / vue-tsc 3.3.14 against TS 7.1.0-beta / content-mapper 4.0.0-alpha.3):**

| tree | TS 6 | TS 7.1 | only in 7.1 |
| --- | --- | --- | --- |
| server (`src/tsconfig.json`) | 0 errors · 22.5 s | 0 errors · 1.9 s | 0 |
| electron | 0 · 2.2 s | 0 · 0.4 s | 0 |
| tests | 0 · 102.5 s | 0 · 17.7 s | 0 |
| e2e | 0 · 44.3 s | 0 · 4.8 s | 0 |
| client (vue-tsc ↔ tsc + mapper) | 0 · ~60 s | 58 · 18.4 s (`--checkers 8` 16.7 s · `--checkers 1` 24.2 s) | 58 |

So everything but the `.vue` files is ALREADY clean for 7.1, five to twelve times faster; the mapper (alpha.3) is now
3–3.6× faster than vue-tsc (the 2026-10-28 probe on alpha.0 found it no faster), the checkers adding little past the
default. The 58 client diagnostics are the mapper being STRICTER than vue-tsc, not defects of the product: ~30
fall-through attributes on components (`title` / `id` / `aria-*` / an `on…` listener a child does not declare —
vue-tsc lets an undeclared attribute fall through), ~12 attributes of their own spelling (`xmlns:xlink`, `tm-has-i18n`,
`data_space_id`, `:data=`), 14 comparisons inside a `v-if` / `v-else-if` chain the mapper narrows across, one
`value` beside a `v-model` (`LoadGameForm.vue` — frozen desktop UI). With `dataAttributes: ['data-*']` (vue-tsc's own
behaviour, set in the script) — without it the first run reported 2 026, nearly all `data-*`.

**Blockers of the switch (2026-11-15)**:
- TypeScript **7.1 is a beta** (`7.1.0-beta`; no RC). `latest` is 7.0.2, which has no content mappers — the `.vue`
  files cannot be checked by 7.0 at all.
- **`@vue/content-mapper` is `4.0.0-alpha.3`** (Vue Language Tools v4); `vue-tsc` 3 runs on TypeScript 6's JS API only.
- **typescript-eslint 8** parses through TypeScript's JS API (`typescript-estree`), which 7 does not have; the lint is not
  type-aware, but it cannot run with `typescript@7` installed as `typescript` until typescript-eslint supports it (or
  the lint's parser stops needing it).
- The editor: VS Code's built-in TS is 6; 7 needs the «TypeScript (Native Preview)» extension with content mappers on
  (`js/ts.contentMappers.enabled`) for `.vue`.

**The switch, when they fall** (a version bump, nothing else):
1. `ts7-check.mjs --strict` green on the versions to take (bump its pins first).
2. `typescript` → 7.1.x; `@vue/content-mapper` → its stable; remove `vue-tsc`; typescript-eslint → a version that
   supports 7.
3. `tsconfig.vue-tsc.json` gains `contentMappers: [{package: '@vue/content-mapper', extensions: ['.vue']}]`;
   `lint:client` becomes `tsc --noEmit --runExternalCode -p tsconfig.vue-tsc.json`. `typecheck` and `build:test` stay.
4. Delete the CI job `ts7-preview` and the script (or keep it for 7.2).

## 6. Incidents of the move

- 2026-11-15, the first cold-load measurement started the repository's own server with `LOCAL_FS_DB` (the
  local-filesystem database is not redirected by `TM_DB_FOLDER`) and the clean-up then removed `db/files` in the
  repository root. `db/game.db` (the SQLite database) was not touched; whether `db/files` held anything before the run
  is unknown (it is ignored by git; the perf seed scripts write there). The script now runs a throwaway SQLite
  database (`TM_DB_FOLDER`), the e2e harness's own way.
