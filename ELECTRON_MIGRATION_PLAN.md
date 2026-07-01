# ELECTRON_MIGRATION_PLAN.md

**Status:** Phase 0 — feasibility audit + implementation-grade plan (analysis only; no Electron runtime added yet).
**Target runtime:** Electron **43.0.0** · **Windows-first** · macOS signing/notarization deferred to a separate future initiative.
**Baseline:** builds on the completed WebSocket realtime layer — see `WEBSOCKET_MIGRATION_PLAN.md` (§L mutation matrix + flag ladder). This document is its desktop-shell companion.

This plan is grounded in a read-only audit of the actual codebase (branch `main`, Node v22.22.3 / npm 10.9.8). Every load-bearing claim cites `file:line`. It is a plan, not an implementation — the first code lands only when Phase 1 is explicitly requested.

---

## 1. Executive summary

**Can we start Electron now without breaking the web app? — YES.** Electron is a purely **additive** build + runtime lane. It is installed as a devDependency, launched through its own CLI (`electron .`, `electron-builder`), and never passes through webpack, `tsc --build src`, `vue-tsc`, or the Mocha/mochapack test lanes. Nothing in the current dependency graph pins an Electron-incompatible version (`"electron"` appears **0×** in `package-lock.json`). The web build, `/player?id=…` links, Heroku/Docker deploy, WebSocket realtime, and polling fallback are untouched by adding a desktop shell.

**Is Electron 43.0.0 a viable target here? — YES, with zero code-level blockers.** Electron 43 ships **its own bundled modern runtime** (a recent Node + Chromium + V8) that is **separate from the server's Node runtime** — the two must not be conflated. The server/web project keeps targeting `engines.node: "22.x"` (`package.json:5-7`); the Electron main/preload run inside Electron's *bundled* Node, and the renderer runs inside Electron's *bundled* Chromium. This is **not** a blocker precisely *because the Electron lane is independent of the server runtime* and the renderer is browser-clean — **not** because any versions "line up." The renderer is the existing browser bundle unchanged — grep of `src/client` for Node built-ins (`fs/path/http/child_process/net/crypto`) returns **nothing**, so it drops into a locked-down renderer (`contextIsolation:true`, `nodeIntegration:false`) with no shims. The realtime client uses the browser-native `WebSocket` (`realtimeService.ts:227`), not the `ws` library, so the renderer needs no native module.

**Can we go Windows-first and defer macOS signing? — YES.** The Windows desktop stack (NSIS installer + `electron-updater` + premium update UX) has no dependency on Apple Developer ID, notarization, or `.p12` export. macOS is a documented future phase (§16), not a blocker.

### What is already ready (REUSE)
- **Electron config seam already exists and is shipped:** `src/client/utils/runtimeConfig.ts` exposes `window.tmRuntimeConfig?: {apiBase, wsBase, participantId}` with `apiUrl()`/`wsBaseUrl()`/`identitySearch()` (built for exactly this, tested in `tests/realtime/runtimeConfig.spec.ts`).
- **Realtime transport** is Electron-agnostic: `new WebSocket(realtimeWsUrl())` derives its URL from the seam; injecting `wsBase` re-points it with zero transport code change.
- **The renderer is browser-clean** and served as static assets; no SSR, no Node in the client.
- **Game-boundary = full reload BY DESIGN** (`App.vue:781-786`), which is exactly what a desktop shell wants (clean-slate reset of ~46 per-game module singletons — §8).

### What is partially ready (ADAPTER)
- **`runtimeConfig` seam adoption is incomplete:** 23 client files use it, but **11 API `fetch()` sites** still pass a raw relative `'api/…'` string (§7), and **27 client files** read `window.location` directly. These are fine while the renderer loads over an `http(s)://` origin, but must be wrapped for a cross-origin packaged client.
- **WS base auto-derivation is wrong for a non-`http(s)` origin** — `wsBaseUrl()` picks `ws:`/`wss:` from `location.protocol` (`runtimeConfig.ts:60-68`); a packaged renderer MUST inject an explicit `wsBase`.

### What is risky / must be proven first
- **Asset loading under packaging.** `webpack output.publicPath: '/'` (`webpack.config.js:107`) makes code-split chunks load from the absolute web-root `/chunks/[name].js`, and `main.ts:35` fetches locales relatively. Under `file://` this breaks. This is the single most important thing to prove (§9).
- **Cross-origin API/WS.** The server sends **zero CORS headers** and has no `OPTIONS` handler (`Handler.ts:97-107`). A packaged renderer talking to a remote server is cross-origin → needs a small server-side CORS addition (§10, §11).

### What should NOT be attempted yet
Command-transport rewrite, WebSocket command submission, removal of the reload-based game boundary (the `resetGameSessionState()` refactor stays deferred exactly as in the WS plan), macOS signing, OAuth-in-desktop, in-app spectator endgame, blind performance refactors (§17: measure first). (§21.)

**Direction:** proceed. Phase 1 is additive and proves the runtime by loading the renderer from a running server origin (zero renderer refactor). Packaged asset loading, cross-origin config injection, and the premium Windows updater follow as independently shippable phases.

---

## 2. Electron 43.0.0 target-stack analysis

### Installation
```bash
npm install --save-dev electron@43.0.0
```
- **Package manager:** npm (`package-lock.json` at root; the only `yarn.lock` is a nested transitive artifact under `node_modules/uri-js`). Use npm for all Electron deps.
- **Clean slate:** `electron` is absent from the tree today — no version conflict is even possible on install.
- **Runtime dep split (verified against the audit):** `electron` → **devDependency**; `electron-builder` → **devDependency** (packaging CLI); `electron-updater` → **dependency** (the app's main process imports it at runtime).

### Compatibility with the current TypeScript / build setup
- **TypeScript 6.0.3** (installed) compiles the existing server to CommonJS via `tsc --build src/tsconfig.json && tsc-alias` (`package.json:78`). Electron's **main + preload** are new `.ts` files that compile with the *same* TS 6 to CJS (`module: commonjs`, `target: es2021` — comfortably supported by Electron's bundled V8). This is an exact structural clone of the proven `build:server` lane.
- **Inert tsconfig plugin (do not trip on it):** `tsconfig.json:35-37` declares `plugins: [{"transform":"transformer-module"}]`. The package is **not installed**; plain `tsc`/`tsx` ignore `compilerOptions.plugins`, so it is a no-op today. The Electron lane must compile with plain `tsc`/`tsx` — **do not** switch it to `ts-patch`/`ttsc` (that would try to resolve the missing transform and fail).
- **No webpack involvement for main/preload.** `webpack.config.js` has exactly two entries (`main`, `sw`, lines 65-68) — the renderer bundle. Electron main/preload stay out of webpack and out of `tsconfig.vue-tsc.json` (the renderer typecheck scope). New lane = a dedicated `electron/tsconfig.json` extending root.

### Main/preload TypeScript strategy (recommended)
```
electron/
  tsconfig.json     // extends ../tsconfig.json; module commonjs; target es2021; types ["node","electron"]; outDir ../build/electron
  main.ts           // app lifecycle, BrowserWindow, protocol, updater, IPC
  preload.ts        // narrow contextBridge: tmRuntimeConfig + desktopBridge
```
- Dev: run via `tsx` (already a dep, `^4.22.4`) — `electron` can launch a tsx-loaded entry, or pre-compile with `tsc`.
- Prod: `tsc -p electron/tsconfig.json` → `build/electron/{main,preload}.js`; `package.json "main": "build/electron/main.js"` (added only in the Electron phase; the field is currently absent, so the web/server build is unaffected).

### Modern BrowserWindow security defaults (Electron 43)
Electron 43 already defaults to `contextIsolation:true` and `nodeIntegration:false`; `sandbox:true` is the default for renderers. Our renderer is browser-clean, so these defaults are compatible out of the box. The security baseline is spelled out in §11.

### Renderer / Node / Chromium implications
- Renderer: existing static bundle, no Node — REUSE. Electron's bundled Chromium comfortably supports Vue 3.5.28 and the es2021 output.
- Main process: runs on **Electron's own bundled Node runtime** — a distinct runtime from the server process `npm start` launches (do not treat them as the same). Modern Node built-ins are available to main/preload; the server keeps its own `engines.node: "22.x"` independently.

### Dev / CI / build implications
- **Dev workflow is additive** (§12): `dev:server` + `dev:client` keep working; a new `electron:dev` launches a window at the running server.
- **CI:** the existing `build` + `lint` + `test` lanes are unchanged. A packaging job (`electron-builder --win`) is a *new, separate* CI lane — it does not gate the web build.

### Dependency conflict scan (verified)
| Dep | Version | Electron 43 impact |
|---|---|---|
| node (engines) | server targets 22.x (installed 22.22.3) | ✅ **irrelevant to Electron** — main/preload use Electron's *own* bundled Node, not the server runtime; the two lanes are independent, so no alignment is required |
| typescript | 6.0.3 | build-time only; not in Electron runtime — no conflict |
| webpack / webpack-cli | 5.107.2 / 7.0.2 | separate lane; renderer output already browser-target — no conflict |
| vue / vue-tsc | 3.5.28 / 3.2.9 | renderer-only, runs in Chromium — no conflict |
| ws | 8.21.0 | **server-only**; renderer uses native WebSocket — no conflict |
| better-sqlite3 / pg | 12.10.0 / 8.19.0 (optionalDependencies) | **server-only**; not in the packaged renderer (§13) — no rebuild needed |
| sharp | 0.35.2 | build-tooling only (`scripts/card-art/*`) — never shipped |
| tsx / less / eslint | 4.22.4 / 4.6.4 / 10.0.3 | build/dev-time only — no conflict |

**Electron 43-specific assumptions to account for:**
- **Protocol registration must happen before `app.ready`** via `protocol.registerSchemesAsPrivileged([{scheme:'app', privileges:{standard:true, secure:true, supportFetchAPI:true, stream:true}}])`, then `protocol.handle('app', …)` after ready (the modern `protocol.handle` API, not the deprecated `registerBufferProtocol`).
- **Preload runs sandboxed** → it may use only `contextBridge` + a whitelisted subset of Electron; no arbitrary `require`. Runtime config injection uses `contextBridge.exposeInMainWorld('tmRuntimeConfig', …)`.
- **`app.setAppUserModelId`** on Windows for correct taskbar/notification identity.
- **Auto-update compatibility:** `electron-updater` + NSIS is fully supported on Electron 43; it consumes `latest.yml` + `.blockmap` artifacts electron-builder emits.
- **Packaging:** electron-builder ≥ a version that targets Electron 43 (any recent 24/25.x line); pin at add-time.

