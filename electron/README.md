# Electron desktop shell — Phases 1 + 2A (dev)

Minimal, safe Electron 43 desktop shell over the **existing web client**. It has two
load modes; both use the same safe window + preload:

- **Phase 1 — `server` mode (default):** loads the client from a **running dev server**
  (`http://localhost:8080`). Same-origin, zero adapters. Proves the runtime.
- **Phase 2A — `app://` mode:** loads the **packaged static renderer** through a custom
  `app://` protocol (`electron/protocol.ts`). Proves packaged asset loading. REST/WS
  still target the dev server (cross-origin CORS is Phase 2B — not done yet).

The desktop app is a **thin client** — it does not bundle the game server or database.
It connects to the existing server over REST + WebSocket, exactly like the browser.

## Prerequisites

```bash
npm install            # includes electron@43.0.0 (pinned devDependency)
```

## Phase 1 — run against the dev server (three terminals)

```bash
# 1. the game server (REST + WebSocket, port 8080)
npm run dev:server

# 2. the client bundle (webpack --watch → build/main.js, build/chunks/*, …)
npm run dev:client

# 3. the Electron window (compiles electron/ then launches, pointing at the dev server)
npm run electron:dev
```

`electron:dev` runs `electron:build:main` (`tsc -p electron/tsconfig.json` →
`build/electron/{main,preload}.js`) and then `electron build/electron/main.js`.

The window opens the premium main menu from `http://localhost:8080`, exactly as a
browser tab would. Create/enter a game, and WebSocket realtime + polling fallback work
unchanged (same-origin — no adapters).

## Phase 2A — run the packaged renderer over `app://`

```bash
# 1. the game server (still needed for REST/WS)
npm run dev:server

# 2. build the DESKTOP renderer + launch Electron in app:// mode
npm run electron:desktop
```

`build:desktop` runs `make:static` + `DESKTOP_BUILD=1 build:client` (webpack with
`publicPath: 'app://bundle/'`, emitting to a **separate `build-desktop/`** so the web
`build/` is never touched) + `electron:build:main`. `electron:desktop` then launches
with `TM_ELECTRON_LOAD=app`.

The `app://` handler serves: JS/chunks from `build-desktop/`, `styles.css` from
`build/`, and `index.html` / fonts / card+tile art / locales / favicon from `assets/`;
any extensionless path (an SPA route like `/player`) serves `index.html`.

**What Phase 2A proves:** the packaged renderer boots from `app://`, `main.js` /
`vendors.js` / `styles.css` / every lazy chunk / fonts / images / art / locales all
load, and screens mount. **Known (awaiting Phase 2B):** REST calls from the `app://`
origin to the dev server are cross-origin and are CORS-blocked until Phase 2B adds a
server-side allowlist; WebSocket (no preflight) may connect. So the menu renders and
chunks load, but completing an API round-trip (e.g. the games list, entering a game) is
a Phase 2B milestone.

You can force `app://` mode on an already-built desktop bundle with
`TM_ELECTRON_LOAD=app electron build/electron/main.js`.

## Configuration (env vars)

