# LOST PRESENTATION & FAST SYNC — the reconciliation architecture (2026-09-08)

Status: **IMPLEMENTED** (same day, one pass — mechanisms A–E; see
«Implementation notes» at the end for the deltas against the original
design). This document is the deep study of the «потерянные анимации» defect
family and the architecture that closes it as a CLASS. Read together with
`planet-focus.md`, `.claude/rules/console-ui.md` (§ A BOARD BEAT WAITS…),
`src/client/console/boardBeatPark.ts`, `src/client/console/presentationLedger.ts`
and `src/client/console/transport/gameTransport.ts`.

## The reported defects

1. **Zoom-exit scale loss.** The planet is in zoom (Planet Focus placement
   stage); a play moves a global-parameter scale while zoomed; on exit the
   scale glide/accent never plays and the player reads STALE values for
   ~15–20 s, after which they silently flip.
2. **The invisible foreign tile.** Early game, the player enters a prelude's
   tile placement and cannot pick a cell — because another player already
   built there, but that tile never visually arrived. Reproduces rarely.
3. **Stale-coordinate flights.** A flight aimed in one coordinate space lands
   after Planet Focus entered/exited (board scale changes up to ×4.8) — the
   final coordinate ignores the scale change.

All three are symptoms of three STRUCTURAL classes, diagnosed below.

---

## Diagnosis

### Class 1 — DATA staleness: the one refresh refusal that is not a debt

`gameTransport.waitForUpdate` (the poll handler) **skips both GO and REFRESH
while the viewer holds a required prompt** («mid-input» guard). A WS
`INVALIDATED` wake funnels into the same guarded check, so the wake is
*consumed* by the refusal. With a healthy socket the fallback poll is
stretched to `LONG_POLL_MS` = 20 s — so while the viewer is mid-prompt (and a
board placement IS a prompt, held for as long as the player aims), **no
remote change reaches the client at all**, and after the prompt resolves the
world arrives up to ~20 s late.

The codebase already names this law for the *scene-blocked* path: «a refused
refresh is a DEBT, never a drop» (`deferredViewRefresh.ts`, built after the
measured 21.4 s control-return). The mid-prompt refusal is the one refusal
left with **no debt**: nothing retries when the prompt resolves except the
player's own submit (`fetchPlayerInput.finally → waitForUpdate(true)`), which
only covers the «viewer answered» exit.

Consequences mapped to the reports:
- Defect 2, variant A: the foreign tile is **not in the client view at all**
  while the viewer aims (their prompt froze refreshes). If the viewer's
  prompt predates the foreign build, the server-side prompt still lists the
  now-occupied cell → the commit is refused with an opaque error.
- Defect 1, variant A: a remote scale change made during zoom arrives only
  with the viewer's own commit — or 20 s later if the prompt ended without a
  submit round-trip.

Two facts make the fix cheap:
- the WS `INVALIDATED` message **already carries the server cursor**
  (`gameAge`/`undoCount` → `realtimeState.lastInvalidationGameAge/UndoCount`),
  so «the server is ahead of my view» is a *local, reactive* fact;
- the transport already has the precedent for applying a view mid-flow
  without resetting transient UI: the preserve guards
  (`shouldPreserveCardPickModal` & co) apply the view **without bumping the
  `playerkey` reset epoch**.

### Class 2 — PRESENTATION deferral: many private freezes, many private edges

The console deliberately shows «a presented lie» in many places — each one a
display freeze with its own release edge and its own private safety that
degrades **silently**:

| Freeze layer | Held what | Release edge | Private safety (silent) |
| --- | --- | --- | --- |
| `planetFocus.heldParams` | 4 global params (board + top HUD) | exit settle → `beatPending` → shell watcher `planetFocusBeatReady` | `BEAT_SAFETY_MS` 15 s |
| `boardBeatPark.heldParams/Claims` | params + scale-bonus claims | `boardBeatsWatchable` rising edge → drain | `PARK_SAFETY_MS` 30 s |
| `remoteRevealHold` | a committed foreign tile (cell reads untouched) | its flight's touchdown | `REMOTE_STAGE_SAFETY_MS` 15 s + `BOARD_WAIT_MAX_MS` 20 s |
| cube / marker / panel-reward holds | owner cubes, HUD counters | each scene's own beat | per-scene |
| staged bot commits | the whole presented view | notification delivery | liveness self-heal |

