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
a liveness rung (rank between the start director's 15 and the flows' 20) so the arbiter's ladder reaches it. Gate G4
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

## Step 1 — the worklist the map wrote
1. **The HOST owner.** `expectedScreenOwners(task)` ∪ the registry ∪ the frames' `serves` ∪ **the host of the flow the
   question is a step of** — read off the stack (`workspaceHostForStep()`, the same «nearest live unfinished step» law
   the routing uses), never a list per kind; plus the board for a task's nested placement (`task-on-board` already names
   it). Re-run the 84 held files: the table above must turn into `agree`, and what stays `held` must be a genuine wait
   with nothing under it.
2. **The four unverified rows** get a stand each (`player`, `resource`, `colonyBonus`, `composite`), and the weak ones
   an agree in the suite (`corpFirstAction` past the opening, `awardFunding`, `chairmanQuest`).
3. **The readout survives a closed page** (91 tests): the harvest reads `__conScreenShadow()` on the page's `close`
   too.
4. Only then step 2 (tightening `TASK_FAMILY` against «who served»).
