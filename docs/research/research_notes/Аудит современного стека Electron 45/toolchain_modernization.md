# Build / test / lint / CSS toolchain modernization for a large Vue 3.5 + TypeScript + Electron 45 project — state as of 2026-10-22

Method note: versions, publish dates, peer ranges and engines were read directly from the npm registry (`npm view <pkg> version|time|peerDependencies|engines|dist-tags`, i.e. `registry.npmjs.org/<pkg>`) on 2026-10-22 and are treated as primary. Several GitHub-release pages were summarised by a fetch tool that printed the year as "2024" for releases npm dates to 2026 (electron-vite 6.0.0, Electron Forge 8.0.x). Where they conflict, the npm timestamp wins. Repo facts come from read-only inspection of `C:\Projects\Mods\terraforming-mars` (package.json, webpack*.config.js, tsconfig*.json, eslint.config.mjs, tests/client setup, ripgrep counts over `src/styles` and `src`). No installs, builds or edits were run. "Inference" bullets are my analysis. They are not facts from a source.

## Q0. What is the current toolchain actually coupled to? (repo baseline that every verdict below depends on)

### Takeaway
Four couplings drive everything. mochapack ties the client test suite to webpack internals. `ts-loader` and `fork-ts-checker` tie transpilation and type-checking to the TypeScript 6 JS API. A `moduleResolution: "node"` tsconfig is a hard error in TS 7. And a 112k-line Less codebase uses about 9.4k `&__`/`&--` suffix selectors and about 3.3k `fade()` calls, which native CSS cannot express directly. The production bundle config itself is plain and portable.