Structural holes found (each verified in source):

1. **The Planet-Focus beat has NO stage-readability term.**
   `planetFocusBeatAllowed` waits on reveal/card-arrival/bonus/discard — but
   not on «is the board on screen». In the start flow the yielded workspace
   RESUMES over the board right after a placement
   (`resumeYieldedStackOverQuietBoard` gates on `boardSceneSettling()`, which
   *by design* excludes planet focus) — so the owed beat fires **behind the
   restored workspace**: the glide plays into `display:none`, the arc marker
   takes its lawful SNAP path, and the story is gone. This is defect 1's
   «animations simply lost».
2. **The beat waits on player-paced signals while the top HUD lies.**
   `cardArrival` / reveals are player-paced (reading dealt cards easily
   exceeds 15 s in the start flow); the status strip meanwhile shows the
   FROZEN values the whole time; then `BEAT_SAFETY_MS` releases «honestly,
   without the show». That is exactly «stale for ~15–20 s, then a silent
   flip».
3. **Two stacked freezes with independent drains.** The park merges its held
   values OVER `displayGlobalParams`, so releasing one layer is invisible
   while the other still holds — a drain «glide» can play against a value
   that does not change on screen, spending the story.
4. **A missed edge has no second chance.** Every release is a Vue watcher on
   a derived predicate, and the codebase's best-documented footguns are
   exactly here: true→true fires nothing; block→free within one flush is
   invisible; a non-reactive first term drops the dependency. Today the only
   net under a missed edge is the private safety — a 15–30 s silent snap.
5. **Nothing watches the invariant itself.** There is no probe for «what the
   player sees ≠ the applied view» — only per-mechanism plumbing. A lie with
   no live owner (edge lost, claim leaked) is invisible until its timer.

### Class 3 — coordinate-space invalidation

Board-bound flights aim with **one-shot measures**: `flyRemote` reads
`measureBoardHexRect` once before a ~1 s flight; reward waves and bonus lifts
similarly. Planet Focus enter/exit re-scales the board (transition 680/760 ms,
scale up to 4.8) and the fit engine re-calibrates after viewport/dock changes
— any of these mid-flight moves the target by hundreds of px.
`awaitWatchableBoard` waits for *coverage* to clear but not for *geometry* to
be stable. The robust recipes already exist in the hand-dock family
(final-approach retarget at ~0.72–0.8; `magnetToBerth`; `snapPlanetFocusSettled`
for the own hero) but are not available to board-bound flights as a shared
mechanism.

---

## Architecture — five mechanisms

### A. FRESHNESS: every refusal is a debt + prompt-preserving apply

Goal: **data is never more than ~1 s behind the server**, mid-prompt included.

1. **`serverAhead()` — the reactive staleness witness.** One tiny module over
   `realtimeState.lastInvalidationGameAge/UndoCount` vs the applied
   `view.game.gameAge/undoCount`. True ⇒ the client KNOWS it is stale without
   any round trip. Feeds diagnostics and the ledger (B).
2. **Prompt-preserving apply.** A fetched view whose
   `waitingFor.promptId === displayed promptId` applies **reactively without
   bumping the `playerkey` reset epoch** — partial input survives by
   construction (module states are not reset; structural sharing keeps
   unchanged prompt refs identical, so prompt-watchers do not re-fire). This
   generalizes the existing preserve guards from «named pick flows» to «any
   unchanged prompt».
