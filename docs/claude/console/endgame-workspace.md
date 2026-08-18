# Console FINAL SCORING workspace («Финальный подсчёт»)

The post-game is a **PHASE-anchored workspace root** (`'endgame'` in
`WORKSPACE_KINDS`, anchor `{type: 'phase', phase: 'end'}`) — the same shape as
`start`/`draft`. `ConsoleShell.endgameFrameLive` (=`Phase.END`) stands it up on
the rising edge and tears it down (+`resetConsoleEndgame`) on the falling edge
(undo / rollback). It projects onto neither navigation axis, serves no prompt,
and is a full-bleed scene over the frame: `.con-endgame` covers everything
except the bottom command bar strip; `.con-root--endgame` fades the status
strip / player rail / banner out (`visibility`, never `display`). The desktop
endgame surfaces go HEADLESS in console mode (`EndgameExperience
:console-native` — no auto-reveal, no pill; `RematchLayer :headless` — poller
alive, no DOM).

## Files

| Layer | File |
| --- | --- |
| pure VM | `src/client/console/endgame/consoleEndgameModel.ts` |
| beat script (pure) | `src/client/console/endgame/consoleEndgameScript.ts` |
| reactive machine | `src/client/console/endgame/consoleEndgameState.ts` |
| GSAP director | `src/client/console/endgame/consoleEndgameDirector.ts` |
| surface | `src/client/components/console/ConsoleEndgameWorkspace.vue` |
| view→model adapter | `src/client/components/endgame/endgameViewAdapter.ts` (shared with desktop) |
| styles | `src/styles/console_endgame.less` |
| specs | `tests/client/components/console/consoleEndgameModel.spec.ts`, `consoleEndgameCeremony.spec.ts`, `tests/e2e/console-endgame.spec.ts` |

## The VM is a RE-PROJECTION, never a second source of numbers

`buildConsoleEndgameVm(EndgameModel, playerOrder, {botColors})` builds on
`buildFinalScoringRevealModel` — the same segments/winners/tie-break the
desktop reveal uses. Console categories in ceremony order: `tr → milestones →
awards → greenery → city → [moon → tracks → delta] → cards → [penalty]`; a
category absent for everyone does not exist (zero visual noise), TR is always
present (base). TR and Cards carry `subs` (micro-reveals); one surviving sub
collapses to a single beat.

**THE BOT NORMALISATION** (presentation only, spec-guarded «nothing lost,
nothing doubled»): the legacy top-level «Подсчёт бота» is dissolved into the
card families — `automa.mcToVp → Resource cards`, `neuralInstance →
Conditional cards`, `cardVp → Fixed VP cards` — merged with the bot's ordinary
`detailsCards` kinds. The TR residual sub is labelled `Track actions` when
every non-zero contributor is a bot, else `Cards & effects`.

