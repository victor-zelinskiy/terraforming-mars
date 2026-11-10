# The flow kernel — scopes, bounded waits, machines, the law

`src/client/console/kernel/` · specs `tests/console/kernel/` · the plan it belongs to: `PLAN.md` (same folder).

The kernel is the bottom layer of the console's architecture v2. It owns two things and nothing else: **lifetimes** and
**waits**. Read this before writing anything that starts, waits, or ends.

## 1. The rules of use (the short form)

1. **A run of anything that has a lifetime is a scope.** Open it in the scope of whatever it must not outlive
   (`host.open('claim', name)`); register what it acquires with `scope.defer(...)` (or `using`); end it once
   (`scope.end({how, …})`). You never write the matching «release» call at the far end of a callback chain — the
   scope's end is the release, on every path.
2. **Async work is `scope.run(label, async (s) => …, {bound})`.** A throw is that child's `failed` end (said once),
   never a flow left half-way. `run` never rejects: read its outcome.
3. **You wait only through `scope.wait(target, {bound})`.** The bound is required by the type; the result is
   `met | bound | cancelled | cycle` and you handle each. A bound that ends a wait is said once (`[flow] bound …`) —
   it is a safety, never a schedule (a real schedule says so: `{ms, quiet: 'why'}`).
4. **Waiting for another flow's END goes through the kind table** (`flowKinds.WAITS_ON`). A pair that is not listed
   does not compile; adding a pair is a design decision with its reason in a comment, and the DAG spec holds it.
5. **State with a protocol in time is a machine in a scope** (`startFlowActor(scope, machine)`), registered in
   `flowMachines.ts`, and it keeps the law (§4). Derived facts stay Vue computeds.
6. **The player's wait names what accepts the press**: `{bound: 'player', accepts: surfaceScope}`.

## 2. FlowScope (`flowScope.ts`)

| | |
| --- | --- |
| identity | `kind:label#seq` — the RUN's own name. An ending keyed to a global flag another writer can reset (R4 / R5 / R6 of the wait-graph inventory) cannot be written: endings are methods of the run's scope. |
| ends | exactly once: `done` · `cancelled(reason)` · `failed(error)` · `expired(bound)`. The first end wins. |
| end order | its standing waits are cancelled → its children end (youngest first) → its cleanups run LIFO → it leaves the tree → `onEnd` listeners are told. |
| after the end | `open` returns a scope that is born ended; `defer` runs the cleanup at once; `wait` answers `cancelled`. Nothing can be parked under a dead owner. |
| `signal` | an `AbortSignal` aborted with the scope — hand it to `fetch` / listeners. |
| `isLive()` | reactive (a computed or a template may read it); `ended` is the plain read. |
| `detail` | a free-form fact for the trace and the tree dump (a machine's state is written here by the binding). |

Targets: `ended(otherFlow)` · `joined(ownDescendant)` · `until(what, reactiveRead, {polledMs?})` (LEVEL-triggered —
true now resolves now) · `motion(what, gsapOrWaapi)` (settles on completion AND on interrupt / cancel — `completed`
says which) · `settled(what, promise)` (a rejection is a value) · `signalled(what, flowSignal, family?)` · `delay(ms)`.

## 3. The wait table is the wait graph

Every standing wait is a row: `{owner, family, what, on?, since, boundMs?}` (`waitTable()`); `dumpFlowTree()` prints
the live tree with each scope's age, state and waits. Before a wait for another scope's end is registered:

1. `joined(x)` must be the waiter's own descendant; `ended(x)` may not be its ancestor (that end cancels the waiter);
2. the pair of kinds must be in `WAITS_ON` (a `task` waits by the row of the flow it is a beat of);
3. the edge must not close a cycle. A scope cannot move on while anything inside it waits, so a node's out-edges are
   the rows owned anywhere in its subtree; if the walk from the target reaches the asker or one of its ancestors, the
   wait is **refused**: the result is `cycle` (with the path), synchronously, and the asker takes its bound path now.

So a mutual wait never stands — not for three ticks, not for a frame. `[flow] cycle refused a → b → a` in a run is a
design defect upstream (two flows that each believe the other goes first) and is fixed there, like a `cure` line was.

## 4. The law of a lifecycle machine (`flowLaw.ts`)

Every atomic state carries exactly one tag (its own or an ancestor's): `rest` · `player` (+ `meta.accepts`) · `beat`
(+ an `after` transition — its bound — and `meta.waitsOn`). `machineLawViolations(machine)` judges the definition
(tags, bounds, no trap, a rest state or the machine's end reachable from every state); `exploreMachine(machine,
{events})` judges the reachable snapshots (a guarded bound that never passes is a `dead-bound`; a player state no
sample event moves is a `dead-press`). `flowLaw.spec.ts` runs both over `FLOW_MACHINES`; `flowMachineRegister.spec.ts`
fails on a `createMachine(` under `src/client` that is not registered.

Adding a machine: define it with `setup({...}).createMachine({...})`, tag every state, add a row to `FLOW_MACHINES`
(name, file, one sample event per event type and per payload a guard tells apart). Durations that follow the motion
preset go in `setup({delays})` as functions over `motionMs`.

## 5. Clock and tests

`flowClock()` is the one source of time and timers for scopes, waits and machines. A spec installs
`createManualClock()` (`setFlowClock`), advances it, and asserts `clock.pending() === 0` at the end — a leaked timer is
a leaked lifetime. `flowKernel.property.spec.ts` (fast-check) holds the kernel's invariants under random schedules;
when you add a primitive, add its operation to that model.

## 6. Diagnosis

`flowTrace()` / `flowTraceLines()` — the ring of opens, ends (with reasons), waits and machine transitions;
`flowTraceStats` — counts; `[flow] …` console lines for anomalies (a task that threw, a cleanup that threw, a law
violation at run time, a refused cycle, a bound that ended a wait). The field recorder's heartbeat and the console
export read the tree and the ring (wired in the supervisor slice — see the plan).