| Env var | Default | Purpose |
|---|---|---|
| `TM_ELECTRON_LOAD` | `server` | `server` = Phase 1 (loadURL the dev server). `app` = Phase 2A (loadURL `app://bundle/`, packaged renderer). `electron:desktop` sets `app`. |
| `TM_SERVER_BASE` | dev `http://localhost:8080`; **packaged `https://terraforming-mars-vize-edition-63e52431d8db.herokuapp.com`** | Server origin the renderer's REST + WS talk to. Injected into `window.tmRuntimeConfig` (`apiBase`, and `wsBase` derived as `ws(s)://…`). A packaged build defaults to the hosted server; a dev run to localhost. In `server` mode it is also the URL the window loads. |
| `TM_PARTICIPANT_ID` | — | Optional. If set, the window opens directly at the `player?id=<id>` route (direct-game testing) and injects it as `tmRuntimeConfig.participantId`. |
| `TM_ELECTRON_DEVTOOLS` | — | `=1` opens detached DevTools (renderer profiling / debugging). |
| `TM_ELECTRON_WINDOWED` | — | `=1` runs in a normal resizable window instead of the default **fullscreen** (handy for development). The app is fullscreen-only by default and re-enters fullscreen if it's ever exited. |
| `TM_ELECTRON_AFFINITY` | `auto` (win32) | CPU-affinity pinning for the main + renderer processes. `auto` (default) auto-detects an Intel HYBRID CPU (P-cores + E-cores) and pins to the **P-cores** — keeps the layout-bound renderer main thread on the fast cores instead of the weak E-cores (the "same code, worse than the console" gap). No-op on a uniform CPU / non-hybrid. `off`/`normal` = leave the OS scheduler. An explicit `0xfff` / `4095` mask forces that affinity (unusual topology). Windows-only. See `perf.ts` `pCoreAffinityMask`. |
| `TM_ELECTRON_PRIORITY` | `high` (win32) | Windows process-priority class for the main + renderer processes. `high` (default) = HIGH — most aggressively keeps the renderer's main thread on the performance cores at boost clocks and opts it out of EcoQoS/E-core parking (the fix for "smooth on the console, janky on a hybrid laptop" under a light GPU load); can in theory starve OS/audio threads, dial back if glitches appear. `above` = ABOVE_NORMAL (calmer, no starvation risk). `normal`/`off` = leave the OS default (baseline). No-op on Linux/SteamOS (gamescope owns scheduling). See `perf.ts` `processPriorityPref`. |
| `TM_ELECTRON_NO_PERF` | — | `=1` skips ALL performance tuning (vanilla-Electron baseline for "is it our switches?" comparisons). See `perf.ts`. |
| `TM_ELECTRON_SOFTWARE` | — | `=1` forces the SOFTWARE rendering path (`--disable-gpu` + parallel raster threads). The rollback if the Steam Deck's GPU/Vulkan default misbehaves; also a Windows diagnostic. |
| `TM_ELECTRON_FEATURES` | platform default | REPLACES the default `--enable-features` list (Windows default: `SkiaGraphite,SkiaGraphitePrecompilation,DXGIWaitableSwapChain:…`). `none`/`off` = no list at all — the Graphite rollback. |
| `TM_ELECTRON_SWITCHES` | — | Semicolon-separated raw Chromium switches (`key` or `key=value`), appended LAST so they override same-key defaults. E.g. `skia-graphite-dawn-backend=d3d12` (re-test D3D12 against the pinned D3D11 Graphite backend), `disable-direct-composition`, `use-angle=d3d9`, `js-flags=--max-old-space-size=1024`, `ozone-platform=wayland;use-angle=vulkan` (a GL/display key on Linux also skips the default `--disable-gpu`). Replaces the retired per-knob env vars. |
| `TM_UPDATE_CHANNEL` | `latest` | Update channel (dev/staging/prod/latest) — selects the feed `<channel>.yml` and is sent to the compatibility gate as `?channel=`. |
| `TM_DESKTOP_STRICT_OFFLINE` | — | `=1` blocks the app when compatibility was **never** verified and the server is unreachable (default fails open so a first-run offline launch isn't bricked). A known-outdated client (last check said "update required") is always blocked offline regardless. |

### Server-side CORS (Phase 2B — set on the SERVER process, not Electron)

| Env var | Default | Purpose |
|---|---|---|
| `TM_DESKTOP_ALLOWED_ORIGINS` | `app://bundle` | Comma-separated allowlist of origins permitted to make cross-origin game-runtime calls. The desktop shell's `app://` origin is allowed by default; override/extend after confirming the real value. **Never a wildcard.** |
| `TM_CORS_LOG_ORIGINS` | — | `=1` logs the exact `Origin` of every in-scope cross-origin request (allowed or not) — use it once to positively confirm what the packaged renderer sends. |

### Server-side desktop update gate (Phase 7 — set on the SERVER process)

Drives `GET /api/desktop/version` (the authoritative "must update" gate). All optional;
defaults never force an update.

| Env var | Default | Purpose |
|---|---|---|
| `TM_DESKTOP_LATEST_VERSION` | `1.0.0` | Newest desktop version. |
| `TM_DESKTOP_MIN_VERSION` | `0.0.0` | Oldest version still allowed to play (below → mandatory update). |
| `TM_DESKTOP_FORCE_UPDATE` | — | `=1` forces every client to update. |
| `TM_DESKTOP_CHANNEL` | `latest` | Update channel label. |
| `TM_DESKTOP_DOWNLOAD_URL` | — | Installer URL for the manual-download fallback. |
| `TM_DESKTOP_RELEASE_NOTES` | — | JSON string array of release notes. |

Example (bash):

```bash
TM_SERVER_BASE=http://localhost:8080 TM_ELECTRON_DEVTOOLS=1 npm run electron:dev
```

### Steam launch options (`--tm-*` flags — convenient toggling)

On Windows, Steam passes a Non-Steam game's **Launch Options** as command-line
ARGUMENTS, not env vars (`VAR=value %command%` only works on Linux). So the
diagnostic escape hatches are ALSO reachable via `--tm-*` argv flags, folded onto
the matching `TM_ELECTRON_*` env var before anything reads them (`perf.ts`
`parseCliEnvOverrides`, applied in `main.ts`). This is the convenient way to
toggle them per-launch — set them in **Steam → the game → Properties → Launch
Options**, clear the field to remove; no `setx`, no Steam restart, no registry.

| Launch option | Same as env | Purpose |
|---|---|---|
| `--tm-switches=show-fps-counter` | `TM_ELECTRON_SWITCHES` | on-screen FPS counter (no DevTools) |
| `--tm-switches="disable-frame-rate-limit;disable-gpu-vsync"` | `TM_ELECTRON_SWITCHES` | multiple raw Chromium switches (`;`-separated, quoted) |
| `--tm-features=none` | `TM_ELECTRON_FEATURES` | replace/disable the enable-features list |
| `--tm-priority=above` | `TM_ELECTRON_PRIORITY` | dial the priority class back from the `high` default |
| `--tm-affinity=off` | `TM_ELECTRON_AFFINITY` | disable P-core pinning (rollback) — or `0xfff` to force a mask |
| `--tm-software` | `TM_ELECTRON_SOFTWARE=1` | force the software render path |
| `--tm-no-perf` | `TM_ELECTRON_NO_PERF=1` | vanilla-Electron baseline |
| `--tm-devtools` | `TM_ELECTRON_DEVTOOLS=1` | auto-open DevTools |
| `--tm-windowed` | `TM_ELECTRON_WINDOWED=1` | windowed instead of fullscreen |

Value flags take `=value`; boolean flags are presence-on. A launch option WINS
over an unset/stale env var. Verify what took effect via the renderer-console
`[TM perf]` echo (its `switches` array). Example Launch Options field:
`--tm-switches=show-fps-counter`.

**Verify the app:// Origin empirically:** run the server with `TM_CORS_LOG_ORIGINS=1`
and `npm run electron:desktop`. The server logs each cross-origin API call's `Origin`.
If it isn't `app://bundle`, add the logged value to `TM_DESKTOP_ALLOWED_ORIGINS`. A
blocked in-scope origin also logs a `[cors] blocked … Origin="…"` warning even without
the flag.

## Build outputs

- Web build (`npm run build:client`) → `build/` with `publicPath: '/'` — **unchanged**.
- Desktop build (`npm run build:desktop`, i.e. `DESKTOP_BUILD=1`) → **`build-desktop/`**
  with `publicPath: 'app://bundle/'`. The two never collide, so a desktop build cannot
  regress the web bundle. `styles.css` (from `make:css`) stays in `build/` and is shared.

## Packaging — Velopack (Windows Setup.exe + Linux AppImage)

electron-builder now produces ONLY the unpacked app DIRECTORY (`--dir`); **Velopack** (`velopack`
npm 1.2.0 + the `vpk` .NET tool) turns that directory into the installer + self-updating packages
(full/delta `.nupkg`). No NSIS, no electron-updater feed — Velopack owns delivery (see `update.ts`
+ `.github/workflows/release.yml`). Squirrel-style: per-user install to `%LocalAppData%`, no admin,
fast in-place delta apply on restart.

```bash
npm run electron:pack:dir   # build:desktop + electron-builder --dir → dist-desktop/<host>-unpacked/ (fast sanity check)
npm run pack:dir:win        # → dist-desktop/win-unpacked/   (input to `vpk pack … --mainExe "Terraforming Mars.exe"`)
npm run pack:dir:linux      # → dist-desktop/linux-unpacked/ (input to `vpk pack … --mainExe terraforming-mars`)
```

`vpk` is a **.NET global tool** (`dotnet tool install -g vpk --version 1.2.0`) — packing/publishing
(`vpk download github` → `vpk pack` → `vpk upload github`) runs in CI. All scripts `rimraf
dist-desktop/` first; `electronDist: node_modules/electron/dist` packages the already-unpacked
Electron runtime instead of re-extracting the zip, sidestepping the flaky Windows
`EPERM: … rename 'win-unpacked.tmp' -> 'win-unpacked'` (a scanner/indexer briefly locking the
freshly-extracted binaries). Same pinned version → identical artifact, built reliably.

Config: `electron-builder.yml`. The velopack runtime ships in the asar; its native `.node` is
`asarUnpack`ed to `app.asar.unpacked/` (native modules can't load from inside an asar). A packaged
build (`app.isPackaged`) **auto-uses `app://` mode** — no env needed. Code signing is out of scope
for now (unsigned; Windows SmartScreen warns).

The package is a **thin client**: the asar contains only `build/electron/`,
`build-desktop/`, `build/styles.css`, `assets/**` and `package.json` — **no
`node_modules`, no server, no native modules** (`npmRebuild: false` skips the
server-only `better-sqlite3`). The `app://` handler resolves its roots from
`__dirname` inside the asar, so it works packaged with no code change.

**Unsigned (Phase 6):** no code-signing certificate is configured, so Windows
SmartScreen will warn on first run and the installer is not trusted. This is fine for
internal testing of the artifact + update architecture; production-quality seamless UX
needs Windows code signing later (a separate sub-phase). The default Electron icon is
used (a custom icon is a polish item).

**Server target:** the packaged app injects `apiBase`/`wsBase` from `TM_SERVER_BASE`
(default `http://localhost:8080`). Run your server there (or set the env before launch);
a persistent server-selector UI is a later phase.

## Windows — Add to Steam library (Non-Steam Game)

The app can register itself as a **Non-Steam Game** in Steam: a `shortcuts.vdf` entry with a
deterministic appid, the shared `assets/steamdeck/*.png` library artwork (capsule / hero / logo)
and the **square `steam-deck-icon-512.png` as the shortcut icon**, dropped into
`userdata/<id>/config/grid/` (the only reliable way to attach custom art to a Non-Steam game). It
is the Windows analogue of the Steam Deck installer (`scripts/steamdeck/install-steamdeck.sh`),
minus the Deck-only steps (AppImage download + restart-loop wrapper) — Velopack's Setup.exe places
the `.exe` and self-updates in place.

**No installer checkbox** — Velopack's Setup.exe has no installer UI (its install hooks forbid
showing a dialog/checkbox), so the old NSIS finish-page checkbox is gone. It's offered in-app:
- a **first-run opt-in prompt** (shown once on the first launch after install, `VELOPACK_FIRSTRUN`;
  never if already added or previously dismissed) — desktop reuses `ConsoleConfirmDialog` in
  `PremiumMainMenu.vue`, console shows a `'steam'` overlay in `ConsoleMainMenu.vue`;
- a **persistent button** in the desktop footer (`PremiumMenuFooter.vue`) + the console main menu,
  hidden once the shortcut is added.

Driven by the shared reactive `src/client/components/desktop/steamShortcutState.ts` + the
`desktop:getSteamState` / `desktop:addToSteam` / `desktop:dismissSteamPrompt` IPC. "Already added"
is checked LIVE against `shortcuts.vdf` (`isAddedToSteam()`), not a local flag; "Not now" persists
via `session.steamPromptDismissed`.

- **Gated on Steam being installed** — `addToSteam()` does nothing when Steam isn't found.
- **Idempotent.** Re-running replaces the existing entry (upsert by Exe / appid); every
  `shortcuts.vdf` is backed up before the write.
- **Safe write.** Steam rewrites `shortcuts.vdf` on exit, so — like the Deck installer —
  `addToSteam()` gracefully closes Steam (`steam.exe -shutdown`, bounded poll) before writing and
  relaunches it after, per logged-in profile.

Files:
- `electron/steamVdf.ts` — PURE crc32 / appid / binary-VDF reader-writer / entry template +
  `shortcutExists` (the "already added" check). Unit-tested: `tests/electron/steamVdf.spec.ts`.
- `electron/steamShortcut.ts` — Windows IO: registry Steam detection, art + square-icon copy, Steam
  shutdown/relaunch, `addToSteam()` + `isAddedToSteam()`. Invoked via the `desktop:addToSteam` IPC.
- The app / Steam / AppImage icon is generated by `scripts/make-app-icon.cjs` from
  `electron/build-resources/icon-source.png` → `icon.ico` (exe) + `steam-deck-icon-512.png` (Steam)
  + `linuxIcon.png` (AppImage).

## Security model

The `BrowserWindow` uses the safe modern defaults, enforced explicitly:

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- `webSecurity: true`, `allowRunningInsecureContent: false`
- an explicit `preload` — the **only** bridge.

The preload (sandboxed) exposes exactly two globals via `contextBridge`:

- `window.tmRuntimeConfig` — `{ apiBase, wsBase, participantId? }` (read by the
  renderer's existing `runtimeConfig.ts`; stays optional so the web app never depends
  on Electron).
- `window.desktopBridge` — `{ desktopMode: true, getVersion(), openExternal(url) }`.

No raw `ipcRenderer`, no `require`, no `fs`/`path`/`shell`/`child_process` reach the
renderer. `getVersion`/`openExternal` are thin `ipcRenderer.invoke` wrappers backed by
two narrow `ipcMain.handle` handlers in `main.ts`. External `http(s)` links open in the
system browser (`shell.openExternal`); in-window navigation is restricted to the
renderer's own origin (the server origin in `server` mode, `app://bundle` in `app`
mode), so the SPA's same-origin reloads keep working while cross-origin does not load
in-window.

