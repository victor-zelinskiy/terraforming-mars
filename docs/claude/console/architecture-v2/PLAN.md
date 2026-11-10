# Console architecture v2 — the plan

> The answer to `docs/claude/console/architecture-v2-brief.md`. Written 2026-11-10 by the architect session; kept
> current slice by slice — **§0 is the hand-over**: read it first when a session picks this work up.
> Contract docs of what is already built live beside this file (`KERNEL.md`, …); this file is the map and the worklist.

## 0. Where the work stands (the hand-over — updated with every slice)

| Slice | What | State |
| --- | --- | --- |
| P0 | the plan, the dependencies (`xstate`, `fast-check`) | **done** |
| K1 | the flow kernel: scopes · bounded waits · the wait table · machines · the law (`KERNEL.md`) | **done** — nothing uses it yet |
| L1 | lifecycle 4 — the submit transport on the kernel | **done** — `submitMachine`, tickets, `gate()`; the ticket-first ARMING of scenes rides the domain slices (below) |
| L2 | lifecycle 2 — the workspace frame (scopes, locations, bounded beats) | **done** — every frame is a scope (`workspaceFrameScope`), its phase the `frameMachine` (beats bounded, on stage only), the beat's LEASE puts a frame back when its press did not land |
| L3 | lifecycle 1 — the outcome claim, owned by its host frame | **done** — `claimMachine` (the three backstops and the host binding are states), `consoleWorkspaceOutcome.ts` is its facade; the shell's `releaseOrphanedClaim` is deleted |
| L4 | lifecycle 3 — the announce plate and «set aside» | — |
| S1 | the shell: session root + the supervisor out of the shell | — |
| S2 | the shell: the extraction tool + the first islands | — |
| S3… | the shell: surface registry (pad / bar / context — one table), routing, conclusion | — |
| N1 | native stalls: LoAF in the field log, a trace on `unresponsive` | — |

**Branch / tree.** The work is done in the worktree `C:\Projects\Mods\tm-arch` (branch `arch-v2`, rebased on
`origin/main` before every push; pushed to `main` slice by slice). After a push the main clone is moved onto it
(`git fetch` → HEAD = `origin/main`, own paths checked out) — the owner looks at the main clone.

**Specs whose hooks or timing a slice touched** (the CI run at the end is the verdict — look here first): see §9.

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
- **L4 — announce / set aside.** `announceMachine`; `mandatoryGateState` is its mirror; the deferred flag becomes a
  projection of the chain's location.

### Phase 2 — the shell

- **S1 — session + supervisor.** `ConsoleSession` (root scope, the transport, the stack); the liveness sampler, the
  wait-graph source, the rungs, the reapers and their seven module `let`s move out of the shell into
  `console/supervisor/` behind a typed port (what the supervisor reads of the shell is then a list, not `this`).
- **S2 — the extraction tool + first islands.** `scripts/shell-extract.mjs`; proven on the islands the map found
  closed: the card viewer (60 members, 340 template lines), milestones / awards (45), Information Mode (15), the
  notice toast, the boot curtain, the test seams. Each island = one controller (+ one region component where the
  template block is contiguous).
- **S3 — the surface registry.** The three ladders become one ordered table; each branch moves to its surface's
  entry with its condition verbatim. The pad path stops using `$refs`: a surface registers its handler while mounted.
- **S4 — the prompt router.** Admission and the ownership trios as one controller; the screen director's
  `expectedScreenOwners` table becomes the router's own table (the shadow has nothing left to compare against).
- **S5 — conclusion as a join.** Owed steps become children of the frame's scope (declared at the press that owes
  them); the conclusion is decided by level over the scope; the owed-conclusion apparatus is deleted.
- **S6… — the domains.** Hand, colonies, hydro, parliament, start, draft / endgame, placement: extraction, then the
  domain's watchers and latches become machine states / scoped runs. Order by freeze history: colonies and hydro
  first (most mailbox fields), then the hand, then the phase scenes.
- **S-last.** `ConsoleShell.vue` is layout: the regions, the session's provide, no `watch`, no lifecycle logic.

### Phase 3 — stories and directors

Animation holds as scoped runs (`scope.hold`, the supplier form for a flow whose state is a machine), the board-beat
park and the ledger stories as `story` scopes with declared waits (`WAITS_ON.story = ['frame' (leaving), …]`), the
screen hand-over as a wait on the table instead of a reasons list, then the directors' runs (start, sitting, quest,
walk, rally, generation scene, finale) — each run keyed by its own scope.

### N1 — native rendering stalls (independent of the phases)

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
| owed-conclusion signal + retry + truth witness + ghost test, the stale free-turn reaper | S5 | the conclusion is a join decided by level |
| the three-ladder lock-step, `inputEcho`'s «dropped» evidence for unmounted refs | S3 | one table |
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
| L3 | the claim's timers are machine states (same numbers); an orphaned claim is released exactly 1.5 s after its host's last frame ended (was 1.5–2.5 s, sampled); the arrival gate of a claim that never got an answer opens at 20 s | `console-hi-tech-lab`, `console-wait-graph-dead-end` § orphaned claim, `console-hydro-copied-tile`, every embedded draw / pick / verdict (`console-viron-repeat-draw`, `console-deck-pick-collapse`, `console-start-sponsor`, card-actions specs) |
| L2 | every frame verb now also opens / ends scopes; the phase is written through a machine (same value, same call); a frame whose press did not land goes back by the lease (after the surface's own rollback); a beat standing 180 s on stage is ended | anything with park / restore / yield for the board (`console-hydro-copied-tile`, `console-hi-tech-lab`, `console-workspace-stack*`, `console-start-sponsor`, `console-mu-colony-question`), a refused submit inside a workspace (`console-resource-distribute`), reload restore (`console-draft-workspace`) |
| L1 | the funnel: every gate now runs as a child scope (a few microtasks later than a bare `await`); a gate that throws no longer aborts the whole answer; the supervisor's release ends the gate instead of lowering the flag | any spec that plays a card / trades / advances the hydro marker / converts / places a tile — pointwise check on the box: `smoke`, `console-workspace-band`, `console-stdp-workspace`, `console-colony-venus-trade`, `console-hydro-terminal-field`, `console-generation-scene`, `console-hand-play-return`, `console-hazard-placement` |
