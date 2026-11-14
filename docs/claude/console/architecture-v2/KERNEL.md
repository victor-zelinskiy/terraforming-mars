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
| `after(ms, what, run)` | an OWNED timer: `run` is called once, in the timer's own task — and never after the scope has ended. A row of the wait table (`family: 'timer'`) while pending. Returns the cancel. What a raw `setTimeout` in a flow becomes. |
| `afterFrame(what, run, n?)` | the same on the page's frames (what a raw `requestAnimationFrame` becomes). |
| `every(ms, what, tick)` | a TICK owned by the scope (what a `setInterval` becomes — a sampler, a heartbeat): `tick` every `ms` on the kernel's clock until it returns `false`, its `stop` is called, or the scope ends — one row for its life. Each tick is armed after the previous one returned (a slow tick delays the next, it never stacks); a tick that throws is said and the tick GOES ON. |
| `note(what, withdraw, boundMs?)` | a row for a wait ANOTHER clock keeps (a GSAP `delayedCall`, a registry's entry): the scope's end calls `withdraw`; the returned function only FORGETS the row (the foreign wait came by itself). How a second clock, or a registry, becomes a view of the table instead of a book of its own. |
| `everyFrame(what, tick)` | a frame LOOP owned by the scope: `tick` on every frame until it returns `false`, its `stop` is called, or the scope ends — one row for the loop's life. A window that does not paint calls no `tick`: what must happen anyway is a `guarantee` beside it. |
| `sleep(ms)` | a span: `true` when it passed, `false` AT ONCE when the scope ended first. |
| `guarantee(ms, what, release)` | a RELEASE that cannot be lost: `release` is called exactly once — at `ms`, OR when the scope ends, whichever comes first — unless the returned `disarm` is called before either. The opposite of `after` (which is taken back): what the safety of a tween's promise becomes. Asked of an ended scope it comes due at once — a microtask later, never inside the `guarantee()` call (the caller's `const disarm = …` is not assigned yet). |

Targets: `ended(otherFlow)` · `joined(ownDescendant)` · `until(what, reactiveRead, {polledMs?})` (LEVEL-triggered —
true now resolves now) · `motion(what, gsapOrWaapi)` (settles on completion AND on interrupt / cancel — `completed`
says which) · `settled(what, promise)` (a rejection is a value) · `signalled(what, flowSignal, family?)` · `delay(ms)` ·
`frames(n)` (the page painted `n` times — always under a real bound: a window that does not paint has no frames) ·
`polled(what, read, everyMs)` (a condition re-read on the CLOCK only — for a source that is not reactive, and for a
condition whose consequence must run in a task of its own rather than inside the stretch that made it true).

**The two waits every motion module wrote by hand** (`session/sessionWaits.ts`): `whenPainted(n = 2, boundMs = 400,
owner?)` — «the pose has reached the screen», bounded; `span(ms, owner?)` — a beat of stillness, over at once when
its owner ends. `probeTick(fn)` (`console/probeTick.ts`) stands on the same pair: an owned frame + a guaranteed
fallback. `untilCeiling(spec, read, owner?, everyMs?)` (`waitGraph/ceilingWait.ts`) is a polled condition against a
ceiling as ONE call — what a `wait ??= beginCeilingWait(…)` + a poll loop + a deadline becomes.

**The motion clock, with an owner** (`session/sessionWaits.ts`): `motionAfter(ms, what, run, owner?)` (pacing) ·
`motionGuarantee(ms, what, release, owner?)` (release) · `motionSpan(ms, owner?)` — a `gsap.delayedCall` whose row
(`note`) stands in the owner's table and is taken back / released with it. A beat that paces TWEENS keeps GSAP's
clock (lag smoothing stretches the tween, not a wall-clock timer beside it); what it gains is an owner. The
Parliament's `scheduleParliamentBeat` is `motionGuarantee` on the session.

**Where a scope comes from** (`console/session/`):

| Owner | Primitive |
| --- | --- |
| «a flow opened now, by a MODULE» | `consoleSessionScope()` — the game session while a game screen is up, the page's scope otherwise |
| what lives as long as the PAGE | `consoleAppScope()` — the lobby's root: the campaign's channel, the realtime service, the loading curtain, the layout profile, the field recorder |
| a COMPONENT | `useFlowScope(label)` in `setup()` — ended on unmount; parented by WHERE THE COMPONENT STANDS (`componentSessionScope`: the session of the shell it is rendered in — handed down by `provide` — or the page's scope outside any shell), never by «the session that stands» |
| a module flow with ONE writer | `createFlowRun(label, {orphaned, kind?, owner?})` — `begin` / `end` / `after` / `afterFrame` / `every` / `everyFrame` / `sleep` / `guarantee` / `live()`; cancelled with the session and then told to bring its module to rest |
| a module flow with MANY writers | `deriveFlowRun(label, () => state.live, {orphaned, detail?})` — the run is DERIVED from the reactive record by a sync watcher that only records, so no writer of the flag can forget it |
| a hold | `beginAnimationHold(…).scope` |
| a module's own root | `sessionChild(held, kind, label)` — re-homed when the session changed |

**Module state that is not a flow** declares itself: `sessionState(label, reset, at)` at module scope; the leaving
shell calls `leaveConsoleSession()` — one ordered pass (`at`, a total order) over every declared reset, each isolated.
Then the session's scope ends (`unmounted`). The shell's `beforeUnmount` holds no list of modules.

**The registries the nets read are views of the table**: a hold is `scene:hold:<label>`; a ceiling wait
(`declareWait` — `beginCeilingWait` / `raceCeiling` / `untilCeiling`) is a `note` row of the session bounded by its
ceiling, withdrawn with it; an owed story of the presentation ledger is `story:owed:<id>` with its release edge as a
row bounded by `dueMs`, ended at its settle / degrade — or with its session.

PLAN §10 has the recipes and the ledger that counts what is still outside (nothing, but the two declared device
clocks of the gamepad layer).

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

**Coverage — the state space as a number** (`kernel/flowCoverage.ts`, `console/flowCoverageProbe.ts`; FREEZE ZERO §3.1):
asked for by the e2e harness (`TM_E2E_COVERAGE=1` — the monkey always asks), every step of the trace marks a KEY with
what varies between two runs of one flow taken out — `open <kind:label>` · `end <kind:label> <how>` · `state <kind:label>
<from> → <to>` · `wait <kind:label> <family>` · `bound` · `cycle` — and `window.__conCoverage()` answers the keys beside
the UNIVERSE the page knows (every move the registered machines can make; every workspace frame). The universe of the
flows is what the sources declare (`scripts/flow-universe.mjs` — the literal labels of `createFlowRun` / `deriveFlowRun` /
`useFlowScope` / `scopedState` / `owedAnswer` / the holds / `owePresentation` / `.open`). `scripts/monkey-report.mjs`
sums a run: «N % of the declared flows were opened, M % of each machine's moves were made», and the list of what was
NEVER reached. A new flow is in the universe the day it is written — nothing to register. Off in a player's game.

`flowTrace()` / `flowTraceLines()` — the ring of opens, ends (with reasons), waits and machine transitions;
`flowTraceStats` — counts; `[flow] …` console lines for anomalies (a task that threw, a cleanup that threw, a law
violation at run time, a refused cycle, a bound that ended a wait). `window.__conFlow()` returns the tree
(`dumpFlowTree()`), the wait table, the ring's tail and the counters; the field recorder's heartbeat carries
`flowTreeDigest()` in every second that stood still (`quietS ≥ 2`), and the console export and the main process's hang
line print it («flows: …»).