## Files

- `electron/main.ts` — app lifecycle, single-instance lock, `setAppUserModelId`, the
  safe `BrowserWindow`, the two load modes, external-link handling, the two IPC handlers.
- `electron/preload.ts` — the narrow `contextBridge` bridge.
- `electron/protocol.ts` — the Phase 2A `app://` scheme + request handler (serves the
  packaged static renderer; mirrors the server's `ServeAsset` mapping; traversal-guarded).
- `electron/protocol.ts` / `electron/update.ts` — the `app://` handler and the Phase 7
  update orchestration (compatibility gate + electron-updater wiring + IPC).
- `electron/tsconfig.json` — the isolated compile lane (→ `build/electron/`).
- `electron-builder.yml` (repo root) — the packaging config (NSIS, thin-client `files`
  allowlist incl. electron-updater's closure, `npmRebuild: false`, update feed).

## Phase 2B — DONE (cross-origin REST/WS from `app://`)

The renderer now talks to a cross-origin server from `app://`: the ~10 raw `api/…`
fetches are wrapped through `apiUrl()`, and the server has a safe, allow-listed CORS
layer (`src/server/server/cors.ts`, hooked in `requestProcessor`): explicit allowlist
(no wildcard), no credentials (token auth), scoped to the game-runtime + create/join
surface (admin/auth stay same-origin only), OPTIONS preflight handled, same-origin
browser requests untouched. WebSocket already worked (no preflight; the server does no
Origin check on the `/ws` upgrade).

## Phase 7 + 8 — DONE (premium mandatory updater + hardening)

On startup a PACKAGED build calls `GET <server>/api/desktop/version` (from the main
process — no CORS) to decide whether the installed version may still play. If a
mandatory update is required, the premium full-screen overlay
(`src/client/components/desktop/DesktopUpdateOverlay.vue`, App-level, gated on
`desktopBridge.desktopMode`) covers the game and `electron-updater` downloads the new
NSIS installer, streaming progress over IPC → restart-and-install. States: checking /
required / downloading (progress bar) / downloaded / installing / offlineBlocked+retry /
error+retry / manualDownloadRequired. Inert on the web (no `desktopBridge`).

**Phase 8 hardening:**
- **Last-known-good offline policy** (`electron/updatePolicy.ts`, unit-tested; persisted
  by `electron/session.ts` in userData). A server outage no longer silently unlocks a
  known-outdated client → `offlineBlocked`; a first-run offline launch still fails open
  (unless `TM_DESKTOP_STRICT_OFFLINE=1`).
- **Channels** — `TM_UPDATE_CHANNEL` selects the feed yml + the gate `?channel=`.
- **Retry** — any blocked state re-runs the whole compatibility check (`recheck`), so a
  reconnection can unblock, a still-required client re-arms the download, and a feed
  error re-attempts.

### Is the Windows updater actually live? (runbook)

**The whole loop is code-complete and SELF-DRIVING** — no per-release env twiddling:

1. **Feed (automatic).** `.github/workflows/release.yml` runs on **every push to `main`** (not
   only on a `v*` tag) and publishes ONE GitHub Release under
   `victor-zelinskiy/terraforming-mars`, versioned from the **committed `package.json`** (bumped
   +1 patch per commit by the `.githooks/pre-commit` hook — the same version the Heroku server
   reports, so client/server match for the same commit), carrying the Windows `.exe` + `latest.yml`
   + `.blockmap` (and the Linux AppImage). The repo is public, so electron-updater reads the feed
   with no token.
2. **Gate (automatic).** `GET /api/desktop/version` (`ApiDesktopVersion`) reads the newest
   release LIVE from the GitHub API (`TM_DESKTOP_REQUIRE_LATEST` defaults on) and tells any
   client below it `updateRequired: true`. So a new push → older clients are required to update,
   with **no env change**. `TM_DESKTOP_*` env only OVERRIDES this (force-update, a pinned
   min-version, custom download URL / notes); it is optional.

   **Update-pickup speed** is bounded by how fresh the server's cached GitHub view is, which is in
   turn bounded by GitHub's rate limit. Set a server-only token (`TM_DESKTOP_GITHUB_TOKEN` /
   `GITHUB_TOKEN` / `GH_TOKEN`, `src/server/routes/desktopGithub.ts`) and the ceiling jumps
   60→5000/hr, so
   every GitHub cache here runs SHORT (latest 30s, runs 20s, feed map 30s) and a new release is
   picked up in ~30s instead of up to ~2 min. No token → conservative long TTLs (unchanged). The
   token is NEVER sent to the client. `TM_DESKTOP_GITHUB_TTL_MS` overrides every TTL by hand.
   Client-side, the main-menu re-check runs every 30s and a **post-pending bridge** keeps the fast
   ~25s poll alive for a few extra ticks after a CI build completes, so a lagging latest-cache
   can't strand a freshly-published update on the slow timer.
3. **Delivery (automatic on Windows).** A packaged client checks the gate on launch; when an
   update is required, the premium `DesktopUpdateOverlay` shows the progress bar and
   electron-updater downloads the new NSIS installer and installs + auto-relaunches
   (`quitAndInstall(false, true)`).

**The ONE remaining dependency is deployment, not code:**
- The server the packaged client points at (`TM_SERVER_BASE`, default the Heroku URL in
  `main.ts`) must be running the CURRENT server code so `/api/desktop/version` is served.
- The packaged client must target that server (the default already does).

That's it — no feed to "make real" anymore (it's the auto-publishing release workflow). To
verify by hand: `curl "https://<server>/api/desktop/version?platform=win32&current=1.0.0"` —
it should return `latestVersion: "<version>"` (the newest release tag, e.g. `1.2.5`) and
`updateRequired: true`. To force everyone to
update immediately (e.g. a protocol break), set the server env `TM_DESKTOP_FORCE_UPDATE=1`.

