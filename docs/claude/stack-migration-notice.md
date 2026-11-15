# NOTICE to a session woken after the stack move (2026-11-15)

While you slept, `main` moved its whole toolchain: **webpack is gone, Vite builds everything, Node is pinned to
Electron's.** Your worktree's code is fine; your commands and a few habits are not. Read this once, top to bottom,
before you rebase. The reference is `docs/claude/stack.md` (decisions S1–S16, the numbers, the inventory).

## 1. What changed

| | before | now |
| --- | --- | --- |
| client build | webpack + `vue-loader` (`webpack.config.js`) | **Vite 8** + `@vitejs/plugin-vue` (`vite.config.mts`) |
| desktop client | `DESKTOP_BUILD=1 npm run build:client` | `npm run build:client:desktop` (`vite build --mode desktop`) |
| the SPA shell | `assets/index.html` (static, hand-written `<script>`s) | **`src/client/index.html`** — a Vite input, built into `build/index.html` / `build-desktop/index.html` |
| lazy chunks | `chunks/<webpackChunkName>.js` | `chunks/<kebab-name-of-the-module-that-opens-it>.js` (`ConsoleShell.vue` → `chunks/console-shell.js`); component CSS `chunks/*.css`; Rolldown's helpers `chunks/rolldown-runtime.js` |
| the initial scripts | `vendors.js` + `main.js`, classic scripts | the SAME names, **ES modules** (`<script type="module">`) |
| server build | `tsc --build` + `tsc-alias` → a tree under `build/src/` | **one bundle** `build/src/server/server.js` (`node scripts/build-node.mts server`) — `npm start` unchanged |
| embedded server · hub · Electron main | webpack · webpack · `tsc` | `node scripts/build-node.mts embedded` · `hub` · `electron` (`desktop` = all three) |
| type checks | inside `build:server` / fork-ts-checker | **`npm run typecheck`** (server + Electron) — inside `npm run lint`; the client stays `lint:client` (vue-tsc) |
| client unit runner | `scripts/client-tests.mjs` (webpack → mocha) | **`scripts/client-tests.mts`** (Vite → mocha, same suite, same order, same floor) |
| one client spec | `npm run test:client:one -- <spec>` | the SAME command |
| Vapor / vdom unit modes | `test:client:vapor[:one]`, `test:client:vdom:one`, `TM_UNIT_VAPOR`, `tests/client/vaporUnit.json` | **gone** — every component compiles as written, as it ships |
| dev loop | `webpack --watch` | `npm run dev:server` + **`npm run dev:client`** (the Vite dev server on :5173 with HMR, proxying the game server on :8080 — open `http://localhost:5173/`) |
| Node | `>=24.20.0`, `.nvmrc` `v24` | **exactly the Node Electron carries** — `.nvmrc` names it (guard `tests/stack/nodeSync.spec.ts`) |
| `tsconfig.json` | `module: commonjs`, `moduleResolution: node` | `module: preserve`, `moduleResolution: bundler`, `isolatedModules`, `noEmit` — TS 7 ready |

## 2. In your worktree, after the rebase

1. **Node**: `fnm install` (reads `.nvmrc`) and `fnm use`; in the Bash tool put that version's directory on `PATH`
   (`$APPDATA/fnm/node-versions/v<.nvmrc>/installation`).
2. **Do NOT run `npm ci` / `npm install` in your worktree.** Your `node_modules` is a JUNCTION to the main clone's, and
   that one is already updated. An install there rewrites the shared folder under every other session.
3. Rebuild: `npm run build` (web) / `npm run build:desktop`; `npm run e2e:snapshot <task>` as before.
   Playwright stays 1.65.0, pinned exactly (Chromium build 1254 — `docs/claude/stack.md` § 4 says why not 1.65.1).
4. The checks you know still work: `npm run lint` (now with `typecheck`), `npm run build:test`, `npm run test:server`,
   `npm run test:client`, `npm run test:client:one -- <spec>`, `npm run test:bottle`, `npm run gate:freeze`.

## 3. Names that no longer exist

`webpack.config.js` · `webpack.test.config.js` · `webpack.embedded.config.js` · `webpack.diagnostics.config.js` ·
`scripts/client-tests.mjs` (→ `.mts`) · `scripts/vapor/sfcTemplateCompiler.cjs` · `unitVaporLoader.cjs` ·
`unitVaporPolicy.cjs` · `tests/client/vaporUnit.json` · `tests/console/vaporUnitPolicy.spec.ts` · `assets/index.html`
(→ `src/client/index.html`) · `test:client:vapor`, `test:client:vapor:one`, `test:client:vdom:one` · `SKIP_TS_CHECK`,
`DESKTOP_BUILD` (the frame symbols take the directory as an argument: `node scripts/make-frame-symbols.mjs build-desktop`)
· chunk names like `chunks/console-menu.js`, `chunks/player-input.js`, numbered `chunks/730.js` · `vscode.sample/`.

## 4. What to look for in YOUR uncommitted work

- **`/* webpackChunkName: … */`** in an `import()` — delete it (Vite ignores it; the chunk is named after the module).
- **`process.env.X`** in `src/client` other than `NODE_ENV` — Vite replaces `process.env` with `{}` in the client:
  read it some other way (the unit bundle's bottle reaches Node through `nodeProcess()`).
- **`import x = require(…)`**, a type imported without `type` and re-exported, a `const enum` across files — the
  per-file transpiler (`isolatedModules`) refuses them; `npm run typecheck` / `lint:client` name them.
- **A new `.vue` with a `<style>`** — fine (Vite builds it into `chunks/*.css`); a `src=` / `url()` to `assets/…` is the
  game server's path and is left as written (`transformAssetUrls: false`).
- **A spec that reads `wrapper.vm.<a setup binding>`** — still works (the unit bundle records the bindings;
  `tests/client/testing/scriptSetupState.ts`), but the template is now compiled INLINE as it ships: a spec that
  depended on the separate compile's quirks may move.
- **A bottle replay that `await import('@/client/…')`s a module of the page** — ask the page for it instead:
  `bottle.pageModules.<name>` (add the module to `PAGE_MODULES` in `tests/client/bottle/bottlePage.ts`).
- **A script, config or doc that names a removed file** (§ 3) or `build/src/server/<anything but server.js>` — the
  server is one file now; a server tool runs with `npx tsx src/server/tools/<tool>.ts`.
- **CI / workflows**: Node comes from `.nvmrc` (`node-version-file`), one version of each action.