Invariants (spec'd): Σ categories ≡ `finalTotal` ≡ `breakdown.total`;
Σ subs ≡ category; ties → `tieBreak` (M€) → still equal = SHARED victory
(`winners.length > 1`, never an index pick); `automaClockWin` forces the
winner with no tie-break.

## Ceremony machine

`CeremonyPhase`: `idle → entering → scoring → settling → ranking →
[tiebreak] → winner → actions`. The pure script (`ceremonyBeats`) emits the
beat list (+72 is ONE beat, never 72 ticks; sub-steps ~440 ms; category read
0.94 s; a breath before the ranking); the director lays it on ONE paused GSAP
timeline through `consoleMotionMs` (speed presets scale, reduced-motion caps),
advancing `consoleEndgameUi`; CSS transitions (transform/opacity only) paint.
Count-ups tween ABSOLUTE running targets. The FLIP into ranked order and the
`ceremonyFx` gold burst are component hooks registered as director cleanups.

**`finalizeCeremony(vm)` is the ONE canonical terminal state** — skip (X),
the natural ending, reload-into-END and the safety net all land there;
`skipSeq` drives a one-frame `--noanim` class so the jump is atomic. The
animation-hold supplier (`endgame-ceremony`) reads the reactive phase.

**Re-entry:** the ceremony auto-plays only when this page load SAW a live
phase (`sawLivePhase`) and hasn't played yet; a reload straight into an ended
game lands SETTLED — «Повторить подсчёт» is the explicit replay.

## The road BACK IN — the archive slice of «МОИ ПАРТИИ»

A finished party is not a dead end: the main menu's games list has **two
SLICES**, and L3 (`stickL`) toggles them — «АКТИВНЫЕ» (the join list) ⇄
«ЗАВЕРШЁННЫЕ» (the archive). Opening an archive row lands exactly here, on the
settled state above, where «Обзор партии» and «Повторить подсчёт» live. That
toggle is the whole feature: the workspace already knew how to be re-entered,
nothing about the ceremony changed.

- **Server:** ONE route, one param. `GET /api/games/joinable?name=…&status=active|finished`
  (`JoinableGameStatus`; default `active`, and an unknown value can never widen
  the slice). `getJoinableGameSummary(game, name, status)` returns `undefined`
  for the other slice and stamps `finished` on the summary. Both slices scan the
  same ledger, so the console asks for the archive LAZILY (once per menu
  session, for the tab-chip count) and keeps POLLING only the live slice.
- **A finished row claims nothing that belongs to a live game.** Its stored
  `activePlayer` is merely whoever was to move when the game ended, so
  `yourTurn()` and the crew's «его ход» dot are both gated on `finished !== true`
  — otherwise the archive pulses a turn that cannot be taken. And opening one
  must NOT stamp `recordLastGameEntered`: that memory names the party CONTINUE
  should resume, and a finished id would erase it (`openLocalGame`). The curtain
  says «синхронизация», not «подготовка экспедиции» — nobody is leaving on an
  expedition.
- **LAN rows are live-only.** Hosts publish their unfinished games; the archive
  is this device's own (`visibleLanRows` is empty on the archive tab, which also
  keeps the cursor range honest).
- Files: `src/server/models/joinableGames.ts`, `src/server/routes/ApiGamesJoinable.ts`,
  `src/client/components/mainMenu/joinGamesState.ts` (`finishedGamesState` —
  no polling, no cross-session cache, self-healing on a profile switch),
  `src/client/components/console/menu/ConsoleMainMenu.vue`. Specs:
  `tests/models/joinableGames.spec.ts`, `tests/routes/ApiGamesJoinable.spec.ts`.

## Input & the bottom bar

The shell delegates the whole pad to the workspace while it stands
(`endgameWorkspaceMounted` branch in `handleIntent`) — Info Mode / journal /
wheels are deliberately consumed (an Info peek would leak pre-reveal totals).
Two exceptions: ⚠ **a LIVE drawn-cards reveal keeps the pad** (a reload can
owe undelivered draws; the overlay stands over the settled result and its
normal branch sits BELOW this one), and the «Обзор партии» round trip runs on
the fallback engine (`.eg-results` scope; B clicks `.eg-results__ctl--min`,
which is deliberately UN-hidden in console CSS now — it is the road back).
While the overlay is up the workspace hides via `v-show`
(`endgameOverviewOpen`) — ceremony state survives the trip.

Bar: PanelOwner `'endgame'`; during the count exactly ONE verb — `X Skip
scoring` (X so ordinary navigation can't trigger it); settled — `dpad Select ·
A Confirm`. Context key `Final scoring`. Post-game actions (real flows only):
`Game overview` (opens the desktop overlay — see TODO in the component),
rematch verbs from `rematchState` (offer / accept+decline / cancel / join via
`navigateWithCurtain`), `Replay scoring`, `To main menu`.

## E2E harness law (cost a day)

**Once the page is open, the VIEWED seat's prompts are answered THROUGH THE
PAGE only.** `WaitingFor` skips GO/REFRESH while the viewer holds a required
prompt (mid-input protection), so an API answer behind a live client freezes
it — a state two real clients cannot produce. The spec drives everyone to the
viewer's final-greenery question over the API, answers THAT through the page
(`finishFinaleThroughPage`), finishes the others over the API, and the
promptless page hears the END through its own poll. Also: testMode deals 8
corps/seat — a 4-seat table needs `promo+community` or two seats are never
dealt and the start deadlocks on `every(pickedCorporationCard)`.

## TODO

`ConsoleEndgameWorkspace.actions` carries the console-native OVERVIEW rewrite
TODO (tabs / InsightEngine / charts — out of scope of the scoring iteration).