**Not yet done (separate sub-phase):** Windows **code signing** — until then SmartScreen
warns on the first manual install (the silent auto-update itself still installs fine).

## Linux / Steam Deck builds & updates

The desktop app ships for **Windows (Velopack Setup.exe)** and **Linux (x64 AppImage)** from
the same thin-client renderer. electron-builder builds only the unpacked dir (`--dir`); **Velopack**
(`vpk`) packages + publishes them from `.github/workflows/release.yml` on every push to `main`.

**Release target.** GitHub Releases under **`victor-zelinskiy/terraforming-mars`** (public repo).
`vpk upload github` publishes with the workflow's built-in `GITHUB_TOKEN` (passed as `VPK_TOKEN`) —
**no separate releases repo / `GH_RELEASE_TOKEN` needed**, and the client reads the feed with no
token. Each OS uploads its OWN channel (win / linux) to the SAME tag; the jobs run SEQUENTIALLY
(linux `needs: windows`) so they never race to create the release.

**Build locally** (the unpacked dir; `vpk pack`/publish needs .NET + normally runs in CI):

```bash
# Windows (on Windows):
npm run pack:dir:win     # dist-desktop/win-unpacked/   → vpk pack … --mainExe "Terraforming Mars.exe"

# Linux AppImage (on Linux / Steam Deck / WSL — NOT buildable on Windows):
npm run pack:dir:linux   # dist-desktop/linux-unpacked/ → vpk pack … --mainExe terraforming-mars
```

