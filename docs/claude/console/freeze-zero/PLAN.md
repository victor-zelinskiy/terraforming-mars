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
| A7 | SEE · proven on the box: the control stall and the control stop of an installed release (`TM_DIAG_PROBE=stall`) | open — needs a release that carries A1–A6 (the next push), then § 9.2 of `docs/claude/diagnostics.md` with `TM_DIAG_PROBE=stall` |
| B0 | FIND · the monkey's BASELINE on the box (before any fix), reported by class | **shards 1–6 of 8 are in (456 walks, 27 360 presses): 3 defect classes, 0 episodes, 0 never cured** (`.e2e-remote/fzbase-all/monkey-report.json` — the «against» of every later pass; the three classes are rows of §4, all fixed with their replays). Shards 7–8 are OWED (shard 7 was cut mid-run on 2026-11-14 when the owner's rule arrived: **no e2e on the box while Enshrouded runs there** — check `ssh steam-machine 'pgrep -afi enshrouded | grep -v pgrep'` before every box run; then the laptop (`TM_E2E_LAPTOP_OVERRIDE=1`) or the owner's CI after the push, and for the monkey — the bottle's). To run them when the box is free — `nohup node C:/Projects/Mods/tm-fz-tools/monkey-lanes.mjs C:/Projects/Mods/tm-fz fzbase1 fzbase-all 0 1 8 TM_E2E_MONKEY=1 TM_E2E_MONKEY_SEED=fz0 TM_E2E_MONKEY_PRESSES=60 TM_E2E_COVERAGE=0 &`). The baseline build is the snapshot `.e2e-fzbase1` (before any fix): the NEXT pass is the same seed on the current build — it must show zero of these three. ⚠ stopping a lane DRIVER kills its wrapper and orphans the run on the box (`pkill -f "tm-e2e/builds/<task>/"` there). The first launch — seed `fz0`, 60 presses, 8 shards in two detached lanes (`C:\Projects\Mods\tm-fz-tools\monkey-lanes.mjs`: a pass is longer than any tool's timeout; it logs to `.e2e-remote/fzbase-all/lane-<n>.log` and accumulates `shard-<s>/`); summed with `node scripts/monkey-report.mjs .e2e-remote/fzbase-all --out <report.json>` — the JSON is the «against» of every later pass |
| B1 | FIND · the kernel's state space as a number: coverage of machines / kinds / `WAITS_ON` / blocks / frame phases | **the instrument: done 2026-11-14** — `kernel/flowCoverage.ts` (the trace as keys), `console/flowCoverageProbe.ts` (`__conCoverage()`: the keys + what the machines can do + every frame), `scripts/flow-universe.mjs` (280 declared flows), the harness files it per test, `monkey-report` prints «N % walked» and what was never reached. **The first measured numbers** (5 walks × 60 presses, 2026-11-14): 47 of 280 declared flows opened (16.8 % — chain 3 / 3 · scene 16 / 115 · step 1 / 48 · story 0 / 9 · surface 27 / 105), 7 of 13 workspace frames, machine moves: `submit` 2 / 8 · `frame` 5 / 52 · `claim` 3 / 242 · `announce` 2 / 6 — the walk is SHALLOW, and that is the number B2 exists to raise. *Open:* admission blocks and `WAITS_ON` pairs as keys; the whole-suite pass |
| B2 | FIND · the monkey as an instrument: coverage-guided corpus, timing perturbation, the class report, finding → spec | **THE MONKEY IN THE BOTTLE: done 2026-11-14** — `tests/client/bottle/monkey.bottle.ts` (`TM_BOTTLE_MONKEY=1`, opt-in): the box monkey's walk — the same fixtures, the same seed → the same keys and pauses (one generator, number for number), the other seats moving at the same presses — in the bottle: ~8 s a table, all 606 in ~40 min on the laptop in two shards, NO BOX, deterministic. It files `cause-classes/*.json` in the box monkey's own format, so `scripts/monkey-report.mjs .e2e-remote/bottle-monkey --against <the box's report>` sums and compares it. A class only the bottle names is a CANDIDATE (it has no layout): confirmed on the box with the same seed, or added to `LAYOUT_BLIND`. **THE FIRST FULL PASS (2026-11-14, seed `fz0`, 606 walks, 36 360 presses, 33 min):** the three baseline classes gone; 16 candidate classes, triaged: `ma-price:price-end` (116 tables), `played-hero:reward-place`, `admission:host:card-arrival` are waits for a measured end → `LAYOUT_BLIND`; six tables whose candidates were NOT geometric by name (a start strand, three arbiter stalls with their watchdog expirations, a gate's overdue presentation, a starved feed) were walked by the box monkey's spec in a REAL browser on the laptop — five are clean there (the bottle's holds behind unmeasurable flights), **one class is real** (§4: the scale-step rating's story). The lesson is a row of the blind list's own header: a class is called blind only after a real browser said «not there». **THE RELOAD** (`TM_BOTTLE_MONKEY_RELOAD=<n>`: the page reloaded on average once in n presses, its own seeded stream — the restore road walked on every table) and **THE GUIDED MODE** (`TM_BOTTLE_MONKEY_MODE=guided`: most presses are verbs the command bar offers, `bottle.offered()`) joined on 2026-11-14 evening, and the bottle's walks carry COVERAGE (`coverage=1` → the same `coverage` field the box's harvest files). **Measured on 65 tables × 60 presses: plain 107 / 280 flows (38.2 %), guided 104 / 280 (37.1 %) — guidance does NOT deepen a walk in the bottle.** What bounds the depth there is the layout: a card's flight never lands, the admission block behind it runs to its bound, and the flow's next step comes a ceiling later — a walk spends its presses in front of holds. **A SYNTHETIC LAYOUT was tried the same evening** (`TM_BOTTLE_MONKEY_LAYOUT=synthetic` / `BottleOptions.layout`: every displayed element gets a non-empty, deterministic, scattered rect — `bottleDom.ts`): on the same 65 tables **106 / 280 (37.9 %) — no gain either**, the flights' blind classes went (`played-hero:target`, the arrivals' block) and the layout's OWN artifacts came (`scene-transition/hold-bound/board-fit` on 64 tables — a fit that never settles on scattered rects; a start strand). It stays an opt-in instrument, OFF by default. **The measured conclusion:** in the bottle neither the picker nor the layout bounds the depth of a 60-press walk — the walk does; what grows the walked space is MORE WALKS (seeds × tables — 33 min a pass, free) and their UNION (the reload pass and the first pass are two different unions), and the classes come from there. **THE RELOAD PASS (606 walks, 2 421 reloads at random presses): 0 new classes, 2 walks ended unserved — both the bottle's own blind incidents — and no harness error:** on every table the page that comes back serves the question it left; the corpus (keep the walks that reach new coverage, mutate them), the perturbed box passes, `TM_E2E_MONKEY_REBUILD` |
| B3 | FIND · THE CONSOLE IN A BOTTLE: the real shell + the real server in one process on a manual clock (the base of B4 / B5) | **the spike: done 2026-11-14 — it is buildable, and it runs** (`tests/client/bottle/`, `npm run test:bottle`, 12 tests, ~1 min): the REAL `App.vue` → `ConsoleShell` (nothing stubbed) against the REAL server's router in one process, on ONE clock (the kernel, GSAP, `Date`, the frames, the server's timers); a seeded walk replays identically; a fast-check search over {press, clock, another seat, reload} finds a planted defect and shrinks it to 3 commands. *Measured limits:* tens of presses per second, not thousands (96 % of the wall is jsdom's selector engine); no layout (a rect, a paint, a CSS end) — that stays the box monkey's. *It already paid:* two product defects found and fixed (a Vue error of a Vapor component was LOST — the handler threw; the reactivity witness went blind after the first game screen of a page). *Open (§3.4):* the sweep of all 606 fixtures, server fidelity (undo, a socket stand-in, held answers), speed |
| B4 | FIND · deterministic replay of an episode (record in the field / box / monkey → replay with no box) | **four replays stand (2026-11-14), and a monkey's finding replays BY ITS SEED** (`tests/client/bottle/monkeyWalk.ts` — the box monkey's stream as a function: `monkeyWalk(bottle, seats, 'fz0:<fixture>', presses)`) — `tests/client/bottle/classReplays.bottle.ts`: each cause class of §4, stood up in the bottle by the presses that produced it (fixture + the other seat's move + the walk's presses on the manual clock) and held to the property its fix established; 13 s for both, red with the fix switched off under EXACTLY the class key the monkey filed. *Open:* the record as a FILE the monkey / the hub writes (`{fixture or save, seed, timed presses, other-seat answers, reloads}` → `replay(file)`), so a field event replays without hand-writing its test |
| B5 | FIND · the COMPOSITION checked for liveness (model-based over the bottle) | open |
| C6a | ELIMINATE · THE GUARD of the rebuild's completeness: module state is reached by the session's end, or says why not | **done 2026-11-14** — `tests/console/moduleStateGuard.spec.ts` + `moduleStateBaseline.json` (a per-file ratchet): of 1 248 top-level mutable declarations under `src/client`, 647 are written by the teardown, 8 kernel-owned, 39 declared page-lifetime, **554 UNDECLARED — the worklist of the in-page rebuild** (`MODULE_STATE_REPORT=1` prints it by directory) |
| C6b | ELIMINATE · THE LAST LINE at depth `page`: past the ladder's last rung the console session is rebuilt from the server's view — once per question, a few per window | **done 2026-11-14** — `console/session/{sessionRebuild,rebuildBound}.ts`, the arbiter's `LIVENESS_REBUILD_AFTER_MS`; the episode is filed `rebuilt`; `../liveness-arbiter.md` § 3a. Proven on the box (`console-stall-cause`: rebuilt once → served again → the second strand refused; `?rebuild=0` → the player's own reload). **A DEAF screen is covered too** (`presses-no-effect`: due only on the player's next dead press past the spent ladder — `lastLineStep`). *Open:* depth `shell` (needs C6a at zero); the monkey rebuilding at arbitrary presses; the rungs it retires |
| C6c | ELIMINATE · WHO WATCHES THE WATCHER: the last line no longer depends on the thing that may be dead | **done 2026-11-14** — `console/session/supervisorPulse.ts`: a witness OUTSIDE the shell (the app's root, the page's scope) counts the supervisor's COMPLETED passes; a game screen in plain view with none in three looks (15 s) — no shell at all, or a pass that throws — is rebuilt by the same last line under its own cause (`session-rebuild/page/no-shell` · `…/no-pass`, by `pulse`). Counted in looks, never milliseconds. This IS the verdict half of the delivery contract (decision F11: the judge stands in the page, outside the judged). `../liveness-arbiter.md` § 3b; the bottle's test 13 and `console-stall-cause` «who watches the watcher» |
| C · classes | ELIMINATE · class by class (§4 is the worklist) | **four closed 2026-11-14**, each with its law, its guard and its replay / e2e: the Parliament opened beside a held sitting plate · the start shadow's «first action ≠ game» for a minimized first action · the chairmanship wedged by a second A inside its round trip (20 s on «Выполняется») · the screen shadow's `misserved` under a claim's hold. The monkey's baseline holds no other defect class. **PROVEN ON THE BOX BY THE NUMBER (2026-11-14):** the same seed `fz0` on the fixed build over the three tables that named the classes (and two controls) — `records 0 · defects 0 · episodes 0`, against the baseline: **0 NEW · 3 gone · 0 kept** |
| C* | ELIMINATE · the decision layer whole on the kernel (§4, structural 1–5), prompt delivery as a contract (7), native stalls under budgets (8), the last line at depth `shell` (6) | open |
| D | PROVE · the bar as numbers, the release gate | open |

**NEXT, in this order** (each is a milestone: verify → commit → push → main clone → the neighbour told):
0. ⛔ **Before any box run: is Enshrouded running there?** (the owner, 2026-11-14 — the rule is in the project memory `e2e-only-on-steam-machine`). If it is: no box; the monkey in the bottle on the laptop, pointwise e2e on the laptop with `TM_E2E_LAPTOP_OVERRIDE=1`, the big sets by the owner's CI after the push.
1. **The proof pass** — the same seed (`fz0`) on the CURRENT build over all tables (8 shards, `TM_E2E_COVERAGE=1`), summed `--against .e2e-remote/fzbase-all/monkey-report.json --gate`: the three baseline classes gone, no new class. Then the perturbed passes (`TM_E2E_CPU_THROTTLE=4`, `TM_E2E_MONKEY_NET_MS=400`, `TM_E2E_MONKEY_DUO=1`, `TM_E2E_MONKEY_RELOAD=1`) — every class they name is a row of §4.
2. **B2** — the corpus: `monkey-report --corpus` keeps the walks that reached new coverage keys, the monkey replays a kept walk's prefix (its own seeded stream) and diverges; `TM_E2E_MONKEY_REBUILD` (the last line at arbitrary presses).
3. **B4 as a file** — the monkey writes `{fixture, seed, timed presses, other-seat moves}` beside its walk; `replay(file)` in the bottle — a class replays without hand-writing its test. **B5** — the fast-check search of test 8a over every fixture that boots in the bottle (the sweep of 606), the property being `liveness().ok`.
4. **A7** — the release that carries all of this on the box: `TM_DIAG_PROBE=stall` (diagnostics.md § 9.2), read with `npm run diag`.
5. **C · 7** — the delivery contract (§4 item 7): **CLOSED 2026-11-14 by decision F11.** *The IDENTITY half* stands since 2026-11-08 (`ApiWaitingFor`: the poll advertises the prompt the page DISPLAYS — `promptId` = `waitingForSerial` — and a different serial, or none where one was advertised, is `changed` whatever the game age says). *The VERDICT half* is judged IN THE PAGE: the arbiter reads the screen's verdict once a second and owns the last line; the one case it could not see — a page whose supervisor is not running — is the pulse's witness (row C6c). No server-side judge: it cannot answer a page that does not ask, and learns nothing a running page does not know. *Left, optional:* the few-dozen-line formal model of «asked · named · served or rebuilt» (§4 item 7's last bullet) — only if a field event ever shows a question neither judge saw.
6. **C6 depth `shell`** — burn the module-state ratchet down (`MODULE_STATE_REPORT=1`: `console/played` 22, `components/board` 19, `console/tilePlacement` 18, `console/parliament` 15, … — the transport, the wait graph, the hold registry and the router first).
7. **R16** — *the instrument stands:* `tests/e2e/console-key-trace-probe.spec.ts` (`KEY_TRACE=1`, the laptop: a table walked by a recorded monkey walk under a Chromium trace; for every key event the FORCED layouts are summed by the frames that forced them, mapped to the sources). The baseline's count: **40 long frames (0.56 – 0.94 s) in 36 of 456 walks, 34 of them a key listener** (`onkeyup` 17 · `onkeydown` 17 — after Enter, ▼, B, Y, Q alike), forced layout 60 – 80 % of each. Next: run the probe on the tables that named them, close what it names by a law (a handler reads no layout it has just dirtied), then a budget as a guard. The long frames the baseline recorded: `[long-frame] 827 ms … forced layout 518 ms … event-listener onkeyup` and `522 ms … forced layout 360 ms … onkeydown` (a press waited in both) — the key bridge's handler measuring layout; the cost table (the TIMING set, the bundles before / after — a pre-A build is needed for the «before»).

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
| `wait-graph/ceiling/scale-step-rating:stage` · `wait-graph/ceiling/card-reaction:rating-story-quiet` (one incident) | the monkey in the bottle (seed `fz0` · `terraforming-deal-start-nodraw`), **confirmed in a real browser** (the box monkey's spec on the laptop, the same seed: both lines, plus `story:owed:scale-step-rating` expired): the rating a scale step owes waits 32 s for «the stage of the scale step rating» that never comes, and the card reaction behind it 12 s for «the touchdown of the scale rating» — both end on their ceilings | **read (2026-11-14):** a prelude played INSIDE the start workspace steps a scale; the step's rating is told on the board, which the player keeps covered by the start workspace while they read — the story is owed, bounded by its due (32 s), and at the due the rating is applied untold: the board's own bounded, ledgered story (invariant 16), and the ledger's line already said `planned` (`"watchable":false`). The wait graph's two lines of the SAME incident were filed as DEFECTS — an event of the quota for the player's own reading time. **The law:** a ceiling says WHY it was the wait's honest end at the moment it comes — `CeilingWait.ceiling(planned?)`, the reason read from the rating's own beat (`scaleStepRatingStageCovered`); with the board in plain view the same ceiling is still a defect. · guard: `ceilingWait.spec` (the line and its tier, both ways) · replay: `classReplays.bottle.ts` by the monkey's own seed (`monkeyWalk.ts`), red with the fix off (`['defect', 'defect']`). *Left open, smaller:* the rating REACTOR's own ceiling (12 s) is shorter than the story's due (32 s) — past it the card pays BEFORE the rating it answers has landed; it should wait with the story (one due) | **fixed 2026-11-14** (the classification); the reactor's order — open |
| `wait-graph/dead-end/question:…` on a question an outcome claim holds | the neighbour session's CI trace (`console-venus-orbital-survey` «the purchase is EMBEDDED»): the purchase the card centre's claim keeps for its stage had no holder in the graph → `dead-end` → the armed door `question-open` reopened it under the live claim and the frame was taken down | **the law:** a question a claim holds waits on the claim's node (`shellWaitNodes`: `claimHoldsQuestion`; `reopenOrphanQuestion` never opens the router's door for it) · guard: `tests/console/waitGraphClaimHold.spec.ts` · `../wait-graph.md` § 2c | **fixed 2026-11-14 by the neighbour session — `4dec517a9c`** |
| — | | | (filled as B0 / the field name them) |

Structural work, in the order the data will set:
1. **S5-rest** — owed steps as `step` children of the frame; the ghost test, the forced teardown and the stale
   free-turn reaper retire.
2. **Admission and ownership as ONE total function** — «who serves the question» has nothing to «not find»; the screen
   and start director shadows, the stranded check, `deferred-restore` retire.
3. **The pad ladder and the command bar as ONE table.**
4. **Reactions as machines / scoped runs, per domain**; the start scene and the Parliament taken apart like the shell.
5. **A wait on a reactive condition is visible to the cycle check** (or cannot form one).
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
| F7 | **B3 — the console in a bottle — is the base of both the replay (R10) and the composition check (R11)** | a TLA+ / Quint model of the protocol kept in sync by a guard; replay only as an e2e re-drive on the box | A hand-written model proves the MODEL; the freezes live in 100k lines of real decision code that no model keeps up with. The real shell on a manual clock against the real server is the system itself, searchable at unit speed and shrinkable. A formal model stays an option for the one protocol small enough to state (the question's delivery, C·7) |

## 7. Specs to look at first in the CI run (running list)

| Milestone | What moved | Specs |
| --- | --- | --- |
| A1 – A6 | the arbiter's line gains `task:` · `top:` · `holder:` after `asked:` (its fixed words and its three readers unchanged) and reads its claim / holds BEFORE the rung runs (was: after); a ceiling wait that declares `planned` ends its line with `(planned: …)`; every other line is unchanged. The supervisor takes an evidence snapshot when a defect's line is printed (once per record — the flow tree, the wait table, the trace). The harness files `cause-classes/*.json` per test (data), the monkey notes its presses there; `livenessGuard` lets a spec that DECLARES the stall as its subject pass (`EXPECTS_LIVENESS_STALL`). The developer's notice no longer rises for a `planned` / `info` line | anything that reads the liveness line: the e2e `livenessGuard`, `console-wait-graph-*`, `console-screen-*-control`, the console export's STALLS digest; `console-diagnostics` (the notice, the journal's rows); the new control `console-stall-cause`; `console-monkey` (its `monkey-walk` file is unchanged, a `cause-classes` file is new). Pointwise on the box before the push: `aaa-driver-canary`, `smoke`, `console-wait-graph-control`, `-dead-end`, `console-screen-shadow-control`, `console-screen-director-cure`, `console-diagnostics`, `console-liveness-noop-presses` — 17 / 17; the final build of A: 11 / 12, the red being `console-wait-graph-dead-end` :19 on the ARBITER's line — the control's own race on a loaded box (its `settle` was swallowed, the hand's opening hold was still live when the frame was stripped, so the graph saw no dead end and the arbiter's 4 s stranded grace came first); 9 / 9 on three repeats; the precondition is asserted since C6b |
| C6a – C6b · B3 | **PAST THE LADDER'S LAST RUNG THE PAGE REPLACES ITSELF** (an `unserved` stall with nothing left to release, 4 s later): a spec that stands on a spent ladder for longer now sees a navigation — it says `&rebuild=0` in its URL (then the line `[session-rebuild] refused (off)` is printed once) or expects the rebuild. `livenessGuard` is red on any `[session-rebuild]` line too; `productReloadGuard` names the rebuild's navigation. **A Vue error of a Vapor component is PRINTED again** (`[vue-error] <chain> · <phase>: …` — since `createVaporApp` the handler threw on the instance and the line never came): `vueErrorGuard` may now turn red where an error was silently lost before — each such red is a real product error that was invisible. The reactivity witness's watchers moved to a detached scope (no behaviour on a page that mounts the shell once) | `console-stall-cause` (rewritten: rebuilt once → served again → the second strand refused; and `?rebuild=0` → the player's own reload ends the episode as `reload`), `console-wait-graph-dead-end` (the strand's precondition asserted: no live hold), every spec `vueErrorGuard` covers; unit: `sessionRebuild.spec`, `moduleStateGuard.spec`, `vueErrorReport.spec`, `reactivityWitness.spec`, the diagnostics specs; `npm run test:bottle`. On the box before the push: 17 / 18 — both tests of `console-stall-cause` green; the red, `console-diagnostics` :146, read an ENGLISH title where the spec expects «Отчёт сохранён и уйдёт позже»: the wrapper mirrors `assets/` — the GENERATED `assets/locales/ru.json` with it — into the box's SHARED `repo/assets`, the neighbour session's sync (an older locale build) overwrote it while this run waited 24 min for tokens. Not the product; told to the session that owns `scripts/e2e-remote.mjs` (generated locales belong to the task's own set) |
| C · classes 1 – 2 | **THE WHEEL'S «ПАРЛАМЕНТ» WHILE THE SITTING'S PLATE STANDS OPENS THE SITTING** (the plate's own door — `openMandatoryAnnounce`), never a lateral overview beside it: a spec that opened the overview from the wheel under a held sitting plate now gets the sitting stage. The start director's shadow no longer files «firstAction ≠ game» for a first action the player minimized | `console-eden-alliance` (new test D, both presets), every `console-parliament-sitting*`; unit: `consoleMandatoryGate.spec` § a flow's plate, `startDirector.spec`; `npm run test:bottle` (`classReplays.bottle.ts`) |
| C6c · the pulse | **A GAME SCREEN WHOSE SUPERVISOR COMPLETES NO PASS FOR 15 s REPLACES ITSELF** (`[session-rebuild] page — «no-pass» / «no-shell» … by pulse`): a spec that deliberately breaks or removes the shell's supervisor on a standing game screen now sees a navigation. The app's root arms one 5 s timer on the page's scope («the supervisor's pulse witness» in the kernel's wait table — a spec that counts the page scope's waits sees one more). The supervisor's tick is now a block (`checkLiveness(); noteSupervisorPass()`), behaviour unchanged. The bottle's document is VISIBLE now (jsdom's default is `prerender`) | `console-stall-cause` (new tests «who watches the watcher» and «the player's own way out» — on a dead screen with the last line off the Menu button still opens the system overlay), `console-gamepad-reload-carryover`, `console-system-menu`, `console-colony-venus-unity-bonus` (the laptop, 13 / 13); unit: `supervisorPulse.spec`, `moduleStateGuard.spec`; `npm run test:bottle` (test 13) |
| C6b · the deaf screen | **A SCREEN THAT ACCEPTS AND TAKES NO A / B NOW REPLACES ITSELF TOO** — only after the ladder is spent, 4 s have passed AND the player pressed again to no effect (`lastLineStep`): a spec that keeps pressing a deliberately dead confirm past a spent ladder now sees a navigation (it says `&rebuild=0`, as the spent-ladder specs already do). No-op presses (X / ←) are still no stall at all | `console-stall-cause`, `console-liveness-noop-presses`, `aaa-driver-canary` (the laptop, 6 / 6); unit: `sessionRebuild.spec` § when it is due, `consoleLiveness.spec` |
