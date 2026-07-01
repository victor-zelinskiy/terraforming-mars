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

## Packaging — Windows NSIS installer (Phase 6)

```bash
npm run electron:pack:dir   # build:desktop + electron-builder --dir → dist-desktop/win-unpacked/ (no installer; fast sanity check)
npm run dist:win            # build:desktop + electron-builder --win → the NSIS installer + latest.yml + .blockmap
```

Both scripts `rimraf dist-desktop/` first, and the config sets
`electronDist: node_modules/electron/dist` — it packages the already-unpacked Electron
runtime instead of re-extracting the zip, which sidesteps the flaky Windows
`EPERM: … rename 'win-unpacked.tmp' -> 'win-unpacked'` (a scanner/indexer briefly locking
the freshly-extracted binaries). Same pinned version → identical artifact, built reliably.

Config: `electron-builder.yml`. Output: `dist-desktop/`:
`TerraformingMars-Setup-<version>-x64.exe` + `.exe.blockmap` (differential updates) +
`latest.yml` (update-feed metadata for Phase 7). A packaged build (`app.isPackaged`)
**auto-uses `app://` mode** — no env needed.

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

**To finish wiring auto-download (deployment, your part):**
1. Deploy the server (with `src/server/server/cors.ts` + `ApiDesktopVersion`) — the
   Heroku default already allows the `app://bundle` Origin.
2. Set the real update feed in `electron-builder.yml` `publish` (GitHub Releases
   recommended — see the comment there) and host `latest.yml` + the installer there.
3. Optionally set the server's `TM_DESKTOP_*` env (min version, download URL, notes).

Until the feed is real, the compatibility gate + premium UI + the manual-download
fallback all work; only the in-app auto-download needs the hosted feed.

## Not in this phase (later)

Game-boundary reset, command transport rewrite, signing/notarization (any OS),
performance refactors. A strict CSP for the `app://` handler is deferred (needs tuning
against the live bundle); an `Origin` allowlist on the `/ws` upgrade is optional
hardening; a stricter offline-block policy (vs today's fail-open) is a Phase 8 option.
See `ELECTRON_MIGRATION_PLAN.md` for the phased roadmap and the parallel Performance
Initiative (§17).
