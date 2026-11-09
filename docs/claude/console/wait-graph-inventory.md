# Wait-graph inventory — the worklist of possible cycles and orphans (2026-11-09)

Read from code by four inventory passes (admission · presentation · workspace · flow-internal); file:line refs as of
`052ed435cd`. Each row is a shape the graph must SEE (Э2) and either break through a door (Э3) or a point fix removes.
Status: `open` · `fixed <commit>`.

## Admission / announce
- A1 `fixed (wait-graph overdue, 2026-11-09)` — a plate whose first presentation never came is an `overdue` announce node (bound 15 s, the graph's own); its door `announce-serve` acknowledges the beat where the question's surface stands, else lights the chip's beacon — never the player's A. Was: the announce gate stuck in PENDING: `mandatoryPresentationReady` reads RAW signals (`consoleRevealMode`,
  `rawDrawnRevealPending`, `playedHeroHolds`, `tilePlacementHolds`, `nomadMoveHolds`), not the watchdog-masked ones; a
  leaked flag keeps the beat pending, the leak detector says `announce-gate` (served), liveness reads accepting. No timer.
- A2 `fixed (wait-graph dangling, 2026-11-09)` — the «set aside» node with no restore card is `dangling`; its door `deferred-restore` un-sets it aside and opens the question's surface. Was: `deferred` with no restore card (no minimizable live task, not parked, start not serving): no plate,
  leak detector says `deferred`; the screen director's `restore` verb is unarmed.
- A3 `open` — a FLOW beat (draft / parliament) not acknowledged gates EVERY prompt of the viewer; released only by A on a
  plate that needs `boardHomeIdle`.
- A4 `open` — `announce-gate` is not in `PRESENCE_WITHDRAWS`: a surface latched for prompt X stays up under a beat that
  starts holding later under the same prompt id.
- A5 `open` — `boardHomeIdle` ignores the start scene; `startStranded` treats the held gate as served.
- A6 `open` — a draft door via `enterWorkspaceAfterHandoff({})` waits on ANY hold of any scope (45 s degrade).

## Presentation
- P1 `open` — any of the 9 rail-reward seeders deferring its fly until a covered board clears (BLOCKING hold, no since,
  35 s ceiling only) — the Redux Venus trade shape again.
- P2 `open` — the scale-story window held by a standing decision covering the scale-step rating's marker (≤ 8 s).
- P3 `open` — sitting→draft handoff waits on any-scope holds while the Parliament stands frozen; suppliers of the form
  `…Owed && claimsForeground()` could hold it to 45 s.
- P4 `fixed (2026-11-09)` — the submit safety is bounded (`SUBMIT_SAFETY_MAX_MS` 30 s from the send or the park), armed for a PARKED answer too (it had no timer at all) and kept across a new answer key; past it the stage goes back to the player and `[wait-graph] ceiling parliament:submit` names it. R2 = P4. Was: Parliament `parkedSubmit` ↔ the funnel's awaited gates that read the Parliament stage; the 6 s safety
  re-arms forever (Sec:3871).
- P5 `open` — the leak detector's `anyHold` treats notification-only owed holds as serving a stranded prompt (≤ 35 s).
- H1 `fixed (2026-11-09)` — a ledger handle settles only ITS owe (`owner` token; `presentationLedger.spec`). Was: ledger `handle.settle()` deletes by id, so an old handle can settle a newer story of the same id.
- H2 `open` — `surfaceClear` waiters wake only on token events; a surface leaving with no token event waits 9 s.

## Workspace
- W1 `fixed (wait-graph Э1)` — the forced ghost teardown ignores `frameServing`: a frame that legitimately owns the prompt (no door /
  embedded Parliament refusing) is torn down at 8 + 2.5 s.
- W2 `fixed (wait-graph Э1)` — the question door answers `served` from any non-browse/landed/access stage without serving; in browse the
  quest gate stays shut while `agendaWalkFlow.owed` or `chairmanQuestFlow.live` — an orphan the owe no longer tracks.
- W3 `fixed (wait-graph Э1)` — `questionDoorServedKind` is one slot shared by all kinds, reset by every conclusion call.
- W4 `open` — owed-step through `promised` never expires (dropped only at the played hero's closing / failed);
  excluded from the forced teardown; liveness acts only with a live non-optional prompt.
- W5 `open` — follow-up door (`!admits('followUp')`) waiting on an artifact that waits for the host to leave.
- W6 `open` — a chain-scope claim held for a foreign batch parked behind its plate (board home only).
- W7 `fixed (wait-graph Э1)` — `owedConclusionSignal` lacks `chairmanQuestFlow.live`, `colonyBonusPayoutLive()`, the effect / venus
  belongs-to terms, `frameServing` / `serves` changes.
- W8 `open` — the std-projects ending never owes (no time-net, no forced teardown).
- W9 `open` — a presenting claim on a parked host has no timer.
- W10 `open` — a fresh `awaiting` claim on the same host silently DELETES the owe.
- W11 `open` — the release funnel refuses indefinitely while serving (each refusal re-arms the 20 s safety); with an
  optional prompt liveness does not act.
- W12 `open` — the free-turn reaper and B-judging look at `committed` only (`verdict`, optional-prompt `executing`).

## Flow-internal
- R1 `fixed (wait-graph Э1)` — = W2 from the section side: support / delegate / banner end with their stage standing and beat `done`.
- R2 `fixed (2026-11-09)` — = P4 (parked submit safety loop).
- R3 `fixed (wait-graph Э1)` — chairman quest `awaitingReaction`: hold released, NO ceiling, A and B both inert — a deaf screen.
- R4 `fixed (wait-graph Э1)` — `killSittingMotion` sets `run = undefined` without resolving the run: `runWalk` never returns, `walking`
  stays raised for the section instance's life.
- R5 `fixed (wait-graph Э1)` — the walk's inner endings gated on the global `agendaWalkFlow.live`; the walk re-seed OVERWRITES a record
  owed but not yet opened (the rally queues it).
- R6 `fixed (wait-graph Э1)` — colony trade endings gated on the global `active`; `armColonyTrade` does not clear the previous trade's
  settle / parked-net timers; rewards re-check only `active` after awaits.
- R7 `fixed (wait-graph Э1)` — colonies `completeFlow` ignores the trade's fall while the fleet is active and has no watcher on the
  fleet's own fall.
- R8 `fixed (wait-graph Э1)` — start `runSceneRelease` sets `flow = 'completing'` then returns early (root missing / torn down); nothing
  resets `flow` on mount — the lifetime `hold` can stand for the whole game.
- R9 `open` — `enterStartHostedStep` refuses while a Parliament frame is known; edge-only re-ask → an owed walk/rally
  orphaned.
- R10 `fixed (wait-graph Э1)` — liveness counts `commit-fold-owed` as in flight with NO age limit.
- R11 `open` — the transport drops a second submit silently; the refusal battery omits the Parliament live doors,
  `firstAct.submitting`, chairman `sent`, the deck-pick rollback.
- R12 `fixed (wait-graph Э1)` — `firstAct.submitting` waits for ANY view change; a plain 400 refusal leaves A dead until the next view.
- R13 `fixed (wait-graph Э1)` — deck pick `dealing` has no ceiling.
- R14 `fixed (field 2026-11-08)` — the played hero's «an event pays before its lift» ran INSIDE a staged play's landing ritual
  (`runStagedPlayedLanding`): it let a commit through that the board's cell had not sent yet and waited for its pay-back —
  the card stood 9 s in the composer (Flooding: −1 VP + the Greens). The ritual is the pre-commit half (`stagedCeremony`);
  the pay-back wait is a declared node (`flow:played-hero-payback#nonce`, target the server) — a lift waiting for an answer
  nobody sends is a dead end the shadow names. e2e `console-staged-event-handoff` (red on the old build: `paying → late`).
- R15 `fixed (monkey wg2)` — a B landing while a HOSTED step's hand was still OPENING reversed the reveal and closed only the
  hand's level (`handleSectionBack`'s mid-open branch): the start stood around an empty zone, the server's play-from-hand
  (Ecology Experts, Eccentric Sponsor) asked of nobody, no restore card, no prompt edge to re-open it — the stranded plate,
  every liveness rung «nothing to release». B mid-open of a hosted step now snaps the flight and minimizes the WHOLE host
  (the step's own B); a step nothing hosts any more is re-opened through the router's own door (`reopenStartStep` — the
  start strand's confirm and the start director's `step` cure). e2e `console-start-sponsor` § still OPENING (red on the old
  build: `[start-stranded] confirmed`), the monkey's table 3/3 → green.
- R16 `fixed (monkey wg3 DUO)` — B collapsed the Parliament mid-chairman-quest: the office's / the step's flights could
  not land on the hidden section and the quest's BLOCKING hold kept every prompt waiting to its 20 s ceiling
  (`[animation-hold] "parliament-chairman-quest" … force-released`, reproduced 1/3), and a fighter flying to Arwind's
  capsule inside it had its surface folded under it (`[transfer] surface folded under its token`). Now the scene leaving
  the screen DRIVES the quest's beats to their end («ДОЖАТЬ» — `ConsoleParliamentSection.sceneHidden`), and a collapse is
  a fold: it is OWED until the band surfaces' tokens have landed (`collapseWorkspace` → `surfaceClear`, bounded — its own
  ceiling now on the wait graph's worklist). The table 4/4 green after.
