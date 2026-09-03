# Campaign Mode («Кампания») — Architecture & Implementation Plan

> Status: **IMPLEMENTED (v1, 2026-09-03).** Product decisions D1–D12 are FIXED (§12,
> addenda marked ✅), including the approval-time addition of **project carryover**
> («Наследие проектов», §2.12).
>
> Shipped: the server campaign domain (`src/server/campaign/` — manager, standings,
> mission setup; `IDatabase` ×3 backends; routes `api/campaign[/create|/launch|
> /carryover|/dev]`; rollback guards; purge exemption; durable create-idempotency via
> key-derived `CampaignId`); the creator mode stage + campaign briefing; the Campaign
> Map (`ConsoleCampaignMap` standalone screen + endgame scene) with the carryover
> picker; corporation lineage on the `playCorporationCard` additional-corp path
> (missions 2–3 = «Слияние», mission 4 corp-less «Штаб»); the `titles` VP category
> end-to-end (optional breakdown field → segment/category tables → ceremony, live
> score, Score Explorer detail, score report scale, verdict categories); the Titles
> ceremony coda + champion beat; carried-cards reveal via the `campaign` draw-reveal
> source; «Мои партии» grouping; dev fast-forward (`api/campaign/dev`, fixtures for
> lineage/carryover). Tests: `tests/campaign/*` (config/manager/mission-setup/map
> model/titles scoring), `tests/routes/ApiCampaign.spec.ts`, e2e
> `tests/e2e/console-campaign.spec.ts`; full server+client suites green.
>
> Known v1 residuals (deliberate, listed in the implementation report): the map's
> generation reveal is a CSS cascade (no connector-draw ceremony yet); the Titles
> coda is a settled post-winner stage, not a director beat; «Штаб» reuses the start
> scene's sequential corp reveals under its own label (no bespoke trio screen); the
> bot receives no bonus M€ (its application point does not exist — the honesty rule
> of D5); titles are journaled in campaign surfaces + the next mission's bonus log
> line, not as a typed journal token.
> Author basis: full-repo research pass (2026-09-03) across the console creator, server Game
> model, Merger/multi-corporation engine, endgame/scoring pipeline and the workspace/motion
> foundation. Every file/line reference below was verified against the working tree on that
> date. The goal of this document: a follow-up agent can implement the mode in vertical
> slices without re-researching the codebase.
>
> Scope guard: this is OUR campaign inspired by Legacy of Mars — **no** Development Cards,
> project-card carryover, Population, Innovation, branching routes, mid-campaign roster
> changes, or a campaign editor. Mission modifiers are a typed extension point only (§4.6).

---

## Table of contents

