# Console — the FINAL GREENERY is ONE CONTEXT on the board

The endgame beat where a player turns leftover plants into greeneries, one at a
time, until they choose to stop. Since 2026-10-14 (the owner's decisions, ledger
section AH — PL-295 / PL-296 «финал на поле», then PL-301…PL-305 «единый
контекст») it has **no surface of its own and no seams**: the board is the
finale, and the finale is one SESSION — from the announce's A to the seat's end
of the phase — that nothing between two greeneries, and no other seat's
triggered answer, can take down. Pure model
`src/client/console/finalGreenery/finalGreeneryModel.ts`; the session
`src/client/console/finalGreenery/finalGreenerySession.ts` (a reactive module,
the `planetFocus.ts` idiom); the dossier block lives in `ConsoleContextPanel`
(`finale` prop — `FinalePanelModel`, `[data-finale-bank]`, styles
`console_final_greenery.less`); the loop and the session's readers live in
`ConsoleShell`.

**What a final greenery is worth depends on the ruleset** (the formula's tail
names it): classic, 1 VP for the tile at the count («+1 ПО за озеленение»);
Turmoil Redux (project decision Q-3), +1 TR for the tile itself through
`Game.addGreenery` → `ParliamentHandler.onGreeneryPlaced`, no oxygen (it is
maxed by then), no VP («+1 РТ за озеленение»).

## Why it left its dialog, and then its picks

