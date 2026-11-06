# The SCREEN DIRECTOR — «правда сервера → одно состояние → один владелец экрана» for the WHOLE console

The owner, 2026-10-31, after the start director's first two field cures: «я хочу новый механизм дорабатывать и улучшать
и в итоге внедрять его на 100% по всему консольному интерфейсу (если это повысит надежность архитектуры)». The start
director (`start-director.md`) proved the shape on the opening: ONE pure function says who MUST serve the screen from
the server's one question; the latches' answer is read beside it; a sustained disagreement is first LOGGED (phase 0),
then CURED through the owners' own doors (phase 1). This document is the same migration for every question past the
opening.

## Why one director (the nets it is meant to replace)
Six nets each answer a PIECE of «who must serve the screen right now?», and every freeze of October walked between them:

| net | its piece of the question | blind spot |
| --- | --- | --- |
| stranded check (`consoleLeakDetector` check 1) | is ANY surface rendered? | a foreign surface counts as served; any notification-only hold masks it |
| foreground watchdog (check 2) | a claimed foreground with nothing rendered | only on `boardHomeIdle` |
| covered prompt (check 3) | the surface is mounted but painted over | evidence only |
| beat stall guard | a machine beat with nothing in flight | the deepest frame only |
| liveness arbiter | nothing accepts input and nothing is in flight | generic — names the release rung, not the owner |
| start strand watchdog + start director | the opening only | — |

## Phase 0 — SHADOW (shipped 2026-10-31)
- **The table** — `console/screenDirector.ts` `expectedScreenOwners(task)`: one row per `TaskKind`, exhaustive BY THE
  COMPILER (`{[K in TaskKind]: …}`). A row is a SET of owners (`ScreenOwner` = a workspace kind or a surface of its own:
  `task` · `deck-pick` · `decision` · `bot-attack` · `lanes` · `ares` · `prod-loss` · `gov-support` · `corp-first` ·
  `draft-wait` · `sheet` · `board`). Out of scope: the free action menu (`free`), the start's own questions (`start` —
  the start director's), `unknown`. The registry's default `serves` and every live / parked frame's runtime-earned
  `serves` are owners too (the leak detector adds them — `workspacesServing`).
- **The probe** — the leak detector's existing 1 Hz DOM pass (`screenOwnersPresent`): a workspace is present only while
  its frame RENDERS (`workspaceFrameRenders`) AND its root paints (two kinds share `.con-cardactions` / `.con-ma` — the
  stack tells them apart); a warmed surface and a start scene answering `none` / `yielded` never count.
- **Held** — ONE list of legitimate «no surface right now» reasons, `promptHeldReason`, shared with the stranded check
  (the old early-return chain folded into it, behaviour unchanged). The one difference is deliberate: the stranded check
  counts ANY animation hold, the shadow only BLOCKING ones («a decision never waits on a story»). The shell adds the
  prompt's admission block (`registerScreenShadowContext` → `admit:<block>`).
- **The verdict** — `agree` (an expected owner paints) · `held` · `beat` (a transient scene stands: `BEAT_SURFACES`) ·
  `unserved` (nothing paints — the stranded class judged WITHOUT the notification-only mask) · `misserved` (a surface
  paints, but not one that answers this question — the class no net judged). Confirmed over
  `SCREEN_SHADOW_CONFIRM_TICKS` (3) passes with an unchanged signature, logged ONCE per (kind, owners, prompt):
  `[screen-shadow] <kind> — expected «…», on screen «…» for «<task>[:mode]#<promptId>» {json}`;
  `window.__conScreenShadow()` reads the session's findings.
- **The harvest** — every e2e test files its lines under `test-results/screen-shadow/` (`consoleTest.ts`
  `screenShadowHarvest`, sharing `armShadowHarvest` / `fileShadowFindings` with the start shadow — whose slug had lost
  `\w` and filed every test of a file under one name); `node scripts/screen-shadow-report.mjs <task | dir> [--detail]`
  groups a run.
- **The evidence it LOOKS** (2026-11-01 — a first part of the suite filed ZERO findings, and the owner: «это странно,
  надо всё хорошо проверить, чтобы механизм был реально рабочим»). A silent shadow and a right product read the same,
  so every pass is COUNTED (`screenShadowLog.stats`, `noteScreenShadowPass`): the verdicts (`agree` · `held` · `beat` ·
  `unserved` · `misserved` · `none:<scope>` — `none:no-context` is a shell that never registered, a silent shadow made
  visible), every hold reason with its LONGEST unbroken run (a hold standing for minutes is a latch, not a beat), every
  beat, and WHO served each prompt shape (`owners` — the observed map the table is tightened against), and what every wait HID
  (`masked` — under a hold the expected owner never stands, or it would have agreed: `nothing`, or a FOREIGN surface —
  the evidence a hold would otherwise swallow). The harness
  appends one line per test, findings or not (`test-results/screen-shadow-judged.jsonl`), and the report ends with
  the TABLE'S COVERAGE — every in-scope row the run never judged.

