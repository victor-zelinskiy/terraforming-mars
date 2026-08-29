# «Мои партии» — the LOBBY subsystem

*Read this before touching the game listing, the LAN host discovery, or anything that
decides what the main menu knows about existing games.*

The screen behind `MY GAMES` in the console main menu, plus the `CONTINUE` item and its
badge, plus everything a LAN guest sees of another couch. One model on the client
(`lobbyState.ts`), one index on the server (`lobbyIndex.ts`), one push channel between
them (the realtime LOBBY room).

---

## 1. The bug this replaced

Reported 2026-08-28: *«захожу в "Мои партии" — партий нет, хотя они точно созданы; особенно
в локальном режиме по LAN. После перезахода в игру они появляются.»*

### 1.1 THE ROOT CAUSE — mDNS liveness (this is the one that mattered)

⚠️ **Everything in §1.2 was real, and none of it was the reported bug.** The first pass at
this reworked the client, shipped, and the symptom came back unchanged. The cause was one
layer lower:

`bonjour-service`'s `Browser` emits `up` **exactly once per service**. A repeat response for
a service it already holds updates nothing and re-emits nothing (`browser.js`:
`if (existingService) { updateServiceSrv; updateServiceTxt; return; }`, and both of those
bail out when the records are unchanged — the freshly built object, with its new
`receiveTime`, is discarded). Its own `expire()` is never scheduled.

`LanDiscovery` fed `lastSeen` **only** from that one-shot `up` callback, and swept out any
host older than a 45 s TTL. So:

> **every discovered host was deleted 45 seconds after being found — permanently**, because
> the Browser would never announce it a second time. The only thing that brought it back was
> restarting the app (a new Browser ⇒ a new `up`).

Which is exactly what was reported, twice: play a LAN game for ten minutes, go back to the
menu, and the host you were *still talking to* is not on the list — until you restart.

**The fix (`lanDiscovery.ts`): mDNS is how a host is FOUND; a SOCKET is what says it is
still there.**

- **Presence** is re-read from `browser.services` on every query tick (`reconcile`), so a
  host we ever dropped can come back without a restart.
- **Liveness** is `reachable()` — a raced TCP connect to the host's addresses, run only once
  a host has gone mDNS-quiet past `HOST_QUIET_MS`. Two failed checks hide it; it stays on a
  30 s re-check rotation (`offline`), so a couch that is switched back on returns by itself.
- Multicast silence therefore removes nothing. Over Wi-Fi, which is unacknowledged and
  lossy, that distinction is the whole feature.
- **One row per machine** (`dedupeByEndpoint`): now that liveness is a socket, a crashed
  app's stale advertisement would answer *forever* (what listens on its address:port is the
  machine's current app), so advertisements resolving to the same endpoint collapse to the
  freshest one. Measured live: three ghost `victor` rows became one.

**Where the rules live.** All of it is one sockets-free engine — `HostRegistry` in
`lanDiscovery.ts` — so every decision is testable to the last branch and `LanDiscovery`
keeps only plumbing (browsers in, timer ticks, emits out). Its four invariants:

1. **Presence is additive.** Nothing leaves because it stopped being mentioned.
2. **Only a socket removes a host** (or its own mDNS goodbye).
3. **A hidden host is never forgotten** — it keeps its record and its slot in the re-check
   rotation, so it returns without an app restart *and without discovery's help*.
4. **One row per machine** (`dedupeByEndpoint`).

⚠️ Invariant 1 is the one that is easy to lose twice. The FIRST attempt at this fix removed
hosts the browsers no longer listed — and `rebuildLinks()` (a Wi-Fi reconnect, a VPN toggle,
a dock) destroys every Browser and builds fresh ones whose lists start EMPTY. Same wipe as
the original bug, new costume. Removal belongs to the liveness check alone.

