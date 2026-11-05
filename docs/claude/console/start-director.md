# The START DIRECTOR — «правда сервера → одно состояние → один владелец экрана»

The owner, 2026-10-29: the game start must be RELIABLE by construction, not by a growing set of guards. Today the
start's screen is decided by a dozen independent latches (`queueReleased` / `playedDockReleased` →
`effectReturnPending`, the seat chain, `firstAct.stage`, the yields) and enumerated «may the next stage start»
predicates. Each is right on its own; a chain nobody thought of walks between them — PL-1110 («Наследие» in one
predicate and not the other) and the field hang of 2026-10-28 (Strategic Base Planning → Triton, PL-1112) are one
class.

The target: ONE pure function decides WHO serves the screen from the server's one question (+ the presentation's
bounded debts); the motion layer keeps deciding HOW. Every latch that today delays a transition so a beat can finish
becomes an explicit, bounded DEBT — never deleted silently (that is what would cut the motion and cost the premium
feel).

## Phase 0 — SHADOW (shipped 2026-10-29)

`src/client/console/startDirector.ts` (pure, `tests/console/startDirector.spec.ts`):

| Piece | What it answers |
| --- | --- |
| `expectedStartOwner(truth)` | who MUST serve: `waiting` · `wizard` · `queue` · `firstAction` · `bonusAction` · `board` · `step` · `game` — from `waitingFor` alone (start-prompt kind, the bonus marker, the action menu, `space`, the task kind) |
| `actualStartOwner(signals)` | who the latches PUT there: the scene's own `data-start-serves`, the board, a prompt surface (`shell` / `step`), the player's park, a beat |
| `startShadowVerdict` | `agree` · `disagree` · `held` — a beat / park is never judged; a step may be the start's or the shell's; a prompt HELD behind an admission block is judged only over a screen with nothing to do (a reveal to take is the player's own wait) |

`ConsoleShell.startShadowNow` / `startShadowSig` + the `startShadowSig` watcher: a disagreement standing
`START_SHADOW_CONFIRM_MS` (3 s) unchanged, or a hold over an empty screen for `START_SHADOW_HELD_MS` (10 s), is
logged ONCE per (kind, owners, prompt) as `[start-shadow]` with the scene's `__conStartDiag`. **Nothing on screen
changes.** `window.__conStartShadow()` reads the findings; the field export carries the warnings.

e2e: the harness's `startShadowHarvest` files every test's findings under `test-results/start-shadow/` and annotates
the test — DATA, never red. `node scripts/start-shadow-report.mjs <task> [--detail]` groups a run's findings.

**First reading (2026-10-29, the start suite on the box, 101 tests):** zero disagreements; three `held` — all a
reveal standing for the player's take (the rule was narrowed for them). The latches agree with the table on every
path the suite walks; the field's failures live on paths it does not. The shadow ships in the product so the next
field exports name them.

## Phase 1 — THE SHADOW ACTS (shipped 2026-10-31)

The owner (2026-10-31): «не стоит ли тот подход расширить и сделать не только диагностическим, а фактическим, чтобы
убрать другие зависания и неправильные переходы между состояниями?» — yes, in the narrow form that costs the motion
nothing: a CONFIRMED finding is CURED through the doors that already exist, by name, and only when the player is
provably stuck. No latch is replaced (that stays phase 3, under storyboards).

| Piece | What it does |
| --- | --- |
| `startDirectorCure(finding)` (pure) | `heal` — the START must serve (`startOwnsOwner`) and nobody does (`actual: none`): the scene's own doors, `healStrand` (queue / shelf return, the first-action seat, the bonus stage); a door that opens nothing YIELDS. `yield` — the SHELL's surface must serve (`step` / `board`) or the game has begun (`game`) and the start scene still stands: the strand's yield (`startStrandYield`, released on the next prompt). `none` — a `held-long` finding (an admission block's own ledgered debt), and any disagreement the player can act on (a shell surface standing for a start question, a live placement). |
| `ConsoleShell.runStartDirectorCure(finding, by)` | runs it; logs `[start-shadow] cure «heal|yield» by shadow|liveness — …: <did>` (the SAME prefix, so the e2e harvest files it with the findings); idempotent — a cure that changes nothing reports nothing. |
| the shadow's confirmation | the `startShadowSig` watcher cures right after it logs a finding (3 s unchanged, once per finding). |
| the ladder's rung `start-director` (rank 15) | the liveness arbiter re-asks the cure on a STALL with a standing disagreement — before the flows are released with force (20) and long before the stack is sent home (30). |

