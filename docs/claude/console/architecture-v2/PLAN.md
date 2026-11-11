# Console architecture v2 — the plan

> The answer to `docs/claude/console/architecture-v2-brief.md`. Written 2026-11-10 by the architect session; kept
> current slice by slice — **§0 is the hand-over**: read it first when a session picks this work up.
> Contract docs of what is already built live beside this file (`KERNEL.md`, …); this file is the map and the worklist.

## 0. Where the work stands (the hand-over — updated with every slice)

| Slice | What | State |
| --- | --- | --- |
| P0 | the plan, the dependencies (`xstate`, `fast-check`) | **done** |
| K1 | the flow kernel: scopes · bounded waits · the wait table · machines · the law (`KERNEL.md`) | **done** — the four shared lifecycles, the session and the owed conclusion stand on it |
| L1 | lifecycle 4 — the submit transport on the kernel | **done** — `submitMachine`, tickets, `gate()`; the ticket-first ARMING of scenes rides the domain slices (below) |
| L2 | lifecycle 2 — the workspace frame (scopes, locations, bounded beats) | **done** — every frame is a scope (`workspaceFrameScope`), its phase the `frameMachine` (beats bounded, on stage only), the beat's LEASE puts a frame back when its press did not land |
| L3 | lifecycle 1 — the outcome claim, owned by its host frame | **done** — `claimMachine` (the three backstops and the host binding are states), `consoleWorkspaceOutcome.ts` is its facade; the shell's `releaseOrphanedClaim` is deleted |
| L4 | lifecycle 3 — the announce plate and «set aside» | **the plate: done** — `announceMachine`, one run per beat key, `pending` bounded (its door is the shell's); **«set aside»: with S4** (it is a state of the QUESTION, which the prompt router owns) |
| S1 | the shell: session root + the supervisor out of the shell | **done** — `console/session/consoleSession.ts` (ONE root scope for the transport, the frames, the claims and the plates; it ends when the shell is unmounted); `console/supervisor/supervisorController.ts` (the 1 Hz sampler, the rungs, the wait-graph source, the reapers, the cures) — its 39-row PORT is the list of what the nets sample in the shell |
| S2 | the shell: the extraction tool + the first islands | **done** — `scripts/shell-extract.mjs`; ten controllers under `console/shell/` (viewer · milestones/awards · wheel · cell · info · convert · rail · journal · surface · notice), each with its typed PORT; **every watcher is a one-line delegate** — the `watch` block is the ordered table of the shell's 145 reactions and their bodies are methods (`when<Key>Changes`) that move with their domains; the types the shell shares with its SFC children live in `.ts` modules. The shell is 25.2k lines (was 27.8k). The region components (template) ride S3 / S6 |
| S6 · mechanical | the shell: EVERY domain is a controller | **done** — 34 controllers (table in §5 · S6); `ConsoleShell.vue` is 3.8k lines (was 27.8k): the template (1.6k), the composition root, the module-state mirrors, the ordered `watch` table and the two hooks. What is left in it is NOT domain code, and it ONLY SHRINKS (`shellControllers.spec.ts` — a ratchet on its data / computed / methods / watch rows / lines) |
| S5 · the owed conclusion | an ending that was refused is a RUN in its frame's scope | **done** — `console/workspaceConclusionOwe.ts`; the mailbox (`owedConclusion` + `…Since` + `…GhostSince`), the hand-written `owedConclusionSignal` (25 terms), `retryOwedConclusion` and the truth witness `workspace-conclusion-owed` are deleted; the wake is one row of the watch table over the key of the decision's OWN facts. *Open in S5:* owed STEPS as children of the frame's scope; the stale free-turn reaper |
| S3 · S4 | the shell: surface registry (pad / bar / context — one table); the prompt router and «set aside» | **S3, first step: done** — the pad router says when a surface it routed a press to is not mounted (`handedTo`: dropped, named). The rest is open — each the redesign of named controllers: `padRouter` + `commandBar`; `router` + `mandatory` |
| C0 | COVERAGE: the ledger, the session's generations, owned timers / frames, the tree in the field record | **done** — §10. `tests/console/kernelCoverage.spec.ts` + `kernelCoverageBaseline.json` count what still waits outside the kernel (raw timers · raw frames · `delayedCall`s · flow-state modules whose run is not a scope · the shell's teardown rows) and only let it shrink — a NEW console file starts at zero; `scope.after` / `scope.afterFrame` / `frames()`; `useFlowScope` (a component's own scope); `createFlowRun` (a module flow's run); a session has an identity (`session:game#n`) beside the lobby's root; `window.__conFlow()` and the heartbeat's `flow` digest |
| C2 | COVERAGE: every animation hold is a run of the tree | **done** — a hold that stands is `scene:hold:<label>#n` in the session; its ceiling is a timer that scope owns; it ends `done` / `expired` / **with its session** (the hold is then taken down through its owner's `expire` — the session-leak class closed for all 61 suppliers and 18 handles at once); a handle carries its scope (`hold.scope`) |
| C4 | COVERAGE: module flows' runs as scopes | **done — every flow-state module of the client** (the ledger's ④ is 0). The first round's seventeen (colonies, the sale, the hydro marker, the board, the cards, the two feedback scenes) + the second round's: the picks (hand / play / repeat, the three delta entries and the blockade's execution, the prelude chain, the played-cards pick), the Parliament (the agenda walk, the neutral rally, the chairman's quest — DERIVED runs: `deriveFlowRun`, the flag has many writers), the action commit, the resource-transfer wave, the played card's return, the colony track move, the finale's session, the board's story (the beat park's drain + the scale story), the terraformed scene, the loading curtain (the page's), the boot warm-up (the page's), the start-setup reveal. Five modules carry the flag and are NOT flows — declared with their reason (`NOT_A_FLOW`) |
| C1 | COVERAGE: timers and frames outside the flows | **done — the whole client** (`src/client/**`, the shared layer under the console included: the board, the journal, the endgame, the realtime channel, the lobby, the boot). Every `setTimeout` / `setInterval` / `requestAnimationFrame` / `delayedCall` is an owned wait: a component's (`useFlowScope` — 83 components, lazy, parented by where the component stands), a shell controller's (`useFlowScope` in the controller factory), a run's, the session's, or the page's (`consoleAppScope()`); a `delayedCall` keeps GSAP's clock and gains an owner (`motionAfter` / `motionGuarantee` / `motionSpan`); a tick is `scope.every`; the transport's poll is a guaranteed release of the transport's own scope. What stands outside is DECLARED: the gamepad's sampling loop and its one coalesced frame (`DEVICE_CLOCKS` — a device driver below the console, exact counts pinned). The ledger's line: **373 → 0 raw timers, 137 → 0 raw frames, 36 → 0 `delayedCall`s** (+ 1 timer / 3 frames declared as device clocks) |
| C3 | COVERAGE: the registries as views | **the three registries are views of the tree**: holds (C2); every CEILING WAIT (`declareWait` — `beginCeilingWait` / `raceCeiling` / `untilCeiling`) is a row of the session's wait table bounded by its ceiling and withdrawn with it; every OWED STORY of the presentation ledger is `story:owed:<id>` (its release edge a row bounded by `dueMs`), ended at its settle / degrade or with its session. *Open:* the wait graph's ten `registerWaitSource` adapters are derived readers of the shell's state (no book of their own) — they go when the observer reads `waitTable()` directly, which needs the shell's remaining lifecycles as scopes (§0 list 1 – 5); the hand-written poll bodies that do more than read a condition keep their shape on owned timers |
| C5 | COVERAGE: the shell's teardown | **done** — the 66 `reset…()` / `abort…()` rows of the shell's `beforeUnmount` are gone: each module DECLARES its state beside its own reset (`sessionState(label, reset, at)` — 66 declarations in 63 modules) and the leaving shell says one thing, `leaveConsoleSession()` (one ordered pass, each reset isolated; the order is the list's own, as a total order the ledger guards). The session's scope still ends on `unmounted`. Seven timer refs the shell only kept to clear them are deleted |
| S6 · latches | the shell's latches are scopes | **done** — `scopedState(label, rest, owner?)` (`console/session/scopedState.ts`): the twenty-six «pending / owed / armed / leaving / in flight» refs of the controllers (`commitFoldOwed`, `pendingPlayCard`, `taskSpacePending`, `parliamentLeaving`, …) and «set aside» itself (`consoleState.task.deferred`) are `Ref`s whose every raised span is a `step` scope of the tree — named with its age in every dump, lowered by itself when its owner ends. Their owner is the session until each one's flow is a scope (then: its frame / its run) |
| D | THE DEBT LEDGER — what still runs on a mechanism the kernel replaces is counted and FROZEN | **done** — §11. `tests/console/architectureDebt.spec.ts` over `architectureDebtBaseline.json`: nine mechanisms of the shell's decision logic (wait-graph sources and doors, liveness rungs, truth witnesses, set-aside writers, surfaces reached by `$refs`, latches reset by the view-apply reaction, resolver mailboxes, bare latches) + the supervisor's port — a file may not gain a use, **a new file starts at zero**, each row names its kernel form. The reviewer's checklist is `REVIEW.md` |
| N1 | native stalls: LoAF in the field log, a trace on `unresponsive` | **done (diagnosis)** — `longFrameWatch.ts` (`[long-frame]` lines with the frame's split), `electron/hangTrace.ts` (a Chromium trace of every stop, named in the hang line); reducing what the first traces name is open |

**Branch / tree.** The work is done in the worktree `C:\Projects\Mods\tm-arch` (branch `arch-v2`, rebased on
`origin/main` before every push; pushed to `main` slice by slice). After a push the main clone is moved onto it
(`git fetch` → HEAD = `origin/main`, own paths checked out) — the owner looks at the main clone.

**Specs whose hooks or timing a slice touched** (the CI run at the end is the verdict — look here first): see §9.

**The owner's direction (2026-11-11, after the green CI run): «100 % of the console UI on the framework».** That is a
number now — §10 defines it (the coverage ledger). **The ledger is EMPTY since the second round (2026-11-11):
nothing in `src/client` waits outside a scope, no flow-state module runs outside one, the shell's teardown lists no
module** — and it can only stay so (a new file starts at zero; the baseline has no row to grow into). What is left is
NOT coverage: it is the shell's own redesign, listed below — each a rewrite of named controllers ON the framework
that now holds everything under them.

**Where that leaves the work (2026-11-11, third round).** Two statements are true and guarded: ① *nothing in the
client waits outside a scope* (the coverage ledger — empty); ② *nothing NEW can be written on a mechanism the kernel
replaces* (the debt ledger — frozen, a new file starts at zero; `REVIEW.md` is the procedure for whoever writes or
audits). What is left is the shell's own decision logic — the list below; it is a REDESIGN of behaviour-bearing
controllers (the router, the pad ladder, the reactions), so it is taken slice by slice with the full e2e run between
slices, and its size is the debt baseline's numbers (§11), not an impression.

**What is open, in the order to take it** (each is a redesign of named controllers now, not an excavation):

1. **S5, the rest** — owed STEPS as children of the frame's scope (`followUpStepOwed`, `hostedStepOwedTo`,
   `politicalDiscardOwed`, `lawStepOwed` are computeds over module state; declared at the press that owes them they
   make `conclusionFacts.owedStep` a structural fact). Then the ghost test, the forced teardown and
   `reapStaleFreeTurnFrame` (the supervisor) can go: «nothing the player could act on» stops being sampled.
2. **S4** — the prompt router (`routerController` 68 rows + `mandatoryController` 46): admission and the ownership
   trios as one table; «set aside» as a record owned by its question (§5 · S4 has the analysis); the view-apply
   reaction's twelve written rows (`viewApplyController`) become ends of their own flows. Retires the screen / start
   director shadows, the leak detector's stranded check, the `deferred-restore` door.
3. **S3, the rest** — the surface registry: `padRouterController` (150 rows) and `commandBarController` (108) ask
   the same ~100 facts in two orders; one ordered table of surface entries, a surface registering its handler while
   mounted (the pad path stops using `$refs` — `handedTo` is the bridge until then), then the region components (the
   template block of a surface moves with its entry).
4. **S6, the lifecycle half** — per domain, its reactions (`when…Changes` in its controller) and latches become
   machine states / scoped runs: colonies and hydro first. A reaction of the shape «my frame is gone → reset my
   flag» is NOT simply `workspaceFrameScope(kind).defer(…)`: those watchers key on `workspaceFrameKnown` (live or
   parked), the scope lives through the THIRD home too (aside for the board) — decide per flag whether surviving
   the excursion is the fix or a change (repeat pick, the delta reward / espionage picks, the card's hydro entry).
5. **L1, the rest** — ticket-first arming (`openSubmit()` returns the ticket, scenes are armed ON it) at each
   `arm…()` site, domain by domain; then the ticket-less `submitInput(out)` form goes.
6. **Phase 3** — ~~holds as scoped runs~~ (C2) · ~~the board stories and the directors' runs on the wait table~~
   (C3 / C4 — done); the wait-graph observer reads the kernel's table through one adapter and its ten derived sources
   (`shellWaitNodes`) go — after items 1 – 4 made the shell's lifecycles scopes.
7. **S-last** — the session wires the controllers' ports directly (no instance in between), ~~the `reset…()` list in
   `beforeUnmount` becomes registrations~~ (C5 — done: `sessionState` + `leaveConsoleSession`), and the session OWNS
   THE TICK: one ordered
   pass of decisions per flush, after the reactions that complete the facts and before the render — the primitive
   the watch table's rows need before they can leave it (§5 · S5 — the lesson of the owed conclusion).
8. **N1** — read the first field traces (`hang-*.json` beside the logs, `[long-frame]` lines) and reduce what they name.

---

## 1. The diagnosis, restated as five structural defects

The brief lists the field cases. Read against the code (the four lifecycle modules in full; `ConsoleShell.vue` mapped
member by member — 452 imports, 106 data fields of which 34 are mirrors of module state and ~45 are timers / latches /
mailboxes, ~535 computeds, 145 watchers, ~330 methods, a 1 Hz tick), every one of them is an instance of five defects.
The plan is judged by whether each becomes **inexpressible**, not better guarded.

| # | Defect | Field shape | Why it is expressible today |
| --- | --- | --- | --- |
| D1 | **Ownership by name.** A thing refers to its owner by a key and nobody ends it when the owner goes. | Hi-Tech Lab (a claim outlived its host frame); 12 watchers of the shape «flag may not outlive its frame»; `colonySettleDwell`; a berth that outlived the hand that lent it | lifetimes are implicit: a singleton record + `release…()` calls at 32 sites, a host that lives in one of three arrays |
| D2 | **Waits are predicates.** «A waits for B» is a boolean term in a computed of A; B's owner does not know. | the chairman quest (conclusion ⇄ plate ⇄ frame), Flooding (lift ⇄ pay-back), the Venus trade, the hydro finish; 18 known mutual waits, ~30 possible | ~75 wait mechanisms, most with no owner, no since, no bound; the wait graph reconstructs them 1 Hz from adapters |
| D3 | **A hold is a flag raised at the start and lowered by a callback.** | holds that outlive their motion (killed tween, deferred timeline, exception in an async beat, an early `return`) | `begin…` / `release…` are two calls joined by hope; `transportHolds.tradeFleet = true; await run…()` has no `finally` in six gates |
| D4 | **Lifecycles advance on EDGES.** A watcher fires once on a rising / falling edge and returns early when a precondition is not met at that instant. | 29 edge-only hazards in the shell's `watch` block (the map names them); owed conclusions; `mandatoryPresentationReady` true→true | 145 watchers, 7 hand-written «signal» keys that must mirror what the decision reads (W7: the signal lacked four terms), mailbox fields between watchers (`pendingCommitDismiss`, `lawPlayFold`, `colonyResolutionReleaseOwed`, …) |
| D5 | **One component arbitrates everything.** The same ~40-branch precedence ladder is written three times (the pad's `handleIntent`, the bar's `commands`, the bar's `commandContext`), admission is one strongly connected cluster of ~60 computeds, and every surface's presence is three shell computeds (`…BelongsToWorkspace` / `…HeldForWorkspace` / `…EmbedTarget` × 5). | the deaf screen, the pad owned by a hidden surface, «the bar says A, A does nothing», `$refs.x?.handleIntent(intent); return true` swallowing a press for an unmounted surface (≈ 25 sites) | `ConsoleShell.vue` |

The nets (liveness ladder, wait graph, motion witness, directors, reapers, the release funnel, the ratchets, the
ceiling waits) are all **observers of D1–D4 after the fact**. They stay necessary exactly as long as the defects are
expressible.

## 2. The target architecture

Four layers. Each lower layer knows nothing of the one above it.

```
 L3  VIEWS          ConsoleShell.vue = layout + region components (hud · main · prompts · viewer · flights · footer)
                    a region renders a controller's view-model; it owns no lifecycle
 L2  SESSION        ConsoleSession — the composition root of ONE game screen: creates the controllers, wires their
                    ports explicitly, owns the root scope.  Controllers: transport · workspace host · prompt router ·
                    announce · surfaces (hand, card actions, colonies, hydro, parliament, start, draft, endgame, …) ·
                    input / command registry · supervisor
 L1  LIFECYCLES     statecharts (XState v5) for everything that has a protocol in time: the submit funnel, the frame,
                    the outcome claim, the announce plate, later the directors' runs
 L0  KERNEL         console/kernel — FlowScope (ownership tree) · bounded, declared waits (the wait TABLE is the wait
                    graph) · the machine binding · the law (static + model-checked) · the trace (field diagnosis)
```

### 2.1 L0 — the flow kernel (`src/client/console/kernel/`)

**FlowScope — one ownership tree.** Every run of anything that has a lifetime — a submit, a frame, a claim, a plate,
a scene's beat, a hold — is a *scope*: `{id (the run's identity — kind#seq, never a flag), kind, parent, signal}`.
A scope ends exactly once (`done` · `cancelled(reason)` · `failed(error)` · `expired(bound)`); ending it ends its
children first, then runs its cleanups LIFO, then tells its parent. Everything a run acquires is registered in its
scope (`scope.defer`, or `using` — a scope is a `Disposable`): timers, tweens, listeners, an animation hold, a lent
DOM zone, a child actor. **D1 becomes inexpressible**: a claim is opened *in its host frame's scope*, so «the host is
gone and the claim stands» has no representation — there is no `releaseOrphanedClaim` to forget. **D3 too**: a hold is
`scope.hold(label)`, released by the scope's end on every path (return, throw, cancel, bound) — there is no second
call to lose; an async beat is `scope.run(label, async (s) => …)`, and an exception in it is that scope's `failed`
end, never a half-set flow.

**Waits are objects, bounded by type.** The only way kernel code waits is `scope.wait(target, {bound})`. A target is
one of: `until(reactivePredicate)` (level-triggered — true now resolves now), `ended(otherScope)`, `motion(animation)`
(settles on complete AND on interrupt), `signal(source)`, `delay(ms)` (the motion clock), `player(surfaceScope)`,
`server(ticket)`. `bound` is a **required** argument (only `player` may be unbounded, and it must name the accepting
surface — when that surface's scope ends, the wait is cancelled, so «a press nobody accepts» cannot be waited for).
The result is a discriminated union — `met(value) | bound | cancelled | cycle` — so the caller cannot compile without
saying what happens when the awaited thing does not come. Every standing wait is a row of the **wait table**
(`owner scope → target, since, bound`): the wait graph is no longer reconstructed from adapters once a second, it IS
the table, exact at every instant. Two consequences:

- **A cycle is refused the instant its last edge is requested** (`wait` walks the table from the target back to the
  owner before it registers): the requester gets `cycle` synchronously and takes its own bound path at once. No
  confirmation over three ticks, no door, no «cure» — a mutual wait never *stands*.
- **Cross-flow waits are a typed table.** `WAITS_ON: Record<FlowKind, FlowKind[]>` lists which kind may wait for the
  end of which other kind; `scope.wait(ended(b))` does not compile for a pair that is not in it, and
  `tests/console/kernel/flowLaw.spec.ts` proves the table is a DAG. «Who waits on whom» is a property of the structure
  (D2): a decision never waits on a story because `story` is not in `WAITS_ON.frame`, not because a reviewer remembered.

**Machines.** `scope.actor(machine, input)` starts an XState actor on the kernel's clock, stops it with the scope and
exposes its snapshot as a `shallowRef` — the ONE writer of that state, reactive by construction (invariant 17 holds
without a witness for everything on the kernel). The **law** every lifecycle machine must pass
(`kernel/flowLaw.ts`, run by one spec over every registered machine):

1. every atomic state carries exactly one tag — `rest` (nothing owed, may stand forever) · `player` (waits for a
   press; `meta.accepts` names the surface) · `beat` (transient) — or is final;
2. a `beat` state has an `after` transition (its bound) and `meta.waitsOn` (what it waits for) — **a wait with no
   bound fails the test**;
3. no atomic non-final state is a trap, and from every state a `rest` or final state is reachable — **a state with no
   exit fails the test** (static walk + `xstate/graph` exploration over the machine's declared event samples);
4. model-based runs (`fast-check`): random event / clock schedules against each machine and against compositions
   (frame + claim + submit) hold the invariants «every accepted submit settles exactly once», «no scope outlives its
   parent», «a beat never stands past its bound», «the mirrors equal the snapshot».

**Trace.** The kernel records scope opens / ends (with reason), waits (begun · met · bound · cycle) and machine
transitions into a ring; `dumpFlowTree()` prints the live tree — every standing scope with its age, its machine state
and its waits. The field recorder's heartbeat, the console export and the main-process hang watch read it: «what stood
where» is the structure itself, not a reconstruction (field diagnosis gets better, not worse).

**The supervisor** is the one supervisory layer that remains (§6): it asserts the kernel's invariants (a bound that
did not fire, a scope alive under an ended parent) and keeps the liveness arbiter's player-side judge (presses that
change nothing) as the net under code not yet on the kernel.

### 2.2 L1 — the four shared lifecycles

**(4) The submit transport** — `transport/submitMachine.ts`, driven by `gameTransport.ts`.
`idle(rest) → sending(beat: the server, ceiling = no headers for 60 s) → presenting(beat: its gates, each a child
scope with its own bound and its own abort) → applying → settling → idle`, with `refused` / `network` / `silent`
→ `unwinding → idle`. What changes structurally:

- **A press is a TICKET.** `openSubmit()` returns a ticket only while the funnel is `idle`; arming a scene for a
  submit and sending it are both done *on the ticket*. A second submit while one stands gets no ticket — it cannot
  arm, cannot fly a card for a press that will be dropped, and its caller holds the refusal in its hand
  (`{accepted: false, reason: 'busy'}`). The silent drop (R11) has no representation.
- **Every submit settles exactly once** — `applied · refused · failed · silent · abandoned` — to its ticket AND on a
  broadcast (`onSubmitSettled`), which is what every surface-local «submitting» flag resets on (the Parliament's live
  doors, `firstAct.submitting`, the chairman's `sent`, the deck pick — the rows the refusal battery never listed).
- **A gate is a bounded child.** Each cinematic gate (`played hero`, `trade fleet`, `tile hero`, … 19 of them) runs
  as `gate(id, run, {abort, maxMs})`: its `transportHolds` flag is the child scope's life (raised on open, lowered on
  every end), its bound ends it through the module's own abort and the pipeline continues. A gate that throws is a
  `failed` child, not a funnel wedged for the session (six gates have no `finally` today).
- The liveness rung `transport` (22) and the submit ceiling become the machine's own `after` transitions.

**(2) The workspace frame** — `consoleWorkspaceStack.ts` keeps its data model (one reactive record, pure accessors —
it is the one part of today's design that is already right) and gains what it lacked:

- **every frame is a scope**, opened by the verb that creates the frame, child of the frame below it; every way a
  frame goes (pop · truncate · anchor drop · park discard · phase close · reset) ends that scope. Whatever is
  registered there — a claim, an owed step, a lent zone, a module flow record — ends with the frame.
- **WHERE a frame stands is one state** of its chain — `stage · parked · aside` — not membership in one of three
  arrays that readers must remember to union («a third place nobody had listed»).
- **the phase is a machine** (`frameMachine`): `browse(rest) · configure(player) · executing(beat) · committed(player)
  · verdict(player) · completing(beat)`. The two beats are bounded by construction (`after` → the owner's declared
  recovery), and `meta.waitsOn` names the ticket / the motion they wait for — the beat-stall guard's 1 Hz judgement
  becomes a property of the state. The record's `phase` field is the machine's mirror (one writer).

**(1) The outcome claim** — `consoleWorkspaceOutcome.ts` becomes `claimMachine` in the **host frame's scope**:
`awaiting(beat: the answer, 20 s — refused while serving) → presenting(player) → released`, with parallel regions for
the execution beat (`pending → done`, 2.6 s from the flight) and the arrival (`unflown → flown → done`, 5 s). The
three module timers, the serving probe's re-arm loop and `releaseOrphanedClaim` disappear into `after` transitions and
the scope tree; `rehome` is an explicit move of the claim's scope to another frame. The singleton reactive record and
the 57 `claim…` / `release…` call sites keep working through a facade while they migrate.

**(3) The announce plate and «set aside»** — `consoleMandatoryGate.ts` + the deferred flag become `announceMachine`,
one actor per beat key: `pending(beat: its first presentation — the read beat, blocking holds; bound 15 s → present
by the beacon) → presented(player) → acknowledged → gone`, and «set aside» is the `parked` location of the question's
own surface chain (one concept, as CLAUDE.md demands) with the restore card as that state's accepting surface — «set
aside with no restore card» (A2) is not a state.

### 2.3 L2 — the session and the shell

`ConsoleShell.vue` stops being the place where behaviour lives.

- **`ConsoleSession`** (`console/session/`) is created once per game screen and is the only composition root: it
  opens the root scope, constructs the controllers in dependency order and hands each its **ports** (typed interfaces
  — a controller names exactly what it reads from the others). Tests construct a session with fakes.
- **A controller** (`console/shell/<domain>/…Controller.ts`) owns one domain's state, derivations and lifecycles —
  Composition-API style (`ref` / `computed` / functions), no `this`. The shell's `setup()` asks the session for them
  and exposes their view-models to the template.
- **The surface registry** replaces the three ladders (D5): one ordered table of surface entries
  `{id, stands(), handle(intent), commands(), context()}`; the pad router, the command bar and the bar's context all
  walk the SAME table, so «three consumers ask one predicate» is the data structure. A surface that stands but has no
  mounted handler is a typed fact the supervisor sees at the first press, not a silent `?.`.
- **Region components** take the template apart by ownership (`ShellViewer`, `ShellFlightLayers`, `ShellPrompts`,
  `ShellFooter`, …), each rendering its controller's view-model.
- **Decide by level, act once per run** is the rule that replaces the watcher mailboxes (D4): a decision that today is
  an edge watcher + a hand-written signal key becomes an effect over the decision function itself (Vue tracks exactly
  what the decision reads — the «signal lacks a term» class is gone), acting under the run's identity so it acts once.
  Where real memory is needed it is a machine state, never a data-field latch.

**As built so far** (the target above is reached in this order — §0 «What is open»): the composition root is still
the shell's `setup()` — it opens the session (`useConsoleSession`) and constructs the 34 controllers, each reaching
its siblings through its typed port over the shell instance (S-last wires the ports directly); the session is the
root SCOPE and not yet a constructor of controllers; the controllers are flat under `console/shell/` (one file per
domain — a directory per domain comes when a domain gains its machine); the surface registry and the region
components are open (S3). «Decide by level» has its first instance (the owed conclusion: one facts object for the
decision and the wake) and one amendment learned on the box: a decision that ACTS has a PLACE IN THE TICK — a
reaction that leaves the watch table loses its row, and the row was that place (§5 · S5 — two free forms failed
e2e); the wake stays a row until the session owns the tick.

The vehicle for the bulk of the 27,801 lines is **mechanical** (§5.S2): a codemod over the SFC's script (TypeScript
compiler API) moves a named member set — data, computeds, methods, with their comments — into a controller module,
rewrites `this.` accesses (own members → locals, foreign members → the controller's typed port) and reports the
dependency matrix. It makes the coupling explicit before anybody redesigns it; the lifecycle core (routing, admission,
conclusion, the supervisor) is then redesigned by hand on the kernel. Watchers stay declared in the shell — in their
original order, as one-line delegates — until their domain's lifecycle is a machine (watcher creation order is
load-bearing in at least three documented places).

## 3. Frameworks — what, why, and what was rejected

| Choice | Why |
| --- | --- |
| **XState v5** (`xstate` 5.33) | The lifecycles are protocols in time with timers, parallel regions and children — exactly a statechart. `after` is a bound that is cancelled with its state; invoked / spawned actors stop with their parent; the definition is data, so the law (§2.1) can be checked statically and explored with `xstate/graph`; `inspect` feeds the trace; `SimulatedClock` makes every timer path a unit test. An industry standard other sessions can read, with docs we do not have to write. ~17 kB gz. |
| **A small in-house kernel** (FlowScope + waits) | Structured concurrency is the missing half (ownership, cancellation, bounded waits). **Effect-TS** provides it, but as a whole-program paradigm: every async path in 800 files would have to be re-typed into `Effect`, it does not compose with Vue reactivity and GSAP callbacks without an adapter at every seam, and its runtime is ~10× the kernel's size. The kernel is ~600 lines on platform primitives (`AbortSignal`, `Symbol.dispose` / `using`, `Promise`), does only what the freeze classes need, and its invariants are property-tested. |
| **`fast-check`** (dev) | Model-based / property tests: the kernel's invariants under random schedules, and the machines' compositions — the races that today show up only under load in e2e are generated in milliseconds. |
| **`xstate/graph`** | Shortest / simple paths and adjacency over each machine: reachability of a rest state from every state is a test, not a review comment. |
| **`using` / `DisposableStack`** | Chromium 134+ and Node 24 run them natively; TypeScript downlevels for the es2021 target. Used where a resource's life is a lexical block; the scope is the general form. |
| Chromium tracing (`contentTracing`) + **Long Animation Frames** | Native stalls (§5.N1): nothing in page JS can see them — the main process records a trace around `unresponsive`, the page records every long frame's phase split (script · style/layout · render) into the field log. |
| *Rejected:* an actor framework for everything (one actor per module) | Most modules are pure derivations or one-shot directors; forcing a mailbox on them adds indirection without a guarantee. Machines are used where there is a protocol; scopes where there is only a lifetime. |
| *Rejected:* Pinia / a global store | The problem is not where state lives but who ends it and who waits for it. |

## 4. How today's modules map

| Today | Becomes | Slice |
| --- | --- | --- |
| `transport/gameTransport.ts` (the `fetch` chain, `isServerSideRequestInProgress`, `transportHolds`, the abort battery) | `submitMachine` + tickets + `gate()`; the poll chain owned by the transport scope | L1 |
| `transport/submitCeiling.ts` · liveness rung 22 | the machine's `after` transitions | L1 |
| `consoleWorkspaceStack.ts` (three arrays, verbs, anchors) | same data model + frame scopes + chain location + `frameMachine` for the phase | L2 |
| `workspaceBeatStall.ts` | the frame machine's beat bounds (the module shrinks to the surface-reported beat, then goes) | L2 |
| `consoleWorkspaceOutcome.ts` (singleton record, 3 timers, serving probe, 32 release sites) | `claimMachine` under the host frame's scope; the module is its facade | L3 |
| `ConsoleShell.releaseOrphanedClaim`, `claimHostGoneSince`, `consoleOutcomeAdoption.ts` | deleted (scope tree) / an explicit `rehome` | L3 |
| `consoleMandatoryGate.ts` + `consoleState.task.deferred` + the restore card | `announceMachine`; «set aside» = the chain's `parked` location | L4 |
| `consoleLiveness.ts` + `ConsoleShell.checkLiveness / registerLivenessRungs / shellWaitNodes` + `waitGraph/*` | `console/supervisor/` (out of the shell first, then shrinking — §6) | S1 → end |
| `ConsoleShell.handleIntent` · `commands` · `commandContext` (≈ 2,000 lines) | the surface registry + per-surface entries | S3 |
| the admission cluster (`admissionSignals…`, `admits`, `hostTask` / `shellTask` / `startTask` / `nativeCompositeTask`, the five ownership trios) | `PromptRouter` controller: one table «question → owner surface → zone», the screen director's table promoted from shadow to mechanism | S4 |
| `concludeWorkspaceFlow` · `owedConclusion*` · `retryOwedConclusion` · `stuckWorkspaceIsGhost` · `reapStaleFreeTurnFrame` | conclusion as a JOIN of the frame's scope (children + owed steps), decided by level | S5 |
| the shell's per-domain members (viewer 60, milestones/awards 45, info mode 15, hand ~120, colonies ~110, hydro ~70, parliament ~60, start ~40, placement ~60, …) | domain controllers + region components | S2, S6… |
| `animationHold.ts` (suppliers, handles, ceiling, quarantine) | `scope.hold` for kernel code; suppliers migrate with their flows | Phase 3 |
| `boardBeatPark`, `presentationLedger`, `screenHandoff`, the directors' runs (start, sitting, chairman quest, walk, rally, generation scene, finale) | scoped runs with declared waits (`story` / `scene` kinds of the wait table) | Phase 3 |

## 5. The slices

Every slice: compiles, `npm run lint` (incl. `vue-tsc`) and `npm run build:test` green, `npm run test` green, the
console guard specs green, committed and pushed. No slice leaves two systems deciding the same thing: a facade
forwards to the new owner, it never keeps a second copy of the state.

### Phase 0 — foundation

- **P0 (this file).** Dependencies added.
- **K1 — the kernel.** `flowScope.ts`, `flowWait.ts` (+ the table and the cycle check), `flowKinds.ts`
  (`WAITS_ON`), `flowMachine.ts`, `flowLaw.ts`, `flowTrace.ts`, `flowClock.ts`; specs: unit + property
  (`fast-check`) + the law spec; `KERNEL.md`. No behaviour change — nothing uses it yet.
  (`waitGraph/ceilingWait.ts` is re-seated on the kernel's wait table in S1, with the supervisor: its 54 callers
  become table rows for free and the legacy wait graph reads the table through one adapter.)

### Phase 1 — the four shared lifecycles

- **L1 — transport (done).** As §2.2 (4): `submitMachine.ts` (one actor per submit, in its own scope under the
  transport's), `gameTransport.fetchPlayerInput` = the funnel (ticket · mirrors · the three endings), `presentAnswer`
  = the gate pipeline with every awaited scene a `gate()` child (order verbatim — it is documented per gate and
  load-bearing). `transportHolds` / `transportState` / `root.isServerSideRequestInProgress` are mirrors.
  `submitCeiling.ts` retired. **What L1 does not do yet:** a caller that ARMS a scene before it submits still arms on
  module state, so a refused press (`accepted: false`) leaves that arm to the caller. The by-construction form —
  `openSubmit()` returns the ticket FIRST, scenes are armed ON it (their abort is the ticket's), and a ticket not sent
  in the task it was opened in is void — is adopted domain by domain in S6…, where each `arm…()` site is touched
  anyway; the last slice removes the ticket-less `submitInput(out)` form.
- **L2 — frames (done).** `consoleWorkspaceStack.ts` keeps its data model and verbs; `syncFrameLifetimes` (one
  reconciler, called at the end of every verb that moves or removes frames) gives every frame a scope — a child of the
  frame below it — and ends the scope of a frame that left all three homes. `consoleWorkspaceFrame.ts` is the phase
  machine: `setWorkspaceFramePhase` and the stack's own phase writes go through `writeFramePhase`; the record's
  `phase` is the mirror. `executing` / `completing` are beats with a bound that runs only ON STAGE
  (`FRAME_BEAT_MAX_MS` — the structural net; the liveness arbiter still cuts a QUIET beat in seconds, which is why the
  beat-stall guard's sampler was already a witness of the arbiter and not a judge of its own). **The beat's lease**:
  a beat entered in the same synchronous stretch as a press is bound to that press's ticket (`onSubmitTicket`); a
  press that did not land — refused busy, refused by the server, failed, silent — puts the frame back where the beat
  came from. A surface's own rollback still runs first; where one was forgotten this is the rollback.
  *Not yet:* owed steps and the conclusion as children of the frame's scope (S5); the twelve «flag may not outlive its
  frame» watchers become `workspaceFrameScope(kind).defer(...)` with their domains (S6…).
- **L3 — claim (done).** `consoleWorkspaceClaim.ts`: four parallel regions — `stage` (awaiting · held · presenting ·
  presentingOwed: «claimed and nothing came» is 20 s, a claim that SERVES is the player's time, a refused release keeps
  being re-asked), `beat` (2.6 s), `arrival` (the input gate: closed → timed 5 s → open), `host` (bound · orphaned
  1.5 s → released). `consoleWorkspaceOutcome.ts` keeps every exported function and the reactive record (`stage` /
  `beatDone` / `arrivalDone` are the machine's mirrors); a claim is one scope, BOUND to its host frame's scope
  (`bindClaimHost` — the frame's end is an event, whichever home it ended in; a frame of the kind standing again
  re-binds, `rehome` re-binds to the new host). Deleted: the three module timers and their arm / clear calls, the
  shell's `releaseOrphanedClaim` + `claimHostGoneSince` (the 1 Hz «known nowhere» sample that had to learn the frame's
  third home). The release funnel's serving guard is unchanged (`workspaceFrameKnown` — live or parked).
- **L4 — announce (done) / set aside (S4).** `consoleMandatoryAnnounce.ts`: `pending` (a BEAT — the first
  presentation waits for the scenes of the screen, 15 s) → `late` (what stands past the bound is the player's own
  time; entering it runs the plate's door) / `presented` → `acknowledged`; one run per beat key in its own scope —
  `noteMandatoryBeatIdentity` starts and ends it, so the latches die with their beat by construction. The three keys
  of `mandatoryGateState` keep their meaning and their writers (each tells the machine in the same call — a beat may
  be acknowledged BEFORE it becomes the current one, which a per-key machine alone cannot hold). The bound that was
  the wait graph's `overdue` judgement for the `announce` family (inventory A1) is the state's own; the shell
  registers the door (`registerAnnounceDoor` → `yieldAnnounceInCycle`).
  *Deliberately not in this slice:* the readiness watchers (`mandatoryBeatKey` / `mandatoryPresentationReady`) stay in
  the shell — replacing them with a level-triggered wait changes their flush order against the 140 other watchers, and
  goes with the announce controller's extraction; **«set aside»** (`consoleState.task.deferred`, 5 writers that set
  it, 25 that clear it, the restore card's four-family predicate — inventory A2) is a state of the QUESTION, not of
  the plate: it becomes the question scope's `aside` location in S4, where «set aside with no restore card» stops
  being expressible. Until then A2 keeps its wait-graph door (`deferred-restore`).

### Phase 2 — the shell

- **S1 — session + supervisor (done).** **The session** (`console/session/consoleSession.ts`): ONE root scope of
  kind `session`; the four lifecycle modules open their trees inside it (`consoleSessionScope().open(…)` — they ask
  every time, never cache a dead root), `useConsoleSession()` in the shell's `setup()` ends it on `unmounted` (after
  the children — the transport's binder — are gone). «The game screen left» is then one event for every flow on the
  kernel, whatever the 120-row `reset…()` list in `beforeUnmount` forgot (the session-leak class); module state that
  is not a flow yet can hang its reset on the session (`onConsoleSessionEnd`) — adopted as each module is touched, and
  the list shrinks to nothing in S-last. `dumpFlowTree()` is one tree. Spec: `tests/console/consoleSession.spec.ts`.
  **The supervisor** (`console/supervisor/supervisorController.ts`, taken out with the S2 tool): `startSupervisor` /
  `stopSupervisor` (called from the shell's hooks in the rows they always stood in), `checkLiveness` (the one 1 Hz
  sampler), `registerLivenessRungs`, `shellWaitNodes`, the reapers, the forced recovery, the two directors' cures,
  with their module state (`pageStill`, `waitSurfacePhase`, the control stand's declared defect). **Its port is the
  deliverable**: 39 rows — every fact a net samples in the shell because no owner ends it. A net retires by rows of
  that port going away (§6); nothing may be added to it. State two domains share went to
  `console/shell/shellFlowState.ts` by name (`conclusionRefusal`, `handoffPendingEntries`, the owed-conclusion
  graces) — it shrinks with S5.
- **S2 — the extraction tool + first islands (done).** `scripts/shell-extract.mjs` (its header is the manual):
  `index` lists every member, `report <spec>` prints a member set's PORT (every foreign member it reads / calls /
  WRITES), who else uses the set, the watchers that touch it and what blocks a verbatim move; `apply <spec>` writes
  `create<Name>Controller(shell: <Name>Port)` and patches the SFC (members cut, the controller constructed in
  `setup()` and spread into its return, a conformance row added to `shellPortsConform()`, unused imports pruned);
  `prune <file>` drops imports a file no longer names; `delegate-watchers` turns every watcher's body into a method
  (`when<Key>Changes`) and the watcher into a one-line delegate — the `watch` block stays in the shell IN ITS ORDER
  (creation order is load-bearing) as the table of reactions, and a reaction's body then moves with its domain like
  any method; `lift <target.ts> NAME…` moves module-level types / constants several domains read into a module;
  `graph` prints who uses whom (the input of clustering the remaining members into domains). What the tool
  guarantees by construction: `this.x` of a moved
  member is a local (`x.value` / `x`), of a module mirror the import itself, of anything else `shell.x` — typed off the
  member's own declaration (or the sibling controller that already owns it: `UnwrapRef<ViewerController['x']>`); a
  member whose name also occurs FREE in the moving code (`maPriceWaiverOf` the method vs the import, `const game =
  this.game`) is declared under an alias `ownX` and returned under its real name; it REFUSES a bare `this`, a `this`
  inside a plain `function`, a data initializer that reads the instance (a controller is built before the options
  exist), a local that would shadow the port or a mirror, a module-level declaration both sides read (move it to a
  shared module first, or name the owner in `spec.exports`).
  **The procedure for the next domain** (S6…): (1) `index` → pick the members; (2) `report` until the port reads as
  the domain's real dependencies (a surprising row is a finding — usually a member that belongs to the set);
  (3) `apply`, `eslint --fix`, `npm run lint:client`; (4) the console guard specs (`tests/console/**`) — a
  source-scanning spec that looked the member up in the shell is pointed at the controller in the same diff;
  (5) what the domain registers in the shell's hooks moves into the controller's own `onMounted` /
  `onBeforeUnmount` by hand (the viewer's input-absorber gate is the example). Watchers stay (their order is
  load-bearing) until the domain's lifecycle is a machine.
  **Two things the first build taught (both now refused by the tool or said in the rule):** (a) a `.ts` module
  cannot import a NAMED export of a `.vue` file — `vue-tsc` lets it through and the production build's checker
  (plain tsc, the shim) fails it; the types the shell shares with its SFC children moved into sibling
  `<component>Types.ts` modules (the SFC re-exports them), and a `$refs` answer a controller reads is typed by name
  (`HandTransitionTargets`), because plain tsc sees a `.vue` instance as `any`; **run plain tsc on `src/**/*.ts`
  (≈ 30 s) or `npm run build` before calling a shell slice green.** (b) A new dependency in `package.json` is not
  installed in a clone that shares nothing with yours — the mirror tree collected ZERO tests on a missing `xstate`.
  **Done on:** the card viewer, milestones / awards, the action wheel, the board cell, Information Mode, the
  conversions, the player rail, the journal, the surface shade, the notice. **Not done here, and why:** the region
  components — a template block reads members of several domains by bare name, so cutting it out is only mechanical
  once its surface has an entry of its own (S3 gives every surface one; the block then moves with it); the boot
  curtain and the test seams the map listed are rows of the shell's `mounted`, not members — they move with S1.
  **The ratchet («the shell may only shrink») is a guard since the mechanical half landed**
  (`tests/console/shellControllers.spec.ts` — bounds on the shell's data fields, computeds, methods, watch rows and
  lines; and «every watch row only delegates»): a new member of the shell is a domain member in the wrong place.
- **S3 — the surface registry.** The three ladders become one ordered table; each branch moves to its surface's
  entry with its condition verbatim. The pad path stops using `$refs`: a surface registers its handler while mounted.
  **First step done — the router no longer vouches for a surface that is not there.** The ladder decides who owns
  the pad from the game's state and reaches the surface through a ref; all 25 dispatches read
  `ref?.handleIntent(intent); return true` — a press routed to a surface whose node was not mounted was reported
  TAKEN, so the deaf screen was invisible to the liveness arbiter (it judged it only later, as «presses that change
  nothing»). They go through `handedTo(surface, name, intent)` (`padRouterController.ts`): the intent is still
  consumed (nothing may act under an owned pad), the verb is counted DROPPED (`inputEcho.noteUnreceivedPress` →
  `verbDropped` — the arbiter's existing deaf-screen evidence), and the surface is named once
  (`[pad] «…» owns the pad and is not mounted`). This is the typed FACT the registry will make unnecessary: with a
  surface registering its handler while mounted, «owns the pad» and «is there to receive it» are one thing.
- **S4 — the prompt router.** Admission and the ownership trios as one controller; the screen director's
  `expectedScreenOwners` table becomes the router's own table (the shadow has nothing left to compare against).
  **Where «set aside» (inventory A2) stands, for whoever takes S4** — now that its writers are in named files:
  `consoleState.task.deferred` is ONE boolean for the whole console, set at 5 sites (`mandatoryController.deferShellTask`,
  `routerController` — the task's own B, `workspaceController.parkWorkspaceStack`, `placementController.deferFinalGreenery`,
  one row of the shell's view-apply) and cleared at 25 (colony 6, router 4, mandatory 3, parliament 3, …). Every
  surface's `v-if` carries `!deferred`, and the way back is the board-home card, shown by
  `mandatoryController.mandatoryDeferredActive` = `deferred && (a MINIMIZABLE task of one of four families is live ||
  the start serves || the stack is parked) || a collapsed finale`. The soft-lock class is the gap between the two
  halves: `deferred` true (so the surface is hidden) while no family claims the question (so there is no card) — a
  family the predicate forgot (the dedicated composites, 2026-10), or a flag left standing from an EARLIER prompt
  (it has no identity: nothing says WHICH question was set aside). The by-construction form is not a better
  predicate but a different datum: «set aside» is a record `{what: the question's `promptIdentityKey` + promptId | the
  parked stack | the start | the finale}` owned by the question's scope — it cannot outlive its question (no clear
  sites), and the card is shown for the record itself (no family list). Until then the wait graph's `deferred-restore`
  door is the net.
- **S5 — conclusion as a join.** Owed steps become children of the frame's scope (declared at the press that owes
  them); the conclusion is decided by level over the scope; the owed-conclusion apparatus is deleted.
  **Done — the owed conclusion** (`console/workspaceConclusionOwe.ts`). A flow reports its ending once and the one
  guarded conclusion may refuse on a transient hold; the ending is then owed. It was a mailbox — ONE field for the
  whole console (a second workspace's debt overwrote the first), re-driven by a watcher over `owedConclusionSignal`,
  a hand-written string of the hold's ingredients that had to be kept in step with the decision and lost a term every
  few weeks (the board-beat park's drain, the chairmanship, the hidden scene, wait-graph inventory W7), with a
  truth-witness time net re-asking every half second for the terms still missing and a wait-graph door behind that.
  Now: (1) **the decision has ONE facts object** — `conclusionFacts(kind)` in the outcome controller is handed to the
  policy (`workspaceConclusionFor`) AND, as a key, to the run (`conclusionFactsKey` adds what the claim's reconcile
  reads); a hold the decision gains is a fact the wake has, by construction; (2) **the debt is a run in the FRAME's
  scope** — one per frame, gone with the frame from any of its three homes, never «gone» to detect; (3) it is
  **re-asked when its facts' key differs from the one it was last refused with**, by ONE row of the shell's watch
  table (`owedConclusionFacts` → `reaskMovedConclusions`, where the signal's watcher stood), and **bounded** by its
  own cadence (500 ms after a 2.5 s grace, only where the hold is not the player's own time); (4) **the escalation
  is the run's** — the same 8 s + 2.5 s continuous ghost confirm, then the owner's force path; (5) an ending the
  CADENCE made is NAMED (`[workspace-conclusion] … on the re-ask cadence` — a term of the decision that is not
  reactive, harvested by the e2e harness). Spec: `tests/console/workspaceConclusionOwe.spec.ts` (each old failure
  shape as a path that ends).
  **THE LESSON OF THIS SLICE — WHEN in the tick a decision is asked — cost two runs on the box and no unit spec shows
  it.** The facts of a conclusion move in TWO steps inside one tick: the owed step's door falls (`owedStep: false`)
  and a reaction of the shell then pushes the step's frame (`nested: true`); between the two the decision reads
  «nothing holds». The wake was first taken OFF the watch table, onto the kernel's reactive wait: (a) as a pre-flush
  watcher of no component — Vue 3.5 queues such a job BEFORE every component's watchers — it asked between the two
  steps and closed the hand under its own colony step (`console-multi-effect-sequence`, 2 red); (b) post-flush, it
  asked after the RENDER, so the conclusion's DOM came a patch late and the Pluto trade's closing beat split the
  workspace (`console-colony-pluto-embed`, 1 red). The right place — after the reactions the same write woke, before
  the render — is a watcher OF THE SHELL, among its own. So the wake is a row again (same place, same shape as the
  signal's), and what changed is only what its key IS. **For every later slice:** a reaction that leaves the watch
  table must be given its place in the tick explicitly, and the kernel has no primitive for «the end of the shell's
  pre-flush» yet — that is a piece of S-last (the session owning the tick: one ordered pass of decisions per flush),
  not something to improvise per reaction. Until then: a decision that ACTS stays a row; the kernel's `until` (sync)
  is for waits that only record.
  *Still open in S5:* the owed STEPS (`followUpStepOwed`, `hostedStepOwedTo`, `politicalDiscardOwed`, `lawStepOwed`
  — each a computed over module state today) as children of the frame's scope declared at the press that owes them,
  which turns `conclusionFacts.owedStep` into «the frame's scope has a live `step` child»; the stale free-turn
  reaper (`reapStaleFreeTurnFrame`) and `stuckWorkspaceIsGhost`, which need that to be decidable by structure.
- **S6 — the domains, the MECHANICAL half (done).** With the watchers delegated (S2) every remaining member of the
  shell was assigned to a domain — seeds by name, then affinity over the `graph` (who reads whom) — and taken out
  with the tool, in one reproducible pipeline (pristine shell → hand preps → `delegate-watchers` → `lift` of the
  shared module-level types / constants → `apply` × 33, imports kept whole until the last step → `prune`). The shell
  keeps: the template, `setup()` (the composition root: the session, the 33 controllers), the mirrors of module
  state in `data()`, the `watch` table, `mounted` / `beforeUnmount`, and a handful of one-line verbs. The view-apply
  reaction (`whenPlayerViewChanges`, 450 lines — what the shell does when a new view is applied) is a controller of
  its own, `viewApplyController.ts`, and **its port is a finding**: 31 rows, TWELVE of them written without being
  owned — one reaction that resets seven domains' «pending» latches on every view (`pendingPlayCard`,
  `pendingClientPick`, `taskSpacePending`, `commitFoldOwed`, `finalGreeneryPickPending`, `stdProjectPickResponse`,
  …). Each is a latch that should end with its own flow; the reaction shrinks by rows as they do (S4 / S5).

  **The dependency matrix the monolith never had** (members · lines · PORT rows — W = rows the domain writes without
  owning). A port is everything the controller reads of the rest of the shell; the big ones ARE the knots, by number:

  | Controller | Members | Lines | Port | | Controller | Members | Lines | Port |
  | --- | --- | --- | --- | --- | --- | --- | --- | --- |
  | `padRouter` (`handleIntent` + the section / sheet ladders) | 18 | 2374 | **150** (W4) | | `commandBar` (`commands`, `commandContext`) | 9 | 1638 | **108** |
  | `router` (admission, the task trios, the effect decision) | 68 | 1731 | **68** (W2) | | `hand` (dock, album, presence) | 59 | 1411 | **58** |
  | `outcome` (claim serving, conclusion, hosted steps) | 46 | 1567 | **54** (W10) | | `mandatory` (the plate, «set aside») | 31 | 921 | **46** |
  | `supervisor` | 22 | 978 | 39 (W5) | | `reveal` (reveals, deck pick, external draw) | 42 | 1067 | 39 (W2) |
  | `colony` | 124 | 2986 | 35 (W1) | | `placement` (board placement, final greenery) | 84 | 1532 | 31 (W2) |
  | `handSelect` (hand select / pick / discard / filters) | 75 | 1328 | 31 (W3) | | `parliament` | 80 | 1490 | 30 |
  | `playCard` (the play composer, the confirm sheet) | 36 | 941 | 27 | | `workspace` (collapse / park / sheets) | 19 | 546 | 25 |
  | `stdProjects` | 26 | 695 | 20 (W2) | | `hydro` | 67 | 1854 | 19 |
  | `played` | 17 | 371 | 19 (W5) | | `start` | 36 | 892 | 18 |
  | `wheel` | 11 | 269 | 17 | | `staged` | 15 | 552 | 15 (W1) |
  | `viewer` | 68 | 1108 | 12 | | `ma` | 42 | 743 | 11 |
  | `finale` | 13 | 273 | 11 (W3) | | `seat` (game, thisPlayer, myTurn, …) | 17 | 266 | 10 |
  | `journal` | 7 | 139 | 9 | | `cardActions` | 7 | 150 | 8 (W1) |
  | `info` · `cell` | 9 · 11 | 181 · 187 | 5 · 5 | | `rail` · `draft` | 7 · 12 | 113 · 181 | 4 · 4 |
  | `convert` | 7 | 76 | 2 | | `notice` · `surface` | 3 · 7 | 38 · 54 | 0 · 0 |
  | `viewApply` (the reaction to a new view) | 1 | 562 | 31 (**W12**) | | | | | |

  Read it as the work list of the next slices: **S3** is `padRouter` + `commandBar` (258 rows between them — two
  ladders asking the same ~100 facts in two orders); **S4** is `router` + `mandatory`; **S5** is `outcome` (the W10 are
  the owed-conclusion mailbox and the claim's serving flags). The coarse domains (`colony` 3k lines, `hydro`, `hand` /
  `handSelect`) are internally cohesive by the graph but large: they split further only when their lifecycle becomes a
  machine — a split by line count would cut a flow in two.

  **How a controller reads a sibling**: through its port, typed off the sibling (`UnwrapRef<ColonyController['x']>`)
  and reached through the shell instance (`shell.x`) — one indirection, lazily, so construction order in `setup()` is
  free. The session wiring ports directly (no instance in between) is S-last: it needs every row to be an explicit
  import first, which it now is.

  **What the mechanical half does NOT do** — and must not be mistaken for: the watchers are still edge mailboxes
  (they only moved), the latches are still latches, `$refs` is still the pad path. Nothing here retires a net. It
  makes each of those a property of ONE file with a stated port, which is what S3 – S5 need to be redesigns rather
  than excavations.
- **S6… — the domains, the LIFECYCLE half.** Per domain: its watchers and latches become machine states / scoped
  runs in the frame's scope. Order by freeze history: colonies and hydro first (most mailbox fields), then the hand,
  then the phase scenes.
- **S-last.** `ConsoleShell.vue` is layout: the regions, the session's provide, no `watch`, no lifecycle logic.

### Phase 3 — stories and directors

Animation holds as scoped runs (`scope.hold`, the supplier form for a flow whose state is a machine), the board-beat
park and the ledger stories as `story` scopes with declared waits (`WAITS_ON.story = ['frame' (leaving), …]`), the
screen hand-over as a wait on the table instead of a reasons list, then the directors' runs (start, sitting, quest,
walk, rally, generation scene, finale) — each run keyed by its own scope.

### N1 — native rendering stalls (independent of the phases) — diagnosis DONE

- Renderer: a `PerformanceObserver` for `long-animation-frame` → one field-log line per long frame with its split
  (blocking duration · script time with the top script's source · style-and-layout time · render start → end), so a
  stall that returns to JS says where the frame went; a frame whose scripts are a small share of it is `native`.
- Main process: on `unresponsive`, `contentTracing` records (categories: `devtools.timeline`, `blink`, `cc`, `viz`,
  `gpu`, `disabled-by-default-devtools.timeline.frame`) until `responsive` or the watch's reload, the trace is saved
  beside the logs and named in the hang line; a rolling short trace can be armed from «Диагностика» for a field
  repro. Then: reduce what the first traces name.

## 6. The nets — which retire, when, and why

A net retires in the slice that makes its defect inexpressible for the code it covered; until every caller is on the
kernel, a net that still covers legacy code stays, and the table says what it still covers.

| Net | Retires with | Because |
| --- | --- | --- |
| R11 «second submit dropped» (a warn) | L1 | a submit without a ticket cannot be made |
| liveness rung `transport` (22), `submitCeiling` | L1 | the funnel's states are bounded by the machine |
| the refusal battery's omissions | L1 | every submit settles on the broadcast |
| beat-stall guard (stack frames) | L2 | a beat state has its bound |
| `[workspace-anchor] reaped`, the dead-phase reaper | L2 (+S6 for the phase owners) | a phase root's frame is a child of the phase's scope |
| orphaned-claim release, `claim-safety` re-arm, liveness rung `workspace-outcome` (20) | L3 | the claim is a child of its host; its states are bounded |
| wait-graph doors `announce-serve` / `deferred-restore` (A1, A2) | L4 | `pending` is bounded; «set aside» has its card by construction |
| the hand-written owed-conclusion signal, `retryOwedConclusion`, the truth witness `workspace-conclusion-owed`, the single-slot mailbox | **retired (S5)** | the debt is a run in the frame's scope, re-asked on the key of the decision's own facts object (one row of the watch table), bounded by its own cadence |
| the ghost test + forced teardown of an owed workspace, the stale free-turn reaper | S5 (owed steps as scope children) | still a net: «nothing the player could act on» is sampled, not structural, until the owed steps are children of the frame |
| the router vouching for an unmounted surface (a press reported taken that nobody received) | **retired (S3 · first step)** | `handedTo` says it: dropped, and named |
| the three-ladder lock-step | S3 | one table |
| screen director shadow, start director shadow, leak detector's stranded check | S4 (+ the start scene's controller) | the router's table is the mechanism |
| ceiling-wait guard, wait-graph observer + its adapters | when the last adapter's source is on the kernel | the wait table is the graph |
| motion witness, hold-expire ratchet, foreground watchdog | Phase 3 | a hold is a scope |
| reactivity witness | stays (dev / test) | it checks legacy predicates; kernel state is reactive by construction |
| **liveness arbiter** (the player-side judge + a short ladder) | **stays — the one supervisory layer** | it judges what no structure can: a screen the player presses into that does not change |
| field recorder, console export, hang watch | stay, and read the kernel's trace | diagnosis |

## 7. Tests that prove «done»

- `tests/console/kernel/*.spec.ts` — scopes (end order, exactly-once, failure containment), waits (bound required,
  cycle refused at insertion, cancel on owner end), the property suite.
- `tests/console/kernel/flowLaw.spec.ts` — the DAG of `WAITS_ON`; every registered machine passes the law (tags,
  bounds, no trap, rest reachable). A new machine that is not registered fails a static guard (like
  `waitGraphLaw.spec` today).
- per lifecycle: the machine's spec (every field case of §2 of the brief as a path that now ends), a model-based
  spec, and the facade's existing specs unchanged and green.
- the existing guard specs stay green or are replaced in the same diff by the stronger form (listed per slice in §9).
- the shell's structure: `tests/console/shellControllers.spec.ts` (one member, one owner; no template ref named like
  a member; every controller constructed and spread; every port conformed; no named import from a `.vue`), and
  `tests/console/shellSource.ts` — the source guards read the shell's code as ONE corpus (the SFC and its controllers,
  in the monolith's dialect), so a guard keeps its teeth when a member moves.

## 8. Risks

| Risk | Mitigation |
| --- | --- |
| No e2e during the work; the suite is 565 specs. | Facades keep every exported function, every `data-*` hook, every log marker the harness reads; behaviour changes are confined to failure paths (bounds, refusals) wherever possible; pointwise laptop runs of the spec nearest to a slice; §9 lists what each slice could have moved. |
| Other sessions edit `ConsoleShell.vue` daily. | Own worktree; small slices; mechanical moves are re-runnable (the codemod is re-applied on a fresh `main` instead of merging a moved block by hand). |
| Watcher order and flush timing are load-bearing. | Watchers are not moved by the codemod; a domain's watchers change only when its lifecycle becomes a machine, one domain per slice. |
| Two systems at a seam. | One writer per fact: the machine writes, the legacy record is its mirror; never the reverse. |
| XState in the hot path. | Machines are per lifecycle run (a handful alive at once), events are per press / per response — nothing per frame or per tick is added; the kernel's table is touched only when a wait begins or ends. |
| A bound that fires in a slow but healthy run (CI's software renderer). | Bounds are the existing ceilings (same numbers) re-expressed; a bound that ends a healthy run is a named line (`[flow] bound …`), red in e2e like today's ceiling lines are harvested. |

## 9. Specs to look at first in the CI run (running list)

| Slice | What moved | Specs |
| --- | --- | --- |
| (baseline, not a slice) | `console-colony-pluto-embed` :329 is RED ON `origin/main` at 2ae0fde320 on the box — 5 of 10 repeats, «[workspace-stale] concluded «colonies» — it stood committed over the free turn 9s … its flow did not end itself» (the stale free-turn reaper concluding the colonies under the trade's closing beat — the open item of CI run 42998242617). With the coverage commit on top: 1 of 4. Read a red there as the reaper's race, not as the trade's run | `console-colony-pluto-embed` |
| C4 (the rest) · C1 (the rest — the whole client) · C3 (the registries) · C5 (the teardown) | **every remaining timer / frame / `delayedCall` under `src/client` is an owned wait** (the same spans; some four hundred sites in ~190 files). What that moves: a COMPONENT's timers and frames are taken back at its unmount (was: fired into the dead instance unless a `beforeUnmount` cleared them by hand — the lists are gone); a MODULE's releases come due at their time OR when the game screen leaves (was: fired later, into the next game); every bare-frame await inside a measure / stability loop is `whenPainted(1, 50)` (bounded: a loop counted in frames runs out on a quiet compositor instead of standing — the start scene's queue stability and front anchor, the played overlay's and the receiving stage's stability loops, the zoom modal's landing measure, the viewer's `tryOpen`, `settledRects`); the Parliament's beats (`scheduleParliamentBeat`) are guaranteed releases of the session on GSAP's clock (same time; they also come due when the game screen leaves); the hand reveal's paint-locked driver is `everyFrame` + a re-arming watchdog (40 ms + the step, was a fixed 40 ms interval); the transport's poll is a guaranteed release of the transport's scope and the tab-title spinner an owned tick; the lobby, the campaign channel, the realtime service / sync / poller, the boot loader and the layout profile are the PAGE's (`consoleAppScope()`); `ConsoleFlipValue` emits `flip-end` when it leaves mid-flip (was: dropped — the generation scene then waited out its net); the trade layer's wave read ends only the wave it read (nonce) and is released with the layer; a `[wait-graph] ceiling` wait and an owed ledger story END WITH THEIR SESSION (was: stood on, and could be re-driven into the next game); the picks (hand / play / repeat / delta ×3 / blockade / prelude chain / played-cards), the Parliament's walk · rally · quest, the action commit, the card return, the track move, the finale session, the board's story, the terraformed scene and the start-setup reveal are RUNS — a run still standing when the game screen leaves is brought to rest by its own reset; **the shell's `beforeUnmount` is one ordered pass** (`leaveConsoleSession()` — the same resets in the same order, but AFTER the shell dropped all of its own probes / suppliers / leases, which used to be interleaved with them, and a reset that throws no longer aborts the rest); a component's scope is parented by the component tree and opened lazily | ANY console spec — like S6, this is a round a wholesale regression would come from. Pointwise on the box before the push (131 files across every domain — `tm-arch-tools/r6-specs.txt`: 301 functional + 104 timing tests): green, `console-colony-pluto-embed` among them. The surfaces with the most converted sites first: the START scene (`console-start-*`, `start-*`, `console-firstact-*`), the DRAFT (`console-draft-*`, `draft-finale-probe`), the hand and the reveal (`console-hand-*`, `hand-*-probe`, `console-reveal-*`, `console-standalone-reveal`), the played table and its category view (`console-played-*`), the composer (`console-action-*`, `console-blue-action-*`, anything with a ledger payout — `console-colony-pluto-*`), the colonies' trade layer and focus stage (`console-colony-*`, `trade-fleet-probe`, `console-colony-venus-trade-unity` / `console-parliament-unity` — the track WAVE), the hydro section's result hold (`console-hydro-*`, `console-delta-*`), the board section's framing and the cell binder's availability wave (`console-board-framing`, `console-placement-*`), EVERY Parliament spec (the beats; the section's two nets; the leave net — `console-parliament-leave`, `-sitting-*`, `-chairman-quest*`, `-announce`, `-into-draft`), the MA screen and ceremony (`console-ma-*`), the endgame workspace / overview and the shared reveals (`console-endgame*`, `console-finale-*`, `console-final-greenery*`), the campaign map / picker / tenders (`console-campaign*`, `console-tenders-*`, `console-carryover-album`), the lobby and the menus (`console-campaigns-list`, `console-profiles`, `console-system-menu`, `console-pregame-showcase`, `console-scene-transition`), the boot (`start-scene-profiles`, the storyboard class), anything multiplayer / bot (the realtime channel, the staged commits: `console-bot-*`, `console-start-multiplayer`, `console-parliament-sitting-v2-remote`), the status strip and the rail (`console-chip-conveyor`, `console-rail-*`, `console-status-material`), the cursor's gates (`console-cursor`, `console-smoothness`), and whatever leaves a game and enters another (`console-campaign-endgame`, `console-gamepad-reload-carryover`). New lines a harvest may show: `[flow] … the session state «…» threw in its reset` (a reset that used to abort the teardown silently), `[flow] … the withdrawal of «a Parliament beat» threw` (a beat released into a surface that left — it used to throw inside GSAP's ticker) |
| C0 · C2 · C4 (seventeen flows) · C1 (first sweep) | every animation hold opens a kernel scope at its rising edge and its 35 s ceiling is a kernel timer (same span, same warn, same recovery); a hold a NET ends no longer runs its recovery a second time at 35 s; **when the shell is unmounted every hold still standing is ended through its `expire`** (was: left to its ceiling); the shell opens a session OF ITS OWN in `setup()` and ends that one (was: «the current one»); `raceCeiling` is a kernel wait (owner-bound: over when its owner ends); the colony roster / city / build / trade / track wave / track raise, the trade fleet, the patent sale, the hydro marker, the tile placement, the remote placement stage, the nomad move (both legs), the board card bonus, the deck draw, the card discard, the played hero, the energy conversion and the hazard cleanup keep their timers in the run's scope — same spans, but a beat's sleep is over AT ONCE when the run is aborted (was: resolved later, into a run that had ended), a frame poll is bounded on the clock (the patent sale: 50 ms per frame; the discard's wait for its pile: frames' worth of time — was a count of painted frames), and a mark that outlives its flow (the docked glow, the settled stop, the wave's landed cells) is cleared at the session's end too; **every `await` of two bare animation frames is `whenPainted()` — it resolves after 400 ms when nothing paints (was: never)**; a director's safety is a guaranteed release (same budget; it also comes due when the game screen leaves); `probeTick` is an owned frame + a guaranteed 50 ms fallback, and sixteen measure polls that rode a bare frame ride it now (a poll counted in frames is bounded on the clock) | `console-nomads-*` / `zz-nomads-visual`, the specs with a second seat or the bot (`console-bot-*`, `console-colony-remote-bonus`, `console-reveal-remote-bonus-collision` — the remote stage), `console-played-*`, `console-hydro-*`, `console-delta-surge`, `console-placement-*`, `console-final-greenery*`, `console-tile-*`, `console-deck-draw`, `console-card-discard`, `console-start-*` / `start-*` (the start scene's eight frame waits), `console-played-*`, `console-colony-build*`, `console-colony-roster*`, `console-colony-city*` / `console-nova-city*`, `console-colony-trade*`, `console-colony-pluto-embed`, `console-patent-sale*`, `console-standard-projects*`; anything that leaves the game and re-enters (`console-rematch*`, `console-finale*`, `console-campaign*`); the mechanism specs (`console-multi-effect-sequence`, `console-play-scale-conclusion`, `console-wait-graph-*`) |
| S6 · tidy | the view-apply reaction is a controller (`viewApplyController.ts` — the body of the `playerView` watch row, verbatim); `game` moved from the milestones / awards controller to the seat's (it had landed there by affinity); the shell's size is a ratchet | none expected — the same code, one call deeper |
| S3 · first step | a press the router hands to a surface whose ref is not mounted is counted `verbDropped` (was: taken) and warns `[pad] … is not mounted` once — harvested by the harness, never red by itself; the liveness arbiter may now judge such a screen at once | a spec that presses A / B INTO a surface before it has mounted (it was a silently lost press before; now the echo says so): look for a new `[pad]` line in the stall harvest and a `[liveness] stall (presses-dropped…)` that was not there |
| S5 · owed conclusion | a refused ending is re-asked when the decision's FACTS move (was: when a hand-listed signal moved) — by a row of the watch table in the place the signal's row stood (the same moment of the tick); where only the claim's reconcile could unlock it, on the facts it reads or on the 500 ms cadence after a 2.5 s grace (was: on every ingredient edge); the `[presentation-ledger] witness «workspace-conclusion-owed» healing` line is gone, `[workspace-conclusion] … on the re-ask cadence` says a cadence-made ending | every flow that ends through `concludeWorkspaceFlowOrOwe` while something still holds: `console-play-scale-conclusion`, `console-hi-tech-lab`, `console-viron-repeat-draw`, `console-deck-pick-collapse`, `console-blue-action-purchase` / `-receive`, `console-parliament-chairman-quest`, `console-parliament-actions`, `console-reds-campaign`, `console-colony-pluto-embed`, `console-pluto-bonus-discard`, `console-hydro-copied-tile`, `console-delta-surge`, `console-wg-play-from-hand`, `console-start-sponsor`, `console-one-framework-draw`, `console-multi-effect-sequence` |
| S6 · mechanical | every domain's members are setup-state of the shell (same names; the template, the watch table and the hooks unchanged); the series' input gate registers in the pad router's `onMounted` (a setup hook runs before the shell's `mounted`); `COPIED_ACTION_STANCES['deck-check'].file` names the reveal controller | ANY console spec — this is the slice a wholesale regression would come from. Pointwise on the box (63 files across every domain — the list is in the commit): green. Look first at whatever mounts late or reads a `$refs` instance: the hand album's transition targets, the Parliament's leave, the colony roster's ceremony |
| S1 | the four flow trees hang under one `session` root that ends on the shell's `unmounted` (was: four roots that lived for the page); the supervisor's start / stop are two calls in the same hook rows; nothing else moves | `console-wait-graph-control`, `console-wait-graph-dead-end`, `console-screen-director-cure`, `console-screen-shadow-control` (the control stand's `declareDefect` goes through the supervisor), anything that leaves a game and enters another (rematch, campaign thresholds) |
| S2 · watchers | every watcher is `key(v) { this.when<Key>Changes(v); }` — same order, same options (`immediate` / `flush` / `deep`), the body one call deeper | none expected (pointwise: hydro, colonies, hand, draft, generation scene, std projects — green) |
| S2 | ten member sets of the shell are setup-state now (same names, same template): a `data` field became a `ref`, an options `computed` a `computed()`; the viewer's input-absorber gate registers in the controller's `onMounted` (a setup hook runs BEFORE the shell's own `mounted` — it was the second row of it) | the card viewer (`console-played-zoom-return`, `console-inspect-history`, anything that presses X on a card), `console-ma-workspace` / `-price` / `-states`, `console-info-*`, `wheel-rework`, `console-convert-plants-source`, `console-journal-chronicle`, `console-cell-dossier`, `console-rail-*` |
| L4 | a beat pending 15 s runs the plate's door from the machine (was: the wait graph's overdue finding after 3 more ticks, and only when no frame stood on top); nothing else moves | `console-parliament-announce`, `console-parliament-aquifer`, `console-pluto-bonus-discard`, `console-external-draw`, `console-bot-attack`, `console-corp-first-action`, `console-screen-director-cure` (the blind announce's beacon), `console-draft-workspace` |
| N1 | a `[long-frame]` warn line per ≥ 500 ms frame (rate-limited) — harvested, never red | none expected; a spec that asserts «no console.warn at all» would see it |
| L3 | the claim's timers are machine states (same numbers); an orphaned claim is released exactly 1.5 s after its host's last frame ended (was 1.5–2.5 s, sampled); the arrival gate of a claim that never got an answer opens at 20 s | `console-hi-tech-lab`, `console-wait-graph-dead-end` § orphaned claim, `console-hydro-copied-tile`, every embedded draw / pick / verdict (`console-viron-repeat-draw`, `console-deck-pick-collapse`, `console-start-sponsor`, card-actions specs) |
| L2 | every frame verb now also opens / ends scopes; the phase is written through a machine (same value, same call); a frame whose press did not land goes back by the lease (after the surface's own rollback); a beat standing 180 s on stage is ended | anything with park / restore / yield for the board (`console-hydro-copied-tile`, `console-hi-tech-lab`, `console-workspace-stack*`, `console-start-sponsor`, `console-mu-colony-question`), a refused submit inside a workspace (`console-resource-distribute`), reload restore (`console-draft-workspace`) |
| L1 | the funnel: every gate now runs as a child scope (a few microtasks later than a bare `await`); a gate that throws no longer aborts the whole answer; the supervisor's release ends the gate instead of lowering the flag | any spec that plays a card / trades / advances the hydro marker / converts / places a tile — pointwise check on the box: `smoke`, `console-workspace-band`, `console-stdp-workspace`, `console-colony-venus-trade`, `console-hydro-terminal-field`, `console-generation-scene`, `console-hand-play-return`, `console-hazard-placement` |

---

## 10. Coverage — «the whole console on the framework» as a number

*The owner, 2026-11-11, after the green CI run of the shell's decomposition: «идти дальше по плану и делать 100 %
покрытие всего консольного UI новым фреймворком».*

### 10.1 What «covered» means

A piece of the console is on the framework when **nothing in it has a lifetime the kernel does not own, and nothing in
it waits outside the wait table**. Five things in the source are not that, and each can be counted:

| | Outside the kernel | On the kernel | Count at the start (2026-11-11) |
| --- | --- | --- | --- |
| ① | a raw `setTimeout` / `setInterval` — a callback nobody owns: it fires into whatever stands there by then, and a release that rides it does not happen when it is cleared | `scope.after(ms, what, run)` · `scope.sleep(ms)` — taken back when the owner ends, a row of the wait table until then, on the kernel's clock | **373** in 163 files |
| ② | a raw `requestAnimationFrame` — the same on frames; an `await` of one never resolves in a window that does not paint | `scope.afterFrame(what, run, n)` · `scope.wait(frames(n), {bound})` | **137** in 63 files |
| ③ | a GSAP `delayedCall` used as a timer | `scope.after` | **36** in 23 files |
| ④ | a FLOW-STATE MODULE (reactive state with a `live` / `active` flag — the wait-graph law's definition) whose run is a flag every exit path lowers by hand, with its own timer ids | its run is a scope: `createFlowRun(label, {orphaned})` (`scene:<label>#n`) — or the hold it stands under when the two are one life (`beginAnimationHold(…).scope`) | **35** modules |
| ⑤ | a row of the shell's `beforeUnmount` that takes module state down by hand (`resetX()` / `abortX()` / …) | nothing: a flow opened in the session ends with it (`orphaned` is its abort) | **66** rows |

Plus the two registries the nets read, which are covered when they are VIEWS of the tree rather than second books:

| | | |
| --- | --- | --- |
| ⑥ | the hold registry (61 suppliers, 18 handles) | **done (C2)** — every hold is a `scene:hold:<label>` scope; the registry's store is its reactive mirror |
| ⑦ | the legacy wait graph's hand-fed sources (`registerWaitSource` ×10, `declareWait`, `beginCeilingWait` ×55, `owePresentation` ×8) | open (C3) — each becomes a kernel wait / scope; the observer then reads `waitTable()` through one adapter |

**The ledger** is `tests/console/kernelCoverage.spec.ts` over `tests/console/kernelCoverageBaseline.json`: per file,
what still stands outside; a file may not grow and **a new file starts at zero** — new console code is on the kernel by
construction, without anybody reviewing for it. `npm run coverage:kernel` rewrites the baseline DOWNWARDS (it never
raises a row) and prints the totals. **100 % = the baseline is empty.** Quote its line in every slice's report.

### 10.2 The primitives (what C0 added to the kernel and beside it)

| Need | Primitive | Where |
| --- | --- | --- |
| a callback later, owned | `scope.after(ms, what, run)` → cancel | `kernel/flowScope.ts` |
| a callback on a frame, owned | `scope.afterFrame(what, run, count?)` → cancel | same |
| a frame LOOP, owned | `scope.everyFrame(what, tick)` → stop (`tick` returns `false` to end; one row for the loop's life) | same |
| a release that cannot be lost | `scope.guarantee(ms, what, release)` → disarm (called at `ms` OR at the scope's end) | same |
| a condition re-read on the clock | `polled(what, read, everyMs)` (a target) · `untilCeiling(spec, read, owner?, everyMs?)` (with its ceiling line) | same · `waitGraph/ceilingWait.ts` |
| «two painted frames» · «a beat» | `whenPainted(n, boundMs, owner?)` · `span(ms, owner?)` | `session/sessionWaits.ts` |
| a measure loop's tick | `probeTick(fn)` — an owned frame + a guaranteed fallback | `console/probeTick.ts` |
| await a span / frames | `scope.sleep(ms)` · `scope.wait(frames(n), {bound})` | same |
| a component's own scope | `useFlowScope(label)` in `setup()` — ends on unmount | `session/useFlowScope.ts` |
| a module flow's run | `createFlowRun(label, {orphaned})` — `begin` / `end` / `after` / `afterFrame` / `sleep` / `live()` | `session/flowRun.ts` |
| «whose is a flow opened now» | `consoleSessionScope()` — the game session, else the lobby | `session/consoleSession.ts` |
| a module's own root | `sessionChild(held, kind, label)` — re-homed when the session changed | same |
| a beat under a hold | `hold.scope` (`beginAnimationHold` returns it) | `presentation/animationHold.ts` |
| a race against a ceiling | `raceCeiling(spec, promise, owner?)` — a kernel wait | `waitGraph/ceilingWait.ts` |
| the tree, from the page | `window.__conFlow()`; the heartbeat's `flow` (only in a second that stood still) | `session/consoleSession.ts`, the supervisor |

**The session has an identity.** `beginConsoleSession()` (the shell's `setup()`) opens `session:game#n`; the shell
ends THAT one on `unmounted` — a new shell's `setup()` runs before the old shell's `unmounted`, and the old one used
to end the root the new shell had just started to use. Beside it stands the LOBBY's root (`session:lobby#n`): what is
opened while no game screen is up (the menus, the campaign, a spec) belongs to it and is not ended by a game that
comes and goes.

### 10.3 The recipes

**A TIMER IS ONE OF TWO THINGS — decide which before converting it.**

- **PACING** — «do the next thing later» (a beat's step, a safety that aborts, a poll): `owner.after(ms, what, run)`.
  When the owner ends first the callback must NOT run — that is the point.
- **RELEASE** — «let something go later» (a promise somebody awaits, a gate's resolver, a flag of a mark that outlives
  its flow, a hold): it must happen even when the owner ends first, so it never rides a timer that can be taken back.
  `const disarm = owner.guarantee(ms, what, release)` — called once, at `ms` or at the owner's end; `disarm()` when
  the thing came by itself (the `setTimeout(finish, budget)` … `clearTimeout(safety)` pair of every director) — or a
  span that answers either way (`await owner.sleep(ms)`), or a cleanup of the owner (`owner.defer(release)`).

A conversion that turns a release into a pacing timer creates the wedge the framework exists to remove; one that
turns a pacing timer into a span lets a dead flow act. (`consoleTradeFleet.ts` has one of each and one of the third
kind: a mark that outlives its flow by design — the docked glow — is the SESSION's span, guarded by a sequence number.)

**A module flow (④)** — `createFlowRun`:
1. `const run = createFlowRun('<label>', {orphaned: () => abortX()})` at module scope;
2. `run.begin()` where the flow starts (the arm, the seed) — a run still standing ends first, its timers with it;
3. every timer id + `clearTimeout` pair → `const cancel = run.after(…)` (or no handle at all when only the run's end
   takes it back); every `await wait(ms)` → `await run.sleep(ms)` (it is over AT ONCE when the run is aborted — check
   the flag after it, as the code already does); an `await` of a raw frame → `run.scope.wait(frames(), {bound})`;
4. `run.end()` on EVERY exit path — beside the line that lowers the flag (it is idempotent);
5. the HOLD STAYS DERIVED (`registerAnimationHoldSupplier(label, predicate)`): a hold computed from state cannot
   diverge from it, whoever writes the state — do not turn a supplier into a handle (a spec that pokes `state.live`
   and expects the hold is right; `colonyCity.spec.ts` caught exactly that);
6. its row in the shell's teardown goes when `orphaned` covers what the row did (state that is NOT the run — an arm
   waiting for its answer, a receipt — still needs its reset until that state is a scope of its own).

**A component (① ② in a `.vue`)** — `setup() { return {flow: useFlowScope('<label>')}; }`, then `this.flow.after(…)`.
The `beforeUnmount` list of `clearTimeout`s goes. A release the component owes (a hold, a module flag) is
`this.flow.defer(() => …)`.

**A polling wait with a ceiling** (`beginCeilingWait` + a frame loop + a deadline) —
`scope.wait(until(what, read, {polledMs: 16}), {bound: {ms}})`: the condition, the poll and the bound are one row.

### 10.4 The order

| Step | What | State |
| --- | --- | --- |
| **C0** | the ledger; the session's generations; `after` / `afterFrame` / `frames`; `useFlowScope`; `createFlowRun`; the tree in the field record | **done** |
| **C2** | every hold is a run of the tree; it ends with its session | **done** |
| **C4** | module flows, family by family — every family of the list this row used to carry | **done** (④ = 0) |
| **C1** | timers and frames outside the flows — the idioms by codemod (`tm-arch-tools/c1_*.py`), then per site: the console's modules and components, the shell controllers, then the shared layer under the console (`src/client/components/**`) | **done** (① ② ③ = 0; two device clocks declared) |
| **C3** | the registries as views: holds ✓ · ceiling waits ✓ (a row per wait, at the primitive) · ledger stories ✓ (`story` scopes) · the wait-graph observer on `waitTable()` — with C6 | the three registries: **done**; the observer: open |
| **C5** | the shell's teardown: every row is a `sessionState` declaration of its module; the shell calls `leaveConsoleSession()` | **done** (⑤ = 0) |
| **C6** | the shell's own open items — §0's list 1 – 5 (owed steps, the prompt router, the surface registry, the lifecycle half, ticket-first arming) | open |

Every step ends with: vue-tsc + plain tsc + eslint, `tests/console/**`, `build:test`, the unit suites, `npm run build`,
the pointwise box e2e of the family plus the mechanism specs, `npm run coverage:kernel`, the ledger's line in the
report, §0 / §9 here updated.

### 10.5 What the first round taught

- **A hold derived from state is the stronger form — keep it.** The first cut made the roster's and the city's hold a
  handle opened in `begin()` and released in `end()` («the hold IS the run»). `colonyCity.spec.ts` sets `state.live`
  and expects the hold: with a handle, state and hold are two things that can diverge; with a supplier they cannot.
  The run is for what state cannot express — who owns the timers, and what ends when the session does.
- **A session end is a ceiling.** A supplier still true when the game screen leaves is masked and its `expire` runs,
  exactly as at 35 s — but now, not half a minute into the next game. A handle still held is dropped the same way.
  Neither is a warn: leaving a game mid-scene is not a leak (the trace says `cancel … still held when its session
  ended`).
- **`await` of a raw frame is a hang in a window that does not paint.** The patent sale's two polls re-read their
  deadline only after a frame; the kernel's `frames()` under a 50 ms bound re-reads it either way.
- **A release needs its own primitive.** The first conversions wrote releases as `void owner.sleep(ms).then(release)`
  guarded by a sequence number. `scope.guarantee(ms, what, release)` says it in one call (at `ms` OR at the owner's
  end, once; `disarm()` when the thing came by itself) — and that made the director's safety pair, the commonest raw
  timer in the client, a provable codemod: the callback is a bare `finish` / `done` / `resolve`, the handle is only
  ever cleared.
- **A scene safety whose callback opens the transport's GATE is a release, not a pacing timer** (`freeRunGate`): it is
  `run.guarantee`, so a run ended by a NEW arm opens the older gate instead of leaving it to the gate's own maximum.
- **`until` wakes inside the stretch that made its condition true.** The track raise waits for the standing wave to
  end and then plays its own: on `until` it would start in the very microtask train of the wave's `finish`, before
  that stretch had said what else changed. `polled` (the clock only) keeps the raise in a task of its own — the same
  lesson as «a decision that ACTS has a place in the tick», at the scale of one module.
- **The laptop is a valid pointwise runner when the box is off** (the owner's task-level permission): one spec per
  invocation, one worker, from the mirror's build — `tm-arch-tools/laptop-e2e.sh`. Functional specs only; a timing
  taken there is a verdict about the laptop.

### 10.6 What the second round taught (2026-11-11 — the ledger to zero)

- **A flag with many writers wants a DERIVED run.** The walk, the rally and the quest raise and lower their flags from
  a dozen places each (a reset, a refusal, a skip, the ceremony's end). `createFlowRun` would need a `begin` / `end`
  beside every one of them — the «every exit path must remember» the framework exists to remove. `deriveFlowRun(label,
  () => state.promised || state.live, {orphaned})` is a sync watcher that only records: the run cannot be forgotten by
  a writer, old or new. One writer → `createFlowRun`; many → derive.
- **A component's owner is read off the component TREE.** `useFlowScope` first asked «which session stands». An
  app-level layer set up while a game is on screen was then a child of that game's session: the game screen leaves,
  the layer's scope ends, every timer it arms afterwards is born dead — while the layer lives on. The shell now
  `provide`s its session and `componentSessionScope()` reads it: inside a shell → that shell's; outside any → the
  page's (`tests/client/console/useFlowScope.spec.ts`).
- **A setup binding shadows a member of the same name, silently.** `setup() { return {flow: useFlowScope(…)}; }` in a
  component that already had a `flow` computed (the Parliament section — its module's flow state) replaced it at run
  time; vue-tsc passed. The key is `flowScope` there, and the ledger fails on a collision (three components had a
  `flow` in `data()` and were named right by hand; one was not).
- **The teardown is ORDERED, and the order is worth keeping explicit.** A scene's abort recalls the scenes it staged
  (`abortColonyBuild` → `abortBoardCardBonus('return')` — a return FLIGHT, unless the bonus was aborted `'instant'`
  before it, as the shell's list did); the stack falls before the picks that pop their frames from it. Module-owned
  declarations in import order would have changed that silently — so `sessionState` carries its place (`at`), and the
  pass is a total order the ledger guards. Elegance lost to behaviour kept.
- **Liveness is never a pacing timer of a scope that can be re-homed.** The transport's poll re-arms itself; as
  `transportScope().after(…)` it would die for good the first time its scope was re-opened under it. It is a
  `guarantee` of the transport's scope (it comes at its time, or at once when the scope ends un-disarmed), and the
  teardown disarms it first. The same for the campaign channel's reconnect and the realtime service: the PAGE's scope.
- **A `kill` pushed unbound was never a kill.** `{kill: gsap.delayedCall(…).kill}` (the trade layer's wave read) lost
  its `this`; the beat always fired. Converting it honestly («now it can be killed») would have changed what the wave
  does when its layer leaves mid-read. It is a guaranteed release of the layer's scope, guarded by the wave's nonce.
- **A guard that READS for a primitive must learn the owned form in the same diff.** `ceilingWaitGuard` recognised a
  ceiling by `setTimeout`; with the timers owned it would have gone blind (it said so itself: a stale ALLOW row).
  `parliamentNoTimers` kept an allow-list of six nets — now empty; `transferFlightClock` sliced on a line that had
  been gone for a round (a vacuous assertion — re-pointed).
- **The box of numbers** — the ledger's line after the round: **0 raw timers, 0 raw frames, 0 `delayedCall`s outside
  the kernel in `src/client` (1 + 3 declared as the gamepad's device clocks); 0 flow-state modules whose run is not a
  scope (5 declared non-flows); 0 reset rows in the shell's teardown (66 session states declared by their modules).**

---

## 11. The debt ledger — what still runs on a mechanism the kernel replaces

§10 counts what WAITS outside a scope; it is zero. This section counts what is still DECIDED the old way — and
freezes it. `tests/console/architectureDebt.spec.ts` over `tests/console/architectureDebtBaseline.json`: per mechanism
and per file, the uses that stand; a file may not gain one; **a new file starts at zero**; `npm run debt:architecture`
lowers the baseline (never raises it) and prints the line. Each row of the spec's `FROZEN` table carries `what` it
is, the kernel form to write `instead`, and the `plan` item it retires with — a failing run prints all three.

| Row | 2026-11-11 | The kernel form | Retires with |
| --- | --- | --- | --- |
| `surface-by-ref` — a surface reached through `shell.$refs` in a controller | 117 in 16 files (`padRouter` 47 · `colony` 20 · `viewer` 11) | the surface registers what it offers while mounted; presence is the registration | **S3** |
| `set-aside-writer` — a write of the one «set aside» boolean | 30 in 13 files (5 set it, 25 clear it) | a record owned by what was set aside | **S4** |
| `resolver-mailbox` — a promise whose resolver is a module variable | 29 in 26 files | a run's end · `createFlowSignal` awaited under a bound | **S6**, per module |
| `view-apply-write` — another domain's latch reset by the view-apply reaction | 19 | the latch ends with its submit / its prompt / its run | **S4 · S6** |
| `liveness-rung` | 11 in 7 files | an owner with a bound | §6 — field evidence |
| `wait-source` · `wait-recovery` | 9 · 9 | kernel waits; a bounded wait needs no door | **C3** — after S4 – S6 |
| `truth-witness` | 3 | a `story` scope / a hold; a level instead of a watched edge | **S6** |
| `controller-latch` — a bare latch `ref` in a controller | 1 (a clock of the supervisor's net) | `scopedState` | done |
| `supervisor-port` — a fact a net samples in the shell | 32 rows | a bound on its owner | §6 |
| (guarded elsewhere) the shell's `watch` table · its size | `shellControllers.spec.ts` | a machine's state / a scoped run per reaction; the session owns the tick | **S6 · S-last** |

**The regime until the redesign is done — «touch it → move it».** A fix inside a frozen mechanism moves the piece it
touches onto the kernel (a latch gets its true owner, a missed edge becomes a level, a sampled fact a bound of its
owner); it never adds a rung, a witness, a door, a flag or a watch row. `REVIEW.md` §5 says it for the reviewer.

**The order of the redesign** is §0's list; each slice lowers named rows here and ends with the full e2e run:
S5-rest (owed steps as `step` children of the frame — then the ghost test and the stale free-turn reaper read
structure) → S4 (the prompt router: admission and «set aside» as a record; the view-apply's writes go with it) → S3
(the surface registry: `$refs` out of the pad path, the two ladders one table) → L1-rest (ticket-first arming) →
S6 (per domain: reactions and resolvers become machine states / runs — colonies and hydro first) → C3-rest (the
observer on `waitTable()`; sources and doors go) → S-last (the session owns the tick; the shell is layout).
