# STATE DELIVERY & THE SCREEN HANDOFF — truth first, story on a visible stage, one director for «what the player sees now» (2026-10-28)

Status: **IMPLEMENTED** (one pass, the owner's report of 2026-10-28 — «delivery состояния поля игрокам происходит с
задержкой … анимация добора карты вылетит прямо в экран финала … нет нормальной системы, которая чётко бы занимала
внимание пользователя конкретным действием сейчас»). Read with `presentation-reconciliation.md` (the 2026-09-08
reconciliation this builds on), `prompt-admission.md`, `.claude/rules/console-ui.md` § STATE DELIVERY.

## The two reports, diagnosed

### 1. «Второй игрок не видит чужой тайл и выбирает ту же клетку — серверная ошибка»

Four links, each verified in source; the first is the one that produced the server error.

| # | Link | Where | Verdict |
| --- | --- | --- | --- |
| 1 | **The legal set of a standing `SelectSpace` was a SNAPSHOT.** The deployments of the game start run CONCURRENTLY (`Game.playerHasPickedCorporationCard` hands every seat its `playCorporationInput` at once; each seat's corporation + preludes play the moment it presses, in no fixed order), and a bot turn resolves on a timer — so two placement prompts routinely stand at once. The set was computed in the producer's `execute` and never again: a cell another seat built on stayed in `spaces`, the client lit it, `process` found it in the list, and `addTile` threw «occupied» as an opaque 400. | `inputs/SelectSpace.ts`, `deferredActions/Place*Tile.ts` | **THE defect** — fixed server-side (§ A1). |
| 2 | The data path for a foreign change while the viewer holds a prompt (the mid-prompt refresh of 2026-09-08) is intact: the placing seat's request logs (`gameAge++`), broadcasts over WS (`notifyStateChange` after every input route), the viewer's `/api/waitingfor` says `changed`, the view applies under the SAME `promptId`, and the board binder re-hangs on a changed `spaces` list (`ConsoleBoardInput` `playerinput.spaces` watcher). | `gameTransport.ts`, `App.update`, `ConsoleBoardInput.vue` | Sound — but it only helps once link 1 makes the list LIVE. |
| 3 | A foreign tile that arrives while the viewer stands inside a WORKSPACE (the start scene between stages, the hand) is committed HIDDEN behind `remoteRevealHold` and waits up to `BOARD_WAIT_MAX_MS` (20 s) for a board the player can see. When that board arrives BECAUSE the viewer's placement prompt yielded the stack, the landing and the placement grid came up in the SAME beat — the grid's appearance had priority over the tile. | `consoleRemotePlacement.ts` `boardCovered` / `awaitWatchableBoard` | The owner's «приоритет сетке» — fixed by the `remote-landing` admission block (§ B). |
| 4 | **The top strip read the board-beat park's HELD values** («the HUD and the arcs can never disagree») — a scale another seat moved while the viewer stood in a workspace stayed at its old value on the HUD for up to the park's 30 s safety. | `ConsoleStatusStrip.game()` | A presented LIE the player made decisions on — fixed (§ A2). |

### 2. «Карта добора вылетает прямо в экран финала / Парламента»

The automatic screen-taking transitions waited for the BOARD's story only (`boardStorySettling` — the tile hero, the
reward wave, the camera, the scale story), never for what the player was still OWED: the final greenery's cell pays a
card → the cover lifts → the reveal stands → the take → the flight into the dock, and Phase.END rode the SAME
response — so `openEndgameWorkspaceOverQuietBoard` opened the finale over the reveal / the flight (the intake's holds
are `notification-only`, which the mandatory-surface gate deliberately ignores). The generation scene's rise into the
sitting / the draft (`concludeGenerationScene`) and the plate's doors into the Parliament / the draft had no gate at
all. There was no ONE place that answered «what must the player still see on this screen».

## The laws (added to `console-ui.md`; invariant 16 in `CLAUDE.md`)

