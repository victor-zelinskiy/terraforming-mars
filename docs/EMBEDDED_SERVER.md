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

⚠️ **The realtime gateway attaches only AFTER `listen()` resolves** (`GameServer.ts`), because
that EADDRINUSE retry creates a *second* `http.Server`. Attaching before the bind left the
process-wide `RealtimeServer` singleton pointing at the dead first server, and `attach()` then
no-op'd for the live one — and a server with no `'upgrade'` listener does not refuse the
handshake: **Node hands it to the normal request router**, which answers `404 Not found GET /ws`
while the client silently reconnect-loops on legacy polling. `attach()` is now idempotent per
server (not per process) so a second server can never be skipped. Guard:
`tests/server/GameServer.spec.ts` "EADDRINUSE retry still gets the realtime gateway".

**Bind address:** `0.0.0.0` when LAN visibility is on (default in host mode), else `127.0.0.1`.
Changing visibility takes effect on next launch (v1; live rebind is listed under future work).
Windows Firewall will prompt once on the first LAN bind — expected.

### 5.1 ONE mDNS RESPONDER PER LINK (`lanInterfaces.ts` + `lanDiscovery.ts`)

⚠️ **`multicast-dns` picks its egress interface with `setMulticastInterface(defaultInterface())`,
and `defaultInterface()` returns the literal `'0.0.0.0'` on every platform except macOS.** That
hands the choice to the OS routing table — and for `224.0.0.251` the routing table lies. Measured
on a Windows dev box: all `224.0.0.0/4` routes had `RouteMetric 256`, so the tie broke on
interface metric, where a NordLynx tunnel (5) beat the actual Wi-Fi link (30). The entire
advertisement left through the VPN. Group MEMBERSHIP is joined on every link, so *receiving* kept
working — which is why the symptom is always the same asymmetric one: **"I can see their games,
nobody can see mine."** A Steam Machine on wired SteamOS has nothing to choose between and never
showed it.

The fix is not a better guess. Adapter names cannot identify "the real LAN": a Cisco AnyConnect
tunnel presents itself as `Ethernet 2`, and Wi-Fi is often the only route to the couch. So
`listLanInterfaces()` enumerates every plausible link and `LanDiscovery` opens **one `Bonjour` per
link**, with `{bind: '0.0.0.0', interface: <link address>}` — `bind` and `interface` are DIFFERENT
options: we bind the wildcard address (Windows only delivers multicast to a wildcard-bound socket)
while joining the group and sending on exactly one link. Delivery then follows group membership,
so each responder hears only its own link and answers back out of it. Measured: 6/6 sockets bind
on `0.0.0.0:5353` with `SO_REUSEADDR`, and each wire packet is delivered to exactly one of them.

Link selection drops only what can never carry a game: loopback/internal, APIPA `169.254/16` (no
DHCP lease) and zero-MAC pseudo adapters (a WireGuard tunnel has no L2). Tunnels and hypervisor
switches are RANKED last, never excluded — being wrong in that direction only costs a socket.
`TM_LAN_INTERFACE` pins the set for diagnosis; a pin that matches nothing is ignored rather than
obeyed, because a typo must not silently switch LAN play off.

Three more library behaviours this layer compensates for:
- **The Browser sends its PTR query exactly ONCE** at construction (`browser.js` calls `update()`
  only from `start()`). A guest that started before the host would depend entirely on catching an
  announce, and multicast over Wi-Fi is unacknowledged and lossy → we re-query on a ramp.
- **`registry.announce` decays x3 up to ONE HOUR.** After a few minutes a host is effectively
  silent, so a guest opening the menu later hears nothing → we re-broadcast the service's own
  records on a fixed `ANNOUNCE_INTERVAL_MS` beat. This also makes discovery survive a host whose
  *inbound* multicast is firewalled: it can still announce even if it can never be asked.
- **`Browser.expire()` is defined but never scheduled**, and the PTR TTL is 8 hours, so a host
  that dies without a goodbye would sit in the list until restart → own `lastSeen` sweep.