### Cited Findings
- The webpack pin is exact: `"webpack": "5.111.1"`, with `webpack-cli ^7.2.2`, `vue-loader ^17.0.0`, `ts-loader ^9.6.2`, `fork-ts-checker-webpack-plugin ^9.1.0`, `tsconfig-paths-webpack-plugin ^4.2.0`, `compression-webpack-plugin ^12.0.0`, `less-loader ^13`, `mochapack ^2.1.5`, `typescript ^6.0.3`, `vue-tsc ^3.3.9`, `electron 45.0.0`, `electron-builder ^26.15.3`, and `engines.node ">=24.20.0 <25"` — [package.json](C:/Projects/Mods/terraforming-mars/package.json)
- webpack 5.112.0 was published 2026-10-15T22:26Z and 5.111.1 on 2026-09-18, so the mochapack-induced ceiling is currently only one minor behind latest — [npm registry: webpack](https://registry.npmjs.org/webpack)
- mochapack 2.1.5 is still `latest`. Its declared peers are `webpack "^4.0.0 || ^5.0.0"` and `mocha ">=6"`, so the registry still claims compatibility with 5.112, which the repo found false (deep require of `webpack/lib/Watching`, moved to `lib/watch/Watching` in 5.112.0) — [npm registry: mochapack](https://registry.npmjs.org/mochapack); [webpack.test.config.js header](C:/Projects/Mods/terraforming-mars/webpack.test.config.js)
- Client production config:
  - Entries: `main` and `sw`.
  - `ts-loader` with `transpileOnly: true` and `appendTsSuffixTo: [/\.vue$/]`. `css-loader` uses `url: false`. `.less` goes through style-loader, css-loader and less-loader.
  - `DefinePlugin` sets `__VUE_OPTIONS_API__: true`. The alias `vue$` points to `vue/dist/vue.esm-bundler.js`.
  - `output.hashFunction: 'xxhash64'`. `publicPath` is `app://bundle/` when `DESKTOP_BUILD=1`. `chunkFilename: 'chunks/[name].js'`.
  - `splitChunks` has async-only `chartjs` and `markdownit` cache groups (priority 20, `enforce`) plus a fixed-name `vendors` group (`chunks: 'all'`) whose test excludes those two libs.
  - Production adds gzip and brotli `CompressionPlugin`s, with brotli at `BROTLI_MAX_QUALITY`. `fork-ts-checker` runs unless `SKIP_TS_CHECK=1`.
  - Source: [webpack.config.js](C:/Projects/Mods/terraforming-mars/webpack.config.js)
- Embedded server bundle: `target: 'node'`, `ts-loader` transpileOnly, `TsconfigPathsPlugin`, externals (`pg`, `pg-native`, `better-sqlite3`, `bufferutil`, `utf-8-validate`), `node: {__dirname: false, __filename: false}`, `minimize: false`, `splitChunks: false`. A post-build guard `scripts/check-embedded-bundle.mjs` checks for the 5.110.0–5.110.2 `new X_namespaceFn()(...)` miscompile — [webpack.embedded.config.js](C:/Projects/Mods/terraforming-mars/webpack.embedded.config.js)
- The test webpack config forces a single chunk (`dynamicImportMode: 'eager'`, `splitChunks: false`, `runtimeChunk: false`). Without that, mochapack's `isOnlyInitial()` chunk filter silently ran 0 tests — [webpack.test.config.js](C:/Projects/Mods/terraforming-mars/webpack.test.config.js)
- Base tsconfig: `module: "commonjs"`, `moduleResolution: "node"`, `"ignoreDeprecations": "6.0"`, `target: "es2021"`, `lib: ["dom","es2023"]`, `paths: {"@/*": ["./src/*"]}`, `strict`, `noUnused*`, `esModuleInterop: true`, `incremental: true` — [tsconfig.json](C:/Projects/Mods/terraforming-mars/tsconfig.json)
- The ESLint flat config is **not type-aware**: there is no `parserOptions.project`/`projectService`. Rules are `@eslint/js` recommended, about 30 eslint-config-google style rules (`indent`, `quotes`, `semi`, `comma-dangle`, `space-before-function-paren`, `operator-linebreak`, …), two `@typescript-eslint` rules, `vue/multi-word-component-names` and `vue/no-reserved-component-names`, plus one `no-restricted-syntax` AST selector for card files — [eslint.config.mjs](C:/Projects/Mods/terraforming-mars/eslint.config.mjs)
- Test tree size (rg counts): 574 client `*.spec.ts` under `tests/client` and 1,846 non-client, non-e2e spec files. Client specs import `chai` in 575 places and `@vue/test-utils` in 186. 34 client spec files use Mocha `before(`/`after(` hooks and 5 use `this.timeout/skip/retries`. Only 4 files across `tests/` use `chai-as-promised` — repo grep (`tests/`)
- The client test environment is hand-built. `tests/client/components/setup.ts` creates one JSDOM and copies **only DOM constructors** onto `global`, deliberately not `requestAnimationFrame`/`matchMedia`/`scrollTo`, so feature detection keeps its degraded path. `bundleSetup.ts` enables VTU auto-unmount because a shared process once produced 432 failures and a 6× wall-clock blow-up — [tests/client/components/setup.ts](C:/Projects/Mods/terraforming-mars/tests/client/components/setup.ts), [bundleSetup.ts](C:/Projects/Mods/terraforming-mars/tests/client/components/bundleSetup.ts)
- Bundler-specific source code: about 17 lazy routes in `App.vue` use `/* webpackChunkName: ... */` magic comments (several share `"console-menu"`), and `process.env.NODE_ENV` appears in 3 client files. No `require.context`/`module.hot` — repo grep (`src/client`)
- Styles:
  - 127 `.less` files of about 112k lines in `src/styles`, compiled outside webpack by `lessc src/styles/common.less build/styles.css`. Only 13 of 437 `.vue` files have a `<style>` block, and 10 use `lang="less"`.
  - Less-specific usage: `fade(` ×3,331, `mix(` ×52, `lighten(` ×20, `darken(` ×2, `each(` ×21, guards (`when (`) ×3, about 394 Less variable declarations, about 390 mixin call sites (top: `.con-read-text` ×33, `.fsr-accent` ×27, `.vp-accent` ×25, `.premium-tooltip` ×15), ~9,364 `&__`/`&--`/`&-` suffix selectors, and 226 `~"…"` escapes.
  - CSS custom properties are already used heavily (`var(--` ×4,361). The `saturate(` ×66 count is ambiguous because native CSS `filter: saturate()` shares the name.
  - Sources: package.json `make:css`; rg over `src/styles`
- Server and common code use non-erasable TypeScript: 27 `export enum`, 39 constructors with parameter properties, 8 `namespace` declarations, and one `import x = require(...)` (SQLite.ts) — rg over `src/`
- Electron packaging is narrow. electron-builder only produces `--dir` output (`electronDist: node_modules/electron/dist`, `npmRebuild: false`, explicit `files` allowlist), and Velopack `vpk pack` produces installers, deltas and the update feed — [electron-builder.yml](C:/Projects/Mods/terraforming-mars/electron-builder.yml)

### Inferences
- The production webpack config uses no exotic plugin internals. Everything in it (VueLoaderPlugin, DefinePlugin, ProgressPlugin, CompressionPlugin, fork-ts-checker, tsconfig-paths, standard loaders, splitChunks cacheGroups) is on Rspack's supported list or has a built-in replacement (see Q1). **The only webpack-internals consumer is mochapack.** So any bundler move first needs a test-runner move, or the repo must keep webpack 5.111 just for tests.
- `transpileOnly: true` already means per-file transpilation with no cross-file type information, the same semantics SWC or Oxc give. A move to `builtin:swc-loader` or Vite/Oxc therefore loses no compile-time behaviour (e.g. cross-file `const enum` inlining was already off).
- The non-type-aware ESLint config means Oxlint's *non*-type-aware rule set can cover almost all of it. Oxlint's type-aware mode, which needs TS 7, is irrelevant today.

### Gaps
- No wall-clock baselines were measured (constraint: no builds). The real split of `build:client` time across fork-ts-checker, ts-loader, terser minification, source maps and brotli-11 compression, and the time of `test:client`, `lint:server` and `lint:client`, are unknown. Every speedup below is a published figure from other projects. None is a projection for this repo.

## Q1. Rspack 2 / Rsbuild 2: version, webpack-config compatibility, Vue/TS/plugins, node-target bundles, speedups, and does mochapack run on it?

### Takeaway
Rspack 2.x (2.0 on 2026-04-22, latest 2.2.9 on 2026-10-13) is the lowest-effort way off webpack. Our config maps almost 1:1: vue-loader ≥17.2.2 with `experimentalInlineMatchResource`, `builtin:swc-loader`, `resolve.tsConfig`, `ts-checker-rspack-plugin`, and a compatible compression-webpack-plugin. It keeps webpack's `splitChunks`/`cacheGroups` semantics and supports `target: 'node'`. It does **not** inherit webpack's deep-import surface, so mochapack cannot run on it. Published speedups range from about 25–52% (Yelp, webpack 5) to about 20× (GitLab, webpack 4 baseline).

### Cited Findings
- **Release and changes.** Rspack 2.0 released 2026-04-22.
  - Speed: about 10% faster than 1.7 (3.6 s → 3.1 s no-cache on their benchmark). Persistent cache drops builds to 1.4 s (from 2.2 s). Memory is down more than 20% with cache.
  - Breaking: `@rspack/core`, `@rspack/cli` and `@rspack/dev-server` are now **pure ESM** (CJS builds removed; Node 20+ can load them via `require(esm)`). Built-in loaders and minimizers inherit the top-level `target`. `builtin:swc-loader` gains `detectSyntax: 'auto'`.
  - The team says webpack compatibility remains "an important goal". The 1.x line keeps getting critical fixes.
  - Source: [Rspack 2.0 announcement](https://rspack.rs/blog/announcing-2-0)
- Current version is `@rspack/core` 2.2.9 (2026-10-13) with engines `node "^20.19.0 || >=22.12.0"`. `@rsbuild/core` is 2.2.14, `@rsbuild/plugin-vue` 2.0.1, `@rsbuild/plugin-less` 2.0.1 — [npm registry: @rspack/core](https://registry.npmjs.org/@rspack/core), [@rsbuild/core](https://registry.npmjs.org/@rsbuild/core)
- Rspack weekly npm downloads went from about 100k at 1.0 to more than 5 million — [InfoQ (search summary)](https://infoq.com/news/2026/07/rspack-2-release)
- The webpack migration guide maps the pieces this way:
  - `ts-loader`/babel → `builtin:swc-loader` with `detectSyntax: 'auto'`
  - `tsconfig-paths-webpack-plugin` → `resolve.tsConfig: path.resolve(__dirname, 'tsconfig.json')`
  - `fork-ts-checker-webpack-plugin` → `ts-checker-rspack-plugin`
  - terser → `SwcJsMinimizerRspackPlugin`; css-minimizer → `LightningCssMinimizerRspackPlugin`
  - "Rspack is compatible with most webpack loaders."
  - Source: [Rspack migration guide (v2 docs)](https://v2.rspack.rs/guide/migration/webpack)
- Vue 3 works with `vue-loader >= 17.2.2` plus `VueLoaderPlugin` and the `experimentalInlineMatchResource: true` option. With those, `lang="ts"` and CSS in SFCs can go through Rspack's native TS/CSS processing — [Rspack Vue guide (search summary of rspack.rs/guide/tech/vue)](https://rspack.dev/guide/tech/vue). Latest `vue-loader` is 17.4.2 with peer `webpack "^4.1.0 || ^5.0.0-0"` — [npm registry: vue-loader](https://registry.npmjs.org/vue-loader)
- `@rsbuild/plugin-vue` 2.0.1 depends on **`rspack-vue-loader ^17.5.1`** (latest 17.7.1, peer `@rspack/core ^1 || ^2`), a separate Rspack-specific loader package. It does not use upstream `vue-loader` — [npm registry: @rsbuild/plugin-vue](https://registry.npmjs.org/@rsbuild/plugin-vue), [rspack-vue-loader](https://registry.npmjs.org/rspack-vue-loader)
- Rspack's plugin-compatibility page lists `compression-webpack-plugin` and `fork-ts-checker-webpack-plugin` as compatible, and recommends `ts-checker-rspack-plugin` (latest 1.7.1) — [Rspack plugin compat (search summary)](https://www.rspack.dev/guide/compatibility/plugin); [npm registry: ts-checker-rspack-plugin](https://registry.npmjs.org/ts-checker-rspack-plugin)
- **GitLab case study (large Vue app; webpack 4 baseline, so not like-for-like with our webpack 5):**
  - Cold local builds: webpack 1,671 s, Vite 63.3 s, Rspack 64.6 s. CI production bundling: about 1,838 s → 86.4 s (about 20×).
  - vue-loader@15's `VueLoaderPlugin` crashed on Rspack because it used undocumented internals and was replaced by a custom `matchResource` plugin. Their estimate is that "5–10% of webpack plugins reach into undocumented internals Rspack doesn't replicate".
  - Rspack "reuses our existing `splitChunks`/`cacheGroups`", whereas Vite/Rolldown "fragments into many small chunks regardless of configuration". Vite was about 22–77% (about 0.6–1.5 s) slower to interactive at 10 Mbps.
  - Source: [GitLab "Adopt Rspack" proposal #604382](https://gitlab.com/gitlab-org/gitlab/-/issues/604382)
- **Yelp case study (webpack 5 → Rspack):**
  - About 25% faster full SSR builds from the core migration, about 52% average with follow-up optimisations, and up to 80% faster warm builds with persistent cache.
  - Custom plugins needed updates (some `compilation.entrypoints` values live at different paths).
  - Rsbuild's abstraction was "counterproductive" for their Storybook.
  - Source: [Yelp engineering blog, 2026-05](https://engineeringblog.yelp.com/2026/05/optimizing-our-build-times-by-migrating-from-webpack-to-rspack.html)
- Rsbuild's own benchmark (1,000 modules): Rsbuild 1.36 s dev / 3.35 s prod against webpack 21.40 s / 28.10 s. This is a vendor benchmark — [Rsbuild docs (search summary)](https://rsbuild.rs/guide/start/)
- Rstest, the Rspack-native test runner, is still pre-1.0: 0.12 on 2026-09-14 (latest 0.12.4, 2026-10-19). 0.11 (2026-07-06) was a "transition version toward 1.0" with incompatible changes to test options, mock, pool and shard APIs — [Rstest blog](https://rstest.rs/blog/); [npm registry: @rstest/core](https://registry.npmjs.org/@rstest/core)

### Inferences
- **Config delta for our client build:**
  - `require('webpack')` → `require('@rspack/core')`, which works from a CJS config on Node 24 via `require(esm)`, or rename to `.mjs`.
  - `ts-loader` → `builtin:swc-loader`.
  - `TsconfigPathsPlugin` → `resolve.tsConfig`.
  - `fork-ts-checker` → `ts-checker-rspack-plugin`, or drop it, since `SKIP_TS_CHECK` and `vue-tsc` already gate types in CI.
  - Add `experimentalInlineMatchResource: true` to vue-loader.
  - The `splitChunks` block, `DefinePlugin`, `publicPath`/`DESKTOP_BUILD` and `chunkFilename` carry over unchanged in principle.
  - Rough estimate: **1–3 days** for client and embedded configs, plus verification. That matches Yelp/GitLab reports that the core switch is small and the tail is plugin internals. We have no custom plugins beyond a trivial `compile`/`done` logger.
- **Speed expectation for us is uncertain.** Rspack speeds up module graph, transpile (SWC) and minification (SWC instead of terser). It does *not* speed up JS-side plugins: brotli quality 11 in `CompressionPlugin` and fork-ts-checker's tsc run cost the same. If those dominate `build:client` today, the gain will look like Yelp's 25–50%, not GitLab's 20×. Measure first.
- **mochapack cannot run on Rspack.** It `require`s the `webpack` package and its `lib/` internals, and Rspack ships as `@rspack/core`, not as a `webpack` package with that file tree. So "move to Rspack" ⇒ "replace mochapack" (Rstest, Vitest) or keep webpack 5.111 installed solely for tests, which means two bundlers to maintain.
- **Embedded node-target bundle:** `target: 'node'`, `externals`, `node.__dirname: false` and single-file output map directly. But Rspack's codegen is a different implementation, so the `check-embedded-bundle.mjs` smoke guard must stay (and ideally also *execute* the bundle). The 5.110 class of bug is "bundler miscompiles a CJS-namespace + `new` edge", and that risk is not webpack-specific.
- Choosing between plain `vue-loader` (with `experimentalInlineMatchResource`) and the Rsbuild-maintained `rspack-vue-loader` fork is a maintenance decision. Upstream vue-loader still declares only a webpack peer.

### Gaps
- Direct fetches of rspack.rs `guide/tech/vue` and `guide/compatibility/plugin` returned 404 (site restructure). Their content is cited from search-result summaries and the GitLab report only.
- No confirmation found that `output.hashFunction: 'xxhash64'` is accepted by Rspack 2. It may need removal (Rspack uses its own hashing).
- No public Rspack-vs-webpack-5 benchmark for a *Vue 3 Options-API* app of our size was found. No explanation was found for why `rspack-vue-loader` exists as a fork.

## Q2. Vite 8 (Rolldown) / electron-vite: migration effort and Electron best practice in 2026

### Takeaway
Vite 8 (2026-03-12, latest 8.3.5) runs on Rolldown and is mature, and electron-vite 6.0.0 (2026-10-14) supports Vite 6/7/8 with utilityProcess entry support. The move would cost more than Rspack: chunking must be rewritten from webpack `cacheGroups` to Rolldown `codeSplitting.groups`, magic-comment chunk names are lost, and the output model changes. GitLab measured Vite's production chunking as worse than Rspack's. The main argument *for* Vite is a single transform pipeline shared with Vitest.

### Cited Findings
- **Release.** Vite 8 stable 2026-03-12, with Rolldown as "single, unified, Rust-based bundler" replacing esbuild + Rollup, "up to 10-30x faster builds" than Rollup.
  - Real-world: Linear 46 s → 6 s; Ramp −57%; Mercedes-Benz.io up to −38%; Beehiiv −64%.
  - Requires Node 20.19+/22.12+. Install size about 15 MB larger (lightningcss about 10 MB).
  - Built-in tsconfig `paths` support. Most plugins work unchanged.
  - Source: [Vite 8 announcement](https://vite.dev/blog/announcing-vite8)
- Rolldown 1.0 stable on 2026-05-07 — [VoidZero: Announcing Rolldown 1.0 (search summary)](https://voidzero.dev/posts/announcing-rolldown-1-0). Current versions: `vite` 8.3.5 and `rolldown` 1.2.15 — [npm registry: vite](https://registry.npmjs.org/vite), [rolldown](https://registry.npmjs.org/rolldown)
- **Vite 7 → 8 breaking changes:**
  - The object form of `manualChunks` is removed and the function form is deprecated in favour of Rolldown `codeSplitting`.
  - `build.rollupOptions` → `build.rolldownOptions`; the `esbuild` option → `oxc`.
  - JS minify is Oxc and CSS minify is **Lightning CSS by default**.
  - Default `build.target` is Chrome 111 / Firefox 114 / Safari 16.4.
  - CJS default-import interop changed (`legacy.inconsistentCjsInterop`).
  - Source: [Vite migration guide](https://vite.dev/guide/migration)
- Rolldown `output.codeSplitting.groups` takes `name`, `test`, `priority`, `minSize`/`maxSize` and `minShareCount`. `codeSplitting: false` inlines all dynamic imports into one bundle. Manual splitting can change execution order (`strictExecutionOrder`). The page does **not** document a webpack-style `chunks: 'async'|'initial'|'all'` restriction per group — [Rolldown codeSplitting reference](https://rolldown.rs/reference/OutputOptions.codeSplitting). `advancedChunks` is itself deprecated in favour of `codeSplitting` — [Rolldown advancedChunks (search summary)](https://rolldown.rs/reference/OutputOptions.advancedChunks)
- GitLab rejected Vite/Rolldown for production: it "fragments into many small chunks regardless of configuration" and was about 22–77% slower to interactive than Rspack — [GitLab #604382](https://gitlab.com/gitlab-org/gitlab/-/issues/604382)
- electron-vite 6.0.0 was published 2026-10-14 with peers `vite "^6.0.0 || ^7.0.0 || ^8.0.0"` and `@swc/core ^1`. Release notes: "Vite 8 support" with Rolldown (`rollupOptions` and `rolldownOptions` both accepted), and improved bytecode compilation — [npm registry: electron-vite](https://registry.npmjs.org/electron-vite); [electron-vite releases](https://github.com/alex8088/electron-vite/releases)
- electron-vite features: main/preload/renderer in one config, HMR for renderer and hot reload for main/preload, "Worker Threads, Child Process, and Utility Process through import suffixes", and V8-bytecode source protection — [electron-vite.org](https://electron-vite.org/)
- Electron Forge 8.0.0/8.0.1 (2026-09-29): ESM-only, Node ≥ 22.17, **Vite plugin promoted to stable, targeting Vite 8**. Main and preload emit as `.cjs`, and the webpack plugin needs webpack-dev-server 5 — [Forge releases](https://github.com/electron/forge/releases); dates from [npm registry: @electron-forge/cli](https://registry.npmjs.org/@electron-forge/cli)

### Inferences
- **Migration effort for our app (estimate):**
  - Renderer: a `vite.config.ts` with `@vitejs/plugin-vue` (latest 6.0.10), `resolve.alias` (`@/`, `vue` → esm-bundler if runtime template compilation is truly needed), `define` for `__VUE_OPTIONS_API__` and the 3 `process.env.NODE_ENV` uses, `base: DESKTOP_BUILD ? 'app://bundle/' : '/'`, and `build.rolldownOptions.output.codeSplitting.groups` re-expressing `vendors`/`chartjs`/`markdownit`.
  - Lazy-chunk names: the `webpackChunkName` comments are ignored, and the "async-only, never hoisted into initial vendors" rule (the BND-1 perf fix) has no documented one-line equivalent. It needs re-verification with a bundle analyser.
  - The `sw` entry must become a second input or a separate build. Compression moves to a plugin or post-step.
  - The embedded server becomes an SSR/lib build (`ssr.noExternal`, `codeSplitting: false`) or a standalone Rolldown `platform: 'node'` build.
  - The game server currently serves `build/` assets, and the dev loop is `webpack --watch` + `tsx watch`. A Vite dev server with HMR changes that model. The fallback is `vite build --watch`.
  - Realistic size: **1–2 weeks** including chunk-parity verification and Electron `app://` testing. That is several times the Rspack estimate.
- **What Vite buys us that Rspack doesn't:** one transform pipeline for build and Vitest (no "test bundle differs from prod bundle" class of bug), the mainstream Vue ecosystem default, and electron-vite / Forge-Vite integration. **What it costs:** chunking semantics drift (GitLab's finding), loss of magic-comment chunk names, and a dev-model change.
- For Electron specifically, our main process is plain `tsc` CJS and needs no bundler, and packaging is builder `--dir` plus Velopack. So electron-vite would add value mainly for the embedded server (utilityProcess import suffix) and dev HMR. It is not required.

### Gaps
- The full electron-vite 6 docs on `?modulePath` utilityProcess handling and Vite-8-specific caveats were not fetched.
- No source confirms whether Rolldown `codeSplitting` can scope a group to async-only chunks the way our `chartjs`/`markdownit` groups need.

## Q3. Client test runner: replacing mochapack (Vitest, Rstest, plain mocha + SFC loader)

### Takeaway
Vitest 5.0.x (5.0.0 on 2026-09-03, latest 5.0.5) is the realistic replacement. It has Chai-style `expect` built in, so our `expect(x).to.equal(y)` specs run with few changes. Mocha-specific edits are small: 34 files use `before`/`after` and 5 use `this.timeout`/`skip`. The real work is reproducing our deliberate "constructors-only JSDOM" environment and adapting `scripts/run-tests.mjs`'s count floor. Rstest (0.12.x) is pre-1.0. Plain mocha + a Vue SFC loader has no maintained Vue 3 option.

### Cited Findings
- **Versions.** Vitest 4.0 (2025-10-22) made Browser Mode stable, added visual regression (`toMatchScreenshot`) and Playwright traces, and split providers into `@vitest/browser-playwright` etc. — [VoidZero: Announcing Vitest 4](https://voidzero.dev/posts/announcing-vitest-4); [InfoQ](https://www.infoq.com/news/2025/12/vitest-4-browser-mode)
- **Vitest 5.0 (2026-09-03):**
  - Performance gains "from 8% (micro-utils) to 53% (deps-heavy app)", from a shared Vite server for inline projects, an on-disk transformed-module cache and faster vm pools.
  - Requires Vite ≥ 6.4.0 and Node ≥ 22.12. Unawaited async assertions now fail. `clearMocks` defaults to `true`.
  - Source: [Vitest 5 announcement](https://vitest.dev/blog/vitest-5)
- Vitest 5.0.5 is latest (2026-10-15), with engines `node "^22.12.0 || ^24.0.0 || >=26.0.0"` — [npm registry: vitest](https://registry.npmjs.org/vitest)
- "Vitest provides `chai` assertions by default and also `Jest` compatible assertions built on top of `chai`". Chains such as `.to.equal()`, `.to.be.true`, `.to.deep.equal()` and `.to.have.length()` are supported. `assert` is available as `expect.assert` — [Vitest expect API](https://vitest.dev/api/expect)
- The official Mocha migration guide maps `before` → `beforeAll` and `after` → `afterAll`, and sinon → `vi.fn`/`vi.spyOn`/`vi.useFakeTimers`. It does **not** cover `this.timeout`/`this.skip`, `done` callbacks, `--require`/.mocharc, chai plugins or codemods (doc header shows v5.1.0-beta.1) — [Vitest: Migrating from Mocha](https://main.vitest.dev/guide/migration/mocha)
- By default Vitest isolates every test file (default `pool: 'forks'`). `isolate: false` lets files in one worker share module state ("tests must not depend on a clean `window` or module state"). `vitest doctor` checks compatibility. Sharding splits by file — [Vitest: Improving performance](https://vitest.dev/guide/improving-performance)
- Rstest: Jest-compatible assertions, jsdom/happy-dom environments, "React and Vue" workflows, Playwright-powered browser mode, file-level isolation, and module-graph-aware watch. VM mode (0.12+) reuses processes for large suites — [Rstest features](https://rstest.rs/guide/start/features). It is still 0.12.x with breaking 0.11 changes — [Rstest blog](https://rstest.rs/blog/)
- Plain-Node SFC loading exists only as small community loaders. `vue-esm-loader` uses Node loader hooks (`--experimental-loader`), and its description references `vue-template-compiler`, which is Vue 2. `vuegister` is a require hook — [vue-esm-loader](https://github.com/sebamarynissen/vue-esm-loader); [search summary](https://www.npmjs.com/package/vuegister)
- A third-party claim of about a 42% CI reduction migrating 1.2M LOC Mocha 10 → Vitest 2 comes from a low-quality aggregator page and is not verifiable — [hashnode tag page](https://hashnode.com/tag/stepbystep)
- Current versions: `@vue/test-utils` 2.5.1, `happy-dom` 21.0.4 — [npm registry: @vue/test-utils](https://registry.npmjs.org/@vue/test-utils), [happy-dom](https://registry.npmjs.org/happy-dom)

### Inferences
- **Minimal-change Vitest setup for our 574 client specs:**
  - `vitest.config.ts` with `plugins: [vue()]`, `resolve.alias` for `@/`, `test.globals: true` (gives `describe`/`it`/`beforeEach`/`afterEach`), and `test.include: ['tests/client/**/*.spec.ts']`.
  - `environment: 'node'` plus our existing `setup.ts` as a `setupFiles` entry, so the **exact** current global surface is reproduced: JSDOM constructors only, no rAF or matchMedia. Using `environment: 'jsdom'` would expose more window globals and silently move specs onto non-degraded paths, which is exactly what `setup.ts`'s comment warns about.
  - Keep `import {expect} from 'chai'` as is (chai 6 works as a plain library), or later switch to Vitest's built-in expect.
  - Add shims `globalThis.before = beforeAll; globalThis.after = afterAll` in setup, or run a tiny codemod over 34 files. Hand-fix 5 `this.timeout/skip` files.
  - Port `bundleSetup.ts` (`enableAutoUnmount(afterEach)`) to a setup file.
  - Drop the single-chunk/eager-import webpack hack entirely: Vitest resolves `import()` natively.
- Per-file isolation (the default) structurally removes the cross-spec leakage `bundleSetup.ts` was written to fight (432 failures in a shared process). It costs per-file environment startup × 574 files. Measure `pool: 'threads'` with `isolate: true` against `isolate: false`.
- `scripts/run-tests.mjs` enforces a minimum-collected-tests floor by parsing runner output. It must learn Vitest's reporter format (or use `--reporter=json`), or the floor guard silently breaks. That would be the very failure the wrapper exists to prevent.
- Replacing mochapack **removes the webpack ceiling** whichever bundler is chosen afterwards, so this is the highest-leverage first step. Rough estimate: **2–4 days** to green, plus a day of flake triage from the changed isolation model.
- Rstest is attractive only if Rspack is chosen and single-pipeline matters more than maturity. It is pre-1.0, its API churned in 0.11, and its assertions are Jest-style (Chai-chain support is not documented).

### Gaps
- No public, credible mochapack-vs-Vitest (or Mocha-vs-Vitest) benchmark for a VTU suite of about 7.5k tests was found. Speed is unknown until measured.
- The bundled Chai major in Vitest 5 and the support status for `chai.use(chaiAsPromised)` inside Vitest were not confirmed from docs.
- No maintained Vue-3 SFC loader for plain Node/mocha (e.g. built on `module.registerHooks` + `@vue/compiler-sfc`) was found.

## Q4. Server tests (about 17.5k tests): keep mocha + tsx, or move to Vitest / node:test?

### Takeaway
Keep mocha 11 + tsx. Node's native type stripping cannot run our server code, because of enums, parameter properties, namespaces, extensionless imports and `@/` paths, so `node:test` would still need tsx. Vitest's per-file isolation over 1,846 spec files is likely a cost, not a gain, for a suite that already runs in about 2 minutes.

### Cited Findings
- Node 24 type stripping is "Stability: 2 - Stable" since v24.12.0.
  - Without `--experimental-transform-types`, enums, namespaces with runtime code, parameter properties, import aliases and decorators error.
  - **File extensions are mandatory** (`import './file'` fails).
  - Node **ignores tsconfig.json** (no `paths`).
  - Source: [Node 24 docs: TypeScript](https://nodejs.org/docs/latest-v24.x/api/typescript.html); [Node v24.12.0 release](https://nodejs.org/blog/release/v24.12.0)
- The repo has 27 `export enum`, 39 parameter-property constructors, 8 namespaces, extensionless relative imports and `@/` imports in 22 server/common files — rg over `src/`
- Vitest isolates per test file by default. `isolate: false` trades safety for speed — [Vitest: Improving performance](https://vitest.dev/guide/improving-performance)

### Inferences
- `node --test` with native stripping would require `--experimental-transform-types` (still experimental), adding `.ts` extensions across about 1,800+ files, and replacing `@/` paths. That is a large churn for no clear gain over tsx.
- Vitest on the server suite would bring `vi` mocks, watch and a unified reporter, but the many-small-files layout (1,846 files) is the worst case for per-file isolation overhead. Any speed win would have to come from parallelism. Mocha's own parallel mode is a cheaper experiment (not researched here).
- If the client moves to Vitest, running the server suite under Vitest too is a *consistency* decision, not a performance one. Defer it.

### Gaps
- No measured comparison of mocha+tsx against Vitest (threads, `isolate: false`) on a 15–20k-test Node TS suite was found.

## Q5. Lint: Oxlint (type-aware, Vue coverage, alongside ESLint) and Biome 2.x

### Takeaway
Oxlint 1.89.0 can replace ESLint for `.ts` files and Vue `<script>` blocks, run alongside ESLint via `eslint-plugin-oxlint`. Vue templates still need ESLint + eslint-plugin-vue, because Oxlint has no Vue template parsing and no timeline for it. Its type-aware mode (stable July 2026) requires TS 7 and is irrelevant to our non-type-aware config. Biome 2.6 lists Vue as experimental and does not support Less, so it is not a fit.

### Cited Findings
- Oxlint JS plugins reached alpha with an ESLint-compatible plugin API.
  - Claim: "we expect 80% of ESLint users can now switch". There are 650+ native rules.
  - Conformance: ESLint core 33,006 tests at 100%; ESLint Stylistic 18,310 tests at 99.99%.
  - Benchmark on the Node.js repo: ESLint 1 min 43 s against Oxlint 21 s (4.8×), and "up to 100x" for plugin-heavy setups.
  - "Limited support for front-end frameworks' custom file formats (e.g. Svelte, Vue, Angular) - coming later this year". Migration via `npx @oxlint/migrate eslint.config.js`.
  - Source: [Oxlint JS plugins alpha (2026-03-11)](https://oxc.rs/blog/2026-03-11-oxlint-js-plugins-alpha)
- Type-aware linting went stable on 2026-07-22. tsgolint v7 covers 59 of 61 typescript-eslint type-aware rules and **requires TypeScript v7** (tracks 7.0.2). On vuejs/core it ran 0.95 s against 12.3 s for ESLint + typescript-eslint (13×) — [Oxc blog: type-aware linting stable](https://oxc.rs/blog/2026-07-22-type-aware-linting-stable). Other reports say 12–18× across repos — [InfoQ (search summary)](https://infoq.com/news/2026/09/tsgolint-oxlint-typescript)
- Vue status:
  - eslint-plugin-vue full compatibility is not feasible because it relies on its own compiler and a modified AST. The plan is an Oxc Vue parser that attaches template JS to the script AST.
  - Proofs of concept (vue-oxc-parser, vue-compiler-rs) exist. "No firm release timeline", with community pings in October 2026.
  - Source: [oxc#15761 "better vue support"](https://github.com/oxc-project/oxc/issues/15761)
  - The prevailing setup (also generated by create-vue) is "oxlint for JS/TS, ESLint only for Vue templates" — [secondary: khinse-labs issue](https://github.com/khinse-labs/standards/issues/13); [example PR](https://github.com/dash14/v-network-graph/pull/180). The community `oxlint-vue` reaches into templates with only about 20 structural rules — [oxlint-vue](https://github.com/vad1ym/oxlint-vue)
- `eslint-plugin-oxlint` turns off ESLint rules that oxlint covers. Recommended script: `"lint": "oxlint && eslint"`, using `oxlint.configs['flat/recommended']` or `buildFromConfigFile('./.oxlintrc.json')` — [eslint-plugin-oxlint](https://github.com/oxc-project/eslint-plugin-oxlint). GitLab has a draft MR introducing an "oxlint dual-run alongside ESLint" — [GitLab MR !229727](https://gitlab.com/gitlab-org/gitlab/-/merge_requests/229727)
- Versions: `oxlint` 1.89.0 (2026-10-19), `eslint-plugin-oxlint` 1.89.0, `eslint-plugin-vue` 10.11.1, `typescript-eslint` 8.72.0 — [npm registry: oxlint](https://registry.npmjs.org/oxlint)
- Biome 2.6.2 (2026-10-21). Vue parsing, formatting and linting are all 🟡 experimental (since 2.3, needs `html.experimentalFullSupportEnabled`). CSS and SCSS are fully supported and **Less is not listed** — [Biome language support](https://biomejs.dev/internals/language-support). Known Vue false positives exist (e.g. `noUnusedVariables` for template-only usage) — [alternativeto summary](https://alternativeto.net/news/2025/10/biome-2-3-brings-vue-svelte-and-astro-file-support)

### Inferences
- Our config is **mostly core + stylistic rules** (eslint-config-google style) plus 2 typescript-eslint and 2 vue rules. With JS plugins, `@stylistic/eslint-plugin` could run inside Oxlint (99.99% conformance), but JS plugins are alpha.
- **Pragmatic split:**
  - `oxlint` handles `src/**/*.ts`, `tests/**/*.ts` and `.vue` script blocks for the correctness rules.
  - ESLint (with `eslint-plugin-oxlint` disabling the overlap) stays for `.vue` templates (`vue/*` rules), stylistic rules and the custom `no-restricted-syntax` card rule. Oxlint JS plugins may handle that selector, unverified.
- `lint:server` already uses `eslint --cache`, and the heavier lint step is probably `lint:client` (vue-tsc), which Oxlint doesn't replace. So the wall-clock win from Oxlint may be modest until measured.
- Oxlint type-aware is not needed now (our config has no type-aware rules). It would also require the tsconfig to be TS-7-valid (Q6).

### Gaps
- No source confirms whether the eslint-config-google style rules our config uses (`indent`, `operator-linebreak`, `space-before-function-paren`, …) are implemented natively in Oxlint. Its native set focuses on correctness, and formatting is delegated to oxfmt or `@stylistic` via JS plugins.

## Q6. TypeScript 7 (tsgo): status in late Oct 2026, API (7.1), vue-tsc/Volar, typescript-eslint, speedups, interim setup

### Takeaway
TS 7.0 shipped 2026-07-08 (npm `latest` = 7.0.2), with no API and 8–12× faster full builds. The 7.1 beta with the new API landed 2026-10-20; RC is about a month later and final shortly after. typescript-eslint (8.72.0) still caps the peer at `<6.1.0`, and vue-tsc 3.3.13 does not run on TS 7. Our tsconfig uses `moduleResolution: "node"`, which is a **hard error in TS 7**, so the first TS-7 step is a tsconfig migration.

### Cited Findings
- **TS 7.0 (2026-07-08).** "8x-12x on full builds": VS Code 125.7 s → 10.6 s (11.9×), Sentry 139.8 s → 15.7 s (8.9×), memory −6 to −26%.
  - "TypeScript 7.0 does not ship with an API. We expect TypeScript 7.1 to ship with a new (and different) API."
  - Vue/Svelte/Angular templates, typescript-eslint and webpack loaders/ts-loader need TS 6 for now.
  - Recommended: TS 7 for CLI `tsc` plus TS 6 for editors/tools, via the aliases `"@typescript/native": "npm:typescript@^7.0.2"` and `"typescript": "npm:@typescript/typescript6@^6.0.2"`. That gives `tsc` (v7) and `tsc6` (v6).
  - **Hard errors:** `target: es5`, `downlevelIteration`, `moduleResolution: node/node10` ("use `nodenext` or `bundler`"), `module: amd/umd/systemjs/none`, `baseUrl`, `moduleResolution: classic`, `esModuleInterop`/`allowSyntheticDefaultImports` set to `false`, `alwaysStrict: false`.
  - Source: [TypeScript 7.0 announcement](https://devblogs.microsoft.com/typescript/?p=5246)
- Slack reported CI type-checking going from about 7.5 min to 1.25 min on TS 7 — [InfoQ (search summary)](https://infoq.com/news/2026/08/typescript-7-released/)
- **TS 7.1 Beta (2026-10-20).**
  - A modular API: `typescript/sync`, `typescript/async`, `typescript/fs`, `typescript/ast`, `typescript/ast/is`, `typescript/ast/factory`. It is snapshot-based with `Disposable` objects.
  - "Content mappers have been prototyped or implemented for Vue, Svelte, Astro, Ember".
  - 1.2–1.9× faster than 7.0 and −15.8% to −49.6% memory (mui-docs noEmit 22.2 s → 11.9 s).
  - "Release Candidate in about a month from now, followed by a final release shortly thereafter".
  - Source: [Announcing TypeScript 7.1 Beta](https://devblogs.microsoft.com/typescript/announcing-typescript-7-1-beta/)
- npm dist-tags: `latest` 7.0.2, `beta` 7.1.0-beta, `next` 7.1.0-dev.20261021.1, `rc` 7.0.1-rc. `@typescript/typescript6` is 6.0.2 — [npm registry: typescript](https://registry.npmjs.org/typescript)
- `@typescript-eslint/parser` 8.72.0 has peer `typescript ">=4.8.4 <6.1.0"` — [npm registry](https://registry.npmjs.org/@typescript-eslint/parser). Issue #12518: npm ci fails with ERESOLVE, and when forced it crashes on `ts.Extension.Cjs`. Closed "not planned"; maintainer: "there is no TS 7 API at this time"; duplicate of #10940 — [typescript-eslint#12518](https://github.com/typescript-eslint/typescript-eslint/issues/12518)
- vue-tsc fails on TS 7.0.2 with "Package subpath './lib/tsc' is not defined by exports". It is tracked as a duplicate of language-tools#5381, with no timeline in the thread — [vuejs/language-tools discussion #6121](https://github.com/vuejs/language-tools/discussions/6121). vue-tsc latest is 3.3.13 (2026-10-10) with peer `typescript >=5.0.0` — [npm registry: vue-tsc](https://registry.npmjs.org/vue-tsc)
- Community `vue-tsgo` (0.3.0, modified 2026-07-31) transforms SFCs into a temporary TS workspace and runs `tsgo --lsp` — [vue-tsgo README](https://cdn.jsdelivr.net/npm/vue-tsgo@0.3.0/README.md); [npm registry: vue-tsgo](https://registry.npmjs.org/vue-tsgo)

### Inferences
- **Repo-specific blockers to running `tsc` 7 even side-by-side:**
  - `moduleResolution: "node"`, currently kept alive by `ignoreDeprecations: "6.0"`, must become `bundler` (client) and `bundler` or `nodenext` (server/tests).
  - `module: "commonjs"` stays legal, but verify that the chosen resolution pairs with it (gap below).
  - `ts-loader` and `fork-ts-checker` use the TS JS API and stay on TS 6 until they adopt 7.1, which is another reason to move transpilation to SWC (Rspack) or Oxc (Vite).
- **Where TS 7 pays off for us now:** `build:server` (`tsc --build` + `tsc-alias`), `build:test` (`tsc -p tests/tsconfig.json --noEmit`, a **mandatory gate** per CLAUDE.md) and `electron:build:main`. `lint:client` (vue-tsc) cannot use it until Volar ships on the 7.1 API. vue-tsgo is a community stopgap and should not be used as the gate.
- **Interim setup (after the tsconfig fix):** the Microsoft alias pair. `require('typescript')` then still resolves to TS 6 for typescript-eslint, vue-tsc, ts-loader and fork-ts-checker, while the `tsc` binary is 7. Scripts that must stay on 6 call `tsc6`.
  - Caveat: `typescript`'s npm `latest` is now 7.x, so the existing `^6.0.3` range is what keeps the repo on 6. Do not loosen it.
- **Timeline guess:** TS 7.1 final ≈ December 2026. typescript-eslint and Volar adoption follow on their own schedules, so a full TS-7-only toolchain is realistically a 2027 item.

### Gaps
- Not verified whether TS 6/7 accept `moduleResolution: "bundler"` together with `module: "commonjs"` (TS 5.x rejected that combination). This decides whether the server can keep CJS emit with `bundler` resolution or must move to `nodenext`.
- No published date or version for vue-tsc/Volar or typescript-eslint support on the TS 7.1 API.

## Q7. CSS: Less in 2026 vs native nesting + Lightning CSS/PostCSS

### Takeaway
Keep Less. It is actively maintained (4.9.1, 2026-09-02) and works in every candidate bundler. Our 112k-line codebase depends on Less features native CSS can't express:
- about 9.4k `&__`/`&--` suffix selectors (native nesting cannot concatenate)
- about 3.3k `fade()` calls
- about 390 parametric-mixin call sites (native `@mixin` is not shipped by default)
- 21 `each()` loops

Migration is a large codemod with no performance or product payoff.

### Cited Findings
- `less` latest is 4.9.1 (2026-09-02) — [npm registry: less](https://registry.npmjs.org/less). A 2026 article notes Less "still handles parametric mixins, guard expressions, and compile-time math operations that native CSS has no counterpart for" — [search summary, drweb.de](https://www.drweb.de/css-preprocessor-tools-im-vergleich/)
- Native CSS nesting does **not** support Sass/Less-style concatenation (`&__element`, `&--mod`). Selectors are object references, so `&__foo` must be rewritten as full class names (`.block__foo`) — [MDN: Using CSS nesting](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Nesting/Using_CSS_nesting); [alwaystwisted: UnSassing my CSS nesting](https://www.alwaystwisted.com/articles/UnSassing-my-CSS-nesting). A CSSWG proposal for "Selector Suffixing for Native CSS Nesting" (#13205) was filed in December 2025 and is only a proposal — [public-css-archive](https://lists.w3.org/Archives/Public/public-css-archive/2025Dec/0201.html)
- **Native mixins: sources conflict.**
  - One aggregator lists CSS Mixins (`@mixin --name {}` / `@apply --name`) as "Chrome 146 (expected)" — [modern-css.com 2026](https://modern-css.com/whats-new/?year=2026).
  - Another says no browser supports them by default and Chromium's implementation sits behind a `CSSMixins` flag being adjusted to CSSWG resolutions — [OpenReplay: native CSS mixins](https://blog.openreplay.com/native-css-mixins/); [chromestatus 5753701012602880](https://www.chromestatus.com/feature/5753701012602880); [Blink intent to prototype](https://groups.google.com/a/chromium.org/g/blink-dev/c/g0dSC7CvdlA/m/Wz30GgIZAwAJ).
- Electron 45.0.0 was published 2026-10-21 — [npm registry: electron](https://registry.npmjs.org/electron). Its alpha.4 notes list Chromium 155.0.8038.2 and Node v24.20.0 — [newreleases.io: electron 45.0.0-alpha.4](https://newreleases.io/project/npm/electron/release/45.0.0-alpha.4)
- Lightning CSS (latest 1.33.0) cannot parse preprocessor syntax, so Less must be compiled first — [secondary: knowledgelib migration guide](https://knowledgelib.io/software/migrations/sass-to-tailwind/2026); [npm registry: lightningcss](https://registry.npmjs.org/lightningcss). Vite 8 uses Lightning CSS for CSS **minification** by default — [Vite migration guide](https://vite.dev/guide/migration)
- Rsbuild has `@rsbuild/plugin-less` 2.0.1 — [npm registry](https://registry.npmjs.org/@rsbuild/plugin-less). Rspack accepts webpack loaders such as less-loader — [Rspack migration guide](https://v2.rspack.rs/guide/migration/webpack)

### Inferences
- **Cost of leaving Less (estimate):**
  - About 9.4k suffix selectors to expand. This is mechanical, but the diff touches nearly every rule and bloats selectors.
  - About 3.3k `fade(@c, N%)` calls to turn into `color-mix(in srgb, <c> N%, transparent)` or relative-colour `rgb(from <c> r g b / N%)`, which needs Less colour *variables* to become custom properties first.
  - About 390 mixin calls to inline or turn into utility classes, and 21 `each()` loops to unroll.
  - Effectively a multi-week rewrite of the whole visual layer of a UI-heavy fork, for zero runtime benefit (output CSS is the same) and a likely build-time win of seconds at most.
- **Cheaper improvements that keep Less:**
  - Measure `make:css` time.
  - Optionally run Lightning CSS (or the bundler's CSS minifier) *after* `lessc` to minify and target-lower `build/styles.css`.
  - New files may use native nesting with full class names and `color-mix()` where convenient, since Less passes native nesting syntax through. The 10 SFC `lang="less"` blocks are a non-issue for Rspack (less-loader) and Vite (built-in Less support).

### Gaps
- Not verified whether Chromium 155 (Electron 45) ships CSS `@mixin`/`@apply` by default; the sources conflict. Even if it does, our parametric mixins with guards and loops would not map 1:1.
- No maintained automated Less → native-CSS converter that handles `&` suffix expansion and colour functions was found.

## Q8. Electron packaging: electron-builder 26 vs Electron Forge 8 vs electron-vite, with Velopack

### Takeaway
Keep electron-builder `--dir` + Velopack. electron-builder 26 is maintained (v27 ESM in alpha). Forge 8's main draw is its now-stable Vite plugin, and electron-vite is a build tool, not a packager. Neither gives a packaging benefit for an app whose installers and updates are already owned by Velopack.

### Cited Findings
- `electron-builder` dist-tags: `latest` 26.15.3, `v26` 26.18.0, `next` 27.0.0-alpha.11 — [npm registry: electron-builder](https://registry.npmjs.org/electron-builder). v27 "migrates electron-builder to native ES modules", and builder remains "the most-downloaded alternative" while Forge is the official tool — [OpenReplay: Packaging and Distributing Electron Apps](https://blog.openreplay.com/packaging-distributing-electron-apps/)
- Forge 8.0.0/8.0.1 (2026-09-29): ESM-only, Node ≥ 22.17, config templating removed, `publish` renamed `release`, Vite plugin stable on Vite 8 with `hotRestart`, main/preload emitted as `.cjs` — [Forge releases](https://github.com/electron/forge/releases); [npm registry: @electron-forge/cli](https://registry.npmjs.org/@electron-forge/cli)
- electron-vite 6.0.0 (2026-10-14) supports Vite 6/7/8, utilityProcess via import suffixes, and V8 bytecode protection — [npm registry: electron-vite](https://registry.npmjs.org/electron-vite); [electron-vite.org](https://electron-vite.org/)
- Velopack's JS guide shows packing from an Electron Forge `package` output directory with `vpk pack -u <id> -v <ver> -p <dir> -e <exe>`. The Electron-specific page returned 404 — [Velopack JS getting started (search summary)](https://docs.velopack.io/getting-started/javascript)

### Inferences
- Our builder usage (`--dir`, `electronDist` reuse to dodge the Windows EPERM, `npmRebuild: false`, explicit `files` allowlist) is small and already tuned. Forge `package` or `@electron/packager` could produce an equivalent directory for `vpk pack`, but switching would spend effort to reach parity.
- If the renderer ever moves to Vite, **electron-vite** composes cleanly with the existing builder + Velopack pipeline because it only builds. Forge's Vite plugin would pull packaging into Forge as well.
- Watch electron-builder 27 (ESM). Upgrading inside 26.x (26.18.0 is tagged `v26`) is low risk.

### Gaps
- The Velopack Electron page (404) was not read. No source compares builder vs Forge specifically as front-ends to Velopack.

## Q9. Node 24 runtime features worth adopting (server side; Electron 45 ships Node 24.20)

### Takeaway
The useful items:
- `require(esm)` is no longer experimental since 24.15. It lets CJS configs load ESM-only Rspack 2 or Forge 8.
- `node:sqlite` has been a Release Candidate since 24.15. It is a credible future replacement for the optional native `better-sqlite3`, but it is not yet stable.

Native type stripping is stable since 24.12 but does not fit our codebase, so tsx stays.

### Cited Findings
- Type stripping is stable since v24.12.0, but enums, parameter properties, namespaces with values, import aliases, extensionless imports and tsconfig `paths` are unsupported without flags or tooling — [Node 24 docs: TypeScript](https://nodejs.org/docs/latest-v24.x/api/typescript.html); [Node v24.12.0](https://nodejs.org/blog/release/v24.12.0)
- `require(esm)`: "v24.15.0 – This feature is no longer experimental". It was unflagged in v22.12/v20.19 — [Node 24 docs: modules](https://nodejs.org/docs/latest-v24.x/api/modules.html)
- `node:sqlite`: "Stability: 1.2 - Release candidate" as of v24.15.0 (unflagged since v22.13/v23.4). It provides `DatabaseSync`, `prepare()`, transactions, and WAL via `PRAGMA journal_mode = WAL` — [Node 24 docs: sqlite](https://nodejs.org/docs/latest-v24.x/api/sqlite.html)
- `node --run`: the fetched v24 CLI page was summarised as "Stability: 1 - Experimental, Added in v22.12.0, v20.12.0". I believe `--run` was marked stable in 22.x, so treat this as uncertain — [Node 24 docs: CLI](https://nodejs.org/docs/latest-v24.x/api/cli.html)
- Electron 45 alpha notes list Node v24.20.0 — [newreleases.io](https://newreleases.io/project/npm/electron/release/45.0.0-alpha.4). The current Node 24 docs are for v24.22.1 — [Node 24 docs: fs](https://nodejs.org/docs/latest-v24.x/api/fs.html)
- Our server loads `better-sqlite3` via `import BetterSqlite3 = require('better-sqlite3')` and a lazy `require`. It is an optionalDependency kept out of the Electron thin client (`npmRebuild: false`) — [src/server/database/SQLite.ts](C:/Projects/Mods/terraforming-mars/src/server/database/SQLite.ts); [electron-builder.yml](C:/Projects/Mods/terraforming-mars/electron-builder.yml)

### Inferences
- `node:sqlite` would remove a native-addon ABI/rebuild concern and an optional dependency. It also becomes usable inside the Electron utilityProcess, which has Node 24.20 built in, if the embedded server ever wants SQLite instead of `LOCAL_FS_DB`. Wait for "Stable" or adopt behind the existing backend abstraction with a fallback.
- `require(esm)` matters directly to the toolchain plan: `webpack.config.js`-style CJS configs can `require('@rspack/core')` (pure ESM in 2.x) on Node ≥ 24.15. Our engines floor is `>=24.20.0`.
- Keep `tsx` for `dev:server`, `make:*` scripts and mocha. Native stripping would need enum/param-property/namespace rewrites plus `.ts` extensions everywhere.

### Gaps
- `fs.glob` stability in Node 24 could not be confirmed (the docs fetch was truncated). The `node --run` stability conflicts with my prior knowledge and is unverified.

## Q10. Recommended path for this repo (synthesis)

### Takeaway
Sequence the work by what unblocks the most:
1. Replace mochapack with Vitest 5. This removes the webpack ceiling.
2. Move bundling to Rspack 2: nearly identical config, preserved chunk semantics, and transpilation decoupled from the TS API.
3. Optionally add Oxlint in front of ESLint.
4. Prepare the tsconfig for TS 7 now and adopt `tsc` 7 for server/test type-checking side-by-side, leaving vue-tsc and typescript-eslint on TS 6 until 7.1 support lands.

Keep Less, mocha + tsx for server tests, and electron-builder `--dir` + Velopack.

### Cited Findings
- mochapack is the only webpack-internals consumer, and its last release is 2.1.5 — [webpack.test.config.js](C:/Projects/Mods/terraforming-mars/webpack.test.config.js); [npm registry: mochapack](https://registry.npmjs.org/mochapack)
- Rspack keeps existing `splitChunks`/`cacheGroups`. Vite/Rolldown fragmented chunks in GitLab's tests — [GitLab #604382](https://gitlab.com/gitlab-org/gitlab/-/issues/604382)
- Vitest has chai-style `expect` built in, and Vitest 5 is the current major (5.0.5) — [Vitest expect](https://vitest.dev/api/expect); [npm registry: vitest](https://registry.npmjs.org/vitest)
- TS 7.1 (the API) is in beta with RC about 1 month out. typescript-eslint is capped `<6.1.0`, and vue-tsc doesn't run on TS 7 — [TS 7.1 beta](https://devblogs.microsoft.com/typescript/announcing-typescript-7-1-beta/); [typescript-eslint#12518](https://github.com/typescript-eslint/typescript-eslint/issues/12518); [language-tools#6121](https://github.com/vuejs/language-tools/discussions/6121)
- Oxlint has no Vue template support, and the standard practice is a dual run with ESLint for templates — [oxc#15761](https://github.com/oxc-project/oxc/issues/15761); [eslint-plugin-oxlint](https://github.com/oxc-project/eslint-plugin-oxlint)

### Inferences
**Phased plan (effort figures are my estimates, not sourced):**

| Phase | Change | Why first / value | Effort | Main risk |
|---|---|---|---|---|
| 0 | Measure baselines: `build:client` with and without `SKIP_TS_CHECK` and without brotli-11, `build:embedded`, `test:client`, `test:server`, `lint:server`, `lint:client`, `make:css` | Every published speedup is from other projects. The real bottleneck may be fork-ts-checker, brotli-11 or vue-tsc, not bundling | 0.5 day | none |
| 1 | **mochapack → Vitest 5** (`environment:'node'` + existing JSDOM `setup.ts`, `globals:true`, `@vitejs/plugin-vue`, `@/` alias, before/after shim or codemod over 34 files, 5 `this.timeout` fixes, auto-unmount setup, **port `run-tests.mjs` floor to Vitest's reporter**) | Removes the webpack 5.111 ceiling and the single-chunk/eager-import hack, and gives per-file isolation | 2–4 days + flake triage | Isolation-model differences surfacing order-dependent specs; reproducing the constructors-only JSDOM env exactly |
| 2 | **webpack → Rspack 2** for client + embedded (`builtin:swc-loader`, `resolve.tsConfig`, `ts-checker-rspack-plugin` or none, vue-loader `experimentalInlineMatchResource`; keep splitChunks, compression, DefinePlugin; keep and strengthen `check-embedded-bundle.mjs` to *execute* the bundle) | Smallest config delta; preserves BND-1 chunk semantics; transpilation no longer tied to the TS 6 API; ends the exact-pin anxiety | 1–3 days + bundle-diff verification | `xxhash64` option and chunk naming parity; a different codegen means a new miscompile class, so the guard must stay |
| 2-alt | webpack → Vite 8 (+ electron-vite 6 optional) | One pipeline with Vitest; ecosystem default | 1–2 weeks | Rolldown chunking drift (GitLab), lost magic-comment chunk names, `sw` entry, dev-model change |
| 3 | `oxlint && eslint` with `eslint-plugin-oxlint` (Oxlint for TS/script correctness; ESLint keeps vue/* template rules, stylistic, card-file selector) | Cheap, reversible; faster lint if ESLint TS linting is a measurable chunk | 0.5–1 day | Rule-parity gaps for google-style formatting rules |
| 4 | TS 7 prep: tsconfig `moduleResolution` off `node` (drop `ignoreDeprecations: "6.0"`); then MS alias pair (`typescript` → typescript6, `@typescript/native` → 7) and run `build:server` / `build:test` / `electron:build:main` on `tsc` 7 | 8–12× faster type-check gates today; prerequisite for the eventual full move | 1–2 days (tsconfig fallout) | `module: commonjs` × new resolution compatibility; `tsc-alias` behaviour |
| 5 (2027) | vue-tsc and typescript-eslint on the TS 7.1 API → drop TS 6; consider Oxlint type-aware | Full native toolchain | small, once upstream ships | upstream timelines |
| — | **Keep**: Less (4.9.x), mocha 11 + tsx for server tests, tsx for scripts, electron-builder `--dir` + Velopack | Migration cost ≫ benefit (Q4, Q7, Q8) | — | — |

- **Rspack + Vitest is a mixed pipeline** (SWC for build, Oxc/Vite for tests). Our tests already run on a different config than production (single chunk, eager imports), so this is no regression, and the transpile semantics are equivalent (per-file, no type info).
- If a single pipeline is a priority, the coherent alternatives are Vite 8 + Vitest 5 (mature, higher migration cost, chunking risk) or Rspack 2 + Rstest (low build-migration cost, but Rstest is pre-1.0). Revisit Rstest at 1.0.
- **Do not** combine phases 1 and 2 in one change. Phase 1 alone must keep the client suite count at or above its floor on the existing webpack build before the bundler moves. The repo's own history (silent 0-test runs, a webpack miscompile) shows each swap needs its own guard.
- Optional quick wins independent of migration:
  - Brotli quality 11 on every asset is likely a large share of production build time. Measure, and consider q11 only for the desktop/static release build.
  - fork-ts-checker inside `dev:client` duplicates `vue-tsc`. `SKIP_TS_CHECK` already exists and could default to on for CI.

### Gaps
- No repo timings exist yet. Phase 0 is required before promising any wall-clock number to the owner.
- Unknown whether the owner's other clone or CI (Steam Machine e2e) has constraints that favour keeping a webpack-identical output layout (e.g. `chunks/[name].js` paths assumed by the service worker or e2e snapshot tooling). Grep `sw.ts` and e2e scripts before Phase 2.