`vpk` is a .NET global tool (`dotnet tool install -g vpk --version 1.2.0`). The CI flow is
`vpk download github` (fetch prior release → delta) → `vpk pack` → `vpk upload github --publish`.

**Cut a release** — just push to `main`. The workflow reads the version from the committed
`package.json` (bumped per commit; see `scripts/bump-version.mjs` + `.githooks/pre-commit`), packs
with Velopack, and publishes ONE release tagged `v<version>` carrying the Windows Setup.exe,
the Linux AppImage, the full/delta `.nupkg`, the `releases.<channel>.json` feed, and a fixed-URL
`TerraformingMars-x86_64.AppImage` alias for the Steam Deck bootstrap. Old releases are pruned to
the newest 5 (a delta chain needs the prior full present).

**Steam Deck / SteamOS**

1. Download `TerraformingMars-x86_64.AppImage` (the fixed-URL alias) from the latest release —
   or just run `scripts/steamdeck/install-steamdeck.sh`, which does everything.
2. `chmod +x TerraformingMars-x86_64.AppImage` (or Properties → Permissions → Executable).
3. Run it. Add it to Steam as a **Non-Steam Game** for Game Mode / controller support.
   (If FUSE is unavailable, run with `./TerraformingMars-x86_64.AppImage --appimage-extract-and-run`.)