## Proof that it works — the positive controls
A run with no finding is evidence only if a defect, when there is one, IS found. Two layers put one in on purpose:
- **Unit, the whole path** (`tests/client/components/console/screenShadow.spec.ts`, mochapack): the shell's context →
  `runLeakDetection` → the DOM probe → the verdict → the confirmation → the `[screen-shadow]` line → the stats. Caught:
  `unserved` (third pass, once), `misserved` (a FOREIGN workspace — the class no other net judges), a root painting
  WITHOUT its frame (unserved — the stack decides presence). Not caught, by design: `agree` (the owner counted), the
  announce gate / an admission block (`held`, with the run length), a BLOCKING hold (held) — while a NOTIFICATION-ONLY
  hold, which masks the stranded check, does NOT mask the shadow; a beat; the start's question; no context (counted).
- **Live, the real build on the box** (`tests/e2e/console-screen-shadow-control.spec.ts`): the draft pick of a fixture
  is judged AGREED with the draft as its observed owner; the draft's root taken off the screen behind the product's back
  with a foreign `.con-sheet` standing → `misserved` (present `sheet`, expected ⊇ `draft`, prompt
  `cardSelect:draft#N`); the screen healed → agreement resumes; nothing standing → `unserved`; each console line once.

## The step-by-step migration — each step has a GATE, and no step starts before the previous gate is green
**Step 0 — the shadow (shipped).** Gate G0: both positive controls green; the whole suite run with the stats build;
the report read.

**Step 1 — the map is EXPLAINED.** Every finding of the whole-suite map is classified: (a) a row missing or too narrow
in the table → fixed in the TABLE (rule 2); (b) a probe blind spot (a surface of its own not in `OWNER_SURFACES`, a beat
not in `BEAT_SURFACES`) → a row there; (c) a real product defect → a stand (red before) + its fix in the owning module.
Gate G1: a whole-suite run files ZERO unexplained findings.

