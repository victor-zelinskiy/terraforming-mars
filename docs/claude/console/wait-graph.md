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