---

## 3. Windows-first desktop strategy

**Why Windows first:** it is the developer's platform (repo runs on Windows 11 per environment), it needs no code-signing certificate authority enrollment to *test* (unsigned dev builds run locally), and `electron-updater`'s NSIS differential-update path is the most straightforward premium updater to build and validate. macOS notarization requires Apple Developer Program enrollment + Developer ID + `.p12` + a notarization round-trip — a hard external dependency we explicitly keep off the critical path (§16).

- **First artifact type:** an **NSIS installer** (`.exe`) via electron-builder (`target: nsis`). NSIS is electron-updater's native Windows path (emits `latest.yml` + `<app>-<version>.exe.blockmap` for differential downloads) and gives us the mandatory-update + progress UX later. A portable `.exe` or `.zip` is a secondary convenience target; Squirrel.Windows is **not** recommended (weaker update UX, no differential blockmap).
- **Unsigned Windows builds are acceptable for *internal testing of the update architecture* — not as production-quality UX.** They run, but an unsigned installer triggers a Windows SmartScreen "Windows protected your PC" warning on first run, and the auto-update flow may surface trust warnings. The exact installer/update UX may therefore include SmartScreen and trust prompts. This is fine to validate check → download → progress → install → relaunch internally. **Production-quality *seamless* UX (no SmartScreen, silent update) requires Windows code signing later** — a separate sub-phase after the updater is functionally proven.
- **Testable BEFORE code signing:** launch, renderer load, REST, WS, polling fallback, identity injection, reload boundary, the update-check endpoint + mandatory-update gate + download-progress UI + `latest.yml` discovery + differential download + restart-to-install (electron-updater works with unsigned NSIS on Windows; only the SmartScreen prompt differs).
- **Should wait for code signing:** silent SmartScreen-free installs, a fully seamless "no warning" auto-update, and any enterprise-trust scenarios. These are a Windows-signing sub-phase (EV/OV code-signing cert), *separate from and after* the Windows updater is functionally proven.
- **Updater testing on Windows first:** host `latest.yml` + installer artifacts on a static URL (a `dev` channel dir — even a local static server or a GitHub release for internal builds), point `electron-updater` at it, bump the version, verify check → download → progress → install → relaunch. All doable unsigned.
- **Keeping macOS out of the critical path:** the main/preload code is cross-platform; only the *packaging + updater channel + signing* differ per OS. We write the architecture cross-platform but implement/test only the Windows target in Phases 1-8.

---

## 4. Current architecture relevant to Electron

| Item | Today | Electron verdict |
|---|---|---|
| **Shell** | Static hand-authored `assets/index.html` (no HtmlWebpackPlugin), served for every page route by `ServeApp.ts:13` (rewrites `/`→`/assets/index.html`). Relative refs: `styles.css`, `vendors.js`, `main.js`, `favicon.ico`. | **REUSE** — path-agnostic content; ship it in the package or serve over http. |
| **Client bundle** | `build/main.js` + `build/vendors.js` (webpack, entries at `webpack.config.js:65-68`), `output.path=__dirname+'/build'`. No content hashing (stable names). | **REUSE** the artifacts; **ADAPTER** on `publicPath` for packaging (§9). |
| **Code-split chunks** | `build/chunks/[name].js` (`chunkFilename:'chunks/[name].js'`, :108); loaded at absolute `/chunks/…` because `publicPath:'/'` (:107). Every screen (main-menu, player-home, spectator-home, create, endgame) is a lazy chunk. | **ADAPTER/REFACTOR** — the crux of §9. |
| **Stylesheet** | `build/styles.css` from `lessc` (`make:css`), linked directly (NOT emitted by webpack). CSS `url(./assets/…)` resolves relative to the CSS file. | **REUSE** if co-located / served. |
| **Assets** | `assets/**` — fonts (`*.ttf`, relative `@font-face` in `common.less:112-154`), card/tile art (CSS `background:url(./assets/…)`), locale JSON, ma/expansion icons. Served by `ServeAsset.toFile` allow-list. Only Ubuntu font comes from a Google Fonts CDN `<link>` (`index.html:5`). | **REUSE** (relative); ship locally. Ubuntu = ADAPTER (self-host for offline) or accept fallback. |
| **App routing** | `App.vue` single root; `applyRoute()` (`:720-780`) reads `getLastPathSegment()` from `window.location.pathname` (:378-381); `navigateInApp()` (:787) = `history.pushState` + `applyRoute`; `popstate` (:791). | **REUSE** if the renderer loads over a standard-scheme origin with a real path; ADAPTER if no URL. |
| **Game URL identity** | `?id=<token>` bearer; read initially via `identitySearch()` (seam) at `App.vue:554/736`, `WaitingFor.vue:715`; all follow-ups take `id` from the fetched `model.id`. | **REUSE** via injected `participantId`. |
| **Runtime config seam** | `runtimeConfig.ts` — `apiBase`/`wsBase`/`participantId` via `window.tmRuntimeConfig`. | **REUSE** (built for this). |
| **REST endpoints** | Token-authed, stateless w.r.t. identity; all under `api/…` (§ routes in point 10 of the audit). | **REUSE** (same-origin) / **ADAPTER** (cross-origin → CORS + fetch-wrap). |
| **WebSocket** | `/ws` on the same `http.Server` (`server.ts:91`); token-authed; default ON; `new WebSocket(realtimeWsUrl())`. | **REUSE**; inject `wsBase`. |
| **Game-boundary** | Full page reload (`location.assign`/`href`/`<a href>`); resets ~46 module singletons for free. | **REUSE** (renderer reload) — keep for the desktop MVP. |

---

## 5. Browser compatibility contract

**Browser mode remains the default and first-class.** Electron must not change how web users open or play. The following are the invariants; a smoke checklist to prove them appears after each Electron phase.

**Must remain unchanged:**
1. Direct links `/player?id=…`, `/spectator?id=…`, `/game?id=…`, `/the-end?id=…`, `/` all serve the static shell (`ServeApp`) and resolve the screen client-side.
2. Browser refresh / new-tab restore via the `?id=` token.
3. Production Heroku/Docker deploy (`node build/src/server/server.js`, `PORT||8080`) — no server behavior change from adding a desktop shell.
4. Static assets served from `build/` + `assets/` via `ServeAsset` at the same URLs.
5. WebSocket default-ON (`realtimeEnabled()` / `realtimeClientEnabled()`), polling fallback, the §L flag ladder (`?realtime=0`, `?realtimeRefresh=0`, `?realtimePoll=0`, `REALTIME_ENABLED=0`).
6. Premium overlays / game runtime (playerkey remount guards, animations) unchanged.
7. Existing dev commands (`dev:server`, `dev:client`, `watch:less`, `build`, `lint`, `test`).

**Hard rules for the plan:**
- `webpack output.publicPath` stays `'/'` for the **web** build. Any desktop override is **env-conditional** so a production browser build is byte-identical (§9).
- Server-side CORS (§10) is **additive** and only reflects an allow-listed desktop origin; same-origin browser requests are unaffected (no `Origin` header round-trip changes for the browser).
- Browser must never load desktop-updater UI — the update surface is gated on a `desktopMode` flag that only the Electron preload sets (§14/§15).
- No renderer refactor may make the **web app depend on Electron** (`window.tmRuntimeConfig` stays optional; `config()` already defaults to `{}` — `runtimeConfig.ts`).

**Per-phase browser smoke check (run after every Electron phase):**
```
npm run build && npm start
# open in a normal browser:
/  → premium main menu
create a game → /player?id=… loads, plays a turn
open a 2nd browser as another seat → WS pushes the turn live
?realtime=0 → still works via polling
REALTIME_ENABLED=0 npm start → byte-identical legacy polling
/spectator?id=… , /the-end?id=… , /game?id=… all resolve
no desktop-updater UI anywhere
npm run lint:client (vue-tsc) — renderer typecheck still green for touched files
```

---

## 6. Target Electron architecture

```
Electron main process (build/electron/main.js — Electron's bundled Node runtime, NOT the server's Node)
  ├─ app lifecycle, single-instance lock, setAppUserModelId('…terraforming-mars')
  ├─ registers custom app:// scheme (standard+secure+supportFetchAPI) BEFORE ready
  ├─ protocol.handle('app', …) → serves the packaged static tree
  │     (mirrors ServeAsset.toFile's build/ + assets/ → URL-root flattening)
  ├─ creates BrowserWindow { contextIsolation:true, nodeIntegration:false, sandbox:true, preload }
  ├─ desktop session store (electron-store or a JSON file in app.getPath('userData')):
  │     { serverBase, lastParticipantId, updateChannel }
  ├─ electron-updater (Windows NSIS) — version gate, download, progress → IPC → renderer
  └─ IPC handlers (narrow): getRuntimeConfig, update:*, openExternal, quitAndInstall

  preload (build/electron/preload.js, sandboxed)
  └─ contextBridge.exposeInMainWorld:
        window.tmRuntimeConfig = { apiBase, wsBase, participantId }   // reuses runtimeConfig.ts
        window.desktopBridge   = { desktopMode:true, onUpdateState, checkForUpdate, quitAndInstall, openExternal, getVersion, setServer }

  renderer (the EXISTING web client, unchanged code)
  └─ loadURL('app://bundle/')  (packaged)   OR   loadURL(devServerOrigin)  (dev, Phase 1)
        REST  → apiUrl(path)   → apiBase (injected)
        WS    → realtimeWsUrl → wsBase (injected)
        identity → identitySearch() → participantId (injected) for the first load; model.id after
        screen → applyRoute() from the (real) path under app://bundle/…
```

