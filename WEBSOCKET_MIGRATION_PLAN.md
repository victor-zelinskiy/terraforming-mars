# Single-App + WebSocket Realtime — Architecture Investigation & Migration Plan

> Status: **investigation + plan only. No implementation started.**
> Scope: move from legacy polling + multi-page assumptions toward a formalized single-app client with a server-authoritative WebSocket realtime layer, without a big-bang rewrite, preserving direct game URLs and the premium UI. Electron is out of scope (but kept in mind).

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

### C.6 Polling fallback strategy

Polling stays. Behind a feature flag, when the socket is healthy: lengthen `WaitingFor`'s timer (e.g. 1 s → 15–30 s) so polling becomes a slow safety-net while WS provides the fast path. When the socket drops: restore the 1 s interval automatically. The other 4 pollers (notifications/journal/rematch/joinable) can be migrated later or simply ride the same invalidation nonce; they are not on the critical path for Phase 1.

### C.7 Future Electron compatibility notes

The single-runtime/single-transport choice already helps. Two things to keep clean now to avoid pain later (do **not** implement yet, just don't regress):
- **Centralize the API base + identity.** Today the client builds URLs as `'api/' + path + window.location.search` (App.vue:535) and `paths.API_WAITING_FOR + window.location.search` (WaitingFor.vue:704), i.e. relative origin + reads identity from `window.location`. For Electron, factor an `apiBase` + an explicit `{gameId, playerId}` client-config instead of reading `window.location`. The WS URL should derive from the same `apiBase`.
- **Keep transport in `realtimeService`.** Because the browser `WebSocket` and Node `ws` speak the same wire protocol, Electron's renderer reuses the exact same `realtimeService` unchanged.

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

### Phase 6 — Wire invalidation to the existing refresh
- **Goal:** on `GAME_STATE_INVALIDATED`, client calls `WaitingFor.waitForUpdate(immediate=true)` (the existing GO/REFRESH path). Polling unchanged (still 1 s).
- **Scope:** `realtimeService` ↔ `WaitingFor.vue` wiring (reactive nonce/bus).
- **Risk:** medium (first behavioral change), but contained because it reuses every guard. **Acceptance:** Player B sees Player A's card play sub-second; mid-input/overlay/animation states are NOT disrupted (manual matrix in §H). **Rollback:** flag off → pure polling.
- **Don't change:** the refresh/guard logic itself; the `playerkey` remount path.

### Phase 7 — Cover all mutations (undo + game end)
- **Goal:** add `invalidate(game)` to `restoreGameAt()` (after `undoCount++`) and `completeGame()` (after final save).
- **Scope:** `GameLoader.ts`.
- **Risk:** low-medium. **Acceptance:** undo and endgame propagate to all clients without polling; endgame overlay/rematch start for everyone. **Rollback:** remove the two calls.
- **Don't change:** client wiring (already done).

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

### Phase 13 — Electron-readiness prep (no Electron)
- **Goal:** centralize `apiBase` + identity config; derive WS URL from it; audit browser-only assumptions in the game runtime.
- **Risk:** low-medium. **Acceptance:** the client can run pointed at an explicit API base. **Rollback:** revert config.

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
