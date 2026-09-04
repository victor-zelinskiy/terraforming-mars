# Console FINAL SCORING workspace («Финальный подсчёт»)

The post-game is a **PHASE-anchored workspace root** (`'endgame'` in
`WORKSPACE_KINDS`, anchor `{type: 'phase', phase: 'end'}`) — the same shape as
`start`/`draft`. `ConsoleShell.endgameFrameLive` (=`Phase.END`) stands it up on
the rising edge and tears it down (+`resetConsoleEndgame`) on the falling edge
(undo / rollback). It projects onto neither navigation axis, serves no prompt,
and is a full-bleed scene over the frame: `.con-endgame` covers everything
except the bottom command bar strip; `.con-root--endgame` fades the status
strip / player rail / banner out (`visibility`, never `display`) — and DROPS
while the scene is **collapsed** (B), so the final board + HUD come back for
the inspection round trip. The desktop endgame surfaces go HEADLESS in console
mode (`EndgameExperience :console-native` — no auto-reveal, no pill;
`RematchLayer :headless` — poller alive, no DOM).

## Files

| Layer | File |
| --- | --- |
| pure VM | `src/client/console/endgame/consoleEndgameModel.ts` |
| pure track geometry + anchored labels | `src/client/console/endgame/consoleEndgameLayout.ts` |
| beat script (pure) | `src/client/console/endgame/consoleEndgameScript.ts` |
| reactive machine | `src/client/console/endgame/consoleEndgameState.ts` |
| the END boundary seal | `src/client/console/endgame/consoleEndgameSeal.ts` |
| GSAP director | `src/client/console/endgame/consoleEndgameDirector.ts` |
| surface | `src/client/components/console/ConsoleEndgameWorkspace.vue` |
| view→model adapter | `src/client/components/endgame/endgameViewAdapter.ts` (shared with desktop) |
| styles | `src/styles/console_endgame.less` |
| specs | `tests/client/components/console/consoleEndgameModel.spec.ts`, `consoleEndgameCeremony.spec.ts`, `consoleEndgameLayout.spec.ts`, `consoleEndgameSeal.spec.ts`, `tests/e2e/console-endgame.spec.ts`, `tests/e2e/console-endgame-boundary.spec.ts` (+ shared journey `tests/e2e/consoleEndgameHarness.ts`) |

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

## STABILITY — the three audited regressions, kept fixed by construction

The 2026-08-18 audit measured three shipped defects; each fix is structural
and each is pinned by an e2e probe (`console-endgame.spec.ts` § stability):

1. **The settled-scene FLASH.** `finalizeCeremony` bumps `skipSeq` on every
   terminal landing (the natural end included); the old `--noanim` frame set
   `animation: none !important` and re-enabled it two rAFs later — and a
   re-enabled keyframe animation RESTARTS from its first frame, so the scene
   root's completed fade-in replayed from `opacity: 0` (~0.5 s of the board
   showing through). Now: `--noanim` suppresses **transitions only**; the
   scene root carries **no keyframe animation at all** (the shell's
   `con-layer` transition owns the arrival); entrances live only on elements
   that MOUNT at their moment (ribbon, places, tie chip) or under phase
   classes present only then (`--entering` rows/rail).
2. **The bar JUDDER.** The row grid declared five columns but rendered four
   children while the tie-break M€ chip was absent — auto-placement put the
   running total into the `auto` column, so every count-up digit re-solved
   the `1fr` track (36 distinct bar boxes measured). Now: four columns, four
   children, ALWAYS — the total owns a fixed-width column, the M€ chip is
   absolute inside the track, and the count-up writes `textContent` directly
   (`hooks.onCount` → an unbound span), never a reactive per-frame write.
   The reactive `displayTotals` is a per-BEAT settle record.