Guards:
- `tests/electron/lanHostRegistry.spec.ts` — the whole decision machine, 16 cases, no
  sockets: quiet-but-alive stays, an empty listing removes nothing, one strike is survivable,
  two hide it, a hidden host retries and returns, ghosts collapse.
- `tests/electron/lanDiscovery.spec.ts` — the pure helpers (`hostPresencePlan`, `reachable`,
  `dedupeByEndpoint`, naming, address ordering).
- `tests/integration/lanDiscovery.spec.ts` — **real multicast, real sockets**, two
  `LanDiscovery` instances over loopback with injected timings (`npm run test:integration`;
  out of the default suite because a CI runner has no usable multicast). Measured: the host
  survives 3× the quiet window, drops once its socket dies, and comes back on its own.

**The seams** that make the above possible are in `LanDiscoveryOptions`: `timings`
(quiet / recheck / connect budget), `connect` (the socket probe) and `clock`.

### 1.2 The four things that ALSO had to be fixed

These are real defects, each of which could produce the same sentence — they were just not
the cause of this report. They all rendered as
«У вас пока нет незавершённых партий»:

1. **The identity could arrive after the loader ran, and nothing re-ran.** `mounted()` read
   `identityName` once; when it was still `''` (first launch with the Steam prefill in
   flight, a profile resolved a tick later) the list was never fetched, polling never
   started, and **no watcher existed to notice the name landing**. Only an app restart —
   which reads the name synchronously from `localStorage` — fixed it. This is the «после
   перезахода появляются» in the report.
2. **The listing endpoint was O(whole library) per request.** `ApiGamesJoinable` called
   `gameLoader.getGame()` for every game, i.e. a full `Game.deserialize()` each time. A LAN
   guest allowed the host **1.5 s** to answer; on a real library that budget was routinely
   blown, `Promise.any` rejected, and the guest listed *nothing*. Same scan also `touch`ed
   every game, resetting idle clocks and defeating cache eviction.
3. **Opening the screen was not a refresh.** It called `loadJoinableGames` only when the
   name was non-empty, and the archive «once per menu session». A cross-session cache
   seeded `loadedOnce = true`, so a stale (or empty) cached list looked like a loaded one.
4. **A failure was indistinguishable from an empty library.** `gamesCount === 0` printed
   the empty-state sentence whether the fetch had failed, never run, or honestly returned
   nothing.

None of the four is fixed by "polling more often", which is why this is a rework and not a
patch.

---

## 2. Server: the lobby index (`src/server/models/lobbyIndex.ts`)

A `gameId → LobbyRecord` map plus a monotonic **revision**.

A `LobbyRecord` is the **name-independent** summary of one game: id, name, created time,
phase, generation, board, enabled expansions, seats (id + name + normalized name + colour,
in generation order), active player's colour, finished. Per-requester filtering
(`joinableSummaryFromRecord`) is a pure function on top — one derivation, so a listing and
a one-off `getJoinableGameSummary(game, …)` can never disagree.

**Freshness by construction.** `snapshot(loader)` walks the loader's ledger and:

- **resident game** → re-derives from the live `IGame` via the new `IGameLoader.peek()`
  (synchronous, no I/O, and deliberately does **not** `touch` the cache — that is the whole
  point of `peek` existing next to `getGame`);
- **known cold game** → serves the cached record (a game that is not in memory is not
  changing);
- **unknown cold game** → reads it ONCE from `Database.getGame()` in its **serialized**
  form (`lobbyRecordFromSerialized`) — no `Game.deserialize`. A save too old to carry
  `name` falls back to the loader, because `Game.deserialize` invents a *random* name for
  those and the listing would rename the game on every read;
- **ledger no longer lists it** → dropped.

`lobbyRecordFromSerialized` reproduces `playersInGenerationOrder` (the `players` array
rotated to start at `first`). `tests/models/lobbyIndex.spec.ts` asserts the two derivations
are `deep.eq` for a real game — the cold path must never become a second, subtly different
truth.

