# FREEZE ZERO — the program

> The answer to `docs/claude/prompts/freeze-zero.md` (the owner's and the management's decision, 2026-11-14: **the class
> «the console froze» is fixed at the root, not netted**). Written by the architect session; kept current milestone by
> milestone. **§0 is the hand-over — read it first when a session picks this work up.**
>
> Neighbours: the diagnostics contract `docs/claude/diagnostics.md` · the kernel `../architecture-v2/KERNEL.md` · the
> architecture plan `../architecture-v2/PLAN.md` (its §0 lists the redesigns this program finishes, its §6 the nets
> this program retires) · the nets' own contracts `../liveness-arbiter.md`, `../wait-graph.md`,
> `../wait-graph-inventory.md`.

## 0. Where the work stands (the hand-over)

| # | Milestone | State |
| --- | --- | --- |
| P0 | the plan, the worktree, the reading | **done 2026-11-14** |
| A1 | SEE · the CAUSE inside the event: line shapes, the cause class, tiers, the evidence snapshot, the cure's delta | **done 2026-11-14** — `common/diagnostics/{shapes,cause}.ts` (every stall / integrity line has a shape: 119 print sites, guard `diagnosticsShapes.spec`), the arbiter names its holder (`supervisor/stallEvidence.ts`), a defect carries what stood (taken BEFORE an acting net acts), an episode says its outcome (`healed · unhealed · reload · quit`), who cured it and what changed; one incident is one record (a net's echo, what spoke inside an episode, the three detectors of a stranded question) |
| A2 | SEE · signal apart from noise: the policy by tier, budgets per class, the session's ledger | **done 2026-11-14** — `planned` / `info` are counted, never sent (a ceiling wait declares `planned` with its reason); the budget is per cause class, the family budget is gone; `hub/sessionLedger.ts` counts every record whatever was sent |
| A3 | SEE · «are freezes fewer?»: the session summary (the denominator), `npm run diag -- trend` | **done 2026-11-14** — the run's ledger leaves as one `session` event at the next launch (play time from the page's own minute); `trend` reads them by release |
| A4 | SEE · native stops with evidence: the trace rides the hang event, long frames aggregated per screen | **done 2026-11-14 (the evidence half)** — the renderer's stop is ONE episode of the main journal, sent with its Chromium trace (scrubbed; the box always, a player within a daily budget of files), its class names the last screen; the ledger sums long frames per screen with where the time went (script · forced layout · style + layout · render). *Reducing what the traces name is C·8* |
| A5 | SEE · reproducible from the event: the save of an unhealed stall, event → fixture | **done 2026-11-14** — a DEFECT on a hosting device (an episode and a single finding alike) carries the save's REFERENCE (the game's fingerprint + the save's number: the server keeps every save); `npm run diag -- save` fetches that file from the box. *Event → e2e fixture: see the tools' row* |
| A6 | SEE · the tools (`npm run diag`: classes, open a class, regress, resolve) and the triage skill | **done 2026-11-14** — `classes` · `class <key>` (the cases laid out in reading order + where the class is reproduced in the repo) · `trend` · `save` · `resolve` · `issues --regressed` · `where`; the skill `diagnose-report` § 3 reads a freeze. **Proven on the real collector by the probe (2026-11-14)**: two causes → two issues, one cause twice → one issue of two events, a planned ceiling → none, a finding with its cure line, a stop with its trace, a session event feeding `trend`; the six corrections that check produced are D45 / D46 of `diagnostics.md` (evidence lists in parts, the class's title, the save for any defect, an episode's own tags, folded echoes counted, `resolve` in the checkout's version) |
| A1+ | SEE · THE TRAIL — the presses that led to a defect ride its evidence | **done 2026-11-14 night** — the router notes every press edge and direction of any device with what became of it (`taken` · `dropped` · `absorbed by <gate>`); a defect's evidence prints the last two dozen with their ages (`inputEcho.inputTrailLine` → `evidence.input`). The chairmanship's class was «A, then A 0.9 s later» — bisected by hand, because the event carried a count. `diagnostics.md` § 2.5; `livenessVerbPresses.spec` § the trail |
| A8 | SEE · WHAT THE ARBITER CANNOT SEE BY CONSTRUCTION — named by the page, with what stood | **two observers stand (2026-11-15), in the supervisor's own pass:** ① **a screen that moves and goes nowhere** (`console/livenessOscillation.ts`, pure) — the arbiter's progress is «the picture moved», so a surface that blinks or a frame that opens and folds in a loop is «progress» every second, for ever: no stall, no rung, no last line. Judged look by look: ≥ 6 flips among ≤ 3 pictures in 10 looks under a live question with NO press in between (the player's own hand, a cinematic that passes through its pictures once, a ticking counter, a screen that settled — none is a loop) → `[liveness] oscillating — …; task: …; top: …` with the evidence, once per spell (`liveness/oscillating/<task>/<top>`). ② **a question nobody can answer** (`common/inputs/promptAnswerable.ts`, pure, conservative) — «pick one card» of none, an OR with no branch, a cell with no legal cell and no cancel: served perfectly, no answer, no rebuild helps → `[question] unanswerable — «<task>» (<type>#…): <why>`, once per question (`question/unanswerable/<task>/<type>`), and by the SERVER that asked it (row S·3). Guards: `livenessOscillation.spec` (8), `promptAnswerable.spec` (7), `diagnosticsCause.spec`; the bottle's test 15 (a surface blinking once a second → one defect with its evidence). **THE LOOP IS ENDED BY THE LAST LINE, ASKED DIRECTLY (2026-11-15 / 16, decision F14):** a loop that stands as long again after it was named (`OSCILLATION_LAST_LINE_LOOKS` — twenty untouched looks in all) → `rebuildConsoleSession` «the picture turned in a loop for 20s with no press», once per spell, under the rebuild's own bound. **NEVER THROUGH THE LADDER — the first arming did, and the real page showed why** (`console-stall-cause` on the box): fed to the arbiter as «not progress, not accepting», the loop was a stall whose rungs CHANGED THE PICTURE — the window saw more than three pictures, the loop read as healed, came back, was named again — and every twenty seconds the «stack home» rung took the player's serving surface away, for ever: a livelock of the cure. A loop is not a wait; the ladder releases what waits. A loop is current only while it STILL TURNS (`OSCILLATION_STILL_LOOKS`: a change within the last three looks — a screen that settled is not judged by what it did before; found by the bottle's own control, 15a). The number behind the arming: the observer said nothing over the 606 walks of the box's proof pass and over the bottle's gates on both seeds — each walk ending in an untouched spell (14 s then; **25 s now, in the bottle and on the box, so a walk's last screen is judged over the loop's whole road**). Guards: `livenessOscillation.spec` (10), the bottle's tests 15 (named → as long again → rebuilt once, not one stall line, nothing of the player's released) and 15a (a loop that ends by itself: nothing rebuilt); the real page: `console-stall-cause` «a screen that moves and goes nowhere» (the control seam `__conBlinkSurface()` under `?waitGraphControl=strand`). The question with no answer is closed at its SOURCE — the server never asks it (row S ③, decision F17); the page's line stays as the witness of a server that does |
| S | **THE SERVER'S HALF — a table that asks NOBODY** (the one freeze no page can see: every page is a healthy screen waiting for another seat) | **done 2026-11-15** (audited first: the server had no judge of its own at all). ① **A BOT TURN THAT CANNOT BE TAKEN ENDS HONESTLY** (`AutomaController.abandonTurn` / `drainTurnTail`): MarsBot's turn resolves on a TIMER with nobody at the other end of a request — a throw in it stopped inside the scheduler's catch with the bot active, the pending marker cleared and no seat asked: «WAIT, nobody» for ever, said to a console no one reads; after a restart the loader re-ran the turn, and a second throw made the game unloadable (404 on every request). Now the turn's BODY is contained where every road into a turn passes (the scheduler, the inline call, the loader): the failure is reported with its stack, the journal says it in the turn's own group («не смог завершить ход — остаток хода пропущен»), the card that broke is spent, and the turn ends the way every turn ends; a turn that broke BEFORE its card was revealed is a PASS (a bot that never passes is given the turn for ever); a DEFERRED effect that throws is one effect lost, said, and the rest of the tail runs; the game's own advance is never run twice. ② **THE TABLE'S LIVENESS** (`src/server/liveness/TableLiveness.ts`): «while the game is not over, somebody is asked, or the bot's turn is on its way» — looked at where every page already comes once a second (the poll); a table found dead twice, 5 s apart, is SAID (a server error with what stood, no id of the game or a seat) and, in the action phase, put back on THE LOADER'S ROAD (`Game.resumeActionPhase` — what a restart does for this state, without the restart); one attempt per death. **«On its way» is the pending turn WITH the scheduler's session behind it, for at most 30 s** (`BotTurnScheduler.turnOnItsWay`): the pending MARKER alone is a field of the game — it outlived a due resolve that rejected (an unhandled rejection until now, the session left standing) and a lost timer, and read as «the bot is about to move» for ever; past the bound the loader's road takes the pending turn itself. ③ **A QUESTION NOBODY CAN ANSWER IS NEVER ASKED** (`liveness/UnanswerablePrompt.ts`, 2026-11-16 — decision F17, which revises F15's second half). The engine's own precedent is `SelectSpace`: built with no legal cell it THROWS. The law is extended to every kind of question at the ONE point each of them passes — `Player.setWaitingFor` REFUSES an input unanswerable by construction (`unanswerableInput`: «pick N cards» of fewer, an OR with no live branch, an AND with a dead part, nobody / no party to choose, an amount with `max < min`; an optional question is never judged) — said (`an unanswerable question (refused)`) and thrown, BEFORE anything of the seat is touched. What follows is what already follows an engine error: inside a seat's own request — HTTP 400 with the reason and the seat's question put back under the SAME identity (a retry is not stale); inside MarsBot's turn — the turn's own containment (the effect is skipped, said in the journal, the turn ends). Nothing is picked for the seat and no rule is written — the question simply is not asked. **The number behind it: over the whole server suite (23 064 tests) the refusal fired in NO path of the engine — only in two specs that built such a question by hand.** The wire model's judge (the page's own, `noteUnanswerablePrompt`) still stands where the model is built, for whatever shape the structural read does not know: said once per question, never a throw. Guards: `tests/liveness/TableLiveness.spec.ts` § a question nobody can answer (5), `tests/routes/PlayerInput.spec.ts` (through the real door: 400, the reason, the question standing). ④ **What was swallowed is said**: the scheduler's catch, a save that cannot be loaded (once per game), a PROGRAMMING error inside a pre-collected batch's tail — all through `reportServerError` (the hub → Sentry). Guards: `tests/automa/AutomaTurnContainment.spec.ts` (4 — red with the containment off), `tests/liveness/TableLiveness.spec.ts` (9). *Not built, by decision F15:* a reload of a dead table from its save; an ANSWER invented for a question that has none (the question is refused instead — F17) |
| V | **THE VIEW'S DELIVERY — «asked» is the SERVER's word** (the road between the server and the applied view was outside every judge: the arbiter read «the server asks» off `playerView.waitingFor`, so a view that never ARRIVED left a healthy accepting screen on «the other seat's turn» while the server waited for this player) | **done 2026-11-15** — audited first (the nine scene flags the root parks a view behind; the poll chain; the root's `update()`), then closed in four places. ① **THE POLL CHAIN CANNOT DIE WITH ITS REQUEST** (`gameTransport.waitForUpdate` / `takePollAnswer`): its re-arm was the LAST statement of the answer's handler — a throw above it (a body that is not a model, a refresh that threw, `Notification` missing on the platform — found by the spec) or a request with no terminal event ended the chain for good, in silence. The answer is taken apart from the chain (a throw is said, the chain goes on), and the answer itself is a GUARANTEE of the transport's scope like the next look is — at every moment of a live chain exactly one of the two stands. ② **THE VIEW'S ROAD HAS ONE ENDING FOR A FAILURE — never a native dialog** (`components/viewFailure.ts`): `update()` ended every failure between the fetch and the commit in `alert('Error getting game data')` — a BLOCKING browser dialog no pad reaches, with the page's script (the arbiter, the pulse, the transport) stopped behind it. A fetch that failed (bounded at 15 s now) is one line and the poll re-asks; an apply that THREW is the last line's (`session-rebuild/page/view-apply`, by `view`), and refused by its bound it is the loading curtain's own error state; the scene's end no longer rides the commit (`.finally`). Guard `nativeDialogGuard.spec` — no `alert` / `confirm` / `prompt` of the browser under `src/client` but the mouse-only admin pages, each with why. ③ **A SCENE MAY HOLD THE VIEW ONLY WITHIN A SCENE'S OWN LEGAL LIFE** (`deferredViewRefresh.parkStep`, `VIEW_SCENE_HOLD_MAX_MS` = the hold registry's 35 s ceiling): the overdue refresh «fired anyway» — and its own guard parked it again behind the same flag, for ever; past the debt's bound the view is committed OVER the flags that still hold it, they are named (`deferred-refresh/overruled/<scene>`) and hold the view no longer until seen released. ④ **ASKED IS THE SERVER'S WORD** (`transport/viewDelivery.ts`, `gameTransport.undeliveredQuestionSince`): the poll's own answer — GO, «you are being waited on» — is kept apart from the view; GO while the applied view asks nothing is a DEBT with a holder by one precedence (the fetch on the wire · the scenes · the bot's run) and a bound (45 s); the arbiter judges it like any unserved question (`asked: undelivered`, `holder: view:<who>`) — the ladder, and past it the last line, which is this class's whole cure: a rebuilt page fetches the view by the boot road. Guards: `gameTransportPoll.spec` (8), `viewFailure.spec` (4), `deferredViewRefresh.spec` (+4), `viewDelivery.spec` (6), `stallEvidence.spec`, `nativeDialogGuard.spec`; replays: `classReplays.bottle.ts` (8) a scene flag that never releases → served at the bound, nothing rebuilt · (9) a view whose fetch never comes back → the stall names `view:fetch`, the page is rebuilt once — both red with their fix off |
| A7 | SEE · proven on the box: the control stall and the control stop of an installed release (`TM_DIAG_PROBE=stall`) | open — needs a release that carries A1–A6 (the next push), then § 9.2 of `docs/claude/diagnostics.md` with `TM_DIAG_PROBE=stall` |
| B0+ | PROVE · **THE PROOF PASS ON THE BOX — DONE 2026-11-15** (the same seed `fz0`, all 8 shards, the build with the observers, `TM_E2E_COVERAGE=1`) | **606 walks passed, 36 060 presses: defects 0 · episodes 0 · never cured 0 — against the baseline: 0 NEW · 3 gone · 0 kept** (`.e2e-remote/fzproof-fz0/monkey-report.json`; `monkey-report --gate` exit 0). What is left on record is PLANNED (two board stories that came due under a covered board, two ceilings that say why) and INFO. Neither observer said a word. ⚠ 601 of the 606 walks have a cause file: two lanes under ONE task name share the box's results directory, and a pull of one lane took five files of the other — every walk still passed under the harness's own guards (`livenessGuard` is red on any stall line). The lesson is the lanes' driver's: one task name per concurrent run |
| B0 | FIND · the monkey's BASELINE on the box (before any fix), reported by class | **shards 1–6 of 8 are in (456 walks, 27 360 presses): 3 defect classes, 0 episodes, 0 never cured** (`.e2e-remote/fzbase-all/monkey-report.json` — the «against» of every later pass; the three classes are rows of §4, all fixed with their replays). Shards 7–8 are OWED (shard 7 was cut mid-run on 2026-11-14 when the owner's rule arrived: **no e2e on the box while Enshrouded runs there** — check `ssh steam-machine 'pgrep -afi enshrouded | grep -v pgrep'` before every box run; then the laptop (`TM_E2E_LAPTOP_OVERRIDE=1`) or the owner's CI after the push, and for the monkey — the bottle's). To run them when the box is free — `nohup node C:/Projects/Mods/tm-fz-tools/monkey-lanes.mjs C:/Projects/Mods/tm-fz fzbase1 fzbase-all 0 1 8 TM_E2E_MONKEY=1 TM_E2E_MONKEY_SEED=fz0 TM_E2E_MONKEY_PRESSES=60 TM_E2E_COVERAGE=0 &`). The baseline build is the snapshot `.e2e-fzbase1` (before any fix): the NEXT pass is the same seed on the current build — it must show zero of these three. ⚠ stopping a lane DRIVER kills its wrapper and orphans the run on the box (`pkill -f "tm-e2e/builds/<task>/"` there). The first launch — seed `fz0`, 60 presses, 8 shards in two detached lanes (`C:\Projects\Mods\tm-fz-tools\monkey-lanes.mjs`: a pass is longer than any tool's timeout; it logs to `.e2e-remote/fzbase-all/lane-<n>.log` and accumulates `shard-<s>/`); summed with `node scripts/monkey-report.mjs .e2e-remote/fzbase-all --out <report.json>` — the JSON is the «against» of every later pass |
| B1 | FIND · the kernel's state space as a number: coverage of machines / kinds / `WAITS_ON` / blocks / frame phases | **the instrument: done 2026-11-14** — `kernel/flowCoverage.ts` (the trace as keys), `console/flowCoverageProbe.ts` (`__conCoverage()`: the keys + what the machines can do + every frame), `scripts/flow-universe.mjs` (280 declared flows), the harness files it per test, `monkey-report` prints «N % walked» and what was never reached. **The first measured numbers** (5 walks × 60 presses, 2026-11-14): 47 of 280 declared flows opened (16.8 % — chain 3 / 3 · scene 16 / 115 · step 1 / 48 · story 0 / 9 · surface 27 / 105), 7 of 13 workspace frames, machine moves: `submit` 2 / 8 · `frame` 5 / 52 · `claim` 3 / 242 · `announce` 2 / 6 — the walk is SHALLOW, and that is the number B2 exists to raise. *Open:* admission blocks and `WAITS_ON` pairs as keys; the whole-suite pass |
| B2 | FIND · the monkey as an instrument: coverage-guided corpus, timing perturbation, the class report, finding → spec | **THE MONKEY IN THE BOTTLE: done 2026-11-14** — `tests/client/bottle/monkey.bottle.ts` (`TM_BOTTLE_MONKEY=1`, opt-in): the box monkey's walk — the same fixtures, the same seed → the same keys and pauses (one generator, number for number), the other seats moving at the same presses — in the bottle: ~8 s a table, all 606 in ~40 min on the laptop in two shards, NO BOX, deterministic. It files `cause-classes/*.json` in the box monkey's own format, so `scripts/monkey-report.mjs .e2e-remote/bottle-monkey --against <the box's report>` sums and compares it. A class only the bottle names is a CANDIDATE (it has no layout): confirmed on the box with the same seed, or added to `LAYOUT_BLIND`. **THE FIRST FULL PASS (2026-11-14, seed `fz0`, 606 walks, 36 360 presses, 33 min):** the three baseline classes gone; 16 candidate classes, triaged: `ma-price:price-end` (116 tables), `played-hero:reward-place`, `admission:host:card-arrival` are waits for a measured end → `LAYOUT_BLIND`; six tables whose candidates were NOT geometric by name (a start strand, three arbiter stalls with their watchdog expirations, a gate's overdue presentation, a starved feed) were walked by the box monkey's spec in a REAL browser on the laptop — five are clean there (the bottle's holds behind unmeasurable flights), **one class is real** (§4: the scale-step rating's story). The lesson is a row of the blind list's own header: a class is called blind only after a real browser said «not there». **THE RELOAD** (`TM_BOTTLE_MONKEY_RELOAD=<n>`: the page reloaded on average once in n presses, its own seeded stream — the restore road walked on every table) and **THE GUIDED MODE** (`TM_BOTTLE_MONKEY_MODE=guided`: most presses are verbs the command bar offers, `bottle.offered()`) joined on 2026-11-14 evening, and the bottle's walks carry COVERAGE (`coverage=1` → the same `coverage` field the box's harvest files). **Measured on 65 tables × 60 presses: plain 107 / 280 flows (38.2 %), guided 104 / 280 (37.1 %) — guidance does NOT deepen a walk in the bottle.** What bounds the depth there is the layout: a card's flight never lands, the admission block behind it runs to its bound, and the flow's next step comes a ceiling later — a walk spends its presses in front of holds. **A SYNTHETIC LAYOUT was tried the same evening** (`TM_BOTTLE_MONKEY_LAYOUT=synthetic` / `BottleOptions.layout`: every displayed element gets a non-empty, deterministic, scattered rect — `bottleDom.ts`): on the same 65 tables **106 / 280 (37.9 %) — no gain either**, the flights' blind classes went (`played-hero:target`, the arrivals' block) and the layout's OWN artifacts came (`scene-transition/hold-bound/board-fit` on 64 tables — a fit that never settles on scattered rects; a start strand). It stays an opt-in instrument, OFF by default. **The measured conclusion:** in the bottle neither the picker nor the layout bounds the depth of a 60-press walk — the walk does; what grows the walked space is MORE WALKS (seeds × tables — 33 min a pass, free) and their UNION (the reload pass and the first pass are two different unions), and the classes come from there. **THE RELOAD PASS (606 walks, 2 421 reloads at random presses): 0 new classes, 2 walks ended unserved — both the bottle's own blind incidents — and no harness error:** on every table the page that comes back serves the question it left; the corpus (keep the walks that reach new coverage, mutate them), the perturbed box passes, `TM_E2E_MONKEY_REBUILD` |
| B3 | FIND · THE CONSOLE IN A BOTTLE: the real shell + the real server in one process on a manual clock (the base of B4 / B5) | **the spike: done 2026-11-14 — it is buildable, and it runs** (`tests/client/bottle/`, `npm run test:bottle`, 12 tests, ~1 min): the REAL `App.vue` → `ConsoleShell` (nothing stubbed) against the REAL server's router in one process, on ONE clock (the kernel, GSAP, `Date`, the frames, the server's timers); a seeded walk replays identically; a fast-check search over {press, clock, another seat, reload} finds a planted defect and shrinks it to 3 commands. *Measured limits:* tens of presses per second, not thousands (96 % of the wall is jsdom's selector engine); no layout (a rect, a paint, a CSS end) — that stays the box monkey's. *It already paid:* two product defects found and fixed (a Vue error of a Vapor component was LOST — the handler threw; the reactivity witness went blind after the first game screen of a page). *Open (§3.4):* the sweep of all 606 fixtures, server fidelity (undo, a socket stand-in, held answers), speed |
| B4 | FIND · deterministic replay of an episode (record in the field / box / monkey → replay with no box) | **four replays stand (2026-11-14), and a monkey's finding replays BY ITS SEED** (`tests/client/bottle/monkeyWalk.ts` — the box monkey's stream as a function: `monkeyWalk(bottle, seats, 'fz0:<fixture>', presses)`) — `tests/client/bottle/classReplays.bottle.ts`: each cause class of §4, stood up in the bottle by the presses that produced it (fixture + the other seat's move + the walk's presses on the manual clock) and held to the property its fix established; 13 s for both, red with the fix switched off under EXACTLY the class key the monkey filed. **A walk is a list of STEPS now** (`MonkeyStep`: a press with its pause · the other seats · a reload — `monkeyWalk` returns them, `replaySteps` runs them): the record a shrink cuts and a replay pastes. *Open — and deliberately not built:* a record FILE of a FIELD episode. A field event carries the save's reference (A5) and, since 2026-11-14 night, THE TRAIL — the presses that led to it with their ages (A1+) — which is what a human or an agent reads to stand the class up in the bottle (`bootFixture` of the save + the trail as steps); an automatic `replay(event)` needs the save at the FIRST press of the trail, which an event does not know. It is built when a field class first needs it |
| B5 | FIND · the COMPOSITION checked for liveness (model-based over the bottle) | **stands as the gate (2026-11-14 night):** the property «the console serves the server's question, or says who holds it — no class the baseline does not hold» is checked over the REAL composition (the real shell, the real server) by a seeded random walk on every one of the 606 tables (`npm run gate:freeze`), and a walk that breaks it is CUT DOWN to the steps that make it — **THE SHRINK** (`tests/client/bottle/shrink.ts`: delta debugging over a walk's steps, each candidate replayed on a fresh bottle; `TM_BOTTLE_MONKEY_SHRINK=<class regex>` with `TM_BOTTLE_MONKEY_ONLY=<table>` files `<out>/shrunk/<table>.txt`). The bottle's test 14: a walk of fourteen steps with a planted defect → the plant alone, in 6 replays. **On a real walk** (`fz0:venus-trade`, the stall behind the card arrival): 65 steps → 10 in 120 replays — `Enter · ▲ · Enter · Enter (+7 s) · Enter · Enter · Enter · B · B · B`: the trade's own road, then three B on a screen that takes none. (Its first run died at 4 GB: a bottle disposed inside a test was kept alive by the unit suite's component registry until the test's end — 22 – 84 MB a page; `bottlePage` lets it go now.) **A walk's whole WORLD is its seed now** — the ids, the engine's unseeded shuffles and the page's cosmetic rolls are `Math.random` seeded per walk (`monkey.bottle.ts` § the walk's whole world): a gate that is red on a NEW class may not owe one to a roll. **THE SECOND SEED (`fz1`, 2026-11-15): 606 more walks named 6 classes the baseline did not hold — and TWO WERE REAL**, each confirmed in a real browser and cut down by the shrink to 3 – 4 presses in under a minute: the hand opened over a live placement (the bar named a verb the pad did not have) and the announce «blind» inside the beacon's dwell (§4, both fixed with their replays). The other four are the bottle's own (a first action behind an unmeasurable flight; a frame count) — replayed step for step in a real browser: not one line — and stand in the baseline with their reasons. The baseline is a UNION over seeds now (`seeds: [fz0, fz1]`). **So a new seed is the cheapest finder there is: 37 minutes of a laptop found what 456 box walks and the first 606 bottle walks had not.** *Open:* seeds `fz2 …` as a routine (each a different union of walks); a fast-check model of the DECISIONS (which press where) instead of the pad's weights |
| C6a | ELIMINATE · THE GUARD of the rebuild's completeness: module state is reached by the session's end, or says why not | **done 2026-11-14** — `tests/console/moduleStateGuard.spec.ts` + `moduleStateBaseline.json` (a per-file ratchet): of 1 248 top-level mutable declarations under `src/client`, 647 are written by the teardown, 8 kernel-owned, 39 declared page-lifetime, **554 UNDECLARED — the worklist of the in-page rebuild** (`MODULE_STATE_REPORT=1` prints it by directory) |
| C6b | ELIMINATE · THE LAST LINE at depth `page`: past the ladder's last rung the console session is rebuilt from the server's view — once per question, a few per window | **done 2026-11-14** — `console/session/{sessionRebuild,rebuildBound}.ts`, the arbiter's `LIVENESS_REBUILD_AFTER_MS`; the episode is filed `rebuilt`; `../liveness-arbiter.md` § 3a. Proven on the box (`console-stall-cause`: rebuilt once → served again → the second strand refused; `?rebuild=0` → the player's own reload). **A DEAF screen is covered too** (`presses-no-effect`: due only on the player's next dead press past the spent ladder — `lastLineStep`). *Open:* depth `shell` (needs C6a at zero); the monkey rebuilding at arbitrary presses; the rungs it retires |
| C6c | ELIMINATE · WHO WATCHES THE WATCHER: the last line no longer depends on the thing that may be dead | **done 2026-11-14** — `console/session/supervisorPulse.ts`: a witness OUTSIDE the shell (the app's root, the page's scope) counts the supervisor's COMPLETED passes; a game screen in plain view with none in three looks (15 s) — no shell at all, or a pass that throws — is rebuilt by the same last line under its own cause (`session-rebuild/page/no-shell` · `…/no-pass`, by `pulse`). Counted in looks, never milliseconds. This IS the verdict half of the delivery contract (decision F11: the judge stands in the page, outside the judged). `../liveness-arbiter.md` § 3b; the bottle's test 13 and `console-stall-cause` «who watches the watcher» |
| C · classes | ELIMINATE · class by class (§4 is the worklist) | **four closed 2026-11-14**, each with its law, its guard and its replay / e2e: the Parliament opened beside a held sitting plate · the start shadow's «first action ≠ game» for a minimized first action · the chairmanship wedged by a second A inside its round trip (20 s on «Выполняется») · the screen shadow's `misserved` under a claim's hold. The monkey's baseline holds no other defect class. **PROVEN ON THE BOX BY THE NUMBER (2026-11-14):** the same seed `fz0` on the fixed build over the three tables that named the classes (and two controls) — `records 0 · defects 0 · episodes 0`, against the baseline: **0 NEW · 3 gone · 0 kept** |
| C* | ELIMINATE · the decision layer whole on the kernel (§4, structural 1–5), prompt delivery as a contract (7), native stalls under budgets (8), the last line at depth `shell` (6) | open |
| D | PROVE · the bar as numbers, the release gate | **THE GATE THAT NEEDS NO BOX STANDS (2026-11-14 night)** — `npm run gate:freeze` (§5): the replays of every closed class + the monkey in the bottle over every table + the report against the committed baseline. **Its first pass on the current build: 606 walks, 36 360 presses — episodes 0, never cured 0, NEW classes 0; 146 of 280 declared flows walked (52.1 %), 11 of 13 workspace frames.** **After the second seed's two classes were closed (2026-11-15) the gate ran on seed `fz1` over all 606 tables: GREEN in 48.9 min** — no class the union baseline does not hold, no episode left uncured. Run WHOLE, as one command, twice more that night (the second with every walk's world seeded): GREEN in 37.1 and 37.9 min, the same 217 records and 10 classes each time. The baseline holds 10 classes on 7 tables — every one the bottle's own (a hold behind a flight with no measurable end), each **walked again by the box monkey's spec in a real browser on the laptop with the same seed: 0 records** — and says so row by row (`tests/client/bottle/monkeyBaseline.json`, guard `freezeGateBaseline.spec`). A class missing from the baseline turns the gate red (proven: two rows taken out → `GATE: FAIL — 2 NEW`, exit 3). *Open:* the box's half of the bar (the full proof pass and the perturbed passes — when the box is free), the field's window (`npm run diag -- trend` once a release with part A is played), frame budgets, the cost table |

**NEXT, in this order** (each is a milestone: verify → commit → push → main clone → the neighbour told):
0. ⛔ **Before any box run: is Enshrouded running there?** (the owner, 2026-11-14 — the rule is in the project memory `e2e-only-on-steam-machine`). If it is: no box; the monkey in the bottle on the laptop, pointwise e2e on the laptop with `TM_E2E_LAPTOP_OVERRIDE=1`, the big sets by the owner's CI after the push.
1. **The proof pass — DONE 2026-11-15** (row B0+: 606 walks, 0 defects, 0 NEW · 3 gone). **THE PERTURBED PASSES** run as a detached chain on the box (`node C:/Projects/Mods/tm-fz-tools/box-chain.mjs <worktree> <taskA> <taskB> <wait-file> <pattern> <name>:<KEY=V,…> …` — two lanes under TWO task names, passes strictly one after another, 4 tokens, the Enshrouded rule asked before every pass; log `.e2e-remote/box-chain.log`, each pass summed into `.e2e-remote/<name>/report.txt` against the proof pass): `fzpert-cpu4` (`TM_E2E_CPU_THROTTLE=4`) · `fzpert-net400` (`TM_E2E_MONKEY_NET_MS=400`) · `fzpert-reload` (`TM_E2E_MONKEY_RELOAD=1`) · `fzpert-duo` (`TM_E2E_MONKEY_DUO=1`) · `fzproof-fz1` (the second seed, plain). Every class one of them names is a row of §4 — READ THE `report.txt` FILES FIRST when this work is picked up. In the bottle the routine is a NEW SEED per milestone (`node scripts/freeze-gate.mjs --seed fz2 --skip-replays`, ~40 min of a laptop; a class it names is confirmed in a real browser, then fixed or added to the baseline with its reason).
2. **B2** — the corpus: `monkey-report --corpus` keeps the walks that reached new coverage keys, the monkey replays a kept walk's prefix (its own seeded stream) and diverges; `TM_E2E_MONKEY_REBUILD` (the last line at arbitrary presses).
3. **B4 as a file** — the monkey writes `{fixture, seed, timed presses, other-seat moves}` beside its walk; `replay(file)` in the bottle — a class replays without hand-writing its test. **B5** — the fast-check search of test 8a over every fixture that boots in the bottle (the sweep of 606), the property being `liveness().ok`.
4. **A7** — the release that carries all of this on the box: `TM_DIAG_PROBE=stall` (diagnostics.md § 9.2), read with `npm run diag`.
5. **C · 7** — the delivery contract (§4 item 7): **CLOSED 2026-11-14 by decision F11.** *The IDENTITY half* stands since 2026-11-08 (`ApiWaitingFor`: the poll advertises the prompt the page DISPLAYS — `promptId` = `waitingForSerial` — and a different serial, or none where one was advertised, is `changed` whatever the game age says). *The VERDICT half* is judged IN THE PAGE: the arbiter reads the screen's verdict once a second and owns the last line; the one case it could not see — a page whose supervisor is not running — is the pulse's witness (row C6c). No server-side judge: it cannot answer a page that does not ask, and learns nothing a running page does not know. *Left, optional:* the few-dozen-line formal model of «asked · named · served or rebuilt» (§4 item 7's last bullet) — only if a field event ever shows a question neither judge saw.
6. **C6 depth `shell`** — **NOT BUILT, by decision F12 (2026-11-14):** the last line stays at depth `page`. The module-state ratchet (554 undeclared) stays a RATCHET — a file may not gain one — and is not burned down: a game session is ONE DOCUMENT (every entry into a game and every exit from one is `navigateWithCurtain` — the document is replaced; `navigateInApp` serves the menus only), so no module state crosses a game boundary today, and the in-page remount would only make faster a rebuild whose bar is ZERO.
7. **R16** — *the instrument stands:* `tests/e2e/console-key-trace-probe.spec.ts` (`KEY_TRACE=1`, the laptop: a table walked by a recorded monkey walk under a Chromium trace; for every key event the FORCED layouts are summed by the frames that forced them, mapped to the sources). The baseline's count: **40 long frames (0.56 – 0.94 s) in 36 of 456 walks, 34 of them a key listener** (`onkeyup` 17 · `onkeydown` 17 — after Enter, ▼, B, Y, Q alike), forced layout 60 – 80 % of each. **MEASURED 2026-11-14 night (the laptop, CPU ×4, `colony-trade-hub` by the baseline's own walk — §4 item 8 has the table):** a press is 52 % forced style + layout, but it is NOT a read-after-write thrash and NOT the selectors: one forced pass per mount is the layout the frame owes anyway; the universal-bucket selectors are 11 % of a style pass and all 21 605 non-matching rules together 22 %. What a press pays for is HOW MANY elements it restyles (800 – 1 250 of ~1 400 — the root's state classes reach the whole board) and what it mounts. So the script side has no law to write; what is left of R16 is the BOX's (the compositor at 4K, the effects, frame budgets as a guard) and the field's (`npm run diag -- trend` names the scenes once a release with part A is played). The cost table (the TIMING set, the bundles before / after) — with the proof pass.

**Tree.** The work is done in the worktree `C:\Projects\Mods\tm-fz` (branch `freeze-zero`, `node_modules` is a JUNCTION
to the main clone — remove it with `cmd /c rmdir` before the worktree, never `git worktree remove --force`). Pushed
to `main` milestone by milestone (`node C:/Projects/Mods/tm-arch-tools/push.mjs` from the worktree), then the main
clone is moved onto it (`node C:/Projects/Mods/tm-arch-tools/sync-main.mjs C:/Projects/Mods/terraforming-mars`) — the
owner looks at the main clone. A neighbour session works in the main clone: never commit there by path sweep.

**Specs whose hooks or timing a milestone touched** — §7 (the owner starts the CI read there).

---

## 1. The program on one page

A freeze of this console is a WAIT THAT NOBODY IS OBLIGED TO END (`../architecture-v2/PLAN.md` §1: ownership by name,
waits as predicates, holds as flag pairs, lifecycles on edges, one component arbitrating everything). Three weeks of
point fixes built a dozen nets that cure after the fact; the kernel (scopes · bounded waits · machines with a law) made
the defects inexpressible for what stands on it. What is left is exactly what is NOT on it yet — and the fact that
nobody can say, by a number, how much is left or whether a release is better than the one before.

The program has four parts, in dependency order:

1. **SEE (A).** One episode = one event that names its CAUSE; one cause class = one issue; noise never spends the
   defect's budget; a native stop arrives with its trace; an unhealed stall arrives with its save; one command answers
   «fewer?» per release.
2. **FIND (B).** The monkey knows how much of the kernel's state space it walked and steers at the rest; it perturbs
   time; every finding becomes a replay. Underneath: THE CONSOLE IN A BOTTLE — the real shell and the real game server
   in one process on a manual clock — which is what makes an episode a deterministic failing test and lets a
   model-based search walk the COMPOSITION thousands of times faster than a browser.
3. **ELIMINATE (C).** Every class found gets a law, a guard and a replay; the decision layer finishes its move onto the
   kernel; the ladder of nets collapses into ONE last line — rebuild the console session from the server's view, in
   the page; the question's delivery is a contract.
4. **PROVE (D).** The bar is numbers on a fixed monkey set and on the field window; the bar is a release gate.

**What does not change:** what the player sees (bar the freezes), the product laws of `CLAUDE.md`, the laws of
diagnostics (`.claude/rules/diagnostics.md`) and of the kernel (`.claude/rules/console-flow.md`). No new net as a fix
(R12). Diagnostics never cost the frame they describe (D30).

---

## 2. Part A — SEE

### 2.1 The three concepts

| Concept | What | Where |
| --- | --- | --- |
| **SHAPE** | what a diagnostic line IS, apart from its wording: `wait-graph/ceiling`, `liveness/stall`, `flow/bound`. Every print site of a `stall` / `integrity` family matches exactly ONE row of the shape table; a line no row matches does not ship (the guard fails with the list). | `src/common/diagnostics/shapes.ts` |
| **CAUSE CLASS** | the grouping key of a defect: the shape + the line's STRUCTURAL parts (a workspace kind, a phase, a hold's label, a wait's id without its run number, an admission block) — never a duration, a counter, a prompt id, a card's name. A PURE function of the line: the page, the hub, the e2e harvest and the monkey compute the same key from the same text. | `src/common/diagnostics/cause.ts` |
| **TIER** | what a line is FOR: `defect` (a net acted, a finding names a defect, a bound cut a decision — an EVENT) · `planned` (an honest wait reached its declared ceiling — an AGGREGATE, counted, never an event) · `info` (evidence around an event — a breadcrumb). Declared by the shape's row; a wait's own declaration may lower one occurrence to `planned` with its reason. | the shape table |

**Dimensions** are everything a reader slices by and that must NOT split a class: the source card, the workspace, the
section, the question's type, the holder, the net that cured, the outcome (`healed` · `rebuilt` · `unhealed` · `reload` · `quit`),
the duration bucket, the release, the environment, the profile. They are TAGS of the event.

**Evidence** is what stood at the START (and what changed by the cure): the question and who should have served it;
the holder with its age; the flow tree and the wait table; the wait graph; the arbiter's full lines; the last machine
transitions. Captured ONCE, at the event, by a provider the console session registers with the interceptor (the
interceptor still imports nothing of the console); bounded; scrubbed with the event (every string of an event is
scrubbed by construction).

### 2.2 The liveness episode names its holder

The arbiter's line gains three words the class reads — `task:` (the router's task kind), `top:` (the deepest frame,
`kind:phase`), `holder:` — and the supervisor names the holder by ONE precedence (the first that holds):

`stranded[+claim:<host>:<stage>]` → `dead-frame:<kind>` → `beat` → `awaiting:<from>` → `block:<name>` →
`claim:<host>:<stage>` → `hold:<label>` → `deaf` → `none`.

Class: `liveness/<reason>/<task>/<top>/<holder>`. The evidence is taken BEFORE the first rung runs (a snapshot after
the cure describes the cure, not the cause).

### 2.3 What is sent (the policy by tier)

| | when | as |
| --- | --- | --- |
| `error`, `integrity` | when born | an exception / a message; fingerprint = the stack / the class |
| `stall` · tier `defect` | an episode when it ends (or has stood 30 s); any other when born | ONE event; fingerprint = the class |
| `stall` · tier `planned` / `info`, `perf`, `note` | never | counted in the SESSION LEDGER; the trail of the next event |

Budgets: per CLASS (not per family) and per run; `planned` lines spend nothing. The ledger counts every occurrence —
the frequency of a class is known even when its events were capped.

### 2.4 The session ledger and «fewer?»

The hub keeps one record per app run on disk (start, play time, counts per class and tier, every net's fires, the
episodes with their outcomes and times-to-cure, long frames per screen and phase, renderer stops). It leaves as ONE
event of kind `session` at the next launch (a run that ended in a native stop cannot send its own). `npm run diag --
trend` reads them: stalls per hour of play and per session by release, healed / unhealed / reload shares, the
time-to-cure distribution, the top classes with their trend, the fires of EVERY net (the evidence a net's retirement
needs — `../architecture-v2/PLAN.md` §6).

### 2.5 Native stops, the save, the replay

- `[renderer-hang]` is an event with the Chromium trace attached (the box always; a player with consent, inside the
  attachment budget) and the last screen named.
- An unhealed stall on a hosting device takes the game's save AT THE START of the episode (kept beside the report
  folders; attached on the box) — `npm run diag` fetches it and turns it into an e2e fixture.
- The replay record (B4) rides the same road once it exists.

---

## 3. Part B — FIND

### 3.1 Coverage is the kernel's own state space
The kernel already names its space: the registered machines (`FLOW_MACHINES`) with their states and transitions, the
scope kinds, the `WAITS_ON` pairs, the admission blocks, the frame kinds × phases. A page-side counter (`__conCoverage`)
marks what a session exercised; the monkey unions it per walk and across the run: «N % of transitions walked», and the
list of what was never walked. A walk that reaches something new is KEPT (fixture + seed + press log) and mutated
first — a corpus, like a greybox fuzzer's.

### 3.2 Time is perturbed on purpose
The same walks under: a throttled CPU (CDP), delayed server answers, stretched and compressed motion (`?motion=`), a
reload or an in-page rebuild at an arbitrary press, the second seat's own monkey, the bot. A race that a quiet box
never loses must lose here.

### 3.3 The report is by class
The monkey reads the page's journal (causes included) and files `monkey-report.json`: classes with the first case's
evidence, new against the last run, gone against the last run, fires per 1000 presses per net. A fixed seed set per
release is the controlled denominator.

### 3.4 The console in a bottle (B3) — the keystone of B4 and B5
The shell's composition already runs with no component instance (`useConsoleShell`, S-last) and the client's every wait
stands on one clock (`flowClock`, `createManualClock`); the game server is a library of the same repository
(`testGame`). The bottle is: the REAL shell (its real surfaces mounted in jsdom) + the REAL server in the same process
behind the transport's one door + the manual clock + the pad's one funnel (`dispatchConsoleIntent`). In it:
- an EPISODE REPLAYS (B4): the recorded server answers, presses and animation ends are fed in logical order — the
  same stand, with no box and no chance;
- the COMPOSITION IS SEARCHED (B5): fast-check `commands` over {a press, the clock advancing, another seat's move, a
  reload} against the real server, the property being liveness itself — after every command and a bounded advance of
  the clock, the server's question has a serving surface that accepts, and no net fired — with shrinking to the
  minimal sequence.

What the bottle cannot see is what needs pixels (a measured rect, a compositor) — that stays the monkey's on the box.
The spike decides how much of the shell mounts under jsdom unchanged and what needs a seam.

---

## 4. Part C — ELIMINATE (the worklist)

Sources of classes: the field (Sentry, the owner's exports), the monkey, the bottle, `../wait-graph-inventory.md`
(open rows: A3–A6, P1–P3, P5, H2, W4–W6, W8–W12, R9, R11, R17), `../architecture-v2/PLAN.md` §0 (the open redesigns).
Every class closed gets a row here: the law, the guard, the replay.

| Class | Source | Law · guard · replay | State |
| --- | --- | --- | --- |
| `wait-graph/cycle/announce:parliament:genN/question:parliamentphase/surface:parliament` | B0 (the monkey's baseline, seed `fz0` · `eden-alliance-enact-remote`): the announce plate `parliament:gen1` is PRESENTED while the `parliament` workspace already stands past its commit and serves the very question — plate → surface → question → plate; the screen stood 7 s until the graph's door «announce-serve» acknowledged the plate | **the cause (read 2026-11-14):** the player opened the Parliament from the LT wheel a second before the political phase began (the walk: `…Pass · ArrowRight · Comma · Enter · …`). The sitting's FLOW beat `parliament:gen1` (`parliamentSittingFlowBeat`) was then BORN HELD while its own workspace already stood on stage; a flow's plate has one verb — «open the flow's workspace» — and there was nothing to open, and nowhere to show it (a plate lives on the board). The follow-up door of the question asks the gate (held), the frame waits for its question. The graph's door (`mandatoryController.yieldAnnounceInCycle`) acknowledges it after the cycle is confirmed — and the sitting then runs WITHOUT its own telling (`[ruling-change-draw] the sitting 1:1 never told its enactment — the batch takes the ordinary road`, 22 s later). **The law:** *a flow's beat born while the flow's own workspace stands on stage is acknowledged AT BIRTH* (the idiom the gate already uses for a question that is a step of a standing workspace — `corpFirstAction` in the start flow, the ledger's discard: «a plate in front of a scene that is already standing on it») — an edge of the beat's key and the stage, not a net's timer; **and the sitting has an entry for «already inside»** (its telling without the doors). Only FLOW beats: an interruptive TASK beat over a frame that is concluding must keep its plate (the frame leaves within a second and the plate rises on the board — acknowledging at the edge would skip it). · guard: a unit spec of the edge + the property «no flow beat is held while its workspace is on stage» · replay: the walk above in the bottle (`eden-alliance-enact-remote`, the presses and their gaps are in the baseline's `monkey-walk.txt`), then the box. **FIXED 2026-11-14 at the door:** `consoleMandatoryGate.FLOW_BEAT_WORKSPACE` (total over the flow kinds) + `heldFlowWorkspaceOf`; `workspaceController.enterOrRestoreWorkspace` takes the plate's door (`openMandatoryAnnounce`) when the held flow beat's workspace is the one asked for — the wheel's «Парламент» while «ПАРЛАМЕНТ · Заседание» stands opens the SITTING, told in full. Unit: `consoleMandatoryGate.spec` § a flow's plate; e2e: `console-eden-alliance` test D (the plate stands → the wheel → the sitting stage, the rating born on the seal, no `[wait-graph] cycle`, no untold enactment). *Left to the net (named by it if it ever fires):* a flow beat born while its workspace ALREADY stands — the generation scene takes the screen before a sitting begins, so no road to it is known | **fixed 2026-11-14** — the box: `console-eden-alliance` A – D on both presets and the sitting specs, 17 / 17 |
| `start-shadow/finding/disagree/firstaction/game` | B0 (seed `fz0` · `hydro-terminal-surge`, landing `prompt`): the first press of the walk is B on the start workspace standing on the corporation's first action — the shadow of the start director then reads «expected firstAction, on screen game» for `or:corporationInitialAction` (`firstAct: standing`, no frames, `serves: null`). A shadow observes only: nothing was cured and the walk went on | **read in the bottle in 8 s (2026-11-14):** B there is the designed MINIMIZE («B Свернуть») — the frame leaves the stack, the board stands with the restore card («Вернуться к решению»), A brings the first action back. The finding was the SHADOW's own defect: `actualStartOwner` read «no frame mounted» as `game` before it asked whether the player had set the question aside — and filed a defect event for a screen the player asked for (noise under a real class's name). **The law:** a question the player set aside is `parked` whether or not the start's frame is mounted. · guard: `tests/console/startDirector.spec.ts` · replay: `tests/client/bottle/classReplays.bottle.ts` (red with the fix off) | **fixed 2026-11-14** |
| `screen-shadow/finding/misserved/…` on a question an outcome claim HOLDS for its stage | the neighbour session's trace (CI `console-venus-orbital-survey` «the purchase is EMBEDDED», 2026-11-14): while the card-actions claim holds the purchase question for its own stage (`taskHeldForWorkspace` — rendered nowhere during the executing beat), the screen director's shadow reads the question as misserved — `promptHeldReason` knows no «held by the claim». (The wait graph's half — the same question read as a `dead-end` and reopened under the live claim — is fixed by that session in `shellWaitNodes` / `reopenOrphanQuestion`.) | **the law:** a question an outcome claim holds for its own stage is HELD — by the same two facts the wait graph's question node reads (`taskHeldForWorkspace` ∧ a standing claim), bounded by the claim's own bound. `ScreenShadowContext.claimHeld` + the pure `screenShadowHeldBy` (ONE order: a blind announce is never a hold → the detector's own reasons → the claim → the admission block) · guard: `screenShadow.spec` § held by an outcome claim (with the claim: no finding; without it the same screen IS named) · replay: owed (the bottle: a card action with an embedded purchase) | **fixed 2026-11-14** — the box: `console-screen-shadow-control`, `console-screen-director-cure`, `console-venus-orbital-survey` (A – G), 18 / 18 |
| `animation-hold/ceiling/parliament-chairman-quest` | B0 (seed `fz0` · `parliament-chairman-quest-last-action`, landing `board`): the chairmanship's BLOCKING holds (`parliament-chairman-quest`, `parliament-agenda-bonus-owed`) stood with nothing moving on the page (`[liveness] still hold` at 6 s) until the 20 s safety ceiling force-released them — `{beat: task, answered: true, chairAwaits: true, agendaAwaits: true}`, then `[parliament] chairmanship: the beats outlived their 20 s ceiling — settled without its beats`. Twenty seconds in which the screen owes a story it is not playing | *to read (the bottle: the fixture + the walk's presses)* — the beats await a stage that is not on screen; the law of the same family as TR63's («the claim stands only with the stage»): a blocking hold for a beat exists only while the surface that plays the beat stands — off stage the beat's END STATE is applied at once, the telling is the stage's own when it returns · guard · replay. **Read in the bottle (2026-11-14, 14 s):** the table boots on the plate «A Open the Parliament» (asked `option`); ONE A opens the Parliament (`parliament:committed`), the question is answered within the second (asked nothing) and both holds stand at once with the bar reading «A Performing…» — for the whole 20 s, whatever is pressed; at the ceiling the bar becomes «A Close · B Close». ⚠ the bottle has no layout, and the chairmanship's beats fly between MEASURED figures — there the 20 s may be the bottle's own blind spot (it joins `LAYOUT_BLIND` if so); on the box it was real (`still hold … nothing moving on the page`). **BISECTED in the bottle in 16 s** (the plate's A alone: `done` in 2 s · A then ▼ / B / X 0.9 s later: `done` · **A then A 0.9 s later: the ceiling**) — the bottle is NOT blind here. **The cause:** the answer rides the press that opens the Parliament; the second A is «дожать» (`finishChairmanQuestBeats`) with the answer still on the wire — it killed the reading's own timer and ran nothing in its place (its branch asked for `answered`), so when the answer came `maybeStartSeat` found the reading «not done» for ever. **The law:** a cut step is never dropped — whoever kills a scheduled beat applies its effect (the reading is over by that press; the seat starts when the answer is in; and the gap before the seat, cut by a press, takes the seat at once). · guard: `chairmanQuestReaction.spec` (two tests) · replay: `classReplays.bottle.ts` (red with the fix off: `beat: task`, both holds standing) · e2e: `console-parliament-chairman-quest-last-action` «a second A inside the quest's round trip» | **fixed 2026-11-14** — the box: the whole spec, 7 / 7 |
| `wait-graph/ceiling/scale-step-rating:stage` · `wait-graph/ceiling/card-reaction:rating-story-quiet` (one incident) | the monkey in the bottle (seed `fz0` · `terraforming-deal-start-nodraw`), **confirmed in a real browser** (the box monkey's spec on the laptop, the same seed: both lines, plus `story:owed:scale-step-rating` expired): the rating a scale step owes waits 32 s for «the stage of the scale step rating» that never comes, and the card reaction behind it 12 s for «the touchdown of the scale rating» — both end on their ceilings | **read (2026-11-14):** a prelude played INSIDE the start workspace steps a scale; the step's rating is told on the board, which the player keeps covered by the start workspace while they read — the story is owed, bounded by its due (32 s), and at the due the rating is applied untold: the board's own bounded, ledgered story (invariant 16), and the ledger's line already said `planned` (`"watchable":false`). The wait graph's two lines of the SAME incident were filed as DEFECTS — an event of the quota for the player's own reading time. **The law:** a ceiling says WHY it was the wait's honest end at the moment it comes — `CeilingWait.ceiling(planned?)`, the reason read from the rating's own beat (`scaleStepRatingStageCovered`); with the board in plain view the same ceiling is still a defect. · guard: `ceilingWait.spec` (the line and its tier, both ways) · replay: `classReplays.bottle.ts` by the monkey's own seed (`monkeyWalk.ts`), red with the fix off (`['defect', 'defect']`). **ONE DUE (2026-11-14 night):** the rating REACTOR's own clock (12 s) was shorter than the story's due (32 s) — past it the card paid BEFORE the rating it answers had landed. Its clock no longer runs while the rating's stage is covered (`cardReactionModel.ratingTouchdownStep`, pure): the wait is the story's (a node of its own, `card-reaction:rating-story-covered`, bounded by the story's due), the due ends both, and the reactor's 12 s ceiling is what it was meant to be — a defect on a stage in plain view. · guard: `cardReactionModel.spec` § ratingTouchdownStep · replay: the same walk — ONE ceiling line (the story's, planned), no reactor wait left standing | **fixed 2026-11-14** — the classification and the order |
| `wait-graph/dead-end/question:…` on a question an outcome claim holds | the neighbour session's CI trace (`console-venus-orbital-survey` «the purchase is EMBEDDED»): the purchase the card centre's claim keeps for its stage had no holder in the graph → `dead-end` → the armed door `question-open` reopened it under the live claim and the frame was taken down | **the law:** a question a claim holds waits on the claim's node (`shellWaitNodes`: `claimHoldsQuestion`; `reopenOrphanQuestion` never opens the router's door for it) · guard: `tests/console/waitGraphClaimHold.spec.ts` · `../wait-graph.md` § 2c | **fixed 2026-11-14 by the neighbour session — `4dec517a9c`** |
| `presentation-ledger/witness-heal/view-freshness` | **THE FIELD** (§4b — the commonest «defect» of the owner's exports: 51 lines in 14 of 47, 2026-09-12 … 2026-11-09). Never walked into by a monkey: it takes another seat's move on the socket while a scene of the viewer's plays | **read 2026-11-15:** the poll fetches the newer view while a scene plays; the root refuses to commit it over the scene and PARKS the refresh (`deferredViewRefresh.ts` — re-run on the release edge, bounded by its own 15 s ceiling). The transport's freshness witness did not know: every 3 s of a tile's flight it «healed» — one more fetch, refused and parked again — and printed a defect line. Two nets, one fact (the family of classes 3 and 5). **The law:** a debt that has an owner is not a lie — the witness judges only a lag NOBODY holds (`viewFreshness.viewLagIsALie`: no request on the wire, no refresh parked); its heal now says what the lie is made of (`behind`, `holding`, `prompt`), and a park that runs to its ceiling names the scene whose flag never released (`deferred-refresh/overdue/<scenes>`) · guard: `viewFreshness.spec`, `deferredViewRefresh.spec`, `diagnosticsCause.spec` · replay: `classReplays.bottle.ts` — the socket's word set by hand, the scene's flag raised, the root parks by its own road: six seconds, twice the grace, not one heal; the scene ends, the lag nobody holds IS healed and named. Red with the law off (the heal's line under the park) | **fixed 2026-11-15** |
| `screen-shadow/finding/misserved/board/hand` | the monkey in the bottle's SECOND seed (`fz1` · `parliament-skyscrapers-enact`, `parliament-biodome-enact`), **confirmed in a real browser** (the box monkey's spec on the laptop, the same seed), cut down by THE SHRINK from 65 steps to three: A (the placement's plate) · RT (the wheel) · A (its «Рука») | **read in the bottle and in a real browser (2026-11-15):** the wheels keep working while a cell is picked — a player looks at the hand before placing — and the hand then has the pad by the router's own rule (an open section is asked before the placement; every placement verb is `placementActive && padSection === 'board'`). TWO readers did not know that rule. The COMMAND BAR's ladder asked `placementActive` alone: «Размещение тайла · A Выбрать клетку» stood over an open hand where A acts in the hand (nothing is placed blind — measured: no submit — but the bar named a verb the pad did not have). The SCREEN SHADOW filed «expected board, on screen hand» — a defect event for a look at one's own cards. **The law:** the placement owns the bar only while the pad is on the board (`commandBarController.placementOwnsBar` — one rule for the pad and the bar: an instance of structural item 3); the player's own reversible surface over a live placement is a hold of theirs (`ScreenShadowContext.lateral` → `lateral:<kind>`), B is one press back to the cells · guard: `screenShadow.spec` § the order · replay: `classReplays.bottle.ts` (the three presses: the bar is «Рука … На поле», nothing filed, B is back at the cells with the placement's bar) · e2e: `console-placement-lateral.spec.ts` (a real browser: the bar's copy, no `[screen-shadow]` line, the placement standing through it) | **fixed 2026-11-15** — the laptop: the new spec and the placement set |
| `screen-shadow/finding/unserved/task/nothing` (blind: announce-gate) | the monkey in the bottle's SECOND seed (`fz1` · `two-player-finale-trigger`), **reproduced in a real browser** (the same four presses on the laptop: the finding and the shadow's «cure» both printed), cut down by THE SHRINK from 65 steps to four: → · X («Разыграно», 0.8 s) · B · LT (the wheel, held) | **read (2026-11-15):** a decision's plate stands on the board; each of the player's own surfaces covers it, and the chip's beacon takes over after its dwell (1.2 s — a plate covered for a moment never flashes amber). The screen shadow judged «the announce is BLIND» by three of its 1 Hz looks — and three looks are not three seconds: two covers inside the dwell with 0.6 s of plate between them, which no look fell into, read as «no form for three passes». A defect event — and an ARMED cure that forced a beacon 0.4 s from lighting by itself. **The law:** blindness is measured on the ANNOUNCE's own clock — how long the plate has been gone continuously, stamped where the plate itself comes and goes (`consoleMandatoryGate.noteMandatoryPlate` from the plate's own mount / unmount, and the moment of presentation) — never on a sampler's; a cover younger than the dwell's bound is the announce changing form (`announceIsBlind`, pure). The field lock the check exists for (2026-11-02: no form for minutes) is found exactly as before · guard: `consoleMandatoryGate.spec` § announceIsBlind · replay: `classReplays.bottle.ts` (the four presses: no `[screen-shadow]` line, the beacon lit under the wheel by its own dwell, B brings the plate back; red with the clock off). ⚠ the first attempt put the clock in a sync `watch` of the controller's set-up — it read the shell's computeds before they were wired and SIX replays went red (plates that never stood): a controller's set-up reads no shell computed (the project's own trap, `shell-computed-early-read-latch`) | **fixed 2026-11-15** |
| `deferred-refresh/overruled/<scene>` (was: a view parked for ever) | the audit of 2026-11-15 (no monkey walks into it: it takes a scene's end to be SKIPPED — a throw between a scene's start and its `end*`, a recovery that threw before it lowered the flag; every one of the nine flags can) | **the law:** a scene may hold the view only within a scene's own legal life — the debt of a parked view is bounded by the hold registry's own ceiling; past it the view is committed over the flag, the flag is named and overruled until seen released (`deferredViewRefresh.parkStep` · `scenesHoldingView`); a view committed by another road (a submit's answer) restarts the debt, so a chain of the player's own scenes is never one debt · guard: `deferredViewRefresh.spec` § a scene may hold the view · replay: `classReplays.bottle.ts` (8) | **fixed 2026-11-15** |
| `liveness/stall/unserved/…/view:<holder>` (was: nothing — a healthy screen on «the other seat's turn») | the same audit: whatever keeps a view from arriving (a fetch that never comes back, a commit nobody ran) | **the law:** asked is the SERVER's word — the poll's GO is kept apart from the applied view, and a question the page was never given is unserved like any other: in flight while somebody provably holds it, within the bound; then the ladder, then the last line (`viewDelivery.lookAtViewDebt`, `supervisorController.viewDebtNow`) · guard: `viewDelivery.spec`, `gameTransportPoll.spec` § the server's word, `stallEvidence.spec` · replay: `classReplays.bottle.ts` (9) | **fixed 2026-11-15** |
| a native `alert()` on the game's road (no line at all — the page's script is stopped) | the same audit (`App.update`'s `.catch`) | **the law:** no native dialog on a screen a pad plays; the view's road has one ending for a failure (`viewFailure.ts`) · guard: `nativeDialogGuard.spec`, `viewFailure.spec` | **fixed 2026-11-15** |
| a poll chain that died with its answer (no line at all) | the same audit; `gameTransportPoll.spec` found a live instance at once (`notifyTurn` threw `ReferenceError: Notification is not defined` inside the answer's handler, above the re-arm) | **the law:** the chain's liveness never rides the taking of an answer — a guarantee of the transport's scope stands at every moment of a live chain · guard: `gameTransportPoll.spec` | **fixed 2026-11-15** |
| `wait-graph/ceiling/transfer:touchdown` · `animation-hold/ceiling/parliament-vote-landing` on a page that is NOT IN FRONT | the box monkey's DUO pass (2026-11-16, seed `fz0`: 8 of 152 two-seat tables — always page 0, the tab behind the second seat's, never the other) | **read on the box (2026-11-17):** the first guess — «the tab behind paints no frame» — was WRONG by the page's own lines: it paints, and FREEZES A SECOND OUT OF EVERY TWO (`[long-frame] ~1000 ms … NATIVE`, back to back). GSAP books a frame gap over 500 ms as 33 ms (`lagSmoothing(500, 33)`), so a 600 ms flight gets a fraction of the wall time its bound counts; the bound runs out, the wait ends on its ceiling — as designed — and the line was a DEFECT for a page that was not painting. **The law (stage 1's, first instance): a motion's bound is judged against the MOTION TIME the page gave** — `kernel/frameWitness.ts`: while a motion's ceiling wait or a hold stands, frame gaps are booked the way GSAP books them; less than 75 % of the wall time over ≥ 500 ms is «the page did not give the motion its time» and the ceiling says so — `(planned: the page gave the motion 795 of 1781 ms, 1 frame gap over 500 ms — …)`, tier `planned` (counted, never an event). Only a MOTION is excused (a wait for the server never is); a wait's own reason comes first. · guard: `tests/console/frameWitness.spec.ts` (7) · the real page: the same four duo tables on the box before and after — `defect` → `planned`, with the measured numbers (795 of 1781 ms; 436 of 4005 ms, 4 gaps). *Owed to stage 1:* the monkey's duo opens the second seat as a TAB of the same window, so its first page is always the starved one — a TRUE duo (two windows, both painting) is a row of the matrix, and «a window behind another» stays a perturbation of its own | **fixed 2026-11-17** |
| `presentation-ledger/witness-heal/view-freshness` with nothing holding (`holding:false`, «age +1») | the box monkey's CPU ×4 pass (1 walk of 606 · `parliament-sponsored-eight`); not reproduced in 14 more runs of that table at ×4 | **the law, extended:** a debt being PAID is owned too — the poll that will learn of the change, or the view's own fetch, is on the wire (each bounded by its own law); on a slow page the round trip outlives the witness's three seconds, and a heal then is one more poll on top of the one in flight (`viewFreshness.viewLagIsALie` · `onTheWire`; the heal's line now says `polling` / `fetching`) · guard: `viewFreshness.spec` | **closed by law 2026-11-17** (the next instance, if any, names what was on the wire) |
| `start-stranded/confirmed/or` · `start-shadow/finding/disagree/game/step` | the box monkey's CPU ×4 pass (1 walk of 606 · `hydro-terminal-surge`, not reproduced in 14 more runs there) — then CI's CPU ×4 pass, where a GitHub runner is slow enough: **6 runs of 8** (the monkey's `repeat`, 2026-11-17) | **READ from the whole line (the monkey keeps the start's findings entire now):** the start stands at its preludes with the HAND hosted on it as a step (`start:browse`, `hand:browse`); the press in the hand answers the last question of the start, the server asks the action menu, and the scene's own account names nothing stuck (no hero, no delivery, no reveal, no deck hold). The watchdog's rule «a step left standing past its own prompt serves nothing» read the hand as a strand from that instant — and in half of the red runs the state ended by itself before the shadow's own confirm. It is the hand's LEAVE (the gather back into the dock), which a machine four times slower stretches past 2.5 s — a bound on the wall clock over a step's own bounded episode. Not replayable in the bottle (its clock is ideal). **THE LAW — a hosted step on its own entry / leave is a BEAT** (what the scene already states for its own stages): `startServing.hostedStepServes` (the watchdog — a step that does not answer the live question serves nothing once it is AT REST) and `startDirector.actualStartOwner` (`stepInTransit` — the shadow never judges a transit, and never «cures» a leave that is ending by itself by releasing the start under it). The transit is the hand's own episode (`handRevealState.phase` opening / closing); the watchdog's line carries what the step was doing (`hand: <phase>/<section>`). **PROVEN ON CI by the same measurement:** the watchdog's class 6 of 8 → **0 of 8** with the first half (`5f3ea32118`); the shadow's class then 1 of 8 — the second half closes it. | `startServing.spec.ts` § a hosted step that outlived its question · `startDirector.spec.ts` «a hosted step ON ITS OWN ENTRY / LEAVE is a beat» · CI: `gh workflow run Monkey -f seed=fz0 -f perturb=cpu4 -f shards=1 -f repeat=8 -f only='^hydro-terminal-surge$'` | **closed 2026-11-17** (issue #24) |
| `notifications/starvation/vp-sharesnotification-only` | the box, seed `fz3` · `field-hydro-terminal` (2026-11-17 — a real browser; found while confirming the bottle's fz3 classes): «2 queued events held behind an ANIMATION hold for over 12000 ms — delivering anyway (leaked hold: vp-shares[notification-only])» | **OPEN — stage 1. DETERMINISTIC on the box** (`TM_E2E_MONKEY_SEED=fz3 TM_E2E_MONKEY_ONLY='^field-hydro-terminal$'` — twice of two). Not a freeze (the feed delivers at its bound). *Read so far (2026-11-17):* the other seat's pass (≈ 268 s of the walk) brings a frame that changes the viewer's score; a host claims the share (`vpShareLedger` — held, `notification-only`) and does not fly it while the player walks workspaces over the board — the same walk names `wait-graph/ceiling/remote-placement:watchable-board` (planned): the rival's tile waits for a board the player can SEE, and the share waits behind it. So the wait has the PLAYER in its loop, and two bounds judge one fact: the feed's patience (12 s, «an animation has no player in the loop — a leak») and the ledger's own ceiling (20 s). *The law to write:* the tier is decided by WHO OWNS the wait — a hold that waits for a covered board says so, and the feed's delivery at its bound is then the designed degraded mode (`planned`), never «a leaked hold»; and one fact has ONE bound. **FIXED 2026-11-17 (`d35e6b9f0f`) — stage 1's second law: WHO OWNS THE WAIT DECIDES WHAT THE LINE IS.** The host read by the line itself (`activeAnimationHoldDetails`): `remote-tiles · card:Immigration Shuttles 1`. `AnimationHoldOptions.heldForPlayer` (the dynamic half of `waitsFor: 'player'`) · `playerOwnedHolds()` — every standing hold is the player's, or the wait is a motion · the share ledger's hold is the player's while every share it keeps is a host's whose flight is (`VpClaim.heldForPlayer`; the remote tiles' claim: `waitingForBoard`) · the feed's line has two shapes — `notifications/starvation-owned` (planned) and `notifications/starvation` (the defect it always was). · guard: `playerOwnedHolds.spec` (5) · the real page: the same walk on the box, defect → planned, no defect class left on it | **fixed 2026-11-17** |
| the bottle's FOURTH seed (`fz3`, 2026-11-17): `liveness/oscillating/parliamentphase/board` + `wait-graph/ceiling/quiet:board-beat-settle` (`parliament-marsfirst-budget-vote`) · `liveness/stall/presses-no-effect/handselect/colonies:committed/block:card-arrival` + a foreground-watchdog expiry (`field-hydro-terminal`) · `liveness/stall/presses-no-effect/externaldraw/parliament:committed/deaf` (`parliament-climate-enact`) | the bottle only — the same three tables walked by the box monkey's spec with the same seed in a real browser: NONE of them | **THE LOOP, READ (2026-11-17):** shrunk from 65 steps to 12 (`LT · ▼ · A · A · A(+1.9 s) · ▲ · A · B · A · LB(+4.3 s) · B · A`) and sampled every 250 ms in the bottle — it is a REAL loop of the product's own making, not a judge's mistake: the reveal band (`.con-reveal--scene`, mode `drawn`) MOUNTS FOR ~250 ms AND LEAVES, every 1 – 2 s, for as long as it is watched, under the sitting's question on the board — and at twenty untouched looks the judge asked the last line (`[session-rebuild] page — «parliamentPhase» … the picture turned in a loop for 20s`): the FIRST loop the judge ended that nobody planted. The line now names what turns (`oscillationTurns`: «surfaces … ⇄ … · focus …»). What starts it in the bottle is the blind arrival (a drawn card's flight never lands: `admission:host:card-arrival` runs to its bound) — a real browser lands it, so the walk is clean there. **OPEN (stage 2):** the reveal's presence (`revealController.consoleRevealMode`) and whatever takes it down each time are two decisions about ONE batch that disagree while an arrival is held — the «presence latch» family; a real page whose arrival is held for another reason would turn the same way. Until it is read to its cause the class stays OUT of the baseline (the gate is red on seed `fz3` — honestly). **CI, 2026-11-17 (run 44081560136): `fz0` GREEN · `fz1` RED on the SAME class on another table (`parliament-skyscrapers-enact`) · `fz3` RED on its four — the bottle on CI names exactly what the laptop names.** The `fz1` red is NOT a regression of the day: the same walk names the loop at `47ebdb86b7` and at `2d23b23a23` too (a `git bisect` first blamed a commit that touches no product file — its «good» end was never good), while the gate of 2026-11-16 on that very code was green. So the loop stood then and the judge did not see it: a band that is up for 250 ms of every 1 – 2 s, looked at once a second, is seen or missed by the PHASE of the look — the lesson of the blind announce again («three looks are not three seconds»). **Owed (stage 1): the loop is counted on the surface's own EDGES (its mounts and unmounts), never by a sampler** — then no phase can hide it and no phase can invent it. **Owed first (it keeps two of three seeds red): the reveal's blink itself, read to its cause.** ⚠ That pass was NOT WHOLE: both shards ran out of a 4 GB heap at walk 168 of 303 — the gate now cuts a pass into more processes than run at once (`--shards 6 --parallel 2`) and a dead shard is RED; why a bottle's page is not let go (~24 MB a walk) is a tail of its own | **the loop: closed 2026-11-17 (the next row)** — and with it the other three classes of this seed: they were the same loop seen by other nets |
| `liveness/oscillating/parliamentphase/board` — THE BLINKING REVEAL, read to its cause (issue #18) | the gate's seeds `fz1` (`parliament-skyscrapers-enact`) and `fz3` (`parliament-marsfirst-budget-vote` and, as its consequences, `field-hydro-terminal` · `parliament-climate-enact`) | **THE CAUSE, read by printing every term of `consoleRevealMode` at each flip:** the one term that turns is `deckDrawHolds()`. The deck-draw scene claims a drawn batch and closes the reveal's gate; with nothing to deal from it ABORTS (the bottle: no deck anchor — on a real page any abort: a deal that cannot start inside its window, a stall, the scene's safety); the abort clears `stagedEventId` (it must — the overlay unveils on it), and `stagedEventId` was the ONLY thing that told the entry decision «this batch has had its scene» — so the same batch was CLAIMED AGAIN, the gate closed again, the scene aborted again: the band up for a quarter of a second of every second or two, the deck counter flipping with it, until the last line rebuilt the page. Not a property of the bottle: «the stock modal shows at once» is what an abort promises on any page. **THE LAW: a batch's arrival is decided ONCE — claimed, somebody else's, or GIVEN UP** (`consoleDeckDraw.deckDrawState.gaveUp` — an id is only ever added; forgotten with the game screen, like the «somebody else flew it» memory, because a batch id is a small number counted per game). **…and the loop is counted on the picture's own EDGES** (`supervisor/surfaceEdges.ts`: every mount and unmount of a surface of the arbiter's picture, counted as the DOM changes; `livenessOscillation.ts`: a look that finds the picture it found before, with two or more edges in between, saw a ROUND TRIP — a flip like any other): no phase of a look hides a loop, none invents one. | `consoleDeckDraw.spec.ts` (a batch given up is never claimed again — by an abort, by the deal's start window; a clean end and a given-up batch are both final) · `livenessOscillation.spec.ts` § counted on the picture's own edges (a band that comes and goes between the looks; whatever the phase; one re-home is not a loop; a single edge is never counted twice) · `classReplays.bottle.ts` «a drawn batch whose deck scene gives it up» — the gate's whole walk on its seed: RED with the memory switched off (`liveness/oscillating/parliamentphase/board`), green with it; the gate on the four tables: `fz3` three GREEN (13 classes gone), `fz1` no loop. ⚠ The shrink had answered «the recorded steps do not name the class again»: its replay waited 14 s where a loop needs the walk's own last word (25 s) — it waits that now. | **closed 2026-11-17** |
| `animation-hold/ceiling/parliament-reward-owed` — «"parliament-reward-owed" held for over 35000ms … (leaked hold?) — owed: blue:city-tier:effect:reaction, flying: none» | the gate's seed `fz1` · `parliament-skyscrapers-enact` — UNCOVERED by the closing of the loop above (the last line used to rebuild the page at twenty seconds, before this hold's ceiling) | **READ (the ledger's own trail on that walk):** the sitting stands on its VERDICT (`parliament:verdict`), the server asks this seat, the seat has a sheet of its own open over the stage — and the reward the law paid (seeded on screen, with the winner's city) is owed with nothing in the air: the walk that flies it stands on the player's press. Thirty-five seconds of the player's reading, and the ceiling's line said «leaked hold?» — a defect. Nothing leaked: the release at the ceiling is the ledger's own designed end («the counters tick, honestly late»). **THE LAW OF STAGE 1, APPLIED TO THE CEILING'S OWN LINE — who owns the wait decides what the line is:** the ceiling asks the hold itself first (`heldForPlayer`, said in the present tense with its reason — `animationHold.ceilingWhy`): `(planned: the hold waits for the player — …)`; then the page (the frame witness); the old suspicion only when neither is true. The ledger says so exactly while it is true: records OWED, none in the air, and the server asking THIS seat as of the last commit (`parliamentRewardState.seatAsked` — the seeder runs in every commit's block). A record in the air is a motion, and a ceiling over that is the defect it always was. | `playerOwnedHolds.spec.ts` «THE CEILING'S OWN LINE» (a hold that waits on the player ends PLANNED with its reason — `animation-hold/ceiling/<label>` tier `planned`; the same hold as a motion ends «leaked hold?», a defect) · the gate on the table: `fz1` GREEN | **closed 2026-11-17** |
| CI's FIRST full monkey passes (2026-11-17, a real browser on GitHub's runners · 606 walks each): **plain `fz0`** (run 44085588741) — 1 NEW `wait-graph/ceiling/start:reactor-face` (`field-start-sbp-triton`); **`fz0` × cpu4** (run 44085603578) — 3 NEW: the same `start:reactor-face`, `start-stranded/confirmed/or` and `start-shadow/finding/disagree/game/step` (both `hydro-terminal-surge`), and walk shard 5/16 failed by the harness's own guards | the box's proof pass named none of them: a GitHub runner is a SLOWER machine than the box, and that is the point of running there | **OPEN — stage 1.** ⚠ `start:reactor-face` is a row of the bottle's `LAYOUT_BLIND` («the bottle has no layout») — a REAL browser has now named it, so the row no longer excuses the class: read the reactor face's wait on a slow machine. `start-stranded` under CPU ×4 is now REPRODUCIBLE (CI, the same table as the box's one-off) — the start in `ceremony` under a `hand:browse` frame | each is an issue of the queue (`docs/claude/ci-findings.md`), filed by the run that names it |
| `wait-graph/ceiling/start:reactor-face` · the walk failing on `[reaction] foreign face — stacked-faces: Proteus+Greens at rise:Greens (two layer faces overlap 100 %)` | CI's CPU ×4 pass · `field-start-sbp-triton`: **8 runs of 8, both** (the monkey's `repeat`, 2026-11-17); the ceiling alone 1 walk of 606 on CI's plain pass; the box never | ONE scenario: a card reaction of the corporation on the START's shelf under a slow machine — the reactor's face is waited for (`ConsoleStartScene.startReactorFace`, budget + an 8 s ceiling) and does not come, and the chain's rise finds two faces stacked. Deterministic under CPU ×4, so it is an ORDER, not a chance: read which of the two comes first there (the face's arrival — the seat flight / the deal's hold — against the reaction's rise). **What the run's own evidence says (2026-11-17, `.ci/rep8` — the walk's console tail and its failure screenshot):** a THREE-seat table; the ceiling comes 8 s after the start asked for Proteus's face (`standsIn` = «the ceremony carries the card» — it does NOT ask whether the scene PAINTS: a start that yielded to its colony step, or that the player set aside, has no face to show, and `live()` extends only the budget, never the hard 8 s); fifteen seconds later, with the viewer's start over and the other seats still in their preludes, the board stands with Proteus's face raised at the reaction stage and the ruling party's rise lands on the same spot («stacked-faces … overlap 100 %»). **MEASURED SINCE (CI, CPU x4, 8 runs each):** the stacked faces are CLOSED — a rise that comes back after a cut seats nothing (`2074f161eb`, issue #32: the walk's failure 8 of 8 -> 0 of 8). The ceiling is NOT: «the scene has yielded, so it paints no face» was a GUESS — the rule it led to (`startOffersReactorPlace`: a start that does not paint is no place, `73731a580e`) is true by itself and changed nothing here, 8 of 8 still. So the scene is NOT yielded when it claims the reactor; the ceiling's line now carries WHY no face is visible (`ArrivingFaceWait.whyNot` -> the node's detail: what the seat and the shelf's slot show, the scene's mode, what the seat receives) — read THAT before the next hypothesis. **AND THE LINE SAID IT (4 runs of 4, the same words):** «seat none; shelf hidden; scene ceremony; seat shows Experimental Forest, receives nothing; arriving false» — the corporation's face lies on the shelf «РАЗЫГРАНО», and the scene itself has PUT THE SHELF AWAY: an embedded step of ANOTHER card spans the row and that card presides in the seat. Nothing brings the corporation's face anywhere until the player ends the step — the framework's own law for a receded card («nothing is coming, the stage is right at once»), which the start's promise overrode. The rule: `startOffersReactorPlace` takes `putAway` (`ConsoleStartScene.startReactorPutAway` — the card's slot mounted and hidden, another card in the seat, nothing arriving). (⚠ The line's «did not come in 8000 ms» is the NODE's bound: with nothing live the wait itself ended at its 2.4 s budget.) Two questions to answer in order: (1) is the start painting when it claims the reactor — if not, whose place is honest; (2) why a face that rose at the stage is still standing when the next reactor rises there (the lifted face that never settled — the `liftedFaces` map is the start's, the stage's own settle is the chain's). ⚠ `start:reactor-face` is a row of the bottle's `LAYOUT_BLIND`: a real browser names it, so that row no longer excuses the class | **closed 2026-11-17** — both halves by measurement on CI (CPU x4, 8 runs each): the stacked faces 8 of 8 -> 0 of 8 (`2074f161eb`, issue #32), the ceiling 8 of 8 -> 0 of 8 (`27d46f1e77`, issue #25). Specs: `cardReactionDirector.spec` «A RISE THAT COMES BACK AFTER A CUT SEATS NOTHING» · `consoleStartScene.spec` «the start offers itself as a place only where a face can stand» |
| THE MATRIX, FIRST CELLS ON THE CODE OF 2026-11-17 (CI, real browser, seed `fz0`, 606 walks each): plain — **0 defects** · CPU ×4 — **0** · CPU ×6 — **0** · net 1500 ms — **1 NEW: `workspace/beat-rollback/parliament/executing/committed`** («parliament» goes back executing → committed — its answer did not land (refused)) on `parliament-climate-enact` | the monkey's net 1500 pass (run 44190944902, issue #39) | What the walk shows: another seat plays a card, this page still shows the old question for a second and a half, A in the Parliament is answered 400 and the beat's lease puts the frame back — the lease working as designed, said as a defect. WHICH refusal it was the line did not say: «the question had moved on» (`#stale-prompt`) is the designed recovery, an unnamed refusal of an answer the page offered is a defect upstream (invariant 2). So the evidence first: the settle carries the server's own error id (`SubmitSettle.why` — read before the refusal is declared), the line prints it, and its tier is decided by it (`#stale-prompt` → planned; anything else stays a defect). Measure on CI: `gh workflow run Monkey -f seed=fz0 -f perturb=net1500 -f shards=1 -f repeat=8 -f only='^parliament-climate-enact$'` and READ the id | **closed 2026-11-18 by measurement** — CI, net 1500 ms, 8 runs of 8 the same words: «its answer did not land (refused: #stale-prompt)» (run 44209211905, `99ed096ae7`): the designed recovery, counted as planned (issue #39) |
| `animation-hold/ceiling/generation-scene` — «"generation-scene" held for over 35000ms … (leaked hold?) — {phase: income, generation: 0, pending: false}» | the gate's SEED OF THE DAY (`d20261118` · `palladin-short`, 2026-11-18 — the first night the daily seed ran; `fz0` `fz1` `fz3` all GREEN the same night) — issue #40 | **READ by tracing the scene's own steps on that walk:** «seed: armed, phase was idle» — and never «flights». ONE response detected the scene and armed it, and did not commit (staged behind the bot's turns and overtaken — its closure never ran); ANOTHER response's commit ran the seed, which asked only «is a scene armed?»: the phase went to `income`, the scene's BLOCKING hold stood up in front of the next prompt and the feed, and the flights that end it belonged to a response that was not coming — thirty-five seconds of nobody's wait, ended by the registry's ceiling. Not the bottle's: nothing here needs a layout. **THE LAW: a scene belongs to the response that detected it.** `seedGenerationIncomeHold(before, after, event)` takes what the COMMITTING response detected: another response's commit never starts the scene — an arm that never began is over (`superseded`: no phase, no hold), a scene in the middle of its own phrase is left alone; the transport passes its own event through `seedRewardHolds`. | `generationScene.spec.ts` «ANOTHER response's commit never starts the scene» · «the response that armed it, committing itself, plays it as it always did» · the gate on the table: GREEN | **closed 2026-11-18** |
| `start-stranded/confirmed/space` — «the start serves nothing while the server asks «space»» {placementBlock: table-answer, frames: start:committed, firstAct: performing · Poseidon} | the gate's seed of the day (`d20261118` · `hydro-floodgates-mix`) — issue #41 | **READ from the line:** the corporation's first action placed its colony, the corporation ANSWERED (a card reaction on stage), and the server's next question — a placement — is held behind that answer by design (the admission's `table-answer`: «a decision comes to the screen after the reaction, once»). The watchdog asked whether a BLOCKING hold stands or another surface serves, found neither (a reaction chain is not a blocking hold), and at 2.5 s named a strand over a reaction that was still being told — on a real page too, whenever a chain's telling is longer than the confirm. **THE LAW (stage 1 — who owns the wait): a question held behind the table's answer is a beat in flight** — bounded by the chain's own hold and ceiling (a chain that waits on something long of its own drops the block by its own definition, `cardReactionTellsTableAnswer`). `startController.startStrandedNow`: `servedElsewhere` reads `admissionSignals.tableAnswer`. | the gate on the table: GREEN (the walk leaves no class) · the bottle's suites | **closed 2026-11-18** |
| THE TWO-WINDOW PASS (CI, `duo`, seed `fz0`, 606 tables, 2026-11-18 — run 44211073569): `wait-graph/dead-end/surface:card-actions` · `wait-graph/dead-end/admission:host:reveal` · `wait-graph/dead-end/claim:hand` · `notifications/starvation/hand-open…` · `…/resource-transfer…-vp-shares…` · `…/vp-shares…-ma-ceremony-own…` · `start-stranded/confirmed/or` (issue #24 reopened) + a walk failed on it | the monkey's `duo` — the second seat walks its own page, which stands BEHIND the first (issues #44 – #50, #24) | **SIX OF SEVEN ARE ONE FACT — stage 1's own sentence, «a hidden / starved page is a state the judges know»:** the page behind paints a frame a second or none; no motion ends there, no transition finishes, no press comes — and the judges that read the whole screen once a second took it for a page that broke (the wait graph: «a press cannot come»; the feed: «leaked hold»). **THE STANDING WITNESS OF THE PAGE'S OWN PAINT** (`kernel/frameWitness`: `standPagePaintWitness` · `notePageLook` · `pageStarvedNow` — one watch while the game screen stands, rolled at every look of the supervisor, the same arithmetic as every motion's watch): on a page that is not painting a press owed and a visible motion are not dead ends (`waitGraphModel.externalCanCome` — a wait on the SERVER stays the server's), and the feed's starvation escape says `(planned: the page gave the motion …)` (`notifications/starvation-page`, counted). A page that PAINTS is judged exactly as before — the bottle's suites still find every dead end. The seventh (`start-stranded/confirmed/or`, hostBlock `table-answer`) ran on the code before `215f35342b` — the table's answer in flight is already a beat. | `frameWitness.spec.ts` «THE STANDING WITNESS» · «the feed's line on a page that does not paint is PLANNED» · `waitGraphModel.spec.ts` «on a page that is NOT PAINTING» · CI: `gh workflow run Monkey -f seed=fz0 -f perturb=duo -f shards=1 -f repeat=4 -f only='^(red-lawyers|recruitment-no-reserve|septem-win|parliament-live-outcome|venus-trade-unity-bonus-2p)$'` (run 44229047077 — its verdict closes the row) | **closed 2026-11-18 by measurement** — run 44229047077: 20 walks of the five tables under `duo`, no defect class, no failed walk; the feed's line there is `notifications/starvation-page` (planned), the dead ends are gone (issues #44 – #50, #24) |
| `wait-graph/overdue/flow:chairman-quest` — «overdue flow:chairman-quest (chairmanQuest) — past its 30 s bound — standing 32 s» | THE BOX's first pass of the night (`fz3`, plain, 606 walks on the GPU machine — the only defect class of that pass) · `arwind-chairman-quest` | **READ in the code the line names:** the quest stands on the table's QUESTION («ОТВЕТ СТОЛА» — where the step's unit goes): the pick is the player's, and the director lets its hold go for that very reason («no animation hold stands over a decision») — while the flow's wait source still said «a motion, thirty seconds» for every beat that is not `done`. **WHO IS WAITED FOR DECIDES THE WAIT:** `chairmanQuestFlow.awaitsPlayer` (the seat's pick, the table's question — mirrored from the director's own two flags) makes the wait the PLAYER's: unbounded, a dead end only when nothing on screen accepts the press; the beats in between stay the flow's bounded motion; the node carries its beat as `detail`, so the line names where it stood. | `chairmanQuestFlow.spec.ts` «the quest as a wait» · CI: `gh workflow run Monkey -f seed=fz3 -f shards=1 -f repeat=4 -f only='^arwind-chairman-quest$'` | closed 2026-11-18 (the CI repeat confirms) |
| THE MATRIX HAD NO «HIDDEN TAB» — the stage's exit names it, and no pass walked the first player's own page going behind another and coming back | the stage's own exit row (§ 8), read against the monkey's knobs | `TM_E2E_MONKEY_HIDDEN=1` · `perturb=hidden` (Sunday 19:13 UTC): ≈ 1 press in 30 the page goes behind another for a seeded 3…20 s and comes back (`consoleStart.awayFromConsole`); the walk's log carries the page's own word — `AWAY(<ms>·<visibilityState>·starved|PAINTING)`, read off `__conWaitGraph().pageStarved` (the state the judges read). A spell logged PAINTING was no perturbation. | `e2eDriverGuard.spec.ts` (no new sleep, no frame clock in the driver) · CI sample run 44240483948 | **the first form was found out by its own log** — CI's sample (run 44240483948): 60 spells of 101 logged PAINTING, `visibilityState` `visible` in all; the whole `fz0` cell walked that way (run 44243952510, 0 defects) proves nothing. **Remade IN the page** (`tests/e2e/pageAway.ts`, `c4d08a6269`): the frame queue is held, a hidden tab says so — the bottle's stream, number for number. Open: the sample on the new form (run 44256570677), then `fz0` · `fz1` · `fz3` |
| THE JUDGE's OWN CLOCK — `wait-graph/overdue/*` measured `now - since` whatever the node bounded | READ in the code while the `hidden` perturbation was being built (stage 1's first sentence, not a walk's line): `waitGraphModel.judgeWaitGraph` | **A BOUND ON THE CLOCK OF THE THING IT BOUNDS:** `boundClockOf(node)` — a wait for the SERVER alone runs on the wall clock (the wire does not sleep with the window); every other wait (a motion, a press, a wait on other waits) runs on the PAINTED clock. The registry books the span of every tick taken on a page that is not painting (`WaitWorld.pageStarved`) to every wait that stood through it (`WaitNode.unpaintedMs`, keyed by the run `id@since`, session state `wait-graph-unpainted`); `stoodOnBoundClock` is what `overdue` reads. | `waitGraphModel.spec.ts` «a bound over a motion runs on the PAINTED clock…» · `waitGraph.spec.ts` «a motion's bound does not run while the page does not paint» · the `hidden` pass on CI (`gh workflow run Monkey -f perturb=hidden`) | closed 2026-11-18 (code + specs); the `hidden` matrix cells are the measurement |
| THE BOTTLE WALKS THE PAGE NOBODY LOOKS AT — `TM_BOTTLE_MONKEY_HIDDEN=<n>` (the `hidden` perturbation, deterministic, on the laptop) | the CI cells of `hidden` stood in the account's queue for hours; the bottle answers in half an hour | `BottleClock.advanceUnpainted` — no frame runs (queued `requestAnimationFrame` callbacks stay queued), a timer wakes on a whole second; `bottle.away(ms, hidden)` — `hidden` says so through the document (`visibilityState` + `visibilitychange`), `behind` does not; `monkeyWalk` `awayEvery` (its own stream `<seed>:hidden`, a step `away` — replayed and shrunk like any other). **AND THE GATE NO LONGER SAYS GREEN OVER TABLES NOBODY WALKED:** a walk the bottle could not make (`status: 'harness'`) is RED «N table(s) were not walked» (14 of 20 walks of the first slice died on the harness's own line under a green gate). | `consoleBottle.bottle.ts` «4a · a page that is NOT PAINTED» (the clock, GSAP, the document, the page's own word) · the pass: `TM_BOTTLE_MONKEY_HIDDEN=30 npm run gate:freeze -- --seed fz0 --skip-replays --shards 9 --parallel 3` — 606 walks, 35 147 presses, **5 NEW classes on 6 tables**, each a row below | closed 2026-11-18 (the instrument) |
| `notifications/correlation-ceiling/unknown-no-holders-in-the-last-read` — «correlation 9 stayed open for over 90000ms … held by unknown» | the bottle's `hidden` pass (`fz0`) · `parliament-heat-enacted`, `parliament-biodome-recap` — and NOT the perturbation's: the same table walked plain with a long last word names it too (the away spells only made the walk long enough to meet the ceiling) | **READ in the page's own passes** (`msgs=6 events=0 … preparing=[9]` from the seed on): THE STREAM-SKEW GUARD. A table restored with a journal and an empty event stream (in the field: a game loaded from its save) gives the guard «a header whose chain has no events — maybe the pair of reads is skewed» on every pass, forever: the header stood in PREPARING for the whole ceiling and was then presented, a minute and a half late, as news. **A SKEW LASTS ONE PAIR OF READS** (`skewBook`): the reads after the first sighting were made after the header was read — a chain still event-less in `SKEW_CONFIRM_READS` of them has no events. A live hold then releases; a hold that began at the silent seed was old news and is dropped (unless the previous session's ledger says it was never delivered). The ingest's books are declared session state (`notification-ingest` — the file's undeclared module state 4 → 0). | `consumerDeliverySequences.spec.ts` G1c · G1d · G1e (red with the settle off) · the bottle: both tables, plain and `hidden`, a 100 s last word — no line | closed 2026-11-18 |
| `notifications/correlation-ceiling/prompt:projectcard@blue` — «correlation 21 stayed open … (leaked open chain?) — held by prompt:projectCard@blue» | the bottle's `hidden` pass · `field-start-sbp-triton` | **READ off the server's own answer** (the chain's journal, its events, its holders): Ecology Experts' play, open on the viewer's own «play a card» step, unanswered for a minute and a half. **WHO HOLDS IT DECIDES:** a chain the server names as held ONLY by a player's prompt is that player's time (the action menu never carries a chain — `Player.takeAction`); released at the ceiling its card would present half a story and freeze, and what the answer pays afterwards would have no channel. It stays held, said once per ceiling as PLANNED (`notifications/correlation-player`, the holder by name — PL-297's evidence is kept); a chain held by a deferred action, or by nobody, is released as before. | `notificationState.spec.ts` «a chain held ONLY by a player's prompt…» · the bottle: the table names the planned line, no defect | closed 2026-11-18 |
| `wait-graph/overdue/admission:host:presentation` — «host held by presentation — past its 35 s bound — standing 58 s» | the bottle's `hidden` pass · `price-fold-bot-second` | **READ on the page:** the bot's turn card («Turn finished · MarsBot · You lost plants −5», flow-holding) stands on screen; its lifetime in the product is the END OF A CSS ANIMATION (`ConsoleNotificationCard.vue` `@animationend`), and the bottle runs none — the card never expires there, and a walk made longer by the away spells meets the bound. (My first reading — «the player has the turn review open» — was WRONG by the node's own target and was taken back: evidence first.) THE BOTTLE'S BORDER, not the game's — and the stage's exit says the blind list only shrinks: owed is a stand-in for a CSS animation's end on the bottle's clock (`bottleDom.ts`), which will also let every bottle walk past a holding card as a browser does. | **THE STAND-IN** (`bottleDom.ts` § CSS lifetime): an element standing in the DOM with an INLINE `animation-duration` gets one `animationend` that long after it was first seen, on the bottle's clock, in a frame (on a page that is not painted the end waits for the page to come back); never when it left or is not displayed. `consoleBottle.bottle.ts` «4b». THE TWO WHOLE PASSES ON IT (seed `fz0`, 606 walks each): plain — GREEN, 0 NEW against the baseline; `hidden` — GREEN, 0 NEW (the five classes of the first pass are gone; what is named is the baseline's own five). | closed 2026-11-18 — the blind list did not grow |
| `start-shadow/finding/held-long/game/beat/played-hero` (`field-start-deploy-param`) · `start-shadow/finding/disagree/queue/step` (`venus-trade`) | the bottle's `hidden` pass | **READ in the walk, step by step:** both findings were confirmed IN THE MIDDLE OF A SPELL AWAY — a card's play scene holding the action menu while the page stood behind another window (the scene cannot end there), a step still leaving while the tab was hidden. The shadow's ten and three seconds ran on the wall — and a confirmed finding is CURED (`runStartDirectorCure`): a healthy scene would have been taken down for the player to come back to. **THE CONFIRM RUNS ON THE PAINTED CLOCK:** a confirm that comes due over a span the page did not paint through (`watchFrames().starved()`) is no evidence — it starts again and judges the screen the player is looking at (`startShadowLog.unpainted` counts them). | `classReplays.bottle.ts` «the start's shadow does not judge a span the page did not paint through» × 2 tables (red with the re-arm off) | closed 2026-11-18 |
| THE BOX's TWO-WINDOW PASS (`fzn-fz0-duo`, 606 walks, 68 400 presses — on the snapshot of 00:48, BEFORE `01cf52b6b3`): 8 classes | the box, 2026-11-18 09:15 UTC | seven are the family the page's own paint closed (`notifications/starvation/*` × 3 · `wait-graph/dead-end/*` × 3 · `start-stranded/confirmed/or`) — the page behind, starved to a frame a second (`[long-frame] 1016ms — NATIVE` every second of its walk), read by judges that did not know it yet. THE EIGHTH is an EPISODE: `liveness/stall/presses-no-effect/externaldraw/parliament:committed/deaf` on `parliament-climate-enact` — the FIRST seat's page (the one behind), the server asking `card / externalDraw` under `parliament:committed`, nothing serving it, three presses, 21 s, the ladder to `phase-root-park`, «recovered after 24 s». | the same table, seed and perturbation on the CURRENT code (`3c436df80c`, the box, `--repeat-each=4`): 4 of 4 clean — no record at all, the page behind still starving (36 long-frame lines in a walk) | **not reproduced on the current code**; the whole pass again on it is queued (`fzn2-fz0-duo`). If it comes back there: the arbiter is the one judge that still does not read `pageStarvedNow`, and a duo harness whose second seat is a TAB of the same window presses a page no player could press (two seats are two windows) — both are written here so the next reader does not start from zero |
| `transfer/surface-folded/birth/stock/titanium` - «surface folded under its token — the birth of stock:titanium off div.pcard.pcard--theme-resolution (section.con-parl.con-ws faded)», and the walk failing on it (issues #52, #53) | CI's `fz3` · CPU ×4 · `arwind-sitting-win-solo` (run 44280240959); the box, the same seed and throttle: 2 of 6 | **READ in the transfer's own trail** (the walk now files the page's state when this line fires): the reward's take is `[steel, titanium]`; run 4 flies the steel (born painted, landed 43704), run 5 starts 50 ms later and its token is born UNPAINTED. The Parliament pays IN TURN — a run a wave — and between two waves its surface carries no registered token: the B owed since the steel left (`collapseWorkspace` waits on `surfaceClear`) ran in that gap. **A SERIES OF RUNS IS ONE DEBT OF ITS SURFACE:** `oweSurfaceTokens(host, surface)` / `settleSurfaceDebt(host)` — the host says once that it has taken a series, and `surfaceHoldsTokens` answers for it until the last record has landed (or the take was flushed); the Parliament's reward declares its take (`takeOwedRewards(surface)`). Every fold that asks `surfaceClear` is covered at once (the collapse, the conclusion). Another host that pays in several runs would name the same class — it declares its series the same way. | `transferSurfaceClear.spec.ts` «a host that pays IN TURN holds the surface between two of its runs» · `parliamentRewardBeat.spec.ts` «the surface the waves leave is held from the take to the last landing» · the box, the same table under CPU ×4: 10 of 10 clean (2 of 6 before) | closed 2026-11-18 (the CI repeat is the proof the issue names) |
| `wait-graph/cycle/announce:parliament:genN/question:parliamentphase/surface:parliament` — IN THE FIELD (Sentry `TERRAFORMING-MARS-T`, the box, release 1.2.3327): twice in one game of the owner's, generations 1 and 3 — «cycle … standing 2 s», then «cure cycle … through «announce-serve» — acknowledged parliament:gen3 — «parliament» stands and serves it in place» | Sentry, 2026-11-18 13:34 and 13:46 — the road the row of 2026-11-14 above left to the net («a flow beat born while its workspace ALREADY stands — no road to it is known») | **READ in the kernel's trace of the event:** `open frame:parliament#78` 3.3 s before, in `browse` — the player opened the Parliament from the wheel while the last seat finished the generation; then the sitting's question arrived, its flow beat was born HELD inside its own workspace (nothing to open, nowhere to show a plate), and the screen stood until the graph confirmed the cycle and its door acknowledged the beat. **THE LAW WRITTEN THEN, NOW BY CONSTRUCTION:** `consoleMandatoryGate.flowBeatServedInPlace` — a held FLOW beat whose workspace stands on stage (a live frame, its scene showing — never a parked one) is acknowledged at that edge (`mandatoryController.flowBeatInPlace` → `whenFlowBeatInPlaceChanges`). A task beat keeps its plate. | `consoleMandatoryGate.spec.ts` «a held flow beat whose workspace ALREADY STANDS on stage is served in place» · `classReplays.bottle.ts` «the Parliament is ALREADY OPEN when the sitting begins» (`eden-alliance-enact-remote`: the wheel, THEN the last pass — red with the edge off: the cycle and its cure; green with it: no plate, no line) | closed 2026-11-18; resolved in Sentry in the release that carries it |
| `notifications/starvation/hand-deliverynotification-only` — «1 queued event(s) held behind an ANIMATION hold for over 12000ms — delivering anyway (leaked hold: hand-delivery[notification-only])» | the bottle's `hidden` pass on a fresh seed (`fz5` · `sagitta-start`); not the perturbation's — the away spells only shaped the walk | **READ step by step** (the holds of the page at every press): no hold at all for the 25 s before; `hand-delivery` begins, and under five seconds later it is «held for over 12000 ms». The escape's clock (`queueBlockedSince`) started with ANY block — here a backlog standing behind a surface the player was reading — and only its LAST check asked whether the block is an animation's: a cinematic that began was at once a leak twelve seconds old, the backlog was delivered over its first frames and the hold was filed. **THE CLOCK OF THE THING IT BOUNDS:** the twelve seconds run only while the block's reason is `animation`; any other block (a player's time) leaves the clock at nothing. | `consoleForegroundWatchdog.spec.ts` «the clock starts when an ANIMATION takes the block over» (red with the reset off) · the bottle: the same walk names nothing | closed 2026-11-18 |
| `liveness/stall/presses-no-effect/externaldraw/parliament:committed/deaf` — IN A REAL BROWSER (the bottle's baseline holds the same key for `parliament-sponsored-eight` as its own blindness — that row says nothing of these): «stall (presses-no-effect): 33s without progress, 4 presses; asked: card; task: externalDraw; top: parliament:committed; holder: deaf», then the ladder — `stack-home: home from parliament`, `phase-root-park` — «recovered after 36s» (issues #54, #57) | the nightly `Monkey` (it came eight hours late), THE SEED OF THE DAY `d20261118` · `parliament-research-enact`, plain; and the box's two-window pass, `fz0` · `parliament-climate-enact` | **READ on the frame the walk filed when the net fired:** the screen is «ИНФОРМАЦИЯ › PLAYER2 — Состояние соперника — только просмотр»: the player opened the information screen over a Parliament whose resolution had just asked them to take drawn cards, and reads it. On a frame past its commit the arbiter judges every B a handler TOOK as owed a collapse — except over a surface of its own that takes B by its own contract; that list (`.con-reveal … .con-journal, .con-sys …`) did not hold the information screen. Four B's inside it were four presses with no effect: a stall, and a cure that took the Parliament down under a player who was reading. **WHO OWNS THE WAIT:** `consoleLiveness.PAD_OWNING_OVERLAYS` — the list by name, each row with its reason, now with `.con-info` and the opened turn review `.con-bot-review`; the supervisor asks it. | `consoleLiveness.spec.ts` «the surfaces that own the pad over a standing frame» (the rows, their reasons, no dead row) · CI: `gh workflow run Monkey -f seed=d20261118 -f shards=1 -f repeat=6 -f only='^parliament-research-enact$'` | closed 2026-11-18 (the CI repeat is the proof) |
| THE SEED OF THE DAY's other three (the nightly `Monkey`, `d20261118`, plain — run 44295922941): `wait-graph/dead-end/admission:host:reveal` (`red-lawyers-tr-first`, issue #47 reopened) · `wait-graph/ceiling/card-reaction:decision-clear` (`parliament-urban-enacted`, #55) · `wait-graph/ceiling/quiet:board-beat-drain` (`parliament-openip-enacted`, #56) | CI, 2026-11-18 — each read on the frame the walk filed when its line fired | **ONE LAW, three judges that did not know who was waited for.** ① #47: «Получена карта» stands in the Parliament with «A Взять · B Взять всё» on the bar, over the played card's transient beat — the world's one «accepting» is false there, and the graph read a press being offered as one that «cannot come»: a `player` target may carry `accepts` (a surface of its own stands and takes it), and the reveal's admission says so while `.con-reveal` is mounted. ② #55: the chain's wait for the decision at the centre is the PLAYER's, and its bound is its honest end by nature («past the bound it plays») — declared `target: 'player'`, `planned`. ③ #56: the fullscreen viewer open over a draw the player had not taken — the drain's «console quiet» cannot come while the player reads; `QuietWaitOpts.heldByPlayer` says so at the ceiling (the code beside it already knew: «a reveal STANDING for the player is not a wedged story»). | `waitGraphModel.spec.ts` «a press whose OWN surface stands on screen can come» · `ceilingWait.spec.ts` (both forms of `planned`, already pinned) · CI: `gh workflow run Monkey -f seed=d20261118 -f shards=1 -f repeat=6 -f only='^<table>$'` for the three tables | closed 2026-11-18 (the CI repeats are the proof) |
| `animation-hold/ceiling/scale-step-rating` · `wait-graph/overdue/ceiling:scale-step-rating:stage` — «"scale-step-rating" held for over 35000ms … (leaked hold?) — {phase: waiting, due: false, owed: true}», then «overdue ceiling:scale-step-rating:stage#2 — past its 32 s bound» standing to the end of the walk | the bottle's `hidden` pass on a fresh seed (`fz7` · `venus-bonus-inspection`); the same walk PLAIN with a longer last word names it too — not the perturbation's | **READ step by step:** a rating is owed; the player opens «Награды» (and the information screen over it) and sits there — the board the rating waits for is theirs to uncover. ① The hold's ceiling counts from the SEED, the story's due from the moment the run reaches its stage wait (14 s later here): the ceiling came first and read «leaked hold?». **WHO IS WAITED FOR:** the hold says `heldForPlayer` while it waits under a board that is not watchable — its line is the planned one. ② The expire ends the beat by `resetScaleStepRating()`, which bumped `epoch` — a PLAIN counter read inside the stage wait's reactive watcher: nobody woke, the watcher never said «abort», the wait's node stood in the graph for the rest of the game (invariant 17's latch, in a third place). **THE ABORT IS A REACTIVE EDGE:** the reset nudges the watcher it leaves behind. | `scaleStepRating.spec.ts` «a rating waiting under a board the PLAYER keeps covered is the player's wait — and a reset ends the stage wait, at once» (red with the nudge off) · the bottle: the walk names the planned line and leaves no node | closed 2026-11-18 |
| A DEFECT THE REPORT COUNTED AND DID NOT NAME — «records 9 · of them defects 1», no DEFECT class, nothing filed, the gate green | CI, `fz3` · `reload` (run 44342549205, 606 walks) | **A HOLE IN THE NET's OWN REPORT.** One class can be read at two tiers (the same line is an honest wait or a defect by who owned the wait — `shapes.ts` `read`), and `monkey-report.mjs` gave a class the tier of the FIRST record met, in the order of the files: the defect of `parliament-bot-vote` stood behind a planned record of `field-hydro-terminal`. **THE LAW: a class is as bad as its worst record** — the tier rises to the worst record's, `first` (the re-run) is the first record OF THAT TIER, `tiers` says how many were read at each; the same for a net's shape and for what spoke inside an episode. The gate (`gateVerdict`), the diff and the filer read that tier, so all three were blind the same way. Spec `monkeyReport.spec` («A CLASS IS AS BAD AS ITS WORST RECORD»). The matrix's earlier cells were read by `totals.defects` (counted per record), so their zeros stand | **CLOSED** — every cell re-run from here names it |
| `presentation-ledger/story-due/board-beat-park` — «story «board-beat-park» degraded after 30s — the release edge never came — {watchable: false, watchableSeen: true, coveredBy: [section, workspace], pending: true, held: [oceans]}» | CI, `fz3` · `reload` · `parliament-bot-vote` (the record the row above hid) | **READ, and the line could not say whose wait it was.** The player sat in the Parliament with an ocean parked; some look of the 30 s window saw the board, so the row read «seen and not told» = defect. But the drain re-parks BY DESIGN when the board is covered again before its settle (`BOARD_BEAT_SETTLE_MS` after a leaving surface): a board the player CROSSED and a board that stood open while no drain ran are the same line. **THE DRAIN IS THE WITNESS** (`boardBeatPark.ts` `parkWindow`): the diagnose now carries `looks` (seen/all), `drains` (opened in the window), `coveredAgain` (ended «covered again before anything released») and `coveredAgainBy` (who covered it). **THE TIER (`storyCoveredByPlayer`):** an honest wait only when every cover is the player's AND the board was never seen — or every drain the window opened was covered again by the player's own covers; seen with no drain opened, a drain neither released nor covered, a cover of the game's own scene — a defect. Specs: `boardBeatPark.spec` (a crossed board; a board that stood open; a scene's cover), `diagnosticsCause.spec` | **CLOSED on the evidence** — the same walk on CI with the drain speaking (run 44360353813, `fz3` · `reload` · `^parliament-bot-vote$` ×20): 20 of 20 read `looks: 1…2/120 · drains: 1 · coveredAgain: 1 · coveredAgainBy: [section, workspace]` — the board was seen for one or two looks of a hundred and twenty (under half a second), the one drain it opened was covered again by the player's own section and workspace before its settle. The player crossed the board; the wait was theirs (tier `planned`, as the report of that run reads it) |
| `console-foreground-watchdog/expired/animation:board-beat-drain-animation:scale-step-rating-…` · `console-foreground-watchdog/expired/animation:resource-transfer-admission:presentation-admission` — «the foreground claimed to be busy with NOTHING rendered — expired animation:board-beat-drain, animation:scale-step-rating, admission:presentation, admission:anyAnimation» | CI, `fz1` · `duo` (run 44353345719; issues #64 · #65) — `aerospace`, `project-eden-wg` | **READ in the walks:** both are the page BEHIND — `[long-frame] 1016ms — NATIVE` every second of the walk (28 and 32 such lines), and beside one of them the transfer's own ceiling already says «(planned: the page gave the motion 413 of 1780 ms…)». The watchdog was a judge that did not know it: its grace for an animation hold (`ANIMATION_STALL_GRACE_MS`, 20 s) ran on the WALL, and a 2 s scale story on a page that paints a frame a second stands a minute. **THE LAW (the stage's own): a hold's age is counted on the clock of what it holds for — frames.** The time a pass found the page not painting while an animation hold stood is not the hold's age (`noteUnpaintedPass`), and on such a page the rule is not judged at all — a hand-off of one tick takes many there, and nobody is looking; what is truly stuck is cured three passes after the page paints again. The verdict comes down as a term of the pass (`WatchdogPass.pageStarved` ← `frameWitness.pageStarvedNow`). Spec `consoleForegroundWatchdog.spec` (a minute behind another window: nothing expired, the hold young when the page returns, a leak past the grace ON A PAINTING PAGE still expired; a claim with no hold behind it likewise) | **CLOSED**; the cell is re-run on this code |
| `wait-graph/dead-end/hold:resource-transfer` — «dead-end hold:resource-transfer (blocking) — motion:resource-transfer cannot come — standing 17 s», cured through `hold-expire` | CI, `fz3` · `duo` (run 44365152554; issue #67) — `robotics-factory-one`, the FIRST seat's page | **READ in the walk:** the page behind — a long NATIVE frame every second up to 313.8 s; «still hold — resource-transfer[blocking] stand 6s with nothing moving» at 314.4 s; the dead end at 317.4 s. The graph's rule already lets a motion come on a starved page — but the STILL SPELL was collected while the page did not paint (between two births of a wave no tween exists at all there), and it was held against the motion the moment the page was looked at again. **THE LAW (the stage's own): stillness is counted on the painted clock** — `motionWitness.observeStillHold(…, starved)`: a starved look restarts the spell, the graph is fed no stillness from a page nobody is looking at, and a hold that is truly stuck is named `STILL_HOLD_SHADOW_MS` of painted stillness after the page returns. Spec `motionWitness.spec` | **CLOSED** — the same table, seed and perturbation on `758834d04c`, 8 walks (run 44379060646): no defect record; the wave's waits end on their own ceilings, read as planned |
| `start-stranded/confirmed/or` + `start-shadow/finding/disagree/game/step` — «the start serves nothing while the server asks «or»» {frames: start:committed, colonies:browse; hand: docked/colonies; flowStage: preludes; blockers: otherPromptStands, nestedFrame}, then the shadow's «cure release» 1.6 s later; the harness failed the walk on it | CI, `fz3` · `duo` (run 44365152554; issues #24 reopened · #66 · #68) — `parliament`, the SECOND seat's page, which is the one IN FRONT (no long frame of its own) | **NOT the starved page — a hosted step past its own prompt.** A prelude's colony grid stands on the start; the press that builds answers the start's last question, the server asks the action menu, and the grid is still there 2.5 s later. `startServing.hostedStepServes` knows ONE transit — the hand's own opening / gathering; a hosted WORKSPACE has none, and the line could not say whether the grid was still paying its build (an in-surface wave holds the FEED only: no blocking hold says it) or was left standing. **THE EVIDENCE FIRST:** the line now carries `transfers` (wave / in-surface), `holds` (every live hold, any scope) and `refused` (the last conclusion refused: which workspace, by which named hold, how long ago) | **OPEN — reproduced 8 walks of 8** (run 44379060646, on `758834d04c`): `transfers: none · holds: [] · refused: null` — NOTHING of the step is in flight: the grid is at rest. By the code it is not a flow's step at all: a flow's colony pick is anchored to its `prompt` and stands past browse, while this one is `colonies:browse` — the frame of «the player goes to a screen» (`enterWorkspace`, anchor `always`), which stands OVER a phase root as an OVERLAY. The start does not yield its scene to it (`workspaceHostYieldsScene` answers for `scene` steps only), so two full surfaces stand at once and the line cannot say WHICH THE PLAYER SEES: their own colony rail over a finished start (their wait — and the watchdog, the shadow and its «cure release» are then wrong to act), or the start painted over it (a dead screen with the pad in the rail — a defect of the yield). A law written before that is known would be a guess: it was written, and withdrawn. **THE SECOND EVIDENCE:** the line carries `above` (`kind@anchor/overlay·embed`), `visible` and `painted` (the surface on top at five points of the screen, read off the page). **AND IT SAID (run 44389231809, 3 walks of 3): `above: ["colonies@always/overlay"] · painted: .con-colonies` at all five points** — the player sees their OWN colony rail; the guess made from the stylesheet (the start's fixed layer paints over it) was wrong, and the line is what said so. **THE LAW (the stage's own — who is waited for decides the wait): THE PLAYER'S OWN LOOK OVER THE START IS THE PLAYER'S WAIT.** `consoleWorkspaceStack.hostCarriesPlayersLook` — nothing but screens the player went to themselves stands on the host: «the player goes to a screen» over a phase root leaves exactly one shape (an OVERLAY, anchored `always`, in `browse`; a flow's step nests INSIDE the host, anchored to its prompt or past browse). The watchdog (`startServing.hostedStepServes` — `playersLook`) reads it as served; the shadow (`startDirector.actualStartOwner`) reads it as the player's choice, exactly as a parked task — never judged, and never «cured» by releasing the start from under what the player is reading. The look gone, every rule stands as before. Specs: `startServing.spec`, `startDirector.spec`, `boardTakeableFromStack.spec` («hostCarriesPlayersLook») | **CLOSED** — the same table, seed and perturbation on `753ed426c0`, 4 walks (run 44392603114): 4 of 4 passed, no record at all (it was 11 of 11 failed) — the start ends by itself once the player closes the look. Issues #24 · #66 · #68 closed |
| `invariant/broken/pad:owner-not-mounted:taskhost` — ««taskHost» owns the pad and is not mounted — two presses in a row went to nobody» | CI, `fz3` · `cpu4` · `special-permit-locked` (run 44425253100, issue #70) — the first cell after the tier audit made the line audible | **READ in the walk:** a press, a 1.2 s frame, then two presses 1.65 s apart that reached nobody. The pad's ladder reaches the task host's rung on fewer terms than the host's own `v-if` has (stage 2's map: the two were to be «in lock-step» and are not), so a press that arrives while the host is DELIBERATELY held was counted against an owner «not mounted». **THE LAW: a held owner is held BY NAME** — `routerController.taskHostHeldBy` (the first term of `taskHostRendered` that holds it); the pad says `«taskHost» owns the pad and is held (<reason>)` once and files nothing; the invariant is left for an owner the state says stands and the tree does not hold. (The copies become ONE in stage 2 ②; until then the hold is named.) | **CLOSED** — the same table, seed and perturbation on `9025a520df`, 20 walks (run 44438213459): 20 of 20 print `«taskHost» owns the pad and is held (held-for-workspace)` — the sitting's ask waiting for the field to open, the beat absorbing the press by design — and none has a defect record. Issue #70 closed (and #69, the bracket's false class: `fz3` · `reload` on the fix names no record of it) |
| SIX CLASSES OF THE BOTTLE's GATE UNDER THE AWAY PERTURBATION — `fz4` (606 walks), then `fz5`: `invariant/broken/dock-accent:leaked-lease:{hand-open,hand-intake,hand-filter}` · `wait-graph/ceiling/deck-pick:deal` · the pad's class above · `wait-graph/ceiling/remote-placement:watchable-board` | the bottle (`tm-fz-gate`, on `fabc733854`) — the first night the audit's new doors were walked with the page away | Two were closed by code already (the bracket of a planned reason; the pad). **The dock accent:** a six-second timer on the WALL over a presentation that runs on FRAMES — every open of the hand behind another window «broke» an invariant. **THE LAW (it is `invariant.ts`'s own, now kept): a bound over a MOTION is a ceiling wait, which reads the frames — never an `invariantBroken` behind a bare timer.** The lease's ceiling is `dock-accent:<label>`; the hydro marker's claim net (`hydro-marker:claim`) was the same construction and took the same cure. **The deal:** shrunk to six steps (`TM_BOTTLE_MONKEY_SHRINK`), and the away spell is NOT its cause — plain time names it: «WG Project» from the hand opens a pick of three preludes on a stage that cannot be measured, the batch arrival «hands over immediately instead of faking a flight» and stood on its nine-second safety (nobody calls `notifyPayload` for a payload that is already there); the deal's ceiling ended it at eight — an empty row and a shut pad. On a real page the same stands behind any unmeasurable stage (a zone still folded, a workspace parked under the deal). **With the payload here and no stage to fly on, nothing is owed: the hand-over is the next task** (`consoleBatchArrivalMotion.runBatchArrival`). Until the audit made the deal's ceiling a wait of the graph this was a note nobody read — the audit's first catch of a real stall. Replay `classReplays.bottle` (the pick takes the pad three seconds after the play), `batchArrivalUnmeasurable.spec`, `consoleDockAccent.spec` | **CLOSED in code**; the bottle's `hidden` gate is re-run on it (`fz4 … fz7`) |
| `transfer/surface-folded/touchdown/card-resource/fighter` — «surface folded under its token — the touchdown of card-resource:fighter@Arwind Inc. into div.pcard__res (section.con-parl.con-ws gone)»; the harness failed the walk on it | CI, `fz0` · `duo` (run 44440036867, on `9025a520df`; issues #72 · #73) — `arwind-chairman-quest-solo`, the page BEHIND (a NATIVE frame a second) | **READ in the walk:** «ceiling transfer:touchdown … (planned: the page gave the motion 33 of 1780 ms)», and three milliseconds later the sentinel. The token never left its source — the flight's safety absorbed it where it stood (`caughtUp: 'unflown'`) and booked its end as `lost`; the sentinel read `lost` as «the destination vanished», at a moment when the surface may have folded BECAUSE that end settled its debt. Whether a verb folded the Parliament DURING the starved flight (the collapse waits — R16; a dozen other ways off the stack do not) the line cannot say. **Two changes, neither a guess:** a token that never left its source approaches no destination — its flight's ceiling line carries the verdict, the touchdown sentinel is not asked; and **THE FOLD IS WITNESSED WHERE IT HAPPENS, in shadow** (`consoleResourceTransfer.witnessFrameLeft`, asked at the stack's own mutation with the surface still in the tree): a frame that leaves the live stack while its surface holds a token's end or an owed series is named with the VERB that took it (`workspaceLastVerb`) — class `transfer/frame-left-holding/<kind>`, tier `info`, counted in every walk. Spec `transferSurfaceClear.spec` | **CLOSED (2026-11-19, issue #72).** The witness named the verb — `closeWorkspaceRoot:parliament › truncate:0`, the conclusion itself, six walks of ten under the two-window pass (run 44524633499) — and ONLY on the page behind: 2424 walks on a page that paints (the confirming pass's three plain cells and CPU ×6) never printed it. On the page behind the token had not been BORN (a page that does not paint starts no flight): nothing flew into a folding surface, the conclusion went on with the game, the token was absorbed where it stood. **THE VERDICT FOLLOWS THE PAGE:** the witness's line is `planned` on a page that does not paint (it says so) and a DEFECT on one that paints — the fold's sentinel in its final form, asked where the fold happens, with the verb in the line. (The same cell: #71, the dock accent's lease on the page behind — closed by `8c7e40424d`; and one shard lost its runner, 38 tables not walked — the cell is re-run in the tail) |
| `presentation-ledger/story-due/board-beat-park` · `presentation-ledger/story-due/scale-step-rating` — «degraded after 30s — the release edge never came — {watchable: true, …, draining: true, held: [temperature]}» · «… moves: [temperature:1→-26 … marker={moving: true}]» | CI, `fz1` · `duo` (run 44447967288, on `186989ae4f`; issues #74 · #75) — `info-dossier-rich`, the page BEHIND | **READ in the walk:** the same scene's ceiling stands beside them, already planned — «the page gave the motion 3375 of 32138 ms, 32 frame gaps over 500 ms». The ledger's due ran on the WALL; the scene that releases a story — the board beat's drain, the marker's walk — runs on frames, and thirty seconds of a page nobody looks at gave it three. **THE LAW (the stage's own): a story's due is judged against the frames the page painted** — every owed story carries a watch from its first owe (the frame witness's one loop; it rides the story's scope), and a story that comes due on a page that did not paint says `(planned: the page gave the motion N of M ms …)`; on a page that painted it is the defect it always was. Spec `presentationLedger.spec` | **CLOSED** — the same table, seed and perturbation on `7b70efc71d`, 8 walks (run 44456478446): no defect record in any; the one story that came due on the page behind reads «(planned: the page gave the motion 3020 of 30107 ms, 30 frame gaps over 500 ms …)». Issues #74 · #75 closed. The same cell is the measure's second reading in a real browser — § 8 |
| `wait-graph/overdue/ceiling:remote-placement:watchable-board` — «overdue ceiling:remote-placement:watchable-board#4 (consoleRemotePlacement: covered by reveal) — past its 20 s bound — standing 22 s» | the nightly freeze gate, the bottle on CI (run 44456662965, seed of the day `d20261119`, issue #76) — `wg-project-short-deck` | **Shrunk to eleven steps** (`TM_BOTTLE_MONKEY_SHRINK`): the viewer stands on cards they have not taken, another seat's tile is owed to the board, and a sitting has promised to yield for it — the landing's wait is KEPT, sixty seconds instead of twenty, by design (`BOARD_WAIT_KEPT_MAX_MS`). Its node in the wait graph was declared with the short bound and never told otherwise: the judge named a wait that was keeping its word. **THE LAW: the node's bound is the wait's own bound at every look** — `CeilingWait.bound(maxMs)` (the ceiling line names the bound the wait ended on); the board's wait says which of its two bounds stands at every look of its poll. Spec `ceilingWait.spec`; replay `classReplays.bottle` (the eleven steps, the cards not taken for thirty seconds: no «overdue») | **CLOSED** — the gate's own job on the same seed and table (run 44465386072, on `1193ada539`): GREEN, no class the baseline does not hold. Issue #76 closed |
| `presentation-ledger/story-due/board-beat-park` — «… {watchable: false, watchableSeen: true, looks: 3/117, drains: 0, coveredAgain: 0, coveredBy: [section, workspace], held: [oceans]}» | THE BOX, the plain pass with a GPU (`fzr-fz0-none`, the snapshot of `b6e27a7ed1`, 606 walks — its one defect record) — `parliament-bot-lobby` | **READ, and the line could not say why a board that was seen opened no drain.** The player sat in the Parliament with an ocean parked and crossed the board for three looks of a hundred and seventeen; the drain the shell registers is GATED (the board's own scene settling, a reveal above it, cards in transit — `placementController.drainBoardBeats`), and a gated re-drive left no trace in the window: «seen, no drain» read as a wedge. **THE GATE SAYS WHY** (`boardBeatPark.noteBoardBeatDrainGated`): the diagnose carries `gated` (looks) and `gatedBy` (reasons). **THE TIER:** a drain that stood behind its own gate at every look that saw the board, on a board the player then covered, is the player's wait — the gate has its own bound (20 s) and its own line; fewer gated looks than seen ones, or a gate that names nothing, is the defect it was. Specs `boardBeatPark.spec`, `diagnosticsCause.spec` | **CLOSED** — the two walks in a real browser on the fix (CI, ×8 each: run 44468988357 `fz1` · cpu4 · `venus-l1-shade-temperature`, the box's second record of the same class; run 44469000488 `fz0` · plain · `parliament-bot-lobby`): 14 stories came due, every one read `gated: 3…4 · gatedBy: [reveal-open, reveal-pending, …]` — the drain stood behind a reveal the player had not taken, on a board they crossed; none a defect |
| **THE MATRIX — STAGE 1's EXIT, REACHED 2026-11-20 04:19 UTC: 24 CELLS OF 24 AT ZERO ON ONE COMMIT (`ab6ad53eba`)** | CI (`tm-fz-tools/ci-chain.log` — every dispatch names its ref and commit), the box (`tm-fz-gate/.e2e-remote/box-chain.log`, a worktree detached AT that commit) | 8 perturbations × `fz0` · `fz1` · `fz3` × 606 tables, a real browser every cell — **defect records 0 · episodes 0 · never cured 0 in every one**. CI: `none` ×3 · `cpu6` ×3 · `duo` ×3 (68 400 presses each) · `hidden` ×3 · `cpu4` ×3 · `net400` `fz0` `fz1` · `net1500` `fz1`. The box (the same commit, a browser WITH a GPU): `reload` ×3 · `net400` `fz3` · `net1500` `fz0` `fz3`. What every cell still records is `info` / `planned` only (17 – 79 records a cell: ceiling waits that say why, a story told on a starved page). | — | **Stage 1 is CLOSED.** The bookmark `fz/stage1-exit` (a ref to a commit already in `main`'s history — never a line of its own, nothing to merge) is deleted; the worktree `tm-fz-gate` is removed. From here the matrix is the NIGHTLY's (the `Monkey` and `Freeze gate` schedules with the seed of the day) and every class it names is a ticket of `docs/claude/ci-findings.md`. |
| THE MATRIX, as it stood 2026-11-19 07:25 UTC — the confirming pass running on one commit (an earlier reading) | CI (`tm-fz-tools/ci-chain.log` — every dispatch names its ref and commit), the box (`.e2e-remote/box-chain.log`), the bottle (`tm-fz-tools/gate-seeds.log`) | **The exit commit is `ab6ad53eba`, held by the branch `fz/stage1-exit`** (`ci-chain.mjs` reads the ref from `ci-chain.ref` at every dispatch, so `main` moves without touching the pass; a fix that changes what a cell NAMES moves the branch — fast-forward only — and the cells already run are queued again). **On it: `fz1` · hidden — 606 walks, 0 defect records, the gate GREEN (1 of 24).** Queued, one an hour, by themselves: `fz3:hidden fz0:none fz1:none fz3:none fz0:cpu6 fz1:cpu6 fz3:cpu6 fz0:cpu4 fz1:cpu4 fz0:net400 fz1:net400 fz3:net400 fz0:net1500 fz3:net1500 fz0:reload fz1:reload` → `fz3:reload fz3:cpu4 fz1:net1500 fz0:duo` → `fz1:duo` → `fz3:duo` → `fz0:hidden`. **The night before the pass (each a row above):** eight findings of CI's cells and gates — the pad's held owner (#70), a planned reason's bracket (#69), the dock accent's lease on the page behind (#71), the fold's false verdict (#73; the real question behind it measured in shadow — #72, open), the ledger's due on the painted clock (#74 · #75), a kept wait's bound (#76) — and ONE real stop the audit's own doors made audible (the deck pick's deal on a stage that cannot be measured: eight seconds of a shut pad). Cells at zero on the code of their hour: `fz3` · duo (`6c607be861`), `fz0` · hidden (`7b70efc71d`). **The box** (GPU, the snapshot of `b6e27a7ed1`, 606 walks each): `fz0` × cpu4 · duo · hidden — 0 defect records; `fz0` plain and `fz1` × cpu4 — one record each, the same class, read and closed (the board beat's gated drain). **The bottle** on the night's code: plain `fz0` GREEN; `hidden` on `fz4 … fz7` — four of four GREEN | **the exit of stage 1 = the 24 cells at zero on `ab6ad53eba`** — about a day of CI from 06:10 UTC; a cell that names a real class moves the commit and starts the count again |
| THE MATRIX, as it stands 2026-11-19 00:10 UTC (an earlier reading) | CI (`tm-fz-tools/ci-chain.log`), the box (`.e2e-remote/box-chain.log`), the bottle (`tm-fz-tools/gate-seeds.log`) | **CI, 24 cells (8 perturbations × `fz0` · `fz1` · `fz3`), defect records by `totals.defects`:** 18 at ZERO on the code of their hour (`fz0`: none · cpu4 · cpu6 · net400 · net1500 · reload · hidden; `fz1`: none · cpu4 · cpu6 · hidden · reload · net400; `fz3`: none · hidden · net1500 · cpu6 · net400) + the seed of the day `d20261118` at zero; 5 named classes that are FIXED and owed a re-run (`fz0` · `fz1` · `fz3` × duo, `fz3` × cpu4, `fz3` × reload); `fz1` × net1500 ran and named two FALSE defects of the session's own change (a planned reason with a bracket inside — row above, issue #69, fixed in `5db42791b1`). **In flight, by themselves:** CI — `fz3:cpu4 fz3:reload fz0:duo fz1:duo fz3:duo`, then the whole remaining matrix on the final code (`ci-chain-after-log.mjs`: 18 cells, one an hour); the box — three chains on the snapshot of `b6e27a7ed1` (`fzr-*`: duo · none ×3 · cpu6 / hidden ×3 · net400 ×3 / cpu4 ×3 · net1500 ×3 — a duo, a hidden or a cpu4 pass takes 3 – 6 h there, so ≈ 8 cells by the morning); the bottle — `hidden` on `fz4 … fz7` in a tree of its own (`tm-fz-gate`, so that edits do not move its shards). ⚠ A cell is dispatched on `main` AS IT STANDS at that minute: the tier audit of 2026-11-19 (`docs/claude/diagnostics-tier-audit.md`) made several honest-looking lines defects and added the `invariant` family in every build — a class a cell names from here on may be one the code always had and nobody heard | **the exit of stage 1 = every one of the 24 cells at zero on ONE commit** — the confirming pass is what is queued; «no GPU» has no cell of its own (a CI runner paints in software: every CI cell IS that condition, the box's are the GPU's) |
| THE MATRIX, as it stands 2026-11-18 09:40 UTC (606 walks a cell, defect records on the code of the cell's day) | CI (`ci-chain.log`), the box (`.e2e-remote/box-chain.log`), the bottle | **CI** `fz0`: plain 0 · cpu4 0 · cpu6 0 · net400 0 · net1500 0 (planned only) · reload 0 · duo — the five-table control clean · hidden — the first form proved nothing, the real form is running. `fz1`: plain 0 · cpu4 0 · hidden running. `fz3`: plain 0. **THE BOX** (GPU): `fz1` plain 0 · `fz3` plain 1 (the chairman's quest — closed) · `fz0` net400 0 · net1500 0 · reload 0 · duo — the row above; running: `fz1` cpu4 · `fz3` cpu4 · `fz0` hidden. **THE BOTTLE**, `hidden`: `fz0` 0 NEW · `fz1` 0 NEW · `fz3` 0 NEW (606 walks each, the gate GREEN). | owed on CI: `fz1` cpu6 · net400 · net1500 · reload · duo · `fz3` cpu4 · cpu6 · net400 · net1500 · reload · duo · hidden · the seed of the day; on the box: `fz0` duo and `fz1` · `fz3` hidden on the current code | **open — the account runs ~20 jobs at a time: a cell an hour or two** |
| — | | | (filled as the box, the bottle's seeds and the field name them) |

### 4b · THE FIELD'S OWN CLASSES — the owner's console exports, read by today's classifier

`npm run diag:corpus -- <dir>` (`scripts/field-corpus.ts`): every `*_console_export_*.txt` of a folder through
`causeOf` — the classifier the hub files a stall under. The owner's 47 exports (2026-08-31 … 2026-11-09) hold **38
defect classes**. ⚠ The lines are yesterday's and the shapes today's: «last seen» is the newest export that carries
the class. No export holds an arbiter's `[liveness] stall` — what the field shows is the OTHER nets.

| Class (today's key) | Exports · last seen | What it is | Where it stands |
| --- | --- | --- | --- |
| `presentation-ledger/witness-heal/view-freshness` | 14 · 11-09 | the freshness witness healing a view parked behind a live scene | **closed 2026-11-15** — the row above |
| `start-shadow/finding/disagree/wizard/game` | 12 · 11-09 | the start's question (`initialCards`) with the start frame off the stack and `parliament:browse` on stage — the Parliament opened from the wheel during the opening | since 2026-11-14 a question the player set aside reads `parked` (class 2's law). **Its own replay stands (2026-11-19, CI finding #62):** `classReplays.bottle` — a Redux opening on its first question, «B Свернуть», the quick wheel's ▼ «Парламент», fifteen seconds on `parliament:browse`: nothing filed, and B then A bring the opening back; red under exactly this class with the `parked` branch switched off |
| `presentation-ledger/witness-heal/workspace-conclusion-owed` | 10 · 11-09 | the conclusion's witness healing a conclusion a named hold refuses | **gone by construction** — the witness was retired with architecture v2 (the conclusion is the frame machine's) |
| `notifications/correlation-ceiling/*` | 9 (holder unknown) · 11-09; 5 with a holder · 10-31 | a causal chain the SERVER keeps open for 90 s — its notification arrives a minute and a half late | **open** — not a freeze (the screen serves); the server names no holder for the chain. A worklist row of the notification system |
| `workspace-outcome/unregistered-zone/…workspace-reveal` | 8 · 11-07 | the embed-zone registry answers «not mounted» for a zone that is in the document | open — named by no pass since the Vapor flip (2026-11-14); read when an event carries it |
| `transfer/painted-under/…card-zoom…` (three keys) | 15 · 11-07 | a reward token painted under the zoom modal | open — visual, not a freeze |
| `workspace-stall/unshaped` · `animation-hold/ceiling/parliament-chairman-quest` | 7 · 11-07 | the chairmanship's leaked beat | **closed** — 2026-11-07 and §4's class 4 |
| `wait-graph/ceiling/remote-placement:watchable-board` | 3 · 11-09 | a foreign tile waiting for a board the viewer keeps covered | declared `planned` since part A — counted, never an event |
| `wait-graph/dead-end` · `dangling` of 11-08 / 11-09 (five keys) | 2 each | the wait graph's first findings, the day it shipped | **closed** — `bd90fa79f3`, `42a05edede`, `5dc5e9bf77`, `ebdc40c0fd` |
| `wait-graph/ceiling/card-reaction:rating-story-quiet` | 1 · 11-09 | a rating reactor paying before the rating landed | **closed 2026-11-14** — one due |
| `start-shadow/finding/disagree/game/{none,shell,board}` · `…/step/board` · `start-shadow/cure/yield` | ≤ 4 · 10-31 | the start standing while the game proper asks | the field hang of 2026-10-31, closed then (the start director, phases 1 – 2). The bottle's second seed names `game/none` · `game/shell` on `venus-trade-unity-bonus-2p` — a real browser with the same seed does not (§0 · B5) |
| `animation-hold/ceiling/{rail-reward, tile-placement-remote, action-commit-rail-owed, hydro-marker, nomad-move-remote}` · `console-foreground-watchdog/expired/*` · `console-leak-detector/stranded-prompt/deckselect` | ≤ 3 each · ≤ 10-28 | holds that ran to their ceilings, a stranded deck pick | not seen since — the work of 2026-10-28 … 11-12 (state delivery, the arbiter, the wait graph, architecture v2). A release with part A will say, with evidence, if one is still alive |

*What the table is for:* the first release that carries part A turns every row into an EVENT with its evidence, its
trail and its save — `npm run diag -- classes` then replaces this reading of old text.

Structural work, in the order the data will set:
1. **S5-rest** — owed steps as `step` children of the frame; the ghost test, the forced teardown and the stale
   free-turn reaper retire.
2. **Admission and ownership as ONE total function** — «who serves the question» has nothing to «not find»; the screen
   and start director shadows, the stranded check, `deferred-restore` retire.
3. **The pad ladder and the command bar as ONE table.**
4. **Reactions as machines / scoped runs, per domain**; the start scene and the Parliament taken apart like the shell.
5. **A wait on a reactive condition is visible to the cycle check** (or cannot form one). *Sized 2026-11-15:* the
   kernel's own `until(…)` stands at ONE site and `polled` at three (`untilCeiling`); the bulk is the 49
   `beginCeilingWait` call sites — nodes of the wait graph whose targets are `motion` / `server` / `player`, not other
   nodes, so no edge and no cycle check, by design: a ceiling that FIRES is the signal (`[wait-graph] ceiling …`, a
   class of its own per call site), and the passes name none today but the bottle's blind ones and the rating's
   planned one. Naming a node for each of the 49 is a rewrite to be driven by a ceiling that fires in the field or on
   the box — not ahead of one.
6. **CRASH-ONLY: the console session is REBUILT from the server's view** — the ONE last line; the ladder's rungs
   retire behind it. The design (to be proven by the bottle and by the monkey rebuilding at arbitrary presses):
   - *Why it is the right last line.* A reload cures nearly every freeze of this console because the client's state is
     a function of the server's view; every other rung of the ladder is a partial, hand-written imitation of that
     function for one module. A rebuild is that function itself.
   - *Two depths of one verb, `rebuildConsoleSession(why)`:* **in the page** — the game screen's shell is remounted
     (`leaveConsoleSession()` → the session's scope ends → a new session begins on the freshly fetched view): instant,
     and exactly as complete as «every piece of module state of a game is declared» — so that becomes a GUARD (module
     state under `src/client/console` is a `sessionState` / a scope / a run, or is declared page-lifetime with its
     reason — today 66 declarations are a list somebody kept; the guard makes it the law); **the page itself** — a
     reload behind the frame the player was looking at (the main process holds the last frame over the window until
     the new page says it stands): complete by construction, a second or two. The first is tried once per question,
     the second is the floor.
   - *Bounded:* one rebuild of each depth per question identity — a question no rebuild can serve is a defect of the
     table itself (named, with the save's reference), never a loop.
   - *What it retires:* the rungs that destroy more than they restore (`stack-home`, `phase-root-park`, the forced
     teardown of a beat, the forced release of a claim) once the ledger shows the rebuild cures what they cured.
   - *What stands today (mapped 2026-11-14 — the ground the rebuild is built on):*
     - the ladder is eleven rungs by rank (`consoleLiveness.ts` `registerLivenessRelease`): `presentation-ledger` 0 ·
       `foreground` 10 · `start-director` 15 · `screen-director` 17 (does nothing unless armed) · `workspace-outcome` /
       `card-discard` / `colony-trade` 20 · `transport` 22 · `workspace-beat` 25 · `stack-home` 30 · `phase-root-park`
       31. **Past the last rung there is NOTHING**: a line («the ladder is spent»), no notice, no further act — the
       player's only way out is to restart the game;
     - the only AUTOMATIC reloads are the main process's hang watch (`electron/rendererHangWatch.ts`: 30 s
       unresponsive → the renderer is crashed and reloaded, at most 3 per 5 min) and the transport's answer to
       `INVALID_RUN_ID`. A page that RUNS but serves nothing is never reloaded by anyone;
     - the shell is NOT keyed (`App.vue`: `<ConsoleShell v-else-if="screen === 'player-home' && playerView !==
       undefined">`); the session begins in the shell's set-up (`useConsoleSession`) and leaves in two steps
       (`shellLeaving` → `leaveConsoleSession()` = the 66 `sessionState` resets; the scope ends at unmount);
     - a reload restores by rebuilding from the server's view at the mount edge (`whenPlayerViewChanges`, immediate) —
       there is no client-side «put me back» (`hydrateWorkspaceStack` is called by a unit spec only): the rebuild's
       road and the reload's road are already ONE road;
     - **what an in-page remount would NOT reset today** (no guard looks at general module state — `kernelCoverage.spec`
       checks only what was declared): the transport's module state (`transportHolds`, `transportState.
       playersWaitingFor` / `refusedWhileBusy`, `settleListeners`, `presenter`), the wait graph's (`declared`,
       `firstSeen`, `confirm`, `lastNodes`, the stats), the hold registry's (`suppliers`, `manualRecovery`, …), the
       router's `consoleState` (`handIndex`, the filters, the defer-durable picks), the desktop-era stores
       (`drawnCardsState`, `botAttackState`, `draftWaitState`, `cubeDropState`).
   - *The order of the work:* **(a)** THE GUARD — module-level mutable state under `src/client/console/**` (a
     top-level `let`; a top-level `const` holding a `Map` / `Set` / array / object / `reactive` / `ref`) is reset by a
     `sessionState`, owned by a kernel scope, or declared page-lifetime with its reason: an AST scan with a per-file
     ratchet, a new file at zero; **(b)** the ratchet burned down, the «would not reset» list first; **(c)** depth 1 —
     the shell keyed by a session epoch, `rebuildConsoleSession(why)` = leave → refetch → remount, once per question
     identity; **(d)** depth 2 — the reload behind the last frame; **(e)** the arbiter's LAST rung is the rebuild, and
     the monkey rebuilds at arbitrary presses (`TM_E2E_MONKEY_REBUILD`) on every table before a rung retires.
7. **The question's delivery is a contract** — client and server agree on the standing question at every exchange,
   and a disagreement is resolved by the contract, not by a net. **RESOLVED 2026-11-14 (F11):** the IDENTITY is on
   the wire (the poll names the prompt the page displays; a different serial is `changed`); the VERDICT is judged in
   the page — by the arbiter while it runs, and by the pulse's witness outside the shell when it does not (§0 · C6c);
   both end in the ONE last line. The bullets below are the design as first written — the server-side judge and
   `resync` were NOT built, for the reasons of F11:
   - the client says, with every poll / on its socket, what it is DOING with the question it was asked: the prompt's
     identity and the screen's verdict for it (`served` — a surface accepts · `announced` — the plate / the beacon
     stands · `set-aside` — the player's own · `in-flight` — a bounded beat) — the screen director's verdict, which
     the client already computes once a second;
   - the server — the truth of what is asked — judges it: the question it asks is not the one the client names, or
     the client names it `unserved` / says nothing past a bound → the answer carries `resync`, and the client
     rebuilds (6). The judge is outside the page: it also sees a page whose supervisor never started (a curtain that
     never lifted) or stopped ticking;
   - a reload in the middle of a flow restores the SAME step: the restore road is the rebuild's road, walked by the
     monkey on every table (`TM_E2E_MONKEY_RELOAD`, and the rebuild in its place);
   - small enough to state exactly: this protocol (asked · named · verdict · resync · rebuilt) is the one place a
     formal model (TLA+ / Quint) earns its keep — a few dozen lines checked for «every question is eventually served
     or the session is rebuilt», kept beside the code by a guard that pins the message shapes.
8. **Native stalls** — what the box's traces name, reduced; frame budgets of the key scenes as a guard on the box.
   **The script-and-style half, measured on the laptop (2026-11-14 night)** — two opt-in probes, never gates:
   `tests/e2e/console-key-trace-probe.spec.ts` (`KEY_TRACE=1`: a table walked by a recorded monkey walk under a
   Chromium trace → per key event the forced style / layout passes, who of the application asked, how many
   elements each restyled; `KEY_TRACE_INVALIDATION=1` → which class / attribute change scheduled them;
   `KEY_TRACE_SELECTORS=1` → Chromium's selector stats) and `tests/e2e/console-style-cost-probe.spec.ts`
   (`STYLE_COST=1`: one full style pass as shipped · without the universal-bucket rules that match nothing · without
   every rule that matches nothing). What they said, `colony-trade-hub`, CPU ×4:

   | Question | Number | So |
   | --- | --- | --- |
   | the baseline's long frames | 40 of 0.56 – 0.94 s in 36 of 456 walks; 34 are a key listener, forced layout 60 – 80 % | a press under load waits on style + layout, not on a net |
   | a walk of 60 presses | key events 4.5 – 7.2 s in all, forced passes 2.0 – 3.7 s (≈ 52 %) | half of a press is the browser's own pass, asked for early |
   | read-after-write loops | one forced pass per mount at the first reader (`ConsoleHandRevealLayer.anchor`, `CardZoomModal.fitCardToViewport`, `ConsoleDossierCards.overflows`, `useWorkspaceBandGeometry`); the only real ladders are the measured fit engines (`ConsoleParliamentVoteMode.fitReading`: a step, a pass) and GSAP's first read of a transform (3 – 9 elements a pass) | no thrash to remove: the first reader pays the pass the frame owes anyway |
   | the DOM | 1 058 – 1 570 elements, 1 700 – 2 200 boxes | size is not the cost |
   | how much one press restyles | 800 – 1 250 elements a pass (`ConsoleHandRevealLayer` 807, `ConsoleDossierCards` 1 256, the standard projects 1 088) — `Related style rule` on every `.board-space` × 8, scheduled by the ROOT's state classes (`con-root--ws-open`, `--rail-replaced`, `con-handdock--*`) | THE lever: the reach of a root state class |
   | one FULL style pass (1 058 elements) | 105.9 ms → 94.7 ms without the 209 universal-bucket rules that match nothing (11 %) → 82.1 ms without all 21 605 rules that match nothing (22 %) | re-keying selectors and deleting dead CSS are NOT the lever (≈ 78 % is the rules that apply) |
   | the sheet | 22 242 rules, 5.1 MB; 242 rules with a universal-bucket selector (`[class~="col-"]` — dead, tried 11 969 times for 0; `:is(…):has(…)`, `.x + *`, `[class*="--embed"]`) | a cleanup worth 11 % at most — an option, not a class |

   *What follows:* a root state class that restyles the board is the price of «one frame, the board dimmed under a
   workspace» — reducing its reach (the board's rules keyed off ONE ancestor of the board, a container's own state
   instead of the root's) is a redesign of the sheet, to be judged against a number from the BOX (the TV profile, 4K)
   and from the field's long frames per scene — not against a throttled laptop. Until then: the probes stand, and
   nothing here is called fixed.

---

## 5. Part D — PROVE

| Number | Bar |
| --- | --- |
| unhealed episodes on the fixed monkey set (every seed, every perturbation) | 0 |
| healed episodes | → 0; each one left is an open class with an owner |
| fires of a net on the fixed set and in the field window | 0 → the net is removed (listed with its evidence) |
| frame budgets of the key scenes on the box (TV profile) | kept |
| the cost: the TIMING set and the bundles, before / after | no regression |

The release gate reads the monkey's report: a NEW class, or a number that regressed, stops the release.

**THE COST, measured (2026-11-15, the production build):** the whole program — the cause classes and the evidence,
the last line and its two askers, the pulse, the trail, the coverage marks — is **+26.9 KB of `main.js` (2 988 381 →
3 015 238 bytes, +0.90 %), +5.1 KB gzipped (668 190 → 673 289, +0.76 %)**; `vendors.js` is unchanged within 0.4 KB.
On a healthy second it runs nothing new but one counter increment a second (the pulse) and one array push a press
(the trail); evidence is taken only when a defect is named. *Open:* the TIMING set before / after on the box.

**THE GATE THAT NEEDS NO BOX — `npm run gate:freeze`** (`scripts/freeze-gate.mjs`, 2026-11-14 night): ① the replays of
every closed class (`npm run test:bottle`), ② the monkey in the bottle over every table (the box monkey's own walk
by its seed, on the manual clock — deterministic), ③ `monkey-report --against tests/client/bottle/monkeyBaseline.json
--gate` — exit 3 on an episode that was never cured or on a DEFECT class the baseline does not hold. ≈ 35 min of a
laptop in two shards; `--only <regex>` for a slice, `--report-only` to judge the pass on disk again,
`--write-baseline` to accept a pass (the notes are kept; a new row starts without one). The baseline is the list of
classes the bottle is KNOWN to name, each with WHY it may stand — guarded (`freezeGateBaseline.spec`: a row without
its reason is red in the unit run), because it is the one place a class could be waved through. *What it is not:*
the bottle has no layout, no paint and no real time — geometry, the compositor and the perturbed passes stay the box
monkey's (`tests/e2e/console-monkey.spec.ts`, `--gate` there too). *Wiring it into the release workflow or CI spends
runner minutes — the owner's call.*

---

## 6. Decision journal

| # | Decision | Alternatives | Why |
| --- | --- | --- | --- |
| F1 | **The cause class is a PURE function of the line** (the shape table + the line's structural parts); the supervisor prints the words the class needs (`task:`, `top:`, `holder:`) | a structured object carried beside the line as the only source; a hash of the flow tree | Four readers must agree (the page, the hub for main / server lines, the e2e harvest, the monkey) and three of them only have the text. A function of the text is one implementation for all four; the guard pins every site to a shape, so a reworded line cannot silently change class. The tree is EVIDENCE — it varies with timing and would shatter a class |
| F2 | **The outcome, the cure, the card and the duration are DIMENSIONS, never part of the key** (today's fingerprint carries `healed` / `unhealed`) | keep the outcome in the key | One cause heals in one session and ends in a reload in another; split by outcome, the worst occurrences of a defect are filed apart from the rest of it |
| F3 | **Evidence comes from a PROVIDER the console registers with the interceptor**, called once per defect line; an acting net captures BEFORE it acts and hands the snapshot over with the line | every site builds its own evidence; capture on every line | The interceptor must stay free of the console (it runs before the app exists); one provider = one bounded shape; nothing is paid on a healthy second |
| F4 | **A planned wait is not an event: it is a count in the session ledger** | sample it; keep it as an event with a low budget | 5–8 planned ceilings a game evicted the same family's real `dead-end` from the budget of 8 and would spend the month's quota with a handful of players; a count keeps the frequency, which is all a planned wait has to say |
| F5 | **The denominator is our own session event** (one per app run, sent at the next launch) | Sentry release health (sessions); a metrics product | The hub is the one sender and already keeps a day's state on disk; one event per run carries the play time, every net's fires and the episodes' outcomes — exactly the numbers the bar is made of — and costs one event of quota per session. Release health has no place for a custom counter and no play time |
| F6 | **The work is done in a worktree and lands in the main clone after every push** | work in the main clone | A neighbour session holds uncommitted work there (`package.json`, the e2e drivers) |
| F8 | **The last line ships at depth `page` FIRST** (the document replaced behind the curtain), asked only for `unserved`, bounded once per question and 3 per 5 min; depth `shell` waits for the module-state guard to reach zero | ship the in-page remount first; rebuild on `presses-no-effect` too; no bound | The page depth is complete by construction TODAY and uses a visual the game already has (the curtain of every navigation); an in-page remount is only as complete as the list of module state the session's end reaches, and 554 declarations are not on it yet — a rebuild that leaves a latch behind is a freeze with extra steps. `presses-no-effect` is judged on a screen that ACCEPTS: taking it away for presses nobody took would cost a working screen. Unbounded, a table no client can serve would reload for ever |
| F9 | **The bottle is its own runner entry** (`npm run test:bottle`, `*.bottle.ts`) — not in the unit glob | leave it in `tests/client/**/*.spec.ts` | It boots whole applications and loads the game server into the runner's process: a minute of the unit suite and a server's module graph beside 8 000 unit specs. It is an instrument (like the monkey), run at milestones and by its own gate |
| F10 | **A DEAF screen reaches the last line by the player's OWN next press, never by time** (revises F8's «only for `unserved`») | leave `presses-no-effect` to the ladder alone (F8); rebuild a deaf screen on the same 4 s clock as an unserved one | F8 left a hole exactly where the player is most sure the game is dead: a screen that says it accepts and takes no A / B, the ladder spent — and then nothing, for ever. Time cannot judge it (by its own account the screen works — a player may read it for a minute), but the player's hand can: a press that lands PAST the spent ladder and moves nothing is the one witness that is both theirs and current. The decision is a pure step (`consoleLiveness.lastLineStep`), the bound is the rebuild's own (once per question, 3 per 5 min). It reads the verdict's FACT (`unserved`), not its name — the first version read `reason`, and a player HAMMERING an unserved screen (filed `presses-no-effect`: the presses win the name) would have been asked for one more press, and under F8 was never rebuilt at all |
| F11 | **The delivery contract's VERDICT is judged in the page, by a witness OUTSIDE the judged — not by the server** (revises §4 item 7's «the server judges … answers `resync`») | the page reports its verdict with every poll and the server answers `resync`; a formal model of that protocol first | Written down, the server-side judge covers nothing the page does not: (a) while the supervisor runs, the page already holds the verdict AND the last line — a round trip to be told what it knows; (b) when the supervisor does not run there is usually no transport either (the board binder that owns the poll is the shell's child) — a `resync` has nobody to reach; (c) a renderer that does not run at all is the main process's hang watch. What was really missing is narrower and local: *the judge's own liveness*. A pulse counted outside the shell answers it with one number and no protocol — and its control is a real app in the bottle, not a model of one. The identity half (the server names the prompt, the page names what it displays) stays on the wire, where it belongs: only the server knows what is asked |
| F12 | **The last line stays at depth `page`; depth `shell` (the in-page remount) is not built, and the module-state ratchet is not burned down** (revises §4 item 6's order (b) – (c)) | burn the 554 undeclared declarations down and key the shell by a session epoch | The burn-down was the price of an INSTANT rebuild. But a rebuild is a defect whose bar is zero — its speed matters only if rebuilds are routine, and they must not be; the page depth is complete by construction and costs the curtain the game already shows. And the class the burn-down would also have closed — state of one game leaking into the next — cannot form today: a game session is one document (every game boundary is `navigateWithCurtain`). The guard stays as a ratchet so that an in-app road into a game, if one is ever built, starts from a list that did not grow |
| F13 | **R16's script-and-style half ends in a MEASUREMENT, not a law** | write «a handler reads no layout it has just dirtied» and a forced-layout budget per key event as an e2e ratchet; re-key the universal-bucket selectors; delete the dead desktop CSS | The probes say the premise is false: there is no read-after-write thrash to forbid (one pass per mount, owed anyway), selectors are 11 – 22 % of a style pass, the DOM is small. A count ratchet of forced passes would be a gate on a number that depends on which tween is in flight — a flake by construction (the owner's rule, 2026-11-04). What a press pays for is the REACH of the root's state classes — a redesign to be weighed against the box's and the field's numbers, with the owner where it shows |
| F14 | **A new judge starts as an OBSERVER — and its cure is chosen on a REAL PAGE** (the oscillation; observed 2026-11-15, armed on the number it asked for: 0 lines over the box's 606 walks and the bottle's gates; **its first cure — the arbiter's ladder — was withdrawn the same day: on a real page the rungs fed the loop, see row A8; the cure that stands is the last line, asked directly**) | arm it at once — it is unit-proven | The arbiter's cure is a ladder that releases holds and, past it, a page that replaces itself: a judge that is wrong on ONE healthy table takes a working screen away from a player. A pure spec proves the judge against the pictures I thought of; the monkey's 606 tables in the bottle and on the box prove it against the ones I did not. So the line and its evidence ship first (a defect CLASS if it ever fires), and the arming is one edit made on a number: zero lines over the passes |
| F15 | **The server's last line is THE LOADER'S ROAD, live — not a reload from the save, and not an invented answer** (2026-11-15) | drop the game from memory and deserialize its last save (the server's mirror of the page's rebuild); auto-answer a question that has no answer (clamp `min`, skip the prompt) | A reload re-runs what was pending — and the commonest dead table is a bot turn that throws, which the loader would run again: the second throw made the game UNLOADABLE, a strictly worse end than the one being cured. So the cause is contained at its source (the turn ends honestly), and what is left for a table found dead is the recovery the game already has for exactly this state (`deserialize`'s action-phase branch), taken once and reported. And a question with no answer has no generic one — which card would the seat have picked? An answer invented by the transport is a rule nobody wrote; the engine's defect is SAID (by the server, with the save beside it) and fixed in the card |
| F16 | **The view's delivery is judged by THE SAME arbiter with a truer input — «asked» is the poll's word — and its cure is the last line; no new net, rung or door** (2026-11-15) | a watchdog of the poll chain in the supervisor; a rung «re-fetch the view» on the ladder; a server-side `resync` | The class «the view never arrived» has many causes and one shape: the server waits for this player and the page does not know. A net per cause (a chain watchdog, a park watchdog, a fetch watchdog) would be three more things to keep honest; the arbiter already owns the invariant and the ladder, and what it lacked was only the FACT — it trusted the very view whose arrival was in question. The two causes that can be closed by construction are (the chain's guarantee, the park's bound); the judge stands for whatever is left, and its cure needs nothing new: a rebuilt page gets its view by the boot road, with no scene, no park and no previous view to differ from. A «re-fetch» rung would add nothing — the poll already re-fetches on every look |
| F17 | **A question nobody can answer is REFUSED where it would be asked — the engine's own law for `SelectSpace`, extended to every kind** (2026-11-16; revises F15, which left the class «said, never cured») | leave it named and fix each card as it is reported (F15); answer it for the seat (clamp `min`, skip the prompt); roll the game back to the save before the action | F15 was right that an invented ANSWER is a rule nobody wrote — and wrong that nothing else was possible. The engine already refuses to build a placement with no legal cell: the action fails in the request that tried, and `Player.process` puts the seat's question back. That is not an answer; it is the action not happening — the one outcome that is true to «this cannot be done». A dead question, by contrast, ends the TABLE: no page can serve it and no rebuild helps. Extending the refusal costs one structural read at the one point every question passes, and its false-positive risk was measured before it shipped (no path of the engine in 23 064 server tests builds such a question). A rollback was rejected: it rewrites history the other seats have already seen |
| F7 | **B3 — the console in a bottle — is the base of both the replay (R10) and the composition check (R11)** | a TLA+ / Quint model of the protocol kept in sync by a guard; replay only as an e2e re-drive on the box | A hand-written model proves the MODEL; the freezes live in 100k lines of real decision code that no model keeps up with. The real shell on a manual clock against the real server is the system itself, searchable at unit speed and shrinkable. A formal model stays an option for the one protocol small enough to state (the question's delivery, C·7) |

## 7. Specs to look at first in the CI run (running list)

| Milestone | What moved | Specs |
| --- | --- | --- |
| A1 – A6 | the arbiter's line gains `task:` · `top:` · `holder:` after `asked:` (its fixed words and its three readers unchanged) and reads its claim / holds BEFORE the rung runs (was: after); a ceiling wait that declares `planned` ends its line with `(planned: …)`; every other line is unchanged. The supervisor takes an evidence snapshot when a defect's line is printed (once per record — the flow tree, the wait table, the trace). The harness files `cause-classes/*.json` per test (data), the monkey notes its presses there; `livenessGuard` lets a spec that DECLARES the stall as its subject pass (`EXPECTS_LIVENESS_STALL`). The developer's notice no longer rises for a `planned` / `info` line | anything that reads the liveness line: the e2e `livenessGuard`, `console-wait-graph-*`, `console-screen-*-control`, the console export's STALLS digest; `console-diagnostics` (the notice, the journal's rows); the new control `console-stall-cause`; `console-monkey` (its `monkey-walk` file is unchanged, a `cause-classes` file is new). Pointwise on the box before the push: `aaa-driver-canary`, `smoke`, `console-wait-graph-control`, `-dead-end`, `console-screen-shadow-control`, `console-screen-director-cure`, `console-diagnostics`, `console-liveness-noop-presses` — 17 / 17; the final build of A: 11 / 12, the red being `console-wait-graph-dead-end` :19 on the ARBITER's line — the control's own race on a loaded box (its `settle` was swallowed, the hand's opening hold was still live when the frame was stripped, so the graph saw no dead end and the arbiter's 4 s stranded grace came first); 9 / 9 on three repeats; the precondition is asserted since C6b |
| C6a – C6b · B3 | **PAST THE LADDER'S LAST RUNG THE PAGE REPLACES ITSELF** (an `unserved` stall with nothing left to release, 4 s later): a spec that stands on a spent ladder for longer now sees a navigation — it says `&rebuild=0` in its URL (then the line `[session-rebuild] refused (off)` is printed once) or expects the rebuild. `livenessGuard` is red on any `[session-rebuild]` line too; `productReloadGuard` names the rebuild's navigation. **A Vue error of a Vapor component is PRINTED again** (`[vue-error] <chain> · <phase>: …` — since `createVaporApp` the handler threw on the instance and the line never came): `vueErrorGuard` may now turn red where an error was silently lost before — each such red is a real product error that was invisible. The reactivity witness's watchers moved to a detached scope (no behaviour on a page that mounts the shell once) | `console-stall-cause` (rewritten: rebuilt once → served again → the second strand refused; and `?rebuild=0` → the player's own reload ends the episode as `reload`), `console-wait-graph-dead-end` (the strand's precondition asserted: no live hold), every spec `vueErrorGuard` covers; unit: `sessionRebuild.spec`, `moduleStateGuard.spec`, `vueErrorReport.spec`, `reactivityWitness.spec`, the diagnostics specs; `npm run test:bottle`. On the box before the push: 17 / 18 — both tests of `console-stall-cause` green; the red, `console-diagnostics` :146, read an ENGLISH title where the spec expects «Отчёт сохранён и уйдёт позже»: the wrapper mirrors `assets/` — the GENERATED `assets/locales/ru.json` with it — into the box's SHARED `repo/assets`, the neighbour session's sync (an older locale build) overwrote it while this run waited 24 min for tokens. Not the product; told to the session that owns `scripts/e2e-remote.mjs` (generated locales belong to the task's own set) |
| C · classes 1 – 2 | **THE WHEEL'S «ПАРЛАМЕНТ» WHILE THE SITTING'S PLATE STANDS OPENS THE SITTING** (the plate's own door — `openMandatoryAnnounce`), never a lateral overview beside it: a spec that opened the overview from the wheel under a held sitting plate now gets the sitting stage. The start director's shadow no longer files «firstAction ≠ game» for a first action the player minimized | `console-eden-alliance` (new test D, both presets), every `console-parliament-sitting*`; unit: `consoleMandatoryGate.spec` § a flow's plate, `startDirector.spec`; `npm run test:bottle` (`classReplays.bottle.ts`) |
| C · classes 5 – 7 · A8 | **OVER A LIVE PLACEMENT, AN OPEN SECTION OWNS THE BAR** (the hand opened from the wheel while a cell is being picked: «Рука … B На поле», was the placement's «A Выбрать клетку») — a spec that reads the bar there reads the section's verbs. The screen shadow holds a lateral surface over a live placement (`lateral:<kind>`) and judges a blind announce by the ANNOUNCE's own clock (the plate gone continuously for 2.2 s — was «three 1 Hz looks»): a spec that covered the plate twice inside the beacon's dwell no longer sees a `[screen-shadow]` finding nor its cure. The freshness witness does not heal while the root holds a parked refresh (no `[presentation-ledger] witness-heal view-freshness` line under a scene), its heal names what it is made of, and the parked refresh's overdue line ends with ` — held by <scenes>`. The supervisor prints two new DEFECT lines when their subject stands — `[liveness] oscillating — …` and `[question] unanswerable — …` (a spec whose fixture asks a question with no answer, or whose surface flips by itself under a live question, turns red on them — each such red is real) | the new `console-placement-lateral`; every spec that opens a wheel section over a placement (`console-placement-*`, `console-parliament-skyscrapers`, `console-parliament-biodome`, `console-start-held-placement`); `console-screen-shadow-control`, `console-screen-shadow-rows`, `console-screen-director-cure`; `console-parliament-announce` (the plate / beacon hand-over); whatever `npm run e2e:affected` lists for the transport and the root (the mid-prompt refresh and the remote-move specs among them); unit: `screenShadow.spec`, `consoleMandatoryGate.spec`, `viewFreshness.spec`, `deferredViewRefresh.spec`, `livenessOscillation.spec`, `promptAnswerable.spec`, `diagnosticsCause.spec`, `freezeGateBaseline.spec`; `npm run test:bottle` (7 replays, 16 tests); `npm run gate:freeze` (seeds `fz0`, `fz1`). On the box before the push: the affected set in chunks (snapshot `fz3`) |
| A8 · the loop is ended | **A SURFACE THAT FLIPS BY ITSELF UNDER A LIVE QUESTION, UNTOUCHED FOR TWENTY SECONDS, REBUILDS THE PAGE**: ≥ 6 flips among ≤ 3 pictures in 10 untouched looks, still turning → `[liveness] oscillating …`; ten looks later, if it goes on → `[session-rebuild] page — «<task>» (<question>) — by liveness: the picture turned in a loop for 20s with no press …` (no `[liveness] stall` line: the ladder is not walked for a loop). A spec whose screen oscillates by itself under a question for ~20 s with no press sees a navigation — and that red is the product's. Any press of any device restarts the spell. New control seam `__conBlinkSurface()` (only under `?waitGraphControl=strand`). The monkey's «last word» is 25 s (was 14 s) — in the bottle (`TM_BOTTLE_MONKEY_IDLE_MS`) and on the box | `console-stall-cause` (new test «a screen that moves and goes nowhere»), `console-monkey` (each walk is 11 s longer), `console-wait-graph-*`, `console-screen-*-control`; unit: `livenessOscillation.spec`; `npm run test:bottle` (tests 15, 15a); `npm run gate:freeze` |
| V · the view's delivery | **A FAILURE OF THE VIEW'S ROAD IS NEVER A NATIVE `alert`** — a spec that waited for the browser dialog «Error getting game data» now sees one line (`[view] fetch failed …`) or a rebuild (`[session-rebuild] page — «view-apply» … by view`), and under the loading curtain its error state, as before. **THE POLL**: its answer is taken inside a `try` (a throw is `[transport] the poll's answer could not be taken …`, the chain goes on) and a request with no terminal event is cut and re-asked 20 s later (`[transport] the poll never ended …`); the transport's scope shows one more guarantee while a poll is on the wire («the poll's answer» — a spec that counts the scope's waits sees it). **A VIEW PARKED BEHIND A SCENE FOR 35 s IS COMMITTED OVER IT** (`[deferred-refresh] «<scenes>» held the view for over 35000ms — the view is committed over it`). **THE ARBITER JUDGES A QUESTION THE PAGE WAS NEVER GIVEN** (the poll says GO, the applied view asks nothing, for longer than its holder may excuse): `[liveness] stall (unserved) … asked: undelivered; … holder: view:<who>` — and past the ladder a rebuild; any spec that holds the view back from the page on purpose (a held fetch, a scene flag left raised) for more than ~55 s now sees it. The root's fetch of the view carries an abort signal and a 15 s bound | everything `npm run e2e:affected` lists for `gameTransport.ts`, `App.vue`, `supervisorController.ts`, `deferredViewRefresh.ts` (the whole console set, in effect); first: `aaa-driver-canary`, `smoke`, `console-stall-cause`, `console-wait-graph-*`, `console-screen-shadow-control`, the remote-move specs (`console-colony-remote-bonus`, `console-parliament-sitting-v2-remote`, `console-reveal-remote-bonus-collision`), the bot-turn specs (`console-bot-*`); unit: `gameTransportPoll.spec`, `gameTransportFunnel.spec`, `viewFailure.spec`, `deferredViewRefresh.spec`, `viewDelivery.spec`, `stallEvidence.spec`, `nativeDialogGuard.spec`, `diagnosticsShapes.spec`, `moduleStateGuard.spec`; `npm run test:bottle` (9 replays); `npm run gate:freeze` |
| S · the question that is not asked | **`Player.setWaitingFor` THROWS `UnanswerableInputError` for a question unanswerable by construction** («pick N cards» of fewer, an OR with no live branch, nobody to choose, `max < min`; never an optional one). A spec — server or e2e fixture — that hands a seat such a question by hand (an empty `SelectCard` with the default `min` 1 as a placeholder) now fails at that line: give it `{min: 0}` or a real list. In a game the action that would have asked it answers HTTP 400 with «A question nobody can answer was not asked — …» and the seat's question stands | server: `tests/liveness/TableLiveness.spec.ts`, `tests/routes/PlayerInput.spec.ts`, `tests/routes/promptStaleness.spec.ts` (its placeholder prompt), the whole `tests/cards/**` (none refused — measured); e2e: any spec whose fixture arranges a prompt through the dev API |
| S · the server | **A MARSBOT TURN THAT THROWS NO LONGER STOPS THE TABLE**: the journal gains «… не смог завершить ход — остаток хода пропущен» (and «Эффект хода … не удалось применить — он пропущен» for a deferred effect), the turn ends, the game goes on. The poll (`/api/waitingfor`) looks at the table once per request; a table with nobody asked for 5 s is reported and, in the action phase, re-asked by the loader's road (`gameAge` moves — the pages refresh). A prompt with no answer is reported when its model is built. No wire format changed | server: `tests/automa/*` (the turn, the scheduler), `tests/liveness/TableLiveness.spec.ts`, `tests/routes/ApiWaitingFor*`, `tests/inputs/deferredInputBatch*`; e2e: every MarsBot spec rides the bot's turn (`console-bot-*`, `*-marsbot*`) — none should see the new journal lines |
| C6c · the pulse | **A GAME SCREEN WHOSE SUPERVISOR COMPLETES NO PASS FOR 15 s REPLACES ITSELF** (`[session-rebuild] page — «no-pass» / «no-shell» … by pulse`): a spec that deliberately breaks or removes the shell's supervisor on a standing game screen now sees a navigation. The app's root arms one 5 s timer on the page's scope («the supervisor's pulse witness» in the kernel's wait table — a spec that counts the page scope's waits sees one more). The supervisor's tick is now a block (`checkLiveness(); noteSupervisorPass()`), behaviour unchanged. The bottle's document is VISIBLE now (jsdom's default is `prerender`) | `console-stall-cause` (new tests «who watches the watcher» and «the player's own way out» — on a dead screen with the last line off the Menu button still opens the system overlay), `console-gamepad-reload-carryover`, `console-system-menu`, `console-colony-venus-unity-bonus` (the laptop, 13 / 13); unit: `supervisorPulse.spec`, `moduleStateGuard.spec`; `npm run test:bottle` (test 13) |
| C6b · the deaf screen | **A SCREEN THAT ACCEPTS AND TAKES NO A / B NOW REPLACES ITSELF TOO** — only after the ladder is spent, 4 s have passed AND the player pressed again to no effect (`lastLineStep`): a spec that keeps pressing a deliberately dead confirm past a spent ladder now sees a navigation (it says `&rebuild=0`, as the spent-ladder specs already do). No-op presses (X / ←) are still no stall at all | `console-stall-cause`, `console-liveness-noop-presses`, `aaa-driver-canary` (the laptop, 6 / 6); unit: `sessionRebuild.spec` § when it is due, `consoleLiveness.spec` |

---

## 8. THE SECOND PHASE — maturity («надёжно как швейцарские часы»), proposed to the owner 2026-11-17

The first phase answered «a freeze is seen, named, and ended» — nets, a last line, a gate. The owner's ask for the
second (2026-11-17, budget unlimited, weeks): **the states and the transitions themselves become correct BY
CONSTRUCTION, and the nets fall silent — both ways: no freeze, and no false alarm.** Where the base stands, by number
(2026-11-17): 12 rungs on the arbiter's ladder · 35 families of diagnostic lines · 554 undeclared module-state
declarations · 14 rows of «the bottle is blind here» · flows walked 55 % of 280 · machine moves walked: frame 35 %,
submit 25 %, claim 3.7 % of 242 · every perturbed box pass still names 1 – 2 classes that are not freezes.

**STAGE 0 — the tails of phase one (2026-11-17):** *done* — the duo pair is ONE cause and closed by stage 1's own law (§4: the frame witness — the first guess was wrong by the page's own lines, the box said why); `view-freshness` under CPU ×4 closed by extending «a debt with an owner» to a debt being paid; the refused question reaches the player in THEIR language (`AppErrorId.UNANSWERABLE_QUESTION` → a fixed i18n key, RU in `ru/ui.json`; an English interface reads the English key) and the view is re-fetched. *Open:* `start-stranded/confirmed/or` (CPU ×4, 1 of 606, not reproduced in 14 runs — §4); the box pass `fzproof-fz1` stopped at 5 shards of 8 with the laptop's session (shards 5 · 7 · 8 owed: `monkey-lanes.mjs … fzproof-fz1 …` on a fresh snapshot); bottle seeds `fz4 … fz6`; A7 (the release probe). **CI is the verdict (the owner, 2026-11-17 — the box is for pointwise runs):** what CI needs from this program is a workflow of its own — the freeze gate (`gate:freeze`, a seed an input) and the monkey's matrix by shards — dispatched and read with the GitHub CLI. **GRANTED 2026-11-17** (`gh` on the laptop; ⚠ ALWAYS `--repo victor-zelinskiy/terraforming-mars` — in this clone `gh` resolves the UPSTREAM repository by default). **THE DIVISION OF WORK (the owner, 2026-11-17): CI carries the load, the laptop is spared, the box is for pointwise runs — never a whole pass.** `Freeze gate` (`.github/workflows/freeze-gate.yml`: the bottle, a job per seed) · `Monkey` (`.github/workflows/monkey.yml`: the real-browser monkey over every table in shards, `perturb` = none · cpu4 · cpu6 · net400 · net1500 · reload · duo, judged against `tests/e2e/monkeyBaseline.json` — the box's proof pass, 0 defect classes) · `Playwright E2E` (the whole suite). `gh workflow run "Monkey" --repo … --ref main -f seed=fz1 -f perturb=cpu4` · `gh run watch <id> --repo …` · `gh run download <id> --repo … -n monkey-report-<id>-1`.

| Stage | What becomes true | Exit — a number, never an impression |
| --- | --- | --- |
| **1 · THE NETS FALL SILENT** (1 – 1.5 wk) | every bound is measured on the clock of the thing it bounds (frames / visible time for a motion, the server's word for a question — the law already used for the announce, generalised); every line's tier is decided by WHO OWNS the wait, never by a duration; a hidden / starved page is a state the judges know | the perturbation MATRIX (CPU ×4 · ×6, net 400 · 1500 ms, reload, duo, hidden tab, no GPU) × 3 seeds × 606 tables: **0 defect records** on healthy tables; the bottle's blind list shrinks only |
| **2 · ONE OWNER PER QUESTION, BY A TOTAL FUNCTION** (2 wk) | PLAN §4 structural 1 – 3: «who serves the question» is ONE pure total function of (task, stack, claim, placement) with no «not found» — the surfaces, the pad ladder and the command bar are DERIVED from it (the screen shadow and the start shadow stop being checkers of a second opinion: there is no second opinion); owed steps are children of their frame | exhaustive spec of the function over the whole product of its inputs; `screen-shadow` / `start-shadow` / `console-leak-detector` lines impossible by construction → their nets retired |
| **3 · EVERY WAIT BOUNDED AND OWNED, STATICALLY** (2 wk) | PLAN §4 structural 4 – 5: every reaction and scene is a kernel scope whose end is guaranteed (the nine scene flags audited 2026-11-15 — each can stick — become runs: a flag IS a scope's life); a wait on a reactive condition is a node of the wait graph; `kernelCoverage` (raw timers / frames outside the kernel) and the «flag lowered after a call that may throw» pattern at zero by guard | `kernelCoverage` ratchet = 0; a new guard «a scene's flag falls in a `finally` / a scope's end» = 0; the wait graph sees 100 % of waits (no reactive wait outside it) |
| **4 · THE STATE SPACE IS WALKED, NOT SAMPLED** (2 wk) | model-based walks: every transition of every registered machine is driven in the bottle from the machine's own definition (shortest paths), every declared flow opened or declared unreachable WITH a reason (a ratchet); fault injection for every transport outcome never seen today (`sending → failed · refused · silent`, `presenting → abandoned · failed · staged`), the socket, a held / failed / malformed answer, a 500, a stale prompt; the monkey steers by coverage (the corpus) | machine moves 100 % walked-or-declared; flows 100 %; each injected fault ends in «served» or «rebuilt once», never a standing screen |
| **5 · THE SERVER AS AN EQUAL** (1.5 wk) | an engine fuzz: random legal games over every in-scope expansion and map, with MarsBot, checking after EVERY request — somebody is asked or the bot is on its way or END · no unanswerable question · the deferred queue is drained · save → load → the SAME question (reload equivalence) | N million engine steps nightly, 0 violations; every violation is a shrunk seed + a card fix |
| **6 · WHOLE GAMES AND TIME** (1.5 wk) | an autopilot that plays WHOLE games through the real UI (first press → final scoring; the monkey walks 60 presses from a fixture and never ends a game), soak runs of hours (leaks, timer drift, the 4K TV profile), frame budgets of the key scenes on the box (R16's native half) | 100 whole games per map set, 0 episodes, 0 rebuilds; an 8-hour soak with flat memory and no long-frame growth |
| **7 · NETS RETIRE BY EVIDENCE · THE GATE · THE FIELD** (1 wk, then standing) | each net with 0 fires over the matrix AND a law that closes its class is switched to observer, then removed — the end state is ONE arbiter, ONE last line, the pulse; the gate runs on every release (`gate:freeze` in CI + the nightly box matrix); the field's number is read per release (`npm run diag -- trend`: episodes and rebuilds per 100 h of play) with an alarm on a NEW cause class | ladder rungs 12 → the few that still fire for a named reason; a release cannot ship on a new class; the field window: 0 unhealed, rebuilds → 0 |

**STAGE 1 — EXIT REACHED 2026-11-20 04:19 UTC.** The stage's number is met on ONE commit (`ab6ad53eba`): the
perturbation matrix — CPU ×4 · ×6, the net at 400 · 1500 ms, a reload, two windows, a hidden tab, plain — × 3 seeds ×
606 tables in a real browser, **0 defect records in each of the 24 cells** (§4, the matrix's row; fifteen cells on
CI, nine on the box at the same commit). What it took is §4's rows of 2026-11-17 … 19: bounds read on the clock of
the thing they bound, tiers decided by who OWNS the wait, a starved page as a state the judges know. «No GPU» is
CI's own condition (its runners have none); the box's nine cells are the GPU's half.

**STAGE 2 — EXIT REACHED 2026-11-23 20:13 UTC.** «Who serves the question» is ONE total function, the surfaces, the
pad's ladder and the bar are derived from it, and the nets that judged a second opinion are gone or observers: the
screen shadow observes, the start's two timers became the opening's and the strand's doors by level, and behind a
finished frame stand its owner's doors by level and nothing of seconds — the stale free-turn reaper is deleted, the
ghost's teardown is the debt's own door. CI's verdict on the head that carries the last of it (`af6a97cc9c`): **the
whole e2e suite green — run 45242383549, 1 497 passed · 5 skipped · 0 flaky, twelve shards and the burn-in; not one
line of `start-shadow` · `start-stranded` · `workspace-stall` (no ghost torn down anywhere), a debt reads «ghost» only
under a scene that is playing (616 ms at the longest, every one `busy[…]`), not one quiet beat; the freeze gate green
on both seeds (45242392823), and again one commit later with the beat law in it (45244613479).** The box's two-seat
pass on the same code is walking (`fzz-fz3-duo` → net 400 → CPU ×4). What the stage's literal row promised and did NOT
build, said plainly: «owed steps as children of their frame» — not planned (the decision of 2026-11-22): the ghost
TEST stays a sampled predicate, asked by one door, under quiet.

**STAGE 2, STEP 0 — the function exists, and nothing reads it yet (2026-11-19; the owner: «не простаивать, пока идут
прогоны» — while stage 1's matrix runs by itself).** The stage has two halves, and only the first may land before
stage 1 exits: the second changes what mounts, and the confirming pass must measure ONE code.

- **The map of today's decision** (read 2026-11-19, a working file `tm-fz-tools/stage2-shell-map.md`): who serves a
  question is decided in ≈ 25 computeds of the shell's controllers (each surface's own `v-if`), re-derived by the
  pad's ladder (33 ordered rungs) and twice by the command bar (≈ 35 and ≈ 60 ordered branches), and checked from
  outside by three nets. The copies are ALREADY apart: the pad and the bar write the task host's condition with half
  of the terms its own `v-if` has (`taskHeldForWorkspace`, `effectDecisionOwnsPrompt`, … are missing — the pad can
  go to a host that is not rendered); the bar and the pad order the composites differently; `corpFirstActionOpen`
  stands above the prompt surfaces in the pad and below them in the bar; `.con-sheet` is reached by elimination; a
  `composite` and an `unknown` prompt have NO surface at all.
- **`src/client/console/servingOwner.ts` — `servingOwnerOf(facts)`: ONE owner, at most ONE hold, never nobody.** The
  screen shadow's table (`screenDirector.ts` `EXPECTED` — sets of owners a suite of runs observed) narrowed to a
  decision: where a row holds two owners, the fact that chooses is an input (`effectDecision`, `draftFrame`,
  `draftClaims`, `startFlow`, `resolutionDraw`); a frame that EARNED the kind answers before the kind's row; a step
  of a flow stands in that flow's zone (for the kinds that can be a step — the shadow's `HOSTABLE`); the holds have
  ONE order (the player's park · the board under the task's own placement — an owner, not a hold · a scene · a claim
  whose zone is not standing · an admission block), and a hold never changes WHO serves.
- **`tests/console/servingOwner.spec.ts` — the stage's exit spec, already exhaustive:** every shape of a question
  (`Record<TaskKind, …>` — a new kind fails the build) × every choosing fact × every hold, ≈ 1.6 million points:
  total; a REFINEMENT of the shadow's table (the function never names an owner the evidence does not allow — the
  spec caught two rows written from the code's words instead of the evidence: a resolution's draw is the SAME
  surface hosted by the sitting, not the Parliament's; a colony bonus is never a step); one order of holds.
- **Next, in this order:** ① THE MEASURE — the leak detector's pass computes `servingOwnerOf` beside the shadow's
  verdict and counts agreement with what is PAINTED (stats only: no line, no behaviour — `__conServingOwner()`; the
  monkey's coverage harvest sums it), until the function agrees with the screen on every settled look of the 606
  tables — a disagreement is a bug of the function or an ambiguity of today's shell, and each is read; ② the pad's
  ladder and the bar READ the function for their prompt rungs (the copies become one — the first behaviour change,
  after stage 1's exit); ③ each surface's `v-if` becomes `owner === X && serves`; ④ the three nets are switched to
  observers, then retired (stage 7's rule: by evidence).

**STAGE 2, STEP ① — THE MEASURE, as it reads 2026-11-19 02:10 UTC.** The counter rides the leak detector's pass
(`servingOwnerMeasure.ts`; the walks carry it, `monkey-report.mjs` prints «THE ONE FUNCTION AGAINST THE SCREEN»).
What each round of disagreements taught the function — every one a fact today's shell knows in some OTHER copy:

| Round | Where | Looks | Read | What the function lacked |
| --- | --- | --- | --- | --- |
| 1 | the bottle, 4 tables | — | 1 EXTRA | admission is a DOOR, not a presence — a workspace whose frame stands is not held at it (`frames`) |
| 2 | the bottle, tables a–h (174 walks) | 475 | 5 MISS, 2 pictures | the draft's door is the announce's (its admission is the section's); a screen being handed over to the owner is a hold of the owner (`handoff`); a phase root is never a step in somebody's zone; the park (a parked workspace that serves) and the yield to the board |
| — | **CI, a real browser: `fz3` · `reload`, 606 walks** (run 44432972892, on round 1's code) | 3591 | agrees 28.1 % · held as said 66.5 % · MISS 3.7 % · EXTRA 1.7 % — 11 pictures | 6 of the 11 were round 2's; 3 were the MEASURE's own (a step in a flow's zone is seen by the probe as its HOST; the board always paints — a held board is held as said); 2 were new ↓ |
| 3 | the bottle, the 13 tables of those pictures | 747 | **0 MISS · 0 EXTRA** (plain); 525 looks, 0 · 0 (with reloads) | THE PLAYER'S OWN LOOK OVER A LIVE PLACEMENT (`lateral` — the hand opened over the cells: the board waits for the player); a step the function holds for its host's own beat is held WHILE that host paints (the sitting's ask waiting for the field — the very state of issue #70: the pad's press goes to nobody there, by the beat's design) |

**The second reading in a real browser — CI `fz1` · `duo`, 606 walks, on round 3** (run 44447967288): 3538 looks —
agrees 42.3 % · held as said 57.5 % · **MISS 0.1 % (4 looks) · EXTRA 0.1 % (3 looks)**, four pictures (it was 5.4 % in
eleven): a parked draft / a parked first action that still PAINT (`EXTRA:aside` — the measure reads a parked root's
`v-show`; to be read by the facts each kept picture now carries), and the Parliament not yet painted under
`admit:card-arrival` / an animation hold (2 looks each). The bottle's whole plain pass on the same code: 3296 looks —
2 MISS · 0 EXTRA.

**The third — CI `fz3` · `duo`, 606 walks** (run 44454977625; 0 defect records, the gate GREEN): 3619 looks — MISS 1 ·
EXTRA 53 (1.5 %), four pictures, each printed with its facts. Three are ONE thing — «set aside» said of a workspace
whose frame is on the live stack and paints (the shadow: `agree:table`): ROUND 4 — set aside holds an owner the
player is AWAY from, never the workspace they stand on. ⚠ For the wiring: `consoleState.task.deferred` does stand
for seconds over the surface that answers (the record is taken up «on-its-surface» late or not at all for a
workspace) — when surfaces are DERIVED from the function, «aside» has to be exact, so that take-up is the
record's to make at the frame's entry.

**The fourth — CI `fz0` · `hidden`, 606 walks** (run 44462057391, round 3's code; 0 defect records, the gate GREEN):
**4248 looks — MISS 0 · EXTRA 0.** The first whole cell of a real browser on which the function and the screen agree
at every look.

**The fifth — CI `fz0` · plain, 606 walks, on the exit commit** (run 44488402026; 0 defect records, the gate GREEN):
3408 looks — **MISS 1 look · EXTRA 0**. The one look: the Parliament's door a second from opening (`frames []`, the
shadow `held:admit:card-arrival`) — a surface mounting ACROSS a look. The stage's own words are «every SETTLED look»,
and one look alone is not one: **the measure counts the first look of a disagreement as `unsettled`**; the same
picture on the very next look is the disagreement (`servingOwnerMeasure.ts`). **And the fold's witness said nothing
in this cell** — 606 walks on a page that paints, `arwind-chairman-quest-solo` among them: the Parliament leaving
the stack under a flying token (§ 4, issue #72) has been seen only on the page BEHIND so far; the cpu cells decide it.

The next reading is the matrix's own (the nightly runs on `main` carry round 4; the confirming pass stands on
`fz/stage1-exit` and carries round 3). The wiring (②) does not
start before the function reads 0 · 0 on a whole cell AND stage 1 has exited.

**STAGE 2, STEP ② — STARTED 2026-11-19 night (the owner: «продвигаться по имплементации этапа 2»; the confirming pass
of stage 1 stands on its own branch, so `main` may move).**

- **②a — the first copies became ONE** (`94f1df12f2`): the task host's input condition stood written out in the
  pad's ladder and twice in the command bar, «to be kept in lock-step» with the template's `v-if`.
  `routerController.taskHostOwnsInput` is that condition, once; the template's `taskHostRendered` is it AND the holds.
  No behaviour changes.
- **The pad's own measure** (`5063e07bbb` — `servingOwnerMeasure.measurePadPress`; the ladder is `routeIntent`, each of
  its ≈ 50 rungs names itself): at every press the function is asked on the facts as they stood BEFORE it, and the
  rung that took the press is read against the answer — `pad-agree` · `pad-held` · `pad-look` · `pad-beat` · `pad-MISS`.
  **Its first reading** (the bottle, 13 tables, 333 presses under a question): the owner's rung 25.5 % · under a hold
  60.1 % · the player's own look 14.4 % · another rung **0**. What it taught before any rung was rewired:
  **the ladder has two halves** — the views the PLAYER opened over the question (the inspection, a card's zoom, the
  wheel, the journal, a sheet read before choosing a cell) and the game's absorbing beats stand ABOVE whoever serves,
  by design; the function needs no word for them. So the wiring's shape is `looks → beats → the function's owner →
  free navigation`, and only the third band is derived. (And one fact: a SHEET over a live placement is a `lateral`
  look as a section is.)
- **The pad's first WHOLE reading** (the bottle on `main`, 606 tables, 2026-11-20: 22 995 presses, 2210 under a
  question — the owner's rung 22.3 % · a hold 51.9 % · the player's look 19.7 % · a beat 6 % · **another rung 4**).
  The four presses were two pictures, each a fact the function did not know — **round 5** (`3152f9de1e`):
  **the router's door** (a workspace the router OPENS for a question enters through the arrival chain's `followUp`
  admission beside its own — `ServingOwner.door`: «says parliament, the pad gave the board» was the sitting's door
  behind a card still arriving) and **a flow's steps take the pad** (a workspace that owns the question hands the pad
  to the frames standing above its own — a prelude's colony pick inside the opening: `OwnerNow.steps`). Re-walked on
  the five tables that named them: another rung **0**.
- **THE MAP OF THE HOLDS** (half of all presses under a question fall under a hold, and a `switch` on the owner says
  nothing of them): the verdict keeps WHO took the press — `pad-held:<kind>:<who>`, `own` · `look` · `beat` · the rung
  by name — and the report prints the map by kind. Its first reading (five tables): under a hold the pad is the
  PLAYER's — their look, a beat, the section or the sheet they stand on; no prompt rung. If the whole reading says the
  same, the derived ladder is `looks → beats → (the owner SERVES ? its rung : the player's own surface)`.
- **THE BAR AGAINST THE PAD** — the second copy measured directly: each of the 57 branches of
  `commandBarController.commands` names itself in the pad's vocabulary (`noteBarRung`), and at every press the branch
  the bar stood on is read against the rung that took the press — `bar-agree` · `bar-look` (a view the press opened,
  or one with a strip of its own) · `bar-beat` (a beat absorbed under a standing bar — read by its pairs) ·
  `bar-APART:<bar>><pad>` (the two copies apart). Stats only.
  (`74adbcd57c`: a press that OPENS a view — `info:open` — is told from a view that STANDS; a standing view the bar
  does not stand on is `bar-APART`, never a `look`. Only a view with a strip of its own — the card viewer, a toast —
  is excused.)
- **THE SURFACES' OWN CONDITIONS against the function** (`c04e738e2a` — the measure step ③ needs): the thirteen
  conditions the prompt band reads (`deckPickServing` … `taskHostOwnsInput`, `corpFirstActionOpen`) are read on every
  look of the leak detector's pass, ALL that hold at once (the ladder stops at the first): `flag-agree` ·
  `flag-held` · `flag-MISS:<owner>` · `flag-EXTRA:<why>:<flags>` (a condition that holds with no surface the function
  gives it — two answers to one question). First reading: 146 looks, MISS 0 · EXTRA 0.
- **THE BAND, DERIVED** (`eb06bcb112` — the last measure before the swap): `derivedBandRung` is the switch itself,
  written as a pure function of the function's answer — `own:<rung>` · `step` · `ws` · `held:<kind>` · `free` — and at
  every press its ONE word is read against the rung the ladder took: `band-agree` · `band-above` (a look, a beat) ·
  `band-APART:<derived>><rung>`. First reading (five tables, 193 presses): APART 0.
- **THE RULE OF THE SWAP:** the switch replaces the ladder's prompt band when `band-APART`, `pad-MISS`, `flag-MISS`,
  `flag-EXTRA` and `bar-APART` are ZERO on the whole bottle (606 tables) AND in a real browser (the monkey on `main`,
  one whole pass) — or every pair left is read to its cause and written here. The pad goes first (it asks the
  function at the press — no cache); the bar and each `v-if` read it through a computed, so their facts must first be
  REACTIVE (invariant 17) — that is ③'s own work.
- **② THE PAD — SWAPPED** (`5ef9fc0fe2`, on `main` with `d27953d3f7`): the ladder's prompt band reads
  `servingOwner.bandRungOf` at the press (`promptBand.promptBandOf`) — the surface the function names takes it, the
  others yield; where it names none that stands the ladder's old order routes the press and SAYS so
  (`band-fallback`). Read whole: the bottle — 22 995 presses, fallback 40, every one a workspace root under «nothing
  asked»; a real browser — 23 156 presses, fallback 13, the same.

**STAGE 2, STEP ③ — THE PROMPT SURFACES ARE DERIVED (2026-11-21).** What had to be true first, and what the readings
taught on the way:

- **Round 6 of the function** (`d27953d3f7`, from the real browser's first reading of all five measures — the
  nightly monkey, 606 tables: screen MISS 0 · EXTRA 0, LATCH 0): **the client's own question** (`client` — a standard
  project's price, a law's «where»: the task host's, with no door) and **the opening that yielded its scene**
  (`startYielded` — it still owns its question, and waits). The exhaustive spec walks both (≈ 4.7 million points).
- **Three places the bar and the pad parted — each a promise the pad did not keep, each fixed in the product:**
  Information Mode over an external draw (the bar showed the draw's verbs); a journal left open when the draft
  arrived (it kept every press under the draft's bar — the draft and an external draw now close it); RT in the
  finale under an open sheet or the inspection (it began the FINISH nobody was shown — the rung stands only where
  the board's bar offers it).
- **The answer lives in the router** (`dc51335ecf`): `questionNow` (the client's question, else the server's),
  `questionFactsNow`, and the ONE answer in two layers of one function — `promptOwnership` (everything but the
  opening's yield: what a prompt surface reads; the start's own visibility reads the prompt surfaces, so this layer
  never reads it back) and `servingOwnership` (the whole). `ownerServes(owner)` is the word; asked while the answer is
  being decided it names the cycle (`serving-owner:cycle`).
- **THE SWAP** (`fz/derive` → `main`): the ten prompt surfaces — the task host, the decision, the WGT panel, the
  production loss, the deck pick, the Venus bonus, the spend-heat lanes, the Ares thresholds, the bot's attack, a
  corporation's first action — each is now «its prompt is CLASSIFIED (what would be drawn) ∧ `ownerServes(<owner>)`».
  **The mount, the pad's rung and the bar's branch read the SAME computed** (`taskHostOwnsInput` IS
  `taskHostRendered`). A surface can only stand where the function says its owner serves — never beside another.
  The facts learned what the old conditions knew: the Venus bonus's own door; each row's own «is it the opening's?»
  (`corpFirstActionInStartFlow`, `startPlacementOrderOf`); the WGT beat whole (`closing` as well as `holding`); **the
  claim that holds is the owner's own** (one OR over four waits held a resolution's deck pick behind the HOST's wait
  for the sitting's field — the derivation's witness named it on its first walk).
- **Round 7 — a frame that EARNED a kind a prompt surface draws HOSTS that surface** (the swap's first e2e on the
  box — ninety-six tests over the prompt surfaces, one red: Helion's heat payment after a research buy never rose).
  «The frame that earned the kind answers before the kind's row» is true where the row is a WORKSPACE's (the colony
  resolution's discard); a kind the task host or the deck pick draws is still drawn by it, in the earning frame's
  zone — the draft's pay slot, the Hydronetwork's bonus pick — a phase root too, where the stack names no host.
- **THE LAW IS LOUD — four doors:** a settled look where the function names an owner whose surface has nothing to
  draw is `[invariant] serving-owner:unserved`; a prompt surface standing that it does not name is
  `serving-owner:second-surface`; a fact that reads a condition derived from the answer is `serving-owner:cycle`;
  and **the cache is AUDITED** — once a second a fresh answer is read beside the one that stood at the last reactive
  edge, a move with no edge is `serving-owner:latch` (with the facts that moved) and an epoch re-asks the function.
  ⚠ NOT `reactivePredicate`: its witness reads the predicate synchronously at every reactive edge, mid-write, and this
  predicate reads half of the shell's computeds — the Pluto discard walked past its own reveal (eight specs red on the
  branch, thirteen of thirteen green on `main`'s head: an A/B on the box; the lesson of 2026-11-03 paid twice).
- **THE GATE HOLDS THE LAW** (`monkey-report --gate` — the nightly monkey, the freeze gate): `MISS` · `EXTRA` ·
  `pad-MISS` · `band-APART` · `bar-APART` · `flag-MISS` · `flag-EXTRA` · `edge-LATCH` above zero fail the run by name.
- **The swap's own witness:** the old conditions are kept ONE cycle, read by nothing but `noteDerivedRender` — every
  span in which a surface stood by its old condition and not by the function's word (or the other way) is counted and
  said into the waiting room (`[net-ended] derivation:<surface>:<side>`, tier info), so the whole e2e suite reads as
  what the swap changed. Before the swap: the bottle 606 tables — 0 spans; a real browser — only the deck pick's
  outgoing beat (which stands by its own hold, as designed).

**STAGE 2, STEP ④ — THE NETS (the rule is stage 7's: 0 fires over the matrix AND a law that closes the class).**
No line of `screen-shadow`, `start-shadow`, `console-leak-detector` or `start-stranded` — at any tier — stands in the
matrix's cells, in the nightly's real browser, or in the bottle's whole passes.
- **The screen shadow is an OBSERVER:** its one armed verb (`announce` — the blind announce) is closed by the announce
  machine's own bound (architecture v2, L4: a beat pending 15 s runs the plate's door), so
  `SCREEN_CURE_DEFAULT_ARMED` is empty — the shadow names what it finds, the arbiter's rung may still run its plan,
  a stand arms a verb by the URL as before. The leak detector's `STRANDED` / `COVERED PROMPT` only ever spoke.
- **The start shadow stays armed.** «Which STAGE of the opening» is not this function's question — the start is ONE
  owner here, and inside it stands its own director (`startDirector.ts`: a dozen latches, a shadow that acts). No law
  closes its class yet; deriving the opening's stage from its director is the stage's open tail — **2b**, below.

**STAGE 2 — WHERE IT STANDS.** Done: the function total and exhaustive; the pad's band, the bar's prompt branches and
the ten surfaces' mounts derived from ONE cached, witnessed answer; the screen shadow an observer. **Open — 2b: the
opening's own stage** (`consoleStartState.serves` and the yields, by `expectedStartOwner`), after which the start
shadow and `start-stranded` retire by the same rule. The workspace ROOTS (the draft, an external draw, the endgame,
the start as a whole) stand by their FRAMES — the stack's law, not a `v-if` to derive; the band's fallback rows that
are left are exactly those.
**LANDED 2026-11-21 — `main` `4c8d713f58` (v1.2.3394), and CI's verdict on it:** the whole e2e suite green (15 / 15
jobs — run 44934062542), the freeze gate green (44934065452), the real-browser monkey green on `fz1` (44934068038);
before the landing, on the branch: the gate's law at zero over 606 walks in the bottle and in the real browser (MISS 0
· EXTRA 0 · the pad on another rung 0 · derivation spans 0 · LATCH 0 · band APART 0 · bar APART 0). The legacy
conditions kept as witnesses (`*Legacy`, `noteDerivedRender`, the `derivation:` lines) go at the next cycle.
**What is still open of the stage's literal exit, said plainly:** *2b* — measured in the real browser too (the CI
monkey, 606 walks: 1512 judged states of the start, agree 231 · apart 35 · held 75; every disagreement the director
would act on is closed by the latches within 37 ms, one hosted step's leave at 154 ms; none reaches a net) — the swap
of the start's nets onto the motion's clock waits for the same spans read over the whole e2e suite (the fixture files
them on CI now); and *S5-rest* — owed steps as children of their frame (the ghost test, the forced teardown and the
stale free-turn reaper retire with it), a redesign slice of architecture v2 that this program has not started.

**STAGE 3 — EVERY WAIT BOUNDED AND OWNED, STATICALLY (2026-11-21).** The stage's three numbers, and what holds each:

- **`kernelCoverage` = 0** — raw timers / frames outside the kernel: at zero since architecture v2's perimeter, held by
  its ratchet. Its list «not a flow» (a flag-carrying module with no run of its own, each row with its reason) is
  four rows; a row whose module got a run leaves (`kernelCoverage.spec` ④).
- **A wait on a reactive condition is a node of the wait graph** — `waitGraphLaw.spec`: a one-shot watcher, or a
  promise over a watcher, stands in sight of `beginCeilingWait(` / `.guarantee(` / `.wait(` / `deferSceneReveal(`.
  One wait stood outside it (`consoleParliamentFlow.whenParliamentSurfaceGone` — now the ceiling wait
  `parliament:surface-gone`, 6 s on the motion's ceiling clock). At zero.
- **A FLAG IS ITS RUN'S LIFE** — `createFlowRun(label, {flag})` (`session/flowRun.ts`): `begin` raises the flag, the
  scope's END lowers it — the flow's own end, a new run over it, the game screen leaving, the run's ceiling — and
  LAST, after the module's recovery (every abort begins `if (!state.active) return`). What it replaced: `state.active
  = true` after `run.begin()` and `= false` in every exit path, where the path that throws before its lowering line
  leaves the flag up for good (the audit of 2026-11-15: each of the nine view scenes could stick so). Two guards:
  - `sceneFlagLaw.spec` — read off `components/viewScenes.ts`: no scene writes its flag by hand, the flag its
    predicate reads is a run's, and the hold's `expire` ends the run in a `finally`. A scene added to the list is read
    at once;
  - the debt ledger's row **`flag-by-hand`** (`architectureDebt.spec`: `<x>.active|live = true|false` in a module that
    owns a run) — frozen at 57 writes in 20 modules, **0 since 2026-11-21**, held there by the baseline.
  What the conversions found on the way: three recoveries that could throw before the flag fell (the trade's abort
  releasing held rows, the colony build's teardown, the played cards' return releasing the withhold) — each now ends
  its run in a `finally`; a track move awaited bare; and four flags that are NOT their run's whole life (the
  Hydronetwork's glide, the played cards' flights, the discard STAGE two drivers play on, a foreign tile's proxy) —
  each a run of its own, so it is a scope the tree names and the session's end takes down. A scene that only moves
  (the energy conversion, the hazard cleanup) also carries the kernel's own ceiling (`ceilingMs`, twice the hold
  registry's); a scene that lawfully waits for the player carries none.
- **What the law does NOT cover, said plainly:** the 31 runs DERIVED from a state record (`deriveFlowRun` — a phase
  machine several writers move; the run follows the record, by design). Their end stands on two other laws: the
  session's edge on the module-state guard (every record is a declared `sessionState`), a wedge inside a session on the
  hold registry's `expire`. And structural item 4's second half — the start scene and the Parliament taken apart like
  the shell — is the open redesign of architecture v2 (`../architecture-v2/PLAN.md` § 0), not this stage's number.

**STAGE 3, EXTENDED — THE BEAT LAW: A PAUSE INSIDE A BEAT IS A DECLARED WAIT (2026-11-23).** The stage's three
numbers are STATIC, and one kind of wait passed all three: a pause a flow gives the player inside a transient beat —
written as a net's timer (`guarantee`) or a controller's own clock. It is «inside the kernel» (the coverage ratchet is
content) and it is no reactive wait (the wait-graph law is content), yet nothing that asks «is anybody working?» can
see it: `flightsInTheAir` reads the wait graph and the kernel's MOTION waits, and a guarantee is neither. Three stood
on healthy tables when the BEAT track first read honestly — the standard project's read of its terminal commit
(304 ms), the action commit's minimum beat, the Hydronetwork's result read (1.07 – 1.23 s) — each cured as it was
found (a `span`, two ceiling waits: `0be1b6082f`, `b8be73721f`, `43dc5a3260`). Every door by level stands on that
reading, so the class is closed by a LAW, not by the next accident:
- **The form is decided: a law of the GATE, not a grep.** A static guard cannot tell a pause from a net's safety —
  both are `guarantee(ms, what, fn)`; what differs is whether `fn` advances a flow, which is the callee's business
  three calls away. What CAN be read exactly is the thing itself: every transient beat, by painted frame, with what
  is in flight under its own frame (`outcomeController.measureStandingBeat`). So `monkey-report.beatLawBroken`: a span
  `beat|<kind>:<beat> · QUIET{…}` whose longest standing reaches the doors' own bar (250 ms — past a hand-off between
  two flights) fails `--gate`, by name, with its tables; `scripts/ci/findings.mjs` files it under a kind of its own
  (`beat-law` — it is no cause class, and a red gate with nothing named would be read as a dead shard). The bottle's
  gate (606 tables per seed, a manual clock: a frame is 16 ms exactly) and the real-browser monkey's both run it.
- **It stands at zero where it is turned on:** the gate's corpora of run 45220700405 — `fz0` 230 spans of a
  transient beat, `fz1` 227: QUIET 0, the gate passes; the box's two-seat pass on `35657c6593` (456 walks) — 213
  spans, QUIET 0; the whole e2e suite of run 45220695930 (1 320 files) — not one quiet beat at ANY duration. The
  positive control is the track's own first reading (the three above) and the spec, which plants their keys.
- **The rule** is in `.claude/rules/console-flow.md` (the frame's section): a read is `await span(ms, flow)` or a
  ceiling wait met on its event — never a guarantee whose callback advances the flow.
- **What the law does NOT see, said plainly:** a pause inside a beat that is ALSO covered by something else in
  flight (a hold of the same scene, the wire) reads `busy` — it cannot be cut by a door either, so it is not this
  class; and the e2e suite's own tests are READ on this track, not gated by it (a span bracketing one long frame of a
  starved runner would read «quiet» in milliseconds — the suite is held by the doors' numbers in frames instead).

**STAGE 2b, STEP ① — THE OPENING, MEASURED (2026-11-21).** The start is ONE owner of the function; which STAGE of it
stands is the start director's word (`startDirector.expectedStartOwner` — pure, of the server's one question) and a
dozen latches' answer (`actualStartOwner`). Two nets stand over the pair, each behind a confirm of seconds — the start
shadow (3 s, then `heal` / `yield` / `release`) and the start watchdog (2.5 s, then `healStrand`). Before a latch is
derived from the director, what the confirms HIDE is read: `servingOwnerMeasure.noteOpeningLook` / `noteOpeningSpan`
— every judged state of the start, and every disagreement and every strand as a SPAN (who was expected, who stood,
what the director would have done AT ONCE, how long, what ended it; the strand with the doors its heal would open —
`ConsoleStartScene.strandPlan`, read through the scene's own diagnostic probe). `monkey-report`: «THE OPENING».
*The first reading* (the bottle, 96 tables of the opening, `fz0`): 356 judged states — agree 166 · apart 23 · held 62
· out of scope 105. Every REAL disagreement the latches close by themselves: 0 – 16 ms for most (the same flush — an
edge-triggered entry that fires a tick after the question), 300 ms for a hosted step's leave under the game's menu,
1.4 s for the corporation's payment under a leaving step; the `held` spans are beats behind their own admission
block (a hero landing, a card arriving, the table answering) — the function's «held», not a disagreement. No span
reached a net. *What it says about the derivation:* the director's word is right at once in every span read; what
differs is the latches' LATENCY (a hand-off the scene plays) — so the derivation is of the scene's DOORS, level-
triggered on the director's word and gated on «nothing of the start is in flight», never of its choreography. The
real browser's reading (the monkey on CI) is the next number; the swap of the three decisions (the paint / yield, the
release, the heal's doors by level) follows it. Until then the start shadow and the watchdog stay armed.

**STAGE 4, STEP 1 — THE WIRE BREAKS (2026-11-21).** «Fault injection for every transport outcome never seen today»
— the submit machine's moves no pass had walked (`sending → failed · refused · silent`, `presenting → failed`; whole
passes stood at 3 of 8):
- `bottleNet.faultNext(match, fault)`: the next matching request breaks as a wire breaks — `network` · `refused` ·
  `stale` (`STALE_PROMPT`) · `error500` · `silent` (lost before the server), and the two a page recovers from only by
  asking again: `lost` (the server MAKES the move, its answer never comes) and `malformed` (it makes the move, the
  answer does not parse).
- the monkey's walk takes a fault as a STEP (`faultEvery`, its own seeded stream; the submit mostly, the poll, the
  view) — recorded, replayed and shrunk like a press; a silence the walk took is waited out. `npm run gate:freeze --
  --guided --fault 6` (a pass of its own: `--write-baseline` is refused — its classes are findings).
- the judgement: the FAULT'S OWN WORD (the page's error line, «the server did not answer») is `info`; the screen is
  judged by what STANDS a minute and the last word after the walk (`BottleLiveness.standing` →
  `fault/standing-screen/<faults>`); what a walk names BESIDE them is the product not unwinding from a broken request.
- `consoleBottle.bottle.ts` § 16: each fault of a submit alone — the machine ends in the state that names it, the
  screen is served, the move was / was not made.
*The first reading* (guided, 54 tables, 114 faults taken): no screen left standing; three classes, each closed with
its law and a replay —

| class | what stood | the law |
| --- | --- | --- |
| `animation-hold/ceiling/parliament-chairman-quest` · `wait-graph/overdue/flow:chairman-quest` | the chairmanship's blocking hold and its node of the graph bounded the wait for the SERVER on clocks of their own (20 s · 30 s under the transport's 60) — a refused / stale / lost answer force-released the flow «without its beats» | a hold stands over what the flow PLAYS (the reading; the office and the step once the answer is in); a wait for the server is the transport's, a wait for the player (the answer handed back) holds nothing — `chairmanQuestDirector`, `chairmanQuestFlow.handedBack` |
| `wait-graph/ceiling/parliament:submit` · `wait-graph/dead-end/flow:chairman-quest` | the section's submit safety counted the server's silence into its 30 s; a submit that did not land was noticed by the safety's next tick, up to 6 s later | the thirty seconds are counted where the wait CAN be mutual (the answer is in, or parked); the section hands the stage back at the transport's own settle (`onSubmitSettled`) |
| `wait-graph/dead-end/question:actionmenu` · `…/surface:card-actions` | a card action's submit lost on the network: the AWAITING HAND-OFF the press had armed stood six seconds over an inert pad, the graph's door re-opened the question by closing the workspace — the configured action gone under the error alert | a press that did not land unwinds what was armed for it AT ONCE — the hand-off's wait declares its unwind beside its arm (`onPressUnlanded('awaiting-handoff', …)`) |

One family: *a wait armed for a press, bounded by a clock of its own instead of the press's own end.*

*THE WHOLE PASS* (`gate:freeze -- --guided --fault 6`, 606 tables, 1375 faults taken, 42 min at five shards): **no
screen left standing** (`fault/standing-screen` 0, no episode never cured) and eleven classes the baseline does not
hold. Nine are that family again, in what WAITS FOR THE ANSWER — closed in one commit, with replays:

| class | what stood | the law |
| --- | --- | --- |
| `wait-graph/dead-end/claim:hand` ×12 · `claim:start` ×6 · `claim:card-actions` | an outcome's claim is placed at the submit and waits for the answer's artifact; a press that did not land left it `awaiting` to its 20 s safety, and its fall then read as a FINISHED flow — the workspace folded under a player re-doing their move | the press's own unwind releases the claim at once (`unwindUnlandedClaim`) and the release says why (`workspaceOutcomeState.lastRelease` = `press-unlanded`): the one fall no host concludes on |
| `workspace-outcome/host-gone/card-actions/draw-pick` ×4 · `…/draw` | under a request the server never answers, the hand-off's private six seconds CLOSED THE LAYERS (the player on the board with a submit in flight, the claim orphaned); the claim's own twenty would have let it go under the same silence | the server's silence is the transport's to bound: the hand-off's expiry, the claim's safety and the claim's node of the graph stand down while the request is on the wire unanswered |
| `wait-graph/dead-end/question:actionmenu` · `…/surface:card-actions` ×5 | an answer that ARRIVED and would not parse: the move was MADE, but everything was unwound as «did not land» — the stage stood «Выполнение» with nobody left to fold it | the pass says which way the press did not land (`UnlandedPress.answered`); what waits for the answer declares itself (`onPressUnanswered`) and is unwound only when no answer is coming — the re-fetched view is the answer by another road |

*Open rows of the pass* (five tables, all under a server silent for the transport's minute — the same law, three more
registries): `wait-graph/overdue/surface:parliament` (a frame's `executing` beat keeps the graph's 12 s over a submit
on the wire) · `animation-hold/ceiling/parliament-reward-owed` and `wait-graph/overdue/admission:host:presentation`
(a hold's 35 s ceiling over the same silence) · `wait-graph/ceiling/external-draw:prompt-moved` (a 1.5 s grace for
«the server moved off the prompt»). The rule to carry there: *a bound over a wait for the server is the submit's own
settle — the graph's overdue judge, the hold registry's ceiling and a ceiling wait whose target is the server do not
run their clocks while the request is on the wire unanswered.*

**STAGE 4, STEP 2 — WALKED OR DECLARED, the instrument (2026-11-21).** The stage's number is «machine moves 100 %
walked-or-declared; flows 100 %». What it needed before it could be read:
- *a move is a REGION's move* (`monkey-report.regionMoves`): for a machine of orthogonal regions (the claim: stage ×
  beat × arrival × host) the explorer's universe was their PRODUCT — 242 «moves», nine walked, a number nobody could
  read. By region the claim has 17 moves and the four machines 83.
- *the union of the passes* (`scripts/kernel-walked.mjs`): every pass's directory at once — plain, guided, reload,
  the hidden page, the broken wire, each seed, the real browser's — against a ledger of declared reasons
  (`tests/client/bottle/kernelUnwalked.json`, `--write`; `--gate`). Over every bottle pass on disk: moves 33 of 83
  (submit 7 of 8 since the fault pass — the eighth, `presenting → abandoned`, needs a presentation that never ends),
  flows 158 of 285, frames 11 of 13.
- *the suite is the corpus:* a blind walk's sixty presses open half the declared flows — in the real browser exactly
  as in the bottle (the CI monkey's 606 walks: the same fifty scenes never opened). On CI every e2e test now marks
  the kernel's coverage and files it beside its cause classes; the ledger is written from the suite's run.
- *what the unwalked moves are:* the claim's are its own BOUNDS (`live → released` by its safety, `host: bound →
  orphaned`, `stage: awaiting → held`) — failure paths only a fault walks, and the fault pass now does; the frame's
  are pairs of an any-to-any machine the product never makes. The frame machine's protocol is to be written down as
  the set the product walks (an off-protocol move is then a line, not a silent permission) — the next step.

**STAGES 3 · 2b ① · 4 ①② — LANDED 2026-11-22 with CI's verdict on the branch** (`fz/s4` @ `5aff076067`): the whole
e2e suite green — 12 of 12 shards + the burn-in of the changed specs (run 44954171031), the freeze gate green
(44954173712), the units green (44954176303). The e2e run carried the kernel's coverage for the first time
(`e2e-cause-classes-*`): the ledger of declared moves and the reading of THE OPENING over the whole suite are read
from that run's artifacts — the next step of stage 4 and of 2b.

**STAGE 2 — THE WHOLE SUITE'S READING (2026-11-22; e2e run 44954171031 — 1 502 tests, 8 345 presses, 4 253 looks).**
The monkey presses at random; the suite walks what a monkey never reaches (the Hydronetwork's picks, the campaign,
every start). What the function's measure says there:
- *the conditions:* agree 3 010 · held 1 197 · **MISS 0** · EXTRA 13 (the legacy witness of the deck pick against a
  mount the function now holds behind `admission:played-hero` — the derived answer is the stricter one; the witnesses
  go at the next cycle);
- *the band, derived:* the ladder took the derived rung 6 090 · its upper half 2 196 · FALLBACK 38 (the workspace
  ROOTS — the start, the draft, an external draw: they stand by their frames, as §«where it stands» says) ·
  **APART 21**, and the bar **APART 21** — every one of the 42 ONE branch of the ladder: the Delta instruments' (the
  stage-reward pick, the espionage / blockade pick, the blockade's execution, a hydro frame over the hand) handed the
  press to the track's section and never NAMED its rung. Named by the bar's own cases (`deltaPick` · `deltaReward` ·
  `handCovered` · `section:hydro`), main `bfc748ac35`; the night's e2e reads it at zero or says what is left;
- *the edge:* LATCH 4 of 4 253 looks, all `choice:contextual` with «+ scene hand-pick» — a look taken inside the tick
  in which a client pick opens (its flag is reactive; the once-a-second invariant `serving-owner:latch`, which reads
  after the flush, never fired: e2e would be red);
- *the opening (2b):* 7 016 judged states — agree 1 221 · apart 208 · held 561 · out of scope 5 026. **The start's
  two nets: 0 fires in 1 502 tests** (and 0 in the CI monkey's 606 walks). Of the director's three cures, `heal` and
  `yield` were never the answer to a span at all; `release` 45 times — ≤ 72 ms for forty (the same flush), 307 / 919
  / 1 262 ms for five (a hosted step still leaving under the game's menu); the longest disagreement with no cure and
  no hold was 2 939 ms, 61 ms under the shadow's confirm — **the bonus action's trip to the board** («Фора»), which
  the table read as «expected the bonus stage, on screen the game»: a finding three seconds into every trip a PERSON
  makes. It is `trip` now — the start's own hand-over, never judged (`startDirector.actualStartOwner`). A strand rose
  and cleared by itself 58 times, the longest 1 261 ms (the watchdog confirms at 2 500).
*What the reading settles:* the director's word and the latches part only for the length of a hand-off the scene
plays, and every such span is short of the nets by a factor of two or more on CI's machines. *What it does not:* the
three doors (the paint / yield, the release, the heal) are still opened by latches on an EDGE, with the nets behind
them — «impossible by construction» needs them level-triggered on the director's word and gated on «nothing of the
start is in flight», and a hosted step that STANDS (not leaves) under the game's menu is the case to design first
(today the shadow would end the start under it after three painted seconds). That, and S5-rest, are the stage's
open exit.

**STAGE 2 — THE LAW'S FIRST RED, AND THE NIGHT's READING AT ZERO (2026-11-22).**
- *The night's e2e on `main` `a85c1efa50` (run 44998610817, 1 502 tests, 8 354 presses):* band **APART 0**, bar
  **APART 0** (were 21 + 21 — the one unnamed rung), conditions MISS 0, no move off the frame's protocol, no flaky
  test. What the measure still counted: FALLBACK 40 and EXTRA 11 — both closed below.
- *The one-owner law's first red — issue #84* (the nightly gate, seed `fz1` · `venus-l1-shade-start`:
  `pad-MISS:section:board`). The function said «the start serves, no hold» and was right. An opening entered past
  its summary has no lifetime hold (module state; a reload wipes it too): between a prelude's play and the next «pick
  a prelude» the question is held behind the play's presentation, the admission-gated `startTask` is nothing, and the
  scene — on screen over its own question — «served» nothing: RT opened the board's wheel under the queue.
  `startController.startQuestionHeld`: a start whose FRAME STANDS keeps serving a start question that is merely held.
  A replay of the gate's own walk holds it; the gate on `fz1` in the bottle: 606 walks, 23 119 presses — MISS 0 ·
  APART 0 · LATCH 0 · EXTRA 0. *What the red teaches:* the law is alive — it named, by a measure nobody had to read, a
  press that went to the wrong place for the length of one beat.
- *FALLBACK → the stack's word.* All 40 «fallback» presses were ONE case: the function names nobody (nothing asked,
  or the owner waits) and a workspace ROOT stands — the opening, the draft, an external draw. Whose press it is among
  the roots is now the STACK's word (`promptBand` `rootNow` — the topmost root on the live stack), never the order
  the ladder was written in; the ladder's order is left only where neither the function nor the stack names a rung
  that stands (the row is to read 0 over the suite, and then the `stands` table goes).
- *The swap's witnesses are deleted* (`*Legacy`, `noteDerivedRender`, the `derivation:` lines): one cycle of the
  whole suite and of the gate at zero difference spans is what they were kept for.
- *The doors, measured* (`servingOwnerMeasure` — the DOOR track): while the director would act (`heal` · `yield` ·
  `release`), what is IN FLIGHT is read every frame off the wait graph — each wait that stands for a motion or for
  the server, plus the wire. `…· busy[<waits>]` is a beat with an owner; `…· QUIET` for N ms is N ms by which a door
  opened on the director's word would go before the latches do.

**THE DESIGN OF THE LAST STEP — LEVEL DOORS, ONE CONSTRUCTION FOR BOTH OPEN ITEMS.** The start's nets (2b) and the
conclusion's nets (S5-rest: the ghost test, the forced teardown, the stale free-turn reaper) are the same shape: a
decision that is RIGHT as a pure function of the applied view and the stack («the game proper asks and the start
stands alone» · «the free turn is asked and a committed frame that does not serve it holds nothing»), executed today
by an EDGE somebody must remember to fire — and, behind it, a net on a clock of seconds that samples the same
function and acts when the edge was missed. «Impossible by construction» is the decision executed by LEVEL:
  1. the decision's function stays what it is (`startDirectorCure`; `conclusionFacts` → dismiss);
  2. its door opens the moment the function says so AND nothing is in flight — and «nothing is in flight» is not a
     list kept by hand: it is the wait graph (no node that waits for a motion or for the server), which stage 3 made
     complete by law (every wait bounded and owned, `flag-by-hand` 0);
  3. the net behind it keeps its clock for one cycle as a COUNTER («the net acted where the level door had not»), read
     over the suite and the gate; at zero it is deleted — stage 7's rule, with the law in place.
What has to be designed before the doors move, each from the DOOR track's reading over the whole suite (the e2e run
on `6af64736d8` files it): (a) how many frames of QUIET a door waits (the latches' own doors act in the tick the
state rises — the first reading, 16 opening tables: every `heal` span QUIET for 0 ms); (b) the one state where the
function is right and the level door must NOT act: a hosted step that STANDS under the game's menu for the player to
read (it is the player's time — the function must say so, as it does for a parked task and a player's own look, before
`release` is a level); (c) for the conclusion: the same track over its candidates (`[workspace-stale]` is red in
every e2e spec and `ghost-forced` is a defect class — both at 0 over the matrix today, which is the evidence half).
*S5-rest, said plainly:* the conversion of the four owed steps into scope children was sized again — `followUpStepOwed`
is already a pure derivation of the applied view (a child scope mirroring it would have to be opened synchronously
with every dependency, or the conclusion reads the structure a flush before the mirror — the very gap the hold
closes); the level door above reaches what the conversion was for (the three nets with nothing left to catch) without
turning a derivation into a lifecycle. The structural mirror is therefore NOT planned; the item closes with the
conclusion's level door.

**STAGE 2b ② — THE OPENING's DOORS OPEN BY LEVEL (2026-11-22).** The DOOR track, read where it counts — the real
browser, the e2e run on `6af64736d8` (1 376 tests of 11 shards; the twelfth lost its browser's download) — and the
gate's 606 walks in the bottle:

| the state the director would cure | QUIET (nothing in flight), the longest | what ended it |
| --- | --- | --- |
| the game asks, the start stands EMPTY (`release`) | 57 ms in the browser · 16 ms in the bottle | the scene's own release beat |
| the start's own question, nobody serving it (`heal`) | 13 ms · 0 ms | the scene's own door |
| the shell's step under a standing start (`yield`) | 31 ms · 0 ms | the scene yields by itself |
| the game asks and a STEP still stands on the start (`release`) | **1 236 ms** | the player parks it / it leaves |

So the latches' doors open in the tick the state rises, and the one state that stands quiet for a second is the one
the design named: a step on the start under the game's menu — the player's look, or a hand-off the wait graph does
not hold. **The door:** `startDirector.START_LEVEL_DOOR_QUIET_FRAMES` ∧ `…_MS` (the family's bar since 2026-11-23 —
twelve painted frames and a quarter of a second; first built as eight frames alone, which a real 60 Hz browser's
healthy 105 ms of `game > none` reached — the journal below) and `startLevelDoorMay` (every cure but that one state); the
frame-by-frame look that measures the track opens it (`startController.measureDoor` → `runStartDirectorCure(…,
'level')` — the doors that already exist, once per standing state). On a healthy table it never opens — the gate on
`fz1` in the bottle: 606 walks, not one `cure … by level`, defects 0 — and the e2e specs that are red on any
`[start-shadow] cure` line hold exactly that in the browser. On a strand it opens a hundred milliseconds in, where
the shadow confirmed at three seconds and the watchdog at two and a half.
*What stands of the two nets:* both keep their clocks for this cycle as COUNTERS — a `[start-shadow] disagree` or a
`[start-stranded] confirmed` line now means «the level door did not end it», a defect with its evidence, and both
were at 0 over the matrix before the door stood. *What is left of 2b:* the excluded state — the function has to say
whose time a step standing under the game's menu is (the player's look is already `parked`; a hosted result being
read is not named yet) before `release` is a level there; and the nets' deletion at the next reading (stage 7's
rule).
**CI's VERDICT on `901180a597`** (the level door, the witnesses' deletion, the band's root, the Solar phase's load):
the whole e2e suite green — 15 / 15 jobs, 1 822 tests (run 45023432455); the freeze gate green on `fz0` and `fz1`
(45023435125); the real-browser monkey green on `fz1`, 18 / 18 (45023437738). The suite's own reading: the band
**FALLBACK 0** (was 40), APART 0, the bar APART 0, MISS 0; **not one `cure … by level`, not one line of either start
net** in 1 503 tests; no move off the frame's protocol. Left in the measure: `flag-EXTRA` 10 — the deck pick standing
by its own hold through the beat of the play that follows it (`deckPickHolding`), a hand-off the function does not
name yet. One test FLAKED in that run (#87 — `console-start-legacy-quick-press`: its «early» press came after the
window it means to press in had closed — the spec races a motion; hunted on CI on this commit and on the one before
the door to learn whose it is).
*#87, read right (2026-11-22).* The hunt said the door was not it (base 20 / 20, main 19 / 20). I then read the red as
a window of the PRODUCT — the gate naming «delivered» by the ledger's names while the admission reads the flights —
and widened the gate (`startDeliveryInTheAir`, `06423816f7`). The proving hunt answered 38 / 40, the same signature:
wrong. The red repeat's SCREENSHOT told the truth the spans could not (they were identical in the red and the green
repeat): the start finished, four cards in the hand — the press was honoured, rightly, after the cascade had landed.
The cascade stands 0.8 s at the functional motion; the driver spent a poll, a focus read, a hop and the key between
the pay press and the «early» one. The fix is the spec's: the press is armed before the pay press and SENT BY THE
PAGE in the task that gives the row the ring (`tests/e2e/pressInWindow.ts`, the writing law 21) — the hunt on it:
**40 / 40**. The gate's widening stays (one fact for the gate and the admission is right by itself). The lesson is in
the flake journal: a red that does not name its cause gets its picture read BEFORE a hypothesis about the product.

**THE MONKEY'S SEED OF THE DAY, 2026-11-22 (run 45016321151 on `6af64736d8`) — two walks red, six findings, two laws.**
- *`red-lawyers` (#88 · #89 · #91 · #92) — the player's look is the player's time.* «Юристы Красных» played, the
  Parliament's walk on its card step, the player reading «ИНФОРМАЦИЯ › соперник» over it (the reveal held back so as
  not to pop over a screen they opened). The arbiter: «stall (unserved): 10s without progress, 0 presses … top:
  parliament:executing; holder: beat» — its ladder expired the reveal's claims, tore the walk's beat down under the
  screen, and the hand's frame was concluded as stale. Stage 1 had given such a view its B (`backJudged`); the
  unserved half still counted the player's reading as nobody's time. The law is in the pure core
  (`LivenessSample.playerLook`, `PLAYER_LOOK_SELECTOR` — the views only the player opens): under a look the screen is
  judged as an ACCEPTING one — never an unserved question or an owed beat, only a press nobody took (a deaf look is
  still a deaf screen) — and the clock starts when the look closes; the reaper of finished frames reads the same
  fact. *What it costs, said plainly:* a flow wedged for a reason of its own is not cured while the player keeps a
  look open over it — the judgment begins at the close. *Not replayed in the bottle:* without layout the walk
  collapses before its card step and the reveal keeps the pad; its proof is the same seed in a real browser.
  *The repeat on CI (run 45041099603) and the next net:* both walks passed — no stall, no teardown, no fold — and the
  wait graph spoke over the same state: «overdue flow:walk#1 — past its 40 s bound» (#94). The walk's node called a
  card standing before the player «the walk's motion, forty seconds»; the ledger had known better since TR37
  (`parliamentAgendaBonusHeld`). The node now names whom it waits for (`agendaCardInPlayersHands` → the PLAYER,
  unbounded, `accepts`) — `a54fa2e7bf`. *What the pair teaches:* one honest state is watched by several nets, each
  with its own reading of «whose time»; the law lands in the STATE's own word (the node, the sample), and the
  repeat of the seed is run until no net is left to speak.
- *`colony-trade-hub-bot` (#90 · #93) — a leave decided is a surface gone.* B closed «Разыграно»; 336 ms later a
  card's M€ took its printed icon on the LEAVING table as its source — the first half of a dissolve still reads
  «visible» — and by the token's pop the table was gone («surface folded under its token — the birth …»). The fold's
  law (`surfaceClear`) could not help: the frame left BEFORE the token existed (the walk has no `frame-left-holding`
  line). The law of visible ends gains its clause: an end inside a surface carrying the leave's own mark
  (`data-motion-leaving`) is refused by name (`leaving`) at any opacity, for exactly as long as the leave lasts — the
  ladder goes on; a flight already in the air keeps its object (LENIENT).

**THE WHOLE SUITE ON `1dd900fbde` (run 45041230685), AND WHAT ITS CORPUS FOUND (2026-11-22 evening).**
- *One red, and it was mine* (#95 — `console-card-reaction` HYDRO, 3 / 3): the clause «a leaving surface is no
  birthplace» answered a second question it was never meant for. The same verdict tells the reaction stage what to
  stand CLEAR of (a workspace's hero column), and a column on its leave still paints through the dissolve — the
  Greens' charter rose on top of it. Two questions, said apart: `TransferEndOptions.painted` — occupancy is judged by
  what still paints; every chooser of an END keeps the clause (`a834cd7eff`; the spec file twice on CI — 18 / 18).
  *The lesson:* a clause added to a verdict that several callers read is checked against EVERY caller's question,
  not only the one it was written for — the suite did that for me, an hour later.
- *One defect class in a test that PASSED* — `wait-graph/ceiling/card-reaction:blocking-quiet` in
  `console-terraforming-deal` (D): found only because the corpus of a green test is read too. By rate on CI: 0 of 30
  on `901180a597`, 8 of 78 after it; the line said «every blocking hold», so it was first made to NAME its holds
  (`8be5224e14` → `generation-scene[blocking]`). **A mutual wait ended only by a ceiling:** the generation scene keeps
  its blocking hold through the screen's handoff and waits there for every hold but its own — the card reaction's
  among them (its hold stands while the chain waits); the chain's first wait was «every blocking hold released», the
  scene's included. Twelve seconds, then the chain's ceiling. It needed a seat's reaction and the generation's change
  in ONE view — which stage 5's engine order (a reaction drained before the seats are asked) made possible: a server
  fix surfaced a client cycle that had always been there.
  **The law, in the registry** (`d81fa65e2a`): `AnimationHoldOptions.handsOver` — a hold whose owner has played and
  only holds the door through the handoff says so; `blockingHoldsPlaying()` is what a story owed to the player waits
  out — it never cuts into a scene that owns the screen, and it never waits for a scene that is waiting for IT. The
  proving hunt: **40 / 40, no record**.
  *Why the wait graph's cycle finder did not see it:* neither wait named the other as a NODE — one waited for «a
  count of holds», the other for «the reason `animation`». A wait on a count is an edge the graph cannot draw; that
  is a class to look for (the other `wait…Quiet` loops of the reaction's chain, the handoff's `animation` reason).

**THE SUITE's OWN CORPUS IS A WORKLIST — NETS THAT FIRE UNDER GREEN TESTS (found 2026-11-22; the reading of run
45041230685, `1dd900fbde`).** The e2e harness fails a test on its own markers; a defect-tier line of another net under
a test that passes went unread — the readings of this stage looked at the owner function's measure. Read by class
(`node C:/Projects/Mods/tm-fz-tools/read_suite.mjs <corpus> [<before>]`; the controls — `console-stall-cause`,
`-view-delivery`, `-wait-graph-control`, `-wait-graph-dead-end`, `-screen-shadow-control`, `-screen-director-cure` —
plant theirs on purpose and are left out), the suite holds thirteen classes in tests that PASS. Each is a wait that
ended on its BOUND in a scripted flow — seconds of a stuck story for a player, reproducible by its spec, proven by
rate on CI. Longest first:

| class | under (green) | what the line says |
| --- | --- | --- |
| ~~`animation-hold/ceiling/card-reaction`~~ | `console-atmospheric-enhancers` E | **closed `774cc85e4c`** — nothing leaked: the chain's hold took the DEFAULT 35 s ceiling, shorter than a wait it stands through (the rating's story on a covered stage, 32 + 12 s), and its `expire` ABORTED a healthy chain — the table's answer never told. The ceiling is the sum of the chain's own bounds now; the hold names the player's time (`waitingOnPlayer`). CI ×10: no defect line |
| ~~`presentation-ledger/story-due/board-beat-park`~~ | `console-start-held-placement` | **closed `7a2db1f733`** — the player was in their placement the whole 30 s; the camera of a LIVE placement is the player's cover (`boardCoversAreThePlayers`), the camera alone stays the game's. *Proof on CI: run 45064610096* |
| ~~`wait-graph/unshaped` (`quiet:city-payout:scales`)~~ | `console-arabia-terra` | **closed `4dbd84dd1d`** — first the line's shape (`3803de2988`: the owner carries a colon), then FOUR repeats on CI, each naming one more link, to the cause: **three waits in a ring** — the payout waits for the scales' story, the scales' drain for the rating, the rating for a marker the decision's plate covers, the plate for the payout. Fifteen seconds of a frozen plate after the player's answer, every run. A payout carried out of a plate does not wait for the story that plate holds (`boardStoryWaitsUnderACover`). *Proof on CI: run 45071344582* |
| ~~`wait-graph/ceiling/card-reaction:hydro-story-quiet`~~ | `console-hydro-copied-colony` · `-hydro-stage-bound-repeat` | **closed `a082066081`** — a traversal PARKED on an interactive stop is the player's time: its own node (`hydro-stop-answered`, planned), the glide and the ceremony keep theirs. CI ×10: planned in every repeat, no defect |
| ~~`wait-graph/ceiling/card-reaction:blocking-quiet`~~ | `console-terraforming-deal` (D) | **closed** — the mutual wait with the generation scene (`d81fa65e2a`) |
| ~~`scene-transition/hold-bound/start-scene`~~ | `console-rise-to-power` C | **closed `0d116127f7`** — the boot curtain waited for the start scene to be VISIBLE; a scene standing aside for its own guest (a reload inside a hosted step) never is. CI ×4: no line |
| ~~`scene-transition/hold-bound/board-fit`~~ | six tests | **closed `361d65378c`, five of six** — the hold was released in one branch only («no drift»): a framing replayed from memory, a board hidden a frame after its mount, a boot into a live placement each waited the whole bound. **Six seconds of loading curtain** for a reload into a pending decision. CI ×12: gone in five; the sixth (`console-rail-value-badges`) is the MOON's board, whose calibration does not converge — the frontier, out of the premium scope: left as a row of the day the Moon is adapted |
| ~~`wait-graph/dead-end/surface:card-actions`~~ | `console-draw-one-batch-sealed-ledger` | **closed `1c83620d96`** — the line, once it named the pad's holder, said `held by beat` (CI run 45077369811, 2 of 2): the card-actions workspace derives its phase inside the component and REPORTS its beat, its stack frame stays `browse`; the arbiter judged the report, the graph's node read the frame — «the player browses — B leaves» over a ledger asking for the player's take. ONE reading of «is this frame in a beat» for both (`beatPhase`); a reveal over the beat is the player's take. *Proof: the whole suite, run 45083892683* |
| ~~`wait-graph/ceiling/reveal:seal-gone`~~ | `console-effect-decision-embed` · `-draw-one-batch-sealed-question` | **closed `c51ea88084`** — the break's start was written for a trade's table (`place > 1`); a QUESTION's table seals its FIRST place, so its discard's touchdown started nothing and every question waited the whole net: **3.3 s between the discard's landing and the card's turn, every time**. Any sealed place breaks now; a break with nothing to play (an unpainted seal) is over at once. **CI run 45072623321: no line** |
| ~~`presentation-ledger/witness-heal/hydro-flow-stuck` + `wait-graph/dead-end/question:actionmenu`~~ | `console-hydro-terminal-landing` · `-social-heating` · `-corporate-espionage` ×2 | **closed `ea23406e48`** — the witness's own word, one run (45071654285), all four tests: `{"phase":"resolving","busy":false,…,"trail":[…,"3.1s ago: phase:resolving"]}`. The flow reaches its result on the busy signal's FALLING edge, and a movement with nothing to resolve enters `resolving` with the signal already down — nobody moved it for three seconds, and the free turn's question was a dead end beside it. Both ways into the phase ask the settle by LEVEL, two painted frames later (`hydroController.enterHydroResolving`). CI run 45077146407, the Hydronetwork's twenty tests: not one defect row · **the dead end's second half, `4cf3747c1d`:** two hydro tests still read `dead-end question:actionMenu … held by beat` for 2–3 s (run 45093794154) — the Hydronetwork's finish CEREMONY, a timeline and a 2.1 s read nobody declared to the wait graph (a node now: `hydro-flow:ceremony`), under a question that waited «for a press» while a frame's beat held the pad (the question's holder chain ends with the frame: `beatHoldsQuestion`) |
| ~~`invariant/broken/serving-owner:second-surface`~~ | nine tests | **closed `0f84a37619`** — stage 2's own residue (`flag-EXTRA`): the deck pick's OUTGOING beat (the picks flying, the played card rising out of it) read as a surface serving the next question. A presence finishing is not a second answer (`deckPickOutgoing`). CI ×15: no line |
| ~~`transfer/frame-left-holding/colonies`~~ | `console-parliament-colony` | **closed `101d7025fd`** — a hosted colony step waits for its build's tokens before it hands the screen back, for every host but the Parliament: inside a sitting the frame popped with a floater still landing on it. The pop is owed to the surface's tokens there too |
| ~~`wait-graph/ceiling/played-hero:target`~~ | `console-sponsor-colony` | **closed** — the line's own word, once it had one (run 45093794154): `workspace:lifting · no landing place registered`. It was the hero's PREWARM — a guess taken early, inside the round trip — whose last short look was a judged wait of its own; nothing stands on it: the flight asks for its place at its own time, with the whole budget, and that wait is the one the graph judges. The look stays, measured and never said |
| ~~`notifications/starvation/hand-delivery`~~ | `console-re-settlement` | **closed `1c83620d96`** — the line was false in its own words: the escape's clock runs while SOME animation blocks the queue, and whichever hold stood at the twelfth second was called «leaked». Every standing hold says its AGE now; when none has itself stood the bound it is a succession of scenes (`starvation-succession`, planned), and one that did is the defect it always was. The `hand-delivery` hold has its own word (`diagnose`) |
| ~~`wait-graph/ceiling/transfer:touchdown`~~ | `console-blue-action-receive` | named (`1c83620d96`); **not seen again** in the two whole-suite readings after it (runs 45083892683 · 45093794154) — a class of one run, kept named for the next time it speaks |

*And the two long ones were RINGS* — the generation scene and the reaction's chain (12 s), the payout, the scales and
the plate (15 s): mutual waits whose links were a count of holds, a count of members, a cover read off the DOM. The
wait graph's cycle finder walks NODES; a wait that names its target by a count or by a look at the screen is an edge
it cannot draw. Both were found the same way — a ceiling line under a green test, made to NAME what it waited for,
one repeat at a time. That is the method for whatever ring is left: no ceiling line may say only «did not come».
*What the first four rows had in common:* not one was a motion that failed to come. Each was a wait whose TIME was the
player's (a covered stage, a parked stop, a live placement, a decision in a workspace) carrying a bound and a word
written for a motion — and one of them, behind that word, a real loss: a hold whose ceiling aborted the story it was
holding. The question to ask of every bound is stage 1's, one level down: WHOSE time does this wait stand in right
now — and is the bound of the thing that holds it above the bounds of what it holds?
*The rule from here:* a whole-suite reading names every defect class under a green test, against the reading before
it; a class leaves this table with its law, its spec and its rate on CI — the table is to read EMPTY, and then the
harness fails a test on any defect-tier line it did not expect (the gate the monkey already has).

**STAGE 2 — WHAT IS OPEN AFTER 2026-11-22, AND HOW EACH IS TO BE TAKEN (the hand-over).**
- *2b, the door's one shut state* («the game asks and a STEP still stands on the start»): it is the solo colony step
  after its last answer (`console-colony-entry-probe` · `console-colony-roster` · `console-pristar` — QUIET 774 ms,
  then the step leaves; 1 239 ms, then the player's look). The DOOR track now writes WHAT STANDS there
  (`QUIET{frames · beats[the kernel's motion waits] · the kernel's tree}` — `startController.standingDigest`); the
  next whole-suite reading names whose time it is. Expected: a dwell the legacy graph holds no node for — the
  roster's landing and `colonyController.dwellColonyFollowUp` (the hand-off's wait, then `span`: one read on the
  motion clock). A `span` IS a wait of the kernel's own table (`delay` — family `motion`), so if the reading says
  `beats[…]` there, the door's «nothing in flight» reads the kernel's motion waits too (`flightNow` — only after the
  reading shows no motion wait that stands for good on a quiet table), the state reads `busy[…]`, and
  `startLevelDoorMay` loses its exception.
- *2b, the door's shut state — the SECOND reading (run 45071347931):* it stood QUIET once, 548 ms, `beats[]` — the
  colony ROSTER's read, written as a `guarantee` (a net's timer), not as a `span`; a span since `1c83620d96`, so the
  state is expected to read `busy[…]` whenever it stands. The door's «nothing in flight» reads the kernel's motion
  waits (`flightsInTheAir`). The exception itself is lifted only on a reading with NO quiet span of that state.
- *2b, the two start nets* (`start-shadow`'s confirm, the `start-stranded` watchdog). **NOT deleted on the zero
  reading (2026-11-23) — reading them against the level door first said no, in two places** (`02d556c48d`):
  ① the watchdog is not the director's twin: it reads a hosted step that does not answer the asked question as
  serving NOTHING (`hostedStepServes` — «a strand dressed as a step», the field hang of 2026-10-28 itself) and heals
  it; the director reads `step` and has no cure for it — deleted, that case falls to the arbiter's ladder, ten
  seconds in. ② the confirm is the only release of `game > shell` / `game > step`, the one state the door stays shut
  in (a start left yielded under the game's menu covers the board — the field of 2026-10-31 22:15). «Zero lines over
  three readings» proved the nets are SILENT on healthy tables, not that the door covers what they cure.
  **How they go:** the watchdog's own cure executed BY LEVEL (a third door: `startStrandedNow` ∧ nothing in flight
  for its frames → `healStrand` → `reopenStartStep` → the yield) and the shut state opened by what stands quiet —
  each after its measure. The STRAND-DOOR track reads what is in flight under a strand by frame (`STRAND-DOOR
  <question> · plan … · QUIET{…} | busy[…]`); the suite stands 52 strands of «the game asks» up to 1.26 s and 16 of
  the first action up to 0.24 s, every one ending by itself — the reading says how many frames of them were quiet,
  and so the door's number. Then both timers are deleted with every case they cured cured sooner, the e2e harness's
  `startStrandGuard` moves to the director's cure line (`[start-shadow] cure` — «a heal that had to run» stays red),
  and the bottle's four baselined rows of these nets (layout-less tables) are re-read on the same seeds.
- *S5-rest, the conclusion's level door.* **BUILT 2026-11-23 (`6725ceeb31`).** The second whole-suite reading (run
  45071347931, on `4dbd84dd1d` — the reader counting the kernel's motion waits): a dismissible candidate stood QUIET
  exactly TWICE in 1 502 tests, 550 and 582 ms — the colony ROSTER's read, a pause written as `guarantee` (a net's
  timer) where every other beat is a `span`; three dwells of `colonyController` are spans now (`1c83620d96`). So the
  door: candidate ∧ `dismiss` ∧ no look ∧ nothing in flight, for TWELVE painted frames and 250 ms → the ONE guarded
  conclusion, once per standing candidate (`staleFreeTurnClock.observeConclusionDoor` — pure;
  `outcomeController.lookAtConclusionDoor`). Its act is one counted line, `workspace-conclusion/level-door/<kind>`
  (info — WHICH flow left its ending to the level). Replayed in the bottle (a frame written past its commit with
  nothing inside leaves within a second, the reaper silent; RED with the door off); the bottle's monkey, 165 tables:
  the door opened nowhere on a healthy walk. **Next:** the reading of run 45083892683 (how often the door speaks in
  the suite, and for which kinds) and the gate's (45083901169) → the three nets behind it (the ghost test, the forced
  teardown, the reaper) are counters for one cycle, then retired by stage 7's rule. And the start door's one shut
  state is no longer a gap: a step standing on the start under the game's menu is the CONCLUSION door's to end when
  it is finished (`dismiss`) and the player's when it holds — the two doors compose, `startLevelDoorMay` keeps the
  boundary. *(The measure, as it was built:)* **Its MEASURE stands (`ee14aa2a67`).** The candidate is ONE pure predicate
  (`staleFreeTurnClock.freeTurnConclusionCandidate` — the free turn is asked and the stack's top is a frame past its
  commit that does not serve it); the reaper reads it once a second, and the measure reads it BY FRAME — a candidate
  that lives 200–900 ms is exactly what a level door of a few frames would act on, and a 1 Hz look never sees it.
  The look lives with the conclusion's OWNER (`outcomeController.measureConcludeDoor`, the controller's own scope):
  the first draft put it in the supervisor and the debt ledger refused it («the supervisor's PORT does not grow — a
  new net is a bound on its owner»), rightly. Each state is one span — `conclude|<kind> · dismiss|hold:<reason>[ ·
  look] · QUIET|busy[…]`, the verdict read purely. «What is in flight» is one reader for both doors now
  (`waitGraph/flightsInTheAir.ts`). First reading, the bottle (31 walks): `colonies · dismiss · busy[…]` up to 2.0 s,
  none QUIET. **Next:** the whole suite's reading (`node C:/Projects/Mods/tm-fz-tools/read_suite.mjs <corpus>`) →
  how many frames of quiet the door waits and which holds a candidate stands behind → the door in the outcome
  controller (candidate ∧ `dismiss` ∧ no look ∧ quiet K frames → the ONE guarded conclusion) → the three nets (the
  ghost test, the forced teardown, the reaper) as counters for one cycle.
- *The measure's residue — CLOSED 2026-11-23 (`25ccbedb5a`, `a3ab597429`).* Over the whole suite (run 45071347931)
  the function parted from the screen on fifteen looks of 1 502 tests, each named: nine `EXTRA:admission` — a
  PRESENCE THAT SERVES NOTHING (the deck pick's outgoing beat, a series' visit kept between its questions) read by
  the probe as a surface: the shell names them (`ScreenShadowContext.presences`) and the probe drops them; four
  `edge-LATCH` — the look read the watcher's edge inside the task in which a client pick opened: read past the flush
  now; two `band-fallback` — a resolution's draw embedded in the sitting's stage has no frame, so «admission is a
  door» did not reach it: a fact of the question (`QuestionFacts.standing`); one `MISS:held:optional` — the draft's
  waiting banner takes the host's admission. The gate's own reading on `6725ceeb31` (1 212 walks): MISS 0 · EXTRA 0
  · LATCH 0 · FALLBACK 2 (the pair just closed).
- **THE THREE DOORS STAND (2026-11-23, `57778d53ef`) — ONE RULE, `console/levelDoor.ts`.**
  *The conclusion's* (`6725ceeb31`) — read: the whole e2e suite (run 45083892683, 1 316 passed, all twelve shards
  green) — it opened NOWHERE and no dismissible candidate stood quiet at all; the freeze gate's 1 212 walks — ONCE
  (`fz1 · arwind-chairman-quest`: the Parliament left past its commit after the quest's answer, 256 ms, the player
  on the board — the reaper's class, replayed step by step); the box monkey in a real browser, 304 walks (plain,
  hidden) — nowhere. *The strand's* (`57778d53ef`): the watchdog's predicate and the watchdog's cure as two verbs,
  the heal at twelve quiet frames and 250 ms, the yield at twelve more — where the timers took 2.5 s + 2.5 s. Its
  bar comes from the STRAND-DOOR / STRAND-FRAMES tracks (runs 45085737951 · 45088611068): every long strand of a
  healthy table is busy, a healthy one is quiet for ONE frame at the most. The reading found a real thing on the
  way: **the scene's own mount was a strand** — its set-up published `none` before a node of it was in the DOM, 184 –
  207 ms of «the start serves nothing» on every boot into the opening (the measure's word, once it asked the scene
  why: «no scene»); the mount is a beat now (`ConsoleStartScene.sceneUp`, `54d394c4ac`). *The opening's* opens on
  `game > shell` too; it stays shut in ONE state, `game > step`, which is the other two doors' by composition.
  **THE TWO START NETS ARE RETIRED (`db69170c3e`, 2026-11-23) — by construction, each case with its door.** The
  reading before (run 45093794154, the whole suite on the three doors): 1 497 passed, all twelve shards; not one
  `[start-stranded]`, not one `[start-shadow] cure`, no door opened; a healthy strand quiet for ONE frame at the most;
  the opening's shut state and a dismissible conclusion candidate quiet nowhere. Deleted: the watchdog's two timers,
  the shadow's confirm with its painted-clock watch, their four constants, the findings' log and its `held-long`
  kind, the `start-shadow/finding` shape. The defect keeps its line: the director's cure BY LEVEL is `defect` now and
  the harness's `startStrandGuard` is red on it in every test, as on `[start-stranded]`. The bottle's four rows of
  the two nets on its one layout-less table are one row of the door that cures it. *Owed:* a replay of the strand's
  door on its OWN case (a hosted step left standing for a question it does not answer); the reading of run
  45101902265 and the gate 45101905535 on the retirement.
- **THE RETIREMENT, READ (2026-11-23).** The whole suite on `db69170c3e` (CI run 45101902265): 1 497 passed, all
  twelve shards — with every test now red on a `[start-shadow] cure … by level`; the freeze gate (45101905535): both
  seeds green; the box monkey in a real browser with a GPU (fz1 plain, 606 walks, the conclusion's door in the
  build): 0 defects, MISS 0 · EXTRA 0 · LATCH 0, no door opened; the box's own run of the whole suite (1 413
  functional tests): one red under a saturated box (`console-parliament-sitting-motion` — green 20 of 20 on the new
  head, re-run beside the chains), two reds of the TIMING project that a shared box cannot judge.
- **THE CONCLUSION's THREE NETS — read against the doors FIRST (the lesson of the start's).**
  *The reaper* — BOTH its cures are doors now: `dismiss` (`6725ceeb31`) and **a claim that answers for nothing
  (`713e8d0c30`)** — a frame held by its claim ALONE, no batch to take, no look, nothing in flight, for the same bar:
  reconciled, let go, concluded; the line is the defect's own (`workspace-outcome/claim-released-free-turn`).
  Built on the reading that there is no healthy twin: over the suite (45101902265) and the gate's 1 212 walks the
  only held-and-quiet candidates are the chairmanship's result standing for the player's press (a row of
  `FRAME_HOLDS` — named by the measure since `7a87fe6d1c`). Replayed in the bottle (released 256 ms in, the reaper
  silent). The reaper itself stays one cycle as a net that should not speak, then goes by construction.
  *The beat stall guard* (twelve seconds of a transient beat with nothing in flight → the frame torn down): the BEAT
  track (`d27a47f87b`) read NOT ONE quiet beat — the suite, the gate, the bottle. Its door is next; its cure is a
  teardown, so its bar is its own (longer than a conclusion's), and the reading to take first is the same track
  under the perturbations (the box's `fzu-*` passes: cpu×4, reload, duo, net 400 — on the head with the doors).
  *The ghost test / the forced teardown:* an owed conclusion refused by a hold that vouches for nothing — to be read
  with the owe's own escalation (`workspaceConclusionOwe.ts`), after the beat's.
- **THE BOX's PERTURBED PASSES ON THE HEAD WITH THE DOORS, READ (2026-11-23 morning — `649e500d8d`, a real browser
  with a GPU, 606 walks each).** `fz1` · cpu×4: defects 0, no door opened. `fz3` · duo (two seats on one table,
  68 400 presses): **two defects, both closed the same morning** —
  - **(CORRECTED the same day — the next reading, the same table on the new head: the state stood quiet 260 ms and
    the door on the family's bar cured it again. It was never «a healthy pause of 105 ms that ends by itself»: 105 ms
    WAS eight frames of that display, and the «beat» after it was the cure's own release. The table is NOT healthy —
    a start past its commit on a page with no lifetime hold (the second seat's page is opened into a deployment
    already begun), serving nothing under the game's menu after its first action's colony step has left; in the
    bottle the same seat's start leaves by itself the frame its first-action stage goes idle. The door is right to
    name it; the family's bar and «one state — one door» stand on their own reasons. What holds the start there is
    the strand's own word now (`startStandsBy` — every term of `startSceneServes` / `startFrameLive` by name), and the
    cure follows its reading. The paragraph below is kept as it was written.)**
  - *the opening's door opened on a HEALTHY table* (`parliament`, the second seat: `cure «release» by level —
    expected «game», on screen «none»: released`). The track named it: `game > none · release · QUIET` stands
    **105 ms** on that table by itself (the start past its commit, a hosted colony step gone, the game's menu asked,
    the scene's own release a beat away — twice `→ agree:game>beat`), six to seven frames at 60 Hz — and once the
    eighth. The door was the one door of the three built on frames ALONE (eight, «a state stands quiet one frame at
    the most» — true of CI and of the bottle, not of a real 60 Hz browser), and a bar in frames alone moves with the
    display: on a 144 Hz panel that healthy beat would open it every time. **The door stands on the family's bar now
    — twelve frames ∧ 250 ms, through `levelDoor.observeLevelDoor` like its sisters** — and, both doors being on one
    bar, **ONE STATE — ONE DOOR is by construction**: the strand's door does not stand for a state the director's
    door owns (`startController.directorDoorOwnsNow` — the same pure functions the door is armed by); until now the
    two were kept apart by eight frames against twelve, and on one bar both healed one strand in one frame (the
    bottle's replay named it at once). What the 105 ms ARE is still to be named: the strand's «why» printed the
    FIRST holder only, and «another prompt stands» is true of every strand under the game's menu — it names every
    holder and the settle's own terms now (the next duo pass reads it; a pause nobody declared is a `span` to add).
  - *`wait-graph/ceiling/played-hero:ship-absorb`* (560 ms, `parliament-diverted-enacted`): the bound ran out
    INSIDE a frame gap. The frame witness booked the gap still open as time the page gave (it is under GSAP's 500 ms
    threshold) — but a gap is booked when its frame comes, and a motion says it ended on a frame: **the time since
    the last painted frame is not time the page gave** (`frameWitness.watchFrames`; a short bound inside a gap is
    the wait's honest end, said `planned`; four frames a second is still a page that paints — the defect it was).
    And the bound itself was a duration (`motionMs`) where the law asks a ceiling: `motionCeilingMs`.
  The other two passes of the chain (`fz1` · reload, `fz3` · net 400) are still walking.
- **THE BEAT TRACK WAS BLIND — «not one quiet beat» was the measure answering its own question (found
  2026-11-23, reading the box's passes for the beat stall guard's door).** A frame in a transient beat is itself a
  node of the wait graph that waits for a motion (`surface:<kind>` → `<kind>:executing`, the supervisor's), and
  `flightsInTheAir` counted it: every beat read `busy[surface:…]`, whatever stood under it — over the suite, the
  gate, the bottle, the box's cpu×4 and duo. **Withdrawn: the sentence above («the BEAT track read NOT ONE quiet
  beat») proved nothing.** The reader takes the node it is asked about (`flightsInTheAir(now, under)`), and the
  beat's measure asks UNDER its own frame. The first honest reading, the same hour (the bottle, `fz1`, 118 tables):
  ONE quiet beat on healthy tables — `standard-projects:completing`, 304 ms, on every terminal commit: the read of
  the committed gold was paced by a bare timer (`flow.after`), and a timer is not a flight. It is a `span` now (a
  beat of stillness somebody wrote on purpose says so — the colony roster's dwell was the same class); re-walked:
  `busy[kernel:surface:std-projects-controller]`. **The beat's door is built on the NEXT readings, not on the old
  ones:** the whole suite and the gate on this head, then the box (a real browser lays out what the bottle cannot),
  each quiet beat either a pause to declare or the stall the door is for. And its «quiet» is not the conclusion's:
  the guard's own class — a claim whose stage can never arrive — stands `busy[claim:…]` (a wait for the server, by
  the graph's word) until the claim's own bound; the door has to read the beat the way the guard does (what MOVES:
  the wire, a blocking hold, a hand-off), which is the reading to take with it.
- **THE SECOND SEAT's STRAND — ITS CAUSE, AND ITS CURE BY CONSTRUCTION (2026-11-23, noon).** The strand's own word
  (`startStandsBy`, CI Monkey `fz3` · duo · `^parliament$` ×4 — run 45156087552, cured 4 of 4): `start:committed`,
  serving nothing under the game's menu, **«stands by NOTHING»** — not one term of `startSceneServes` /
  `startFrameLive` held it. The frame had simply not been closed: its leave was an EDGE (`startFrameLive` falling —
  a row of the shell's table), and a frame of the start that comes onto the live stack AFTER that edge met none.
  **The frame leaves by level** (`77f2c52edc` — `startController`: a start frame that APPEARS on the live stack while
  the start is not live is closed at once, by the verb the edge runs; the edge keeps its place in the tick). The same
  walk on the fix (run 45160934305): **4 of 4 green, `game > none` stands 25 ms and the start is gone — no cure
  said.** What the player had there before the doors: three seconds of a dead opening over their first turn.
- **A FLAKE OF THE SUITE, CLOSED IN THE HARNESS (`b5217ea088`).** `console-parliament-quest-plate` tv4k, flaky on
  the whole suite of `a244fdb717` (run 45140395156 — otherwise 1 497 passed): `socket hang up (ECONNRESET)` on the
  POST of a fixture — a keep-alive socket the server had just closed. Thirty-three specs carried a private retry and
  the SEED doors had none (108 sites of `/api/creategame`, every fixture). Once, in the `request` fixture
  (`tests/e2e/replaySafe.ts`): what is safe to send again — a GET, a POST to a seed door — is sent again when the
  connection was reset, and only then; a player's input never (`e2eReplaySafe.spec`).
- **THE WHOLE SUITE ON THE STACKS (`b8be73721f`, CI run 45148414617): 1 498 passed, no flaky, no net line; the gate
  45148420812 green.** `played-hero:target` is gone from the suite. Two readings out of it:
  - *`board-fit` said its case at last* — two green 4K tests (`console-flight-paint` A, `console-scientists-campaign`):
    «passes 2 of 6 · trail +330 drift size -37,-14 off 84,-45 > +561 banned by a tween > +3654 drift size 0,0 off
    2,-1». One calibration pass costs three seconds on a 4K software frame (the tween guard waits for painted frames
    at the target); the second pass found two pixels of offset and ran the curtain into its bound. **The curtain waits
    for a framing the player could see move, never for the last two pixels:** a residual OFFSET within 6 px lifts it
    (the pass still folds it, under an open curtain) — `ConsoleBoardSection.calibrate`, `boardFitHold.spec`. (The
    Moon's board is its own case, the frontier's: the tween guard never reads the transform at its target.)
  - *the honest BEAT track in a real browser, the whole suite:* ONE quiet beat on healthy tables —
    `hydro:completing`, 1.07 – 1.23 s, eleven tests: the result's read hold, a timer of the controller. A node of
    the wait graph beside it now (`hydro-flow:result-read`). With the standard project's read and the action
    commit's minimum beat that is three, each a beat of stillness somebody wrote and nobody declared — and no quiet
    beat that is a stall.
- **STAGE 2, THE TAIL — ⓐ ⓑ ⓒ ⓓ ARE DONE: NOTHING OF SECONDS STANDS BEHIND THE CONCLUSION's DOORS (2026-11-23, late
  evening).** The four steps of the entry below, in the order they were taken:
  - **ⓐ ⓑ (`f80f853c57`).** The ghost's teardown is the debt's own DOOR BY LEVEL (`workspaceConclusionOwe.drive`: owed
    ∧ ghost ∧ quiet under the debt's own waits ∧ no look, sixty painted frames and 1 000 ms — a teardown's bar; the
    two clocks, eight seconds and two and a half, are gone and `OWED_CONCLUSION_BOUND_MS` is only the graph's bound of
    the node). The conclusion's and the claim's doors ask «nothing in flight» UNDER THE FRAME's OWN WAITS, and the
    claim's door asks the funnel's own probe (`workspaceOutcomeServingNow`) — a claim that serves anything is never
    let go by it.
  - **ⓒ THE REAPER IS DELETED.** Read first, against the doors: the whole suite on `5306bfa1da` (45220695930), the
    gate (45220700405, 1 212 walks), the box's two-seat pass on `35657c6593` (`fzy-fz3-duo`, 462 walks read, 0 defect
    rows, no ghost and no `ONLY-ITS-OWN` span) — not one `[workspace-stale] concluded`. The only thing the reaper
    still SAID on a healthy table was its `held` line (info — `parliament` held by `live-outcome`, once on the box):
    a frame that waits for the player, which the conclude track of the measure reads by frame. Gone with it:
    `reapStaleFreeTurnFrame`, its candidate, key and clock (`STALE_FREE_TURN_MS`), the clock's five cases, the
    `workspace-stale` family of the diagnostics (shapes, the stall families, the journal's label, the RU line), the
    harness's `[workspace-stale] concluded` guard and the monkey's NET term (dead hooks — invariant 14). **The
    supervisor's port falls 29 → 27** (`concludeWorkspaceFlow`, `reconcileWorkspaceOutcome`): the supervisor concludes
    no finished frame any more. Pinned: the look's wiring on the three doors that read it; «the supervisor names
    neither the candidate nor the conclusion»; the bottle's two replays of the reaper's classes check the door opened
    ONCE (their «the reaper is silent» could no longer fail).
  - **ⓓ THE BEAT — decided: nothing is left to retire.** The beat stall guard's sampler went with `a244fdb717`; a
    frame's bound is the wait's own (`workspace/beat-expired` — the kernel's bounded wait, not a net beside it); what
    remains is rung 25 of the arbiter's ladder, and the arbiter stays by design (stage 7: «ONE arbiter»). No line of
    stage 2 names a second judge of a beat.
  - **WHAT STANDS BEHIND A FINISHED FRAME NOW:** its owner's doors (a quarter of a second; a second for a teardown) —
    and the arbiter's ladder. The ghost TEST itself (`stuckWorkspaceIsGhost`) is still a sampled predicate, by the
    decision of 2026-11-22 (the redesign «owed steps as children of their frame» is not planned): it is asked by ONE
    door, under quiet.
  - **THE VERDICT IS CI's** — the whole e2e suite and the gate on the head that carries this entry; the box's passes
    on it after. The stage is CLOSED by the entry that reads them, not by this one.
  - **Not of this stage, opened by reading a ceiling under green tests (the owner, 2026-11-23: «что видел игрок?»):**
    `wait-graph/ceiling/transfer:touchdown` — «its timeline at 100 %» and no touchdown, three tests of run
    45220695930 (`console-board-of-directors` B · F, the price «−12», 1 780 ms, planned — the page starved;
    `console-palladin-shipping` E·2·C, the price «−2», 2 160 ms, DEFECT — the page gave the motion its time). An arc
    that is complete and a beat held 1.2 s past its budget: the result is born only after its price lands (PL-099),
    so the player waited for it. The line named a flight and nothing to read the rest by — it now says where the
    touchdown stood (`touchdownWord`: never ran · the settle at N % [and not active] · touched down with no settle).
    The next reading names the cause; no cure is written on a guess.
- **STAGE 2, THE TAIL — WHAT IS LEFT, AND HOW IT IS BEING CLOSED (2026-11-23 evening; the owner: «сначала закроем
  этап 2 на 100 %»).** What the stage's exit still lacks is the retirement of the three nets behind the conclusion's
  door: the stale free-turn reaper (`supervisorController.reapStaleFreeTurnFrame`, eight seconds), the ghost test and
  the forced teardown (`workspaceConclusionOwe.drive` — eight seconds owed, two and a half read a ghost). (The
  structural mirror «owed steps as children of their frame» is NOT planned — decided 2026-11-22, above; the legacy
  witness conditions of step ③ are already gone from the tree; the strand's door is replayed on its own case —
  `35657c6593`, red with the door off.)
  - **READ AGAINST THE DOORS FIRST — they are NOT redundant yet, in three places.** ① The reaper lets a claim go
    whatever its stage; the claim's door needs «nothing in flight», and a claim that still awaits its answer IS a node
    that waits for the server (twenty seconds). ② The ghost test and the forced teardown act under ANY question; the
    doors only over the free turn. ③ **Under a DEBT no door could hear «quiet» at all:** an owed conclusion is a run
    with a cadence (a `sleep` every half second — a row of the kernel's motion waits), so while a debt stands
    `flightsInTheAir` is never empty; the frames the reaper and the escalation still cure are exactly the ones that
    owe. The BEAT track's blindness again — the measure counted its own subject (the gate's first reading of the new
    track, run 45201563602: every debt of 1 212 walks read `busy[kernel:task:conclusion owed]`).
  - **THE MEASURES (`266bcb860e`, `b459c8196b` — stats only):** the OWED track
    (`owed|<kind> · q:<asked> · held:<reason> · ghost|vouched · QUIET|busy[…]`, the flights read UNDER the debt's own
    waits — its conclusion's node, its claim's, its frame's, its cadence) and, on the conclude track, a candidate
    whose only flights are its own (`ONLY-ITS-OWN[…]`). `flightsInTheAir(now, under)` takes several nodes, and a
    kernel wait by its owner's name.
  - **THE FIRST READING IN A REAL BROWSER FOUND A DEFECT THE PLAYER SAW (the whole suite, CI run 45201555664 —
    1 497 passed, no flaky).** «Ghost» reads on healthy tables eight ways — seven of them under scenes that are
    playing (≤ 644 ms; the escalation's two and a half seconds are what keeps it off them, and a level door that asks
    «quiet under its own waits» would not act there at all) — and ONE with nothing in flight:
    `owed|hand · q:choice · held:live-outcome · ghost`, 0.6 – 1.0 s, `console-project-eden` C · D. That is «WG
    Project» → «Project Eden» → «which tile next» standing in the HAND's zone (P58 · FS): the claim holds the hand,
    and nothing said the claim was SERVING that step — the ghost test read the hand a phantom for as long as the
    player thought. Past the escalation **the workspace was torn down by force under the decision** («reported
    finished but could not dismiss for 11s with nothing served — forcing teardown»), the step fell out of the hand
    into a band of its own: three seconds of thought in a real play; the spec pressed inside one. **Cured
    (`5306bfa1da`):** the chain's step in the claim host's zone is the claim's served prompt
    (`workspaceOutcomePromptServed`) — replayed in the bottle (twenty seconds of thought: the hand stands; with the
    term off the teardown comes in three), and the e2e now lets the page live thirteen seconds on the step.
  - **NEXT, on the reading of run 45220695930 / the gate 45220700405 / the box's `fzy-*` passes (duo, net 400, cpu×4
    on `35657c6593`):** with no «ghost · QUIET» left on a healthy table — ⓐ the escalation becomes the debt's LEVEL
    DOOR (owed ∧ ghost ∧ quiet under its own waits, for the family's bar → the force path), its two clocks go;
    ⓑ the conclusion's and the claim's doors read the flights UNDER the frame's own waits (so they open under a debt
    and on a claim that only «awaits»), if no healthy `ONLY-ITS-OWN` span outlasts the bar; ⓒ the reaper is deleted
    (its predicate, its clock, the `[workspace-stale]` lines and their shapes, the harness's guard); ⓓ the beat: no
    net of its own is left to retire — the sampler is gone (`a244fdb717`), the frame's bound is the wait's own, and
    rung 25 is the arbiter's, which stays by design (stage 7: «ONE arbiter»).
- **THE READINGS OF THE AFTERNOON (2026-11-23).** The gate on `77f2c52edc` (45162258075) and on `43dc5a3260`
  (45171530623): both seeds green. The targeted suite on `43dc5a3260` (45164529687 — the Hydronetwork, the 4K boots,
  52 tests ×2): green, not one defect class; the two 4K tests carry no `board-fit` line, `hydro:completing` reads
  `busy[flow:ceiling:hydro-flow:result-read]`. The box, the new head `0be1b6082f`, `fz3` · duo, all 606 walks: one
  defect — the second seat's strand (cured one commit later) — and not one quiet beat. The strand is replayed in the
  bottle (`62564f1a37` — red with the reaction switched off, green with it).
- **THE WHOLE SUITE ON `43dc5a3260` (CI run 45171525046): 1 497 passed, no flaky, no net line, NOT ONE QUIET BEAT**
  (the honest track, the whole suite in a real browser — the three declared pauses read `busy`). The one net left
  under a green test is the MOON's `board-fit`, and its word names the cause: «tween on, 0 stable · owed nothing ·
  passes 1 of 6» — the tween guard (`scheduleBoardTweenCheck`) reads «painted at its target» as «THE `.board-cont`
  stands at the stage's centre plus the folded offset», which is true of one board in the stage's flex and not of
  two side by side (the calibration centres their UNION — «drift size 116 … off 73»): the guard never reads the
  target, `boardTweening` stands for the whole game, and with it the calibration's ban and `boardGeometryCalm`. A row
  of the day the Moon is adapted (the frontier — `expansion-adaptation-checklist.md`): the guard has to ask the
  board where it SHOULD be painted, not assume the one-board layout.
- **ONE FLAKE LEFT OPEN, WITH ITS TRACE (the whole suite on `77f2c52edc`, run 45162252640 — 1 497 passed).**
  `console-flight-paint` A · tv4k (the stand of «a token never paints under the surface it lands on»): the first
  attempt read token #3 `lit→under→lit · under hull 1× [aside.con-res]` — ONE sample under the rail; the retry
  passed, and so did the four whole runs before it today and a repeat of the spec ×8 on the next head (45176751359,
  32 runs, no retry). A frame the player could see, once in about fourteen 4K runs on CI's software raster. By the
  code the handover is decided in the very tick the token is moved (`transferTurnDue` in the flight's `onUpdate`),
  against the cover measured at the birth (`.con-shade`'s box) — so the one way left is a cover that was not the
  glass at that moment. **Not cured: not named yet.** The paint witness's report now says where and how each sample
  under the hull stood (the moment, the point, the layer, the paint) — the next occurrence tells a late handover
  (`under`) from a broken ladder (`lit`).
- **THE BOX's PERTURBED PASSES, CLOSED (the old head `649e500d8d`, 606 walks each):** cpu×4 — 0 defects; reload — 0;
  net 400 — 0; duo — 2, both cured above (the strand; the hero's absorb inside a frame gap).
- **THE NETS UNDER GREEN TESTS, AGAIN (the whole suite on `713e8d0c30`, CI run 45110190541 — 1 497 passed).**
  *`played-hero:target`* was not closed by taking the prewarm's word away: the FLIGHT's own wait then ran its whole
  budget after the prewarm had spent one — a card hanging 3.4 s over a place that was never coming (a play hosted by
  a step whose shelf is away, `console-sponsor-colony`). **One budget, counted from the arm** (`41f16b29f5`): the
  prewarm hands its deadline over with its answer, the flight waits what is left (a 320 ms floor).
  **…and with one budget the line named its CAUSE (the whole suite on `d575cd2cd7`, run 45131828798 — 1 316 of
  1 316 passed in eleven shards read): «Orbital Construction Yard · workspace:lifting · no landing place registered»
  — not the sponsor's project, the NEXT prelude.** The registry of landing places was ONE slot with three providers
  (the start's «РАЗЫГРАНО» shelf for its whole life; the table's overlay and a composer's receiving stage for one
  scene each): the second wrote over the first, and leaving it took the slot with it. After a play from the hand
  hosted inside the start the shelf's place was gone for the rest of the opening — every later prelude lifted, hung
  and dissolved where it stood instead of flying onto the shelf: a defect the PLAYER saw, read off a net under a
  green test. **A stack** (`providePlayedHeroTarget` — a provider that leaves gives the front back to the one before
  it; the hero's spec holds it).
- **THE CLASS, LOOKED FOR EVERYWHERE — «a registry of ONE slot with more than one provider» (the owner, 2026-11-23:
  not only freezes — the plain UI/UX defects too, and the same class in other places).** Twenty-three registries of
  that shape in the client (`if (slot === mine) slot = undefined`); all but two have one provider. The two:
  - **THE PAD's OWN HANDLER (`consoleRouter.registerConsoleIntentHandler`) — a dead screen, by reading and by a red
    spec.** The shell registers for the whole game; the campaign map standing INSIDE the endgame workspace installs
    its own menu pad over it; leaving, it cleared the slot — «B returns to the results» returned the player to a
    screen that heard NOTHING until a reload. No net could cure it (every rung of the arbiter «releases» surfaces; no
    surface was wrong), and the one e2e that walks the scene reloaded right after B and never pressed. A stack
    (`consoleIntentHandlers.spec` — red before, green after); `console-campaign-endgame` now walks the focus on the
    results after the map has left.
  - the receiving stage's effect hooks (`provideReceivingEffectHooks` — two composers mount the stage): a stack too.
  The setter-shaped registries (`register…(undefined)` at the leave — forty of them) were read the same way: three
  have two setters, each pair exclusive by construction (the draft's tray and its workspace's shelf; the start's dock
  layer and the carryover picker's; the campaign viewer's name) — nothing to cure there.
  **PROVEN IN A BROWSER (CI run 45146062455 on `bcb453efbc`, ×3):** `console-campaign-endgame` walks the focus on
  the results after the map has left — green; `console-sponsor-colony` — not one `played-hero:target` line, the
  next prelude lands on the shelf.
- **THE HONEST BEAT TRACK, READ WIDE (2026-11-23).** The bottle, `fz1`, ~590 of the 606 tables (five processes — one
  runs out of heap past ~165): **two quiet beats on healthy tables, both pauses somebody wrote and nobody declared**
  — the standard project's read (a span, `0be1b6082f`) and the action commit's minimum beat
  (`card-actions:executing`, 720 ms: the source card's impulse, a GSAP episode behind a timer's backstop — a node
  of the wait graph now, `action-commit:settle`, `b8be73721f`). The box, a real browser, the new head, `fz3` · duo
  (the first 152 walks): defects 0, not one quiet beat, not one quiet `game > none`. The gate on `ce4a44eb63`
  (45135036164) and on `a244fdb717` (45140399351): both seeds green. **The 1 Hz beat sampler is gone**
  (`a244fdb717` — `observeBeatStall` / `tickBeatStall` had no caller since architecture v2: the beat is judged by
  the frame's own bound and by the arbiter's `beatOwed`; what this journal called «the beat stall guard's door» is
  therefore a door over the ARBITER's rung 25, to be decided on the whole suite's honest reading — run 45148414617).
  *`scene-transition/hold-bound/board-fit`* stood under three more green tests (`console-old-mining-colony` B,
  `console-medical-institute` A·B, `console-rail-value-badges`) and NOT ONCE in thirty on a repeat of two of them
  (45128453374) — a race, and its line named nothing. **The hold says what it was waiting for** (`d575cd2cd7` —
  `deferSceneReveal(name, maxMs, standing)`: the stage, the fit, the tween, what is owed, the passes spent and the
  trail of what each calibration pass found). A measure; the cure follows the next whole run's reading.
  *Its first word (run 45131828798):* only the Moon's board spoke — `tween on, 0 stable · owed nothing · passes 1 of
  6 · trail +87 drift size 116,-14 off 73,-21 > +143 banned by a tween`: one pass found a drift, armed the tween
  guard, and the guard never read the transform at its target for the whole six seconds (the frontier's board —
  the tween check's own early returns leave `boardTweening` standing). The three tests of the premium scope did not
  fire in this run: the race is still unnamed, and the word is there for the run that catches it.
- **THE ENGINE FUZZ's FIRST NIGHT ON CI — finding #99, closed (`ed96b620b9`).** Seed 2078000753: Project Inspection,
  the last card of a hand, offered Ceres Tech Market's action again — «discard 1 card of 0», refused by the engine.
  A copier played from the hand is still IN the hand while it is judged, previewed and played; an action that needs
  a card in hand read the copier as that card. `repeatableActionCards` judges the hand the action will HAVE
  (`ProjectInspection.spec`; the seed in `engineFuzz.spec`; the CI proof run 45131833031).
- *THE GATE WENT RED ON MY OWN WORD (run 45083901169, `6725ceeb31`):* `wait-graph/unshaped`, eleven records — the
  detail the hero's target got that night carried brackets of its own, and the line's readers take the first `)` for
  the end of the owner's part. A wait's word is said without brackets now (`ceilingWait.ts`, `waitGraph.ts`), as a
  spec (`ceilingWait.spec`); issue #97, the gate re-run 45090714426. And the ratchet of bare ceiling waits is at
  ZERO (`2b9b03e328` — the last twenty-seven named, a delegated pass read line by line).

**STAGE 4, STEP 3 — WALKED OR DECLARED: 100 % OVER THE UNION (2026-11-22).** The corpus is the union of every pass
there is: the whole e2e suite on CI (1 502 tests — the fixture files the kernel's coverage since step 2), the monkey
in the bottle in every mode (plain, guided, reload, the hidden page, the broken wire, the shrink), the monkey in the
real browser — **3 421 walks**. Flows 247 of 285 opened, frame kinds 13 of 13, machine moves 43 of 83.
- *The frame's protocol* (`consoleWorkspaceFrame.FRAME_PROTOCOL`). The frame machine takes any phase from any phase,
  so its universe was every pair — 52 moves, 20 walked. The other 32 were never «unwalked»: 18 of them nothing in the
  product makes. The set it does make is written down (nineteen moves by phase, each read off the walks); a write
  outside it is still made (the record's one writer never refuses) and SAID — `[workspace] … off the frame's
  protocol` (shape `off-protocol`, info: a decision for the protocol, not an incident), and the coverage's universe
  is the protocol (`flowMachines.protocol` → `machineUniverse`), so such a move reads as `unlisted` in the walks'
  report and fails `kernel-walked --gate`.
- *The ledger* (`tests/client/bottle/kernelUnwalked.json`): every one of the 38 flows and 40 moves no pass walks,
  each with its reason — **debt 0**. By kind: 12 flows are DEAD declarations (the desktop endgame tree, which mounts
  only under `!consoleNative`; `start-setup-reveal`, `played-cards-pick`, the colony trade's `glide` answer — nothing
  arms them; a hold whose supplier no flush can see true), 9 stand outside a game or in a dev playground, 3 are
  failure paths, 14 are rare product paths with what a walk must do to reach them. A lazy component scope
  (`useFlowScope`) opens at its first WAIT, so «never opened» reads «its waits were never armed», not «never
  mounted» — the reading that makes the list short and true.
- *The guard* (`tests/scripts/kernelWalked.spec.ts`): no row without a reason; no row for a flow the sources no
  longer declare or a move its machine no longer has.
- *What the ledger names as work:* **the remote colony bonus** (`surface:colony-controller` — another seat trades
  where the viewer is settled and the bonus asks: a real product path no spec walks); the overlay-hosted played-card
  hero (`played-controller` / `played-overlay` — 3 421 walks never made it: reachable?); `presenting → abandoned` and
  the completing beat's bound (a story that hangs — the synthetic-layout pass); the claim's exits from `held` (a
  late answer behind a broken wire). The dead declarations are deletion candidates, the desktop ones with their wave.
Next: `kernel-walked --gate` on CI over the suite's corpus joined with the bottle gate's; the synthetic-layout pass;
socket faults; a spec for the remote colony bonus.

**STAGE 5, STEP 1 — THE ENGINE FUZZ (2026-11-21, branch `fz/s5`).** `tests/fuzz/`: random LEGAL games on the real
engine, in process, seeded — a random legal combination of the in-scope expansions, all twelve boards, 1 – 3 human
seats with or without MarsBot — and after EVERY answered question: I1 the table is alive (`tableStandsDead`), I2 no
seat holds a question nobody can answer (the engine's judge, and the generator over the WIRE model), I3 the deferred
queue is drained between answers, I4 an answer is taken or refused — never a crash; S nothing was said to the server's
error sink. `randomAnswer.ts` answers every prompt model type (a compile-time exhaustive switch). A smoke rides the
server suite (24 short games, a determinism test, five controls that plant a defect for each judge, a baseline of
known classes); `npm run fuzz:engine` is the long run (`TM_FUZZ_GAMES` · `_SEED` · `_STEPS` · `_MINUTES` · `_OUT`;
`TM_FUZZ_REPLAY=<seed>` stands one game up again).
*The first run:* 2 652 whole games, 685 084 answered questions (742 steps / s) — no crash, no dead table, no
unanswerable question — and ONE real defect, in two forms: **the effects of MarsBot's final greeneries were never
played out** (`Game.takeNextFinalGreeneryAction` went on to the end of the game with whatever the bot's placements
deferred still queued — the neighbour's Philares never asked which resources to take, a placement bonus counted and
never paid). Fixed in the engine (the queue runs out before the loop goes on), held by the two seeds replayed whole.
Next: reload equivalence (save → load → the SAME question), the batch route, shrinking, the nightly run.
*The second run* (fresh seeds 50000+, thirty minutes: 5 648 whole games, 1 452 618 answered questions, 817 steps a
second) named six classes, each in one or two games. **All six are closed** — five in the engine, one in the judge —
and each is held by its seed replayed whole (`engineFuzz.spec` «the second run's finds stay closed») beside a spec of
the defect itself; `TM_FUZZ_REPLAY=<seed> npm run fuzz:engine` replays any of them. **The baseline is EMPTY.**

| class (seed · step) | what happened | how it is closed |
| --- | --- | --- |
| `I2-none\|payment\|Neptunian Power Consultants` (55496 · 70) | two oceans of one chain are OFFERED while the purse holds the five; the second bill comes due on an emptied purse — a payment nobody can make | the bill is an offer (`skipIfUnaffordable`), judged by its own purse (steel counts) — `NeptunianPowerConsultants.spec` |
| `I4\|or\|world-government:solar-phase\|Overwriting waitingFor option with or` (50337 · 200) | the World Government's ocean wakes a card's question for a seat that still holds the sitting's soft confirmation: the engine throws, and the same answer throws for ever | `DeferredActionsQueue` — a question the queue raises takes the slot from the confirmation; the record is the server's, it is asked again when the slot is free |
| `I2-none\|or\|Head Start` (51456 · 7) | «both actions must be taken» on a menu with no «Pass»: a seat with no action left is asked a menu in which every row is refused | `Player.takeAction` — a bonus action nobody can take is FORFEITED by the engine and named in the journal; both judges of the unanswerable question learn «a list of cards to play with none enabled» — `HeadStart.spec` |
| `I3-refusal\|or\|Lake Marineris\|No available spaces` (50926 · 187) | MarsBot's three polders and a seat's Mohole Area took the ninth ocean's cell: `canAddOcean` said yes with nowhere to put one — a paid card refused half-played, and a table that could not END | THE SEA KEEPS ROOM FOR ITS OCEANS (`MarsBoard.seaKeepsItsCells` — a tile that is no ocean may not take a cell owed to an ocean; gate, named reason and grid read one set) + two floors: an ocean with no cell is skipped and said, a full sea is a finished sea — `SeaKeepsItsCells.spec` |
| `I3\|option\|start:corporationPay\|…PharmacyUnion.onCardPlayedByAnyPlayer` (50072 · 6) | a reaction queued for a seat that had ALREADY left the research phase: nobody ran it until the action phase, a reload lost it | `Game.playerIsFinishedWithResearchPhase` — each way out runs what the seats that are done are owed, and the phase turns only when no way out is still running — `ResearchBarrier.spec` |
| `I3\|card\|draft:standard\|…ArcticAlgae.onTilePlaced` (51755 · 102) | MarsBot's research step woke a seat's card while the seat still held its research question | NO DEFECT — the judge's law: the research phase drains per seat, work queued for a seat still in it is OWED on its way out (this also explains the first run's by-design row, which left the baseline) |

What the second run taught the instrument: a class whose key carries a CARD is a law the judge does not know yet —
it is written as the law (one line in the judge), never as a baseline row per card. Next: the third run on fresh
seeds over the fixed engine; reload equivalence (save → load → the SAME question — the research barrier's lost
reaction is exactly the class it will name); the batch route; shrinking; the nightly run.
*The third run* (the fixed engine, fresh seeds 60000+ and 80000+, thirty minutes each in two processes: about 6 400
whole games) named **no class at all**.

**STAGE 5, STEP 2 — RELOAD EQUIVALENCE (2026-11-22).** «Save → load → the SAME question», as a check of the fuzz
(`FuzzHooks.reload`, `TM_FUZZ_RELOAD=<n>`; the suite's smoke judges every save). The deferred queue is never
serialized and a prompt is not either: what a loaded game ASKS is re-derived from its phase. So the check stands
where a reload really lands — AT A SAVE, read where it reaches the database (`GameLoader.saveGame`), and only when
nothing moved after that save in the same answer (the engine going on past its last save is the upstream design: a
reload there goes back). The save is loaded into a copy by `Game.deserialize` — the very road a restarted server
takes; the copy saves nowhere, draws from a random stream of its own, and the spec holds that the live game plays the
same game with the check on. Every seat of the copy must stand on the question its seat of the live table stands on
(`R` — another question; `R-model` — the same question with another body; `R-load` — the save does not load).
*The first reading:* 120 whole games, 32 509 answers, **15 568 saves loaded** — and two families:
- **A SAVE UNDER A QUESTION ONLY THE QUEUE CAN ASK — a real loss.** In the Parliament a law's free colony was built on
  Europa; the build's ocean was still asked — by the queue — when another seat was offered its early close and the
  sitting SAVED. Loaded, the sitting adjourned with the ocean never placed; the same with a production to lose and a
  resource to choose (seeds 113 · 118 · 177). The Parliament's resumable driver covers a law's own STEPS; a
  consequence of a step's answer is the queue's. **The law is the engine's, in `Game.save`: no save is taken while a
  question the deferred queue raised stands** (`DeferredActionsQueue.asksAnyOf` — a weak set of the inputs it asked,
  so one that no longer stands holds nothing). The last save before it holds — a consistent point by construction:
  a reload goes back to the answer that led there, nothing is lost and nothing is paid twice — and the table is told
  all the same. The action phase always lived by this (`takeAction` saves once its queue has drained); now it is
  written where every save passes. `tests/liveness/SaveLaw.spec.ts`.
- **A CARD's `warnings` ARE THE HISTORY OF A PROCESS, NOT STATE.** They are written onto the card object by its last
  PLAY evaluation and read by every list that shows the card. A discarded card kept them; the discard pile is
  shuffled back into the deck — and the card came back in another seat's draft, or in the research buy, wearing a
  warning about a play nobody was weighing (the live table showed it, the same table loaded did not). `Deck.discard`
  clears them. What a seat's view leaves on cards by its HYPOTHETICAL evaluations (a law's discount, a staged play)
  is the same class and is still there: the check reads `warnings` apart, and the finding stands in this line.
- One more thing the check named and that is no reload's defect: a forecast fact without a fixed id is numbered by a
  counter of the process (`effectForecastPreviews.baseFact`) — two builds of one model never agree on it.
With the law and the fix the three seeds replay clean, and the smoke holds the check on every save.
*The long run with the check on* (`TM_FUZZ_RELOAD=2`, fresh seeds 90000+: 381 whole games, 98 761 answers) named one
more class, in one game (90013): **a save in the SOLAR phase loads without the World Government's step.** With the
Parliament the sittings save inside that phase — a seat closing its sitting while the first player still chooses —
and `Game.deserialize` knew the Solar phase only in its «owed» form (`sittingAcks.owedWorldStep`): the plain one fell
through to «the action phase», so the first player was asked their ordinary turn in the Solar phase and the World
Government never acted. A load now re-asks the step, as it does a draft's pick and the research buy
(`tests/liveness/ReloadSolarPhase.spec.ts`).
*The night's job* (`.github/workflows/engine-fuzz.yml`, 22:43 UTC): forty minutes of games on a range of seeds nobody
has played (the day's number × 100 000), the reload check on every second saving answer. A class the baseline does
not hold is FILED by its seed (`scripts/ci/findings.mjs from-fuzz` — `engine-fuzz|class|<class>`: what the judge
said, the seed and the answer, the command that replays the whole game on a laptop, and its proof — that seed played
again). The same filer now names the one-owner law's red by its verdict and tables (kind `owner-law`): the night #84
was found it was filed as «red with nothing named».
*Its first run on CI* (a five-minute trial, 107 games on the day's range) named a class nobody had seen and filed it
by itself (#85, #86 — seed 2077900043): the chairmanship SAVED the moment its quest was answered, with the trade's
colony bonus still waiting in the queue behind it — loaded, a settler's «Collect N cards» was never asked. **The save
law, whole:** no save is taken while a question only the queue could ask stands OR the queue still holds work a load
would not queue again (`DeferredActionsQueue.holdsWorkNoSaveKeeps`; the one exception is declared on the action —
`requeuedOnLoad`, the opening's colony removal); the colony bonus, which asks every settler around the queue's one
door, says its questions to the queue (`noteAsked`). The same range of seeds played again on CI: no class.
*What the law costs, said plainly:* a reaction left queued for a seat through a per-seat phase (the research buy —
MarsBot's research step waking a seat's card) now holds every save until that seat's way out; a server restarted in
that window comes back at the save before the phase. It trades a silently wrong table for a few answers to give
again — and it is the reason to drain such a reaction at once (the open half of «the research phase drains per
seat»). Next: that drain, the batch route, shrinking.

**STAGE 6, STEP 1 — THE AUTOPILOT: WHOLE GAMES THROUGH THE REAL CONSOLE, IN THE BOTTLE (2026-11-23).** The monkey
walks sixty presses from a fixture and never ends a game; what a game does only as a WHOLE — a stack opened and closed
two hundred times on one page, a research every generation, the finale after all of it — no pass had stood on.
- **The instrument** (`tests/client/bottle/autopilot.ts`, `autopilot.bottle.ts` — opt-in, `TM_BOTTLE_AUTOPILOT=1`):
  a table the engine fuzz draws from its number (`fuzzConfig(n)` — every in-scope expansion, MarsBot in three games of
  four, one to three humans, every board), played from its first press to the final scoring on the manual clock. THE
  VIEWER presses what the bar offers (the guided pick, with a pilot's weights — A and RT carry a flow on, a look is
  opened seldom and closed by the next press) and passes the way a player does — the basic wheel's ↓ and its confirm;
  THE OTHER SEATS answer by the fuzz's own generator through the server's door (`seatAnswersRandomly`); a question the
  walk did not get through in its budget is answered the same way FOR the viewer and COUNTED by type, with what stood
  on screen (`doors` — where the screen and a seeded thumb part). A game is filed as a walk is (`cause-classes/…` —
  the journal by class, the one-owner measure, the coverage) plus its own numbers, so `monkey-report` sums a pass of
  games and holds the same laws. By hand on CI: the workflow `Autopilot` (games dealt over shards; no schedule yet —
  the first passes are read before a baseline is written).
- **ITS FIRST GAME FOUND A WEDGE NO PASS HAD SEEN** (`ap0:1` — two humans, Vastitas Borealis Nova, generation 11).
  The viewer's corporation pays for the research with a resource; the server answers the buy with a `payment`; the
  player minimizes the workspace on that stage to read the board («Свернуть» — the most ordinary press there is) and
  returns. «Свернуть» parks the stack and UNMOUNTS the surface; the instance that mounts on the way back knew nothing
  of the purchase already committed: the terminal plate waited for a discard exit that had left with the first
  instance (`discardsSettled`, a ref of the component), the terminal beat was never armed, the completion latch
  (`draftWorkspaceState.completion` — module state, the frame's lifetime) never fell. **The research stood over the
  player's turn for ever, and the research of every later generation opened in a workspace whose only verb was
  «Свернуть» — the game was over for that seat until a reload.** No net could name it: a `browse` frame is the
  player's own time, a phase root is the anchor rule's, and the anchor rule read the phase alive off the same latch.
  - **The law** (`.claude/rules/console-flow.md`, the frame's section): a latch that extends a frame's life is finished
    by something that lives as long as the frame. Here: the receipt is module state (`receipt`); an instance that
    mounts inside a completion has no exit to wait for and arms the terminal beat itself; the zero-buy read is a wait
    of the FRAME's scope; and `draftFrameLive` holds the frame on a completion only while it stands on the live stack.
  - **Proved both ways, in both worlds:** the bottle's replay «a research surface that leaves inside its completion»
    — RED with the fix off (`completion: flights` for good), green with it; the e2e
    `console-draft-workspace` · «свернуть on the pay stage and back» on the box in a real browser — RED on a build
    without the fix (the workspace stood the whole sixty seconds of the poll), green with it; the same game played
    again: 12 passes by the wheel, none through the door.
- **What the first games say of the instrument itself:** with jsdom's 0×0 layout a game names one class of its own,
  `invariant/broken/start-flight:no-source` — a row of `LAYOUT_BLIND` now (a corporation carried from a measured
  face; the whole e2e suite walks that start in a real browser and has never named it). With the SYNTHETIC layout the
  board's framing probe never rests and everything behind it runs to a ceiling (`board-geometry:stable`, the remote
  landings, the finale's hand-over at 45 s) — the layout's artifact, read once and not chased: the autopilot's border
  is the gate's (`none`).
- **Next:** a pass of games on CI (`Autopilot`, 24 games), read class by class; the baseline and its gate; the same
  pilot in a real browser on the box (the stage's number is «100 whole games per map set, 0 episodes, 0 rebuilds»);
  the soak.

**STAGE 6, STEP 2 — THE FIRST PASS OF WHOLE GAMES, AND «A GATE THAT NEVER OPENS» (2026-11-24).** CI's verdict on
`c1531646fb` first: the whole e2e suite green (45258973293), the freeze gate green (45258980832), and the autopilot's
first pass — **24 whole games in the bottle (run 45258986188): 23 played to the final scoring, one stood at its cap;
no rebuild inside a game, no table nobody moved.** What the pass named, read class by class:
- **THE TABLES WERE NOT ALL THE PRODUCT's.** The fuzz draws the ENGINE's legal tables; three of twenty-four drafted
  BEFORE the game (`initialDraftVariant`), and the console has no surface for that question at all («expected draft,
  on screen nothing» — a stranded prompt, the arbiter curing it every few seconds). No screen of the creator sets it
  (`buildCreateGamePayload`: `initialDraft` is the default, false — as is the prelude draft, and Solar Phase goes
  with Venus and without the bot, never apart). The pilot's tables are narrowed to what the creator can make
  (`bootPilotTable`); the pre-game draft is FRONTIER, said here so nobody reads it as covered.
- **A GATE THAT NEVER OPENS — the deaf screen's third shape, and the arbiter could not see it.** Game 6 stood on
  «Добор карт» for six generations: «A Взять» on the bar, every press swallowed by `reveal-busy`. The surface's
  handler TOOK each press, nothing was dropped, the screen read `accepting` — the arbiter content, for good. Two
  things, both built:
  - **the arbiter counts an A / B a deliberate gate swallowed OVER NOTHING** (`inputEcho.verbAbsorbed` — counted at
    the router by the dispatch's own bracket; `supervisorController.quietAbsorbed` — only at a look where the graph
    names nothing in flight: `flightsInTheAir`, the doors' own reader). A gate over a declared flight is doing its
    work however long the flight takes; a gate over nothing will not open by itself — three presses, five seconds,
    `presses-no-effect`. (Counted bare, it named the bottle's `nobel-prize` falsely — a claim's arrival waiting for
    its surface, a declared state of the claim machine — within the hour: the reason the term reads the graph.)
  - **the gates it named, cured where they are.** ① The reveal's TAKE TURN ended only on the `animationend` of the
    slot's CSS turn — an event that does not come when the slot is re-made under the turn, the animation is
    cancelled, or the renderer has no CSS clock (the bottle: jsdom runs none — it stood there for good and said
    nothing). The turn's end is a declared ceiling wait now (`reveal:take-turn`, the sheet's 560 ms + a net, on the
    motion's ceiling clock): the event still ends it, a turn whose event never came commits at its ceiling and says
    so (a row of `LAYOUT_BLIND` in the bottle, where it always does). ② The fullscreen VIEWER's `zoom-flight` — named
    by the new term the hour it was written (the bottle's `fz1:aerospace-family`): «X → A Разыграть» flies the card
    into the composer and raises `zoomClosing`, whose only unwinder was the dialog's QUEUED 'close' event; late, the
    composer's «A Подтвердить» is swallowed for a task — never, the screen is deaf for good, B included. The plain
    close had learned this twice (CI 42223555435; the monkey's two-seat walk) and unwinds in a `finally`; the
    hand-off and the depart did not. Every flight that takes the viewer away unwinds it itself now
    (`unwindZoomFlight`, fenced by the open token). Replayed in the bottle — RED with the unwinding off.
  - With both: game 6 plays through its draws by itself (7 generations in 420 presses, no pass through the door).
- **THE SAME PILOT IN A REAL BROWSER** (`tests/e2e/console-autopilot.spec.ts`, `TM_E2E_AUTOPILOT=1`; the workflow
  `Autopilot`, `where: browser | both`): the bottle is minutes a game and is blind wherever a rect or a CSS clock is
  needed — half of what the first pass named cannot be told from that blindness by reading alone; the browser is ten
  to twenty minutes a game and sees everything. The solo player against MarsBot (three games of four) from the first
  press to the final scoring, a table the creator's own payload makes, judged by the harness's guards and filed by
  cause class like a walk. This is the instrument the stage's number is read on.
- **OPEN, each with its evidence — to be read on the browser's pass, never cured on a guess:** ⓐ a card played
  from the hand whose play moves the Hydronetwork onto a stage with a choice WHILE the corporation draws (Point
  Luna): the draw's claim is adopted by the nested `hydro` frame, the reveal finds no zone, `hydro:completing`
  stands until the arbiter's ladder (game 9 of the first pass, press ≈ 412: `claim:hydro … zone unmounted`,
  `UNREGISTERED ZONE [data-embed-slot="hydro"]`); ⓑ a sitting's `option` under its walk in the bottle (games 2 · 22
  — `stranded-prompt/parliamentphase` once each; the Parliament is the bottle's most layout-bound surface); ⓒ the
  draft's plate «did not come in its bound» behind a start that still stood (games 6 · 7 · 23 — the take turn's
  consequence; re-read on the next pass).
- **THE BOX is unreachable since the night** (the chain of `fzz-*` passes died with the session's machine; four of
  the eight shards of `fzz-fz3-duo` on `af6a97cc9c` are in: 186 walks, 0 defect rows, no ghost, no quiet beat). CI
  carries the verdicts meanwhile.

**THE TOUCHDOWN's CEILING, READ AND CURED (2026-11-23).** `touchdownWord` answered on its first whole suite (run
45242383549): every «its timeline at 100 %» stood on a SETTLE — at 0 % and not yet rendered (born in the very tick
the safety came due) or at 43 %. The arc ran late on a starved clock and the safety met the chip ON its destination, a
hundred milliseconds from its rest; the arc has a catch-up for exactly that, the settle had none, so the wait was said
as a ceiling — once at defect tier — over a token that had arrived. The settle is caught up like the arc
(`caughtUp: 'settle'`); the line stays for what is NOT that road (an arc complete whose touchdown never ran). What the
player saw: a token late by the page's own stall, nothing else.

**THE NIGHT RUNS, AND ONE QUEUE (the owner, 2026-11-17 — `docs/claude/ci-findings.md`).** CI is the main indicator and
it now runs by itself: the freeze gate (23:30 UTC — `fz0 fz1 fz3` + the seed of the day), the whole e2e suite (00:30),
the real-browser monkey (03:00 plain with the seed of the day; Sunday `cpu4` / `net400` / `reload` / `duo`), and a
watcher over every push's `CI` / release. **Every one of them files what it finds through ONE script
(`scripts/ci/findings.mjs`): one GitHub issue per cause class / test / failed job, touched when seen again, reopened as
a regression** — and a scheduled cloud agent triages the queue each morning: a verdict label + a comment for every finding, and a SIMPLE one (a wrong e2e check, a stale expectation, a trivial bug) fixed on a branch, re-run on CI and LANDED in `main` by the `Land ci-fix` workflow, which judges the pull request by a rule of the repository (`scripts/ci/landRules.mjs` — what a fix may touch, how large, what proves it) and bumps the version itself. A
working session starts from `gh issue list --label ci-finding --label triage:real`. No scheduled run shares a
concurrency group with the release, and each takes at most 8 – 10 runners at a time.

**The bar, stated honestly.** «No freeze ever» cannot be proven; what CAN be made true and checked: (1) every wait is
bounded and owned — statically, by guards at zero; (2) every question has exactly one server — by a total function;
(3) whatever is left is ended by the last line within seconds, once, behind the curtain the game already shows;
(4) all of it is measured — the matrix, whole games, the server fuzz, the field — and a release is refused on a
regression. **The owner's decisions on the way:** CI minutes for the gate (≈ 35 min a seed) and the nightly box
window; what the player reads when a question is refused (RU copy); R16's restyle of the root's state classes if the
box's frame budgets ask for it.
