# Embedded server & app modes — host-as-server architecture

Status: **IN PROGRESS** (2026-08-05). Owner scenario: LAN play — Windows PC (WiFi) hosting,
Steam Machine (Ethernet) joining, both on one router. Goal: kill the ~186 ms Heroku RTT that sits
inside every interactive path (board cell preview, card play preview, action previews, bot pacing).

Related: `docs/ELECTRON_MIGRATION_PLAN.md` (thin-client phases 1–8, all shipped),
`docs/WEBSOCKET_MIGRATION_PLAN.md` (invalidation-only WS, shipped).

---

## 1. The measurements that motivated this

| Fact | Value |
| --- | --- |
| RTT to the packaged default server (Heroku) | **~186 ms** |
| `PlayerViewModel`, mid-game 4p all-expansions | 29.9 KB raw / 5.0 KB gzip |
| HTTP requests during a quiet minute (WS healthy) | ~9/min |
| Requests per own turn | ~4 (`POST player/input` already returns the full model) |
| Interactive paths carrying the RTT | cell preview (no debounce), hand play-preview (90 ms dwell + RTT), action previews (N fetches, cache dropped on any resource change), server-side bot pacing |

Conclusion: request COUNT is not the problem; the RTT inside interactive loops is. A local
authoritative server turns 186 ms into ~1 ms for every one of those paths at once, with zero
changes to game rules, routes, availability logic or the client's server-authoritative contract.

## 2. Decision summary

| Decision | Choice | Why |
| --- | --- | --- |
| Where the server runs | **Electron `utilityProcess`** (full Node, own event loop) | Main process must never block; renderer is sandboxed. Crash-isolated, restartable, `MessagePort`-capable. |
| Renderer ↔ embedded transport | **Loopback HTTP + WS to `127.0.0.1:<port>`** | Reuses 100% of the existing client (fetch/XHR/WebSocket/CORS). A MessagePort protocol shim would save ~0.5 ms and cost a custom framing layer. Rejected for v1. |
| Database | **`LocalFilesystem`** at `<userData>/embedded/db/files` | Zero native modules → no `@electron/rebuild`, works in any Electron. One JSON file per save; durable on every action. |
| Packaging | **webpack single-file bundle** → `build/electron/embedded-server.js` (asar-unpacked) | The packaged app ships no server `node_modules`; bundling removes the transitive-deps problem. `pg` / `better-sqlite3` stay external + lazily required (never loaded under LocalFilesystem). |
| LAN discovery | **mDNS (`bonjour-service`, pure JS)**, service `_tmars._tcp`, run inside the utility process | No OS daemon dependency; multicast sockets die with the process. Manual connect-by-IP stays as fallback. |
| Guest → host transport | Plain HTTP/WS over the LAN | ICE/WebRTC adds nothing on a LAN (same router path); the guest's Electron origin `app://bundle` is already in the server's CORS allowlist. |
| Mode default | `host` (after stabilization — this is the product default) | The user-facing promise: solo/hotseat instant, LAN games discoverable. `remote` remains one setting away. |

## 3. App modes

`AppMode = 'host' | 'remote'`, resolved in `electron/main.ts`:

1. `--tm-mode=<mode>` CLI flag (Steam launch options; folded onto env by the existing
   `parseCliEnvOverrides` bridge) → `TM_APP_MODE` env var;
2. desktop session store (`tm-desktop-session.json`, field `appMode`) — set from the in-game
   settings row;
3. default: **`host`**.

| | `host` | `remote` |
| --- | --- | --- |
| Embedded server | spawned before window creation; window waits for the ready handshake | not spawned |
| Default endpoint (`tmRuntimeConfig`) | `http://127.0.0.1:<port>` | `TM_SERVER_BASE` (Heroku in packaged) |
| Games list / create game | local DB | remote server |
| LAN | advertise own games (if visible) + browse for hosts | off |
| Failure behavior | if the embedded server fails to start/restart → **automatic fallback to `remote`** with a logged diagnostic | — |

`remote` is the kill-switch and the way to finish games that live on Heroku. The mode is a
launch-scoped decision; a per-game **endpoint pin** (see §6) lets an individual game session talk
to a different server than the app default (that is how LAN join works).

## 4. Server as a library