3. **The mid-prompt guard becomes «apply, don't skip».** With (2), GO/REFRESH
   while mid-prompt runs `updatePlayer()`; the apply path already stages
   remote tiles / nomad hops / scale parks and already defers behind live
   scenes (`armDeferredViewRefresh`). If the fetched view carries a
   **different** promptId, keep today's behaviour (skip) — the server replaced
   the prompt and `STALE_PROMPT` + the forced refetch already own that case.
4. Kill switch for rollout: `?midpromptrefresh=0` restores the skip.

This alone fixes defect 2's variant A (the foreign tile arrives and flies in
while the viewer aims — the board stays true) and removes the «20 s» from
defect 1 (remote changes are in the view within wake latency).

### B. THE PRESENTATION LEDGER — one registry of owed stories

Generalize the codebase's own DEBT idiom (`deferredViewRefresh`,
`owedConclusion`, `concludeWorkspaceFlowOrOwe`) to ALL deferred presentation:
`src/client/console/presentationLedger.ts`.

- **An owed story** = `{id, kind, since, dueMs, ready(), redrive(), degrade()}`.
  Every freeze layer registers one when it defers (planet-focus beat, park
  values, park batch, each `remoteRevealHold` space, staged commits…), and
  retires it on its own release. `redrive()` is ALWAYS the owner's existing
  entry point (`playPlanetFocusScaleBeat`, `drainBoardBeatsIfDue`, kick
  `drainQueue`, …) — the ledger re-asks edges, it never re-implements them.
- **One heartbeat + edges.** A 250 ms interval walks due stories
  (deliberately an interval, NOT a watch — the lost-reactive-dependency
  footgun is documented) and the shell's existing edges
  (`boardBeatsWatchable` rising, focus phase → idle, stack transitions) call
  `settleDue()` immediately. A missed watcher edge now costs ≤ one heartbeat,
  not 15–30 s.
- **Past `dueMs` → `degrade()` + a NAMED warn + a counter.** Private safeties
  stop being silent: `[presentation-ledger] story <id> degraded after Ns`
  and a row in the diagnostics panel (owed count, oldest age, degrades).
- **The truth witness.** A cheap `presentedTruth()` check (displayed params
  vs `view.game`; `remoteRevealHold` keys vs `view.game.spaces`; claim ages)
  — when it reports a lie **not covered by any registered story**, that is
  the «edge lost, nobody owes it» class: the ledger re-drives the matching
  subsystem at once and logs. Exposed to `__foregroundDiag` and e2e.

### C. ONE owner for the held scale story