It used to be a small dialog over a dimmed planet («Превратить растения в
озеленения?» + three numbers + two rows), then the board for the cell, then the
dialog again — one screen change per tile (the owner, on the TV: «непремиально и
некрасиво»). PL-295 made it a chain of board PICKS — and between two greeneries
everything that asks «is a placement on?» let go: the planet shrank and grew
again around every landing (the focus exited while the admission gate waited
out the hero, then re-entered for the next pick), the dossier slid out and in,
the bar flipped to the board-home run, and while ANOTHER seat answered a
triggered pick (Philares' owner choosing a resource) the whole context vanished
— a bare board, no sign of what the player was in the middle of (the owner's
field report of 2026-10-14). Now:

1. **The announce** (the mandatory gate — the player was idle through
   production, a stray press must not land anywhere) reads the PHASE: «Конец
   партии · Финальное озеленение · A Разместить озеленение» (`consoleTaskSummary`
   — keyed on the server's `finalGreeneryPrompt` marker, never the title). The
   gate treats the finale as a forced reaction by its own label
   (`actionLabelForPlayer` → `'finalgreenery'`).
2. **A puts the board straight into placement AND raises the SESSION**
   (`openFinalGreeneryOnBoard` → `enterFinaleSession()` → the ordinary
   nested-space hand-off `taskSpacePending`). From here on every reader that
   used to ask `placementActive` asks `finaleSessionEngaged` while the session
   stands: `contextMode` keeps the dossier in placement mode,
   `planetFocusTarget` holds the camera, `placementKickerKey` / `placementShape`
   / `plantConversion` keep the identity («Конец партии» · the greenery swatch ·
   `8 🌱 → 1 [greenery] · +1 ПО`), the bar keeps the finale's run, `boardHomeIdle`
   is false (the player's own context, like a placement), the announce gate
   drops the finale prompt from its beats (`mandatoryBeat` — the prompt coming
   back is the CONTINUATION of what the player is doing, never a new
   interruption), and the generic host never serves it (`finalePromptOwned`).
3. **Three STAGES**, derived by the shell from facts (`finaleStageOf`), never
   kept: `pick` (the board pick is out), `landing` (the commit is on the wire or
   the next prompt stands — the pick follows by itself), `wait` (the seat holds
   no prompt; another seat decides). The dossier's block says which (the eyebrow
   pill «ВЫБОР КЛЕТКИ / ПОСАДКА / ОЖИДАНИЕ», the stage line «Ждём ответа:
   ‹seat›» with the seat's colour dot / «Озеленение садится — следующий выбор
   откроется сам»); the cell row and the dossier body exist only in `pick`.
4. **After a landing the board simply stays in placement.** The server asks
   again; the commit hold `finalGreeneryCommitting` keeps the loop off until the
   answer has landed and the landing hero holds the foreground, then the
   `finalGreeneryActive` watcher (`flush: 'post'`) hands the next pick to the
   board — no dialog, no announce, no camera exit, no dossier re-mount in
   between (the e2e witness `armFinaleWitness` counts all four at zero across
   the landing).
5. **A triggered hand-off is the WAIT stage, not the end.** When the greenery
   lands next to Philares' tile the owner's pick is deferred and the viewer's
   `waitingFor` is empty — the context stands, says who the table waits on
   (`finaleWaitingOn` — the live poll's list first, the model's snapshot
   otherwise, never the viewer), the bar keeps the finish DISABLED (RT names
   why: «Завершить можно после ответа: ‹seat›») beside B «Свернуть», and the
   top strip reads the owner as acting and the viewer as waiting. The prompt's
   return reaches the viewer over the socket (PL-301 — the input routes now
   broadcast after every processed request; the fallback poll was the only
   messenger before, ≈20 s), and the pick opens by itself.
6. **A FOREIGN mandatory prompt for the viewer yields the context** (their own
   Philares firing on another seat's landing): `finaleForeignPrompt` makes the
   session not «engaged» — the decision's plate and surface stand exactly as
   anywhere else — and the context returns the moment it is answered. The
   session never ends for it.
7. **B minimizes** (`deferFinalGreenery` → `collapseFinaleSession()`): the pick
   (if any) is dropped (nothing was sent), the context hides, the camera lets
   go, and the board home's plate is the one way back — «Вернуться к
   финальному озеленению» (`mandatoryDeferredActive` / `mandatoryAnnounceView`
   carry a MINIMIZED-FINALE branch for the wait stage, which has no live task of
   its own; `restoreDeferredTask` restores the session). A prompt returning to a
   MINIMIZED session is announced as a fresh beat; its A re-raises the session.
8. **The stop is a HOLD of RT** (`beginFinalGreeneryFinish` → the shared
   `consoleHoldConfirm`, key `final-greenery-finish` — the gesture «Пас» uses):
   the bar's `finalGreeneryFinishCommand()` (`hold: true`, `tone: 'danger'`,
   `priority: 0` — never dropped by the fit) draws the ring; a tap does nothing;
   letting go is a safe cancel; only at the cell-choice level (a LOCKED cell is
   a placement in progress — B steps back first). On completion
   `finishFinalGreenery` drops the pick, holds the loop and submits the «I am
   done» branch (`orOptionResponse(stopIndex)`).
9. **The session ENDS only on the server's word** (`finaleOverForViewer` →
   `endFinaleSession()`): `game.finalGreenery.done` names the viewer, or the
   phase is END, or the phase left the model altogether (an undo past it). The
   camera exits and the dossier leaves exactly once, at the end.

The finale's numbers read the RAW prompt while the pick is out
(`finalGreeneryRawVm`) and the PUBLIC MODEL when there is no prompt (the wait
stage: `finaleStock(plants, plantsNeededForGreenery)`); the ADMITTED read
(`finalGreeneryVm`) decides only when the next pick may open.

## The block (`FinalePanelModel`, PL-304 / PL-305)

Constant for the whole pick (it reads the stock, never the focused cell, so it
never moves while the player points): the PLANT STOCK as OBJECTS
(`finalGreeneryBank`: one greenery hex per tile the plants still pay for — the
board's own greenery art — then the rest as a hex filled `have / need`), the
hexes **sized by their count** (`finalGreeneryBankTier`: xl ≤ 2 · lg ≤ 4 · md
≤ 8 · sm ≤ 14 · xs) and **wrapping into rows**, cut only past 24 («+N»); a spent
hex leaves with a short settle (`TransitionGroup`, keyed by place — the rest
re-fills in place); the reading line «Хватит на N» · «Свободных клеток: N»
(only when the board's room is what caps the count) · «При завершении сгорят:
P»; the FINALE ORDER (`finaleQueue` — every seat in the table's order: ✓
Завершено by `finalGreenery.done`, ● Размещение by the asked seat's
`waitingForKind`, ○ Ожидает; «вы» on the viewer's row). No controller prompt in
the block (the dossier's law). A warm seam along the block's top says «this is
the last thing you do in the game» without a word.

## The server's facts

- `Player.takeActionForFinalGreenery` calls `action.markFinalGreeneryPrompt({spaces})`
  (`FinalGreeneryPromptMeta` carries ONLY what the client cannot derive — the
  board's remaining legal spaces; plants and `plantsNeededForGreenery` ride the
  public player model). Serialized in `ServerModel.getWaitingFor`. The two
  branches are told apart by TYPE (`space` → place, `option` → stop), never by
  title.
- **`GameModel.finalGreenery?: {done}`** (PL-302) — present exactly while the
  phase stands (`Game.finalGreeneryInProgress()`: the flag is set on every entry
  of `takeNextFinalGreeneryAction`, a loaded game's included, and cleared by the
  END); `done` = the seats that finished (placed all they could, or stopped).
- **`PublicPlayerModel.waitingForKind: 'finalgreenery'`** — the asked seat, by
  the structural marker at the top of its prompt (`detectWaitingForKind`).
- **The input routes broadcast** (PL-301): `PlayerInput` / `PlayerInputBatch`
  call `game.notifyStateChange()` after every processed request, because the
  finale loop hands prompts between seats off the `takeAction` path (no save,
  no cursor bump) — guard `tests/realtime/InputRouteBroadcast.spec.ts` (red
  without the call on BOTH hops).

## The strip (PL-302)

`actionLabelForPlayer`: the asked seat → `'finalgreenery'` («ОЗЕЛЕНЕНИЕ»,
active, no counter); while the phase fact stands, a seat in `done` →
`'finished'` («ЗАВЕРШЕНО», the positive `ready` pose), any other idle seat →
`'waiting'` (never «спасовал» — everybody passed the last generation, and that
word says nothing about the finale). A triggered pick on another seat is that
seat's `'forcedaction'` («ДЕЙСТВИЕ»).

## Guards

- `tests/client/components/console/finalGreeneryModel.spec.ts` — marker, branch
  types, the arithmetic, the bank as objects (tiers / wrap / cap), the stages,
  the order, who is waited on, the yield, the finish command, and the
  placement bar's finale branch.
- `tests/client/components/console/finalGreenerySession.spec.ts` — the four
  verbs of the session.
- `tests/client/components/overview/finalGreeneryStatus.spec.ts` — the chips.
- `tests/inputs/finalGreeneryPrompt.spec.ts` — marker + serialization;
  `tests/models/finalGreeneryPhaseModel.spec.ts` — the phase facts;
  `tests/realtime/InputRouteBroadcast.spec.ts` — the broadcast on both hops.
- e2e `tests/e2e/console-final-greenery.spec.ts` (fhd + tv4k) — announce → the
  board in placement with the bank sized by count + the order + the chip; a
  landing with the CONTEXT WITNESS at zero (no re-mount, no plate, no host band,
  no focus exit; the stage walked pick → landing → pick); B → the plate; A →
  back; a TAP of RT finishes nothing; a HOLD finishes (the server's prompt is
  gone, the chip reads «ЗАВЕРШЕНО»).
- e2e `tests/e2e/console-final-greenery-trigger.spec.ts` (fhd + tv4k) — the
  fixture `two-player-finale-trigger` (the viewer asked, Philares with a
  greenery on a quiet cell): a landing next to it → the WAIT stage naming the
  owner, the camera held, the bar's disabled finish, the chips; RT finishes
  nothing; B → the plate (the minimized-finale branch) → A back; the owner
  answers over the API → the pick is back within the socket's beat (`< 8 s`,
  annotated `hand-off`), the witness at zero on the way back.
- The endgame journeys drive it through `consoleEndgameHarness.finishFinaleThroughPage`
  (`openFinaleOnBoard` + `holdFinishFinale`); a greenery through the page is
  `placeFinaleGreenery` (judged by the server's stock — the dossier never
  leaves inside the session, so the kicker-based `placeTile` cannot judge it).

## B never yanks a minimized task back from another screen

`handleSectionBack` used to restore a deferred task as its FIRST branch. The
restore now sits after the section-close branches: in a section B closes that
section; on the board home B (or A on the `.con-mandatory` card) brings the task
back. Console-wide, not finale-specific.

## Reproducing it locally

The fixture `two-player-pre-endgame` (`fixtureTable`) + an API drive to the
viewer's question is the cheap route (the e2e does exactly that, the viewer
passing so the stock stays whole); `two-player-finale-trigger` resumes straight
on the viewer's finale with Philares across the table. Frames:
`screenshots/console-final-greenery/<profile>/` and
`screenshots/console-final-greenery-trigger/<profile>/` (outside git).