`src/server/server.ts` is today a script (no exports, top-level `start()`). It splits into:

- **`src/server/GameServer.ts`** — `startGameServer(options): Promise<RunningGameServer>`.
  Everything `start()` does today (globalInitialize, realtime resolver + attach, BotTurnScheduler
  enable, DB init, SessionManager, GameLoader maintenance, listen) behind options:
  `{port, host, enableBotScheduler, collectDefaultMetrics}`. `stop()` closes the HTTP server and
  the realtime hub. TLS stays env-driven (`KEY_PATH`/`CERT_PATH`), unused embedded.
- **`src/server/server.ts`** — thin CLI: dotenv + console-stamp + uncaughtException handler +
  `startGameServer({port: env.PORT ?? 8080, host: env.HOST})` + the serverId/runId banner.
  Behavior byte-identical for Heroku/dev.

Three load-bearing fixes that make the library importable outside a repo checkout:

1. **`Database.ts` — lazy backend requires.** `import {PostgreSQL}` at top level pulls `pg` at
   module load; in the packaged app server `node_modules` don't exist → import crash. The
   backend classes are `require()`d inside the matching `getInstance()` branch instead.
   (`SQLite.ts` already lazy-requires `better-sqlite3`; its top-level `import = require` is
   type-only and elided.)
2. **`ServeAsset` constructor priming guarded.** It eagerly `readFileSync`s `build/styles.css`
   (+ .gz/.br) at `INSTANCE` construction — i.e. at *import* of `requestProcessor` — and throws
   when cwd has no build tree (packaged embedded). The priming becomes best-effort with a single
   warn; requests still lazy-load files as before.
3. **`LocalFilesystem.initialize()` uses `mkdirSync(..., {recursive: true})`** so a fresh
   `<userData>/embedded/db/files` tree self-creates.

The embedded server keeps ALL routes registered (static routes just 404 harmlessly — Electron
guests load UI from their own `app://bundle`). No route, model, or CORS change is needed:
`app://bundle` is already in `DEFAULT_ALLOWED_ORIGINS`, and every gameplay/lobby path a guest
needs is already in `CORS_PATHS`.

## 5. The utility process

**Entry:** `src/server/embedded/embeddedServerMain.ts`, compiled two ways:
- dev: plain tsc output `build/src/server/embedded/embeddedServerMain.js` (node_modules present);
- packaged: webpack node-target single file `build/electron/embedded-server.js`
  (externals: `pg`, `better-sqlite3`, `pg-native`, `bufferutil`, `utf-8-validate`), listed in
  `asarUnpack` because `utilityProcess.fork` needs a real file.

**Boot sequence:** read `TM_EMBEDDED_ROOT` → `process.chdir(root)` (before any server import —
imports are dynamic/require so the cwd-relative module state resolves under the root) → set
`LOCAL_FS_DB=1` → `startGameServer({port: TM_EMBEDDED_PORT ?? 17325, host: bind})` → on
`EADDRINUSE` retry with port 0 → `parentPort.postMessage({type:'ready', port, bind})`.

**Bind address:** `0.0.0.0` when LAN visibility is on (default in host mode), else `127.0.0.1`.
Changing visibility takes effect on next launch (v1; live rebind is listed under future work).
Windows Firewall will prompt once on the first LAN bind — expected.

**Supervision (`electron/embeddedServer.ts`):** spawn → await ready (timeout → fallback to
remote mode) → on unexpected exit, one respawn with backoff, then fallback. On `before-quit`:
`{type:'shutdown'}` with a 2 s grace, then kill. Every save is a synchronous file write, so a
hard kill loses nothing. A restart changes `runId`; the client's existing `INVALID_RUN_ID`
handling (server-restart reload prompt) self-heals mid-game sessions.

**Message protocol (utility ↔ main):**
`ready {port, bind}` · `fatal {error}` · `lan-hosts {hosts[]}` (browse results push) ·
`shutdown` · `lan-rename {name}` (re-advertise under a new player name).

## 6. Client: endpoints, pinning, LAN join

**Default endpoint** rides the existing `tmRuntimeConfig` seam (preload `additionalArguments`)
— in host mode main injects `apiBase=http://127.0.0.1:<port>`, `wsBase=ws://127.0.0.1:<port>`.

