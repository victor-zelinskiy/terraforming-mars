# Single-App + WebSocket Realtime — Architecture Investigation & Migration Plan

> Status: **implementation COMPLETE — the realtime transport, subscription, invalidation, refresh wiring, reconnect/resume, poll reduction, and secondary-poller migration are LIVE and ON BY DEFAULT (Phase 12).** WebSocket is now the primary realtime mechanism; polling is the automatic fallback. Every layer keeps an opt-out kill-switch (§L.6).
> Scope: move from legacy polling + multi-page assumptions toward a formalized single-app client with a server-authoritative WebSocket realtime layer, without a big-bang rewrite, preserving direct game URLs and the premium UI. Electron is out of scope (but kept in mind).

### Implementation status & phase mapping

The work shipped in **implementation phases** (the conversational numbering). They don't map 1:1 to the design phases in §E below — the mapping + state:

| Impl. phase (shipped) | What it did | Design §E phase | State |
| --- | --- | --- | --- |
| Impl. Phase 1 | WS transport + diagnostics (`/ws`, hello, heartbeat, dev chip) | E-Phase 3 | ✅ done |
| Impl. Phase 2 | Game subscription (rooms via `RealtimeHub`, token auth, spectator read-only) | E-Phase 4 | ✅ done |
| Impl. Phase 3 | Observe-only `GAME_STATE_INVALIDATED` broadcast (client logs only) | E-Phase 5 | ✅ done |
| Impl. Phase 4 | **Wire invalidation → the existing guarded `waitForUpdate(true)`** (+ coalescing coordinator) | **E-Phase 6** | ✅ done |
| Impl. Phase 5 | Reconnect (capped backoff) + `RESUME_GAME` resume + snappy visibility reconnect | E-Phase 8 | ✅ done |
| Impl. Phase 6 | Reduce primary polling when WS strictly healthy (1 s → ~20 s), auto-fallback | E-Phase 9 | ✅ done |
| Impl. Phase 7 | Migrate secondary pollers (journal / notifications / rematch) to WS-wake + lengthened fallback | (folded into E-Phase 9) | ✅ done |
| Mutation-coverage fix | **Broadcast tied to `gameAge` (every action) not only `saveGame`** + undo hook + game-end `completeGame` hook | **E-Phase 7** | ✅ done (full coverage — see §L.3) |
| Impl. Phase 8 | **Electron config seam** (`runtimeConfig.ts`: `apiBase` / `wsBase` / identity) — WS transport + core game-runtime HTTP routed through it, default-identical | E-Phase 13 | ✅ done |
| Impl. Phase 9 | **Route ALL premium game-runtime / analytics / lobby fetches through the seam** (journal, notifications, logs, previews [action / card-play / delta / board-cell], effect+action stats, rematch, endgame-facts, App-level overlay input submits, reset, acknowledge-draw, joinable) | E-Phase 13 | ✅ done (only admin / auth / create-game navs + asset paths remain — §E-Phase 13) |
| Impl. Phase 10 | **In-app SPA navigation infra** (`App.applyRoute` / `navigateInApp` / `popstate`) + convert **home↔create** to in-app (no page reload) | E-Phase 13 (§C.1 sub-step) | ✅ done — home↔create in-app; **game-boundary (enter/leave) stays a reload BY DESIGN** (clean-slate; the in-app boundary + ~25-singleton `resetGameSessionState()` was evaluated and **deliberately skipped** — see §E-Phase 13) |
| Impl. Phase 11 | **Legacy-nav unlink (audit)** — the premium menu / create / player flow + the in-app endgame never link to legacy pages (menu/create only point at home/create/game). Sole exception: `SpectatorHome` → `/the-end` (the in-app `EndgameExperience` is player-only, `endgameView` gated on `player-home`), a FUNCTIONAL spectator-results link — left intact | E-Phase 12 | ✅ audited clean (in-app spectator endgame is a separate enhancement, not a stray link) |
| — | Idempotency (`commandId`) | E-Phase 11 | ⏸ deferred (existing `runId` + in-flight guard suffice; see §G.8) |
| **Impl. Phase 12** | **WebSocket is the DEFAULT** — `realtimeEnabled()` (server) + `realtimeClientEnabled()` (client) default ON; cascades to refresh + poll-reduction; dev chip stays dev-only; all kill-switches preserved | new (culmination) | ✅ **done** |