Interfaces are re-enumerated every `INTERFACE_WATCH_MS`; a changed address set rebuilds the
responders, so a Wi-Fi reconnect or a VPN toggle no longer leaves the host bound to addresses that
no longer exist. TXT carries `addr` (this link's own address) and the guest additionally prefers
the mDNS packet's `referer` source address — the only candidate that is reachable *by
construction* (`bonjour-service` publishes an A record for every NIC, tunnels included).
Guards: `tests/electron/lanInterfaces.spec.ts`, `tests/electron/lanDiscovery.spec.ts`.

⚠️ **The mDNS instance name is unique per machine+profile, NOT per process** — `<имя> (<hostname>)`
is identical for a dev build running beside the packaged one, a second install, or an orphaned
utility process from the previous run. `bonjour-service` does **not** implement RFC 6762 §9
conflict renaming: on a probe conflict it tears the service down and only prints
`Error: Service name is already in use on the network` — the loser then stays silently invisible
on the LAN for the whole session with nothing ever retrying (the port half self-heals via the
EADDRINUSE retry, the name half did not). `lanDiscovery.publishAttempt` supplies the missing
half: it waits `PUBLISH_CONFIRM_MS` for the service to come `up` and, if the library tore it
down instead (`activated === false` — the flag that separates a taken name from a merely slow
announce), re-publishes as `… (2)`, `… (3)`, up to 5 names. The friendly name lives in TXT
`name`, so a disambiguated instance still lists under the plain profile name on the guest.
That library `Error:` line still prints before the retry — it is a `console.log` we don't own;
our own `[lan]` line right after it is the one that says what actually happened.
Guard: `tests/electron/lanDiscovery.spec.ts`.

**Supervision (`electron/embeddedServer.ts`):** spawn → await ready (timeout → fallback to
remote mode) → on unexpected exit, one respawn with backoff, then fallback. On `before-quit`:
`{type:'shutdown'}` with a 2 s grace, then kill. Saves are written atomically (temp file +
rename) off the event loop, serialized on one queue, so a kill can never truncate a file or
reorder saves — at worst the last few milliseconds of writes are still in flight and that one
action is lost. Everything before it is on disk. The 2 s grace is far longer than the queue
needs to drain, so a graceful quit loses nothing. (No write is `fsync`ed, so sudden power loss
is a weaker guarantee than process death.) A restart changes `runId`; the client's existing `INVALID_RUN_ID`
handling (server-restart reload prompt) self-heals mid-game sessions.

**Message protocol (utility ↔ main):**
`ready {port, bind}` · `fatal {error}` · `lan-hosts {hosts[]}` (browse results push) ·
`lan-diagnostics {diagnostics}` (per-link responder health, heartbeat) ·
`shutdown` · `lan-rename {name}` (re-advertise under a new player name).

**LAN env contract:** `TM_LAN_VISIBLE` ('0' = browse but do not advertise) ·
`TM_LAN_NAME` · `TM_LAN_INTERFACE` (pin links, comma-separated addresses/adapter names) ·
`TM_LAN_LOOPBACK` ('1' = multicast loopback, so a host and a guest on ONE machine can see each
other; off by default because with a responder per link this process would otherwise hear its own
probe on the other links and rename itself into oblivion).

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

⚠️⚠️ **mDNS FINDS a host; a SOCKET says it is still there.** `bonjour-service`'s Browser
emits `up` exactly once per service and never re-announces one it already holds, so a
"last seen" fed from that callback freezes at discovery — and the TTL sweep that read it
deleted EVERY host 45 s after finding it, permanently (only an app restart brought it back).
`lanDiscovery.ts` now re-reads presence from `browser.services` every query tick and decides
liveness with a raced TCP connect (`reachable`) once a host goes quiet; two failures hide it,
a 30 s re-check rotation brings it back on its own. Advertisements that resolve to the same
address:port collapse to the freshest (`dedupeByEndpoint`) — a crashed app's ghost would
otherwise answer forever, because the machine's CURRENT app is what is listening.

⚠️ **Discovery only says WHO is there — the listing is its own subsystem.**
`lanState.ts` is hosts (mDNS + manual entries); `lobbyState.ts` treats each host as one
SOURCE beside this device's own server, with its own status, its own race-guarded refresh
and its own realtime **LOBBY** channel (`SUBSCRIBE_LOBBY` on the host's `/ws`, which pushes
«the set of games here changed»). The probe races all of a host's addresses in parallel with
a 6 s budget, and a host that answers slowly or not at all is reported as such — never as
«that couch has no games». The host side answers from an in-memory index rather than by
deserializing its whole library, which is what used to blow the guest's probe budget.
Full write-up: `docs/claude/my-games-lobby.md`.

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