Merge the two scale freezes: **Planet Focus enter seeds the board-beat park**
(`source: 'planet-focus'`, first-write-wins — already the park's law) instead
of keeping its own `heldParams`; `displayGlobalParams` collapses into
`boardBeatDisplayParams`. The beat becomes a drain flavour (accent classes +
blocking hold window), and its preconditions gain the missing term:

> **A story plays only on a READABLE stage.** Drain/beat preconditions =
> board watchable ∧ focus idle ∧ arcs returned ∧ the existing quiet signals.
> If the stage is covered when the story comes due, the story stays OWED in
> the ledger (the strip keeps its frozen value, bounded) and plays on the
> next watchable edge — it never spends itself behind `display:none`.

One held map, one drain, one safety, one ledger entry — removes holes 1–3 of
Class 2 by construction.

### D. BOARD-SPACE EPOCH + live-anchor flights

`boardSpaceEpoch` (reactive counter) + `boardGeometryStable()` (focus phase
idle ∧ `!boardTweening` ∧ `!arcsReturning`), bumped/derived from the writers
that already exist (planet-focus phase machine, the fit engine's
`--board-scale` / `--con-board-dx/dy` commits, profile changes). Three flight
rules, implemented once in `tilePlacementDirector` and consumed by every
board-bound scene (remote tile, nomad hop, reward waves `fromBoard`, bonus
lift, Ares beats):

1. **LAUNCH only on stable geometry** — `awaitWatchableBoard` (and kin) gains
   the `boardGeometryStable()` term, bounded exactly like the coverage wait.
2. **AIM at a live anchor** — targets are anchor FUNCTIONS
   (`() => measureBoardHexRect(id)`); the director re-reads at the
   final-approach point (~0.72, the proven hand-dock recipe) and re-aims the
   remaining leg on an epoch change mid-flight; an unmeasurable anchor
   demotes to the scene's honest degrade path immediately.
3. **A landed proxy re-seats on an epoch change** before its handoff frame —
   or hands off at once.

### E. RE-ENTRY FAST-SYNC — the fixed order on «the board became watchable»

One funnel on the watchable rising edge (and on focus-exit landing):

1. **Freshness**: `serverAhead()` → immediate guarded refresh (debt paid
   first — the stories must play against TRUE data);
2. **Ledger**: `settleDue()` → owed stories play in causal order (settle →
   values glide + accent + chips → parked batch), target start ≤ 300 ms;
3. **Truth witness**: anything still lying with no owner snaps honestly +
   logs.

Target numbers: data ≤ ~1 s stale end-to-end (WS coalesce 60–400 ms + RTT);
a story starts ≤ 300 ms after its stage becomes readable; zero SILENT
degrades (every degrade is named in diagnostics).

---

## New invariants (laws to add to the rules files on implementation)

1. **Every refusal is a debt** — extending the existing law from the
   scene-blocked path to the mid-prompt path and to every presentation
   deferral (the ledger IS the debt book).
2. **A story plays only on a readable stage**; an unreadable stage keeps the
   story OWED, bounded, and visible in diagnostics.
3. **No presentation lie without a registered owed story** — the truth
   witness enforces it at runtime; a spec enforces registration for every
   freeze layer.
4. **A board-bound flight aims at a live anchor and launches only on stable
   geometry.**

## Guards (test plan)

- Unit: ledger (register/redrive/degrade/witness), prompt-preserving apply
  (same promptId → no epoch bump, changed → skip), park merge (focus seeds,
  one drain, readability gate).
- e2e: (a) zoom-exit scale story in the start flow — place a prelude tile
  that raises O₂, workspace resumes, then open the board: the glide + accent
  MUST play on the watchable edge (probe the marker travel, not the step —
  the travel metric law); (b) foreign tile during the viewer's placement
  (second-player law: out-of-band changes need a real second player) — the
  cell must show the tile within ~2 s while the placement prompt is live;
  (c) remote flight with Planet Focus entering mid-flight — landing Δ to the
  live hex ≤ 2.5 px (the handoff-witness probe recipe).

## Rollout order (as designed)

1. **A** (freshness debt + prompt-preserving apply, behind the kill switch) —
   biggest player-visible win, smallest surface.
2. **B** as observe-only (register + witness + diagnostics, no redrive) — one
   release of telemetry tells us which edges actually get lost.
3. **B** enforcing (redrive + named degrades), then **C** (the merge) on top.
4. **D** (epoch + shared live-anchor helper), migrating `flyRemote` first.
5. **E** falls out of A+B wiring on the existing shell edges.

---

## Implementation notes (what shipped, and where it deviates)

Shipped in one pass, A–E together (B enforcing from day one — the ledger's
redrive is only ever the owner's own guarded entry, so «observe-only first»
bought nothing over the unit guards). The map:

- **A.** `WaitingForModel.changed` (server compares the client's cursor on
  EVERY result — `GO` answers on every poll, so the bit is what keeps the
  mid-prompt refresh from re-fetching once per interval);
  `realtime/viewFreshness.ts` (`serverAheadOfView` over the WS invalidation
  cursor + the `?midpromptrefresh=0` kill switch); the transport's GO/REFRESH
  branches now APPLY mid-prompt (never while this client's own submit is in
  flight — the response's cinematic diffs must see the view they armed
  against); `App.update`'s commit skips the `playerkey` reset epoch when
  `waitingFor.promptId` is UNCHANGED.
  **Deviation:** a mid-prompt refresh whose fetched view carries a DIFFERENT
  promptId is APPLIED WITH the ordinary epoch bump (the design said skip).
  Reason: the skip needed a bypass flag for the STALE_PROMPT healing (which
  calls the same `updatePlayer` on purpose), and applying the replaced
  prompt early is strictly better than the guaranteed failed submit + alert
  the player would otherwise hit one press later.
- **B.** `presentationLedger.ts` — owed stories + truth witnesses + the
  250 ms heartbeat (an interval, never a watch) + `__presentationLedgerDiag`.
  Wired: the park's 30 s safety IS a ledger story now (redrive = the shell's
  guarded drain via `registerBoardBeatRedrive`; degrade = the honest release,
  named); the transport registers the `view-freshness` witness (grace 3 s,
  heal = the guarded `waitForUpdate(true)`).