1. **TRUTH BEFORE STORY.** The applied view is the truth and every instrument reads it AT ONCE: the top strip's
   parameters, every validation, the legal cells of a placement. A presented «lie» (a held value, a hidden tile) is
   allowed ONLY on the board's stage, only while that stage is covered, and only as the board's own story — bounded
   and ledgered. The HUD never lies.
2. **THE BOARD'S TRUTH BEFORE THE BOARD'S DEMAND.** Another seat's tile owed to the board lands BEFORE a new
   placement grid lights; a live aim is never torn down for it (the tile lands beside the aim).
3. **A SCREEN IS HANDED OVER, NEVER TAKEN.** An automatic screen-taking transition (the finale, the generation scene's
   rise, the plate's doors into a phase-root flow) asks ONE director what the player is still owed on the screen it
   leaves — the board's story, a foreign landing, a reveal not taken, a card on its way into the dock, tokens in the
   air, any animation hold of ANY scope — and waits it out, bounded and named.
4. **A PLACEMENT'S LEGAL SET IS LIVE.** The server re-derives it at every read; the answer is validated against the
   board as it stands and refused by name — never applied to a cell another seat took.

## The mechanisms

### A. Truth first

**A1 — `SelectSpace` is LIVE** (`inputs/SelectSpace.ts`). `liveSpaces?: () => Space[]` (the producer's own
derivation — `createMarsSelectSpace({liveSpaces})`; the four `Place*Tile` actions pass the exact call their `execute`
made, a card's custom `on()` included) and `liveIllegalSpaces` (the per-cell reasons re-derived beside it);
`currentSpaces()` re-derives, records the result on `spaces` / `illegalSpaces` and is read by `toModel()` (every
serialization — the mid-prompt refresh carries the shrunken set under the same `promptId`) and by `process()` (a cell
no longer legal → `InputError('This space is no longer available — the board changed')`). A producer that passes
nothing gets the GENERIC occupancy rule: a cell offered EMPTY that carries a tile now is gone (and marked `occupied`)
— exact for every prompt shape, because a cover over an ocean, a move's destinations and a marker were offered as
they stand. Guard: `tests/inputs/SelectSpace.spec.ts` § the legal set is LIVE.

**A2 — the strip reads the applied view** (`ConsoleStatusStrip.game()`): the park's `heldParams` merge is gone; the
ONE merge kept is a parameter SWING's peak (TR47 — the applied net change is zero, the fall is the scene's end). The
board section keeps reading the park (`boardBeatDisplayParams`) — the marker's glide, the capture flash and the
parked bonus card still play on the uncovered board, as the story of a change the HUD has already told. Guard:
`consoleStatusStrip.spec.ts` § reads the TRUTH. **The three e2e specs that pinned the old law were flipped**
(`console-venus-bonus-park`: `strip8UnderHand > 0`; `console-plasma-fans`: the strip told «8%» under the workspace;
`console-planet-focus`: the ocean readout moves at the commit) — they run on the box (`npm run e2e:remote`).

### B. The board's truth before the board's demand

`consolePromptAdmission.ts` gains the block **`remote-landing`** (signal `remoteLanding`; policy: `placement` only;
ordered BEFORE `board-story` — the tile lands, then the scales tell what it did; every player-paced block — a reveal,
the hero scenes — still outranks it). The shell's signal is `remoteLandingBeforePlacement = !placementLiveLatch &&
remoteLandingOwed()`:

- `placementLiveLatch` is a DATA field written by the `placementActive` watcher — the admission computed reads it
  without a cycle through `placementHeld`; a tile arriving mid-aim therefore raises nothing (it lands beside the aim);
- `remoteLandingOwed()` is REACTIVE through `remotePlacementState.queued` (the plain queue's length, mirrored at
  every push / shift / clear) — a computed that read `queue.length` never re-fired;
- **`placementTakesBoardForLanding`** (computed + watcher): a server placement held ONLY by this block still takes the
  board — the stack yields (`yieldStackToBoard`) or the screen goes board-home, exactly as the placement's own
  rising edge would — because the landing waits for a board the player can SEE and the covering workspace would only
  have stepped aside on that edge. So: the prompt arrives → the stack yields → the tile lands on the uncovered
  board → the block falls → the placement comes alive. Bounded by the remote stage's own `BOARD_WAIT_MAX_MS`.

Guard: `consolePromptAdmission.spec.ts` § a foreign tile owed to the board.

### C. The screen handoff director — `src/client/console/screenHandoff.ts`

`screenHandoffReasons({ignoreHolds})` → `['board-story' | 'remote-landing' | 'reveal' | 'card-arrival' | 'transfer'
| 'animation']` from the live facts (`boardStorySettling`, `remoteLandingOwed`, `currentRevealEvent` ∨
`pendingRevealEvents` — a PARKED batch is still owed, `deckDrawHolds` ∨ the hand delivery (runs, `flights`,
`inFlight`), `isResourceTransferActive`, `activeAnimationHoldLabels` of EVERY scope minus the caller's own labels).
`waitScreenHandoff(id, {alive, maxMs, ignoreHolds})` → `'quiet' | 'dead' | 'degraded'` on `probeTick`, a ledger story
for its whole length (`screen-handoff:<id>` in `__presentationLedgerDiag`, the owed reasons as its `why`), bounded by
`SCREEN_HANDOFF_MAX_MS` (45 s — above the park's 30 s, so an honest chain completes before the named degrade).

Consumers (every automatic screen-taking transition):
- **the finale** — `ConsoleShell.openEndgameWorkspaceOverQuietBoard` asks `screenHandoffOwed()` instead of
  `boardStorySettling()` (the seal + `enterWorkspace('endgame')` run after the handoff; a `dead` outcome — an undo
  dropped Phase.END — opens nothing);
- **the generation scene's rise** — `concludeGenerationScene` awaits the INJECTED `registerGenerationSceneHandoff`
  (the shell registers `waitScreenHandoff(id, {ignoreHolds: ['generation-scene']})` — the scene keeps its own hold
  through the wait, so nothing else can take the screen meanwhile; an interrupted scene rises nothing; unregistered
  — tests, a dead shell — the rise is immediate). Injection, because the director sits above the presentation
  systems and would cycle through them if the scene imported it;
- **the plate's doors** — `ConsoleShell.enterWorkspaceAfterHandoff(kind, opts)` for the `draft` and
  `parliament-phase` flow beats and the `parliamentPhase` / resolution-`externalDraw` task doors: immediate when
  nothing is owed, else deferred to the director's quiet with ONE pending entry per kind (a second press adds
  nothing; the beat is acknowledged by the caller as before).

Guards: `tests/client/console/screenHandoff.spec.ts`, `tests/console/generationScene.spec.ts` § the rise waits.

## What this deliberately does NOT change

- The viewer's OWN cinematic holds still defer a poll-path apply (`App.update`'s `sceneBlocked` →
  `deferredViewRefresh`, bounded 15 s): a view landing mid-hero would pop the hero's own numbers. The HUD is at most
  one own-scene behind, never a foreign one.
- The board-beat park, the remote reveal hold and every other BOARD-STAGE story keep their bounded holds — the stage
  may hold a story, the instruments may not.
- The e2e witness for the two-player race (a foreign tile landing while the viewer aims — «second-player law») stays
  the open follow-up from `presentation-reconciliation.md`; the unit guards above pin the server rule and the
  admission order.

## Gotchas paid for

- `activeAnimationHoldLabels()` names a hold `label[scope]` — an ignore list matches the BARE label.
- A hand-written `AdmissionSignals` literal in a spec is a compile error until it names the new signal
  (`consoleForegroundWatchdog.spec`, `hydroBonusDoorOrder.spec`) — exactly the drift the exhaustive type exists for.
- `remotePlacementState.queued` is the reactive mirror; `queue` stays a plain array (the remote stage's own law:
  the degrade path drains it with no reactive write — the mirror is written at the same five sites).