**The revision moves only on a real change.** Every upsert compares a fingerprint of
exactly what a listing shows. An ordinary in-turn save therefore does not wake every menu
on the network; a generation tick, a turn change, an end, a create and a delete do.

**Hooks (all in `GameLoader`):** `add()` (create / load) · `notifyGameStateChanged()` (save,
undo, completion, intermediate action) · `deleteGame()` · `maintenance()` purge.

---

## 3. Server: the realtime LOBBY room

`src/common/realtime/Protocol.ts` gained `SUBSCRIBE_LOBBY` / `UNSUBSCRIBE_LOBBY` →
`LOBBY_SUBSCRIBED {revision}` / `LOBBY_INVALIDATED {revision}`. Additive: the parsers return
`undefined` for unknown types, so an older peer on either side ignores them instead of
breaking. **No protocol version bump.**

`RealtimeHub` keeps a single server-wide `lobby` subscriber set beside the per-game rooms;
`handleDisconnect` leaves both. `GameServer.startGameServer` injects the wiring —
`LobbyIndex.onRevisionChanged(rev => hub.invalidateLobby(rev))` — so the index stays a leaf
and `GameLoader → lobbyIndex → RealtimeHub` cannot become an import cycle (the same shape as
the realtime subscription resolver).

**The room is anonymous on purpose.** The broadcast is a counter, never data; the listing
it wakes is still fetched over REST and is name-scoped there. A lobby subscriber learns
nothing it could not learn by polling `api/games/joinable`, which is already unauthenticated
by design (docs/EMBEDDED_SERVER.md §7). `SUBSCRIBE_LOBBY` may carry `lastRevision`; a client
further behind is answered with an invalidation immediately, so a reconnect after a gap
re-syncs without waiting for the next change.

---

## 4. Client: one model (`src/client/components/mainMenu/lobbyState.ts`)

`lanState.ts` is now **discovery only** (who is out there: mDNS hosts + hand-typed manual
entries). Everything about *listing* — probing, endpoints, statuses, rows, freshness — is
`lobbyState`, which treats each server as one **SOURCE**: `local` plus one per LAN host.

### The six contract points

1. **Every source has a STATE, and the UI reads it.** `idle` (never asked) ≠ `loading` ≠
   `ok` ≠ `unreachable`. **«Пусто» may only be shown for `ok`.** The menu now renders four
   distinct answers: no name yet · loading · could not load · genuinely none
   (`lobbyFirstLoad()` / `lobbyUnreachable()` / `lobbyKnownEmpty()`).
2. **Entering the screen IS a refresh** — `openLobbyList()` unconditionally re-asks every
   source. Showing something is never a reason not to check whether it is still true.
3. **Push first, poll as a floor.** `lobbyChannel.ts` opens one WS per server (pooled by
   `wsBase`, ref-counted) and reports `lobbyChannelHealthy()`. The poll re-arms itself after
   every refresh at the cadence the current state deserves: open 30 s live / 5 s otherwise,
   closed 120 s live / 20 s otherwise. A push is debounced 250 ms. The channel also reports
   health TRANSITIONS (`onHealthChange`), which re-arm the poll immediately — the long
   «everything is pushing» interval must not outlive the push it was granted for, which is
   precisely the window where the fallback matters. A server without the lobby room answers
   the subscribe with an ERROR; the channel records that once, stops retrying and reports
   itself un-healthy, so that source simply keeps the short poll.
4. **The identity is an INPUT, not a precondition.** `startLobbyWatch('')` is legal;
   `setLobbyIdentity(name)` (driven by a `watch` on `identityName` in the menu) resets and
   reloads. This is cause #1 above, closed structurally.
5. **Nothing disappears silently.** A failed refresh keeps the rows it had. A LAN host that
   stops answering keeps its rows marked `stale` (shown, not enterable, with a reason) for
   `LAN_STALE_TOLERANCE = 3` consecutive failures; a host that *left the network* takes its
   rows immediately — that is discovery saying so, not a probe failing.