The first run of the start suite with the director in (2026-10-31, 19 files): ONE finding, no cure — «firstAction → bonusAction» on `console-bonus-nested-first-action` (the corporation's mandatory move INSIDE the bonus window is the bonus stage's own sub-stage); the agreement table now knows it (`startOwnersAgree`). Beware the snapshot trap of that run: a neighbour's `make:css` mid-compress left a 0-byte `styles.css.br` in the snapshot — 22 reds with no CSS at all, none the director's.

What it deliberately does NOT do: undo a yield the strand already made (`actual: shell` — the shell is serving), tear
down a live placement, touch a held prompt (the block's ledger degrades it), or move anything while the shadow agrees.

**Reading a cure in a run**: a `cure` line in `test-results/start-shadow/` is DATA in phase 1 — a latch bug the director
papered over on a spec path; it becomes the next stand (phase 2) before the latch is touched. The start suite's first
run after this phase: see the ledger row PL-1265.

## Phase 2 — THE FIELD'S OPENINGS, read off the box (2026-10-31)

No renderer log reaches the box (the Electron console is not written anywhere; the embedded server logs twenty
lines), so the field's evidence is the SAVES: `~/.config/terraforming-mars/embedded/db/files/history/<game>-NNNNN.json`
— one full serialized game per move, its mtime the move's time. Two scripts turn them into phase-2 data without a save
leaving the box:

- `scripts/field-opening-index.cjs <build> <db-files> <out>` — runs ON THE BOX (`~/tm-e2e/node/bin/node`, the
  repo's node_modules, a snapshot's compiled server): every generation-1 save of every game is deserialized through the
  real `Game.deserialize` and each seat's `getWaitingFor()` is written as one token (`type[:startKind][:bonus][:menu]
  [:choice:<source>]`, an unmarked prompt by its title KEY) with the save's mtime — a few KB per game (227 games,
  66 326 saves walked in ~2 min).
- `scripts/field-opening-report.mjs <index-dir> [--gap s] [--detail] [--game id]` — the SHAPES each human seat walks
  from the wizard to the menu, the LONG WAITS on a human prompt past the lobby (the next save's prompt beside it) and
  the openings that never reached the menu.

**The first reading (227 games · 419 human seats · 28 shapes):** ELEVEN of the twelve long waits past the lobby stood
on ONE prompt — `corporationInitialAction`, the start's own «ПЕРВОЕ ДЕЙСТВИЕ» stage — across games, both human seats
(the owner's TV and the LAN Deck), different corporations (Inventrix 11 932 s + 1 602 s · Vitor 35 148 s · Celestic
668 s · Inventrix on the owner's seat 540 s …), with the game age ticking between IDENTICAL saves (a reload re-priming
the prompt — a player who left and came back, or one who reloaded a dead screen; the save cannot tell them apart).

**The stand:** four of those tables AS SAVED (`field-first-action-inventrix` · `-vitor` · `-celestic` · `-inventrix-owner`,
the source saves under `fixtures/field/`), walked on BOTH profiles the field plays (tv4k · deck) by
`console-start-field-first-action.spec.ts`: the stage serves (`data-start-serves="stage"`), A takes it, what the action
sets off is answered the player's way (Vitor's award is a pick → its confirm; Celestic's reveal; Inventrix's draw), the
table reaches the game — the harness red on a strand / a stall / a beat, the shadow's findings and cures filed.
**Result: 8 / 8 green, no finding, no cure** — the dominant field shape does NOT freeze on the box from the saves alone.
What the saves cannot carry is the CLIENT's side of those minutes (a hold that never released, a surface deaf to the
pad, a device-specific render) — the next phase needs the client's own record (a field flight recorder: the
`[start-shadow]` / `[liveness]` / `[start-stranded]` / `[workspace-stall]` lines + `__conStartDiag`, kept across a
reload and posted to the embedded server beside the save).

### The first FIELD CURE (2026-10-31 21:48 — one hour after phase 1 shipped)

The owner's export `game-pab1793c_console_export_2026-10-31_21-49-31.txt` (the box's `~/Applications/` keeps every F12
export — 27 of them since August, the field's own archive): a solo table against MarsBot on the TV; pink played the
last of two preludes (Orbital Construction Yard · Established Methods), the server asked the action menu at 21:48:53,
and the start scene stood over it SERVING NOTHING — `flow: deploying`, `flowStage: ready`, no queue card, every
blocker false but `otherPromptStands` (the menu itself); the strand watchdog SILENT (masked by a term the shadow does
not read — a hold / a gate); at 21:48:56 the shadow confirmed «game → none» and `cure «yield»` handed the screen to
the shell; the player opened the card actions three seconds later. The second finding it logged («game → shell») was
the cure's own after-state — the agreement table now reads it as agreement.

The stand `console-start-field-deploy-leave` (fixture `field-start-deploy-leave` — the table AS SAVED one step before,
pink on the prelude pick with both preludes in hand): the two preludes play on the real UI, and once the menu is asked
the start must LEAVE ON ITS OWN — RED on a `[start-shadow] cure` / `[start-stranded]` line, red on a scene still
painting with nothing served. First run on the box: GREEN in the functional class (fast boot, motion ×0.5) — the field
defect is timing-shaped (the real boot, motion ×1, the TV's GPU), so the stand runs in the TIMING class too.

The export archive also names the OTHER field stalls of the month — every one a class this iteration touched:
`[workspace-stall] «card-actions» … payout` × 6 (10-24 / 10-25 — the party discard's payout, fixed in the Parliament
reliability iteration), `"rail-reward" held for over 35000ms` × 3 (the Reds' discard exchange, same), `[workspace-stall]
«parliament» … chairmanQuest` × 2 (10-30), `[console-foreground-watchdog] … ruling-change-rating-owed` × 3,
`board-beat-park degraded after 30s` × 4 (the honest multiplayer wait). `scripts/field-log-report.mjs` reads the
recorder's drop box the same way for the days to come.

### The second field export of the shape — the cure was too weak (2026-10-31 22:15, export `game-pbfed567`)

A fresh table on the box (game gbd2cf6a99a8b — solo against MarsBot, Turmoil Redux, Robinson Industries, Power
Generation then Metal-Rich Asteroid: the LAST prelude raises the temperature): the same «game → none» → `yield` at
3 s — and then what the yield LEFT: the start frame still in the stack, so the park held the temperature with
`watchable: false` until its 30 s degrade (the scales' story lost), and the scene's LIFETIME HOLD still armed, so
`startSceneServes` kept the `mandatory-choice` foreground lease with nothing rendered until the foreground watchdog
expired it two minutes later. Three changes:

- **`release` — the game proper has begun, the start ENDS.** `startDirectorCure`: expected `game` and the start
  frame in ANY pose (painting, or already yielded to the shell) → `release` → the scene's own door
  `releaseByDirector` → `runSceneRelease` (the resolved frame, the dissolve, the hold let go — bounded by its own
  safety; a scene not in the ceremony lets the hold go at once; no instance → `releaseStartScene()` directly), and an
  earlier yield goes with it. `game ↔ shell` is no longer agreement: a yielded start frame under the menu is the
  defect. `yield` stays for a step / a placement (the start may still be owed after them).
- **The strand watchdog waits on BLOCKING holds only** (`startStrandedNow` — the liveness law «a decision never waits
  on a story»): the notification-only scale-step rating waiting for a board the start covered masked the strand.
- **The shadow skips the boot curtain** (`sceneTransitionInputLocked`): «wizard → game» 5.5 s after the page loaded
  was the curtain, not the start.

Why the deployment did not settle is NOT yet named: `__conStartDiag` now carries every `deploymentSettled` term the
blockers did not (`settle`: hold · flow · reaction · embed · first/bonus owed · legacy · the delivery hold), and the
next field export or recorder entry will name it. Two stands walk the shape on the current code and are GREEN in both
classes (`console-start-field-deploy-leave` × two field tables from the prelude pick; `console-start-hold-param-leave`
— the WHOLE opening on the real UI, the wizard's summary arming the lifetime hold that a prelude-pick boot never has):
the defect is field-timing-shaped, and the cure no longer leaves a frame behind when it fires.

Also fixed from the same export: `observeQueueBox` threw `ResizeObserver.observe(null)` ×4 (an unmounted ref reads
`null`, the guard tested `undefined`; the fourth inside `openHandWithReveal`'s flush).

### The field flight recorder (2026-10-31)

What the saves cannot carry, the CLIENT now keeps: `client/console/fieldRecorder.ts` (installed by the console key
bridge — the console's own entry) copies every TAGGED `console.warn` / `console.error` line (`[start-shadow]`,
`[start-stranded]`, `[liveness]`, `[workspace-stall]`, `[transport]`, …; the originals still print) and the liveness
arbiter's HEARTBEAT once a second (the prompt, whether a surface accepts, what is in flight, the stack, the quiet
seconds, the presses — written where `checkLiveness` judges) into a bounded record PERSISTED in `localStorage` per
player — so a reload does not erase it: the next boot of the same page posts the previous session's record as
`previous-session` with how the player came back (`reload` / `navigate`), live lines go out in batches, a beacon on
`pagehide`. `POST /api/field-log` (`routes/ApiFieldLog.ts`, CORS-eligible for the desktop renderer, bounded, never
read by the game) appends each post as one JSON line under the server's `db/field-log/<day>.jsonl` — on the box beside
the saves, for the LAN seat too (its renderer's console never reaches the box otherwise; the Electron F12 export is a
manual button and the owner's screen only). `scripts/field-log-report.mjs <dir>` lays it out: every screen RELOADED
AWAY FROM A LIVE PROMPT WITH NOTHING ACCEPTING (the freeze's own signature — the last heartbeats + the last lines),
the tagged lines by tag and shape. Guards: `tests/console/fieldRecorder.spec.ts` (the ring, the batch, the persist, the
hand-over, the beacon), `tests/routes/ApiFieldLog.spec.ts`, `cors.spec`. A freeze report from now on starts with this
file: the game and seat → the previous-session record → the save of that step (`field-opening-report --game`) → the
stand.

Two driver traps the stand paid for, both general: `bootFixtureSeats` SEEDS every start prompt of seats[0] over the
API unless `landing: 'prompt'` (a one-human table had its first action answered before the console opened); and a
surface may take TWO presses by design (an award's pick → its confirm) — a «did A move the server's prompt» witness
judges up to three presses, never one.

## Next phases

1. **Field data**: the owner's games log `[start-shadow]`; every new shape becomes a stand (a field save → a fixture,
   the recipe in `start-polish-reliability-1` memory) BEFORE any latch moves.
2. **Debts named**: list every latch that delays a transition (room / shelf return, the seat chain, the excursion
   barrier, the stage's off-flush confirms) as a bounded debt the director reads — still in shadow.
3. **Switch one owner at a time**: the director's answer drives `startSceneVisible` / the stage entry for ONE owner
   class per step; each step is closed by the 4K GPU storyboards A/B (before / after) — a visible motion difference
   is a bug, never «by design».

## The start's hosted STEPS — one host, in turn (P55 · FN, 2026-11-04)

The start hosts three step kinds INSIDE its body — the colonies (P48), the hand (the sponsor's play-from-hand since its
first day; a prelude's own DISCARD since P55) and the embedded outcome — and since P55 none of them re-mounts the
deployment: the body is `--stepped` for each, the step slot is a sibling inside `.con-start__ceremony`, the deployment
releases in place. Two steps of ONE prelude play come IN TURN (Old Mining Colony: the colony, its story, then the
discard — `colony-focus-stage.md` § 5a′), never nested and never announced. **A RELOAD mid-step stands the start back
up around the step** — `startFrameLive` § 3: in the PRELUDES phase a prelude's discard (`startStepDiscardOf` — since PC05 also a starting corporation's
first-action discard, § 1b, in the action phase) and a
prelude's colony pick (`choiceContext.source` naming a PRELUDE) are the start's steps, the same server-truth reading the
sponsor's play-from-hand had (§ 2); the crumb's subject is re-read off the server's marker. A new step kind of a prelude
is a row in that reading, never a standalone screen.

**The fourth kind — the ORDER of a prelude's placements (P58 · FS, 2026-11-04).** Project Eden places three tiles in the
PLAYER's order: between its placements the server asks a live `OrOptions` marked `placementOrderPrompt`
(`startPlacementOrderOf` — the marker, a PRELUDE, the PRELUDES phase). It is the start's OWN step, not a hosted frame:
the scene renders it in its body (`.con-start__orderstep`, the «ВАРИАНТ» family's `ConsolePreludeVariantStep` beside the
prelude's face; rows = the card's printed hexes in the printed order, a placed tile SEALED in its row), the crumb reads
«СТАРТ ПАРТИИ › <пролог> › ОЧЕРЁДНОСТЬ k / n», A answers the live OR through the ONE funnel (`startPressRefusal` gates a
busy funnel), no B. Every reading knows it: `taskServedByHost` declines it (the task host never stands for it),
`data-start-serves` answers `step` and the strand watchdog accepts a frameless `step` for it, `deploymentFlowStage` /
`deploymentSettled` hold the deployment while it stands, `startFrameLive` § 3 stands the start back up around it after
a reload. Through each placement the scene is `yielded` (collapsed, never closed) and comes back BY ITSELF with the next
step once the board's story is told (`resumeYieldedStackOverQuietBoard` — the screen handoff); the answered step stays
sealed on screen until the yield (no deployment flash between). The last tile asks nothing; the discard is P55's host.
