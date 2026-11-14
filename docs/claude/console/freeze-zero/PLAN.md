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
| B0 | FIND · the monkey's BASELINE on the box (before any fix), reported by class | **running 2026-11-14** — seed `fz0`, 60 presses, 8 shards in two detached lanes (`C:\Projects\Mods\tm-fz-tools\monkey-lanes.mjs`: a pass is longer than any tool's timeout; it logs to `.e2e-remote/fzbase-all/lane-<n>.log` and accumulates `shard-<s>/`); summed with `node scripts/monkey-report.mjs .e2e-remote/fzbase-all --out <report.json>` — the JSON is the «against» of every later pass |
| B1 | FIND · the kernel's state space as a number: coverage of machines / kinds / `WAITS_ON` / blocks / frame phases | **the instrument: done 2026-11-14** — `kernel/flowCoverage.ts` (the trace as keys), `console/flowCoverageProbe.ts` (`__conCoverage()`: the keys + what the machines can do + every frame), `scripts/flow-universe.mjs` (280 declared flows), the harness files it per test, `monkey-report` prints «N % walked» and what was never reached. *Open:* admission blocks and `WAITS_ON` pairs as keys; the first measured pass |
| B2 | FIND · the monkey as an instrument: coverage-guided corpus, timing perturbation, the class report, finding → spec | open |
| B3 | FIND · THE CONSOLE IN A BOTTLE: the real shell + the real server in one process on a manual clock (the base of B4 / B5) | **the spike: done 2026-11-14 — it is buildable, and it runs** (`tests/client/bottle/`, `npm run test:bottle`, 12 tests, ~1 min): the REAL `App.vue` → `ConsoleShell` (nothing stubbed) against the REAL server's router in one process, on ONE clock (the kernel, GSAP, `Date`, the frames, the server's timers); a seeded walk replays identically; a fast-check search over {press, clock, another seat, reload} finds a planted defect and shrinks it to 3 commands. *Measured limits:* tens of presses per second, not thousands (96 % of the wall is jsdom's selector engine); no layout (a rect, a paint, a CSS end) — that stays the box monkey's. *It already paid:* two product defects found and fixed (a Vue error of a Vapor component was LOST — the handler threw; the reactivity witness went blind after the first game screen of a page). *Open (§3.4):* the sweep of all 606 fixtures, server fidelity (undo, a socket stand-in, held answers), speed |
| B4 | FIND · deterministic replay of an episode (record in the field / box / monkey → replay with no box) | open |
| B5 | FIND · the COMPOSITION checked for liveness (model-based over the bottle) | open |
| C6a | ELIMINATE · THE GUARD of the rebuild's completeness: module state is reached by the session's end, or says why not | **done 2026-11-14** — `tests/console/moduleStateGuard.spec.ts` + `moduleStateBaseline.json` (a per-file ratchet): of 1 248 top-level mutable declarations under `src/client`, 647 are written by the teardown, 8 kernel-owned, 39 declared page-lifetime, **554 UNDECLARED — the worklist of the in-page rebuild** (`MODULE_STATE_REPORT=1` prints it by directory) |
| C6b | ELIMINATE · THE LAST LINE at depth `page`: past the ladder's last rung the console session is rebuilt from the server's view — once per question, a few per window | **done 2026-11-14** — `console/session/{sessionRebuild,rebuildBound}.ts`, the arbiter's `LIVENESS_REBUILD_AFTER_MS`; the episode is filed `rebuilt`; `../liveness-arbiter.md` § 3a. *Open:* the box e2e of the rewritten control; depth `shell` (needs C6a at zero); the monkey rebuilding at arbitrary presses; the rungs it retires |
| C* | ELIMINATE · class by class (§4 is the worklist), the decision layer whole on the kernel, prompt delivery as a contract, native stalls under budgets | open |
| D | PROVE · the bar as numbers, the release gate | open |

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
| `wait-graph/cycle/announce:parliament:genN/question:parliamentphase/surface:parliament` | B0 (the monkey's baseline, seed `fz0` · `eden-alliance-enact-remote`): the announce plate `parliament:gen1` is PRESENTED while the `parliament` workspace already stands past its commit and serves the very question — plate → surface → question → plate; the screen stood 7 s until the graph's door «announce-serve» acknowledged the plate | **the cause (read 2026-11-14):** the player opened the Parliament from the LT wheel a second before the political phase began (the walk: `…Pass · ArrowRight · Comma · Enter · …`). The sitting's FLOW beat `parliament:gen1` (`parliamentSittingFlowBeat`) was then BORN HELD while its own workspace already stood on stage; a flow's plate has one verb — «open the flow's workspace» — and there was nothing to open, and nowhere to show it (a plate lives on the board). The follow-up door of the question asks the gate (held), the frame waits for its question. The graph's door (`mandatoryController.yieldAnnounceInCycle`) acknowledges it after the cycle is confirmed — and the sitting then runs WITHOUT its own telling (`[ruling-change-draw] the sitting 1:1 never told its enactment — the batch takes the ordinary road`, 22 s later). **The law:** *a flow's beat born while the flow's own workspace stands on stage is acknowledged AT BIRTH* (the idiom the gate already uses for a question that is a step of a standing workspace — `corpFirstAction` in the start flow, the ledger's discard: «a plate in front of a scene that is already standing on it») — an edge of the beat's key and the stage, not a net's timer; **and the sitting has an entry for «already inside»** (its telling without the doors). Only FLOW beats: an interruptive TASK beat over a frame that is concluding must keep its plate (the frame leaves within a second and the plate rises on the board — acknowledging at the edge would skip it). · guard: a unit spec of the edge + the property «no flow beat is held while its workspace is on stage» · replay: the walk above in the bottle (`eden-alliance-enact-remote`, the presses and their gaps are in the baseline's `monkey-walk.txt`), then the box | open — next |
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
   and a disagreement is resolved by the contract, not by a net:
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
| F7 | **B3 — the console in a bottle — is the base of both the replay (R10) and the composition check (R11)** | a TLA+ / Quint model of the protocol kept in sync by a guard; replay only as an e2e re-drive on the box | A hand-written model proves the MODEL; the freezes live in 100k lines of real decision code that no model keeps up with. The real shell on a manual clock against the real server is the system itself, searchable at unit speed and shrinkable. A formal model stays an option for the one protocol small enough to state (the question's delivery, C·7) |

## 7. Specs to look at first in the CI run (running list)

| Milestone | What moved | Specs |
| --- | --- | --- |
| A1 – A6 | the arbiter's line gains `task:` · `top:` · `holder:` after `asked:` (its fixed words and its three readers unchanged) and reads its claim / holds BEFORE the rung runs (was: after); a ceiling wait that declares `planned` ends its line with `(planned: …)`; every other line is unchanged. The supervisor takes an evidence snapshot when a defect's line is printed (once per record — the flow tree, the wait table, the trace). The harness files `cause-classes/*.json` per test (data), the monkey notes its presses there; `livenessGuard` lets a spec that DECLARES the stall as its subject pass (`EXPECTS_LIVENESS_STALL`). The developer's notice no longer rises for a `planned` / `info` line | anything that reads the liveness line: the e2e `livenessGuard`, `console-wait-graph-*`, `console-screen-*-control`, the console export's STALLS digest; `console-diagnostics` (the notice, the journal's rows); the new control `console-stall-cause`; `console-monkey` (its `monkey-walk` file is unchanged, a `cause-classes` file is new). Pointwise on the box before the push: `aaa-driver-canary`, `smoke`, `console-wait-graph-control`, `-dead-end`, `console-screen-shadow-control`, `console-screen-director-cure`, `console-diagnostics`, `console-liveness-noop-presses` — 17 / 17; the final build of A: 11 / 12, the red being `console-wait-graph-dead-end` :19 on the ARBITER's line — the control's own race on a loaded box (its `settle` was swallowed, the hand's opening hold was still live when the frame was stripped, so the graph saw no dead end and the arbiter's 4 s stranded grace came first); 9 / 9 on three repeats; the precondition is asserted since C6b |
| C6a – C6b · B3 | **PAST THE LADDER'S LAST RUNG THE PAGE REPLACES ITSELF** (an `unserved` stall with nothing left to release, 4 s later): a spec that stands on a spent ladder for longer now sees a navigation — it says `&rebuild=0` in its URL (then the line `[session-rebuild] refused (off)` is printed once) or expects the rebuild. `livenessGuard` is red on any `[session-rebuild]` line too; `productReloadGuard` names the rebuild's navigation. **A Vue error of a Vapor component is PRINTED again** (`[vue-error] <chain> · <phase>: …` — since `createVaporApp` the handler threw on the instance and the line never came): `vueErrorGuard` may now turn red where an error was silently lost before — each such red is a real product error that was invisible. The reactivity witness's watchers moved to a detached scope (no behaviour on a page that mounts the shell once) | `console-stall-cause` (rewritten: rebuilt once → served again → the second strand refused; and `?rebuild=0` → the player's own reload ends the episode as `reload`), `console-wait-graph-dead-end` (the strand's precondition asserted: no live hold), every spec `vueErrorGuard` covers; unit: `sessionRebuild.spec`, `moduleStateGuard.spec`, `vueErrorReport.spec`, `reactivityWitness.spec`, the diagnostics specs; `npm run test:bottle` |
