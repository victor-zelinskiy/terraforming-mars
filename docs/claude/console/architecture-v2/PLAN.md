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
| L4 | lifecycle 3 — the announce plate and «set aside» | **the plate: done** — `announceMachine`, one run per beat key, `pending` bounded (its door is the shell's); **«set aside»: with S4** (it is a state of the QUESTION, which the prompt router owns) |
| S1 | the shell: session root + the supervisor out of the shell | **done** — `console/session/consoleSession.ts` (ONE root scope for the transport, the frames, the claims and the plates; it ends when the shell is unmounted); `console/supervisor/supervisorController.ts` (the 1 Hz sampler, the rungs, the wait-graph source, the reapers, the cures) — its 39-row PORT is the list of what the nets sample in the shell |
| S2 | the shell: the extraction tool + the first islands | **done** — `scripts/shell-extract.mjs`; ten controllers under `console/shell/` (viewer · milestones/awards · wheel · cell · info · convert · rail · journal · surface · notice), each with its typed PORT; **every watcher is a one-line delegate** — the `watch` block is the ordered table of the shell's 145 reactions and their bodies are methods (`when<Key>Changes`) that move with their domains; the types the shell shares with its SFC children live in `.ts` modules. The shell is 25.2k lines (was 27.8k). The region components (template) ride S3 / S6 |
| S6 · mechanical | the shell: EVERY domain is a controller | **done** — 33 controllers (table in §5 · S6); `ConsoleShell.vue` is 4.3k lines (was 27.8k): the template (1.6k), the composition root, the module-state mirrors, the ordered `watch` table, the two hooks and a 450-line view-apply reaction. What is left in it is NOT domain code |
| S3… | the shell: surface registry (pad / bar / context — one table), routing, conclusion | — (they are now redesigns of ONE controller each: `padRouter` + `commandBar`, `router` + `mandatory`, `outcome`) |
| N1 | native stalls: LoAF in the field log, a trace on `unresponsive` | **done (diagnosis)** — `longFrameWatch.ts` (`[long-frame]` lines with the frame's split), `electron/hangTrace.ts` (a Chromium trace of every stop, named in the hang line); reducing what the first traces name is open |

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
  **A ratchet («the shell may only shrink») is deliberately not a guard yet**: `main` is shared and other sessions
  still add to the shell; it becomes a guard in S-last.
- **S3 — the surface registry.** The three ladders become one ordered table; each branch moves to its surface's
  entry with its condition verbatim. The pad path stops using `$refs`: a surface registers its handler while mounted.
- **S4 — the prompt router.** Admission and the ownership trios as one controller; the screen director's
  `expectedScreenOwners` table becomes the router's own table (the shadow has nothing left to compare against).
- **S5 — conclusion as a join.** Owed steps become children of the frame's scope (declared at the press that owes
  them); the conclusion is decided by level over the scope; the owed-conclusion apparatus is deleted.
- **S6 — the domains, the MECHANICAL half (done).** With the watchers delegated (S2) every remaining member of the
  shell was assigned to a domain — seeds by name, then affinity over the `graph` (who reads whom) — and taken out
  with the tool, in one reproducible pipeline (pristine shell → hand preps → `delegate-watchers` → `lift` of the
  shared module-level types / constants → `apply` × 33, imports kept whole until the last step → `prune`). The shell
  keeps: the template, `setup()` (the composition root: the session, the 33 controllers), the mirrors of module
  state in `data()`, the `watch` table, `mounted` / `beforeUnmount`, the view-apply reaction
  (`whenPlayerViewChanges`, 450 lines — the last knot that is not a domain; it goes with S4), and a handful of
  one-line verbs.

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
| S6 · mechanical | every domain's members are setup-state of the shell (same names; the template, the watch table and the hooks unchanged); the series' input gate registers in the pad router's `onMounted` (a setup hook runs before the shell's `mounted`); `COPIED_ACTION_STANCES['deck-check'].file` names the reveal controller | ANY console spec — this is the slice a wholesale regression would come from. Pointwise on the box (63 files across every domain — the list is in the commit): green. Look first at whatever mounts late or reads a `$refs` instance: the hand album's transition targets, the Parliament's leave, the colony roster's ceremony |
| S1 | the four flow trees hang under one `session` root that ends on the shell's `unmounted` (was: four roots that lived for the page); the supervisor's start / stop are two calls in the same hook rows; nothing else moves | `console-wait-graph-control`, `console-wait-graph-dead-end`, `console-screen-director-cure`, `console-screen-shadow-control` (the control stand's `declareDefect` goes through the supervisor), anything that leaves a game and enters another (rematch, campaign thresholds) |
| S2 · watchers | every watcher is `key(v) { this.when<Key>Changes(v); }` — same order, same options (`immediate` / `flush` / `deep`), the body one call deeper | none expected (pointwise: hydro, colonies, hand, draft, generation scene, std projects — green) |
| S2 | ten member sets of the shell are setup-state now (same names, same template): a `data` field became a `ref`, an options `computed` a `computed()`; the viewer's input-absorber gate registers in the controller's `onMounted` (a setup hook runs BEFORE the shell's own `mounted` — it was the second row of it) | the card viewer (`console-played-zoom-return`, `console-inspect-history`, anything that presses X on a card), `console-ma-workspace` / `-price` / `-states`, `console-info-*`, `wheel-rework`, `console-convert-plants-source`, `console-journal-chronicle`, `console-cell-dossier`, `console-rail-*` |
| L4 | a beat pending 15 s runs the plate's door from the machine (was: the wait graph's overdue finding after 3 more ticks, and only when no frame stood on top); nothing else moves | `console-parliament-announce`, `console-parliament-aquifer`, `console-pluto-bonus-discard`, `console-external-draw`, `console-bot-attack`, `console-corp-first-action`, `console-screen-director-cure` (the blind announce's beacon), `console-draft-workspace` |
| N1 | a `[long-frame]` warn line per ≥ 500 ms frame (rate-limited) — harvested, never red | none expected; a spec that asserts «no console.warn at all» would see it |
| L3 | the claim's timers are machine states (same numbers); an orphaned claim is released exactly 1.5 s after its host's last frame ended (was 1.5–2.5 s, sampled); the arrival gate of a claim that never got an answer opens at 20 s | `console-hi-tech-lab`, `console-wait-graph-dead-end` § orphaned claim, `console-hydro-copied-tile`, every embedded draw / pick / verdict (`console-viron-repeat-draw`, `console-deck-pick-collapse`, `console-start-sponsor`, card-actions specs) |
| L2 | every frame verb now also opens / ends scopes; the phase is written through a machine (same value, same call); a frame whose press did not land goes back by the lease (after the surface's own rollback); a beat standing 180 s on stage is ended | anything with park / restore / yield for the board (`console-hydro-copied-tile`, `console-hi-tech-lab`, `console-workspace-stack*`, `console-start-sponsor`, `console-mu-colony-question`), a refused submit inside a workspace (`console-resource-distribute`), reload restore (`console-draft-workspace`) |
| L1 | the funnel: every gate now runs as a child scope (a few microtasks later than a bare `await`); a gate that throws no longer aborts the whole answer; the supervisor's release ends the gate instead of lowering the flag | any spec that plays a card / trades / advances the hydro marker / converts / places a tile — pointwise check on the box: `smoke`, `console-workspace-band`, `console-stdp-workspace`, `console-colony-venus-trade`, `console-hydro-terminal-field`, `console-generation-scene`, `console-hand-play-return`, `console-hazard-placement` |