1. [What exists in the code today](#1-what-exists-in-the-code-today)
2. [Domain architecture](#2-domain-architecture)
3. [User flows](#3-user-flows)
4. [Campaign Map Workspace](#4-campaign-map-workspace)
5. [Motion specification](#5-motion-specification)
6. [Corporations and Merger](#6-corporations-and-merger)
7. [Titles, bonus M€ and final scoring](#7-titles-bonus-m€-and-final-scoring)
8. [Implementation plan — vertical slices](#8-implementation-plan--vertical-slices)
9. [Test strategy](#9-test-strategy)
10. [Risks and potential regressions](#10-risks-and-potential-regressions)
11. [Gaps in the original brief](#11-gaps-in-the-original-brief)
12. [Open product decisions](#12-open-product-decisions)

---

## 1. What exists in the code today

### 1.1 Entry / main menu / creator

| Thing | Where | Reuse verdict |
| --- | --- | --- |
| Console main menu | `src/client/components/console/menu/ConsoleMainMenu.vue` — `MenuItemId` union (:399), `items()` (:581), `activateAt()` dispatch (:981). Pad input via `installMenuPad` → `src/client/console/menu/consoleMenuPad.ts` | Entry point host. «Новая партия» → `navigateInApp(paths.NEW_GAME_PREMIUM)` (:996). |
| Console creator («Mission Bridge») | `ConsoleCreateGame.vue` (screen root) + decks `ConsoleCrewDeck.vue`, `ConsoleRulesDeck.vue`, `ConsoleExpansionsDeck.vue`, `ConsoleMapDeck.vue`, right panel `ConsoleLaunchPanel.vue`, confirm `ConsoleLaunchConfirm.vue` | Crew/Rules/Expansions decks reused VERBATIM by the campaign creator. Map deck is replaced (§3.1). |
| Creator UI model | `src/client/console/menu/consoleCreateModel.ts` — `CREATE_DECKS` table (:72), `deckNavStep` (:92), row projections, `launchIssues()` (:438), `consoleCreateUi` reactive (:499) | Extend: one new deck row + per-deck switch arms. |
| Draft settings store | `src/client/components/create/premium/createGameState.ts` — `PremiumCreateGameState` (:63), `PremiumPlayerSlot` (:32), `PremiumRules` (:40), `GameMode = 'multiplayer'\|'marsbot'` (:29), `visiblePremiumRules` (:156), `stateAutomaConflicts` (:426) | The campaign reuses this state object as its frozen settings source. `gameMode` stays a roster fact — the campaign axis is a NEW field (§3.1). |
| Settings persistence | `CreateGameSettingsStorage.ts` — localStorage `tm_last_game_settings`; `saveCreateGameState`/`restoreCreateGameState`/`sanitizePremiumState` (`createGameState.ts:538-704`) | Campaign draft persists in the same blob via one new sanitized field. |
| Submit path | `submitCreateGame.ts` → `buildCreateGamePayload.ts` → POST `/api/creategame` (`ApiCreateGame.ts:71`), then `navigateWithCurtain(player?id=…, 'expedition')` | Mission creation reuses the payload builder server-side; the campaign has its own create route (§2.6). |
| Map presentation | **`PremiumMapFingerprint.vue`** — props `{mapId, random, accent, variant: 'hero'\|'card'\|'thumb'}`; data table `boardFingerprints.ts`. Fully decoupled from the creator (3 independent consumers already) | **Drop-in** for Campaign Map mission cards. Future upgrades to the fingerprint auto-propagate. |
| Board pool + random | `src/common/boards/BoardName.ts` (11 boards); creator offers `PREMIUM_MAPS` (`createGameMeta.ts:61`, 9 concrete + random); **server-side** pool: `src/server/boards/randomBoard.ts` — `boardOptions(board, {automa})` (:21), `RANDOM_ALL_EXCLUSIONS` (:9), `chooseBoard` (:49); rolled at `ApiCreateGame.ts:109-110`; intent preserved as `gameOptions.randomBoardOption` (:121) | **The one source of truth** for the campaign board pool. With a bot the pool intersects `AUTOMA_SUPPORTED_BOARDS`. |
| Bot map support | `AUTOMA_SUPPORTED_BOARDS` (`src/common/automa/automaCompatibility.ts:88-97`, 5 boards) pinned to `MARSBOT_BOARDS` (`src/server/automa/boards/MarsBotMapProfile.ts:195`) by specs (`tests/automa/HellasMarsBotBoard.spec.ts:151` et al.) | Reused as-is; a bot campaign draws 4 of 5 supported boards. |
| My games / Continue | `lobbyState.ts` (multi-source local+LAN), `GET /api/games/joinable?name=&status=` (`ApiGamesJoinable.ts`), `JoinableGameSummary` (`src/common/models/JoinableGameModel.ts:36`), `continueItem` (`ConsoleMainMenu.vue:558`), `tm_last_game_entered` | Extend the summary with a `campaign` marker; group missions into one row (§3.5). |
| Join model | **Name-based** — no invite handshake. Creator types names; each player finds the game by `normalizePlayerName` match and receives their own `you.id: PlayerId`. Friends list (`friendsState.ts`) is a local name memory. Identity: `identityState.ts` / profiles (`profilesState.ts`, max 12) | Campaign seats are keyed the same way (§2.3). |
| Spectator | Client feature deleted; `spectatorId` still generated/serialized but has no reachable route. No read-only surface exists except post-END free roam inside ConsoleShell | Campaign map viewing is participant-only in v1 (§11). |

### 1.2 Server game model

| Thing | Where | Consequence for campaign |
| --- | --- | --- |
| Create route | `ApiCreateGame.ts` — hand-rolled body read, `QuotaHandler`, unchecked `JSON.parse as NewGameConfig` (:85), ids via `generateRandomId` (`server-ids.ts`), `Game.newInstance` (:183), **`ctx.gameLoader.add(game)` NOT awaited, NOTHING persisted at creation** (:185) | ⚠️ A freshly created game lives only in the in-memory cache until the first `game.save()` (first player action / `undoOption`). **A campaign-linked mission must be force-saved at creation** or the campaign can point at a game that evaporates on restart (§2.7). |
| Branded ids | `src/common/Types.ts` — `p`/`g`/`s` prefixes, one-char type guards. Prefix `c` is free | `CampaignId = \`c${string}\`` + `isCampaignId`. |
| GameLoader / Cache | `GameLoader.ts` (singleton; `getGame` resolves game/player/spectator ids; `restoreGameAt` = undo; `completeGame`; `notifyGameStateChanged` → `RealtimeHub.invalidate`), `Cache.ts` (`participantIds → GameId` reverse index built from `db.getParticipants()`) | Campaign gets its own tiny loader/registry (`CampaignManager`, §2.6); the participant reverse index is NOT extended — campaign lookups go by `CampaignId` or by scanning the viewer name against seats. |
| Database | `IDatabase.ts` (22 game-scoped methods + the **`session` table — the only existing non-game entity and the storage precedent**); backends `SQLite.ts` (idempotent DDL in `initialize()`), `PostgreSQL.ts` (only backend with real transactions; `ADD COLUMN IF NOT EXISTS` = the only migration idiom; `POSTGRESQL_TABLES` list consumed by test teardown), `LocalFilesystem.ts` (current-state file + `history/`; **all writes ride the serialized `pendingWrites` chain, all reads `flushPendingWrites()` first**; `deleteGameNbrSaves` must `repointCurrentState`) | Campaign persistence = 4 new `IDatabase` methods implemented in all three backends, copying the `session` shape (§2.5). No migration framework exists — versioned JSON blob + in-code upgrade is the pattern. |
| Serialization degradation | `SerializedGame.ts` / `SerializedPlayer.ts` — optional fields + `?? default` at deserialize; models: `automa?`, `gameEvents?`, `isMarsBot?`, `scaleBonusClaims?` | New fields: `SerializedGame` carries campaign linkage via `gameOptions` (serialized wholesale); `SerializedPlayer` gains optional campaign fields (§2.8, §7.2). |
| Undo / rollback | Player undo: `UndoActionOption` instance check (`PlayerInput.ts:56`), `restoreGameAt` deletes saves + `undoCount++`. Admin tool: `ApiAdminRollback*.ts` + `ConsoleAdminRollback.vue`, soft-gated on `?name=admin`. **Destructive, no hooks, can cross the END boundary; `game_results`/`completed_game` rows are never undone** | The campaign commit must be versioned with `(lastSaveId, undoCount)` and the rollback route must become campaign-aware (§2.9). |
| Game end | `Game.gotoEndGame()` (`Game.ts:1412`): `saveGameResults` (fire-and-forget) → `phase = END` → `saveGame` → `completeGame` (evict-mark + `markFinished`). **No winner/ranking/tie-break is computed server-side** — placement lives in the client (`endgameModel.compareScores`, total desc → M€ desc) | The campaign needs a **server-side standings computation**; the comparator gets extracted to `src/common` so client and server share one source (§7.3). |
| Rematch | `RematchManager.ts` — in-memory `Map<GameId, RematchEntry>`, per-viewer model, `creating` race guard, `createRematchGame` (:209) clones options/seats with fresh ids, re-rolls a random board. **Deliberately not persisted** | The closest template for "create the follow-on game" — the campaign copies its route/lifecycle shape but **adds persistence** (its documented weakness is exactly what a campaign can't afford). |
| Realtime | `RealtimeServer.ts` / `RealtimeHub.ts` — per-game rooms + one lobby room (bare revision counter); `ApiGameRematch.post` shows the piggyback pattern (`invalidate` for non-game-state data) | v1: campaign changes piggyback per-game invalidations + the lobby revision; no protocol bump (§2.10). |
| Bot | Bot IS a `Player` (`AutomaSetup.createBotPlayer`, deterministic id `p-<gameId>-marsbot`), seated in `Game.newInstance:333-367`; `GameOptions.automa: {difficulty, mode, corporation?}`; `AutomaSetup.validateOptions` **throws** on unsupported module sets | Mission creation pre-validates expansions against `automaConflicts`; the existing `automa.corporation` override is the lever for bot corp persistence (§6.6). |

### 1.3 Corporations / Merger — see §6 for the full analysis

Core facts: `Merger` (`src/server/cards/promo/Merger.ts`) deals 4 corps off the shared deck,
gates by affordability of its 42 M€ fee, and plays the chosen corp via
**`player.playCorporationCard(card)`** — the additional-corp path
(`Player.ts:1439-1561`) is the reusable merge semantic, not Merger's deal/pay wrapper.
The engine is largely N-corp-ready (arrays everywhere, `pendingInitialActions` prompt loops,
tableau/layout unbounded); the singular assumptions are enumerated in §6.4.
Clean pool exclusion: `gameOptions.bannedCards` filters every deck family including
corporations and preludes (`GameCards.filterBannedCards`, `GameCards.ts:154-163`).

### 1.4 Endgame / scoring — see §7 for the full analysis

Core facts: a new VP category follows the **`deltaProject` precedent** exactly — one field in
`VictoryPointsBreakdown` (+ `updateTotal`), one hook in `calculateVictoryPoints`
(pattern: `DeltaProjectExpansion.calculateVictoryPoints`, `DeltaProjectExpansion.ts:1527`),
one row in each of the two policy tables (`FINAL_SCORING_SEGMENTS`,
`finalScoringRevealModel.ts:144`; `SCORE_CATEGORY_TABLE`, `consoleEndgameModel.ts:137`),
after which the ceremony, live score, overview and Score Explorer pick it up automatically.
The endgame screens are fully re-derived from the serialized game at read time, so campaign
scoring inputs must be serialized state, never transient.

### 1.5 Workspace / motion / assets — see §4–§5

Core facts: a workspace is ONE registry row in `WORKSPACE_KINDS`
(`consoleWorkspaceStack.ts:257-363`) + a `v-if="workspaceFrameRenders(kind)"` mount in
`ConsoleShell.vue`; pre-game screens (menu, creator) are **App screen states**, not
workspaces (`App.vue:338-350`, `menuSurface` input). The canonical
COMMIT→RELEASE→UNFOLD→REVEAL implementation is `consoleActionOutcomeMotion.ts` (+
`workspaceDescend.ts` primitives). Paint baseline strips `filter`/`text-shadow`
console-wide (`console_paint_baseline.less`); geometry is rem @ 20 logical px with
`--con-ui-scale`. `assets/titles/{governor,administrator,prefect}.png` (512×512 RGBA,
fully-material gold/silver/bronze emblems with 3/2/1 chevrons) are **already servable**
(`ServeAsset.ts:218` generic branch; `electron/protocol.ts:131`) and currently
unreferenced; no build-step work needed.

### 1.6 Current limitations that shape the design

1. **No cross-game entity exists** — the campaign is the first server-authoritative
   multi-game object. Precedents: `session` table (persistence), `RematchManager`
   (lifecycle/route shape), `clonedGamedId` (the only game→game link).
2. **Game creation is non-transactional** — nothing persists until the first action.
3. **No server-side placement/tie-break** — the winner is a client concept today.
4. **Rollback is destructive and unhooked** — a committed campaign result can silently
   desync unless the rollback path is taught about campaigns.
5. **No invite system** — participation is name-keyed; the campaign inherits this.
6. **`consoleWorkspaceEmbed.ts` no longer exists** — the embed contract lives in
   `consoleWorkspaceStack.ts` (`setWorkspaceFrameSlot`/`workspaceFrameTarget`) +
   `consoleWorkspaceOutcome.ts` (`embedSlot`); the doc `docs/claude/console/workspace-embed.md`
   still names the deleted module.

---

## 2. Domain architecture

### 2.1 Entities

```
Campaign (1) ──── owns ────► MissionSlot (4, ordered, fixed)
                                 │  board: BoardName        (frozen at generation)
                                 │  modifiers: []           (typed, empty in v1)
                                 │  gameId?: GameId         (set at launch, immutable)
                                 │  playerIds?: per-seat map(set at launch)
                                 │  result?: MissionResult  (immutable snapshot at commit)
Campaign ──── fixes ───► CampaignSeat (2..5, ordered, fixed: humans + ≤1 bot)
Campaign ──── accrues ─► per-seat progression: corporation lineage, title entries,
                         title points, pending bonus M€
```

**A Game never owns campaign state.** The Game receives a read-only *mission contract* at
creation (`GameOptions.campaign`, §2.8) and reports its terminal state back through one
server hook. Ordinary games have `gameOptions.campaign === undefined` and zero behavior
change — this is the master regression invariant.

### 2.2 Types (new files)

`src/common/campaign/CampaignTypes.ts` (shared client+server; no runtime logic):

```ts
export type CampaignId = `c${string}`;                       // add to src/common/Types.ts with isCampaignId()
export const CAMPAIGN_MISSION_COUNT = 4;                     // architecture allows N; UI v1 hard-designs 4

export type CampaignPhase =
  | 'generated'        // route exists, mission 1 not launched
  | 'missionActive'    // missions[pointer].gameId set, that game not committed
  | 'interlude'        // missions[pointer].result committed, next slot not launched
  | 'finished'         // missions[3].result committed; champion recorded
  | 'abandoned';       // explicit cancel (soft-delete; games untouched)

export type TitleName = 'governor' | 'administrator' | 'prefect';

export type TitleEntry = {
  missionSlot: number;
  title: TitleName;
  titlePoints: number;          // copied from config at commit time (table changes never rewrite history)
};

export type MissionModifier = { id: string };  // v1: the array is always empty; see §4.6

export type CampaignSeatKind = 'human' | 'bot';
export type CampaignSeat = {
  seat: number;                 // 0-based, seat 0 = creator
  kind: CampaignSeatKind;
  name: string;                 // display name; identity key is normalizePlayerName(name)
  color: Color;                 // fixed for the whole campaign
  trBoost: number;              // 0 when the rule is off
  botDifficulty?: DifficultyLevel;   // bot seat only
};

export type MissionStanding = {
  seat: number;
  place: number;                // 1-based; ties share the better place (see §7.4)
  score: number;                // victoryPointsBreakdown.total
  megaCredits: number;          // the tie-break metric, snapshotted
  corporations: ReadonlyArray<CardName>;   // in play order at mission end
  tiedWith: ReadonlyArray<number>;         // seats sharing the place ([] normally)
};

export type MissionResult = {
  gameId: GameId;
  committedAtMs: number;
  gameLastSaveId: number;       // rollback-invalidation fingerprint (§2.9)
  gameUndoCount: number;
  generations: number;
  standings: ReadonlyArray<MissionStanding>;
  titles: ReadonlyArray<{seat: number} & TitleEntry>;
  bonuses: ReadonlyArray<{seat: number; megaCredits: number}>;  // to be applied NEXT mission
  championSeat?: number;        // final mission only (post title-points)
};
```

`src/common/campaign/CampaignModel.ts` — the wire model (per-viewer): campaign header,
seats (with `you?: {seat}` resolved by name, same rule as `JoinableGameSummary.you`),
per-slot `{board, state: 'locked'|'ready'|'active'|'committed', gameId?, yourPlayerId?,
result?}`, per-seat progression (lineage, titles, titlePoints, pendingBonus), `phase`,
`pointer`, `canLaunch` (creator + slot ready), `rev` (see §2.10).

### 2.3 Seat identity

Seats are fixed at creation and keyed by `normalizePlayerName(seat.name)` — the exact rule
`joinableGames.ts` uses to resolve `you`. Colors are frozen (`CampaignSeat.color`) and the
per-game color override route (`API_GAME_PLAYER_COLOR`) is **disabled for campaign missions**
(the campaign map, lineage and titles are color-coded across four games; a mid-campaign
recolor would break the chronicle). Per-mission `PlayerId`s differ; the campaign stores the
mapping `missions[i].playerIds: Record<seat, PlayerId>` captured at launch, which is what
lets the map deep-link every participant into their own seat and lets «Продолжить» work.

Adding/removing participants mid-campaign is out of scope, and nothing in the existing
architecture demands it: mission creation is a fresh `Game.newInstance` from the frozen
seat list each time, so the roster is naturally re-assertable. The only conflict is the
name-keyed join model itself: **if two people share a normalized name, seat resolution is
ambiguous** — the same `ambiguous` problem `JoinableGameSummary` already surfaces. v1
answer: campaign creation refuses duplicate normalized names among seats (the creator
already refuses duplicate names via `launchIssues`), and the map shows the same
"several players share your name" state the lobby does.

### 2.4 The Campaign server document

`src/server/campaign/Campaign.ts`:

```ts
export type SerializedCampaign = {
  version: 1;                       // in-code upgrade path, mirroring SerializedGame practice
  id: CampaignId;
  name: string;                     // via generateGameName(...) — same generator as games
  createdTimeMs: number;
  creatorSeat: 0;
  seats: ReadonlyArray<CampaignSeat>;
  settings: CampaignFrozenSettings; // §2.8 — the NewGameConfig-shaped frozen snapshot
  generator: {seed: number; version: number; pool: ReadonlyArray<BoardName>};
  missions: SerializedMissionSlot[];        // length CAMPAIGN_MISSION_COUNT
  pointer: number;                  // index of the current slot (active or next-ready)
  phase: CampaignPhase;
  progression: {
    lineages: Record<number /*seat*/, CardName[]>;   // ordered, mission-1-first
    botCorporation?: MarsBotCorpId;                  // fixed after mission 1 (§6.6)
    titles: Array<{seat: number} & TitleEntry>;      // flattened ledger (also inside results)
  };
};
```

The document is small (a few KB) and **write-through**: every mutation persists before the
mutating route responds. There is no partial-write shape — the whole blob is rewritten,
exactly like a game save.

### 2.5 Persistence — `IDatabase` extension

Add to `IDatabase` (implement in **all three** backends; keep the lazy-require discipline of
`Database.ts` — no top-level backend imports):

```ts
saveCampaign(campaign: SerializedCampaign): Promise<void>;
getCampaign(id: CampaignId): Promise<SerializedCampaign>;
getCampaignIds(): Promise<Array<CampaignId>>;
deleteCampaign(id: CampaignId): Promise<void>;      // hard delete; 'abandoned' is the soft path
```

- **SQLite**: `CREATE TABLE IF NOT EXISTS campaign(campaign_id varchar primary key,
  campaign text, created_time timestamp default current_timestamp)` in `initialize()`.
  Single-row upsert per save (the `session` pattern, `SQLite.ts:271-288`).
- **PostgreSQL**: same table in the `initialize()` DDL; **add `'campaign'` to
  `POSTGRESQL_TABLES` (`PostgreSQL.ts:17`)** — test teardown consumes that list.
- **LocalFilesystem**: new folder `campaigns/`, `campaignFilename(id)`; **writes ride
  `pendingWrites` via `writeAtomic`, reads `await flushPendingWrites()` first** — the
  backend's two hard rules. A `c*.json` file must live in the subfolder, not `dbFolder`
  (whose `asGameId` scan filters by the `g` prefix but a subfolder matches the existing
  shape and is future-proof).

No campaign↔game join table: the link lives redundantly in (a) `campaign.missions[i].gameId`
and (b) `gameOptions.campaign.campaignId` inside each mission's `SerializedGame` (which
serializes `gameOptions` wholesale — zero serializer work). Reverse lookup ("is this game a
mission?") reads (b); forward lookup reads (a). Old saves: absent field → not a mission.

### 2.6 `CampaignManager` (new, `src/server/campaign/CampaignManager.ts`)

Process singleton mirroring `RematchManager`'s shape but persistence-backed:

- in-memory `Map<CampaignId, Campaign>` cache, lazy `load(id)` through the DB;
- **in-flight locks**: `creating: Set<string /*request key*/>` and
  `launching: Map<CampaignId, number /*slot*/>` — the same race guard idea as
  `RematchEntry.creating`, protecting double-submit within one process (Node's
  single-threaded loop makes this sufficient; there is no multi-process deployment);
- all mutations funnel through methods that (1) validate invariants, (2) mutate,
  (3) `await db.saveCampaign`, (4) fire realtime invalidation, (5) return the model;
- `getModel(campaign, viewerName)` — per-viewer projection (the `RematchManager.getModel`
  precedent: never leak another seat's PlayerIds).

### 2.7 Lifecycle, invariants, transactions

**State machine** (phase transitions are the ONLY writers of `phase`):

```
create+generate ─► generated ─(launch slot 0)─► missionActive
missionActive ─(commitMissionResult, slot<3)─► interlude
interlude     ─(launch slot pointer)─────────► missionActive
missionActive ─(commitMissionResult, slot=3)─► finished
any except finished ─(abandon)───────────────► abandoned
```

**Invariants** (each guarded by a spec in `tests/campaign/`):

1. At most one active mission: `phase === 'missionActive'` ⇔ exactly one slot has
   `gameId !== undefined && result === undefined`, and it is `missions[pointer]`.
2. Missions launch strictly in order: `launch(slot)` requires `slot === pointer` and
   (`slot === 0 && phase === 'generated'`) or (`slot > 0 && phase === 'interlude'`).
3. A committed `MissionResult` is immutable; it is never re-derived from live Game state.
   Re-commit for the same `gameId` is a no-op returning the stored result (idempotent).
4. Bonuses apply exactly once: they are *stored* in `missions[i].result.bonuses` and
   *consumed* by the creation of mission `i+1` (baked into `GameOptions.campaign.grants`);
   the mission game applies them exactly once at first-corp play (§7.6). Re-launch of an
   already-launched slot returns the existing `gameId` — it can never re-apply.
5. The board sequence and settings never change after generation (§2.11).
6. The Campaign Map is always built from the server model — the client holds no campaign
   state that survives navigation.
7. Ordinary games: `gameOptions.campaign === undefined` ⇒ byte-identical behavior
   (guarded by a spec asserting no campaign code runs without the marker).

**Transaction boundaries** — the three dangerous seams, in commit order:

*(a) Campaign creation* (`POST /api/campaign/create`):
```
validate → build Campaign (roll boards, §2.11) → await db.saveCampaign → respond
```
Unlike game creation, the campaign IS persisted before the response. A crash before
`saveCampaign` = no campaign, client retries (creation request carries a client-generated
idempotency key echoed into the `creating` lock so a double-tap cannot mint two).

*(b) Mission launch* (`POST /api/campaign/launch?id=<campaignId>&as=<name>`):
```
lock(campaignId) →
  if missions[pointer].gameId !== undefined: return existing (idempotent fast path)
  build NewGameConfig from frozen settings + slot board + campaign contract (§2.8)
  Game.newInstance(...)                       // in memory
  await Database.saveGame(game)               // ★ FIRST SAVE AT CREATION — deviation from
                                              //   the normal flow, deliberate: the campaign
                                              //   is about to hold a durable pointer to it
  missions[pointer].gameId = game.id; playerIds captured; phase = 'missionActive'
  await db.saveCampaign(campaign)             // pointer commit
  gameLoader.add(game)                        // cache + LobbyIndex
  realtime invalidations → respond model
→ unlock
```
Failure analysis: crash after `saveGame`, before `saveCampaign` → an orphan mission game
exists but the campaign still says `interlude/generated`; the next launch attempt mints a
*new* game and the orphan is garbage (visible in «Мои партии» only if someone's name
matches; acceptable, and `purgeUnfinishedGames` reaps it). Crash after `saveCampaign` →
fully consistent (the game is on disk; `GameLoader.getGame` force-loads on demand). This
ordering means **the campaign never points at a game that doesn't exist on disk** — the
inverse orphan (dangling pointer) is the one that would corrupt the map.

*(c) Mission result commit* — hooked at the end of `Game.gotoEndGame()`
(`Game.ts:1412`), after `phase = Phase.END` and the game's own save:
```
if (game.gameOptions.campaign !== undefined)
  await CampaignManager.getInstance().commitMissionResult(game)
```
`commitMissionResult(game)`:
```
lock → load campaign → if missions[slot].result: return (idempotent)
  standings = computeMissionStandings(game)          // §7.3, server-side, pure
  titles/bonuses from campaignConfig tables (§7.4/§7.5)
  result = {..., gameLastSaveId: game.lastSaveId, gameUndoCount: game.undoCount}
  missions[slot].result = result
  progression.titles += ...; pointer advance; phase = slot<3 ? 'interlude'
                                              : 'finished' (+championSeat)
  await db.saveCampaign → realtime invalidations → unlock
```
Because the commit is **re-derivable and idempotent** (inputs: the terminal game state +
frozen config tables), a crash between the game's END save and `saveCampaign` self-heals:
the hook re-fires when the game is next loaded at `Phase.END` with an uncommitted slot
(add a reconciliation check in `CampaignManager.load` / on `GET /api/campaign` — if the
pointed game is END and the slot has no result, commit lazily). This is invariant 3's
"never recomputed from *mutable* state": the game at END is terminal, so late derivation
is safe; after the commit the snapshot is authoritative even if the game is purged.

### 2.8 The mission contract — `GameOptions.campaign`

`src/server/game/GameOptions.ts` gains:

```ts
campaign?: {
  campaignId: CampaignId;
  missionSlot: number;              // 0..3
  missionCount: number;             // CAMPAIGN_MISSION_COUNT
  final: boolean;                   // slot === missionCount-1
  grants: Record<Color, {           // keyed by color (unique per campaign; stable in-game key)
    bonusMegaCredits: number;                  // 0 for mission 1
    corporations: ReadonlyArray<CardName>;     // the lineage to auto-play, in order
    titlePoints: ReadonlyArray<TitleEntry>;    // only populated when final === true
  }>;
}
```

- Built exclusively by `CampaignManager.launchMission` — never client-supplied. The
  campaign create/launch payloads never accept a `campaign` field inside `NewGameConfig`;
  `ApiCreateGame` explicitly strips/rejects it so an ordinary create can't forge a mission.
- Serialized for free (`gameOptions` rides `SerializedGame` wholesale); absent on all old
  saves; `Game.deserialize` needs no change.
- `CampaignFrozenSettings` (stored on the campaign) is the `NewGameConfig`-shaped snapshot
  taken once at campaign creation: players (name/color/handicap/first), expansions, rules
  flags, bot difficulty, banned/custom lists. Mission launch derives each mission's
  `NewGameConfig` from it mechanically: `board = missions[slot].board`, fresh seed,
  `bannedCards = frozen.bannedCards ∪ {MERGER} ∪ allLineageCorps ∪ {botCorpOriginal}`
  (§6.5), `automa = {difficulty, corporation: progression.botCorporation}` (missions ≥ 2).
  Because the derivation is server-side and pure, "settings can't drift between missions"
  is true by construction; a spec pins it.

### 2.9 Undo / rollback interplay

- **In-mission undo** (player `UndoActionOption`, `LOAD_GAME`, admin rollback to a save
  *at or above* `Phase.END`'s predecessor) — invisible to the campaign: no result is
  committed until END.
- **Rollback across the END boundary of a committed mission** — today `ApiAdminRollback`
  would silently desync the campaign (finding §1.6.4). Add a guard in
  `ApiAdminRollback.post` (and `LoadGame.put`): if the target game has
  `gameOptions.campaign` and its slot has a committed result:
  - if the **next mission was already launched** → `409` with reason «результат миссии уже
    использован следующей миссией» — rollback refused (the admin's escape hatch is
    campaign abandon);
  - else → allow, and call `CampaignManager.revokeMissionResult(gameId)`: slot result
    cleared, pointer rewound, phase back to `missionActive`, titles ledger recomputed from
    remaining results, persisted. The stored `(gameLastSaveId, gameUndoCount)` fingerprint
    is what makes "the game moved backwards below the commit point" detectable in the lazy
    reconciliation path too (a rolled-back game re-reaching END recommits fresh).
- The client campaign cache key includes `campaign.rev` (§2.10), so a revoke/re-commit
  invalidates every viewer.

### 2.10 Realtime + client caching

- The campaign document carries a monotonically increasing `rev` (bumped on every
  `saveCampaign`). `GET /api/campaign` returns it; the console derived-cache stamps on it
  (satisfying `tests/console/serverDerivedCacheGuard.spec.ts` — the campaign fetch module
  names its own version, or joins `NOT_A_CACHE` deliberately; prefer the former).
- Push, v1 (no protocol bump): on every campaign mutation, `RealtimeHub.invalidate` fires
  for **each mission gameId that exists** (the `ApiGameRematch.post:93` piggyback pattern)
  + `invalidateLobby(rev)` for viewers sitting in the menu/map without a game
  subscription. The standalone Campaign Map screen subscribes to the lobby room (it
  already exists, anonymous) and re-fetches `/api/campaign` on any lobby revision — cheap
  and correct, if slightly chatty. A dedicated campaign room (new `SUBSCRIBE_CAMPAIGN`
  message + `REALTIME_PROTOCOL_VERSION` bump) is deferred until the chattiness bothers
  anyone (§11).
- Poll floor: the map screen re-fetches on a 5 s timer while `missionActive` and a
  30 s timer otherwise (mirroring `lobbyState`'s floors).

### 2.11 Campaign generation (boards)

Server-side, once, inside campaign creation:

```ts
const pool = boardOptions(RandomBoardOption.ALL, {automa: hasBot});  // randomBoard.ts:21
if (pool.length < CAMPAIGN_MISSION_COUNT) → 400 «Недостаточно уникальных карт …»
const rng = new SeededRandom(seed);        // seed = Math.random(), recorded
boards = shuffle(pool, rng).slice(0, 4);   // unique by construction
campaign.generator = {seed, version: CAMPAIGN_GENERATOR_VERSION, pool: [...pool]};
```

- **Same pool, same bot filter as single games** — `boardOptions` is the single source
  (`AUTOMA_SUPPORTED_BOARDS` intersection included). No second compatibility list.
- Today the pools are 9 (no bot) / 5 (bot) — both ≥ 4; the `< 4` guard is future-proofing
  with an honest reason, surfaced as a launch blocker in the creator (`launchIssues` row).
- The **concrete `BoardName[4]` snapshot is what's authoritative** — the seed/pool/version
  triple is provenance only. Code updates that change the pool never reshuffle an existing
  campaign; clients all see the persisted sequence; reload/reconnect re-reads it.
- If a persisted board becomes unlaunchable after an app update (board removed, or bot
  profile dropped), `launchMission` fails **loudly** with the board name and reason; the
  map shows the blocked state. Recovery is an explicit admin/creator action, not silent
  substitution (open decision D12, §12).

### 2.12 ✅ Project carryover — «Наследие проектов» (added at approval)

After missions 1–3 each **human** seat may keep 0–2 project cards from their actual
terminal hand; the cards travel ONLY into the immediately-next mission. MarsBot never
participates and receives no compensation. No fee to keep, no fee to receive (the card
arrives in hand free; playing it later costs its normal price). Nothing else of the hand
survives.

**Domain**: carryover is interlude state, NOT part of the immutable `MissionResult`
(the result commits at END; the selection happens after). Per campaign, per interlude:

```ts
// on SerializedCampaign
carryover?: {
  sourceSlot: number;                       // == pointer's committed slot
  bySeat: Record<number /*seat*/, {
    status: 'pending' | 'confirmed';
    cards: ReadonlyArray<CardName>;         // 0..2, validated server-side
    consumed: boolean;                      // set atomically by the next launch
  }>;
};
```

- Eligibility snapshot: at result commit the server records each human seat's terminal
  hand (`missions[slot].result` gains a **server-private** `finalHands` map — stripped
  from every wire model; used only to validate selections). Empty hand ⇒ the seat is
  auto-`confirmed` with 0 cards.
- Selection route (`POST /api/campaign/carryover`): owner-only (their mission PlayerId
  is the bearer token), re-validates every card against the recorded terminal hand,
  rejects duplicates/`>2`/forged names/non-project cards; idempotent re-submit;
  revisable while `pending || confirmed` and the next mission is not launched.
- Launch gate: the creator can launch the next mission only when every human seat is
  `confirmed` (0 cards counts). Launch atomically marks all selections `consumed` in the
  same campaign save that records the new `gameId` — re-launch cannot double-apply.
- Deck invariant: carried CardNames are **removed from the next mission's project deck
  before dealing** (reservation via the banned/filter mechanism scoped to the project
  deck) and granted to the owner's hand server-side when their initial-cards purchase
  completes — one card object, never a second copy, reshuffle-safe, reload-safe
  (granted-flag serialized on the player).
- Privacy: card faces/names are owner-only. Other participants (and every shared wire
  surface: campaign model for other viewers, logs, realtime, GameOptions) see only
  `status` + count. Carried names therefore NEVER ride `GameOptions.campaign` (which
  serializes into the client-visible game options) — they are injected directly into
  server-side per-player state at mission creation.
- Rollback: revoking the source mission's result (allowed only while the next mission
  doesn't exist) clears the interlude carryover state wholesale.
- App-update loss: a stored CardName that no longer resolves blocks the launch with the
  exact reason; the owner may drop or replace it from the recorded terminal hand; the
  map shows the blocked state honestly. Never silently substituted or dropped.

### 2.13 ✅ Approval-time architecture amendments

1. **Stable seat identity.** All progression (grants, lineage, titles, bonus M€,
   carryover) keys on the immutable **seat index** of `CampaignSeat`, never on `Color`
   and never on display name. Mission creation maps seat → concrete `Player` directly
   (the manager creates the players), and each mission player carries its
   `campaignSeat` in serialized state. Color stays presentational; name normalization
   is used only for join/viewer resolution, never for applying rewards.
2. **Durable creation idempotency.** The client-generated idempotency key
   deterministically derives the id: `CampaignId = 'c' + sha256(key).hex.slice(0,12)`.
   Creation = "persist if absent, else return the existing document" — survives server
   restart, lost responses, retries and reconnects with no extra mapping table. The
   in-memory `creating` lock remains only as a same-process race guard.
3. **Scoring wire contract.** `VictoryPointsBreakdown.titles` is **optional**
   (`titles?: number`), emitted ONLY for final campaign missions. Ordinary games and
   missions 1–3 keep their exact current wire shape (no visible empty category, no
   byte-shape change); specs assert absence rather than `titles: 0`.
4. **Champion plurality.** `championSeat` → `championSeats: number[]` — a full tie
   after final VP (incl. TP) + M€ shares the championship, matching the endgame's
   existing co-winner semantics. No random or seat-order tie-break is ever introduced.
5. **Grants privacy split.** `GameOptions.campaign` carries only PUBLIC contract data
   (ids/slot/final flag, per-seat: bonus M€, lineage CardNames — public by design,
   title points). Private per-seat data (carried project cards) flows through the
   server-only creation path (§2.12).


## 3. User flows

### 3.1 Creation

Entry: «Новая партия» in the main menu, unchanged. `ConsoleCreateGame` gains a **mode
stage** — stage 0 before the decks:

- Two premium tiles: **«Отдельная партия»** and **«Кампания»** (terminology: «отдельная»,
  never «одиночная» — the codebase already uses «партия» for a game and MarsBot solo is a
  roster fact, not a mode; the English i18n keys are `'Single game'` / `'Campaign'`,
  mission = `'Mission'` / «Миссия»).
- «Отдельная партия» → the exact current creator, zero regressions. The mode stage is
  skipped entirely when restoring a saved single-game draft (default mode = single;
  one B from the decks returns to the mode stage, second B to the menu).
- «Кампания» → the same creator chassis with:
  - **Crew deck** — verbatim reuse (`ConsoleCrewDeck`); same constraints
    (`PLAYER_COUNT_MIN/MAX`, `HUMANS_WITH_BOT_MAX`, MarsBot seat, difficulty, TR-boost
    per-seat values). One extra `launchIssues` row: duplicate normalized names blocked
    (§2.3).
  - **Rules deck** — verbatim reuse; `testMode` behaves as today (admin-gated) and marks
    the whole campaign as a test campaign (§9.7).
  - **Expansions deck** — verbatim reuse; `stateAutomaConflicts` applies unchanged.
  - **Map deck → «Маршрут» deck** — replaced: no manual map pick. Shows the briefing:
    pool size for the current roster («9 карт в пуле» / «5 карт, адаптированных для
    MarsBot»), the uniqueness rule, and a `PremiumMapFingerprint random` ghost. Read-only;
    no dead controls.
  - **Launch panel → «Брифинг кампании»** — crew chips, expansions, rules, the route
    placeholder, readiness; X-verb = «Сформировать кампанию».
- State: `PremiumCreateGameState` gains `sessionMode?: 'single' | 'campaign'`
  (sanitized default `'single'`; persisted in the same `tm_last_game_settings` blob —
  one field, no key collision). It is deliberately NOT the existing `gameMode`
  (`'multiplayer'|'marsbot'`), which stays a roster-derived fact.
- UI model: one new `CREATE_DECKS` row shape is *not* needed — the map deck row is
  swapped by `sessionMode` inside the existing table/switches (each exhaustive per-deck
  switch in `ConsoleCreateGame.vue` / `consoleCreateModel.ts` gains a campaign arm).
- Confirm: `ConsoleLaunchConfirm` variant for campaigns («Сформировать кампанию из
  4 миссий?» + roster + expansions). Submit → `POST /api/campaign/create` with
  `{seats, settings, idempotencyKey}` → response `{campaignId, you}` →
  `navigateWithCurtain(paths.CAMPAIGN + '?id=' + campaignId, 'expedition')`.

Who can create: anyone (same as game creation; `QuotaHandler` covers the new route).
Who can launch missions: **seat 0 (creator) only** — recommended default, open decision
D6 offers «любой участник».

### 3.2 Generation → Campaign Map (seamless)

The client lands on the Campaign Map screen with the boot curtain
(`loadingScreenState`, same `'expedition'` stage), fetches `/api/campaign`, and — on the
first-ever view by the creator right after creation — plays the generation ceremony
(§5.1). Everyone else (or any reload) lands SETTLED. The «played once» latch is
client-local (sessionStorage handoff from the creator, the `tm_boot_curtain` pattern) —
the server never tracks presentation state.

### 3.3 Launching a mission / joining

- Creator, on a `ready` slot: A = «Начать миссию N» → `POST /api/campaign/launch` →
  response carries `{gameId, yourPlayerId}` → `recordLastGameEntered(gameId)` →
  `navigateWithCurtain('player?id=' + yourPlayerId, 'expedition')`. Double-press /
  refresh / two creator clients: the launch is idempotent (§2.7-b) — every path lands in
  the same game.
- Other participants: the map shows «Миссия N идёт» with A = «Присоединиться» resolving
  their own `playerIds[seat]` from the model. They can also enter through «Продолжить» /
  «Мои партии» exactly as today (the mission is a real game with their name on a seat).
- Disconnect/reconnect: nothing new — a mission is an ordinary game; the PlayerId-in-URL
  model plus the map's deep link cover re-entry at any point. The campaign screen itself
  is stateless-reloadable (server model + `rev`).

### 3.4 Mission end → interlude (detailed in §5.3, §7)

Server: `gotoEndGame` commits the result (§2.7-c) before the client ever sees `Phase.END`
answered with a committed campaign — so **every client, in any order, at any reconnect
point, renders the ceremony from committed data**. Client: standard endgame ceremony →
Titles stage → campaign-map scene inside the endgame workspace → marker advance →
creator CTA / waiting state. Reload mid-ceremony lands SETTLED (the existing
`sawLivePhase === false` rule of the endgame workspace) — the map scene in its final
state, «Повторить подсчёт» available as today.

### 3.5 «Мои партии» / «Продолжить» / finished campaigns

- `JoinableGameSummary` gains `campaign?: {id: CampaignId; name: string; slot: number;
  count: number}` (populated by `joinableSummaryFromRecord` reading the serialized
  game's `gameOptions.campaign`; `lobbyIndex`'s record gains the field).
- The «Мои партии» list **groups**: mission rows with the same `campaign.id` collapse
  into ONE campaign row — campaign name, «Миссия k/4», phase chip (`идёт` / `между
  миссиями` / `завершена`), crew, `Your turn` when the active mission waits on you.
  A = open the Campaign Map (not the game) — the map is the campaign's front door; the
  active mission is one A away from there. Non-campaign rows unchanged.
- «Продолжить» prefers the last-entered game as today; when that game is a mission, the
  sub-text carries the campaign context («<Кампания> · Миссия 2 · Поколение N»). Entering
  goes straight into the game (fastest path to play), not through the map.
- Finished campaigns: the finished-games tab shows one campaign row; opening it lands on
  the Campaign Map **chronicle** (§4.5). Individual finished mission games remain
  openable from inside the chronicle (each mission card → «Открыть итоги миссии» → the
  game's settled endgame, the existing archive re-entry semantics).
- Campaign with zero launched missions ever: still listed (the campaign document itself
  backs the row even with no games); `abandoned` campaigns are hidden from the default
  lists.

---

## 4. Campaign Map Workspace

### 4.1 Two hosts, one surface

`ConsoleCampaignMap.vue` renders in two places:

1. **Standalone App screen** — new `Screen` member `'campaign'` in `App.vue` (:338),
   route `paths.CAMPAIGN = 'campaign'` (+ `requestProcessor.ts` `ServeApp` row), query
   `?id=c…`. It is a pre-game-style console shell state (like menu/creator): pad input
   via `useConsoleInput({menuSurface: true})`, own `ConsoleCommandBar`, async chunk in
   `console-menu`. Used: after creation, from «Мои партии», between missions, chronicle.
2. **Endgame stage** — a scene inside the existing endgame workspace frame, following the
   `ConsoleEndgameOverview` precedent (a second scene in the SAME frame, parked by
   opacity/visibility — never `display`; no second pad owner; B returns). The component
   takes `embedded: true` (host-agnostic per the embed contract: strips its shell,
   hands its stage name up, content/input/state untouched). This satisfies «бесшовный
   этап endgame flow» without a modal and without routing through the main menu.

Both hosts feed the same pure model: `src/client/console/campaign/campaignMapModel.ts`
(builds the whole scene from `CampaignModel` + viewer), state module
`campaignMapState.ts` (cursor, inspection route, ceremony latch), styles
`src/styles/console_campaign.less` (rem @20px, `.con-cmap` root, `con-ws` marker in the
embedded host). Fetch module `campaignState.ts` stamps its cache with `campaign.rev`
(derived-cache guard, §2.10).

### 4.2 Information hierarchy (primary layer)

One screen, no scroll, three bands inside the safe area (`--con-hud-pad-x` for
text/controls, `--con-stage-x` for the route stage):

1. **Header** — campaign name (display face), progress («Миссия 2 из 4»), phase chip.
   Crumb grammar when embedded: the endgame workspace's head gains the stage tail
   («ИТОГИ › КАМПАНИЯ») — the map never titles itself inside a host.
2. **The route stage** (dominant, center) — four mission cards left→right joined by a
   drawn connector line. Each card = `PremiumMapFingerprint` (`variant='card'`) + name +
   state dressing:
   - **completed** — calm, slightly desaturated *by material* (never color-only): a
     «завершена ✓» plate + a compact result strip (place-ordered seat cubes; earned
     title icons at 1.5rem with count, details on inspect);
   - **current** — elevated (scale ≈ 1.06, brightest border material), the **party
     marker**: the seats' colored cubes clustered on the connector node entering the
     card; a state line («Идёт · Поколение N» / «Готова к запуску»);
   - **future** — muted veil + smaller; the board name IS shown (the route is public by
     design) but its fingerprint renders at lower contrast;
   - **final (slot 3)** — a distinct «ФИНАЛ» banner plate and a heavier frame material;
     deliberately styled to read as a destination, not as a competing CTA (no glow while
     it isn't current).
   - Modifier chips would dock under a card's name — **zone renders nothing when the
     modifier list is empty** (no placeholder).
3. **Progression rail** (right or bottom, profile-dependent) — per-seat rows: cube +
   name + title icons earned (compact row) + «Очки титулов: N». On the final mission and
   in the chronicle the rail adds the champion marker. TP shown from mission 1 onward so
   the accumulation is legible all campaign.
4. **Footer** — the ONE command bar (`ConsoleCommandBar` / host's bar when embedded).

Loading / error / waiting are full states of the same surface: skeleton route while
fetching, an honest error plate with retry (A), and the non-creator waiting state on a
`ready` slot («Ожидание запуска миссии — запускает <имя>») — never a dead screen.

### 4.3 Controller navigation / focus graph

- **D-pad ←/→** — cursor across the four mission cards (state-driven index, the
  console-native norm; no DOM focus). **↑/↓** — move between route and progression rail
  rows. Cursor rendering: state class + `box-shadow` ring (paint baseline: no filters).
- **A** — contextual: on the current `ready` slot for the creator = «Начать миссию N»
  (with the hold-confirm ring, `consoleHoldConfirm`, for the commit weight); on an
  `active` slot = «Присоединиться»/«Продолжить»; on a completed slot = open the mission
  dossier; on the rail = open that player's dossier.
- **X** — «Досье миссии» on any card: an inspection layer (over the stage, never
  unmounting it — the `consoleCardZoom` restoration model: module-state cursor survives,
  closing restores exactly). Contents per state: completed → full standings, titles with
  large icons, bonus M€ granted, «Открыть итоги миссии»; current/future → board dossier
  (fingerprint hero variant, board blurb), modifiers when they exist.
- **Y** — «Досье кампании»: per-seat lineage (corporation face rows in play order — the
  premium card face at thumb tier), title ledger with mission provenance, TP math.
- **LB/RB** — page between seats inside the dossiers (the `inspectSwitchMotion` idiom);
  unused on the primary layer (four cards don't need paging) — hints hidden, no stale
  glyphs.
- **B** — standalone host: back to menu (or to «Мои партии» if arrived from there);
  embedded host: back to the endgame results scene (the endgame workspace's own B
  grammar). Inside inspections: one logical level up, cursor restored.
- Every verb renders only via the command bar; blocked verbs (launch for non-creator)
  render disabled WITH the reason line, per invariant «blocked = disabled + reason».

### 4.4 States must not be color-only

Completed/current/future/final are each carried by ≥2 channels: plate text
(«завершена» / «текущая» / «ФИНАЛ»), scale/veil material, marker presence, and the
connector's fill progress (solid behind the party, dashed ahead). Title icons are already
shape-coded (3/2/1 chevrons) on top of their metal — name them in dossiers regardless.

### 4.5 Chronicle (finished campaign)

Same surface, `phase === 'finished'`: all four cards completed-dressed, connector fully
solid, the champion celebrated on the rail (name + Governor-tier framing + final score
with «включая Очки титулов: N»), header chip «Кампания завершена». CTA row: «Итоги
финала» (opens mission 4's settled endgame), per-mission dossiers, «В меню». Re-openable
forever from «Завершённые» (§3.5); no ceremony replays on entry.

### 4.6 Future modifiers — the extension point (and nothing more)

- Data: `MissionSlot.modifiers: MissionModifier[]` exists from day one, always `[]`.
- Server: one pure function stub `validateMissionModifiers(slot, campaign): Issue[]`
  called at generation and launch — v1 body: `return []`. Its signature already receives
  board + settings + seats, which is the whole future compatibility surface (board /
  expansions / roster / bot / mutual), so adding real modifiers later is table + validator
  work, not plumbing.
- UI: the chip dock zone in the mission card + a dossier section — both render nothing on
  empty. No settings UI, no generation of modifiers, no modifier engine.

---

## 5. Motion specification

Grammar: everything is the existing COMMIT → RELEASE → UNFOLD → REVEAL phrase, built from
`consoleActionOutcomeMotion.ts` / `workspaceDescend.ts` primitives; all durations
`motionMs()` / `calc(*ms * var(--motion-scale,1))`, easings from `MOTION_EASE`; every
gate is an animation hold with a reactive release predicate (`animationHold.ts`), never a
`setTimeout`; reduced motion resolves every episode instantly in the same callback order;
ambient effects are compositor-only (opacity/transform pseudo-element loops joined to the
fx-lite stop list) — **no `filter`, no `text-shadow`** (paint baseline strips them).

### 5.1 Campaign generation ceremony (creator, once)

1. **COMMIT** — the launch-confirm press; hold ring completes; the creator screen's
   content fixes (no further input; `acceptsInput`-style absorption).
2. **RELEASE** — the creator decks let go in place (the `playConfigRelease` 180 ms
   pattern); frame and header stay.
3. **UNFOLD** — navigation to the map happens under the existing curtain (the deliberate
   full reload at the app boundary — the curtain IS the unfold here; no fake in-place
   morph across a navigation). On arrival the route zone unfolds from center
   (`descendUnfold`, clip-path, never scale).
4. **REVEAL** — the connector line draws left→right (stroke-dashoffset on transform-safe
   SVG, ~420 ms), then the four mission cards surface **sequentially**
   (`descendCascade`, ~150 ms stagger), each materializing its fingerprint; card 4's
   «ФИНАЛ» plate lands last with a single heavier settle (`MOTION_EASE.settle`).
5. The party marker materializes on mission 1's node; focus (cursor) lands on mission 1;
   the command bar composes with «Начать миссию 1» as the A-verb. **The CTA appears only
   after the reveal settles** (hold-gated) — no premature CTA.
6. The roguelike feel comes entirely from this sequence — generation → route reveal →
   node advance. No particles, no fantasy dressing.

Non-creator first view / any reload: SETTLED instantly (client latch, §3.2).

### 5.2 Mission launch

Creator presses A (hold-confirm): marker cubes pulse once on the node → curtain
(`'expedition'`) → game boot. Other clients see the slot flip to «идёт» on the next
invalidation — a calm state crossfade (the stage-segment crossfade idiom), no ceremony.

### 5.3 Mission end → interlude sequence (embedded host)

1. Standard endgame ceremony runs unchanged (scoring → ranking → [tiebreak] → winner).
2. **Titles stage** (missions 1–3; final mission variant in §7.7): new
   `CeremonyPhase`/`CeremonyBeat` between `winner` and `actions`
   (insertion points enumerated in §7.7). Per titled seat, ascending
   (Prefect → Administrator → Governor so the Governor is the climax):
   - the title emblem surfaces (scale 0.92→1 + opacity, `enter` ease; weights:
     Prefect ~360 ms restrained · Administrator ~480 ms + one ring pulse · Governor
     ~640 ms + connector-gold sweep on its plate — differentiated but the whole stage
     stays under ~4 s for 3 titles);
   - beneath it: «Очки титулов +N» ticker and — separate line, separate concept — the
     compensation row «К следующей миссии: +M M€» for every seat that has one (a seat
     can have a bonus and no title; the bonus line renders regardless of title).
   - The stage is skippable exactly like the rest of the ceremony (the existing
     ceremony fast-forward), and `finalizeCeremony` settles it.
3. **Actions** — for campaign missions the action list leads with «Карта кампании»
   (rematch verbs suppressed for missions 1–3, replaced by the campaign flow; final
   mission keeps «Обзор партии» etc.).
4. **Map scene** — A on «Карта кампании» (or auto-advance after the ceremony settles —
   open decision D9): the results content RELEASES in place, the campaign map scene
   UNFOLDS inside the same endgame frame (scene swap by opacity/visibility), the map
   REVEALS settled except:
   - the just-finished card plays its completion dressing (result strip + title icons
     cascade in, ~300 ms);
   - the **party marker travels** along the connector to the next node (single tween,
     ~700 ms, `standard` ease, transform-only) — the one «продвижение» beat;
   - the next card sheds its veil; CTA/waiting state composes after the marker settles
     (hold-gated).
5. B from the map scene returns to the results scene (nothing unmounted); leaving the
   endgame workspace entirely follows its existing conclusion grammar.

Reconnect anywhere in 1–5: server state (committed result) wins; the client lands in the
settled equivalent of wherever it reloaded; ceremony replay only via «Повторить подсчёт».

### 5.4 Performance

Route stage = 4 fingerprint SVGs + 1 connector + ≤6 marker cubes — trivial. Rules:
marker travel and card settles are transform/opacity only; the connector draw is a
one-shot (no ambient line animation on Deck; if an idle shimmer is wanted on TV it joins
fx-lite); fingerprints are static after reveal. Verify on the `deck` e2e profile
(1280×800) and `tv4k`.

---

## 6. Corporations and Merger

### 6.1 What Merger actually is (verified semantics)

`src/server/cards/promo/Merger.ts` — prelude, `X41`, `mergerCost = 42` (:35):
deal 4 corps off the **shared** `game.corporationDeck` (:70-79, uniqueness structural);
affordability gate via a local `spendableMegacredits` (Manutech/LTF/Helion aware,
:91-118); fizzle + discard if none affordable (:43-47); `SelectCard` marked
`.markStartGamePrompt({kind: 'corporationSelection'})` (:48-53) — the client contract;
then `.andThen`: `inDoubleDown = false` (:56), **`player.playCorporationCard(card)`**
(:57 — the merge itself), discard losers, and a **deferred 42 M€ payment after the corp
play** (:63) so the new corp's resources can pay it.

**The reusable piece for the campaign is the one-liner at :57** — the additional-corp
path of `playCorporationCard`. The deal-4/pay-42 wrapper is Merger's own balance and is
NOT reused (campaign merges are the campaign's reward; open decision D3 covers charging
a fee). Campaign missions ban the card itself from the prelude pool (§6.5) while its
engine path does all the merging.

### 6.2 What playing a corporation contributes (`Player.ts:1439-1561`)

Per corp, in order: tableau entry (tags/passives/actions live from here) → **starting
M€ unconditionally, additional corps included** (:1493) → `baseCardCost` written
additively — two cost-modifying corps STACK by design (:1494-1499) → starting-hand
purchase **only when `additionalCorp === false`** (:1503-1506) → `startingSetup` reveal
snapshot per corp (:1539) → journal line → `maybeActivateColonies` → behavior
`play()` deferred → mandatory first action pushed onto the `pendingInitialActions`
**array** (:1553; the prompt loop `:2425-2504` is already fully N-corp) →
`onCardPlayed` fan-out. Only the first corp releases the research barrier (:1467-1469).

### 6.3 Campaign progression mapped onto the engine

| Mission | Selection stage | Corp play stage (research-phase end) |
| --- | --- | --- |
| 1 | standard (`SelectInitialCards`, corp step untouched: deal `startingCorporations`, pick 1) | pick plays as base corp (buys hand) — unchanged |
| 2, 3 | **standard step** — still deal N, pick exactly 1 (min:1/max:1 untouched!). The dealt pool excludes all lineage corps + Merger + bot's corp original (§6.5). The console corp step additionally shows the lineage as a «Текущие корпорации» shelf (LT = fullscreen read) | **STAGED deployment chain** (`runCampaignDeploymentChain`, amended 2026-09-03): press 1 «КОРПОРАЦИЯ» plays the lineage in acquisition order (lineage[0] = base, buys hand); press 2 «ОПЛАТА» (when cards were bought); press 3 «СЛИЯНИЕ» (marker `corporationMerge`) plays the new pick ON TOP — its starting M€/effects apply at THIS press, **and the Merger prelude's own fee is charged right there** (D3 REVISED 2026-09-03: «Then pay 42 M€» — `Merger.mergerCost` through the same `SelectPaymentDeferred`; auto-pays when only M€ can pay, raises the real payment panel for alt-payment lineages; serialized `Player.campaignMergeFeePaid` lets recovery re-raise an unpaid fee; `campaignStartingBudget` subtracts it so the hand purchase can never spend the fee; `CAMPAIGN_MERGE_COST` in common mirrors it for the client budget, guard-spec-pinned); press 4 «НАСЛЕДИЕ» (marker `campaignLegacy`, `Priority.BACK_OF_THE_LINE` so the merge's own effects resolve first) grants the carried cards, whose `{type:'campaign'}` reveal deals them into the hand dock. One research release drains the chain; reload recovery = `campaignSetupResumeInput` (reconstructs the owed stage from the tableau + serialized flags) |
| 4 | **corp step omitted** (new `SelectInitialCards` option; preludes/CEOs/projects steps untouched — prologues are never cut) | server plays lineage[0..2] in the ONE «Штаб» press; the «НАСЛЕДИЕ» press still follows when cards were carried from mission 3 |

Readiness amendment (2026-09-03): `commitMissionResult` marks EVERY human seat's
carryover `'pending'` — an empty hand no longer auto-confirms. The confirmation press
doubles as the READINESS regime: the next mission can launch only when every human has
explicitly confirmed (empty hand → «Подтвердить готовность к следующей миссии», the
same picker door). `devCommit` fixtures stay auto-confirmed.

Key consequence: **`pickedCorporationCard` stays singular** — the player never picks more
than one NEW corp per mission, so `SelectInitialCards`'s corp step, the console start
wizard's `corp: CardName | undefined` and the whole selection transport survive
unchanged for missions 1–3. Mission 4 removes the step instead of widening it.

Starting M€ stacking (each mission, every corp in the lineage grants its
`startingMegaCredits` again — that is what :1493 does) is the recommended baseline
(escalating mission economy is the campaign's arc); open decision D4 records the
alternative. `inDoubleDown` needs no mirroring — lineage auto-play happens before the
prelude phase, where DoubleDown cannot be resolving.

### 6.4 Single-corporation assumptions to fix (the audited list)

Server:
- `Player.ts:1440` `additionalCorp = corporations().length > 0` — correct for the
  auto-play sequence as long as lineage[0] plays first; no change, but the campaign
  setup path must guarantee ordering (one sequential defer chain, not parallel).
- `Game.ts:845` / `:935` — `dealtCorporationCards.length === 0` currently means
  «beginner, play immediately / skip the start screen». **Mission 4 deals zero corps** →
  without a branch, every player is treated as a beginner. Discriminate on
  `gameOptions.campaign` (expected-corp source becomes the lineage).
- `Game.ts:940` and `:2362` — «not yet played» is `corporations().length === 0`;
  with auto-played lineage a *partially* set-up player (lineage played, pick not) would
  read as done. Replace with `corporations().length < expectedCorporationCount(player)`
  where the expectation = lineage length + (newPickExpected ? 1 : 0) from the campaign
  contract (1 for ordinary games).
- `SelectInitialCards.ts:115-127` — the hand-affordability check reads ONE corp's
  `startingMegaCredits`/`cardCost`. Missions 2–4 must evaluate against the full
  starting stack (lineage sum + pick + `bonusMegaCredits`). Extract a
  `startingPurchasingPower(player, chosenCorp?)` helper used by both the check and the
  campaign variant.
- `Game.playerHasPickedCorporationCard` / `playCorporationInput` (`Game.ts:828-882`) —
  the deferred `corporationPlay` prompt plays exactly the picked corp. Campaign: the
  play sequence becomes lineage-then-pick (missions 2/3) or lineage-only, no prompt
  needed... **keep the `corporationPlay` press** (the player's one deliberate «развернуть
  штаб» beat) and let its handler run the whole ordered sequence.
- `AutomaCorporations.humanCorporationNames` (`AutomaCorporations.ts:174-186`) — reads
  played + the singular `pickedCorporationCard`; safe here because the bot selects at
  action-phase start when lineages are already in `playedCards`, but add the lineage
  contract as an input anyway (belt and braces; also the eligible-pool-empty `throw` at
  :246-249 must be pre-validated at mission launch).
- `cardPlayPreview.ts:66,94-103` — singular subject; fine (one NEW pick), verify only.

Client (endgame narrative family):
- `EndgameWinnerReveal.vue:110`, `finalScoringRevealModel.ts:233` — `corporations[0]`;
  show the combo (join, or lead corp + «+2»).
- `gameStoryDna.ts:520,526` — `corporations[0]` + «≥2 ⇒ 'merged'» hard-codes the Merger
  narrative; generalize the arc for 2–3 corps.
- `corporationImpactEngine.ts:718-765` — `buildMergerImpact` sized for exactly 2;
  extend to N or route campaign games to a lineage-aware variant.
- `insightEngine.ts:1603,1664`, `keyEpisodeEngine.ts:519`, `insightDetail.ts:265`,
  `EndgameOverviewTab.vue:114` — copy says «second corporation» — parameterize.
- Layout: none — piles/zones are N-generic (`splitPiles`, `buildPlayedZones`).

### 6.5 Pool exclusions per mission

At mission launch (server, §2.8): `bannedCards ∪= {MERGER}` (missions 1–4 — Merger is
out of every campaign prelude pool; outside campaigns it is untouched) `∪ all seats'
lineage CardNames` (missions 2–4 — a corp already owned by ANYONE never reappears in a
deal; this enforces both own-lineage uniqueness and cross-player uniqueness, on top of
the structural one-deck guarantee within a mission) `∪ {marsBotCorpInfo(botCorp).original}`
(freeze the bot's human twin out of human deals). `filterBannedCards` covers
corporations and preludes alike (`GameCards.ts:154-163`) — one mechanism, no second
compatibility source. The lineage corps enter the game not via the deck but by direct
manifest instantiation at setup (the `new Merger()` / deserializer precedent — cards are
instantiable by `CardName`).

Also assert at campaign creation: `startingCorporations × humans + 4-mission lineage
burn ≤ corp pool size` is comfortably true for every supported module set (the
`Game.ts:470-473` failsafe remains the backstop).

### 6.6 The bot

The bot does **not** merge. `AutomaState.corporation` is a singular `MarsBotCorpId` and
~30 dispatch sites resolve through `activeCorp` — fanning that out is a project of its
own with no product need. Instead: **the bot's corporation persists across the whole
campaign.** Mission 1: normal bespoke selection (`selectCorporation`, seeded rng,
collision-checked vs human corps); the chosen id is stored as
`progression.botCorporation` at mission 1's result commit. Missions 2–4: passed as
`gameOptions.automa.corporation` — the existing override honored while eligible
(`AutomaCorporations.ts:253-256`). Eligibility holds by construction (its original is
banned from human deals, §6.5). The bot thus «проходит flow как полноценный участник» —
its corp appears in the same reveal/beats as today, no bot-only screens. Its lineage row
on the map shows one corp spanning four missions (visually honest). Open decision D5
records the «бот выбирает новую корпорацию каждую миссию» alternative.

### 6.7 Console presentation

- Missions 2/3: the start wizard's corp step keeps its transport and gains the campaign
  labels — crumb stage «СЛИЯНИЕ», the step header names the lineage it joins (compact
  row of owned corp thumbs above the choice rail). The existing `corporationSelection`
  marker path (`consoleTaskRouter`, `startGameFlowState.startFlowCorpSelectPrompt`) is
  reused — availability/uniqueness rules are the server's, per invariant 2.
- The corp-play press («развернуть штаб») triggers the ordered play sequence; the start
  scene's played dock receives each corp as its own reveal beat
  (`startSetupRevealModel` already dedupes per corp per generation — each corp's own
  `before/after` snapshot renders separately, oldest first).
- Mission 4: the corp stage is replaced by **«ШТАБ»** — a no-choice premium reveal of
  the 3-corp combo (three faces, acquisition-ordered, each with its mission-of-origin
  tag), concluding with one A. It reuses the wizard chassis (a step with `pickCount: 0`)
  so the journey rail, crumb and B-grammar stay coherent.
- First actions: 2–3 corps owing initial actions is already handled
  (`pendingInitialActions` loop + `ConsoleCorpFirstActionConfirm` array UI +
  `startFirstAction.ts` multi-corp stage) — verify, don't rebuild.
- Reload during selection: same as today (deal re-served, in-progress client picks
  reset — acceptable, unchanged). Reload after pick, before play: `Game.ts:940-943`
  recovery path, extended per §6.4.

---

## 7. Titles, bonus M€ and final scoring

### 7.1 Model separation

Three distinct consequences of a mission result, never conflated:

- **Title** (`TitleEntry`) — an honor: place-mapped name + icon + its TitlePoints.
- **Title Points** — a campaign-scoped score meter; becomes a real VP category ONLY in
  the final mission.
- **Bonus M€** — comeback compensation by place; independent of titles (a titleless
  seat can receive one), applied exactly once at the next mission's start.

Titles are NOT Milestones/Awards: separate model, separate visual accent
(`.con-eg-cat--titles` — never the milestone cyan or award gold family), separate
ledger shape in the Score Explorer, and the RU vocabulary is «Титулы» (never
«достижения»/«награды»).

### 7.2 Single source of truth — `campaignConfig.ts`

`src/common/campaign/campaignConfig.ts` — pure, table-driven, no UI knowledge:

```ts
// ✅ APPROVED (D1). Chevrons are visual rank (3/2/1), deliberately NOT the TP values.
export const TITLE_TABLE: Record<TitleName, {titlePoints: number; chevrons: 1|2|3}> = {
  governor:      {titlePoints: 15, chevrons: 3},
  administrator: {titlePoints: 10, chevrons: 2},
  prefect:       {titlePoints: 5,  chevrons: 1},
};
// place (1-based) → title, by seat count (bot counts as a full seat)
export const PLACE_TITLES: Record<number /*seats*/, ReadonlyArray<TitleName|null>> = {
  2: ['governor', 'administrator'],
  3: ['governor', 'administrator', 'prefect'],
  4: ['governor', 'administrator', 'prefect', null],
  5: ['governor', 'administrator', 'prefect', null, null],
};
// place (1-based) → bonus M€ for the NEXT mission (same for every seat count)
export const PLACE_BONUS_MC: ReadonlyArray<number> = [0, 5, 10, 15, 15];
export const FINAL_MISSION_AWARDS_TITLES = false;   // ✅ D2: final crowns the champion
export const CARRYOVER_MAX_CARDS = 2;               // «Наследие проектов», §2.12
```

Missions 1–3 rank by ordinary VP + the existing M€ tie-break only — accumulated TP never
reorder an intermediate mission. Full ties share the better place (competition ranking:
the next place is skipped), share its title AND its bonus, and the UI/journal/map show
the shared title honestly. Commit-time copies table values into results so later tuning
never rewrites history.

### 7.3 Server-side standings (new)

`src/server/campaign/missionStandings.ts` — pure:
`computeMissionStandings(game): MissionStanding[]` using `player.getVictoryPoints().total`
and the M€ tie-break. The comparator is **extracted** to
`src/common/game/scoreComparator.ts` and `endgameModel.compareScores`
(`endgameModel.ts:293-300`) is re-pointed at it — one ordering source for server
standings and client presentation (else a tie could rank differently in the two).
Full ties (total AND M€ equal): both seats share the better place (`tiedWith`), matching
the client's tied-place collapse (`endgameModel.ts:456-463`); shared place ⇒ both get
that place's title (open decision D7 for the bonus row of a shared place —
recommended: both take the better place's bonus).

### 7.4 Titles at commit

`commitMissionResult` (§2.7-c) maps standings → `PLACE_TITLES[seats.length]` →
`TitleEntry` with `titlePoints` copied from `TITLE_TABLE`; bot seats participate
symmetrically (the bot occupies a place, earns titles and TP). Final mission: per
`FINAL_MISSION_AWARDS_TITLES` — default no new titles; `championSeat` computed from the
final standings **including** the titles category (§7.7).

Journal (in the mission's own log, at commit): one `game.log` line per titled seat with
a new typed token — `LogMessageDataType.TITLE = 16` (**appended, never reordered**) —
plus the bonus line with a `RESOURCE` token: «${player} получает титул ${title} (+N ОТ)»
/ «${player}: +M M€ к следующей миссии». Renderer: `JournalTokenRenderer` branch +
`JournalTitleChip` (the `JournalMaChip` precedent). No analytics-excluded tags on these.

### 7.5 Bonus M€ — one source, three surfaces

Stored once (`result.bonuses`), read by: (1) the endgame Titles stage (preview), (2) the
map's mission dossier + next-mission briefing («Стартовый бонус: +M M€»), (3) the next
mission's `GameOptions.campaign.grants[color].bonusMegaCredits` — the only place that
*applies* it. Application (server): new optional
`SerializedPlayer.campaignBonusMegaCredits?: number` set at `Game.newInstance` from the
contract; consumed inside `playCorporationCardScoped` alongside `startingMegaCredits`
when `additionalCorp === false` (so it exists before the starting-hand purchase and
participates in affordability), then zeroed — applied exactly once because the base corp
plays exactly once; reload-safe because it is serialized state, not a pending action.
Composition order with corp M€ / preludes / TR-boost: bonus + corp starting M€ land
together before hand purchase; preludes later as normal; `trBoost` handicap unchanged.

### 7.6 The `titles` VP category (final mission only) — full checklist

The `deltaProject` precedent, executed end to end (all sites verified):

| # | File | Change |
| --- | --- | --- |
| 1 | `src/common/game/VictoryPointsBreakdown.ts:143-171` | `titles: number` + `detailsTitles?: ReadonlyArray<{title, missionSlot, points}>` |
| 2 | `src/server/game/VictoryPointsBreakdownBuilder.ts` — key union :4, zero-init :11, **`updateTotal` :39-59**, switch :83-135 | add `'titles'` everywhere (miss `updateTotal` ⇒ total silently diverges) |
| 3 | `src/server/game/calculateVictoryPoints.ts` ~:272 | `CampaignScoring.calculateVictoryPoints(player, builder)` — reads `gameOptions.campaign.final && grants[color].titlePoints`; per-entry `setVictoryPoints('titles', points, '${0} title (mission ${1})', …)` |
| 4 | `src/server/models/ServerModel.ts:628-651` | `titles: 0` in the zeroed default breakdown |
| 5 | `finalScoringRevealModel.ts` — `RevealGroupKey` :78, **`FINAL_SCORING_SEGMENTS` :144-182**, `GROUP_META` :184, `GROUP_ORDER` :198 | one `titles` row (the ONE segment table — ceremony/reveal pick it up) |
| 6 | `consoleEndgameModel.ts` — key :45, **`SCORE_CATEGORY_TABLE` :137-151** | one `titles` row (ceremony + live Information score read this) |
| 7 | `liveScoreModel.ts` `categoryPresent` :87-100 | `titles` case keyed on `final` (config-derived, like `delta`) |
| 8 | `scoreExplorerModel.ts` | `buildTitleCollection` — a **medallion ledger** (the `buildMilestoneCollection` :616 shape) with `titleArtUrl`; level-2 facts = per-mission provenance; crumb via `scoreStagePath` :780 |
| 9 | `victoryPointsModel.ts` :198-234 | own `makeScale('titles', …)` — NOT folded into `mca` |
| 10 | `endgameModel.ts` — `EndgameCategoryKey` :112, labels :222-237, `categoryValue` :259-272, `allCategoryKeys` :401-407 | full category membership (else `strongestCategory`/matrix lie) |
| 11 | verdict stack | `finishVerdict.scoringLineList` :105; `strategyArchetypes.buildStrategyProfiles` (a title-driven win must not grade as a card archetype); `keyEpisodeEngine` (title VP > margin ⇒ decisive-driver episode — the Hydronetwork Iteration-16 precedent); optional `FinishPattern` member `campaign_titles_finish` |
| 12 | styles + i18n | `.con-eg-cat--titles` accent; `endgame.json`/`console.json` keys (grep-first, dupes throw) |
| 13 | specs | the Σ-invariant suites listed in §9.5 |

Behavior notes:
- **Ordinary games and missions 1–3 have NO `titles` category anywhere** — the hook and
  `categoryPresent` both gate on `campaign.final`; a spec asserts the breakdown of a
  non-final mission is byte-identical to an ordinary game's shape.
- **Live score**: TP are static, public campaign facts, so the final mission shows the
  category from generation 1 (honest standings; recommended — D8 records the
  gate-at-END alternative, one-line change via the Turmoil-VP gating pattern at
  `calculateVictoryPoints.ts:258-264`). The hidden-VP game rule
  (`ServerModel.ts:653-664`) zeroes it for opponents like every category — consistent.
- Bot: TP land in the bot's `titles` field like any seat's (its automa card VP stays in
  `automa` — no mixing); verdict/overview pick it up through the same tables.
- Endgame export/restore: TP live in `gameOptions.campaign.grants` (serialized) ⇒
  reopening the finished final mission from the archive recomputes the same breakdown.
  The campaign chronicle additionally has the committed result snapshot.

### 7.7 Final ceremony + champion

Final mission ceremony: `titles` plays as a normal scoring category beat (auto via the
tables) — the reveal shows WHICH titles from WHICH missions built the sum
(`detailsTitles`). After `winner`, a short **champion beat** (campaign framing:
«Чемпион кампании») distinct from the per-mission Titles stage; then actions → the map
scene in chronicle state (§4.5). Insertion mechanics for both new beats:
`CeremonyPhase` (`consoleEndgameState.ts:40-48`) + `CeremonyBeat`/`ceremonyBeats`
(`consoleEndgameScript.ts:61-103`) + `CEREMONY_MS` + `consoleEndgameDirector` +
settled-state in `finalizeCeremony` (:154-183) + reset in `resetCeremonyProgress`; the
hold supplier (:190-193) already covers pre-`actions` stages.

### 7.8 Title icons and player color

The three PNGs are complete material renders (gold/silver/bronze, red Mars globe, enamel
chevrons). **Never tint the emblem** — a global CSS tint/filter destroys the metals (and
`filter` is stripped console-wide anyway). Player linkage = composition around the icon:
the seat's colored **plate/chip** (cube + name) beside or beneath the emblem, and in
dossiers a thin player-color baseline bar under the icon block. If a future design wants
recolored enamel, that is an **asset task** (per-color variants or a separate mask
layer), explicitly not a runtime filter. Sizes: 512×512 comfortably serves every use
(map strip ~1.5rem=30px@FHD/60px@4K; ceremony hero ~9rem=180px@FHD/360px@4K — within
one downscale octave of source; crisp). New resolver `src/client/console/campaign/titleArt.ts`
(`titleArtUrl(name)` → `assets/titles/<name>.png`, the `maArt.ts` shape) + `@error`
fallback to a calm emblem (the `MaHeroArt` precedent).

---

## 8. Implementation plan — vertical slices

Each slice ends green (`lint`, `build:test`, affected suites) and independently
shippable behind the absence of UI entry points. **Review gates** marked ◆ need explicit
sign-off before the next slice.

**Slice 0 — decisions.** Resolve §12 D1–D9 (D1/D2 block slice 5, the rest have
recommended defaults an implementer may take). No code.

**Slice 1 — server domain (no UI).**
`CampaignId`/types/`campaignConfig` in `src/common/campaign/`; `Campaign` +
`SerializedCampaign` + `CampaignManager`; `IDatabase` ×3 backends; routes
`ApiCampaignCreate`/`ApiCampaign`/`ApiCampaignLaunch`(+abandon) with paths/CORS/
registration; board generation; `GameOptions.campaign` + forge-stripping in
`ApiCreateGame`; mission launch with first-save-at-creation; the `gotoEndGame` commit
hook + lazy reconciliation; standings module + comparator extraction; rollback guards.
Done when: full invariant/idempotency/backend-parity spec suite passes; an ordinary
game's behavior provably unchanged. ◆ review (domain model is the foundation).

**Slice 2 — creation UX + Campaign Map v1.**
Creator mode stage (single path regression-free); campaign decks/briefing/confirm;
`paths.CAMPAIGN` App screen; `ConsoleCampaignMap` + model/state/styles (all states incl.
loading/error/waiting/blocked, D-pad graph, inspections, chronicle-static); lobby
grouping + continue labels; i18n. Motion: settled states only (ceremony deferred to
slice 6). Done when: create → map → launch mission 1 → play works end-to-end on
fhd/tv4k/deck; «Мои партии» shows one row. ◆ review (product feel of the map).

**Slice 3 — results, titles, interlude.**
Commit path exercised end-to-end; Titles ceremony stage (missions 1–3); journal
TITLE token + chips; map endgame-scene embedding + marker advance; bonus M€ preview
surfaces; launch of missions 2–4 (without lineage yet — corps still fresh per mission
behind a temporary flag). Done when: a 2-mission campaign flows seamlessly through an
interlude on all three profiles.

**Slice 4 — corporation lineage.**
§6 in full: pool exclusions, lineage auto-play ordering, discriminator fixes
(`Game.ts:845/935/940/2362`, `SelectInitialCards` affordability), mission-4 corp-step
omission + «ШТАБ» reveal, «СЛИЯНИЕ» labeling, bot corp persistence, bonus M€
application at base-corp play, endgame narrative de-Merger-ization. ◆ review — this
slice touches the engine's setup spine; regression risk peak.

**Slice 5 — final scoring.**
§7.6 checklist end to end; champion beat; chronicle final state; verdict/overview/Score
Explorer/InfoPanel coverage; bot TP. Done when: the Σ-invariant suites and an e2e final
mission (via the dev fast-forward, slice 7 tooling pulled forward as needed) pass.

**Slice 6 — motion & polish.**
§5 ceremonies (generation, marker travel, title weights); reduced-motion paths; fx-lite
membership; Deck perf probe; focus-restoration audit; TV type floor; glyph guard sweep.

**Slice 7 — hardening & dev tooling.**
Admin: campaign list/abandon in the rollback tool's dev area; `POST
/api/campaign/dev-commit` (admin-gated result fabrication → jump to missions 2–4 and
the final without playing four games); e2e `seedCampaign()` helper; reconnect storms;
orphan-game reaping verification; docs (`docs/claude/console/campaign.md` + rules-file
touch list + this doc updated to «implemented» status).

Dependencies: 1 → 2 → 3 → {4, 5} → 6 → 7 (4 and 5 are parallelizable after 3; 5's e2e
wants 7's fabrication endpoint early — pull that single endpoint into slice 3 if
convenient).

---

## 9. Test strategy

1. **Unit (server, mocha)** — `tests/campaign/`: state machine + every §2.7 invariant;
   generation (uniqueness, pool filters, bot intersection, <4 guard, snapshot
   immutability under pool changes); standings/tie/shared-place; config-table mapping;
   idempotency (double create/launch/commit, launch-after-crash-orphan); rollback
   guard + revoke; `commitMissionResult` re-derivation equivalence.
2. **Integration** — full 4-mission campaign driven through `testGame`-style harnesses
   with fabricated mission ends: lineage playing order, M€ math at mission 4 (3 corps +
   bonus + hand purchase), first-action multiplicity, bot corp persistence + collision
   freeze, Merger banned in / untouched out of campaigns.
3. **Serialization/migration** — SerializedCampaign v1 round-trip ×3 backends
   (backend-parity suite); old `SerializedGame` without `campaign` loads; a campaign
   pointing at a purged/compressed mission game degrades to snapshot-only display;
   LocalFilesystem read-after-write via `flushPendingWrites`.
4. **Client unit (mochapack)** — `campaignMapModel` (all slot states, viewer
   projections, CTA gating), creator mode-stage model, ceremony beats with titles
   stage, `titleArt`, journal TITLE token. Remember the false-green traps: single-chunk
   webpack test config + collection floor.
5. **Scoring Σ-invariant** — extend the existing parity suites
   (`liveScoreModel.spec`, `consoleEndgameModel.spec`, `finalScoringRevealModel.spec`,
   `victoryPointsModel.spec`, `scoreExplorerModel.spec`, `consoleOverviewModel.spec`,
   `calculateVictoryPoints.spec`): Σ segments ≡ Σ categories ≡ total with `titles`
   present; `titles` ABSENT in ordinary games and missions 1–3.
6. **E2E (playwright)** — `console-campaign-map.spec.ts` (band fit, crumb, B-grammar,
   states, fhd+tv4k+deck), `console-campaign-flow.spec.ts` (create → mission 1 →
   dev-commit → interlude ceremony → launch 2), `console-campaign-final.spec.ts`
   (fabricated TP → final ceremony + explorer). Discipline: motion probes on
   `probeTick`/MutationObserver (never bare rAF headless), second-player visibility
   for out-of-band campaign changes, own server per clone, `make:css` before visual
   checks, kill stale :8080 after `build:client`.
7. **Regression of ordinary games** — the existing creator/lobby/endgame/e2e suites run
   untouched; plus explicit specs: create payload without campaign fields is
   byte-identical; `Merger.spec.ts` unchanged; a `twoCorpsVariant` game unaffected.
   `testMode` campaigns: fully supported (deterministic deals per mission via
   `guaranteedCards` still apply per-mission) — and **never used for fit/visual
   verification** (the standing rule).

---

## 10. Risks and potential regressions

1. **Setup-spine edits (slice 4)** — `Game.ts` research-phase discriminators and
   `SelectInitialCards` are load-bearing for every game ever created. Mitigation: every
   change branches on `gameOptions.campaign !== undefined`; the ordinary-path specs are
   the gate; slice-4 review is mandatory.
2. **First-save-at-creation for missions** deviates from the lazy-persist norm; watch
   `undoOption` save-cadence interplay (mission games save from action 0 — slightly more
   writes, benign) and LocalFilesystem's async chain (await it).
3. **Rollback/undo semantics** — the guard changes a dev tool's behavior; document in
   the tool's UI (disabled + reason, never hidden).
4. **Endgame ceremony machine** — inserting stages touches a settled director; the
   `finalizeCeremony`/reset/hold trio must include the new stages or reloads hang a
   hold (35 s force-release would mask it — assert settled states in specs).
5. **Lobby grouping** — collapsing rows changes «Мои партии» rendering for mixed lists;
   LAN sources may serve summaries without the `campaign` field (older host) —
   grouping must tolerate partial data (ungrouped fallback).
6. **Score pipeline breadth** — the §7.6 checklist has 13 touchpoints; a missed one
   fails a parity suite, but only if the suite runs — extend suites in the same slice
   as the field.
7. **Client narrative engines** hard-code Merger phrasing; a 3-corp final without
   slice-4's de-Merger pass would produce wrong stories silently.
8. **Realtime chattiness** (lobby-room piggyback) — acceptable v1; measure before
   building a campaign room.
9. **Name-keyed identity** — same-name ambiguity is inherited from the lobby; refused
   at creation, surfaced on the map; a LAN profile rename mid-campaign orphans the
   seat's `you` resolution (the deep links by stored PlayerId still work — document).
10. **Purge** — `purgeUnfinishedGames(MAX_GAME_DAYS)` can reap a long-idle ACTIVE
    mission game; the campaign then has a dangling `gameId`. Mitigation: the map
    detects a 404 mission game and shows an honest «партия миссии утеряна (очистка
    сервера)» + admin re-launch of the slot (slot reset = clear gameId, keep board);
    and campaign-linked games get a longer purge horizon (open D11).

---

## 11. Gaps in the original brief (found during research)

**Must be decided/handled (architecture already accounts for them):**
- Campaign **name** — generated via `generateGameName` (rename later = trivial field).
- **Purge/retention** interplay (risk 10, D11) — the brief never mentions server purges.
- **Quota** — `GAME_QUOTA` covers `api/creategame`; campaign create+launch must join the
  same `QuotaHandler` accounting or a campaign is a quota bypass (4 games from one
  create press is fine; the *create* endpoints need the measurement).
- **Rematch × campaign** — rematch verbs on a mission's endgame would fork a mission
  into an unlinked game; suppressed for missions 1–3, and for the final the rematch of
  «the same roster, new single game» is actually desirable — keep it there (labeled as
  a single game).
- **`saveGameResults`** rows are written per mission as today (harmless; the campaign
  snapshot is separate and richer).
- **Embedded/desktop (Electron) host** — campaigns must work on the LocalFilesystem
  backend and over LAN (the store design already complies); the LAN client sees
  campaign rows only from hosts running the new server — version-skew tolerance in the
  lobby grouping (risk 5).
- **Color override route** disabled for missions (§2.3) — otherwise the chronicle's
  color story breaks.
- **Prelude/CEO/project repetition across missions** — allowed by design (each mission
  is a fresh deck); only corporations are constrained. State this in the player-facing
  rules text so it reads as intent.

**Recommended improvements (cheap, high-value):**
- Campaign map «Досье кампании» (Y) doubles as the between-missions briefing — show
  next-mission grants there (bonus M€ per seat) so the information exists outside the
  ceremony replay.
- The interlude map should surface «кто ещё не готов» only as social info, never as a
  gate — the launch is the creator's alone; keep it one line.
- Admin rollback tool: list campaigns with their mission chains (read-only v1 +
  abandon) — operational visibility for free from `getCampaignIds`.

**Safe to defer:**
- Dedicated realtime campaign room (protocol bump) — §2.10.
- Spectator/read-only campaign viewing — no spectator surface exists anywhere; revisit
  if spectating returns globally.
- Alternative mission counts — the model is `missionCount`-generic; the UI is
  deliberately 4-fixed (per brief).
- *(explicitly out of v1 scope, restated)* mission modifiers, Legacy mechanics,
  branching, campaign editor, mid-campaign roster changes.

---

## 12. Open product decisions

✅ **ALL DECIDED at approval (2026-09-03).** Fixed outcomes: D1 = §7.2 approved tables
(TP 15/10/5; bonuses 0/5/10/15/15; 2p = Governor+Administrator); D2 = final awards
nothing new, champion(s) crowned, co-champions supported; D3 = no merge fee, Merger
unused in campaigns; D4 = full lineage starting effects each mission via the canonical
`playCorporationCard` path; D5 = bot corp persists, no bot merge/carryover, bonus M€
only where the bot's economy applies it honestly; D6 = creator-only launch; D8 = titles
visible from generation 1 of the final mission; D9 = explicit A to the map;
D10 = the RU glossary as listed; D11 = campaign-linked games exempt from purge until the
campaign finishes or is abandoned; D12 = blocked slot with named reason + creator-only
repair recorded in the chronicle. The table below is retained for rationale history.

| # | Decision | Recommended | Alternatives / impact |
| --- | --- | --- | --- |
| D1 | Title/TP/bonus tables (per seat count, incl. 2p and 5p rows) | §7.2 defaults: TP 3/2/1 matching the icons' 3/2/1 chevrons; bonuses monotone by place | Any values — table-driven, zero code impact. Bonus magnitude is the campaign's comeback dial; too high erases mission stakes, too low snowballs. |
| D2 | Does the final mission award titles? | **No** — missions 1–3 feed TP; the final converts TP and crowns the champion (avoids double-counting the final's placement) | Yes (chronicle shows 4 title rows; TP from mission 4 must then be excluded from its own scoring — slightly awkward to explain). Flag exists (`FINAL_MISSION_AWARDS_TITLES`). |
| D3 | Merge fee on missions 2/3 (Merger charges 42 M€) | **No fee** — merging is the campaign's progression, balance comes from D1 | 42 M€ (or scaled) fee via the same deferred-payment pattern; dampens the economy arc. One deferred action either way. |
| D4 | Do ALL lineage corps re-grant starting M€ each mission? | **Yes** (engine default; escalating arc; mission 4 ≈ sum of 3 corps + bonus) | Base-corp-only + flat compensation — requires suppressing `:1493` for lineage replays (a real engine branch) and flattens the arc. |
| D5 | Bot corporation across the campaign | **Persists all 4 missions** (`automa.corporation` override; honest lineage row) | Fresh bot corp per mission (also cheap; weaker continuity). Bot merging is rejected (30-site fan-out, no product need). |
| D6 | Who launches the next mission | **Creator only** (matches «создатель получает CTA») | Any participant — one predicate change in `canLaunch`; racing is already idempotent. |
| D7 | Shared place (full tie incl. M€) | Both seats take the better place's title AND bonus | Split/average bonus; or next-metric tie-break (would need a third metric that doesn't exist today). |
| D8 | Final-mission live score shows `titles` from gen 1 | **Yes** (TP are public campaign facts; honest standings all game) | Gate to Phase.END (one-line Turmoil-style gate) — dramatic reveal, but the info is on the campaign map anyway. |
| D9 | Interlude: auto-advance from ceremony to map scene, or explicit A on «Карта кампании» | **Explicit A** (player owns the pace; ceremony stays skippable) | Auto-advance after settle — one flag in the actions flow. |
| D10 | RU naming | «Кампания» / «Миссия» / «Отдельная партия» / «Титулы» / «Очки титулов» (ОТ) / «Слияние» / «Штаб» / «Чемпион кампании» | — (grep-first per i18n rule 9 before coining keys). |
| D11 | Purge horizon for campaign mission games | Campaign-linked games exempt from `purgeUnfinishedGames` while the campaign isn't finished/abandoned | Longer fixed horizon; or accept reaping + slot re-launch (risk 10 fallback exists regardless). |
| D12 | Stored board unlaunchable after an app update | Block with named reason + creator-visible «пересоздать слот» (admin action re-rolls THAT slot from the current pool, logged in the campaign) | Silent substitution (rejected — violates «не должно менять уже созданную кампанию» in spirit); full-campaign abandon only (harsh). |

---

*Implementation must not begin until this document is approved (slice 0). The quality
bar: the mode must read as if Campaign Mode had always been part of Premium Edition —
which, given the reuse ratio above (map fingerprints, creator decks, the endgame
ceremony machine, the Merger engine path, the delta-category scoring precedent), is a
property of following the existing grain rather than adding new machinery.*