**Step 2 — the table is VERIFIED and TIGHT.** (a) Coverage: every in-scope row is judged by the suite (`NEVER JUDGED`
empty) — a row with no stand gets a fixture/stand (the worklist is the report's list). (b) Tightness: a row is narrowed
to what was OBSERVED serving it (`WHO SERVED`), the generic family (`TASK_FAMILY` — any stand-in surface for a payment)
split per shape where the evidence allows: a cure that accepts a wrong owner as «agree» is worse than none. (c) Holds:
every hold reason's longest run below its own ceiling; a reason with a run of minutes is a latch to stand up. Gate G2:
coverage complete, every row's owners ⊆ observed ∪ a written reason, no unbounded hold.

**Step 3 — the field agrees.** The flight recorder already ships every `[screen-shadow]` line from the box and the
Deck (`fieldRecorder.ts` keeps any `[tag]` warn); the field's lines are read with `scripts/field-log-report.mjs`. Gate
G3: a week of the owner's games with no unexplained field finding (or each one stood up as in step 1).

**Step 4 — cures, ONE CLASS AT A TIME** (the start director's phase 1 grammar). Each class gets: a stand red before, a
cure through the OWNER's existing door — `unserved` → the owner's own opening door (the routing that already stands a
prompt up: `openHandWorkspace`, `openColoniesForPrompt`, the task host's restore), `misserved` → the foreign surface
yields through its own leave verb; a cure is a `[screen-shadow] cure` line (a latch bug to stand up, as the start's),
a liveness rung (`screen-director`, rank 17 — between the start director's 15 and the flows' 20) so the arbiter's ladder reaches it. **Prepared 2026-11-02 — see § Step 4 — PREPARED: every cure is planned and logged, none armed.** Gate G4
per class: the class's stand green, the suite files no cure line on a spec path.

**Step 5 — the nets fold into the director.** Each net is retired only when the director covers its class with
evidence: the stranded check → the shadow's `unserved` (the held list is already one); the covered-prompt check → a
`covered` verdict (a surface present but painted over — its stacking reader moves into the probe); the start director
→ the table's `start` rows (its expected-owner function becomes the start's rows); the foreground watchdog and the beat
stall guard stay (they judge in-flight work, not ownership) and read the director's verdict. Gate G5 per net: its
e2e guard re-pointed, the same reds caught by the director.

**Step 6 — the director DRIVES presence** (phase 3 — the start director's own last step): the shell's routing reads
the expected owner instead of re-deriving it in each door; latches retire one at a time, each with the 4K GPU
storyboards A/B (a visible motion difference is a regression). Gate G6 per latch: the A/B storyboard identical, the
suite green, no shadow finding.

## The rules of the next phases
1. **No cure before the shadow agrees on the paths** — a class of finding is cured only once the whole suite's map
   shows it is a real defect and not a missing row.
2. **A missing row is fixed in the TABLE**, never by teaching the probe an exception.
3. **A cure goes through the owner's existing door** (the start director's `heal` / `yield` / `release` grammar); a cure
   line in a run is a latch bug to stand up as a stand.
4. **A net is retired only when the director covers its class**.
5. **A new prompt kind, a new surface of its own, a new beat** is a row in the table / `OWNER_SURFACES` /
   `BEAT_SURFACES` in the same diff — the compiler enforces the first, the e2e liveness guard the selectors' existence.

## The first map (2026-11-01 — the whole suite on the box, read with `scripts/screen-shadow-report.mjs`)
**The run.** 467 spec files in three parts (snapshots `scrsh2` / `scrsh3`, build b39f8831f6), both passes: **1461 tests,
4541 judged passes, ZERO findings.** Verdicts: agree 2932 · held 1603 · misserved 4 · unserved 2 (each a hand-off
shorter than the confirmation window — never confirmed) · out of scope: the free menu 16493, the start 3138. A second
run of the 84 files where a hold stood (`scrsh4`, 470 tests, 3211 judged passes, the `masked` stats) read what every
wait hid. 91 tests left no readout (their page closed before the harvest — the readout is taken at the fixture's
teardown).

**The holds are bounded.** The longest unbroken run of any reason is 15 passes ≈ 15 s (`animation-hold` in the bot's
city before the sitting's door, `sitting` in RX05's payout); `announce-gate` 11, `deferred` 10, `task-on-board` /
`hand-pick` / `admit:reveal` 9. No latch in the suite.

**No beat was ever the explanation** (0 passes): every transient scene in the product carries its own BLOCKING hold,
and the hold is read first. `BEAT_SURFACES` stays as a net; it is not evidence of anything today.

**Who served** (agree passes — the observed map, step 2's input): `parliamentPhase` / `party` → parliament · `space` →
board · `handSelect` → colonies (the Pluto discard hosted by the colony resolution) and hand · `cardSelect:target` /
`distribute` / `payment` / `amount` → task (payment also draft) · `cardSelect:buy` → draft, task · `cardSelect:draft` /
`draftWait` → draft · `colony` → colonies · `deckSelect` → hydro, deck-pick · `choice:deltaBonus` → hydro ·
`choice:contextual` → decision, task · `choice:wgt` → gov-support · `distribute:production` → prod-loss ·
`venusBonus` / `spendHeat` → lanes · `aresGlobal` → ares · `botAttack` → bot-attack · `projectCard:playFromHand` →
hand · `projectCard:standardProject` → standard-projects.

**What the waits HID — the table's one systemic gap: THE HOST.** Under a hold the expected owner never stood (it would
have agreed); what stood instead was, almost always, **the workspace of the flow the question is a step of**:

| shape | hidden under the hold | passes |
| --- | --- | --- |
| `externalDraw` (a law's take) | parliament | 361 |
| `space` (a law's tile) | parliament | 162 |
| `cardSelect:target` / `:distribute` (a law's pick) | parliament | 144 |
| `choice:contextual` (a triggered effect of a play) | hand | 70 |
| `choice:generic` (the final greenery's branch) | board (`task-on-board`) | 60 |
| `handSelect` (a card action's discard) | card-actions | 53 |
| `colony` (a play's colony step) | hand | 27 |
| `space` / `colony` | hydro | 5 |

The table says WHO serves a KIND; it does not know that a question asked as a STEP of a flow is served by that flow's
host (`workspaceHostForStep` — the stack's nearest live unfinished step). Today the holds mask it; a cure built on the
table as it stands would have torn down the Parliament's and the play's own stages. This is step 1's worklist.

**Rows the suite never judged** (unverified): `player`, `resource`, `colonyBonus`, `composite`. Judged but never
agreed (weak): `corpFirstAction` (4 passes), `awardFunding` (2), `choice:generic` (185 — all held), `chairmanQuest`
(4 of 25 agreed), `externalDraw` (12 of 466 — the host gap).

**The suite's reds in those runs are not the shadow's** — every one attributed on a worktree of HEAD + this change
ONLY (no byte of the neighbours' uncommitted work in the shared tree) and, where still red, on the bare HEAD: GREEN on
HEAD + this change — `green-allegiance`, `minority-representation`, `nova-city` (the composer's empty pay line: the
neighbour's payment rework in the shared build), `parliament-actions`, `parliament-skyscrapers`, `canyon-carving`,
`colony-sponsors`, `campaign-endgame`, `exclusive-colony`, `effect-chain-lock`, `play-tr-reward`, `pristar`, `x87`, and
the finale timing specs on a quiet `--exclusive` box (red only at load 6–7); RED on the bare HEAD too — `habitat-science`
(the ledger box moves 21 px), `classic-gmo-contract` C (`[reaction] foreign face`, 1/6), `social-heating` fhd (the heat
row against the server, 3/3).

## Step 1 — DONE (2026-11-01): the HOST, the rows, the readout
1. **The HOST owner** (`screenDirector.ts` `HOSTABLE` + the verdict's `basis`): a question asked as a step of a flow
   is served by that flow's host — the stack's own `workspaceHostForStep()`, counted only while the flow is IN PROGRESS
   (`consoleLeakDetector.flowHost` — a host that hosts `'always'`, the card centre, also hosts in BROWSE, and a
   mandatory prompt over a browsed list is not its step); a kind with a surface of its own (`botAttack`, the lanes,
   the thresholds, the awards' free funding, a remote colony bonus, the draft's wait, the start's) is never hosted. A
   task's nested placement is the BOARD's while the shell's mirror says so (`boardBranch` — the final greenery's
   branch). The stats tell the basis apart (`parliament@host`, `board@branch`).
2. **The re-run of the 84 held files** (`scrsh5`, 471 tests, 3189 judged passes, 0 findings): held 1428 → **625**;
   `externalDraw` 12 → 372 agree (+360 `parliament@host`), `space` +154 `parliament@host`, `cardSelect:target` /
   `:distribute` +151 `parliament@host`, `colony` +25 `hand@host` (+13 parliament / hydro), `choice:contextual` +41
   `hand@host`, `choice:generic` +54 `board@branch`. **What a wait still hides is explained, never a table row**: the
   previous flow's frame behind an ANNOUNCED mandatory discard (card-actions after a card's / a party's draw — 47
   passes, the announce is the surface), the hand under its own album pick (`hand-pick` — 30). Holds ≤ 9 s.
3. **The rows** — `colonyBonus` has its stand (`console-screen-shadow-rows`, the `miranda-remote-bonus` fixture: two
   seats, red trades Miranda over the API): judged, held by the announce with NOTHING under it, and the door that opens
   it IS the answer (the collect) — after it the colonies present the payout with no question standing. `resource`,
   `player`, `composite` are not reachable as a LIVE prompt in today's scope (`resource` only from held-back Prelude 2
   cards and Pathfinders; `player` / `composite` pre-collected by the composers) — the report's `KNOWN_UNREACHABLE`,
   each with its reason, and a warning when one is judged after all (the scope moved).
4. **The readout survives a reload / navigation / close** — the harvest wraps the page's own `reload` / `goto` / `close`
   and snapshots `__conScreenShadow()` before each (every snapshot a disjoint span; no readout lost: 11 of 471 left
   none, against 91 of 1461).

## Step 2 — DONE (2026-11-01): the table is NARROWED to what was observed, and GUARDED
1. **The rows are the evidence.** Every shape the suite met live names only the owners seen serving it BY ITS ROW:
   `payment` → task · `cardSelect:draft` → draft · `:buy` → draft, task · `:target` / `:distribute` → task ·
   `choice:wgt` → gov-support · `:contextual` → decision, task · `:generic` → task · `:deltaBonus` → hydro ·
   `amount:generic` → task · `distribute:resources` → task · `:production` → prod-loss, task · `deckSelect` →
   deck-pick · `projectCard:standardProject` → standard-projects (the generic sheet was never seen) · `resource` →
   task (seen only in the prompt-family gallery's patched prompt). The generic family (`UNOBSERVED_FAMILY`) stays ONLY
   on the shapes never asked standalone in scope, each with its reason (`UNOBSERVED_SHAPES` — `choice:confirm`,
   `composite`; see 5); an owner a row keeps without having been seen carries its reason
   (`ROW_REASONS` — the generic choice's task host, the draft's re-pick banner, Vitor's free funding, the corp's first
   action, the remote colony bonus's colonies).
2. **A frame's `serves` is its own basis** (`serves`, beside `table` · `host` · `branch`) — the Hydronetwork's deck pick,
   the colony resolution's discard, the draft's payment are runtime grants, not rows, and the evidence tells them apart.
3. **THE EVIDENCE GATE** (`tests/console/screenDirector.spec.ts`, server runner): `tests/console/screenDirectorEvidence.json`
   (written by `node scripts/screen-shadow-report.mjs <dirs…> --write-evidence <file>` from a whole-suite run) is
   checked against the table — every owner seen serving a shape by its row is IN the row, every owner in a row was
   SEEN or has a reason, every observed shape left the generic family, every unobserved shape kept it with its reason.
   Narrowing a row, or widening one, is a diff that updates the evidence or a reason with it.
4. **The verification run on the narrowed table** (box, four quarters, snapshots `scrsh7` / `scrsh8`, build ff7d5b8012):
   **1497 tests, 4938 judged passes, 0 findings** (only the live control's two deliberate defects); agree 4164 · held
   763 (≤ 13 s) · a handful of hand-off passes (unserved 6 / misserved 5) never confirmed. Coverage: every in-scope row
   judged except the two named unreachable. Reds of that run, none the shadow's: `arboretum`, `arwind-inc`,
   `martian-media-center`, `parliament-zone-v5` GREEN on a worktree of HEAD + this step only (the neighbours'
   uncommitted work was in the shared build); `habitat-science`, `social-heating` red on the bare HEAD; the finale's
   timing specs only beside other runs.

5. **…and the shapes a composer pre-collects are met LIVE too** (the owner: «а почему бы на них не написать e2e?» —
   2026-11-01). Three of the five «unobserved» shapes are asked STANDALONE by the server whenever the answer did not
   ride a batch — a divergence, a reconnect — so `console-screen-shadow-rows` makes the move over the API and reloads
   the console onto the live prompt: `player` (Law Suit, fixture `law-suit-live`) → task · `choice:espionage`
   (Modular Floodgates' blockade, `floodgates-blockade-then-action`) → the Hydronetwork by its `serves` ·
   `amount:delta` (the Hydronetwork advance, `hydro-terminal`) → task — each judged and served, nothing filed; the rows
   are narrowed to it. The two left are PROVABLY never standalone in scope, and say why: `composite` (every AndOptions
   is nested in the action menu — the party actions' `partyActionPrompt`, the colony trade — or routes to its own kind)
   and `choice:confirm` (a bare SelectOption is an option of an OrOptions; the one deferred alone, the remote colony
   bonus's collect, routes to `colonyBonus`). The report's coverage now reads «unverified rows: none».

**Gate G2 is green.** Step 3 (the field agrees) needs the owner's games on a build ≥ this one — the flight recorder
already ships every `[screen-shadow]` line from the box and the Deck; `scripts/field-log-report.mjs` reads them.

## Step 4 — PREPARED (2026-11-02): the cure is PLANNED on every finding, EXECUTED only when its verb is armed
The owner: «начинаем подготовку шага 4». Gate G3 (the field) is still open, so nothing on screen changes yet. Everything
a cure needs is in place and proven, and the arming is one switch per class.
1. **The plan** (`screenDirector.ts` `planScreenCure`, pure). A confirmed finding is answered through the owner's
   EXISTING door, never a new one:
   - `open` — `unserved`, and the question's kind has the router's own door (`SHELL_SECTION_KINDS` →
     `openShellTaskSurface`);
   - `restore` — `unserved`, and the parked chain serves the question (`restoreDeferredTask`);
   - `yield` — `misserved`. A foreign workspace goes to the board home. It is never parked: a parked foreign chain is
     exactly what the restore card would bring back. The generic sheet closes with the layers. Then the router's door
     opens, if the kind has one;
   - `none` — no honest door, and the reason is named:
     - `no-door:<owners>` — the class's worklist;
     - `no-leave:<surface>` — a foreign surface with no leave verb;
     - `start-director` — the opening's frame;
     - `deferred`.

   The plan is filed on the finding (`cure: plan:<verb>:<door>` / `cure:<…>`).
2. **The dry run is the default.** The detector logs `[screen-shadow] cure-plan «…» by shadow (dry run — not armed)` —
   once per finding and caller — and the screen is untouched. A verb EXECUTES only when armed:
   - `screenCureArming` is empty unless the URL says `?screenCure=open,restore,yield` / `all`;
   - the owner's go turns a verb on in the code, ONE class at a time.

   An executed cure logs `[screen-shadow] cure «…» by <shadow|liveness>: <what the door did>` and clears the standing
   finding.
3. **Two callers.**
   - The shadow's confirmation (the third pass, the same pass that files the finding).
   - The liveness rung `screen-director`, rank 17: after the start director's 15, before the flows' 20. On a stalled
     screen with a confirmed finding still STANDING (`screenShadowStanding` — cleared the moment the streak breaks), the
     rung runs the same plan. In a dry run it does nothing and returns `''`, so the ladder goes on.
4. **The proof.**
   - Unit, the whole path (`screenShadow.spec` § the cure): a dry run calls no door and leaves the finding standing for
     the rung; an armed verb calls its door once and writes `cure:`; a verb armed is not another verb armed; a healed
     screen clears the standing finding; a set-aside question is never planned.
   - Pure (`screenDirector.spec` § planScreenCure): every class and every `none`.
   - Live, on the box (`console-screen-director-cure`, seam `?screenControl=1` → `window.__conScreenControl` — a latch
     bug put in on purpose):
     - **the routing heals by itself** a dropped stack and a foreign milestones / hand screen over a live colony pick:
       the shadow keeps agreeing and files nothing. Those defects are not the director's;
     - **the card centre stood up over the pick strands it.** `enterWorkspace` unwinds the colonies, the centre's own
       rule lets it go, the stack ends EMPTY, and nothing re-opens the question — no plate, `unserved` at the third pass.
       Dry run: planned `open:openShellTaskSurface`, the colonies stay gone. Armed: cured in the same pass, the
       colonies stand again, and the shadow agrees.
   - `yield` has no live seam today: every foreign screen tried was healed by the routing. Its plan is guarded by the
     unit controls.
5. **The report reads the cures** (`scripts/screen-shadow-report.mjs` § CURES):
   - `planned (dry run)` vs `APPLIED`, per door;
   - the positive controls are marked `[deliberate]` (`console-screen-shadow-control`, `console-screen-director-cure`);
   - an APPLIED cure off a control is a latch bug to stand up.

   The live control's defects read as plans: the fake sheet over the draft → `yield:closeConsoleLayers`; the draft
   hidden → `none:no-door:draft`. The draft has no router door; its door is the flow beat. That is the first worklist
   entry of the `open` class.

**The worklist the preparation found** (for the classes, in order):
- **(a)** the card centre's stand-up over a live mandatory pick strands the pick (the seam above). Whether a PLAYER can
  reach it (the wheel during a live colony question) is to be stood up through the real UI before `open` is armed.
- **(b)** a draft pick has no router door (`no-door:draft`).
- **(c)** `yield` needs a live seam that the routing does not heal by itself.

**Gate G4 per class**, unchanged: the class's stand green, a whole-suite run filing no APPLIED cure off a control, the
field (G3) agreeing.

## Step 4 — the FIRST CLASS ARMED (2026-11-02): the BLIND ANNOUNCE
The owner's field lock of 2026-11-02 (game-pdb745eb, «при розыгрыше «Обсерватории Лагранжа» после забора карты
workspace завис и его даже нельзя закрыть», and: «механизм нужен в продакшене как можно скорее»).

**The chain.**
1. Lagrange Observatory was blue's SECOND action. The turn passed while its drawn card was still landing in the hand.
2. The bot placed an ocean, and blue's Neptunian Power Consultants asked «pay 5 M€?» off-turn.
3. The play's optimistic `effect` claim was still alive — its draw kept it — and adopted that FOREIGN decision as its
   stage «ЭФФЕКТ».
4. Asked off-turn, the decision was ANNOUNCED. The plate stands only on the board home, and the chip's beacon was
   suppressed: `promptServedWhereIStand` counted ANY presenting claim as «the question is here», even a claim presenting
   its own draw while the question belonged to nobody in it.

The question was held behind a door nobody could see: `hand:committed` + `announce-gate` for minutes. The shadow judged
it `agree hand@host`, and the liveness arbiter `accepting`.

**Three fixes.** The owner set the direction (2026-11-02): «зачем принудительно показывать промт поверх workspace с
добором карты? Достаточно резолвить на уровне чипов: игрок увидит, что его чип мигает — значит от него ожидается
решение». The question opens when the player chooses, never over the screen they are reading — focus control and
anti-spam are the console's own rules.
- **The root** (`consoleWorkspaceOutcome.closeWorkspaceOutcomeChain`). A press's chain ends at either structural end:
  the server asks the viewer NOTHING (the turn left them), or asks them in the action phase while ANOTHER seat is
  active (`viewerAskedOffTurn` — narrower than the strip's «forcedaction», which also covers the political and solar
  phases where a law's live play legitimately hosts its own effect). From there a claim keeps its ARTIFACTS (`draw`,
  `deck-check`) and admits no QUESTION (`pick` · `effect` · `venus-bonus`). The effect ownership and the late adoption
  (`adoptPlayEffectDecision`) refuse an off-turn decision outright. Stand: `console-foreign-decision-play-claim`
  (fixture `npc-remote-ocean-draw` — red's ocean over the API the moment blue's turn passes). Red before (the field's
  empty hand, reproduced); green after: the question is ANNOUNCED where the player stands (the beacon over the hand,
  never opened over it) and answered by the player's own road.
- **The beacon** (`ConsoleShell.promptOwnedByClaim`). A claim is «here» only for a prompt it OWNS (its task, its effect
  decision, its Venus bonus, its deck pick). A foreign question raised while the claim presents its own cards lights
  the chip's beacon — the existing reminder — and the player answers once the screen they stand in is done.
- **The net — the BLIND hold** (`ScreenShadowInput.blind`). The announce gate holds a decision it has already
  PRESENTED (`ScreenShadowContext.announce: 'presented'`), and neither its plate (`.con-mandatory`) nor the chip's
  beacon (`.con-status__beacon`) paints. That hold explains nothing to the player, so it is never `held` and never a
  host's step: it is a finding with `blind: 'announce-gate'`. A row owner painting still agrees; the blind check comes
  after `byRow` / `byServes`. The cure is the new verb **`announce`** → the chip's BEACON lit
  (`consoleMandatoryGate.forceMandatoryBeacon` — a latch as durable as its beat). It never presses the plate's A: it
  opens nothing and answers nothing, it makes the announcement VISIBLE. (A first cut pressed A for the player; the
  owner rejected it the same day — a question forced open over the draw the player is taking breaks focus control.)

  **ARMED BY DEFAULT** (`SCREEN_CURE_DEFAULT_ARMED = ['announce']`). A URL's `screenCure=` names its own set (`none` =
  nothing). `open` / `restore` / `yield` stay planned only.

  Proof:
  - `screenShadow.spec` § the cure — BLIND ANNOUNCE lights the beacon; a painted plate and a pending (not yet
    presented) beat are held;
  - `consoleMandatoryGate.spec` — the director's beacon opens nothing (the beat stays held) and dies with its beat;
  - `screenDirector.spec` — the plan, the verdict, the default arming.

## The HIDDEN-SCENE class — planned (2026-11-05, a colleague's post-mortem of 2454d07888)
**The incident.** The Hydronetwork's stage-7 copied MOVE set the frame ASIDE for the board. The placement's answer
dropped the flow's last busy term while the frame was still aside, so the result played behind the board, unseen. The
frame came back still `executing`; only the beat stall guard and the liveness arbiter (rung `workspace-beat`) took it
down. 8655a62f80 (PL-1799) made the race deterministic. The same week had the same family twice more:
- 8e3cf370f2 — the colony step's pause read `alive()` off the live stack, B parked it, the pause zeroed silently, and
  «Вернуться к решению» restored a colony grid the server no longer asked;
- 8e3cf370f2 — `goBoardHome()` inside the Hydronetwork from an early colony-completion timer.

**The class.** «Is my scene on screen?» had three hand-written answers (the park, the deferred task) and missed the
third way off screen (the yield for the board). Measured on 2026-11-05:
- every frame WRITER of `consoleWorkspaceStack.ts` (`setWorkspaceFramePhase` / `Stage` / `Subject` / `SourceCard` /
  `Serves` / `Slot`) addresses `workspaceFrameIndex` — the LIVE stack only. A write to a parked or yielded frame is
  dropped silently, so the frame returns with a stale phase;
- the hidden-scene checks are spread over the client: `workspaceStackCollapsed()` 13× alone, 3× with `task.deferred`,
  and `stackYieldedToBoard()` 17×;
- a frame comes back through four doors: `restoreWorkspaceStack`, `resumeStackFromBoard` ×5,
  `restoreParkedWorkspace` ×10 and `restoreDeferredTask` ×6. Nothing makes «re-ask on return» a property of the
  return;
- `boardYielded` is a PLAIN array — a predicate over it read by a cached computed is a LATCH (invariant 17).

**The plan** — structural; each step has a stand red before.
1. **A frame write lands wherever the frame lives** (stack · park · aside). One lookup over the three homes, and every
   setter goes through it. «A phase written while away is lost» becomes inexpressible, not re-read after the fact.
2. **ONE predicate: `workspaceFrameOffStage(kind)`** — parked (THIS kind in the park, not the global collapse) ·
   deferred · aside · any future way. It lives in the stack module, the stack's own question. Every flow asks it
   (`hydroFlowSetAside` becomes a call to it). `boardYielded` becomes reactive (or carries a reactive epoch) and the
   predicate is declared through `reactivePredicate`. A new way off screen is ONE row there, and a guard keeps
   flow modules off the raw parts.
3. **The return is ONE edge: `workspaceFrameReturned(kind)`** (an epoch bumped by every door that splices a frame back
   in). Every flow with a completion subscribes once, then re-reads its phase and re-asks its own conclusion. The four
   doors cannot forget it, because they no longer own it.
4. **No conclusion on a hidden scene, by construction.** The stack refuses a terminal phase (`completing`, a result
   stage) for a frame that is off stage and records it as OWED: it is applied on the return edge, with the flow's own
   conclusion re-asked. An absorbing beat with nothing behind it then cannot be entered off screen, instead of being
   torn down later by the beat stall guard and the arbiter.
5. **The director judges it.** A new verdict input — a flow frame off stage while its flow wrote a phase or asked a
   conclusion — logged `[screen-shadow]`, positive control in `screenShadow.spec`. The three incidents of the week are
   the class's stands: `console-hydro-copied-tile`, `console-colony-entry-probe` A, `console-pristar` A,
   `console-hydro-copied-colony`.

The nets (`workspaceBeatStall`, `consoleLiveness`) stay as they are: they are the proof the class is closed when they
stop firing on these paths.

**Steps 1–3 DONE (2026-11-05, ledger GY).**
- **The writes** (`consoleWorkspaceStack.frameAnywhere`). Phase, stage, subject, source card and serves land on the
  frame in the live stack, the park or aside. The slot stays live-only, because a frame off the stack has no DOM and
  every door clears it.
- **The one answer.** `workspaceFrameOffStage` / `workspaceSceneHidden` / `workspaceSceneOnStage` are declared through
  `reactivePredicate('workspace-off-stage')`. `boardYielded` is reactive; the router hands over the deferred flag.
  `hydroFlowSetAside` is a call to `workspaceSceneHidden('hydro')`, and the hydro claim's «parked follow-up» arm in
  `reconcileWorkspaceOutcome` asks it too, so it now also holds while aside for the board.
- **The edge.** The shell's `hydroFrameStands` is `workspaceSceneOnStage('hydro')`. Its rising edge now also fires
  when a deferral is lifted with no park, not only on the frame's splice back.
- **Guard** `hiddenSceneGuard.spec`.
- **Positive controls** (`consoleWorkspaceStack.spec` § a frame off stage): a write while aside and while parked
  survives the return; a live instance wins over the parked one; the slot is not written to an absent frame; one
  answer for every way out; a cached `computed` flips at every edge — the return is reactive, no latch.

**Step 4 DONE (2026-11-05, the same diff — the owner: «сразу сделаем шаг 4, чтобы не гонять полный e2e дважды»).**
A flow does not FINISH on a hidden scene, and the stack refuses it through the ONE guarded conclusion, never a new path.
- `workspaceConclusionFor` gains the hold `off-stage` (after `parked` — the player's park keeps its own reason): a frame
  aside for the board does not conclude. The ending is OWED (`concludeWorkspaceFlowOrOwe`).
- The frame's return is an ingredient of `owedConclusionSignal` (reactive since step 2), so the owed ending is re-asked
  on the very edge the frame comes back on.
- Three places counted a frame aside as GONE and are fixed: `concludeWorkspaceFlow`'s idempotence check answered
  «already gone, done» and closed nothing; `owedConclusionSignal` read `gone`; `retryOwedConclusion` dropped the debt.
  A frame aside is never a ghost either (`stuckWorkspaceIsGhost`), so the force teardown never fires on a flow that is
  waiting for the board.
- Proof: the policy spec (`consoleWorkspaceFlow.spec` § off stage) and the whole e2e suite (see the commit).

**Step 5 — reassessed, not built.** After steps 1–4 both signals it was meant to judge are closed by construction: a
write to an absent frame lands, and an ending on a hidden scene is owed and re-asked on the return. The one residual
failure is a stack that NEVER comes back from the board. It already has its nets: the beat stall guard for a transient
beat, and the liveness arbiter's ladder for a stalled screen. A director verdict would only restate them. It is built
the day a field log shows a frame that never returned and that neither net named.
