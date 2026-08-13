# The START FLOW's FIRST-ACTION stage + the placement COMPLETION BARRIER

*(2026-08-12. Not auto-loaded; read when touching the first-action stage of
`ConsoleStartScene.vue`, `startFirstAction.ts`, `startBoardExcursion.ts`, or
the corp-first-action routing in `ConsoleShell.vue` / `consoleTaskRouter.ts`.)*

## The stage — «СТАРТ ПАРТИИ › КОРПОРАЦИЯ › ПЕРВОЕ ДЕЙСТВИЕ»

The corporation's MANDATORY first action (`startGamePrompt.kind ===
'corporationInitialAction'`) is the Game Start Workspace's own FINAL
CONDITIONAL stage — after the preludes, before READY. The standalone confirm
modal (`ConsoleCorpFirstActionConfirm`) never appears inside the start flow
any more; it remains ONLY for the mid-game shape (a merger chain acquiring a
corp that still owes its opening move).

**The discriminator is domain state, never a client latch** (it must survive
a reload): `corpFirstActionInStartFlow(view)` = `generation === 1` —
generation 1 IS the start of the game. ⚠️ Deliberately NOT
`actionsTakenThisGame === 0`: this fork counts the deferred corporation play
and every prelude as taken actions (`Player.incrementActionsTaken` fires in
their own `runWhenEmpty`), so the counter is already past zero when the
first-action prompt stands — a live-game finding that broke the first cut of
this feature. Routing forks on it in FOUR places of the shell, all four the
same test: `startTask` (serves it as a scene task), `shellTask` (excludes it
→ the modal never mounts), `mandatoryBeat` (no announce beat — the workspace
IS the presentation, like every `startSequence` prompt),
`openShellTaskSurface` (no board steering).

**Existence is the server's ledger**: `firstActionOwed(view)` =
`pendingInitialActions` non-empty OR the marked prompt live. The ledger fills
at `playCorporationCard` and drains at the option take — so it is TRUE during
the whole deployment (the journey shows the upcoming chapter from frame one)
and covers the wait for the player's turn, where there is no prompt at all.
**A stage can therefore JOIN a running flow**: a starting corp with no first
action shows no chapter, and the moment a MERGER plays an additional corp
that owes one (`Merger.ts` → `playCorporationCard` → the ledger fills
mid-preludes), «ПЕРВОЕ ДЕЙСТВИЕ» derives into the rail reactively. The rail
marks items that appear AFTER its initial composition (`ConsoleJourneyRail`'s
phases-diff watcher → `--arrived` for one beat): the node scales in and its
connector DRAWS in from the left — a materialization, not a pop; the initial
mount stays silent. ⚠️ NOT a `TransitionGroup`: the track is a
`<template v-for>` interleaving connector+item pairs, and the Vue compiler
REJECTS child keys inside a keyed template fragment («key should be placed
on the template tag») — the first cut shipped exactly that compile error.
Several owed corps resolve SEQUENTIALLY inside the ONE stage: the server
re-raises the marked OrOptions with the remaining corp, `restandFirstAction`
re-stands the standing stage and `swapFirstActionSeat` hands the seat over
(the first corp settles home, the next rises).
A corp with no first action never creates the stage; `deploymentSettled`
additionally requires `!firstActionOwed && firstAct.stage === 'idle'`, so the
flow can never complete around the mandatory action, and never before the
stage's own return beat has physically finished.

**The scene's stage machine** (`firstAct` in `ConsoleStartScene.vue`):
`idle → staging → standing → performing → leaving → idle`, driven by three
watched pure predicates — `firstActionEntryDue` (everything earlier resolved,
nothing mid-air → ENTER), `firstActionLeaveDue` (owed drained AND
`firstActionChainQuiet` → one LEAVE at the end), and the Merger re-stand
(`restandFirstAction` — fired from BOTH the owed-rising and the quiet-rising
edges, because the second corp's prompt can re-arrive while the first one's
chain is still flying).

**The physics reuses the embed-step grammar wholesale**: entry =
`runEmbedSourceEmerge(corp)` (the card rises out of its REAL dock stack into
the source seat — `awayCard` hides the dock face in the same flush) +
`runQueueRelease` + a beat later `runPlayedDockRelease` (the card leaves
FIRST, the shelf dissolves BEHIND it); leave = `runStartEffectReturn` (room
back, then the seat settles home). The briefing panel
(`.con-start__firstact`) renders INSIDE `.con-start__embed` beside the seat,
does NOT title itself (the crumb already says the stage), and yields the zone
to any claim the action opens. Its content is the composer's derivation
(preview → `ActionEffectChip` + `skippedEffectViews` + `placementRow`), off
`/api/corp-first-action-preview` fetched at stage entry.

**A press**: `performFirstAction` submits the or-option (byte-identical to
the radio submit), latched by `firstAct.submitting` (released by the
playerView watcher — a refusal re-arms the standing CTA). A DRAWING action
claims its follow-up in the same press (`claimWorkspaceOutcome('start', …)` +
an immediate `markWorkspaceOutcomeBeatDone` — the source is already
physically staged, no hero beat will fire). Valley Trust's candidates arrive
as the EXISTING preludeSelection flow — a watcher returns the queue+dock for
them (the corp keeps the seat: it IS their source); a picked candidate that
itself draws takes the seat over via a settle-then-arm handoff in
`actByName` (one physical card per seat, never a repaint).

**The WAIT** (multiplayer: the opponent moves first) is the same standing
panel with no CTA: `startWaitMate` (the shared status brain's ACTIVE
player) names whose move it is; the transition to actionable is a paint
change on a standing panel (the state zone reserves its row). The command bar
advertises NO A while waiting (`firstAction: 'waiting'` in
`startSceneCommands`). B = «Свернуть» stays available (the deferred plate's
copy is `startDeferredSummary('awaiting-first-action')`); B is swallowed only
during `staging` and the submit round trip.

**Reload restore**: `startFrameLive` + `startSceneServes` gained the
first-action term (`corpFirstActionInStartFlow && firstActionOwed`), so a
reload during the WAIT (no prompt at all!) or on the live prompt re-mounts
the workspace onto the standing stage — the entry watcher is `immediate` and
plays the same emerge on the fresh dock. The deployment latch counts
`corpFirstAction` beside `startSequence`.

## The COMPLETION BARRIER (`startBoardExcursion.ts`)

The pre-existing architectural bug: the workspace yields to a board placement
via `startSceneVisible`'s `!placementActive`, which ends at the SPACE
ANSWER — so the scene popped back between the causally connected parts of one
play (over the tile's commit flight, between the reward transfers and the
bonus reveal, before the Ares hazard prompt).

The fix is a LATCH: `startExcursionEngage` (= `startSceneServes &&
placementActive`) rising → engage; release ONLY when `startExcursionQuiet`
holds — no space asked (raw, incl. a chained second placement held behind the
first tile's cinematic), no `tilePlacementHolding`, no
`isResourceTransferActive`, no `isBoardCardBonusActive`, no reveal
open/pending, no live hand intake, and no follow-up prompt of a kind served
OVER the board (`EXCURSION_BLOCKING_KINDS` — choice / distribute / player /
amount / payment / …). Kinds the START ITSELF serves or HOSTS
(startSequence / corpFirstAction / projectCard / handSelect / colony /
deckSelect) RELEASE the barrier — the scene must be back to host them.

Two deliberate non-signals: the global animation-hold registry and
`isRemotePlacementActive` — the barrier counts only the viewer's own chain,
so another player's cinematic can never wedge it. Every visual signal in the
condition carries its own safety ceiling in its owning module; a pending
prompt holds indefinitely BY DESIGN (answering it is the chain). The release
is confirmed off the synchronous flush (`scheduleStartExcursionRelease` —
nextTick + one frame + re-check), so a one-flush hand-off between two chain
signals can never read as «the chain is over». The latch resets on
`startSceneServes` falling and in the shell's `beforeUnmount`.

`startSceneVisible` consumes it (`!startExcursionHolds`), so the scene's
`yielded` prop covers it for free — `deploymentSettled`, the stage's entry
and leave predicates all already gate on `yielded`.

## THE ROOM IS ONE DERIVED BIT (`firstActionOwnsRoom`)

The briefing beats (`staging` / `standing`) recede the deployment's queue and
«РАЗЫГРАНО»; every other stage state hands them back. It is ONE computed with
ONE watcher — never a release at the entry plus a return on some specific
prompt-watcher, which is what shipped first and broke Valley Trust: the
return's watcher carried a `stage === 'performing'` guard and fired BEFORE
the flush that set that stage, so the room stayed away. The drawn preludes
were then dealt into a receded queue (no visible deal at all) and the chosen
prelude had no measurable shelf to fly to, so it committed in one frame —
both reported as «без анимации».

Two rules the bit encodes: **`performing` gives the room BACK** (the action's
own follow-ups are what need it — the candidates are dealt INTO the queue and
the pick flies to the shelf), and **it never becomes a second writer** — an
embedded reveal claimed by the action recedes/returns the room in the claim's
own phrase, so the bit yields to `embedActive` on both edges. A deal also
never measures a travelling surface: `launchDeal` re-arms while `roomSettling`.

## CLAIMED ≠ PRESENTING (and why the claim is optimistic here)

Everything the first action sets off presents INSIDE this workspace, so the
claim is placed OPTIMISTICALLY: a bespoke action's preview cannot promise the
draw its own follow-up will make (Valley Trust advertises no cards, and the
prelude the player then picks draws its own) — and a missing claim sent that
batch to a standalone full-bleed «Получены карты» over a workspace that had
already let go. The outcome mechanism is built for optimism:
`reconcileWorkspaceOutcome` drops a claim a tick after the response when
nothing turned out to be embeddable.

That makes the second half mandatory: **`embedActive` (claimed) and
`embedPresenting` (on screen) are different questions.** Lifecycle reads the
claim (suppression of standalone presenters, the scene's return, «the
deployment may not settle»); everything about PRESENTATION reads presenting —
the crumb's tail, the room receding, the input guard, the status line, the
briefing's visibility. Keyed on the claim, an optimistic claim emptied the
room and titled it «ДОБОР КАРТ» for a draw that never came, hiding the
candidates it should have been dealing.

**And the flow may not finish inside its own cinematic.** A draw's cards come
off the deck BEFORE its reveal event exists, so `deckDrawHolds()` is part of
both quiet predicates, the submit's round trip counts as chain work, and the
stage's leave is CONFIRMED a tick + a frame later (same contract as the
placement barrier's release).

## THE HERO SIZE BELONGS TO THE BRIEFING

The seat carries a hero-sized corporation while the briefing is what the
player is looking at. The moment the action opens a step, the SUBJECT moves
to those cards and the seat returns to its context size — a hero-sized
context covers the receiving zone and the «РАЗЫГРАНО» shelf, which is exactly
what it did. Not transitioned: `width` is not animatable by contract and the
inner `zoom` cannot transition with it, so the change rides the room's own
return instead.

## THE STAGE MACHINE LIVES IN MODULE STATE

`consoleStartState.firstAct` (+ `firstActionSeen`), not the scene's `data()`:
a collapse PARKS the frame and `workspaceFrameMounted` counts live frames
only, so the workspace UNMOUNTS — a component-local machine reset on every
restore and re-entered the stage from scratch, replaying the corporation's
rise and the room's recede («РАЗЫГРАНО показывается и сразу исчезает»). On
remount the scene only re-establishes the SEAT and applies the receded pose
INSTANTLY (`poseRoomReceded`), with `.con-start--roomheld` hiding the room by
class until that pose lands, so not even one frame paints.

## THE JOURNEY KNOWS ITS SHAPE UP FRONT

`ClientCard.hasFirstAction` — generated in `export_card_rendering.ts` under
exactly the condition `Player.playCorporationCard` uses to fill the ledger
(`initialAction !== undefined && initialActionText !== undefined`; 33 corps
today). The chapter is therefore in the rail from the first frame of the
deployment for the corporation the player CHOSE, instead of popping in when
the corp lands. Only a MERGER's second corporation — genuinely unknown until
picked — still joins dynamically, with the `--arrived` beat.

## Two defects the stage exposed in surfaces around it

**① The journey rail ate its last stage.** `.con-jrail`'s width is BOTH a
geometry reserve (so a phase exchange never moves the header) AND an
`overflow: hidden` clip. The reserve was 44rem; the deployment's full house
(КОРПОРАЦИЯ + ПРОЕКТЫ + ПРОЛОГИ + ПЕРВОЕ ДЕЙСТВИЕ + ГОТОВО) measures
**44.25rem** at FHD — so the day the conditional stage joined, «ГОТОВО»
silently fell off the right edge. Reserve raised (50rem / 47rem on the ≤1600px
tier, where tightened paddings shave ~2rem), but the real guard is the e2e
assertion that **every rail item is fully inside the rail box** — and the
first-action spec now runs WITH preludes + a buy, because a no-prelude game
fits any reserve and would have watched the bug ship.

**② «Ожидаем других игроков» while waiting for nobody.** The ceremony status
rail printed that string as a blanket fallback for «nothing is focused» — so
every gap of the deployment (a submit round trip, the beat between two stages,
the whole first-action stage) told a SOLO player they were waiting for a bot
that was not moving. A line that names a wait must be able to name WHO:
`startWaitMate(view, live)` returns the first genuinely ACTIVE opponent, and
the rail says «Ожидаем ход игрока X» only then — otherwise it stays silent.

## Guards

`tests/client/components/console/startFirstAction.spec.ts` (stage model),
`startBoardExcursion.spec.ts` (barrier policy), `consoleCorpFirstAction.spec.ts`
(routing fork + serving surfaces), `consoleStartState.spec.ts` (conditional
journey stages + crumb + deferred copy), `consoleStartUi.spec.ts` (the bar's
first-action states), and e2e `console-corp-first-action.spec.ts` (the stage
end-to-end + a mid-chain-flash witness), `console-reveal-priority.spec.ts`
(the stage never paints under a reveal), `console-community-marker.spec.ts`
(a marker-placement first action through the stage).