- **C.** `planetFocus.ts` is CAMERA-ONLY (phases, arcs return, exit hold,
  `planetFocusSettling()`); the display freeze + the scale story live in
  `boardBeatPark` alone. The load-bearing move: the shell's
  `boardBeatsWatchable` counts an ENGAGED focus (+ `arcsReturning`) as a
  covered board — so mid-focus commits seed the park with pre-change values,
  and the watchable edge fires exactly at the old beat's moment. The drain
  gained the accent classes (`con-scale-focus-*`, from `changedGlobalParams`
  vs the registered live source) and a BLOCKING `board-beat-scale-story`
  hold for its own bounded window. The drain's read admission
  (reveal/card-arrival/discard — the old `planetFocusBeatAllowed` list)
  lives in the shell's `scaleStoryReadBlocked`, folded into `drainBoardBeats`'
  `waitConsoleQuiet` gate. `boardSceneSettling` gained `planetFocusSettling`
  (transitions only — `active` is a stable stage); the yielded-stack resume
  and the endgame auto-open wait `boardStorySettling` =
  `boardSceneSettling ∨ boardBeatStoryPending` — so the start-flow story
  plays IN THE YIELD-GAP, before the workspace takes the screen back (the
  reported defect 1). The watchable probe DROPPED `!stackYieldedToBoard()`
  (the live-placement half is carried by `!placementActive`; the gap is
  exactly where the story must play). `sealLiveGameSurfaces` releases the
  park at the END boundary (the open already waited story-quiet — this is
  the cap-expired degrade only).
- **D.** `boardSpaceGeometry.ts` (probe injected by the board section:
  `boardGeometryCalm` = focus idle/active ∧ no fit tween/pass; the epoch
  bumps on every stability flip); `flyRemote` gates its measure on
  `waitBoardGeometryStable`, flies with a `liveHex` final-approach retarget
  (`TILE_RETARGET_AT` = 0.72, smoothstep blend of position AND size, the
  ground shadow gliding onto the live landing spot), and verifies at rest
  (`seatTileProxy` re-seats a proxy whose epoch moved after the retarget).
  **Scope:** the remote tile flight only, deliberately — it is the reported
  defect. The nomad hop, the reward waves and the bonus lift keep their
  one-shot measures for now; migrating them is mechanical (the API is
  shared) and is the named follow-up.
- **E.** The `boardBeatsWatchable` rising-edge watcher runs the fixed order:
  `serverAheadOfView` → `waitForUpdate(true)`, then `drainBoardBeats()`,
  then `settlePresentationDue()`.

Guards shipped: `tests/console/presentationLedger.spec.ts` (8, server
runner), `tests/client/console/boardBeatPark.spec.ts` (+5: accents, story
window, ledger debt, redrive), the rewritten
`tests/client/components/console/planetFocus.spec.ts` (camera-only),
`tests/client/console/boardSpaceGeometry.spec.ts`,
`tests/client/console/viewFreshness.spec.ts`,
`tests/routes/ApiWaitingFor.spec.ts` (+2 for `changed`), and the endgame
seal spec's park-release row. e2e follow-ups named in the test plan above
remain open (second-player foreign tile, mid-flight focus enter).