3. **The BARCODE.** Sub-segment shades/seams survived the merge, so the
   settled bar showed every TR source and card family as its own stripe.
   Now the shade/seam classes are gated on `!merged` and dissolve via a
   background-color transition — the settled bar is ONE hue per top-level
   category, with a dark hairline between categories (`.con-eg__seg::after`).

## Track geometry + anchored values (`consoleEndgameLayout.ts`)

Pure and spec'd: `buildRowGeometry` solves all segments once per VM on the
SHARED `maxTotal` scale (fill = `scaleX`, paint-only); a penalty is a
**reclaim scar** `[netPct … grossPct]` — a track-background curtain sweeping
in from the right (origin right), leaving a red-hatched strip + the exact
negative value below it. `planValueLabels` anchors every category's exact
value to its segment: **inside** the box when the digits fit, on the **rail
below** otherwise (deterministic L→R collision sweep + track clamp); zero
categories keep a small dim honest «0». The component measures the track
once (`measureTrack` — skipped while hidden: a v-show'd scene measures 0)
and re-plans only on viewport change.

## Ceremony machine

`CeremonyPhase`: `idle → entering → scoring → settling → ranking →
[tiebreak] → winner → actions`; inside a category the four-part phrase is
`beatStage: focus → grow → settle` (+ a scripted pause). The pure script
(`ceremonyBeats`) emits the beat list — a MAIN category ≈ 220/640/240/270 ms,
sub-steps 390 ms, merges 500 ms, `preRank` breath, FLIP, places, a
**winnerHold** (the crowning never rides the FLIP), winner 1.5 s, actions.
Typical full act ≈ 12–15 s base (rich configs a little more); spec-guarded
windows. The director lays it on ONE paused GSAP timeline through
`consoleMotionMs`, advancing `consoleEndgameUi`; CSS transitions
(transform/opacity only) paint. Count-ups tween ABSOLUTE running targets
into the DOM sink. The FLIP and the `ceremonyFx` gold burst are component
hooks registered as director cleanups.

**`finalizeCeremony(vm)` is the ONE canonical terminal state** — skip (X),
the natural ending, reload-into-END and the safety net all land there;
`skipSeq` drives the one-frame transition suppression. It resets
`actionsFocus` to 0 («Обзор партии» — the natural next step) and leaves
`collapsed` alone (finalizing behind a collapsed scene must not yank the
player off the board). The animation-hold supplier (`endgame-ceremony`)
reads the reactive phase AND releases while collapsed.

### The CAMPAIGN CHAMPION beat (final mission only)

`vm.campaignFinale` (from the server's `gameOptions.campaign` contract:
`final === true`) appends ONE `champion` beat between `winner` and `actions` —
the mandatory campaign coronation, on the SAME timeline (pause/resume, skip,
safety net and idempotency inherited). Five windows (~5s base), each a
reactive `championStage` the CSS narrates: **pause** (the result stands
fixed; `.con-endgame--champion` recedes the rail/caption/meta and deepens the
rest-rows' step-back) → **seal** (the header slot crossfades «ИТОГИ ПАРТИИ» →
«КАМПАНИЯ ЗАВЕРШЕНА») → **sweep** (a one-shot light bar runs the champion
row's own frame; the row gains the persistent `--champion` deepened gold) →
**plate** (the «ПОБЕДИТЕЛЬ» ribbon fades while `.con-eg__champline` unfolds
on the same anchor: «ЧЕМПИОН КАМПАНИИ» + the player-color swatch + one pip
per mission lighting in sequence) → **fix** (a gold ping + a GSAP scale pulse
on the final total — deliberately NOT a CSS animation swap, which would
restart the winner crown pulse when the phase class drops — and the
persistent gold KEEL mounts under the number) → a reading hold.

Rules the beat obeys: it is a DECORATIVE LAYER — every mark is absolute, the
row grid never re-flows (e2e-pinned rect-equality across the whole act). It
CANNOT be skipped: `handleIntent` absorbs the whole pad and `footCommands`
returns `[]` while `phase === 'champion'` (no stale hints, mash-proof); the
animation-hold supplier already covers it as a pre-`actions` phase, and the
director's safety net / unmount finalize keep the lock bounded.
`finalizeCeremony` carries the TERMINAL campaign state (`championStage: 4`,
`championShown`) so the scoring skip, a reload into the ended campaign and
the natural ending all land on the same settled screen: header «Кампания
завершена», plates, keels, full row readability, actions focused on
«Хроника кампании» (the campaign-map door leads the list). «Повторить
подсчёт» resets the marks and replays the full act. Ties share the
championship: every `vm.winners` row gets an EQUAL plate/frame/keel (the
zone note turns «Чемпионы кампании» in its fixed-height slot); the MarsBot
rides the same path (no bot branch exists). Reduced motion keeps the
SEMANTIC act (header turn, instant plate+pips, keel) with no travel.
Missions 1–3 and ordinary games see zero changes (no beat is emitted), and
the Governor emblem is never the champion mark — the plate is
(`campaignRowBadges` carries per-mission titles only). E2E: a REAL final
mission (`tests/e2e/console-campaign-endgame.spec.ts` — dev fast-forward ×3
with single-corp lineages, mission 4 played through the shared harness).

**Missions 1–3 have ONE continuation CTA** (2026-09-04): the actions list
leads with a single «Следующая миссия» (`campaign-next`, honest status
note; a live mission is entered directly). It opens the ONE campaign scene
— the map — which opens the mandatory carryover step ITSELF and then
stands as the launch / ready-waiting stage (auto-join armed for a ready
non-host). The workspace's own carryover scene is DELETED; while the map
scene stands, `footCommands` mirrors its overlay through `campaignMapUi`.
Full contract: `docs/CAMPAIGN_MODE_ARCHITECTURE.md` (header, «Interlude
ONE-FLOW»).

**The WINNER IS THE ROW** — a hero treatment of the first row (gold rim +
wash, the «ПОБЕДИТЕЛЬ» ribbon standing on the row's top edge, gold place
numeral and total with a one-shot crown pulse), never a duplicate plate
below. Solo defeat = a calm neutral ribbon, no burst. The tie-break strip is
transient zone annunciation; the deciding M€ chips stay on the contender
rows through the settled state (absolute — zero layout impact). Winner gold
≠ focus cyan by hue, weight and placement.

## THE BOUNDARY IS A TEARDOWN (`consoleEndgameSeal.ts`)

Phase.END arrives from the POLL, not from a press, so whatever the player had
open at that instant is still open one frame later — and `.con-endgame` is one
of the LOWEST layers in the shell (11480). The quick wheel (11500), a sheet
(11500), Information (11560), the hand pack (11645) and the notification feed
(12650) therefore kept painting OVER the finale, and because the workspace
consumes the whole pad while its scene stands, none of them could be dismissed
any more: an open action wheel was a lid welded over the final scoring.

`sealLiveGameSurfaces()` runs ONCE on the rising edge of `endgameFrameLive`,
BEFORE `enterWorkspace('endgame')`, and dismisses every live-game instrument
BY NAME — the quick wheel / sheets / confirm / sale (`closeConsoleLayers`), the
workspace PARK (a decision set aside for a game that has ended), Information,
the journal + its local layers, the fullscreen viewer, the colony focus stage,
both board inspection modes, the prompt-scoped picks, the notification feed,
the surface-motion shade. The shell adds what it owns as component state
(«Разыграно», the journal's colony dossier, `resetHandReveal`). **A new console
surface is a new line there and a new row in `consoleEndgameSeal.spec.ts`** —
that spec is the boundary's worklist.

Deliberately NOT sealed: the workspace STACK (the phase root's own
`enterWorkspace` unwinds it), every `waitingFor`-derived surface (the transport
is down; nothing is ever owed), and the drawn-cards REVEAL — a reload into an
ended game can still owe undelivered draws, and «no silent loss» outranks a
tidy screen.

⚠ **PLANET FOCUS IS ASKED TO END, NOT TO VANISH.** The module owns WHEN the
mode ends; `ConsoleBoardSection` owns its GEOMETRY — the camera moved in, and
the pre-focus framing is replayed on the `exiting` phase. `resetPlanetFocus()`
is a hard DROP: it jumps straight to `idle`, so `exiting` never happens,
nothing replays the framing, and nothing re-derives it either (the stage's box
is identical across the boundary — every HUD member the post-game hides uses
`visibility` — so no resize ever reaches `scheduleFit`). The player collapsed
the results onto a planet zoomed in, clipped by both bars, arcs cut off. Fixed
on BOTH sides: the seal calls `beginPlanetFocusExit()` when the mode is engaged
(the ordinary exit costs nothing under the arriving scene and unfreezes
`heldParams` through its own settle), and the board SELF-HEALS at `idle` when
`fitMode` is still `'focus'` — so any future hard drop, from any caller, is
covered. The `--board-scale` across the boundary is pinned in
`console-endgame-boundary.spec.ts`.

⚠ `closeInfoMode()` LATCHES a dismiss tail (`infoModeState.closing`) whose
release is the panel's own after-leave hook — which cannot fire for a panel
that was never mounted. Sealing an already-closed Info Mode pinned `closing`
true for the session, and `con-root--rail-replaced` reads it: the trophy
gallery went dark for the whole post-game inspection, the exact defect
`endgameStageUp` exists to prevent. The seal asks before closing. A latch
belongs to the WORK, not to the ATTEMPT.

**The HAND leaves with its dock.** `handDockVisible` already hid the CHASSIS at
Phase.END, but the cards are not the dock's children — they are one persistent
fixed layer of their own (`handBodies.ts`), so the finale ran under a full hand
nobody could put away. `ConsoleShell.handBodyCards` (the layer's `cards` prop)
is empty in the post-game — gated on the PHASE alone, deliberately: the
pre-game setup window is the dock's other hidden state and cards are physically
flying into it there.

## Collapse (B = «Свернуть») and the READ-ONLY FREE ROAM

B in ANY phase parks the scene: `consoleEndgameUi.collapsed = true`, the
director timeline PAUSES (`handle.pause()`; the safety net re-arms while
paused instead of skipping), the workspace hides via v-show with its frame
still in the stack, `.con-root--endgame` drops (HUD + final board return)
and the bar reads `B Итоги партии`. B never leads to the main menu — «В главное
меню» is an ordinary A-confirmed action.

**Collapsed, the workspace owns NOTHING** — it publishes no bar commands and
its `handleIntent` returns immediately. The shell routes on `endgameStageUp`
(mounted AND showing), so past «Свернуть» the pad runs the ORDINARY chain and
the post-game is a read-only free roam over the same screens: the board and
both its inspection modes (L3 / R3), «Журнал» (View), «Разыграно» (X),
«Информация» (Y), and — through the RT wheel, which is how they are reached at
all — «Колонии» and «Гидросеть». Every action verb answers «Партия завершена»
(`actionBlockedReason` gains the post-game answer, which the LT wheel, the
standard projects, the MA items and the hand press all read), and the RT
wheel's two PERSONAL tiles («Карты», «Действия карт») are blocked with that
same reason while the two BOARD tiles stay open. Blocked with a reason, never
hidden — the console's rule everywhere else. The ONE exemption is
`confirmColonySelection`: the focus stage IS the colony's dossier, and refusing
the descent would take the colonies' final state away from the inspection.

**B is one calm level, every time.** A surface closes itself; an inspection
mode exits; and at the BOARD-HOME ROOT — where there is nothing shallower left
— `handleSectionBack` calls the workspace's `expandFromBoard()` and the results
come back, settled, from the same beat. The bar's road home is appended to the
board `home` run (a `back` command is `keep: true` in the fit model, so it
survives every drop pass; it needs no `priority`).

The alternative shipped and was the report: a hidden scene that keeps eating
the pad is not a workspace, it is a lock — the whole inspection was a static
board with one live button.

**Re-entry:** the ceremony auto-plays only when this page load SAW a live
phase (`sawLivePhase`) and hasn't played yet; a reload straight into an
ended game lands SETTLED — «Повторить подсчёт» is the explicit replay
(it resets presentation state only; the VM/data are untouched).

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

The shell delegates the whole pad to the workspace while its SCENE IS ON
SCREEN (`endgameStageUp` branch in `handleIntent` — mounted AND showing) —
Info Mode / journal / wheels are deliberately consumed there (an Info peek
would leak pre-reveal totals). One exception: ⚠ **a LIVE drawn-cards reveal
keeps the pad** (a reload can owe undelivered draws; the overlay stands over
the settled result and its normal branch sits BELOW this one). Past «Свернуть»
the branch steps aside entirely — see the free roam above. «Обзор партии» is
the workspace's OWN internal scene — the workspace routes the whole pad to it
while it stands (`overviewParked` branch at the top of `handleIntent`); the
desktop `.eg-results` overlay never rises in console mode. Full contract:
`docs/claude/console/endgame-overview.md`.

Bar: PanelOwner `'endgame'`; during the count `B Свернуть · X Пропустить
подсчёт`; settled `dpad Выбрать · A Подтвердить · B Свернуть`. COLLAPSED the
workspace publishes NOTHING — the bar belongs to whatever surface the free roam
is standing on, and the board home carries the ordinary view run plus
`B Итоги партии`. The bar CONTEXT is empty while the scene shows (the scene's
own header already reads «ФИНАЛЬНЫЙ ПОДСЧЁТ» → «ИТОГИ ПАРТИИ» at settle) and
`Final state` on the collapsed board home (every other surface names itself). Post-game actions (real flows only), in
priority order: `Game overview` (default focus) → rematch verbs from
`rematchState` (**`Rematch`** when `votes.length <= 1` — a bot/solo game's
offer creates instantly, there is nobody to propose to; else `Offer
rematch` / accept+decline / cancel / join via `navigateWithCurtain`) →
`Replay scoring` → `To main menu`. Action pills carry no inline glyphs —
the bar states the controller semantics.

## Presentation modes (player count)

`.con-eg--n2 / --n3 / (base = n4) / --n5` set the density TOKENS (row
height, bar height, name/total/corp/place sizes, label rail, zone) — a
2-player finale is a large-format stage (8.4rem rows, 2.6rem bars, 1.6rem
names), five players stay one screen with no scroll (e2e-guarded at 4K).
The handheld profile overrides the same tokens.

## E2E harness law (cost a day)

**Once the page is open, the VIEWED seat's prompts are answered THROUGH THE
PAGE only.** `WaitingFor` skips GO/REFRESH while the viewer holds a required
prompt (mid-input protection), so an API answer behind a live client freezes
it — a state two real clients cannot produce. The shared journey
(`consoleEndgameHarness.journeyToEndgame`) drives everyone to the viewer's
final-greenery question over the API, answers THAT through the page,
finishes the others over the API, and the promptless page hears the END
through its own poll. Also: testMode deals 8 corps/seat — a 4-seat table
needs `promo+community` or two seats are never dealt and the start deadlocks
on `every(pickedCorporationCard)`. Probes are `setInterval`, never rAF
(headless starves rAF; a dead probe passes).

## «Обзор партии» — the internal analytics scene

The console-native OVERVIEW rewrite shipped 2026-08-19: «Обзор партии» is an
internal SCENE of this workspace (`ConsoleEndgameOverview` — six tabs on the
LB/RB ring, InsightEngine headline facts, console-native charts), never the
desktop `.eg-results`. The scoring stage PARKS under it (opacity/visibility,
never display) and returns on B with the settled state intact. Full contract:
`docs/claude/console/endgame-overview.md`.