**Responsibilities:**
- **Main:** window/lifecycle, the `app://` protocol handler, the desktop session store, `electron-updater` orchestration + progress relay, external-link handling, IPC. Owns all secrets/URLs (update feed URL, allowed server list). Also decides the **startup mode** (§14): a mandatory-update gate loads the renderer in *update-only* mode and does **not** restore the last game or inject an active `participantId` into normal game flow until the client is compatible.
- **Preload:** the *only* bridge. Injects `tmRuntimeConfig` (so the renderer's existing seam works) + a narrow `desktopBridge` for update UX + external links. No `require`, no `fs`, no `child_process` exposed.
- **Renderer:** the premium web client verbatim. It never learns it is in Electron except via `window.desktopBridge?.desktopMode` (used only to (a) show the updater surface and (b) route external links). No game logic changes.

**Shared vs Electron-only:**
- **Shared with web:** the entire renderer, `runtimeConfig.ts` seam, realtime client, all overlays, the reload-based game boundary.
- **Electron-only:** `electron/main.ts`, `electron/preload.ts`, the `app://` protocol handler, the desktop session store, the updater orchestration, the premium `DesktopUpdate*` renderer components (gated on `desktopMode`), `electron-builder.yml`.

**Config/environment selection:** the desktop session store holds `serverBase` (chosen in a server-selector or defaulted). Channels (dev/staging/prod) map to (a) the update feed URL and (b) the default `serverBase`. The preload reads the store on startup and injects `apiBase`/`wsBase` accordingly.

**No client duplication.** The renderer is reused as-is; there is no forked desktop client.

---

## 7. Runtime config and identity strategy

### The injection points (what `tmRuntimeConfig` must provide)
Set by the preload **before** `main.ts` `bootstrap()` runs:

1. **`apiBase`** (e.g. `'https://tm.example.com'` or `'http://127.0.0.1:8080'`) → consumed by `apiUrl()` (`runtimeConfig.ts:51-57`) at every *wrapped* fetch, plus `App.update`/`applyRoute`. **Also requires wrapping the 11 currently-raw fetches (below) before it fully takes effect.**
2. **`wsBase`** (e.g. `'wss://tm.example.com'`) → consumed by `wsBaseUrl()` → `realtimeWsUrl()` → `new WebSocket()`. **Mandatory** under `app://`/`file://` — the `location`-derivation (`runtimeConfig.ts:60-68`) is wrong for a non-`http(s)` origin.
3. **`participantId`** → consumed by `identitySearch()` (`runtimeConfig.ts:75-85`) at the three initial-load GETs (`App.vue:554`, `App.vue:736`, `WaitingFor.vue:715`). All follow-ups take `id` from `model.id`, so only the FIRST load needs the token.

### The 11 un-wrapped API fetches to route through `apiUrl()` (ADAPTER, one line each)
`GamesOverview.vue:88, :115, :166` · `admin/GameOverview.vue:118` · `LoginHome.vue:34-35` · `CreateGameForm.vue:1147, :1243` · `PremiumCreateGame.vue:183` · `LoadGameForm.vue:58` · `JoinGameCard.vue:172-173`. Plus **`main.ts:35`** `fetch('assets/locales/${lang}.json')` (an *asset* fetch — resolves locally under `app://` if locales are shipped, else wrap in a base). `oauth.ts:22` (Discord) is external — leave as-is.

### Route/screen + navigation NOT covered by the seam today (needs the `app://` "real path" trick or an ADAPTER)
- `App.vue:378-381` reads the screen from `window.location.pathname`; `App.vue:726` reads `?id=` for the-end.
- Nav/reload sites assume a web origin: `GameExitButton.vue:32` (`location.assign('/')`), `PremiumCreateGame.vue:199`, `CreateGameForm.vue:1234`, `JoinGameCard.vue:192`, `LoadGameForm.vue:71`, `EndgameResultsOverlay.vue:48/76/79`, and the four INVALID_RUN_ID `location.reload()` sites (`WaitingFor.vue:644`, `DraftFlowOverlay.vue:333`, `InitialDraftFlowOverlay.vue:769`, `StartGameFlowOverlay.vue:876`), plus language reloads.

**The elegant resolution:** register `app://` as a **standard** scheme and have its handler serve `assets/index.html` for *any* path (mirroring `ServeApp`). Then `app://bundle/player?id=…` keeps `window.location.pathname` (`/player`) and `.search` (`?id=…`) **valid**, so `applyRoute()` + `identitySearch()` + relative navigations (`location.assign('/')`→`app://bundle/`, `location.href='player?id=…'`, `<a href=".">`) all resolve correctly and reload the renderer — **the reload-based boundary keeps working unchanged.** This is the decisive reason to choose `app://` over `file://` (which yields `/C:/…/index.html` paths that break `getLastPathSegment` and relative nav).

### Browser mode vs Electron mode
**Browser:**
```
window.location + relative origin; ?id= from the URL; wsBase derived from location.protocol/host.
tmRuntimeConfig is undefined → config() returns {} → all defaults → identical to today.
```
**Electron:**
```
preload injects tmRuntimeConfig = { apiBase, wsBase, participantId }.
Renderer loads app://bundle/<path>?id=… (real path preserved by the standard-scheme handler).
No dependence on a visible URL bar. Renderer reloads cleanly on a game-boundary change.
```
The asymmetry to watch: `identitySearch()` returns the **full** `location.search` in the browser but only `'?id='+token` when injected — audit that no initial-load consumer needs extra params (`App.vue:554` already strips `&noredirect`; `?realtime`/`&noredirect` won't be present under injection — acceptable, they default correctly).

---

## 8. Navigation model

**Current map (path → screen, reload class):**
```
'/' (main-menu, PremiumMainMenu) ──navigateInApp──▶ create-game (PremiumCreateGame)   [IN-APP, the only in-app pair]
   ▲ location.assign('/') (GameExitButton:32; endgame <a href=".">)                    │ POST /api/creategame
   │                                                                                    ▼ location.assign('player?id=…') :199  [RELOAD]
[RELOAD boundary]
player?id=… (PlayerHome) ◀── join (JoinGameCard:192), load (LoadGameForm:71),
                              rematch join (EndgameResultsOverlay:48 <a href>), the-end id
   │ every server response → playerkey++ (intra-game remount; App.vue:637-639)
   ▼ Phase.END → EndgameExperience overlay (New game / To menu / Rematch — all <a href> RELOAD)
spectator?id=… (SpectatorHome) · game?id=… (GameHome) · the-end?id=… (GameEnd, legacy)
```

**Recommendation — which stays reload-based vs in-app:**
- **Game boundary (enter/leave/switch/restore/rematch/ended) = RELOAD, keep it.** In Electron this is a renderer reload of `app://bundle/<path>?id=…`, which resets all ~46 per-game module singletons (§ below) for free — matching the by-design browser behavior (`App.vue:781-786`). **No SPA-boundary refactor is required for the desktop MVP.**
- **Menu ↔ create = in-app** (already `navigateInApp`), works in Electron unchanged.

**Electron flows (all via renderer reload of `app://bundle/<path>?id=…`):**
```
enter game     → main sets session.lastParticipantId; loadURL('app://bundle/player?id=<id>')
leave game     → loadURL('app://bundle/')   (GameExitButton's location.assign('/') already does this)
switch game    → loadURL('app://bundle/player?id=<other>')
restore last   → on launch, if session.lastParticipantId → loadURL('app://bundle/player?id=<id>'), else menu
open spectator → loadURL('app://bundle/spectator?id=<id>')
ended game     → renderer shows EndgameExperience overlay; New game/menu/rematch reload as today
rematch        → EndgameResultsOverlay <a href="player?id=<newId>"> reloads into the new game
```

**Why not remove the reload boundary:** the audit enumerated **~46 module-level per-game singletons** (`reactive({…})` state + Maps/Sets/animation stores) that today rely on the page reload to reset — e.g. `journalState`, `notificationState`, `playedCardsViewState`, `handFilterState`, `sellPatentsState`, `handSelectState`, `handPlayState`, `awardFundingState`, `actionsOverlayState`, `effectsOverlayState`, `boardInfoState` (+ its `infoCache`/`previewCache` Maps), `placementLockState`, `startGameFlowState` (+ `preludeOrderStore` Map), `rematchState`, `revealViewerState`, `effectDetailState`, `energyConversionState`, `realtimeState`/`realtimeSync`, `turnHandoffState`, `tilePlacementAnimation`, `cubeDropState`, `liveCardResources`. Only ~4 are cross-game (`identityState`, `privateScoreState`, `createGameState`, `joinGamesState`). `reset*()` functions exist for ~16 but are wired only to component lifecycles, and **there is no central `resetGameSessionState()`** — `App.vue:786` names it as the missing prerequisite for in-app boundaries. **Do not build it as part of Electron;** keep reload. (This matches WS-plan §E-Phase 13's deferral.)

---

## 9. Asset loading strategy (critical)

**What breaks under a naive `file://` load (from the audit):**
1. **Code-split chunks 404.** `publicPath:'/'` (`webpack.config.js:107`) → chunks requested at `/chunks/[name].js`; under `file://` `/` is the filesystem root. *Every screen is a lazy chunk* → blank app after bootstrap. Confirmed in the built `main.js`: `__webpack_require__.p = "/"`, `script.src = "/" + "chunks/" + name + ".js"`.
2. **Asset dir split.** `index.html` lives in `assets/`, but `main.js`/`vendors.js`/`styles.css` live in `build/`; the server flattens both to `/` via `ServeAsset.toFile`. On disk they are two separate trees — a `file://` load needs them physically co-located.
3. **`fetch('assets/locales/…')` blocked.** Chromium blocks `fetch()` of `file://` URLs in the renderer → locale load fails (degrades to English, but still).
4. **Router + nav** read `window.location.pathname`/relative navigations → `file://` paths are `/C:/…/index.html`, breaking `getLastPathSegment` and `location.assign('/')`.
5. **2 absolute `url(/assets/…)`** in `DeltaProjectBoard.vue:376,402` → filesystem root under `file://` (Delta board art only).

### Option A — `file://`
- **Pros:** simplest to *launch* (no protocol handler).
- **Cons:** all five breakages above. Requires a `publicPath` rebuild (`'./'`), a flattened dist (add `HtmlWebpackPlugin`+`CopyWebpackPlugin` — currently absent), SW disable, router adaptation, and `fetch` of local files is blocked. **Not recommended.**

### Option B — custom `app://` protocol  ✅ RECOMMENDED
- Register `app://` as **standard + secure + supportFetchAPI + stream** before `app.ready`; `protocol.handle('app', req => …)` after ready. The handler **replicates `ServeAsset.toFile`'s mapping** (a ~40-line port): `/` and unknown paths → `assets/index.html` (so SPA routing + relative nav work); `main.js`/`vendors.js`/`styles.css` → `build/…`; `chunks/*.js` → `build/chunks/…`; `assets/**` (art/fonts/locales) → `assets/…`. Content types from the existing tiny map (`ContentType.ts`) — extend it if a new asset type appears (no `svg`/`woff2`/`wasm` today).
- **Pros:** `fetch` works (supportFetchAPI); relative asset URLs + `./assets/…` CSS resolve; **real paths preserved** so `applyRoute`/`identitySearch`/relative nav REUSE unchanged (§7); no asset repackaging beyond shipping the two dirs; secure context (SW/localStorage fine); CSP-friendly.
- **Cons:** must set `publicPath` for the desktop bundle so chunks load from `app://bundle/chunks/…` (env-conditional, below); a small protocol handler to maintain.

### Option C — embedded local HTTP server (spawn the existing Node server on 127.0.0.1)
- **Pros:** *zero* renderer change — everything (publicPath `/`, `ServeAsset`, relative fetch, nav, WS-from-location, CORS-free same-origin) works verbatim; ideal for **Phase-1 dev proof** (point the window at `npm run dev:server`).
- **Cons as a *shipping* strategy:** bundles the whole server + a DB decision (LocalFilesystem = no native, or better-sqlite3 with `@electron/rebuild`); the server reads **cwd-relative** paths (`build/`, `assets/`) so packaging must `chdir` to the resources root; it changes the product into a **standalone offline app** rather than a thin client to a configurable server. **Not the recommended *product* shape** given the "connect to dev/staging/prod server" goal — but it IS the recommended **dev / Phase-1** loading path (`loadURL(serverOrigin)`).

### Recommendation
- **Dev / Phase 1 (prove the runtime):** `loadURL(<serverOrigin>)` — same-origin, zero adapters, no packaging. Proves Electron 43 + BrowserWindow + preload + REST + WS + polling with no renderer refactor.
- **Packaged (Phase 2A/2B):** **Option B — `app://` custom protocol** for the static renderer (2A) + **injected `apiBase`/`wsBase`** to a configurable remote/local server (2B). This is the target thin-client architecture.
- **Environment-specific `publicPath`** so the browser production build is unchanged:
  ```js
  // webpack.config.js:107
  output.publicPath: process.env.DESKTOP_BUILD === '1' ? 'app://bundle/' : '/'
  ```
  Web build: `publicPath:'/'` (unchanged). Desktop build (`DESKTOP_BUILD=1 npm run build:client`): `app://bundle/`. (Alternative: keep one build and set `__webpack_public_path__` at runtime in `main.ts` before the first dynamic import — a single-artifact option; the env-conditional build is cleaner and deterministic since the desktop package is a separate artifact anyway.)

---

## 10. REST and WebSocket connectivity

**Targets** (chosen by the desktop session store `serverBase` + channel default):
- **Local dev server:** `apiBase='http://127.0.0.1:8080'`, `wsBase='ws://127.0.0.1:8080'`.
- **Heroku/staging:** `apiBase='https://<staging-host>'`, `wsBase='wss://<staging-host>'`.
- **Production:** `apiBase='https://<prod-host>'`, `wsBase='wss://<prod-host>'`.

**`http`/`https` + `ws`/`wss`:** the server speaks **plain HTTP unless `KEY_PATH`+`CERT_PATH` are set** (`server.ts:52-76`); in typical hosting TLS is terminated by an upstream proxy. The WS attaches to whichever server object `createServer()` returns, so **`wss://` works only if TLS is terminated in front of / by the process.** The desktop client injects the scheme explicitly via `wsBase` (never derive from a non-`http(s)` `app://` origin).

**CORS (the one required server change for the packaged thin client) — added in Phase 2B, with strict guardrails:** the server sends **no `Access-Control-*` headers** and has **no `OPTIONS` handler** (`Handler.ts:97-107` switches only GET/PUT/POST). A renderer at an `app://` origin hitting `https://<host>` is cross-origin. Add a small, isolated, **explicitly allow-listed** CORS layer — never a blanket one:
- **Empirically verify the real `Origin` FIRST — do not assume it.** The exact `Origin` header Electron's `app://` fetches send must be **inspected in Phase 2B** (log the incoming `Origin`) and the allowlist configured to match it exactly. It may be `app://bundle`, `app://`, `null`, or another form depending on how the scheme is registered — **verify empirically, don't guess.**
- **Explicit, environment-configured allowlist only. NO wildcard.** Reflect a *matched* allow-listed `Origin` into `Access-Control-Allow-Origin` in `responses.ts` + `ServeAsset` responses. **Never** send `Access-Control-Allow-Origin: *`. The allowlist (the verified `app://` origin + `http://localhost:8080` for dev) is env-configured per channel.
- Add an `OPTIONS` preflight branch in `Handler.processRequest`.
- **No credentials for gameplay.** Game APIs authenticate with the **URL `?id=` token**, not a cookie, so **do NOT enable `Access-Control-Allow-Credentials`** unless a specific flow genuinely requires cookies (gameplay does not). Cookies are `SameSite=Strict; Secure` and only relevant to optional Discord auth (out of desktop scope).
- **Do NOT open admin/auth endpoints to arbitrary origins.** Scope CORS to the game-runtime API surface; admin/auth endpoints stay same-origin-only (out of desktop scope).
- **Additive:** same-origin browser requests never send a cross-origin `Origin`, so browser behavior is unchanged.

**WS handshake:** no preflight (WebSocket is exempt); `RealtimeServer.onUpgrade` (`:172-186`) does **no Origin check** — permissive, fine for a token-authed client. Add an Origin allowlist only as public-exposure hardening (low priority).

**Reconnect / resume / fallback:** REUSE entirely. The client already does capped-backoff reconnect + `RESUME_GAME(lastGameAge,lastUndoCount)` and stretches the poll 1s→~20s while WS is healthy, restoring 1s on disconnect (WS-plan baseline). Electron changes none of this — only the injected `wsBase`.

**Diagnostics / dev chip in Electron:** the realtime dev chip (`RealtimeLayer.vue`, `isRealtimeDebug()`) currently keys on `?realtime` / non-prod / `localStorage`. In a URL-bar-less window, expose a `desktopBridge.isDebug` or read `localStorage realtime_debug=1`; surface WS health (`realtimeState`) in a small desktop status affordance (§5 UX). No transport change.

---

## 11. Security model (Electron 43 baseline)

**BrowserWindow (main):**
```js
new BrowserWindow({
  webPreferences: {
    contextIsolation: true,          // default in E43, enforce explicitly
    nodeIntegration: false,          // renderer gets no Node
    sandbox: true,                   // default; our renderer is browser-clean so it holds
    preload: path.join(__dirname, 'preload.js'),
    webSecurity: true,               // never disable
    allowRunningInsecureContent: false,
  },
});
```

**Preload (the ONLY bridge):**
- `contextBridge.exposeInMainWorld('tmRuntimeConfig', {apiBase, wsBase, participantId})` — plain data, read from the main-process session store via a synchronous IPC or injected at construction.
- `contextBridge.exposeInMainWorld('desktopBridge', { desktopMode:true, getVersion, onUpdateState(cb), checkForUpdate(), quitAndInstall(), openExternal(url), setServer(base) })` — each a thin `ipcRenderer.invoke`/`on` wrapper. **No raw `ipcRenderer`, no `require`, no `fs`/`path`/`shell`/`child_process`** exposed.

**What the renderer is allowed to know:** the API/WS base, its own participant token, the app version, update state, and `desktopMode`. **What stays in main/preload:** the update feed URL, the allowed-server list, any file access, the session store, `shell.openExternal`, `autoUpdater`.

**External links:** intercept `window.open` + navigation via `webContents.setWindowOpenHandler` → `shell.openExternal` for `http(s)` external URLs; deny in-window navigation to non-`app://`/non-configured origins. (`GameHome.vue`/`EndgameResultsOverlay.vue`/`BugReportDialog.vue` build shareable external links — route them through `desktopBridge.openExternal`.)

**CSP:** serve a strict `Content-Security-Policy` via the `app://` handler response headers: `default-src 'self' app:;` + `connect-src` allowing the configured `apiBase`/`wsBase` + `ws(s)`; `style-src 'self' 'unsafe-inline'` (style-loader injects `<style>` tags); `font-src 'self'` (+ Google Fonts host if Ubuntu stays CDN, else self-host); `img-src 'self' data:`. Tune against the actual bundle before locking.

**Custom-protocol safety:** the `app://` handler serves ONLY from the packaged `build/`+`assets/` roots, with path-traversal guards (port `ServeAsset`'s existing `build/chunks`/`assets` root checks). No arbitrary filesystem read.

**Update URL safety:** the renderer can *request* a check (`desktopBridge.checkForUpdate`) but **cannot choose the feed URL** — the channel→feed mapping lives in main. `quitAndInstall` is a main-side action the renderer only *requests*.

**Prohibited patterns (explicit):**
```
Do NOT expose require/fs/path/shell/child_process/ipcRenderer broadly to the renderer.
Do NOT load remote/arbitrary content into the game BrowserWindow (only app:// + the configured server's API/WS).
Do NOT let the renderer choose the update feed URL or run shell commands.
Do NOT let the renderer write desktop config files directly (go through a narrow IPC).
Do NOT disable webSecurity or set allowRunningInsecureContent.
Do NOT ship secrets to the renderer.
Do NOT use a wildcard CORS origin (Access-Control-Allow-Origin: *) — the allowlist is explicit + environment-configured.
Do NOT enable Access-Control-Allow-Credentials unless a flow truly needs cookies (gameplay does not).
Do NOT open admin/auth endpoints to arbitrary origins via CORS.
Do NOT disable webSecurity, contextIsolation, sandbox, or the preload boundary for performance (see §17 — security is not a performance knob).
```

---

## 12. Development workflow

**Rule: additive.** Existing web dev is untouched.

**Keep working (unchanged):**
```
npm run dev:server     # tsx watch src/server/server.ts  (server on :8080)
npm run dev:client     # webpack --watch                 (rebuild build/main.js)
npm run watch:less     # rebuild build/styles.css
npm run build          # make:static + build:server + build:client
npm run lint / test    # unchanged
```

**Add (Electron lane):**
```
npm run electron:build:main   # tsc -p electron/tsconfig.json → build/electron/{main,preload}.js
npm run electron:dev          # electron:build:main, then `electron .` pointing at http://localhost:8080
                              #   (assumes dev:server + dev:client already running; loadURL(devServerOrigin))
npm run build:desktop         # DESKTOP_BUILD=1 npm run build   (publicPath app://bundle/) + electron:build:main
npm run electron:pack         # build:desktop, then electron-builder --win  (NSIS installer)
```

- **Phase-1 dev loads from the dev server** (`loadURL('http://localhost:8080')`), NOT packaged assets — so hot reload of the renderer (`dev:client` webpack watch) + server (`dev:server` tsx watch) works exactly as in a browser; the Electron window just replaces the browser tab. This decouples "prove Electron" from "solve packaging."
- **Debugging:** renderer via the window's DevTools (`webContents.openDevTools()` in dev); main/preload via `--inspect` on the Electron process (or `console.log` in main). tsx enables running `main.ts` without a compile step in dev.
- **Server target selection in dev:** `TM_SERVER_BASE` env (or the session store) sets which server the window points at; defaults to `http://localhost:8080`.
- **Testing both modes:** web via `npm start` + browser; desktop via `npm run electron:dev`. Same renderer, same server.

---

## 13. Build and packaging strategy

**Tooling:** `electron@43.0.0` (devDep) · `electron-builder` (devDep, packaging) · `electron-updater` (dependency, runtime). All three run in a lane separate from webpack/tsc-server/tests → no conflict with the existing toolchain.

**Package contents (thin-client — the recommended shape):** Electron `main.js` + `preload.js` + the static renderer tree (`build/main.js`, `build/vendors.js`, `build/chunks/**`, `build/styles.css`, `assets/**`, `src/genfiles/*` if any are runtime-fetched — locales are already merged into `assets/locales/`). **The server is NOT bundled** → no `better-sqlite3`/`pg`/`ws`/`sharp`, **no native rebuild**. electron-builder `files`/`asarUnpack` scoped to the renderer + `build/electron`; explicitly exclude `src/server`, `optionalDependencies`, and `scripts/`.

> **THIN-CLIENT HARD RULE:** Do **NOT** bundle `src/server`, database drivers, `pg`, `better-sqlite3`, the `ws` server, or any local game server into the Electron MVP. Bundling the server would introduce native modules, database state, port management, update complexity, security complexity, and state-migration problems. The desktop app **connects to the existing server** through REST + WebSocket. (A fully-standalone embedded-server product is a separate, later, deliberately-out-of-MVP option — §9 Option C.)

**Pre-package pipeline (reuse the existing `build`):**
```
DESKTOP_BUILD=1 npm run make:static      # build/styles.css + assets/locales/*.json + genfiles
DESKTOP_BUILD=1 npm run build:client     # webpack with publicPath app://bundle/
npm run electron:build:main              # tsc electron main+preload
electron-builder --win                   # NSIS + latest.yml + .blockmap
```
(The `build:server` step is skipped for the thin client; it is only needed if the embedded-server product is ever chosen.)

**Windows artifact:** `target: nsis` → `<AppName> Setup <version>.exe` + `latest.yml` + `<AppName>-<version>.exe.blockmap` (differential updates). Portable `.exe` as an optional secondary target. Artifact naming: `${productName}-${version}-${os}-${arch}.${ext}`; channels folder-scoped (`/dev`, `/staging`, `/prod`).

**tsconfig for main/preload:** `electron/tsconfig.json` extends root, `module: commonjs`, `target: es2021`, `outDir ../build/electron`, `types:["node","electron"]`, includes only `electron/**/*.ts`, excluded from `webpack.config.js` and `tsconfig.vue-tsc.json`.

**Dep classification (final):**
```
electron          → devDependency   (build/dev only)
electron-builder  → devDependency   (packaging CLI)
electron-updater  → dependency      (imported by the packaged main process at runtime)
```

**Channels:** `dev` (internal, unsigned OK, forced-update on during active dev), `staging`, `prod`. Channel selects the update feed URL + default `serverBase`.

**Signing:** NOT in Phases 1-8. Windows code-signing (EV/OV cert) is a follow-up sub-phase after the updater is functionally proven; macOS signing is §16 (future).

---

## 14. Premium Windows-first auto-update strategy

**Architected now, implemented in Phases 7-8.** The renderer reserves a clean place for the update surface (a `desktopBridge`-gated overlay); nothing ships until the packaged runtime + Windows artifact are proven.

### Server compatibility endpoint (new)
```
GET /api/desktop/version?platform=win32&channel=dev&current=1.3.0
```
```json
{
  "latestVersion": "1.4.0",
  "minSupportedVersion": "1.4.0",
  "serverProtocolVersion": 1,          // mirror REALTIME_PROTOCOL_VERSION so a stale desktop that can't speak the realtime protocol is gated
  "updateRequired": true,
  "channel": "dev",
  "platform": "win32",
  "releaseNotes": ["Desktop shell", "WebSocket realtime", "Premium update screen"]
}
```
- Implemented as a small `Handler` in `requestProcessor.ts` reading a config (env/JSON) for the channel's `latest`/`min`. Public (no token). Additive; browser unaffected.
- `serverProtocolVersion` lets the server force a desktop upgrade when the realtime `Protocol.ts` version bumps (a stale client would otherwise `PROTOCOL_INCOMPATIBLE` on `/ws`).

### Startup flow (main process) — an explicit UPDATE-ONLY BOOT MODE
A mandatory update must block normal app/game flow **before the game runtime is restored**. The main process resolves a startup mode first and only enters normal game flow when compatible:

```ts
type DesktopStartupMode =
  | 'normal'                  // compatible → load normal route / restore last game
  | 'updateRequired'          // load renderer in UPDATE-ONLY mode; do NOT restore game / inject participantId
  | 'offlineBlocked'          // compat check unreachable + no valid last-known-good → blocked with retry
  | 'manualDownloadRequired'; // auto-install unavailable → manual-download fallback screen
```

```
Electron main starts (app.ready)
  → read desktop session (serverBase, channel, current version)
  → GET /api/desktop/version   (compatibility check)
  → if update required (current < minSupportedVersion, or updateRequired=true, or check unreachable while stale):
       startupMode = 'updateRequired' | 'offlineBlocked' | 'manualDownloadRequired'
       loadURL('app://bundle/?desktopBoot=update')   // UPDATE-ONLY renderer route
       inject desktopBridge + update state ONLY
       DO NOT restore last game
       DO NOT inject an active participantId into normal game flow
       (electron-updater.checkForUpdates → 'downloading' progress → 'downloaded' → quitAndInstall)
  → else (compatible):
       startupMode = 'normal'
       load normal route / restore last game (inject apiBase/wsBase/participantId as usual)
```
- **Update-only mode is a hard gate, not a suggestion.** In `updateRequired`/`offlineBlocked`/`manualDownloadRequired` the main process refuses to `loadURL` any game route and never injects an active `participantId`, so the renderer *cannot* enter game flow even if a stale bundle tried to. The renderer surfaces only the premium update UI (§15).
- **Two gates:** the *server* compatibility endpoint (authoritative "you're too old to play") + the *update feed* (electron-updater's own newer-artifact detection). The server gate drives `startupMode`; the feed gate is the delivery.

### Windows-first updater expectations
- **Support the NSIS/`electron-updater` path first** (differential `.blockmap` downloads).
- **Update metadata hosting:** a static `latest.yml` + installer + blockmap per channel dir (internal static host / release bucket). electron-updater polls `latest.yml`.
- **Channels:** dev/staging/prod feed URLs, selected by the packaged channel.
- **Mandatory enforcement:** when `updateRequired` (server) or `current < minSupportedVersion`, the renderer shows the update screen with **no skip/later** and the game flow is blocked (the main process refuses to `loadURL` a game until updated, or the renderer's `desktopMode` guard hides all entry points).
- **Progress → renderer:** `autoUpdater` `download-progress` events → main → `webContents.send('desktop:update-state', {state, percent, …})` → preload `onUpdateState(cb)` → the premium overlay.
- **Errors/retry:** `error` events → state `'error'` with a Retry that re-invokes `checkForUpdate`.
- **Testable without signing (internal only):** check → download → progress → install → relaunch all work with an **unsigned** NSIS build on Windows — enough to validate the update *architecture*. Expect SmartScreen / trust warnings; this is **not** production-quality UX. **Production-quality seamless UX (no warnings, silent update) requires Windows code signing** — a separate later sub-phase.

**macOS updater:** documented only (§16); do not implement.

---

## 15. Update UX requirements

Premium, consistent with the fork's dark-glass + cyan-accent language (mirror the existing modal/overlay chrome). Reserve a clean place now; implement in Phase 7.

```ts
type DesktopUpdateState =
  | 'checking' | 'upToDate' | 'required' | 'available'
  | 'downloading' | 'downloaded' | 'installing'
  | 'error' | 'offlineBlocked' | 'manualDownloadRequired';
```

**Behavior:**
- `required` → a full-screen premium gate BEFORE any game flow; **no skip/later** during active dev; release notes in premium style; a Retry on failed check.
- `downloading` → premium progress bar (percent + bytes/s) driven by `download-progress` IPC.
- `downloaded` → "Restart to update" CTA → `quitAndInstall`.
- `offlineBlocked` → when the compatibility check can't be reached AND the local version is unknown-stale → block with a retry (fail-closed for `required`, fail-open only when a valid last-known-good is cached).
- `manualDownloadRequired` → fallback screen with a `desktopBridge.openExternal(downloadUrl)` when auto-install isn't available (e.g. a build/channel without a feed yet).
- **Browser mode never renders any of this** — the entire surface is gated on `window.desktopBridge?.desktopMode === true`.

Placement: a new App-level component (sibling of the endgame/realtime layers) mounted only when `desktopMode`, driven by a module-reactive `desktopUpdateState` fed from `desktopBridge.onUpdateState`.

---

## 16. macOS scope boundary

**macOS signing/notarization is OUT OF SCOPE for the current Electron migration (Phases 1-8).**

- **Why deferred:** it requires Apple Developer Program enrollment, a Developer ID Application certificate, `.p12` export, and a notarization round-trip — external, paid, identity-gated dependencies that would stall the Windows-first goal and add zero value to Windows testing.
- **Why it must not block Windows:** the main/preload code is cross-platform; only *packaging + updater channel + signing* differ per OS. Nothing in Phases 1-8 touches Apple tooling.
- **Kept architecturally compatible:** electron-builder supports mac targets declaratively; the update architecture (feed + electron-updater) is platform-agnostic; the renderer is identical. A future mac phase adds config, not a redesign.
- **Future macOS task (name it, don't implement):** *"Electron Phase 9 — macOS signing, notarization & auto-update"* — Apple Developer Program, Developer ID Application cert, `.p12`, notarization, `.dmg`/`.zip` artifacts, Gatekeeper UX, mac auto-update channel. Possibly preceded by an unsigned exploratory mac build for smoke-testing only.

---

## 17. Electron Performance Initiative (first-class pillar)

**This is a core product requirement, not polish.** The reason for the desktop app is not only packaging — the Electron client must become a **measurably stronger premium client than the browser**: smoother animations, lower input latency, fewer frame drops, faster screen transitions, and a more stable premium experience. The web/browser app remains fully supported; Electron gets *additional* performance work that is safe and appropriate for a controlled, bundled Chromium runtime.

### Product goal (stated directly)
```
Electron is not just a wrapper around the web app.
Electron is the premium desktop runtime.
The Electron version should eventually OUTPERFORM the browser version in
smoothness, stability, animation consistency, and perceived responsiveness.
```
This never means breaking the browser version. It means:
- shared improvements benefit **both** web and Electron wherever possible;
- Electron-specific optimizations are **gated behind `desktopMode`**;
- every optimization is **measured, not guessed**;
- Chromium/Electron flags are applied **carefully and validated**, never cargo-culted.

> **Hard rule:** *Security settings are not performance knobs.* Do **NOT** disable `webSecurity`, `contextIsolation`, `sandbox`, or the narrow preload boundary for performance.

### Performance audit areas (future phases MUST inspect)
**Renderer:** Vue re-render hot spots; expensive reactive-state updates; the **`playerkey++` remount cost**; board / card / overlay / hover-preview / journal / notification render cost; animation & transition timing; layout thrashing & forced synchronous layout reads; expensive watchers; large computed values; long tasks on the main thread; unnecessary DOM updates; large images / texture memory; costly CSS filters/shadows/backdrops; frequent timers/intervals; large un-virtualized lists; repeated formatting/calculation in templates; unnecessary network refetches; **snapshot-apply cost after a WS invalidation**.
**Electron-specific:** BrowserWindow creation options; Chromium GPU-acceleration behavior; background-throttling policy; frame rate / animation smoothness; image decoding & cache behavior; memory pressure; process model; preload overhead; custom-protocol (`app://`) performance; `app://` asset caching; startup time; cold vs warm boot; the update-screen startup path; bundled Chromium flags **only after profiling**.
**Assets:** size of `main.js` / `vendors.js` / chunks; lazy-chunk loading behavior; CSS size; image sizes; card/tile art compression; fonts & font loading; locale loading; cache headers / `app://` cache behavior; board/tile/card texture sizes; whether some assets should be **preloaded** in Electron.
**Animation (premium flows — special attention):** tile placement; cube/resource movement; energy→heat conversion; overlay open/close transitions; hover previews; endgame reveal; victory animations; realtime waiting indicators; board zoom/scale; action-confirmation modal; card fullscreen preview. Each must be profiled and tuned to minimize frame drops in Electron.

### Performance metrics & budgets (measure first, then set)
No invented final numbers. **Perf Phase 0 measures the baseline; later phases set real budgets from the measurements.** Initial budget shape:
```
Startup:
  Electron cold start → premium menu:  target budget to be measured, then improved.
  Restore last game:                   target budget to be measured, then improved.
Runtime:
  Avoid long tasks > 50 ms during normal interaction where avoidable.
  Critical animations target a stable 60 FPS.
  Click/hover response feels immediate.
  WS invalidation → visible update stays fast without creating UI jank.
  Overlay open/close drops no frames on typical Windows hardware.
  Game-boundary reload resets state cleanly and quickly.
Memory:
  Track renderer memory after entering a game.
  Track memory after several game switches.
  No obvious leaks across reload boundaries.
```

### Instrumentation plan (phased)
Tools / approaches to evaluate: Chromium DevTools Performance panel (in Electron); Electron `contentTracing` for deep traces; `performance.mark` / `performance.measure`; a `PerformanceObserver` long-task observer (if supported in the renderer); memory snapshots over long sessions; a desktop-only build-size report for the renderer chunks; an optional dev-only FPS meter (Electron dev mode).
Custom lightweight marks around: app bootstrap; route apply (`applyRoute`); initial model fetch; player-model apply; **WS invalidation wake** (`realtimeSync` → `waitForUpdate(true)`); overlay open; board-render completion; endgame-overlay mount.
> **Rule:** *Do not optimize blindly.* Every major performance optimization must be motivated by a measured bottleneck or a clearly understood hot path.

### Electron-specific Chromium tuning (controlled)
```
Electron gives us a bundled Chromium runtime we can tune, but flags must be applied carefully.
Do not cargo-cult random Chromium flags.
Do not disable security for performance.
Do not use flags that create instability unless measured and justified.
```
Future investigation (each profiled before applying): GPU / hardware-acceleration status on Windows; whether to set or avoid `app.disableHardwareAcceleration()`; any app-specific command-line switches; background-throttling settings; frame scheduling; image-cache behavior; spellcheck/context-menu overhead if irrelevant; DevTools impact dev-vs-prod; power-usage vs smoothness trade-offs.

### Refactor-for-performance track (separate from Electron plumbing)
Likely deep-refactor candidates — confirm by profiling FIRST: board rendering; card-list rendering; overlay rendering; journal rendering; expensive computed/watch chains; repeated snapshot→view-model transformations; large reactive objects; image-heavy components; layout-forcing animations; over-expensive CSS effects; route/game reload cost; player-model apply/remount cost.
```
Electron Phase 1 should NOT refactor all performance hotspots. First build the shell, then measure, then optimize.
BUT performance optimization is a CORE reason for the Electron project — it has its own phases and acceptance criteria (below).
```

### Performance phases (run ALONGSIDE the main Electron phases, not instead of them)
- **Perf Phase 0 — baseline measurement.** Measure current browser vs the Phase-1 Electron dev shell. Establish startup / route-apply / animation / WS-update / overlay / board-render baselines.
- **Perf Phase 1 — packaged Electron baseline.** Measure the `app://` packaged renderer (after Phase 2A); compare against browser; identify asset / chunk / protocol bottlenecks.
- **Perf Phase 2 — low-risk shared optimizations.** Refactors that improve **both** browser and Electron with no architecture risk.
- **Perf Phase 3 — Electron-specific tuning.** BrowserWindow / Chromium / `app://` cache / preload / asset-preload optimizations (gated by `desktopMode`).
- **Perf Phase 4 — animation & premium-UX smoothness pass.** Focus on frame drops & perceived smoothness in the main premium flows.
- **Perf Phase 5 — performance regression guard.** Repeatable manual/automated checks so jank cannot silently return.

**Mapping to the main phases:** Perf-0 rides Phase 1; Perf-1 rides Phase 2A/2B; Perf-2 is continuous; Perf-3 rides Phase 5; Perf-4 rides Phase 5+; Perf-5 lands with/after Phase 8.

### Performance acceptance criteria
```
Baseline metrics collected BEFORE any optimization.
Electron does not perform worse than browser on the measured critical flows.
Critical premium animations are profiled.
Long tasks are identified and reduced.
Game-boundary reload is measured.
WS invalidation → visual-update path is measured.
Packaged-app startup is measured.
No performance improvement disables security.
No Electron-specific optimization breaks browser mode.
```
**Later target — Electron OUTPERFORMS browser** on the most important perceived-performance flows: startup→menu; restoring a game; opening overlays; board interaction; animations; WS-driven opponent updates; endgame reveal.

---

## 18. Phased migration plan

Each phase is independently shippable and reversible (the web app + server stay green throughout; the Electron lane can be dropped by removing `electron/`, the `main` field, and the desktop scripts). **The Performance phases (§17, Perf-0…5) run in PARALLEL with these — they do not replace them; Perf-0 begins as soon as the Phase-1 dev shell exists.**

### Phase 0 — Feasibility audit & plan (THIS DOCUMENT)
No runtime change. Deliverable: this file. **Done when** committed + linked from the WS plan.

### Phase 1 — Minimal Electron 43 shell (dev, no packaging)
- Add `electron@43.0.0` (devDep), `electron/main.ts` + `electron/preload.ts`, `electron/tsconfig.json`, `electron:dev`/`electron:build:main` scripts.
- Safe BrowserWindow (§11). Preload injects `tmRuntimeConfig` (from `TM_SERVER_BASE` env / default `http://localhost:8080`) + `desktopBridge` stub.
- `loadURL('http://localhost:8080')` against a running `dev:server`+`dev:client`.
- No packaging, no `app://`, no updater, no CORS (same-origin).
- **Done when:** the window opens the premium menu, creates/enters a game, plays a turn, receives WS pushes, falls back to polling, and the web build is untouched. Reversible by deleting `electron/` + scripts.

### Phase 2A — Packaged renderer / `app://` / asset loading
- Register the `app://` standard-scheme protocol; port `ServeAsset.toFile` into the handler (serve `index.html` for any path; map `build/`+`assets/`).
- Env-conditional `publicPath: app://bundle/` for `DESKTOP_BUILD=1` (web build keeps `'/'`).
- Fix the 2 absolute `url(/assets/…)` refs in `DeltaProjectBoard.vue`.
- **Done when (packaged renderer loads from `app://`; connectivity NOT yet changed):**
  - `app://` protocol works;
  - the packaged renderer loads;
  - `main.js`, `vendors.js`, `styles.css` load;
  - every lazy chunk loads (all screens mount);
  - fonts / images / card art / tile art load;
  - locale loading works (`fetch` under `app://`);
  - the **browser build still uses `publicPath: '/'`** (grep the web `main.js`: `__webpack_require__.p === "/"`).
  - *(This phase may still point REST/WS at a same-origin dev server to isolate asset-loading from connectivity.)*

### Phase 2B — Remote API + WS from `app://` / CORS / wrapped fetches
- Wrap the 11 raw API fetches (§7) through `apiUrl()`.
- Inject `apiBase`/`wsBase`/`participantId` via preload (point at a *remote* server).
- Add the safe, allow-listed server-side CORS layer + `OPTIONS` (§10 guardrails).
- **Done when (renderer talks to a cross-origin server from `app://`):**
  - raw API fetches are wrapped through `apiUrl`;
  - `apiBase` / `wsBase` injection works;
  - CORS is configured safely (explicit allowlist, **no wildcard**, no credentials for gameplay);
  - REST and WS work cross-origin from `app://`;
  - **the actual `Origin` header sent by Electron `app://` fetches is inspected empirically and documented** (§10 — do not assume it);
  - browser mode remains unchanged (same-origin, no CORS round-trip).

### Phase 3 — Identity & game restore
- Desktop session store (`serverBase`, `lastParticipantId`, `channel`). Restore-last-game on launch. Enter/leave/switch via renderer reload of `app://bundle/<path>?id=…`.
- Verify no stale per-game singleton survives a boundary (reload wipes them — §8).
- **Done when:** restore/enter/leave/switch work with clean state and preserved identity; browser URL identity unchanged.

### Phase 4 — REST + WS full smoke (Windows manual)
- Player + spectator modes; realtime connected; polling fallback; reconnect/resume; the flag ladder still reachable (localStorage/desktopBridge). Desktop debug affordance for WS health.
- **Done when:** the Windows smoke matrix (§20) passes end-to-end against dev + a staging server.

### Phase 5 — Windows desktop UX shell
- Premium loading screen, optional server selector, connection-state indicator, native app menu, external-link handling (`shell.openExternal`), error states, window polish (`setAppUserModelId`, icon, single-instance lock).

### Phase 6 — Windows build artifact
- `electron-builder` (devDep) NSIS target, artifact naming, channel metadata, `latest.yml`/blockmap emission, optional CI packaging job. Unsigned dev builds.

### Phase 7 — Windows-first update infrastructure
- `GET /api/desktop/version` (server), `electron-updater` (dependency), version gate, premium update overlay + progress, update-metadata hosting, updater IPC bridge. Mandatory-update enforcement.

### Phase 8 — Windows updater hardening
- Download progress fidelity, restart/install flow, failure recovery/retry, forced-update behavior, dev/staging/prod channels, offline/`manualDownloadRequired` states. Browser unaffected.

### Phase 9 — macOS signing/notarization (FUTURE, separate initiative)
Do not include in Phases 1-8.

*(Order preserved: prove runtime → packaging → identity → smoke → UX → artifact → updater → hardening → macOS.)*

---

## 19. Risk register

| # | Risk | Sev | Likelihood | Mitigation | Test coverage | Rollback |
|---|---|---|---|---|---|---|
| R1 | **Web regression** from touching shared client (fetch-wrap, publicPath) | High | Low | Env-conditional publicPath; `apiUrl('')` is identity when `apiBase=''`; wrapping is behavior-preserving | §5 browser smoke after every phase; `runtimeConfig.spec.ts` green | Revert the client commit; server/web unaffected |
| R2 | **Code-split chunks 404 under packaging** (`publicPath:'/'`) | High | High if `file://` | Choose `app://` (Opt B) + `DESKTOP_BUILD` publicPath; dev uses `loadURL(server)` | Phase-2A done-criteria (every screen chunk loads) | Fall back to `loadURL(server)` (Phase-1 mode) |
| R3 | **Cross-origin CORS block** (no server CORS today) | High | High (packaged) | Additive **allow-listed** (no-wildcard) Origin-reflecting CORS + `OPTIONS` in `responses.ts`/`Handler.ts`; verify the real `Origin` empirically | Phase-2B/4 smoke; unit test the CORS branch | Feature-flag the CORS layer off; use dev same-origin mode |
| R4 | **Electron 43 incompatibility** | Low | Very low | Additive lane; deps verified (§2) | `electron:dev` launches | Uninstall electron; lane is isolated |
| R5 | **Windows packaging issue** (electron-builder config) | Med | Med | Scope `files` to renderer+main; exclude server natives | Phase-6 artifact runs on a clean Windows box | Ship dev `loadURL` build; fix config |
| R6 | **Windows updater issue** (feed/blockmap) | Med | Med | Validate against a static feed; unsigned-OK | Phase-7/8 update matrix | Disable auto-update; manual-download fallback |
| R7 | **SmartScreen / unsigned warning** confuses testers | Low | High (unsigned) | Document the expected warning; sign later | Manual note in Windows smoke | N/A (cosmetic) |
| R8 | **Asset path breakage** (2 abs `url(/assets/…)`, dir split) | Med | Med | `app://` handler flattens both dirs; fix the 2 Delta refs | Phase-2A (Delta board renders) | `loadURL(server)` mode |
| R9 | **Stale per-game singleton state** across boundary | Med | Low (reload keeps it clean) | Keep reload-based boundary; do NOT go in-app | Phase-3 (state clean after switch) | N/A (reload is the safe default) |
| R10 | **Identity mismatch** (wrong `?id=` injected) | Med | Low | Session store is the single source; `identitySearch` audited | Phase-3/4 | Re-inject; renderer reload |
| R11 | **WebSocket URL mismatch** (wsBase derived from `app:`) | Med | High if not injected | Always inject explicit `wsBase` | Phase-4 (WS connects) | Polling fallback still works |
| R12 | **CORS/origin edge cases** (preflight, credentials) | Med | Med | Token auth → no credentials needed; allowlist origins | CORS unit + Phase-4 | Disable CORS layer |
| R13 | **Insecure preload** (over-broad bridge) | High | Low | Narrow `contextBridge` only; no `require`/`ipcRenderer` raw (§11) | Security review of preload | Restrict the bridge |
| R14 | **Renderer accidentally depends on Node** | Low | Very low | Verified zero Node imports in `src/client`; sandbox:true | vue-tsc + runtime | Keep sandbox on |
| R15 | **Production build differences** (desktop vs web) | Med | Low | Env-conditional only on publicPath; same source | Both builds in CI | Web build is independent |
| R16 | **Updater version mismatch** (server gate vs feed) | Med | Med | `serverProtocolVersion` mirrors `REALTIME_PROTOCOL_VERSION`; two-gate design | Phase-7 matrix | Loosen the gate; manual download |
| R17 | **Broken mandatory-update gate** (bypassable) | High | Low | Gate in main (refuse game loadURL) + renderer guard | Phase-7/8 | Server can drop `updateRequired` |
| R18 | **Progress events not reaching premium UI** | Med | Med | IPC contract (`onUpdateState`) tested; module-reactive state | Phase-7/8 | Fallback to indeterminate spinner |
| R19 | **Auto-update unavailable in unsigned/dev** | Med | Med | `manualDownloadRequired` fallback screen | Phase-8 | Manual download link |
| R20 | **macOS signing blocks Windows progress** | High | Low | Explicit §16 boundary; Phases 1-8 touch no Apple tooling | N/A | N/A |
| R21 | **Multi-dyno expectations** (per-process WS rooms + in-mem cache) | Med | Low | Single-instance topology documented (WS §G.6); client reaches the exact server | N/A | Single server |
| R22 | **Legacy pages** (`/the-end`, admin, cards, help) under Electron | Low | Low | `app://` serves them like the browser; admin/auth out of desktop scope | Phase-2A route check | N/A |
| R23 | **Spectator endgame** in-app gap (WS deferred item) | Low | Low | Spectator uses the same reload flow; endgame link intact | Phase-4 spectator smoke | N/A |
| R24 | **`fetch(file://)` blocked** (locales) | Med | High if `file://` | `app://` registered `supportFetchAPI`; ship locales locally | Phase-2A (locale switch works) | Degrades to English |
| R25 | **HTTPS/`wss://` needs upstream TLS** | Med | Med | Terminate TLS at proxy / set cert paths; inject `wss` base | Phase-4 against staging | Use `ws://` to a local/dev server |
| R26 | **`better-sqlite3` native ABI** (only if server embedded) | Med | Low (thin client) | Thin client ships no server/DB; if embedded use LocalFilesystem or `@electron/rebuild` | Phase-6 packaging | Don't embed the server |

**Performance risks (the §17 pillar):**

| # | Risk | Sev | Likelihood | Mitigation | Measurement / test | Rollback |
|---|---|---|---|---|---|---|
| RP1 | **Packaged Electron slower than browser** | High | Med | Perf-0/1 baselines; `app://` caching + asset preload; profile before shipping | Perf Phase 0/1 measurements | Ship `loadURL(server)` mode (no `app://` asset cost) |
| RP2 | **`app://` asset loading adds latency** | Med | Med | Stream + cache headers in the protocol handler; measure vs http | Perf-1 asset trace | Fall back to localhost/embedded-server load |
| RP3 | **Excessive bundle / chunk cost** | Med | Med | Desktop build-size report; desktop-only preload of hot chunks if measured worthwhile | Perf-1 build-size + chunk-load trace | Keep current lazy loading |
| RP4 | **GPU acceleration inconsistent on Windows hardware** | Med | Med | Profile GPU status; decide `disableHardwareAcceleration` **per measurement**, not by guess | Perf-3 GPU trace on target HW | Toggle the HW-accel setting |
| RP5 | **Expensive CSS effects (filters/shadows/backdrops) drop frames** | Med | Med | Profile the premium flows; gate the heaviest effects behind `desktopMode` tuning | Perf-4 animation profile | Reduce/disable the specific effect |
| RP6 | **Vue reactive churn during model updates** | Med | Med | Profile snapshot-apply + `playerkey++`; targeted memoization / shallow reactivity | Perf-2 render trace | Revert the specific optimization |
| RP7 | **`playerkey++` remount jank** | Med | Med | Measure remount cost; optimize only with a trace (shared web+Electron benefit) | Perf-0/2 remount measurement | Keep the current remount |
| RP8 | **Updater screen slows startup** | Low | Med | Update check is async; render the gate fast; time-box the check | Perf-1 startup trace incl. update path | Shorten/skip the check timeout |
| RP9 | **Excessive preload/main IPC** | Low | Low | Keep the bridge narrow; batch IPC; no per-frame IPC | Perf-3 IPC trace | Reduce the IPC surface |
| RP10 | **Memory growth over long sessions / many game switches** | Med | Med | Memory snapshots; verify the reload boundary frees state; watch module singletons | Perf-0/5 memory tracking | Reload clears state (already the boundary) |
| RP11 | **A performance optimization breaks browser mode** | High | Med | `desktopMode`-gate Electron-only tweaks; shared changes must pass the §5 browser smoke | §5 smoke + Perf-5 regression guard | Revert; re-gate behind `desktopMode` |
| RP12 | **Unsafe Chromium flags / guess-based optimization** | Med | Med | No flag without a trace; never disable security; document each flag's measured effect | Perf-3 before/after trace | Remove the flag |

---

## 20. Acceptance criteria

### Prerequisites to START implementation (Phase 0 → 1)
- Plan committed + linked from `WEBSOCKET_MIGRATION_PLAN.md`.
- `npm run build` + `npm start` produce a working web app (browser smoke, §5).
- Confirmed Electron is a devDep-only addition (no lock conflict).

### Browser (must hold after EVERY Electron phase)
```
npm run build passes.
Browser /player?id= still works.
Browser /spectator?id= still works.
Browser /game?id= still works.
Browser /the-end?id= still works.
Browser WS default ON still works (opponent turn appears live).
Browser ?realtime=0 fallback still works (polling).
Server REALTIME_ENABLED=0 → byte-identical legacy polling.
Premium overlays are not regressed.
Direct links still restore the game.
Browser does NOT load any desktop updater UI.
webpack publicPath is '/' for the web build (grep the built main.js: __webpack_require__.p === "/").
```

### Electron Phase 1
```
electron@43.0.0 installed & pinned; `electron` still 0× in the web build path.
App opens the premium main menu on Windows dev (loadURL http://localhost:8080).
BrowserWindow: contextIsolation:true, nodeIntegration:false, sandbox:true.
Preload exposes ONLY tmRuntimeConfig + a narrow desktopBridge.
Renderer receives tmRuntimeConfig (apiBase/wsBase/participantId).
App connects to the configured server; can create + enter a game.
App receives GAME_STATE_INVALIDATED (WS) and refreshes via the guarded path (no raw playerkey++).
App falls back to polling when WS is off.
App reloads the renderer cleanly on enter/leave/switch (no stale overlay/state).
Web build behaves unchanged (browser smoke passes).
```

### Windows updater phase (7-8)
```
Desktop app calls GET /api/desktop/version on startup.
current < minSupportedVersion → mandatory update screen BEFORE game flow (no skip/later).
electron-updater discovers latest.yml on the channel feed.
Download progress shown in the premium UI (percent).
Restart/install flow (quitAndInstall) works and relaunches.
Error → premium error state + Retry.
offlineBlocked / manualDownloadRequired states behave.
Windows update metadata (latest.yml + blockmap hosting) documented.
Browser mode shows NO updater UI.
macOS signing/notarization NOT required for this phase.
```

### Electron performance (the §17 pillar — full criteria there)
```
Baseline metrics collected BEFORE any optimization (Perf Phase 0).
Electron does not perform worse than browser on the measured critical flows.
Critical premium animations profiled; long tasks identified + reduced.
Game-boundary reload + WS-invalidation→visual-update path + packaged startup all measured.
No performance improvement disables security; no Electron-only optimization breaks browser mode.
Later target: Electron OUTPERFORMS browser on startup→menu, restore-game, overlays,
board interaction, animations, WS opponent updates, and endgame reveal.
```

---

## 21. What should NOT be done yet

- No command-transport rewrite; commands still POST `player/input` (WS is invalidation-only, per the WS plan).
- No WebSocket command submission.
- No removal of browser URLs (`/player`, `/spectator`, `/game`, `/the-end`).
- No removal of polling fallback or the §L flag ladder.
- No in-app game boundary; **no `resetGameSessionState()` refactor** — keep the reload boundary (§8).
- No broad Node access in the renderer; keep `sandbox:true` + a narrow preload.
- No desktop updater implementation before the packaged runtime + Windows artifact are proven (Phases 2 & 6 precede 7).
- No macOS signing / notarization / Apple Developer Program / Developer ID / `.p12` / mac production auto-update.
- No legacy deletion (`GameEnd.vue`/`the-end`, `LogPanel`, admin remain).
- No change that makes the **web app depend on Electron** (`tmRuntimeConfig` stays optional).
- No embedding of the server/DB into the desktop package in the thin-client phases (avoids native rebuild).
- Do not switch the Electron main/preload compile to `ts-patch`/`ttsc` (the inert `transformer-module` plugin would fail to resolve).
- **No blind / speculative performance optimization** — measure first (Perf Phase 0). Electron Phase 1 does **not** refactor performance hotspots; §17 phases own that.
- **No Chromium flags or `app.disableHardwareAcceleration()` without a profiling trace**, and never disable `webSecurity`/`contextIsolation`/`sandbox`/the preload boundary for performance (§17).
- No Electron-only performance change that isn't `desktopMode`-gated (or proven to also help — and not regress — browser mode).

---

## 22. Files likely to change later (do NOT modify yet)

**Electron main/preload (new):**
- `electron/main.ts`, `electron/preload.ts`, `electron/tsconfig.json`, `electron/protocol.ts` (the `app://` handler porting `ServeAsset.toFile`), `electron/session.ts` (desktop store), `electron/updater.ts`.
- `electron-builder.yml` (or a `build` key strategy), icons under `assets/`.

**Windows build config:**
- `package.json` — add `"main"`, `electron:*` scripts, `electron`/`electron-builder` (devDeps), `electron-updater` (dep). `.npmrc` if native rebuild is ever needed (not in thin client).

**Runtime config / fetch routing (ADAPTER):**
- `src/client/utils/runtimeConfig.ts` (extend if a route/screen injection is added).
- The 11 raw-fetch sites: `GamesOverview.vue`, `admin/GameOverview.vue`, `LoginHome.vue`, `CreateGameForm.vue`, `PremiumCreateGame.vue`, `LoadGameForm.vue`, `JoinGameCard.vue`.
- `src/client/main.ts:35` (locale fetch).

**Asset loading:**
- `webpack.config.js:107` (env-conditional publicPath).
- `src/client/components/delta/DeltaProjectBoard.vue:376,402` (2 absolute `url(/assets/…)`).
- `src/server/routes/ContentType.ts` (extend MIME map if new asset types are served via `app://`).

**Server (cross-origin support + updater endpoint):**
- `src/server/server/responses.ts` + `src/server/routes/Handler.ts` (CORS + `OPTIONS`).
- `src/server/server/requestProcessor.ts` + a new `src/server/routes/ApiDesktopVersion.ts` + `src/common/app/paths.ts` (the `/api/desktop/version` route).
- `src/server/server/realtime/RealtimeServer.ts` (optional Origin allowlist — hardening only).

**Navigation/identity (only if the reload boundary is ever revisited — deferred):**
- `src/client/components/App.vue` (`applyRoute`/`getLastPathSegment`), the nav sites in §7 — **left alone for the desktop MVP.**

**Premium update UI (new):**
- `src/client/components/desktop/DesktopUpdateOverlay.vue`, `desktopUpdateState.ts`, wired into `App.vue` gated on `desktopMode`.

**Tests:**
- `tests/realtime/runtimeConfig.spec.ts` (keep green when extending the seam).
- New: `tests/electron/protocol.spec.ts` (the `app://` mapping), `tests/server/ApiDesktopVersion.spec.ts`, `tests/server/cors.spec.ts`.

**Performance / instrumentation (§17 — measure-first, mostly NEW, shared web+Electron where safe):**
- New: a small `src/client/utils/perfMarks.ts` (thin `performance.mark`/`measure` wrappers) + optional dev-only FPS meter; instrument points in `App.vue` (bootstrap / `applyRoute` / model-apply), `realtimeSync.ts` → `WaitingFor.waitForUpdate(true)` (WS-wake), overlay mounts, `Board.vue` render completion, `EndgameExperience` mount.
- Electron-side: `electron/main.ts` (BrowserWindow perf options, optional Chromium switches **after profiling**, `contentTracing`), `electron/protocol.ts` (`app://` cache headers/streaming).
- Likely profiling-driven refactor candidates (confirm with a trace first): `Board.vue`, played-cards/journal/effects/actions overlays, snapshot→view-model transforms, the `playerkey++` remount path. **Do not touch until §17 Perf-0/1 identifies the bottleneck.**
- A desktop renderer build-size report (Perf-1).

**Docs:**
- This file; a one-line pointer added to `WEBSOCKET_MIGRATION_PLAN.md`.

---

## 23. First implementation PR proposal

**Title:** `Electron 43 Phase 1 — minimal safe Windows desktop shell (dev loadURL, no packaging)`

**Includes (minimum to prove the runtime):**
- `electron@43.0.0` as a devDependency (pinned).
- `electron/main.ts` — app lifecycle, single-instance lock, `setAppUserModelId`, a safe `BrowserWindow` (`contextIsolation:true`, `nodeIntegration:false`, `sandbox:true`, preload), `loadURL(process.env.TM_SERVER_BASE ?? 'http://localhost:8080')`, external-link handler, dev DevTools.
- `electron/preload.ts` — `contextBridge` injecting `window.tmRuntimeConfig = {apiBase, wsBase, participantId}` (from env for now) + a stub `window.desktopBridge = {desktopMode:true, getVersion, openExternal}`.
- `electron/tsconfig.json` — extends root, CJS, `outDir build/electron`.
- `package.json` — `electron:build:main` + `electron:dev` scripts (no `"main"` change that affects the web build; the field, if added, points at `build/electron/main.js` and is irrelevant to `npm start`).
- A short `electron/README.md` documenting the dev flow.

**Explicitly excludes:** `app://` protocol, packaging/electron-builder, production auto-update, signing/notarization (any OS), CORS changes, command rewrite, game-boundary reset rewrite, legacy deletion, publicPath changes, fetch-wrapping.

**Proves:** Electron 43 launches on Windows; a safe BrowserWindow loads the existing renderer from a running dev server; the preload bridge injects runtime config; REST + WS + polling all work; the web build is untouched (no file the browser build depends on is modified beyond additive scripts).

**Reversible:** delete `electron/` + the two scripts.

---

## 24. Final recommendation

- **Proceed.** The codebase is well-positioned: an Electron config seam already exists and is tested, the renderer is browser-clean, the realtime layer is transport-agnostic, and the game-boundary reload is exactly the reset strategy a desktop shell wants.
- **Electron 43.0.0 is viable** with zero code-level blockers — it is an additive devDep lane running on Electron's *own* bundled runtime (independent of the server's Node 22), with a browser-clean renderer.
- **Windows-first is viable** — NSIS + `electron-updater` + a premium mandatory-update UX need no Apple tooling.
- **First PR:** *Electron 43 Phase 1 — minimal safe Windows desktop shell* (§23): a dev-mode `loadURL(serverOrigin)` window that proves the runtime with no packaging and no renderer refactor.
- **Must be tested manually on Windows** (each phase): launch, menu, create/enter/leave/switch a game, WS live update, polling fallback, reconnect/resume, spectator, endgame, and — from Phase 7 — the mandatory-update gate + download progress + restart-install (unsigned OK).
- **Intentionally deferred:** the SPA game-boundary (`resetGameSessionState()`), idempotency (`commandId`), in-app spectator endgame, admin/auth-in-desktop, Redis multi-dyno, and command-over-WS — all inherited from the WS plan's deferred set.
- **The future macOS effort is named but NOT implemented now:** *"Electron Phase 9 — macOS signing, notarization & auto-update"* (Apple Developer Program, Developer ID Application cert, `.p12`, notarization, `.dmg`/`.zip`, Gatekeeper, mac update channel).
- **Performance is a PARALLEL first-class initiative (§17), not an afterthought.** Perf-0 baselines start beside Phase 1; the desktop runtime must become **measurably smoother than the browser** on the flows that matter (startup→menu, game restore, overlays, board interaction, premium animations, WS-driven opponent updates, endgame reveal). Every optimization is measured, none disables security, none breaks browser mode; Electron-only tweaks are `desktopMode`-gated.

**Two shells, one premium runtime:** the browser and Electron are two thin shells over the same reused game client + the same server-authoritative REST + WebSocket protocol. The desktop shell adds packaging, identity injection, a reload-based game boundary, and a premium Windows updater — nothing about game authority or the realtime protocol changes.

---

**Bottom line.**
```
Proceed with Electron Phase 1, but treat performance as a parallel first-class initiative.

The first implementation PR remains minimal:
  Electron 43 dev shell only.

But the overall Electron project goal is larger:
  Windows-first premium desktop client,
  safe web compatibility,
  premium updater,
  and a desktop runtime that is measurably smoother and more optimized than the browser version.
```