**Per-participant endpoint pin** — new `src/client/utils/serverEndpoints.ts`:
`pinEndpoint(participantId, {apiBase, wsBase})` → localStorage. `runtimeConfig.apiUrl()` /
`wsBaseUrl()` resolve: *pinned endpoint for the current participant id* (from the URL `?id=` or
injected id) → *injected default* → *same-origin*. Because every network call in the client goes
through these two functions, pinning one id transparently redirects REST, the waitingfor XHR,
logs/journal, all previews and the WebSocket for that game session — and only for it.

**LAN join flow:** discovery pushes `{name, addresses[], port, version}` rows to the renderer via
the desktop bridge → the join screen lists LAN hosts next to local games → selecting a host
probes its addresses (first `api/games/joinable?name=<myName>` to answer wins) → join = pin the
returned player id to that host's endpoint + navigate to `player?id=...`. A version mismatch
between guest and host renders a warning (soft block in v1).

**Settings row** («Настройки» → `ConsoleOptionsPanel`): «Сервер партий» — Локальный / Удалённый
(+ subtitle: applies after relaunch). Persisted via the desktop bridge into the session store.

## 7. Security model (deliberate, LAN-trust)

- Auth stays what it is upstream: possession of the `p…` token IS the seat. Tokens are unsigned
  and portable — that's what makes LAN/host play work at all.
- The host's disk holds full `SerializedGame` (deck order, hands). **A host can technically read
  hidden information.** Acceptable for the private-fork audience; a reason NOT to expose the
  embedded server publicly as-is (see future work).
- Name-matching join (`api/games/joinable`) hands out the seat token to whoever matches the
  display name — the existing trust model, now scoped to the LAN. Invite codes are future work.
- `serverId` (admin routes) is random per spawn and never advertised. `LoadGame`/rollback
  routes are reachable on the LAN — same trust assumption, documented here on purpose.

## 8. Rollout & dev recipes

- Kill-switches: settings row → `remote`; `TM_APP_MODE=remote`; `--tm-mode=remote` Steam launch
  option. Embedded startup failure auto-falls back to remote.
- Dev, host mode with packaged-like renderer: `npm run build:desktop && cross-env TM_ELECTRON_LOAD=app TM_APP_MODE=host electron build/electron/main.js`.
- Dev, guest simulation on one machine: second instance with a different `userData` dir in
  remote mode pointed at the first instance: `TM_APP_MODE=remote TM_SERVER_BASE=http://<lan-ip>:17325`.
- Heroku games created before the flip: switch the row to «Удалённый», finish, switch back.

## 9. Future work (recorded, OUT OF SCOPE now)

1. **Game portability (former Phase 4).** An import endpoint for `SerializedGame`
   (`tools/export_game.ts` exists; no importer does): local→cloud move, cloud backup on every
   save, resurrecting a game whose host left. `runId` riding in `PlayerViewModel` means a moved
   game self-heals on the client.
2. **Public host-as-server / WebRTC (former Phase 5).** Heroku (or any cheap box) reduced to:
   invite-code registry (code → how to reach the host), WebRTC signaling (SDP/ICE exchange),
   STUN; TURN only as fallback (~$0.05/GB Cloudflare, first TB free — a full game is ~10–15 MB
   gzipped, i.e. cents). Transport: DataChannel frames carrying HTTP-shaped requests into
   `processRequest(req, res)` via shim objects — `Request`/`Response` are type-only imports of
   `http`, so any transport that can fake `{url, method, headers, socket}` /
   `{writeHead, setHeader, write, end}` plugs into ALL 54 routes unchanged. This is the seam the
   library refactor deliberately preserves. Electron-side: disable
   `WebRtcHideLocalIpsWithMdns` if LAN ICE candidates are ever wanted there.
   Prerequisites before любой public exposure: invite codes (kill name-matching), rate limits,
   an origin check on the WS upgrade.
3. **Browser join** (phone on the couch joins the host's game): package the web build
   (`build/main.js` + chunks) into the app and serve it from the embedded server — the static
   pipeline already exists (`ServeAsset`), only the artifact set and a `staticRoot` option are
   missing.
4. **Live LAN visibility rebind** (no relaunch), richer host presence (advertise game phase,
   player count), invite codes on LAN too.