6. **ONE entry point.** Open, push, poll, window focus / visibility, identity change, a
   deletion, a new LAN host — all funnel into `refreshLobby()`. A refresh requested
   mid-flight sets a replay flag rather than queueing a second sweep or being dropped, so a
   push landing during a fetch is answered exactly once, after it.

### Other load-bearing details

- **Race guard:** a per-source sequence number plus an identity check; a late answer can
  never overwrite a newer one or land under a different player's name.
- **LAN probe:** all of a host's addresses are raced in parallel (`Promise.any`) with a
  **6 s** budget — a machine with Hyper-V / WSL / a VPN advertises half a dozen addresses
  and the dead ones hang rather than fail fast. The budget bounds only «nothing answered»;
  a busy host must be reported as slow, never as empty. A cached working endpoint is tried
  first and alone, then the full sweep in the SAME tick if it has died.
- **The cross-session cache** still seeds `CONTINUE` + the badge before the first paint, but
  is keyed by name **and** `apiBase` (a host↔remote switch must not show the other server's
  games) and is always treated as unverified.
- **`newIds`** marks rows that arrived while the player was watching — the visible proof
  that push works. Never marked on a first / hydrated list.
- **A failed probe reports WHY** (`LobbySource.lastError`): a timeout, `HTTP 500`, or the
  browser's own network message. «Не отвечает» with no reason leaves the player unable to
  tell a slow couch from a blocked port, which is the only part they can act on.
- **A HAND-TYPED host is an ordinary source.** mDNS is multicast, and multicast is the first
  thing a router's client isolation, a guest SSID or a firewall drops; `lanState`'s manual
  entries (persisted, `parseManualEntry` accepts a bare IP, `host:port`, an `http://` paste
  or a bracketed IPv6) feed the same source list, are probed by the same code and are deduped
  against discovery so a host found both ways is listed once.

---

## 4a. Order and age

**The list is sorted strictly by creation time, newest first** — and every row says how long
ago it was created («12 с назад» · «7 мин назад» · «3 ч назад» · «2 дн назад»). The two go
together on purpose: the age is what makes the ordering legible instead of a rule the player
has to take on trust.

- **The client sorts, it does not inherit an order.** `ApiGamesJoinable` already answers
  newest-first, but LAN rows arrive from SEVERAL servers, each ordering only its own answer,
  so `newestFirst()` is applied to the local rows, the LAN rows and the archive alike. LAN
  rows are no longer grouped per host — every row names its own couch, so grouping bought
  nothing and broke the stated rule.
- **One clock for the whole screen** (`lobbyState.nowMs`). A per-row timer would let
  neighbours drift a second apart and make the ordering look wrong; one reactive number moves
  every label in the same tick.
- **The tick re-arms at the cadence the FRESHEST row needs** (`lobbyAgeTickMs`): every second
  while any row counts seconds, 15 s while they count minutes, a minute beyond that. It runs
  only while the screen is open, and a completed refresh re-arms it so a brand-new game starts
  counting immediately.
- **A future timestamp is ordinary input, not a bug.** A LAN row's `createdTimeMs` comes from
  the HOST's clock, and two machines on one couch are routinely seconds — sometimes minutes —
  apart, so `lobbyAge` clamps anything in the future to «только что» rather than printing
  «-3 мин назад».
- Units are ABBREVIATED so the label neither wraps the row nor drags Russian plural agreement
  («1 минуту / 2 минуты / 5 минут») into a string that changes every second.

⚠️ **Timers here are created with `window.setTimeout` and cleared with `window.clearTimeout`
— the pair matters.** In a browser the bare global is the same function; under jsdom (the
client test runner) they are two different implementations, so a bare `clearTimeout` on a
jsdom handle silently does nothing and the timer outlives its screen. Module state is shared
across specs, so that leak corrupts later ones — the age-clock spec is what caught it.