**Flags (WebSocket ON by default — these are the OPT-OUT kill-switches):** `REALTIME_ENABLED=0` (server env — don't attach the gateway → legacy polling for everyone) · `?realtime=0` (client transport off) · `?realtimeRefresh=0` (observe-only, polling drives) · `?realtimePoll=0` (keep WS-refresh but safe 1 s polling). Unset / any other value = ON. See §L.6 for the graduated rollback ladder.

**The completeness guarantee this plan now makes:** *every advance of a game's `(gameAge, undoCount)` — the exact pair `/api/waitingfor` compares — emits a `GAME_STATE_INVALIDATED` to the room, so with WS healthy no scenario depends on the polling timer.* The full per-scenario matrix, guard preservation, no-polling list, rollback ladder, and acceptance criteria are in **§L**.

---

## A. Executive summary

**Is the app already close to a single-app model? — YES, decisively.**

The working hypothesis is correct. There is no SPA rewrite to do; the app is *already* a single bundle, single HTML shell, client-routed SPA, and the game page is already a fully-owned single-page runtime.

Hard evidence:

- **One webpack entry, one HTML shell.** `webpack.config.js` has a single app entry `main: './src/client/main.ts'` (plus an empty `sw` stub). Every page route on the server (`/`, `/player`, `/spectator`, `/game`, `/the-end`, `/create-game`, `/cards`, `/help`, `/admin`, `/legacy`, …) is served by `ServeApp` which redirects to the *same* `assets/index.html` shell (`src/server/routes/ServeApp.ts`). The browser loads `vendors.js` + `main.js` once.
- **Client-side screen routing already exists.** `src/client/components/App.vue` holds a reactive `screen` (the `Screen` union, App.vue:315–329) and switches between `main-menu`, `premium-create-game`, `player-home`, `spectator-home`, `game-home`, `the-end`, etc. via a `v-if` chain. On mount it reads `window.location.pathname` + `?id=` and picks the screen (App.vue:698–765). This *is* a router, just hand-rolled.
- **The game page is already a single-page runtime.** Inside a game the user stays on `/player?id=…`; `<player-home :key="playerkey">` re-renders in place, and the long-lived flows (draft, start-of-game, reveal, energy conversion, hazard cleanup, journal, notifications, rematch, **endgame**) are App-level overlays mounted as siblings of `<player-home>` so they survive the remount. There are **zero full page reloads inside a game**.
- **Identity is already stateless and URL-token-based** — perfect for reconnect/resume. `playerId`/`spectatorId` are private random tokens in `?id=`; the server is stateless (`src/server/routes/ApiPlayer.ts`, `Handler.isUser`). Opening the URL in a new tab/browser already works.
- **The change-detection signal already exists.** Every game carries a monotonic `gameAge` (bumped per log event) and `undoCount`; the poll endpoint `/api/waitingfor?id=&gameAge=&undoCount=` returns `GO | REFRESH | WAIT` purely by comparing those (`src/server/routes/ApiWaitingFor.ts:35–52`). `gameAge` is effectively a **per-game sequence number we get for free**.

**Is a broad SPA rewrite needed? — No.** The missing pieces are exactly the hypothesized ones: (1) formalize home+game as the modern surface, (2) declare the game page the owned single-page runtime (already true — just stop linking to legacy pages), (3) keep URL restore (already works), (4) add a WebSocket layer that **replaces the polling timer, not the refresh logic**, (5) leave legacy pages in the tree but unreachable from the premium journey.

**Can we preserve current game URLs? — Yes, with no changes.** `/player?id=`, `/spectator?id=`, `/game?id=`, `/the-end?id=` keep working byte-for-byte. The WS layer authenticates with the *same* `?id=` token.

**Can WebSocket migration be incremental? — Yes, and unusually safely**, because of one key insight: the client already has a central "wake up and decide whether to refresh" routine — `WaitingFor.waitForUpdate()` — gated by a 1-second `setTimeout`. We do **not** replace the refresh path. We make a WebSocket invalidation event call `waitForUpdate(immediate=true)`, i.e. the WS event simply *replaces the timer as the trigger*. Every existing guard (mid-input, open-overlay, animation holds) keeps working untouched, and polling can remain as a slow safety-net. This collapses most of the regression risk.

**Biggest opportunities**
1. Sub-second opponent updates instead of up-to-1s polling, and instant updates during simultaneous phases (draft/research) where polling is the only signal today.
2. A single, narrow server broadcast hook (the persistence boundary) instead of scattered emits.
3. Drastically reduced poll traffic (5 independent pollers today) → fewer requests, less DB churn (`saveCount`/waitingfor reads).
4. Clean foundation for Electron (single runtime, single transport).

**Biggest risks**
1. **`playerkey` remount destroying premium UI state.** The fix is mandatory: WS must route through the existing `waitForUpdate`/`updatePlayer` guards, never a raw `playerkey++`.
2. **Heroku/multi-dyno + in-memory game cache.** The app is *already* single-instance-stateful (the `GameLoader`/`Cache` hold the live game in one process). WS rooms inherit that constraint but don't worsen it. Multi-dyno needs Redis fanout *and* a shared cache — a later, joint concern.
3. **Persistence boundary completeness.** `GameLoader.saveGame()` catches ~all mutations, but **undo** (`restoreGameAt`, bumps `undoCount` with no save) and **game-end** (`completeGame` calls `Database.saveGame` directly) bypass it. The broadcast must cover all three signals (gameAge change, undoCount change, phase→END) — exactly the three things polling already compares.
4. Reconnect after dyno restart / laptop sleep must re-fetch a full snapshot (no event replay in Phase 1).

---

## B. Current architecture map

### B.1 Route / page map (server)

Central dispatcher: `src/server/server/requestProcessor.ts` — a `Map<string, IHandler>` keyed by the path constants in `src/common/app/paths.ts`, with `assets/*` and `chunks/*` wildcards (`getHandler`, line 156). The HTTP server itself is a plain `http.Server`/`https.Server` created in `src/server/server.ts:49` (`createServer()`), stored as `server` (line 82), `server.listen(...)` (line 112). **This `server` object is the WebSocket upgrade attach point.**

**HTML page routes (all serve the same `assets/index.html` SPA shell):**

| URL | Handler | Client `screen` | Modern flow? |
| --- | --- | --- | --- |
| `/` | `ServeApp` | `main-menu` (`PremiumMainMenu.vue`) | **Modern home** |
| `/create-game` | `ServeApp` | `premium-create-game` | **Modern** |
| `/player?id=` | `ServeApp` | `player-home` | **Modern game runtime** |
| `/spectator?id=` | `ServeApp` | `spectator-home` | **Modern** |
| `/game?id=` | `GameHandler` (also serves shell) | `game-home` | **Modern** (post-create lobby / link hub) |
| `/the-end?id=` | `ServeApp` | `the-end` (`GameEnd.vue`) | Legacy-ish (superseded — see note) |
| `/new-game` | `ServeApp` | `create-game-form` (legacy `CreateGameForm.vue`) | Legacy |
| `/legacy` | `ServeApp` | `start-screen` | Legacy |
| `/cards` | `ServeApp` | `cards` (card browser) | Secondary/reference |
| `/help` | `ServeApp` | `help` | Secondary/reference |
| `/load` | `Load` (serverId-gated) | `load` | Admin |
| `/admin` | `ServeApp` | `admin` | Admin |
| `/games-overview` | `GamesOverview` (serverId) | `games-overview` | Admin |
| `/login` | `Login` | `login-home` | Auth (Discord, optional) |

> **Note on `/the-end`:** In the modern flow you never navigate to it. The endgame renders *in place* on the player page: App.vue mounts `<EndgameExperience>` and `<RematchLayer>` as siblings of `<player-home>` whenever `endgameView !== undefined`. The legacy `GameEnd.vue` at `/the-end` survives only for direct links. This is itself proof the game page is a complete single-page runtime through endgame.

**JSON snapshot / API endpoints (stay HTTP):**
`/api/player`, `/api/spectator`, `/api/game`, `/api/waitingfor` (poll), `/api/game/logs`, `/api/game/journal-events`, `/api/game/effect-stats`, `/api/game/action-stats`, `/api/game/endgame-facts`, `/api/game/delta-preview`, `/api/game/board-cell-preview`, `/api/game/rematch`, `/api/action-preview`, `/api/card-play-preview`, `/api/creategame`, `/api/games/joinable`, … (all in `requestProcessor.ts` handler map).

**Action / command endpoints (stay HTTP, at least Phases 1–2):**
`POST /player/input?id=`, `POST /player/input-batch?id=`, `POST /player/acknowledge-draw?id=`, `GET /autopass?id=`, `GET /reset?id=`.

### B.2 Home page

`PremiumMainMenu.vue` (screen `main-menu`, default for `/`). The "Create game" button does a **full-page** `window.location.assign(paths.NEW_GAME_PREMIUM)` (PremiumMainMenu.vue:176). Join flow (`JoinGameCard.vue`) polls `/api/games/joinable?name=` every 6 s (`joinGamesState.ts`) and navigates full-page to `/player?id=` on join (JoinGameCard.vue:192).

### B.3 Game page by ID

`/player?id=<playerId>`. `App.mounted()` detects pathname `player`, reads `?id=`, calls `updatePlayer()` (App.vue:705–706) → `update(paths.PLAYER)` (App.vue:531) fetches `api/player + window.location.search`, sets `playerView`, bumps `playerkey`, sets `screen='player-home'`. From then on the page never reloads; all change flows through the poller + the `playerkey` remount + App-level overlays.

### B.4 Current polling map (5 independent pollers)

| Poller | File | Interval | Endpoint(s) | Drives |
| --- | --- | --- | --- | --- |
| **Primary game sync** | `WaitingFor.vue:683` `waitForUpdate()` (recursive `setTimeout`) | `settings.waitingForTimeout` = **1000 ms** | `GET /api/waitingfor?id=&gameAge=&undoCount=` → `GO`/`REFRESH`/`WAIT`; on GO/REFRESH calls `root.updatePlayer()`/`updateSpectator()` (full model fetch) | Board, panels, turn state, the whole `player-home` subtree via `playerkey++` |
| Notifications | `notifications/NotificationLayer.vue:393` (`setInterval`) | 2200 ms | `/api/game/logs`, `/api/game/journal-events` | Notification feed (esp. during simultaneous phases) |
| Journal | `journal/JournalPanel.vue:295` (`setInterval`) | 1500 ms | `/api/game/logs` | Live journal feed when open |
| Rematch | `rematch/RematchLayer.vue:170` (`setInterval`) | 2000 ms | `/api/game/rematch` | Rematch offer state after END |
| Joinable games | `mainMenu/joinGamesState.ts:85` (`setInterval`) | 6000 ms | `/api/games/joinable?name=` | Home lobby list |

Key properties of the primary poller:
- **Lightweight gate:** the 1 s tick hits `/api/waitingfor` (cheap gameAge/undoCount compare), and only fetches the full `PlayerViewModel` when something changed *and* the viewer isn't mid-prompt (`viewerHasPrompt`, WaitingFor.vue:729–745).
- **Refresh = full snapshot + remount.** `App.update()` replaces `playerView` wholesale and does `playerkey++` (App.vue:619) → destroys/recreates `<player-home>`.
- **Mid-input / overlay / animation guards** prevent the remount from nuking UI: `preserveCardPickModal`, `preserveOpenOverlay` (`playerHomeHasOpenOverlay()`, App.vue:689), and the `holdingForMarker`/`holdingForTilePlacement`/`holdingForConversion`/`holdingForHazardCleanup` animation holds in WaitingFor.vue. `isServerSideRequestInProgress` blocks concurrent submits.
- **Visibility wake:** WaitingFor listens to `visibilitychange`/`focus` to poll immediately on tab refocus.

### B.5 Current REST command flow

`WaitingFor.onsave(out)` / `onsaveBatch(responses)` → `POST paths.PLAYER_INPUT (+_BATCH) ?id=` with body `{runId, ...out}` → `src/server/routes/PlayerInput.ts:post` → `getGame(playerId)` (via `GameLoader`) → `game.getPlayerById` → `processInput` → `validateRunId` → **`player.process(entity)`** → (deferred-action queue drains) → eventually `Player.takeAction()` does `game.gameAge++` then `game.save()` → returns fresh `Server.getPlayerModel(player)` to the actor.

**The actor sees their result synchronously** (the POST response is the new model, applied via `fetchPlayerInput` → `playerkey++`). **Other players learn only by their own `/api/waitingfor` poll** detecting the `gameAge` bump. There is **no server push today** (verified: no `ws`, `socket.io`, `EventSource`, or `res.write` streaming anywhere in `src/server`).

### B.6 Persistence boundary (the broadcast hook target)

```
Player.takeAction()                      // Player.ts — gameAge++ then game.save()
   └─ Game.save()                        // Game.ts:488 — GameLoader.getInstance().saveGame(this)
        └─ GameLoader.saveGame(game)     // GameLoader.ts:199 — the central chokepoint
             └─ Database.saveGame(game)  // PostgreSQL.ts / SQLite / LocalFilesystem
```

`GameLoader.saveGame()` is reached by **player input, draft prompts (`Draft.ts:71,175`), phase transitions (`Game.ts:797,813`), and admin color change**. Two paths bypass it:
- **Undo:** `GameLoader.restoreGameAt()` (GameLoader.ts:160) reloads a prior save and does `game.undoCount++` — **no `saveGame` call**.
- **Game end:** `GameLoader.completeGame()` (GameLoader.ts:186) calls `Database.getInstance().saveGame(game)` **directly**, then `markFinished`.

So the complete "state changed" trigger set = **{ saveGame called, undoCount bumped, phase became END }** — which is exactly the three things `ApiWaitingFor` already compares. The broadcast must cover all three.

> **⚠️ Implemented correction (post-Phase-3) — the broadcast is tied to `gameAge`, not only to `saveGame`.** Hooking `GameLoader.saveGame()` alone was insufficient: `Player.takeAction()` bumps `game.gameAge++` (the exact poll signal) on **every** fully-resolved action, but only calls `game.save()` when `actionsTakenThisRound === 0 || undoOption` (Player.ts:1834). So an **intermediate** action — the *first* of a two-action turn with undo disabled (e.g. a tile placement) — advanced `gameAge` **without** saving, emitted **no** WS invalidation, and was invisible to opponents until the turn-ending save (the second action masked it). Polling hid this before; Phase 6's stretched interval (~20 s) exposed it as a real lag. **Fix:** the broadcast now mirrors the poll signal exactly. `GameLoader.notifyGameStateChanged(game)` (public; reads `gameAge`/`undoCount`/`phase` → `RealtimeHub.invalidate`) is called from **three** places: (1) `saveGame` after persistence — draft / phase transitions / admin; (2) `restoreGameAt` after `undoCount++` — undo; (3) **directly per fully-resolved not-saved action** — `Player.takeAction`'s `else` branch calls `game.notifyStateChange()` (a new `IGame` method → `GameLoader.notifyGameStateChanged`). No double emit: the save branch broadcasts via `saveGame`, the no-save branch via `notifyStateChange`. Broadcasting the in-memory `gameAge` (before/without a durable save) is correct and consistent with polling, which reads the same in-memory `gameAge`; the DB save is a durability concern, not an observability gate. `completeGame` (game-end) still isn't hooked, but is not a gap for tile placement — the final greenery/city IS an action, so it broadcasts via (3)/(1) before the END transition. Guarded by `tests/realtime/GameLoaderBroadcast.spec.ts` ("an intermediate action broadcasts even though it is not saved").

### B.7 Game cache / room substrate (already present)

`GameLoader` (singleton) + `Cache` (`src/server/database/Cache.ts`) already hold:
- `games: Map<GameId, IGame|undefined>` — the live in-memory game instances.
- `participantIds: Map<ParticipantId, GameId>` — reverse index from every `playerId`/`spectatorId` to its game.

This is the natural home for WS rooms: a room *is* a `gameId`, and the membership/auth check (`is this id a participant of this game?`) is a `participantIds.get(id) === gameId` lookup we already do on every request. **No new data model is needed to support rooms/subscriptions.**

---

## C. Recommended target architecture

### C.1 Single-app target model — **Option A (Minimal formalization). Recommended.**

Keep current URLs. Declare the existing home (`/`) + game (`/player?id=`, `/spectator?id=`, `/game?id=`) as the canonical modern surface. Stop linking to legacy pages from premium UI. Add WS inside the game runtime. This matches reality with the least churn and the least risk.

- **Option A (recommended).** Current URLs unchanged; game page is formalized as the single-page runtime (it already is); WS replaces the poll *timer*; legacy pages stay but become unlinked. Lowest complexity, zero URL breakage, trivial rollback (flip a flag → polling).
- **Option B (`/app/*` shell).** Introduce `/app`, `/app/game/:gameId`. Rejected for now: forces a redirect/compat layer over working URLs, churns the home/create/join navigation, and buys nothing the premium flow needs. Revisit only if a real client-side router (history-based, no reloads) is adopted.
- **Option C (hybrid).** Not needed — Option A is already the safe staged path; C would only matter if Option A proved risky, which it isn't.

A worthwhile *sub-step inside Option A* (independent of WS, optional): convert the 4 remaining home↔game **full-page navigations** into in-app `screen` transitions so the SPA never reloads even when entering/leaving a game. This is a small, isolated win that also helps Electron, but it is **not required** for the WS migration and should be its own phase.

### C.2 Route strategy

- Keep every existing route and handler.
- Premium UI links only ever point to: `/` (home), `/create-game`, `/player?id=`, `/spectator?id=`, `/game?id=`.
- Audit and remove links/buttons that navigate to `/new-game`, `/legacy`, `/cards`, `/help` from the *premium* journey (they may remain reachable by direct URL). The endgame already lives in-page (`EndgameExperience`), so `/the-end` is already off the premium path.
- Do **not** delete legacy pages.

### C.3 Game URL restore strategy (unchanged behavior, formalized)

```
1. User opens /player?id=<token> (or /spectator?id=, /game?id=)
2. App.mounted() reads pathname + ?id= (App.vue:698)
3. Client fetches the initial snapshot via REST (updatePlayer → /api/player)   [unchanged]
4. Client opens the WebSocket and authenticates with the SAME ?id= token       [new]
5. Client sends SUBSCRIBE_GAME / RESUME_GAME with last (gameAge, undoCount)     [new]
6. Server validates token → game (participantIds lookup) → joins room
7. On any mutation the server broadcasts GAME_STATE_INVALIDATED to the room     [new]
8. Client event handler calls the EXISTING waitForUpdate(immediate) → refresh   [new wiring, old logic]
9. On refresh/reconnect: same path; gameAge/undoCount drive a full re-fetch     [reuses existing]
```

Hard requirements preserved: direct URL works, browser refresh works, new tab works, invite/spectator links work, finished game loads in place, missing/invalid game → existing 400/403/404 branches (`ApiPlayer.ts:18–44`).

### C.4 Client sync layer (the central insight)

Introduce **one** module-singleton `src/client/components/realtime/realtimeService.ts` (mirroring the existing `journalState.ts` / `notificationState.ts` module-reactive pattern that already survives the `playerkey` remount). It owns the socket and exposes a reactive status. **It does not touch the DOM and UI never subscribes to raw sockets.** Layering:

```
WebSocket (realtimeService.ts, module singleton — survives playerkey remount)
  └─ on GAME_STATE_INVALIDATED / GAME_EVENT
       └─ "wake the existing checker": call WaitingFor.waitForUpdate(immediate=true)
            └─ GET /api/waitingfor (existing GO/REFRESH/WAIT + viewerHasPrompt guard)
                 └─ root.updatePlayer()/updateSpectator()  (existing full snapshot fetch)
                      └─ playerkey++ ONLY through the existing preserve/animation guards
                           └─ UI
```

Why route through `waitForUpdate` instead of calling `updatePlayer` directly: it reuses **every** guard for free — the mid-prompt suppression, `preserveOpenOverlay`, `preserveCardPickModal`, and the animation holds — so a WS event that arrives while you're choosing a placement, paying, or watching the energy→heat animation behaves *identically* to a poll tick that arrives at that moment (which is already battle-tested). The WS event is just a faster, push-driven replacement for the 1 s timer.

Wiring mechanism (pick one in implementation): a reactive "dirty nonce" in `realtimeService` that `WaitingFor` watches and responds to by calling `waitForUpdate(true)`, or a small event bus. Either keeps `realtimeService` UI-agnostic.

### C.5 Server realtime layer

A new singleton `src/server/server/realtime/RealtimeHub.ts`:
- `rooms: Map<GameId, Set<Connection>>`; `Connection` wraps a `ws` socket + its authenticated `ParticipantId` + last-acked `gameAge`/`undoCount`.
- `subscribe(conn, gameId)` / `unsubscribe` / `onClose`.
- `invalidate(game)` — reads `(game.id, game.gameAge, game.undoCount, game.phase)` and broadcasts `GAME_STATE_INVALIDATED` to that room.
- Lives next to / owned by `GameLoader` so it can reuse `cache.participantIds` for auth and membership.

WS server attached to the existing `http.Server` in `server.ts` via `server.on('upgrade', …)` (or `new WebSocketServer({ server, path: '/ws' })`). Auth on `CLIENT_HELLO`/`SUBSCRIBE_GAME` reuses the same token→game resolution as the REST handlers.

**Broadcast trigger (covering all three signals):** funnel through one `RealtimeHub.invalidate(game)` call from:
1. `GameLoader.saveGame()` (after the DB write resolves) — covers normal play, draft, phase transitions, admin.
2. `GameLoader.restoreGameAt()` after `game.undoCount++` — covers undo.
3. `GameLoader.completeGame()` after the final save — covers game end (phase→END).

These are 3 lines in one file area, not scattered through action handlers. Dedup is natural: one command → one `takeAction` → one `gameAge++`/`save` → one invalidate. Failed/rolled-back actions never reach `saveGame`, so they never broadcast.

> **⚠️ This original "hook `saveGame` only" design proved incomplete** — `Player.takeAction` bumps `gameAge` on every action but only `save()`s on the first-of-round / undo-on, so intermediate actions (e.g. a first-of-two tile placement with undo off) advanced `gameAge` without broadcasting. The implemented design ties the broadcast to the `(gameAge, undoCount)` pair instead. See **§B.6** (the correction) and **§L** (the full coverage matrix). Treat §L as authoritative for what triggers a broadcast.

### C.6 Polling fallback strategy

Polling stays. Behind a feature flag, when the socket is healthy: lengthen `WaitingFor`'s timer (e.g. 1 s → 15–30 s) so polling becomes a slow safety-net while WS provides the fast path. When the socket drops: restore the 1 s interval automatically. The other 4 pollers (notifications/journal/rematch/joinable) can be migrated later or simply ride the same invalidation nonce; they are not on the critical path for Phase 1.

### C.7 Future Electron compatibility notes

The single-runtime/single-transport choice already helps.
- **Centralize the API base + identity — ✅ seam shipped (impl. Phase 8).** `src/client/utils/runtimeConfig.ts` exposes `apiBaseUrl()` / `apiUrl(path)` / `wsBaseUrl()` / `identitySearch()`, resolved from an optional injected `window.tmRuntimeConfig` (an Electron preload would set it) with defaults that reproduce today's browser behaviour byte-for-byte (relative origin + `window.location`). The **WS transport** (`realtimeConfig.realtimeWsUrl()`) plus **every premium game-runtime, analytics and lobby HTTP fetch** are routed through it (impl. Phase 8 = core; impl. Phase 9 = the rest: journal, notifications, logs, action/card-play/delta/board-cell previews, effect+action stats, rematch, endgame-facts, the App-level overlay input submits, reset, acknowledge-draw, joinable). An Electron host points the client at an explicit `apiBase`/`wsBase` and injects the `participantId` (no URL bar) without touching component code. **Remaining (non-premium surfaces):** admin (games-overview / delete), auth (login / oauth), the create-game **navigations** (which become in-app transitions in Phase 10), and asset paths (webpack `publicPath`).
- **Keep transport in `realtimeService`.** Because the browser `WebSocket` and Node `ws` speak the same wire protocol, Electron's renderer reuses the exact same `realtimeService` unchanged — now that its URL derives from `wsBaseUrl()`, only the injected config differs.

---

## D. WebSocket protocol proposal

Versioned, small, invalidation-first, but not blocking richer events later. Conceptual TypeScript (to live in `src/common/realtime/`):

```ts
// Bumped on breaking wire changes.
export const REALTIME_PROTOCOL_VERSION = 1;

type GameId = `g${string}`;
type ParticipantId = `p${string}` | `s${string}`;

interface Envelope {
  protocolVersion: number;     // REALTIME_PROTOCOL_VERSION
  type: string;
  ts: number;                  // server/client clock (ms)
  correlationId?: string;      // echoes a client request; later: command idempotency
}

// ---- Client → Server ----
interface ClientHello extends Envelope {
  type: 'CLIENT_HELLO';
  clientVersion: string;       // build id (settings.head)
  participantId: ParticipantId;// same token as ?id=
}
interface SubscribeGame extends Envelope {
  type: 'SUBSCRIBE_GAME';
  gameId: GameId;              // or derive from participantId server-side
}
interface ResumeGame extends Envelope {
  type: 'RESUME_GAME';
  gameId: GameId;
  lastGameAge: number;         // resume cursor (already monotonic per game)
  lastUndoCount: number;
}
interface UnsubscribeGame extends Envelope { type: 'UNSUBSCRIBE_GAME'; gameId: GameId; }
interface Heartbeat extends Envelope { type: 'PING'; }
// Phase 3 (optional): interface ClientCommand extends Envelope { type:'CLIENT_COMMAND'; ... }

// ---- Server → Client ----
interface ServerHello extends Envelope {
  type: 'SERVER_HELLO';
  serverVersion: string;       // settings.head / runId
  protocolVersion: number;
}
interface GameStateInvalidated extends Envelope {
  type: 'GAME_STATE_INVALIDATED';   // "re-check / refresh state"
  gameId: GameId;
  gameAge: number;             // == sequence number
  undoCount: number;
  phase?: string;              // END etc.
}
interface GameEvent extends Envelope {
  type: 'GAME_EVENT';          // Phase 3: "this concrete thing happened" (richer payload, optional)
  gameId: GameId;
  seq: number;                 // == gameAge at emit
  event: unknown;              // e.g. a journal root summary; never authoritative state
}
interface FullSnapshotRequired extends Envelope {
  type: 'FULL_SNAPSHOT_REQUIRED';   // client must re-fetch via REST (gap / can't replay)
  gameId: GameId;
}
interface ProtocolIncompatible extends Envelope {
  type: 'PROTOCOL_INCOMPATIBLE'; minClientVersion?: string;
}
interface ServerError extends Envelope { type: 'ERROR'; code: string; message: string; }
interface HeartbeatAck extends Envelope { type: 'PONG'; }
```

**Versioning.** `protocolVersion` on every envelope; on mismatch the server replies `PROTOCOL_INCOMPATIBLE` and the client falls back to pure polling (never breaks the game). `clientVersion`/`serverVersion` carry the build id for diagnostics.

**Subscription model.** A room == `gameId`. Auth = the participant token resolves (via `cache.participantIds`) to that game. Spectators may subscribe to their game's room (read-only). One socket can hold one game subscription in practice (the client only ever views one game).

**Invalidation vs event vs snapshot.**
- *Invalidation* (`GAME_STATE_INVALIDATED`) = "something changed at gameAge N; go refresh." **This is all Phase 1 needs.**
- *Event* (`GAME_EVENT`) = optional richer "this happened" payload for Phase 3 (e.g. to feed notifications/journal directly without a separate poll). Never authoritative.
- *Snapshot* = the existing REST `/api/player` full model; the authoritative reload, always available.
- *Command result* stays the existing `POST /player/input` response (separate from broadcasts).

**Reconnect / resume.** `gameAge` is the resume cursor (already monotonic per game). On reconnect, `RESUME_GAME {lastGameAge, lastUndoCount}`. Server compares with the live game: unchanged → idle; changed → `GAME_STATE_INVALIDATED` (Phase 1: client re-fetches the full model — no replay needed because the full model is cheap and already the polling behavior). Phase 2 may add `FULL_SNAPSHOT_REQUIRED` when a real gap-detection/event-log exists.

**Error handling.** Any malformed/typed error → `ERROR`. Any uncertainty (gap, stale, can't auth a resume) → fall back to REST refresh and/or polling. The protocol's failure mode is always "degrade to today's behavior," never "break the game."

---

## E. Migration plan (safe phases)

Each phase is independently shippable and reversible. **Polling is not removed until Phase 9, and never fully removed (emergency fallback stays).**

### Phase 1 — Audit & classify (no code change)
- **Goal:** lock the route/poll/command/refresh map (this document).
- **Scope:** docs only.
- **Risk:** none. **Acceptance:** team agrees on Option A + the broadcast trigger set. **Rollback:** n/a.
- **Don't change:** anything.

### Phase 2 — Formalize home + game flow (optional, independent of WS)
- **Goal:** premium UI never *links* to legacy pages; (optionally) convert the 4 home↔game full-page navigations to in-app `screen` transitions.
- **Scope:** `PremiumMainMenu.vue`, `JoinGameCard.vue`, `PremiumCreateGame.vue`, `GameExitButton.vue`, `CreateGameForm.vue` (legacy left as-is).
- **Areas:** App.vue `screen`, `window.history.replaceState` (already used for `game-home`).
- **Risk:** low-medium (touches navigation). **Acceptance:** entering/leaving a game keeps state where intended; direct URLs unchanged. **Rollback:** revert nav changes.
- **Don't change:** server routes, polling, command flow.

### Phase 3 — WS server + client diagnostics, no gameplay change
- **Goal:** prove the transport. Attach `ws` to the `http.Server` (`server.ts`), a `/ws` endpoint, `CLIENT_HELLO`/`SERVER_HELLO`/heartbeat only. Client `realtimeService` connects, logs status; a dev-only connection indicator.
- **Scope:** `server.ts`, new `src/server/server/realtime/`, new `src/client/components/realtime/realtimeService.ts`, dev indicator.
- **Risk:** low (no game logic touched). **Acceptance:** connect/heartbeat/disconnect works on local + staging + Heroku; no effect on gameplay. **Rollback:** feature flag off → no socket opened.
- **Don't change:** polling, refresh, command flow, any game state.

### Phase 4 — Game subscription (no broadcast yet)
- **Goal:** `SUBSCRIBE_GAME`/`RESUME_GAME`; server joins the room via `cache.participantIds` auth; logs membership.
- **Scope:** `RealtimeHub`, `realtimeService`.
- **Risk:** low. **Acceptance:** correct room membership; spectators allowed; unauthorized token rejected with `ERROR`. **Rollback:** flag off.
- **Don't change:** no broadcasts emitted yet.

### Phase 5 — Emit generic invalidation after ONE safe mutation
- **Goal:** call `RealtimeHub.invalidate(game)` from **`GameLoader.saveGame()` only**; server-side log the broadcast. Client logs receipt but does NOT yet refresh on it.
- **Scope:** `GameLoader.ts`.
- **Risk:** low (observe-only on client). **Acceptance:** opponent's normal action produces a broadcast the other clients log. **Rollback:** remove the one call / flag off.
- **Don't change:** client refresh still polling-driven.

### Phase 6 — Wire invalidation to the existing refresh ✅ **(shipped as impl. Phase 4)**
- **Goal:** on `GAME_STATE_INVALIDATED`, the client wakes the EXISTING guarded refresh — `WaitingFor.waitForUpdate(immediate=true)` — never a raw `playerkey++`, never a direct `updatePlayer`. Polling interval unchanged in this phase (still 1 s).
- **How it shipped:** `realtimeService` (on the invalidation, if `?realtimeRefresh` is on) → `notifyGameInvalidated()` → the **coalescing coordinator** `realtimeSync.ts` (60 ms burst window + ≥400 ms min-interval so opponent multi-save turns can't storm the refresh) → a "wake" → `WaitingFor`'s registered wake listener (mirrors the proven `visibilitychange`/`focus` handler) → `waitForUpdate(true)`. The `/api/waitingfor` GO/REFRESH/WAIT logic + `viewerHasPrompt` + `updatePlayer`'s `preserveOpenOverlay`/`preserveCardPickModal`/animation-hold guards run **unchanged**. The wake mechanism is a plain listener registry — UI never touches the raw socket.
- **Scope:** `src/client/components/realtime/{realtimeService,realtimeSync}.ts`, `WaitingFor.vue` (one wake subscription in `mounted`/`unmounted` + the existing interval call). No server change (broadcast already exists from impl. Phase 3).
- **Guards preserved (mandatory):** the WS event behaves identically to a poll tick arriving at that instant — see §L.4 for every edge UI state. **The `playerkey` remount path is untouched; a WS event can only reach `playerkey++` through the same `App.update()` guards a poll tick would.**
- **Acceptance:** Player B sees Player A's action sub-second (~≤200 ms); a burst of A's saves coalesces to one refresh (no storm); mid-input/overlay/animation states are NOT disrupted (§L.4, §H.2). With `?realtimeRefresh=0` → observe-only, polling drives.
- **Rollback:** `?realtimeRefresh=0` (client, instant) → observe-only + polling; or `?realtime=0` / `REALTIME_ENABLED` off → full legacy. See §L.6.
- **Full coverage of WHICH mutations reach this wiring:** §L.3.

### Phase 7 — Cover ALL state mutations ✅ **(shipped — full coverage incl. the game-end hook)**
- **Goal:** guarantee that **every** advance of `(gameAge, undoCount)` broadcasts — not just the ones that happen to call `saveGame`. This is the completeness guarantee; §L is the authoritative matrix.
- **What shipped:** the broadcast was re-tied to the `(gameAge, undoCount)` signal via one public helper `GameLoader.notifyGameStateChanged(game)`, called from **four** places (see §B.6 / §L.1): (1) `saveGame` after persistence — start-of-turn snapshot, draft, phase/generation transitions, admin; (2) `restoreGameAt` after `undoCount++` — **undo**; (3) `Player.takeAction`'s `else` branch (`game.notifyStateChange()`) — a fully-resolved **intermediate action** that advanced `gameAge` without persisting (the first-of-two tile-placement bug); (4) `completeGame()` after the direct end-save — **game-end** belt-and-braces. No double emit for the action paths (save branch vs no-save branch are mutually exclusive); the game-end emit is a redundant certainty hook (empty-room no-op).
- **Scope:** `Player.ts`, `Game.ts` + `IGame`, `GameLoader.ts` + `IGameLoader` (all shipped). Client wiring already done in Phase 6.
- **Risk:** low — the added calls are state-neutral (a broadcast to an empty room is a no-op; verified across 1592 base/game tests unchanged).
- **Acceptance:** an opponent's FIRST-of-two action (undo off) is visible immediately; undo propagates; every scenario in §L.3/§L.5 propagates without a polling wait. Guarded by `tests/realtime/GameLoaderBroadcast.spec.ts` ("an intermediate action broadcasts even though it is not saved").
- **Rollback:** the broadcast calls are behind the same room (empty when WS off) — with `REALTIME_ENABLED` off they are no-ops; no separate rollback needed.
- **Secondary feeds (journal / notifications / rematch)** were migrated to the same wake in impl. Phase 7: they refetch on the invalidation + a lengthened fallback. Rematch state lives outside the game mutation stream, so `ApiGameRematch` broadcasts a room invalidation after each rematch action. Lobby (`/api/games/joinable`) is deliberately NOT migrated (not a game room). See §L.5.

### Phase 8 — Reconnect / fallback hardening
- **Goal:** auto-reconnect with backoff; resubscribe + `RESUME_GAME`; premium "reconnecting" status; on resume-changed → refresh. Verify Heroku dyno-restart / laptop-sleep recovery.
- **Scope:** `realtimeService`, a small reconnect UI state.
- **Risk:** medium. **Acceptance:** the §H disconnect/reconnect/sleep/restart scenarios all recover with no stale UI and no double actions. **Rollback:** flag off → polling.
- **Don't change:** protocol shape.

### Phase 9 — Reduce polling behind a flag
- **Goal:** when WS healthy, lengthen `WaitingFor` timer (1 s → 15–30 s); restore 1 s on disconnect. Keep an emergency "force-poll" flag.
- **Scope:** `WaitingFor.vue` interval logic + flag.
- **Risk:** medium. **Acceptance:** with WS up, games are fully playable at the long interval; killing WS falls back seamlessly. **Rollback:** flag → 1 s polling always.
- **Don't change:** never delete polling.

### Phase 10 — Sequence / snapshot fallback (optional, Phase-2-of-protocol)
- **Goal:** carry `gameAge` as `seq`; client detects gaps on resume → `FULL_SNAPSHOT_REQUIRED` → full re-fetch. (No event-log persistence required — full re-fetch is the snapshot.)
- **Risk:** low (full re-fetch is already the safe default). **Acceptance:** simulated missed events → exactly one clean full reload.

### Phase 11 — Idempotency / correlation (optional, only if needed)
- **Goal:** add `commandId`/`correlationId` to inputs if duplicate-submit risk proves real. Note today's mitigations already exist: `runId` validation (`validateRunId`) + `isServerSideRequestInProgress` concurrency block. So this is likely deferrable.
- **Risk:** medium (touches command path). **Acceptance:** double-click / retry / reconnect cannot double-apply. **Rollback:** ignore the field server-side.

### Phase 12 — Unlink legacy pages from premium navigation
- **Goal:** ensure no premium button/link reaches `/new-game`, `/legacy`, `/cards`, `/help` (keep reachable by URL).
- **Risk:** low. **Acceptance:** premium journey never lands on a legacy screen. **Rollback:** restore links.
- **Don't change:** don't delete legacy code.

### Phase 13 — Electron-readiness prep (no Electron) 🟡 **(started — impl. Phase 8)**
- **Goal:** centralize `apiBase` + `wsBase` + identity so the game runtime never hard-codes `window.location` for transport; a future Electron host injects config, not URL bar.
- **What shipped:** `src/client/utils/runtimeConfig.ts` (the seam; defaults = today's browser behaviour). The WS transport + the **core** game-runtime HTTP (snapshot fetch, waitingfor poll, player input) now go through `apiUrl`/`wsBaseUrl`/`identitySearch`. See §C.7.
- **Electron migration checklist:**
  1. ✅ **Premium HTTP fetches routed** (impl. Phase 9) — journal / notifications / logs / previews / stats / rematch / endgame / overlay input / joinable all go through `apiUrl`/`identitySearch`. Remaining un-routed: **admin** (games-overview / delete), **auth** (login / oauth) — non-premium ops surfaces, wrap when/if Electron needs them.
  2. **Full-page navigations → in-app `screen` transitions (impl. Phase 10, PARTIAL).** The in-app router infra shipped: `App.applyRoute()` (extracted from `mounted`, resolves screen + data-load from the URL), `App.navigateInApp(path)` (`history.pushState` + `applyRoute`, no reload), and a `popstate` listener for back/forward. **Done:** home↔create (`PremiumMainMenu` "Create game", `PremiumCreateGame` "Back") are now in-app — both non-game screens, zero stale-state risk. **Game-boundary = a page reload, BY DESIGN (evaluated + deliberately NOT made in-app).** The create/join → player and exit → home navigations stay `window.location.assign(...)`. Reasoning: the fork has **~25 module-level per-game state singletons** (feeds, flows, overlays, selections, board/animation transients, realtime, notifications, journal, draft, hand flows, placement, endgame, rematch — only ~14 have reset functions today) that all assume a fresh page per game; a full reload resets them for free. Making the boundary in-app would require a `resetGameSessionState()` that perfectly clears all ~25 (a miss = a silent stale-state bug on the *2nd game in a session*). **Crucially, this is NOT needed for Electron:** a packaged Electron app enters a game by RELOADING the packaged page with the new identity (`window.location.href`/renderer reload → re-inits everything cleanly, exactly like the browser reload), and the Phase-8 `runtimeConfig` seam already supplies `apiBase`/`wsBase` + the injected `participantId`. So the reload boundary works identically in browser and Electron, gives a guaranteed clean slate, and avoids the fragile reset audit. The only in-game benefit would have been "no reload flash entering a game" in the browser — not worth the risk. (The remaining Electron entry-flow item is small: route the create/join **home-surface** fetches through `apiUrl`, §L.8 admin/auth note, and confirm the Electron reload-with-identity strategy.)
  3. **Asset paths** — confirm `vendors.js`/`main.js`/`styles.css`/`assets/*` (incl. the `main.ts` locale fetch) load under `file://` or a packaged base (webpack `publicPath`); today `publicPath: '/'` assumes a web root.
  4. **Identity storage** — the browser keeps identity in the URL; an Electron app persists `{gameId, participantId}` and injects it via `tmRuntimeConfig` (the seam already reads `config.participantId`).
- **Risk:** low (additive, default-identical). **Acceptance:** with `window.tmRuntimeConfig = {apiBase, wsBase, participantId}` set, the core runtime talks to an explicit host; guarded by `tests/realtime/runtimeConfig.spec.ts`. **Rollback:** the seam defaults to relative origin — unsetting the config restores browser behaviour.

---

## F. Suggested first implementation PR (smallest proof, low risk)

**"WS transport + diagnostics, subscribe-to-game, zero gameplay change."** = Phases 3–5 server side as observe-only, behind a feature flag default-off.

Includes:
1. `ws` dependency; attach a `WebSocketServer` to the existing `http.Server` in `src/server/server.ts` at a `/ws` path (`server.on('upgrade')`), behind `process.env.REALTIME_WS` (default off).
2. `src/server/server/realtime/RealtimeHub.ts` — rooms `Map<GameId, Set<Connection>>`, auth via `GameLoader`'s `cache.participantIds`, `subscribe`/`unsubscribe`/`onClose`, structured connect/subscribe logs (gameId, participantId, room size).
3. `src/common/realtime/` protocol types (`CLIENT_HELLO`, `SERVER_HELLO`, `SUBSCRIBE_GAME`, `PING`/`PONG`, `protocolVersion`).
4. `src/client/components/realtime/realtimeService.ts` — module singleton; connects when on `player-home`/`spectator-home`, sends `CLIENT_HELLO` + `SUBSCRIBE_GAME` with the `?id=` token, heartbeats, logs status; a dev-only connection-status chip (gated on a debug pref).
5. **One** `RealtimeHub.invalidate(game)` call in `GameLoader.saveGame()` that only logs + broadcasts to the room; the client logs receipt but **does not refresh** yet.

Explicitly **not** in the first PR: no change to polling, no change to the refresh/`playerkey` path, no change to command handling, no client behavior change, no legacy-page changes. Flag off → byte-identical to today.

Acceptance for the first PR: with the flag on, two browsers in the same game show server logs for connect/subscribe and an invalidation broadcast on each action, while gameplay is visually unchanged; with the flag off, nothing connects.

---

## G. Risks & open questions (decisions needed before implementation)

1. **Route strategy:** confirm **Option A** (keep URLs, formalize, unlink legacy) vs introducing `/app/*` (Option B). Recommendation: A.
2. **Library:** confirm **raw `ws`** (recommended — see §I) vs Socket.IO.
3. **WS path & auth:** `/ws` with token in the first message vs in the upgrade query string; reuse the `?id=` token (recommended) vs a derived short-lived ticket. Spectator subscribe policy (recommended: allowed, read-only).
4. **Broadcast completeness:** agree the trigger set = {`GameLoader.saveGame`, `restoreGameAt` undo, `completeGame` end}. Decide whether to also emit on the 4 secondary feeds (notifications/journal/rematch) in Phase 1 or defer.
5. **Event persistence / replay:** Phase 1 uses pure invalidation + full re-fetch (no event log). Decide if/when a persisted per-game event log is worth it (only needed for true replay; `gameAge` already gives a sequence).
6. **Redis / multi-dyno timing:** the app is already single-instance-stateful (in-memory game cache pins a game to one dyno). Decide explicitly that **single dyno is the supported topology for now**; multi-dyno (Redis pub/sub fanout + shared/affinity cache) is a separate, larger initiative — WS doesn't change that calculus.
7. **Fallback policy:** the exact "WS healthy" definition and the long polling interval (15 s? 30 s?) in Phase 9; whether to also reduce the secondary pollers.
8. **Idempotency:** decide if Phase 11 is needed given existing `runId` + `isServerSideRequestInProgress` guards (likely defer).
9. **Legacy route handling:** confirm legacy pages stay in the codebase but unlinked (no deletion).
10. **Client identity/config for Electron:** when to centralize `apiBase`/identity off `window.location` (Phase 13).

---

## H. Premium UI regression risks (must protect) + testing scenarios

### H.1 The one structural risk: `playerkey` remount
The premium UI's correctness under refresh hinges on `App.update()`'s guards: `preserveOpenOverlay` (`playerHomeHasOpenOverlay()`, App.vue:689), `preserveCardPickModal`, and the WaitingFor animation holds (`holdingForMarker`/`-TilePlacement`/`-Conversion`/`-HazardCleanup`). **Rule: WS-driven refresh MUST go through `waitForUpdate(immediate)` → `updatePlayer()`, never a raw `playerkey++`.** Any code path that force-remounts on a WS event would destroy open overlays, draft/placement/payment modals, fullscreen previews, hover popovers, and animation sequences. This is the single most important guardrail.

Specific premium areas and why each is safe *if* the rule holds (each is already exercised by today's 1 s poll arriving mid-interaction):
- **Board layout/scale** (`--board-scale`, `useBoardAutoScale`): updated on remount; WS just changes timing, guards unchanged.
- **Hover previews / fullscreen `CardZoomModal` / disabled-action reason popovers:** live in App-level or guarded overlays; `preserveOpenOverlay` keeps them.
- **Actions overlay / play modal / confirm modal / payment:** `MandatoryInputModal` + `preserveCardPickModal`; a mid-payment WS invalidation is suppressed exactly like a mid-payment poll tick (`viewerHasPrompt`).
- **Placement waiting banner + placement lock:** `holdingForTilePlacement`; WS must not bypass it.
- **Energy→heat conversion / hazard cleanup transitions:** `holdingForConversion`/`-HazardCleanup` + `isEnergyConversionActive()`/`isHazardCleanupActive()` gates in `App.update()` (App.vue:552). WS invalidation routed through the same path inherits these holds.
- **Draft & purchase flow:** `DraftFlowOverlay` is App-level (survives remount); the WS upside here is real (simultaneous phase) — but it must still flow through the guarded refresh.
- **Colonies overlay, victory reveal, hidden-VP, journal cause/effect cluster, player panels, realtime waiting cubes:** all already poll-driven; WS only changes the trigger.

### H.2 Test plan

**Automated**
- *Protocol unit tests* (`src/common/realtime/`): envelope validation, version-mismatch handling, message discriminated-union parsing.
- *Server subscription/broadcast tests*: `RealtimeHub.subscribe` auth (valid token joins, foreign token rejected, spectator read-only), `invalidate` fans out to exactly the room, dedup (one save → one broadcast), no broadcast on rolled-back action. Use the existing `testGame()`/`GameLoader.newTestInstance` harness.
- *Client invalidation tests* (`mochapack`): a `GAME_STATE_INVALIDATED` triggers exactly one `waitForUpdate(immediate)`; mid-prompt invalidation does NOT refresh; reconnect resubscribes.
- *Idempotency tests* (if Phase 11): duplicate submit / retry cannot double-apply (today: assert `isServerSideRequestInProgress` + `runId` reject).

**Manual multiplayer matrix (the acceptance scenarios)**
1. A plays a card → B sees it sub-second, no manual refresh.
2. A is choosing placement while B watches → B updates; A's placement banner/lock intact.
3. Draft selection updates correctly for all seats (simultaneous phase — the biggest WS win).
4. Card purchase / research flow stays stable across an opponent's concurrent action.
5. Colonies/trade updates propagate.
6. Journal updates without manual refresh.
7. Victory reveal + rematch start for all clients (Phase 7 path).
8. Hidden-VP flow not broken (no premature reveal via a stray refresh).
9. Client disconnect → reconnect → resubscribe → state correct, no double actions.
10. Client misses events (kill socket, mutate, restore) → exactly one clean full reload.
11. WS fully down → polling fallback keeps the game playable end-to-end.
12. Energy→heat conversion + tile-placement + hazard-cleanup animations not interrupted by an opponent's concurrent action over WS.
13. **First-of-two action, undo OFF:** A places a tile on the FIRST of a two-action turn → B sees it **immediately** (not only after A's turn ends). This is the specific regression — cross-checked against §L.3 and `GameLoaderBroadcast.spec.ts`.
14. **Undo:** A undoes an action → B reflects the rollback over WS.
15. **Game end:** the final greenery/scoring → all clients refresh into END; endgame overlay + rematch appear without polling.
16. **Coalescing:** A takes a rapid multi-step turn (several saves) → B refreshes a bounded number of times (no storm), landing on the final state.

The full per-scenario coverage, the "polling no longer required" list, and the consolidated acceptance criteria are in **§L** (this matrix is the hands-on subset).

**Environment**
- Local two-browser, staging two-account, Heroku dyno-restart recovery, laptop-sleep/tab-sleep resume, long-running multi-generation game.

---

## I. Library choice — recommend **raw `ws`**

| Criterion | `ws` (recommended) | Socket.IO |
| --- | --- | --- |
| Fit for turn-based, low-volume board game | Excellent — tiny message rate, invalidation-only | Overkill for the message profile |
| Protocol control / strictness | Full — we own a small versioned envelope | Adds its own framing/handshake/packet semantics |
| TS ergonomics | Plain typed messages over a thin wrapper | Typed but via its own client API |
| Attach to existing `http.Server` | Direct (`new WebSocketServer({ server })` / `server.on('upgrade')`) | Also attaches, heavier |
| Rooms/subscriptions | Trivial — `Map<GameId, Set<conn>>` (we already have the participant index) | Built-in rooms (convenience we don't need) |
| Reconnect | We implement backoff (small, ~30 lines) | Built-in (the main convenience) |
| Heroku | Native WS works | Works; risks long-poll fallback masking real WS issues |
| Bundle size (Electron + web) | Minimal | Larger client lib |
| Multi-dyno later | Manual Redis adapter (same effort as our cache problem) | Has a Redis adapter (but our cache, not the adapter, is the real blocker) |
| Maintainability in this codebase | Matches the fork's "thin, owned, co-located" style | Adds an abstraction the team must learn |

Socket.IO's only real edge is auto-reconnect + rooms boilerplate, which is small here because (a) the room model is a one-line map keyed by `gameId` we already maintain, and (b) reconnect is a short backoff loop. Its abstraction (custom protocol, long-poll fallback that can hide WS problems on Heroku, bigger bundle) works against the strict, small, Electron-friendly transport we want. **Recommend `ws`.**

---

## J. Observability & debugging (Phase 3+)

- **Server logs:** connect / disconnect / subscribe / unsubscribe with `{gameId, participantId, roomSize}`; each broadcast with `{gameId, gameAge, undoCount, phase, recipients}`. Reuse the existing `console-stamp` + `prom-client` setup (`server.ts`).
- **Metrics (prom-client, like the existing `gameloader_*`/`game_created` gauges):** active sockets, rooms, reconnects, broadcasts, missed-event/full-snapshot-fallback counts.
- **Client dev indicator:** a connection-status chip (connected / reconnecting / polling-fallback) gated on a debug preference (mirrors `debug_view` in `PreferencesManager`). Never a native tooltip — use the fork's `.premium-tooltip`.
- **Clear disconnected state:** when WS is down and polling is the fallback, the UI must visibly say "live updates degraded — using fallback," never silently go stale.
- **correlationId** echoed through for tracing a client request → its broadcast.

---

## K. Hypothesis verdict (explicit)

> *"The app may already be close to a single-app architecture; the missing pieces are formalizing the home/game flow, owning the game page as a single-page runtime, preserving URL restore, replacing polling with WebSocket, and unlinking legacy pages."*

**Confirmed in full.** One webpack bundle, one HTML shell, client-side screen switching, an in-place game runtime (overlays survive remount; endgame renders in-page), stateless URL-token identity that already supports refresh/new-tab restore, and a built-in monotonic `gameAge`/`undoCount` change signal that maps directly onto WS sequence/resume. The migration is not an SPA rewrite; it is: add a `ws` gateway on the existing `http.Server`, broadcast generic invalidation from the `GameLoader` persistence boundary, route that into the existing `waitForUpdate` refresh, and keep polling as a flagged fallback. Risk is dominated by one rule — **never bypass the existing refresh guards / never raw-`playerkey++` on a WS event** — which the phased plan enforces.

---

## L. Guaranteed WS-only state synchronization (all mutation scenarios)

This section is the **authoritative** statement of what the realtime layer guarantees: *with WS healthy, every change to authoritative game state reaches every subscribed client over `GAME_STATE_INVALIDATED` → the existing guarded refresh, with no dependency on the polling timer.* Polling remains only as an automatic fallback when WS is unhealthy. It supersedes the earlier "hook `saveGame`" framing (§C.5) with the implemented `(gameAge, undoCount)`-based design.

### L.0 The invariant (why coverage is complete by construction)

A client's observable version of a game is exactly the pair **`(gameAge, undoCount)`** — the pair `/api/waitingfor` compares to return `GO | REFRESH | WAIT` (`ApiWaitingFor.ts:35–52`). Therefore:

> **A client is guaranteed in sync iff every advance of `(gameAge, undoCount)` produces a `GAME_STATE_INVALIDATED` to the room.**

The server broadcast is wired to that pair (not to `saveGame`), and the client turns each invalidation into the SAME `/api/waitingfor` re-check the poll timer would have done. So the WS path and the poll path converge on identical, already-battle-tested behavior — the WS event is just a faster trigger.

### L.1 Broadcast trigger set (server) — mirrors the poll signal exactly

One helper — `GameLoader.notifyGameStateChanged(game)` (reads `gameAge`/`undoCount`/`phase` → `RealtimeHub.invalidate` → the room; no-op for an empty room; never throws) — fired from:

1. **`saveGame()`** after the DB write resolves — start-of-turn snapshot, draft picks, phase/generation transitions, admin color change.
2. **`restoreGameAt()`** after `undoCount++` — **undo**.
3. **`Player.takeAction()` else-branch** via `game.notifyStateChange()` — a fully-resolved action that advanced `gameAge` but is **not** persisted (an intermediate action with undo disabled). Mutually exclusive with (1): the save branch broadcasts through `saveGame`, the no-save branch through `notifyStateChange` → exactly one broadcast per action.
4. **`completeGame()`** after the direct end-save — game-end belt-and-braces (see L.3).

### L.2 Client refresh wiring (the Phase-6 path, in detail)

```
GAME_STATE_INVALIDATED (server → room)
  └─ realtimeService.onMessage  (records lastKnownGameAge/undoCount; if ?realtimeRefresh on:)
       └─ realtimeSync.notifyGameInvalidated()      ← coalesces bursts (60ms window, ≥400ms min-interval)
            └─ a single "wake"  →  every onRealtimeWake listener
                 └─ WaitingFor's listener (mounted alongside the visibility/focus handler)
                      └─ waitForUpdate(true)         ← the EXISTING poll routine, immediate
                           └─ GET /api/waitingfor    ← existing GO/REFRESH/WAIT + viewerHasPrompt
                                └─ updatePlayer()/updateSpectator()  ← existing full-snapshot fetch
                                     └─ App.update() guards → playerkey++ ONLY if safe
                                          └─ UI
```

**Non-negotiable:** the wake NEVER calls `updatePlayer` directly and NEVER does a raw `playerkey++`. It only ever calls `waitForUpdate(true)`, so `viewerHasPrompt`, `preserveOpenOverlay`, `preserveCardPickModal`, and the animation holds all apply unchanged.

### L.3 State-mutation coverage matrix

Every way authoritative game state changes, and how each is synced without polling. "Trigger" = which L.1 hook fires; "Polling needed?" assumes WS healthy.

| Scenario | `(gameAge/undoCount)` change | Broadcast trigger | Client sync path | Polling needed? |
| --- | --- | --- | --- | --- |
| Single / last action of a turn | gameAge++ + save | L.1(1) | wake → refresh | **No** |
| **Intermediate action (first of two, undo OFF)** — incl. a tile placement | gameAge++, **no save** | **L.1(3)** | wake → refresh | **No** (was the bug; now covered) |
| Any action with `undoOption` ON | gameAge++ + save (every action) | L.1(1) | wake → refresh | **No** |
| Tile placement (city/greenery/ocean; card or standard project) | it IS an action | L.1(1)/(3) | wake → refresh (incl. placement animation via `holdingForTilePlacement`) | **No** |
| Opponent action (viewer's perspective) | opponent's gameAge++ | L.1(1)/(3) | viewer has no prompt → refresh | **No** |
| Draft / research pick (simultaneous phase) | draft save | L.1(1) | all seats wake → refresh (the biggest win — polling was the only signal) | **No** |
| **Undo** (any player) | undoCount++ | L.1(2) | wake → refresh | **No** |
| Production / generation roll-over (income, energy→heat conversion) | phase-transition saves | L.1(1) | wake → refresh (conversion animation via `holdingForConversion`) | **No** |
| World Government Terraforming / global-parameter change | action / save | L.1(1)/(3) | wake → refresh | **No** |
| Colony trade / build | it IS an action | L.1(1)/(3) | wake → refresh | **No** |
| **Game end** (Mars terraformed / last solo generation) | final action + END phase transitions save + `completeGame` | L.1(1)/(3)/(4) | wake → refresh into END → endgame overlay + rematch mount | **No** |
| Rematch offer/accept/decline/cancel (post-END) | NOT game state | `ApiGameRematch` room invalidation | RematchLayer wakes → refetch | **No** |
| **Reconnect / resume** (network loss, dyno restart, tab sleep) | possibly advanced while away | `RESUME_GAME` → server compares cursor → `GAME_STATE_INVALIDATED` if changed | wake → single full refresh; `/api/waitingfor` de-dups if already current | **No** (WS recovers; polling is the ultimate fallback) |
| Journal / notification feed | derived from game logs | rides the same wake (impl. Phase 7) | refetch on wake + lengthened fallback | **No** |
| Home lobby list | not a game room | — (deliberately not migrated) | own 6 s poll | **Yes** (out of scope) |

**Game-end detail.** The END state is observable *before* `completeGame` anyway: the last scoring action broadcasts (L.1(1)/(3)) and the phase transitions into `SOLAR`/`END` each `save()` → broadcast, so every client refreshes into `phase === END` and the App-level `EndgameExperience` + `RematchLayer` mount. `completeGame()` now **also** emits `notifyGameStateChanged(game)` (L.1(4)) — a redundant certainty hook (empty-room no-op), guarded by `GameLoaderBroadcast.spec.ts` ("completeGame broadcasts the end state").

### L.4 Guard preservation & the `playerkey` remount path (edge UI states)

The single structural risk is a refresh destroying premium UI mid-interaction. The WS event is routed so it behaves **identically to a poll tick arriving at that exact moment** — a path that has always existed and is battle-tested. Per edge state:

- **Viewer mid-prompt** (choosing a placement / payment / target / card): `viewerHasPrompt` (`waitingfor !== undefined && !optional`) → `/api/waitingfor` still updates the live `playersWaitingFor` cubes, but `updatePlayer` (the full refresh) is **skipped** → the partial input is preserved. So an opponent's action reaching a viewer who is mid-decision updates the "who's waiting" indicator without nuking their form.
- **Open informational overlay** (Cards / Actions / Effects / Played / Colonies / Journal / VP): `preserveOpenOverlay` (`playerHomeHasOpenOverlay()`) → `playerView` updates reactively **without** a `playerkey++` remount → the overlay stays open on the same selection.
- **Draft / buy-cards modal:** `preserveCardPickModal` → no remount.
- **Animation in flight** (tile placement / energy→heat / hazard cleanup): `holdingForTilePlacement` / `holdingForConversion` / `holdingForHazardCleanup` + the `isEnergyConversionActive()` / `isHazardCleanupActive()` gates in `App.update()` **defer** the commit until the animation finishes.
- **App-level overlays** (draft, start-of-game, drawn-card reveal, energy conversion, hazard cleanup, endgame, rematch, journal, notifications): mounted as siblings of `<player-home>`, so they **survive** the `playerkey++` remount by construction — a WS refresh can't tear them down.
- **The acting player mid-turn** (has a next-action prompt after an intermediate action): receives the wake too, but `viewerHasPrompt` skips the full refresh → their own board/hand state is intact; they already have the authoritative result from their own `POST /player/input` response.
- **Spectator:** `WaitingFor` is mounted (hidden) in `SpectatorHome` too, so spectators get the same wake → `updateSpectator()` path.

**Rule restated:** a WS invalidation may only ever reach `playerkey++` through `App.update()`'s existing guards. No code path force-remounts on a raw WS message. This is enforced by the wiring (the wake calls `waitForUpdate(true)`, nothing else) and asserted in the client tests (a mid-prompt invalidation must not trigger a full refresh).

### L.5 Cases where POLLING IS NO LONGER REQUIRED (WS healthy)

With `REALTIME_ENABLED` on + `?realtime=1` + refresh wiring on, **none** of these depend on the polling timer — polling is only the fallback for when WS is unhealthy:

- Opponent plays a project card; uses a blue-card / corporation / CEO action; runs a standard project.
- Opponent places a tile on **any** action — including the **first of a two-action turn** (the fixed regression).
- Opponent's **intermediate** action inside a multi-action turn.
- Turn hand-off / whose-turn-it-is / pass.
- Draft & research **simultaneous-phase** picks, across all seats.
- **Undo** by any player.
- **Production / generation** roll-over (income, energy→heat conversion).
- WGT / global-parameter changes; oceans/temperature/oxygen/Venus movements.
- Colony **trade / build**.
- **Game end** → endgame overlay + rematch offers for everyone.
- **Journal** feed and **notification** feed updates.
- Reconnect catch-up (via `RESUME_GAME`).

Effect on the pollers when WS healthy: the **primary** poller (`WaitingFor`) stretches 1 s → ~20 s (backstop only); the **secondary** pollers (journal / notifications / rematch) stretch to a ~20 s fallback and refetch on the wake. The **only** timer still on a real cadence is the home-page lobby list (`/api/games/joinable`, not a game room — deliberately out of scope).

### L.6 Feature-flag ladder = rollback strategy (graduated, instant, non-destructive)

**WebSocket is ON by default (Phase 12).** The flags below are the OPT-OUT kill-switches — every layer is independently reversible without deleting polling, via a client flag (URL / localStorage, instant, no deploy) or a single server env change. Ordered from "keep the most speedups" to "full legacy":

| Lever (opt-out) | Where | Effect | Use when |
| --- | --- | --- | --- |
| `?realtimePoll=0` / `localStorage.realtime_poll=0` | client | Keep WS-driven refresh, but DON'T stretch the poll interval (safe 1 s always) | The long interval ever feels stale for a specific case |
| `?realtimeRefresh=0` / `localStorage.realtime_refresh=0` | client | Keep the socket/observe, but DON'T wake the refresh → polling drives (observe-only) | A refresh-wiring regression |
| `?realtime=0` / `localStorage.realtime_transport=0` | client | Don't open the socket at all | Client-side kill |
| `REALTIME_ENABLED=0` (or `false`/`off`) | server env | No `/ws`, no broadcasts → **byte-identical legacy polling** for everyone | Server-side master kill |

Anything else (env unset / any other value; no URL param) = **ON**. **Incident runbook:** step down the ladder until healthy — `realtimePoll=0` → `realtimeRefresh=0` → `realtime=0` → `REALTIME_ENABLED=0`. Each step is instant and non-destructive; **polling is never deleted**, so any level remains fully playable. Setting `REALTIME_ENABLED=0` server-side returns the whole deployment to "full legacy" immediately.

### L.7 Acceptance criteria (consolidated)

**Functional (WS healthy, two clients):**
1. Every scenario in §L.5 propagates to the non-acting client in **< ~200 ms** (coalesced wake), with **no manual refresh** and **no polling wait**. Evidence: server `[realtime] invalidation …` log per action + the client dev chip `· inv:N` incrementing.
2. **The regression:** an opponent's **first-of-two** action tile placement (undo off) is visible **immediately**, not only after the turn ends. Guarded by `tests/realtime/GameLoaderBroadcast.spec.ts`.
3. A burst of one player's saves (a multi-step turn) **coalesces to a single refresh** on observers (no refresh storm).
4. **Undo** by any player propagates to all clients over WS.
5. **Game end** → all clients refresh into `END`; the endgame overlay and rematch offers appear for everyone without polling.

**Guard / UI-integrity (must not regress):**
6. Performing every §L.5 scenario **while the viewer is** mid-payment / mid-placement / mid-draft / has an overlay open / is watching an energy→heat or tile or hazard animation → that UI is **not** closed, reset, or remounted (§L.4). The mid-prompt viewer's `playersWaitingFor` cubes still update.
7. No WS event ever causes a raw `playerkey++`; a mid-prompt invalidation performs **no** full refresh (client test).

**Resilience / fallback:**
8. `REALTIME_ENABLED` off **or** socket offline → behavior is **identical to legacy** — 1 s polling keeps every scenario working; no user-visible difference except latency.
9. Reconnect after network loss / dyno restart / tab sleep → `RESUME_GAME` → **exactly one** full refresh if the game moved (else none); **no double actions** (resume is a READ; commands stay REST with `runId` + the in-flight guard); **no silent staleness**.
10. Protocol-incompatible / stale socket → client falls back to safe-interval polling automatically; the dev chip shows the degraded state.

### L.8 Remaining coverage items (to fully close the guarantee)

All **game-state** mutation coverage is now complete (L.1(1)–(4), incl. the game-end `completeGame` hook). The remaining items are non-game-state / infra, deliberately deferred:

1. **Home lobby list** (`/api/games/joinable`) — not a game room; would need a lobby-level signal. Deliberately deferred (§L.5).
2. **Idempotency** (`commandId`) — deferred; existing `runId` validation + `isServerSideRequestInProgress` cover double-submit/reconnect today (E-Phase 11).
3. **Multi-dyno fanout** — the in-memory `RealtimeHub` rooms are per-process, matching the already per-process game cache. Multi-dyno needs Redis pub/sub + a shared/affinity cache — a separate, larger initiative (§G.6); single-dyno is the supported topology now.