**How updates work (both platforms)** — Velopack delivery, same premium overlay + progress bar.

- The main process checks the compatibility gate (`GET <server>/api/desktop/version?platform=…`,
  platform-aware) on launch; a *required* update drives the premium `DesktopUpdateOverlay`. This
  gate + the last-known-good policy are UNCHANGED — only the delivery mechanism moved to Velopack.
- Delivery uses Velopack's `UpdateManager` against the GitHub feed: `checkForUpdatesAsync` →
  `downloadUpdateAsync` (the overlay shows the live **progress bar** from Velopack's 0..100 percent)
  → the update is applied on the NEXT exit via `waitExitThenApplyUpdate` (Squirrel-style in-place
  delta swap; `setAutoApplyOnStartup(false)` keeps apply under our explicit control).
- **Windows** — *Restart and install* calls `waitExitThenApplyUpdate(upd, true, true)` then
  `app.quit()`; Velopack applies + relaunches (per-user, no UAC).
- **Linux AppImage** — we NEVER let Velopack relaunch (`restart=false`): a relaunch it spawns would
  start OUTSIDE the gamescope session and make Steam Deck's Game Mode hang. Velopack still replaces
  the AppImage in place, and the RESTART is owned by the launcher:
  - launched by the **restart-loop wrapper** (`scripts/steamdeck` sets `TM_RESTART_SUPPORTED=1` +
    `TM_RESTART_MARKER`) → the app writes the marker, applies (no relaunch), exits, and the wrapper —
    the process Steam/gamescope tracks — **relaunches the updated AppImage in the same session**.
    The marker content is `applying <inode> <mtimeSec>` — the identity of the AppImage the app was
    running (`restartMarkerStamp` in `updatePolicy.ts`). The wrapper WAITS until `stat` on the
    AppImage differs (UpdateNix swapped it), or UpdateNix exits, or 90 s, BEFORE relaunching —
    without the wait it relaunched the OLD AppImage while the apply was still extracting, which
    re-downloaded and re-applied the same update (double-apply). Old wrapper ignores the content
    (only tests `-f`); an old app's bare-timestamp marker makes a new wrapper relaunch immediately.
  - old wrapper / direct launch → *Install and close*: apply + quit cleanly (Steam returns to the
    library) and the player reopens it. `restartSupported` drives which button the overlay shows.
  - not an AppImage at all (dev/unpacked) → premium **manual-download** fallback (needs `$APPIMAGE`).
- The main process logs `[updater] provider=velopack-github platform=… appImage=… current=… channel=… — <status>`.

## Not in this phase (later)

Game-boundary reset, command transport rewrite, signing/notarization (any OS),
performance refactors. A strict CSP for the `app://` handler is deferred (needs tuning
against the live bundle); an `Origin` allowlist on the `/ws` upgrade is optional
hardening; a stricter offline-block policy (vs today's fail-open) is a Phase 8 option.
See `../docs/ELECTRON_MIGRATION_PLAN.md` for the phased roadmap and the parallel Performance
Initiative (§17).