Guards: `tests/client/components/mainMenu/lobbyAge.spec.ts` (the unit ladder, the clamp, the
cadence) and the `newest first` / `age clock` blocks in `lobbyState.spec.ts`.

## 5. UI surface (`ConsoleMainMenu.vue`)

- The four honest states above, instead of one sentence.
- The LAN section speaks in all THREE of its states, never by omission: a host that could not
  be asked («не отвечает» + the reason), a host that answered with nothing for this player
  («нет партий с вашим именем» — the listing is name-scoped, and the head now says whose
  name), and a stale row that is shown but refuses entry (navigating would land on a curtain
  that never lifts).
- **«＋ Добавить хост по адресу»** closes the LAN list (last in the cursor ring, host mode
  only) and opens the on-screen keyboard; X on a hand-typed row removes the entry. This is the
  only way in on a network that drops multicast — it was designed for, persisted, and until
  now had no screen.
- **Diagnostics → «Локальная сеть»** (the settings console) finally displays what the utility
  process has always collected: advertising + service name, links and how many carry an
  advertisement, **inbound queries** (false while we can still send = the fingerprint of a
  firewall dropping inbound multicast), hosts found / hidden, and a per-link line with its
  own error. Before this, «не вижу партий по сети» had no screen that could answer it.
- A «Новая» chip on freshly arrived rows.
- **RT = «Обновить»** in the games command bar — the list refreshes itself, this is for the
  player who wants to know it just did.
- New i18n keys (RU): `Set your player name to see your games`, `not responding`, `Refresh`.

---

## 6. Guards

| Spec | What it pins |
| --- | --- |
| `tests/models/lobbyIndex.spec.ts` | live vs serialized derivation are identical; revision bumps only on real change; cold read happens once; a resident game is always re-derived; ledger reconcile |
| `tests/routes/ApiGamesJoinable.spec.ts` | a game created / ended / deleted / renamed after a previous listing is correct on the very next one (the cache-staleness classes) |
| `tests/realtime/LobbyBroadcast.spec.ts` | the lobby room broadcasts to its members and nobody else; disconnect leaves it; an unchanged save does not wake anyone |
| `tests/client/components/mainMenu/lobbyState.spec.ts` | the six contract points: late identity, empty vs unreachable, rows survive a failure, open re-asks, `newIds`, profile switch, archive slice, clean teardown — plus strict newest-first ordering and the age clock starting/stopping with the screen |
| `tests/client/components/mainMenu/lobbyAge.spec.ts` | the «сколько назад» ladder, the future-timestamp clamp, the tick cadence |
| `tests/client/components/mainMenu/lobbyLan.spec.ts` | the reported scenario: a host discovered → listed on open; a host appearing while open is asked at once; unreachable says so and keeps rows then drops them; a host that leaves takes its rows; closing retires LAN sources; addresses are raced; a hand-typed host behaves as an ordinary source (added, parsed, removed, never doubled against discovery) |
| `tests/electron/lanHostRegistry.spec.ts` | ⭐ the LAN presence/liveness engine — the two bugs above as assertions |
| `tests/integration/lanDiscovery.spec.ts` | real multicast + real sockets end to end (`npm run test:integration`) |

## 7. If you extend this

- **A new source kind** (a cloud account, an invite code) is a new `LobbySource` — give it a
  loader and a `wsBase`; the cadence, race guard, statuses and UI states come for free.
- **A new reason to refresh** is a call to `refreshLobby()`. Never a second loading path.
- **A new field in the listing** goes into `LobbyRecord` **and** into `fingerprint()` — a
  field the fingerprint does not see is a field whose change never reaches a client.
- Do **not** add game data to `LOBBY_INVALIDATED`. The room is anonymous *because* it
  carries no data; the moment it does, it needs authorization and the whole model changes.
