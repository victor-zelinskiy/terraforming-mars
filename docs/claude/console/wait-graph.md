# The WAIT GRAPH — every wait declares what it waits for, and a cycle is seen the frame it closes

The owner, 2026-11-09: «"Граф ожиданий" — комплексная и основательная имплементация этого архитектурного механизма».
The freezes of 2026-11-07 and the monkey's two passes (ledger HC) share ONE shape: something waits, and nobody is
obliged to end the wait — two parties each waiting for the other (the chairman quest's gate vs the Parliament's
conclusion), a record that reset the run in front of it (the rally), a latch that outlived its fact (`deferred`).
The nets under them (liveness arbiter, beat stall, stale frame, anchor reaper, watchdogs) cure after 8–10 s by force,
and only the shapes somebody already met. The wait graph makes the WAIT itself the object: declared by its owner,
read once per tick, judged structurally.

## 0. The inventory (2026-11-09, four families — the worklist)

~75 wait mechanisms across PROMPT ADMISSION (9 admission blocks, the presence latch, the announce gate, `deferred`,
the start strand, the screen handoff), PRESENTATION (holds, ledger stories, the board-beat park, rail / panel rewards,
transfer flights and folds, transport gates), WORKSPACE (the guarded conclusion's six reasons, the owe, the forced
teardown, the question door, claims / arrival / release funnel, reconciler, adoption) and FLOW-INTERNAL state machines
(Parliament stages and modes, the chairman quest, the sitting director, the walk / rally, colony trade / build, the
start, draws, composers, the submit funnel). 18 mutual waits are known and broken by point fixes; ~30 more are possible
(the inventory's §G / §C / §3b / R1–R11 — kept in `wait-graph-inventory.md`).

Two facts decide the design:
1. **Most waits carry no `since`, no owner, no «for what».** A graph inferred from outside would be a guess. So the
   graph is a REGISTRY: a wait DECLARES itself (owner, since, targets, bound, recovery door). Adapters over the existing
   state are the bridge while the mechanisms migrate, never the end state.
2. **Half the risks are one pattern — an ending keyed to a global flag** (`live`, `active`, `run`) instead of the run's
   own identity. A node is keyed by the RUN it belongs to (`seq`, nonce, prompt id), never by a flag.

## 1. The model (`console/waitGraph/waitGraphModel.ts` — pure)

- **Node** — one wait standing NOW: `{id, family, owner, since, targets, bound?, recovery?, detail?}`.
  `id` names the run (`conclusion:parliament`, `admission:host#<promptId>`, `flow:rally#42`), so an old run's node can
  never be mistaken for a new one.
- **Target** — what the node waits for:
  - `node` — another wait (an edge of the graph);
  - `player` — a press the player owes (honest and unbounded — but only while a surface ACCEPTS it: a `player` target
    with nothing accepting is a dead end);
  - `server` — an answer (honest while a request is on the wire or the server owes us; else silent);
  - `motion` — a clock (an animation, a flight, a timer) — honest while its own bound holds.
- **Findings** (judged each tick, CONFIRMED over consecutive ticks like the screen shadow):
  - `cycle` — a strongly connected component of `node` edges: every member waits, none can move;
  - `dangling` — a node waits on a node that does not exist (its partner ended without it);
  - `dead-end` — every path ends in an external that cannot come (a `player` target with nothing accepting, a `server`
    target with nothing on the wire and nothing owed);
  - `overdue` — `since` past its declared bound (a bound declared and not kept);
  - `unbounded` — no bound, no recovery door, waiting on anything but the player.

## 2. Resolution (Э3 — acting, one class at a time)

A confirmed cycle is broken at its LOWEST-priority member through that member's own door — never a new path, never
by force when a door exists. The order (the laws the point fixes already wrote, now one table):
`question` (the server's live ask) > `surface` (a screen standing for it) > `conclusion` > `claim` > `flow` > `story`
/ `hold` / `park` > `announce` (a plate the player has not seen yet). «The question beats the story; the surface
beats the conclusion; a fresh record beats the stale one.» A member with no door is a worklist row, logged.

## 2a. Where it stands (2026-11-09)

- **Э1 — done.** `waitGraphModel.ts` (pure: Tarjan cycles, dangling, dead-end, overdue, unbounded on EXTERNAL ends
  only, confirmation over 3 ticks), `waitGraph.ts` (sources, declarations, first-sighting `since`, the tick, the log).
  Specs `waitGraphModel.spec` (the field shapes as positive controls) · `waitGraph.spec`.
- **Э2 — done.** The shell's source (`ConsoleShell.shellWaitNodes`: question · plate · «set aside» · standing frame ·
  held / owed conclusion · claim · funnel · admission block), ticked beside the liveness arbiter; `[wait-graph]` lines
  harvested per e2e test (`waitGraphHarvest` → `test-results/wait-graph/`); `__conWaitGraph()`; the e2e positive control
  `console-wait-graph-control` (`?waitGraphControl=1` plants the chairman quest's cycle). First shadow over 129 Parliament
  tables (seed wg1): no cycle, no dangling, no dead end — the 68 `unbounded` were the model's noise (fixed: judged on
  external ends only).
- **Э3 — armed for `cycle`.** `registerWaitRecovery(name, door)`; a confirmed cycle is broken at its YIELDING member
  (lowest rank, youngest) through that member's door, a member with no door hands the turn up the rank; logged
  `[wait-graph] cure …` (a defect upstream — fix it there). Doors: `announce-serve` (the plate acknowledged where its
  question's own surface stands, else the beacon — never the player's A), `workspace-conclusion` (the question door),
  `workspace-outcome` (the claim force-released), `hold-expire`, `story-degrade`, `park-release`, `control-door`.
- **Э4 — the law.** Waits enter BY CONSTRUCTION: every animation hold, ledger story and the board-beat park are nodes
  through their registries (`waitGraphSources.ts`); the flows declare their runs (`flow:rally#seq`, `flow:walk#seq`,
  `flow:chairman-quest`, `flow:colony-trade#run`); the admission bounds and the conclusion-reason edges are EXHAUSTIVE BY
  TYPE (`waitGraphShellBounds.ts` — a new block / reason does not compile without its entry); `waitGraphLaw.spec` fails
  on a flow-state module (`live:` / `active:`) that neither declares a source nor a hold, unless listed with its reason.

- **The shadow's first field read (2026-11-08, the owner's export):** two model noises fixed — a plate / a nested step
  pointing at a frame in `browse` read `dangling` (every top frame is a node now: a reversible one is the player's time),
  and a claim whose answer was already IN read `dead-end` (it waits for its presentation, a motion). The freeze of the
  evening was a wait nobody had declared (R14 of the inventory) — declared now.

## 2b. CEILINGS — the worklist of hidden mutual waits (2026-11-09)

The owner's field freeze of 2026-11-08 (Flooding, 9 s) was a wait NOBODY had declared, ended only by its ceiling: the
played hero's lift waited for a pay-back whose commit waited for the lift. Such a wait is invisible to every structural
judge until it is a node — so a wait whose only way out is a ceiling stands on ONE primitive, `console/waitGraph/
ceilingWait.ts` (`beginCeilingWait` → `met` / `ceiling` / `end` · `raceCeiling`): a node for its life (owner, what it waits
for, the ceiling as its bound), and a ceiling that ends it rather than the awaited thing is SAID once —
`[wait-graph] ceiling <id> (<owner>: <what held it>) — «<what>» did not come in N ms`. A ceiling is a safety, never a
schedule: every such line is a mutual wait or a lost signal upstream. Harvested per e2e test (`test-results/wait-graph/`)
and per monkey walk (a net — the frame and the graph filed); counted in `__conWaitGraph().ceilings`. The shared waits are
on it by construction (`waitQuiet` and its wrappers, `waitScreenHandoff`). **Guard `ceilingWaitGuard.spec`**: no
`Promise.race(` outside the primitive; every `wait…` / `await…` helper whose body carries a ceiling reaches the
primitive or is listed with its reason.

## 2c. `dead-end` is ARMED (2026-11-09)

A question the server asks with nothing on screen accepting, nothing holding it (no plate, no «set aside», no admission
block) and nothing in flight is cured through its own door, `question-open` (`ConsoleShell.reopenOrphanQuestion` → the
router's `openShellTaskSurface`, the road the prompt took when it arrived; never while the player set it aside, never over
a staged door). Its first field shape was R15 (the start's play-from-hand step lost to a B mid-open). A one-member finding
whose node has no door is logged as a worklist row (`cure dead-end — <node> has no door`). Positive control: e2e
`console-wait-graph-dead-end` (`?waitGraphControl=strand` → `__conStrandQuestion()` strips the serving frame; the graph
gives the question its surface back with no key pressed).

## 2d. `dangling` and `overdue` (announce only) are ARMED (2026-11-09)

`dangling` — a wait pointing at a node that is not there: «set aside» with no restore card (inventory A2) is un-set-aside
through `deferred-restore` and its question's surface opened. `overdue` acts on ONE family, the plate (`announce` — its
15 s bound is the graph's own, no other net ends a gate stuck PENDING: inventory A1), through `announce-serve`; every
other family's bound is its owner's ceiling, which acts at the same moment (`WAIT_GRAPH_OVERDUE_FAMILIES`).

## 2e. What the harvest of the full suite fixed at its source (2026-11-09)

- **A plate never announces a question its own frame serves in-flow.** The graph broke the same cycle 11× in one shard —
  the plate waiting for the colonies frame to leave, the frame (serving Pluto's colony discard / a Venus trade's bonus)
  for the question, the question for the plate. The rows of exceptions in `ConsoleShell.mandatoryBeat` (the ledger's
  discard, the start's discard, the chairman's gate, the finale) are cases of ONE law, now written once: a question whose
  serving frame stands on top, on stage, past its commit is a step of the flow, never an interruption (a browse the
  player opened still announces it).
- **An exception in an async beat reaches the field log** — `[page-error] uncaught | unhandled rejection: … @ <frames>`
  (`fieldRecorder.pageErrorLine`; the ResizeObserver notice excluded), harvested per e2e test into
  `test-results/page-errors/` and a monkey net.
- **The monkey reloads** (`TM_E2E_MONKEY_RELOAD=1` — ≈ 1 press in 120, its own seeded stream): the restore paths are
  walked like any press.

## 3. Phases

- **Э0** inventory — done (§0).
- **Э1** model + registry + detectors, unit-proven on the field shapes (the chairman-quest cycle, the rally orphan,
  the deferred dead end) as POSITIVE CONTROLS.
- **Э2** shadow: adapters + module declarations; `[wait-graph] <finding> …` logged, harvested per e2e test and per
  monkey walk into `test-results/wait-graph/` (DATA, not red), counted (`__conWaitGraph().stats`).
- **Э3** act: confirmed cycles broken through the lowest member's door, class by class, armed like the screen
  director's cures; a cure line in a run is a defect upstream to fix.
- **Э4** law: a new wait mechanism (a hold supplier, an admission block, a conclusion reason, a flow stage that gates a
  door) declares itself in the graph — a static guard lists the mechanisms and fails on an undeclared one.
