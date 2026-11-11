# Writing and CHECKING console code on the architecture — the working checklist

For whoever writes, reviews or audits console client code (`src/client/**`) after the coverage phase of architecture v2.
`PLAN.md` says what was built and what is left; `KERNEL.md` is the kernel's contract; this file is the procedure:
**what to reach for, what to verify, and what a finding looks like.** Read it before a review; quote its section number
in a finding.

The whole architecture in six sentences:

1. **Everything with a lifetime is a `FlowScope`** of ONE tree. A scope ends exactly once and takes with it everything
   opened or armed inside it. The tree's roots are the GAME session (`session:game#n` — the shell's life) and the PAGE
   (`session:lobby#n` — `consoleAppScope()`).
2. **Everything that waits is a row of ONE wait table** — a timer, a frame, a tick, a release, a wait for another
   flow, a wait a foreign clock keeps. A row has an owner and (where it can stand for ever) a bound.
3. **A flow that plays is a RUN** (`createFlowRun` / `deriveFlowRun`): its timers are the run's, it ends with its
   session and is then brought to rest by its own `orphaned`.
4. **State of the game that is not a flow DECLARES itself** (`sessionState`) and is taken down by the session's one
   ordered pass; **a latch is a scope** (`scopedState`).
5. **A lifecycle with a protocol in time is a machine in a scope** (`startFlowActor`), judged by `flowLaw.spec`.
6. **Two ledgers say whether it is still true**: `kernelCoverage.spec.ts` (nothing waits outside a scope — its baseline
   is EMPTY) and `architectureDebt.spec.ts` (what still runs on a mechanism the kernel replaces — FROZEN, only shrinks).

---

## 1. «I need to …» → the primitive

| I need to … | Use | Never |
| --- | --- | --- |
| do something LATER, unless my owner is gone by then (the next step, an abort-style safety, a poll) | `owner.after(ms, what, run)` → cancel | `setTimeout` |
| LET SOMETHING GO later — a promise somebody awaits, a gate, a hold, a class on a foreign element, a mark | `owner.guarantee(ms, what, release)` → disarm (fires at `ms` OR at the owner's end, once) | a timer that can be taken back; `setTimeout(finish)` + `clearTimeout` |
| wait for the next painted frame(s) | `owner.afterFrame(what, run, n?)` · `await whenPainted(n, boundMs, owner?)` | `requestAnimationFrame`, an `await` of a bare frame promise |
| run a frame loop / a periodic tick | `owner.everyFrame(what, tick)` · `owner.every(ms, what, tick)` | a self-re-arming rAF / `setInterval` / VueUse `useIntervalFn` |
| pace TWEENS (a stagger, a read beat beside GSAP) | `motionAfter` · `motionGuarantee` · `await motionSpan` (`session/sessionWaits.ts`) | a bare `gsap.delayedCall`; a wall-clock timer beside a tween |
| await a beat of stillness | `await span(ms, owner?)` / `await run.sleep(ms)` (over at once when the owner ended — re-check your flag) | `new Promise((r) => setTimeout(r, ms))` |
| wait for a tween / a WAAPI animation | `scope.wait(motion(what, anim), {bound})` — settles on completion AND on interrupt | `await anim.finished` (rejects on cancel, hangs when paused) |
| wait for a promise / a fetch | `scope.wait(settled(what, promise), {bound})` · `raceCeiling(spec, promise, owner?)` | `Promise.race` against a timer |
| wait until a condition holds | `scope.wait(until(what, read), {bound})` (reactive, level-triggered) · `polled(what, read, everyMs)` when the consequence must run in a task of its own · `untilCeiling(spec, read, owner?)` with its ceiling line | a hand-written poll loop with a deadline |
| wait for ANOTHER flow to end | `scope.wait(ended(other), {bound})` — typed by `WAITS_ON`, refused if it would close a cycle | a flag of the other module sampled in a loop |
| signal «it happened» once to whoever waits | `createFlowSignal()` + `scope.wait(signalled(what, signal), {bound})` | a module-level `let resolveX` (a resolver mailbox) |
| own a COMPONENT's timers | `setup() { return {flow: useFlowScope('<kebab-name>')}; }` → `this.flow.after(…)` (lazy; parented by where the component stands) | a `beforeUnmount` list of `clearTimeout`s |
| own a module FLOW's timers and its end | ONE writer of the flag: `createFlowRun(label, {orphaned})` + `run.begin()` / `run.end()` beside the flag. MANY writers: `deriveFlowRun(label, () => state.live, {orphaned})` | timer ids in module variables |
| hold the foreground for a scene | a SUPPLIER derived from state: `registerAnimationHoldSupplier(label, predicate, {expire})`; a handle (`beginAnimationHold`) only for a beat with no state of its own — its timers go in `hold.scope` | a boolean in the shell; a local `setTimeout` gate |
| keep «pending / owed / armed» state | `scopedState(label, rest, owner?)` — a `Ref` whose raised span is a `step` scope | a bare `ref(false)` with a reset somewhere else |
| keep module state of the running game | declare it beside its reset: `sessionState('<label>', resetX, <at>)` | a row in the shell's `beforeUnmount`; state nobody resets |
| own something for the life of the PAGE (a channel, a poller, a menu) | `consoleAppScope()` | `consoleSessionScope()` (it ends with the game) |
| a lifecycle with states and timeouts | a machine: `startFlowActor(scope, logic)`, registered in `kernel/flowMachines.ts`; every state `rest` · `player` · `beat` (+ `after`) | a set of flags + watchers |
| submit the player's answer | `const ticket = submitInput(out)` / `submitBatch(…)` (`transport/gameTransport.ts`) — check `ticket.accepted`, read `ticket.settled` | a fetch of your own; a submit around the funnel |

Which owner — in this order: the RUN the wait serves → the frame's scope (`workspaceFrameScope(kind)`) → the submit's /
the hold's → the component's → `consoleSessionScope()` (asked every time, never cached) → `consoleAppScope()` for
what is the page's.

---

## 2. The laws a review checks (each has cost a field freeze or a CI round)

**L1 · PACING or RELEASE is decided per callback.** Ask: *does anything OUTSIDE the owner depend on this callback
running?* Yes → `guarantee`. No → `after`. A release on `after` is a wedge (the gate never opens when the owner ends
first); a step on `guarantee` lets a dead flow act.

**L2 · A release is idempotent and safe on a screen that left.** A `guarantee` of the session fires in the shell's
`unmounted` — AFTER the module resets of `leaveConsoleSession()`. It must be the «let go» it is named for: never a
step that re-arms state, never a read of `$refs` it cannot survive being null.

**L3 · A safety that WARNS does not come due at the owner's end.** `after` + `owner.defer(() => silentRelease())`.
A `[…] never signalled ready` printed because the player left the game is a false finding in every harvest.

**L4 · Liveness is never a pacing timer of a scope that can be re-homed.** A chain that re-arms itself (a poll, a
reconnect) is a `guarantee` of its own root, or lives in `consoleAppScope()`.

**L5 · A hold derived from state stays derived.** Do not turn a supplier into a handle: state and hold then diverge.

**L6 · One writer → `createFlowRun`; many writers → `deriveFlowRun`.** A `run.begin()` / `run.end()` pair must stand
beside EVERY line that raises / lowers the flag; if you cannot list them all, derive.

**L7 · `orphaned` brings the module to REST** — final poses, holds released, flags lowered, promises resolved,
silently. It is called once, after the run's scope ended with its session.

**L8 · After `await run.sleep(ms)` / `span` / `whenPainted` — re-check that the flow still stands.** They resolve at
once when the owner ended.

**L9 · A component's scope key is free.** `flow` shadows a `data` / `computed` / `methods` / `props` member of the
same name silently (vue-tsc passes). A component with a `flow` of its own names the key `flowScope`. (Ledger-guarded.)

**L10 · A component outside the shell is the PAGE's.** `useFlowScope` reads the tree; a module that grabs
`consoleSessionScope()` for an app-level service loses its timers when the game screen leaves.

**L11 · Module state of the game has ONE declared lifetime.** A run (`orphaned`), a `sessionState` with its place in
the pass (`at` — a total order; a scene's abort recalls what it staged, the stack falls before the picks), or a
`scopedState`. State that is the page's says so in a comment where it is declared.

**L12 · A decision that ACTS has a place in the tick.** A reaction that closes a workspace or opens a door is asked
from a row of the shell's watch table (after the reactions the same write woke, before the render) — never from a
free pre-flush watcher (it runs BEFORE every component's) nor post-flush (a patch late). The kernel's `until` is for
waits that only record. (`workspaceConclusionOwe.ts` is the model; PLAN §5 · S5 has the two reds that taught it.)

**L13 · A registry of «things somebody waits for» is a VIEW of the tree.** It opens scopes / notes rows
(`scope.note(what, withdraw, boundMs)`); it does not keep a Map the session cannot end.

**L14 · Waiting for another flow goes through `WAITS_ON`.** A new pair is a design decision with its reason in a
comment in `kernel/flowKinds.ts`: a decision never waits on a story; nothing waits for the plate; everybody may wait
for the submit and it waits for nobody.

**L15 · The product invariants of `CLAUDE.md` outrank everything here** — never detect a prompt by its title
(`promptIdentityKey`), availability is the server's, no auto-select, truth before story, one motion system
(`motionMs()` for every duration handed to the kernel too).

---

## 3. How to CHECK a change (the procedure)

```bash
# the two ledgers + the kernel's law — seconds
npx mocha --import=tsx --require tests/testing/setup.ts \
  tests/console/kernelCoverage.spec.ts tests/console/architectureDebt.spec.ts "tests/console/kernel/*.spec.ts"
# everything static and unit about the console — under a minute
npx mocha --import=tsx --require tests/testing/setup.ts "tests/console/**/*.spec.ts"
npm run lint:client                                   # vue-tsc — the ONLY thing that types templates
npm run build:test                                    # types the test tree; and a .ts may not import a NAMED export of a .vue
npm run test:client && npm run test:server            # nothing heavy beside them (a starved run gives false 2 s timeouts)
npm run e2e:affected                                  # then the listed specs on the Steam Machine (never a local browser)
```

Then read the diff for what no ledger can see:

| Look for | Why it is a finding | Law |
| --- | --- | --- |
| `owner.after(…)` whose callback calls `resolve` / `done` / `finish` / a `release…()` / removes a class from an element the owner does not own / `$emit`s something a parent awaits | a release that can be taken back | L1 |
| `owner.guarantee(…)` whose callback starts a tween, submits, opens a surface, `console.warn`s | a dead flow acting; a false warn at game exit | L1 · L3 |
| `const x = consoleSessionScope()` at MODULE scope, or kept across an `await` of unknown length | a dead root: the session may have ended | §1 |
| `consoleSessionScope()` in a service that lives across games (a socket, a poller, a menu) | taken back when the game screen leaves | L4 · L10 |
| a new module-level `reactive(…)` / `ref(…)` of game state with no run, no `sessionState`, no `scopedState` | state nobody ends | L11 |
| a new `let resolveX: (() => void) \| undefined` + `new Promise((r) => { resolveX = r; })` | a resolver mailbox: every exit path must call it | §1 (signal / run) |
| `await something.finished`, `await new Promise(…)` with no bound in a flow | a wait outside the table | §1 |
| `run.begin()` without a `run.end()` on EVERY path that lowers the flag (early `return`s, `catch`) | a run that outlives its flow until the session ends | L6 |
| `watch(…, {flush: 'sync'})` / a kernel `until` that ACTS (closes, opens, submits) | wrong place in the tick | L12 |
| a new `registerWaitSource` / `registerLivenessRelease` / `registerTruthWitness` / `$refs` in a controller / `task.deferred =` | a frozen mechanism (the debt ledger fails) | §5 |
| a unit spec stubbing `window.setTimeout` / `requestAnimationFrame` to drive a client timer | it sees nothing: drive the kernel's clock | §4 |
| a guard spec that greps the source for `setTimeout(` / `delayedCall(` | blind since the coverage phase: it must read `.after(` / `.guarantee(` / `motionAfter(` | — |
| a removed / renamed `data-*`, class or RU string an e2e spec waits for | `e2eLiveness.spec` fails — fix the spec in the same diff | CLAUDE inv. 14 |

A finding is written as: **file:line — the law — the path that breaks it** («`fooDirector.ts:212` — L1 — the safety
is `run.after(…, finish)` and `finish` resolves the promise `runFoo()` returns: an abort ends the run first and the
transport's gate then waits out its own maximum»). A finding with no concrete path is a question, not a finding.

---

## 4. How to TEST a flow

- **Drive the kernel's clock**, never the platform's:
  `const clock = createManualClock(0); setFlowClock(clock); … clock.advance(ms); … setFlowClock(undefined);`
  (`@/client/console/kernel/flowClock`; a frame is 16 ms of it; `clock.pending()` is what still stands).
- **Read the tree and the table**: `dumpFlowTree()` (`kind:label#n 4.2s detail ⟵ waits «…»`), `waitTable()`
  (`{owner, ownerKind, family, what, boundMs}`), `liveScopeCount()`.
- **A session in a spec**: `beginConsoleSession()` … `leaveConsoleSession()` (the declared states) …
  `endConsoleSession()` (the scopes); `resetFlowKernel()` + `resetConsoleSession()` in `beforeEach`.
- **What every flow's spec states**: ① it ends by every path (done · aborted · its session left) and nothing of it
  stands afterwards (`waitTable()` has no row of it, `clock.pending()` is what you expect); ② a release comes due when
  the owner ends first; ③ a pacing step does NOT; ④ re-entry while it stands (a second `begin`) ends the first.
- **Models to copy**: `tests/console/flowRun.spec.ts` (a run, a derived run), `holdRuns.spec.ts` (holds end with the
  session), `consoleSession.spec.ts` (session states, the pass), `scopedState.spec.ts` (a latch),
  `kernel/flowScope.spec.ts` (every primitive), `kernel/flowKernel.property.spec.ts` (the model-based property test),
  `workspaceConclusionOwe.spec.ts` (a debt as a run in a frame's scope), `submitMachine.spec.ts` +
  `tests/client/console/gameTransportFunnel.spec.ts` (the funnel), `tests/client/console/useFlowScope.spec.ts` (a
  component's owner).
- **e2e**: the harness harvests `[flow]`, `[wait-graph]`, `[liveness]`, `[workspace-stale]` lines per test; a
  `[flow] … threw` or a `[workspace-stale] concluded` in a green run is a defect upstream — report it, do not ignore it.

---

## 5. What is FROZEN — the debt ledger (`tests/console/architectureDebt.spec.ts`)

The coverage ledger is empty: nothing waits outside a scope. What is NOT yet on the framework is the shell's own
decision logic — and every mechanism of it is counted, frozen, and has its kernel form in its row (`FROZEN[name].
instead`). **A file may not gain a use; a new file starts at zero.** When you touch a site and the conversion is
local, convert it and run `npm run debt:architecture`.

| Row | What it is | The kernel form | Retires with |
| --- | --- | --- | --- |
| `wait-source` | a hand-written source of the legacy wait graph | the flow's waits are kernel waits — the table is the graph | C3 · the observer on `waitTable()` |
| `wait-recovery` | a door a sampled finding calls | the wait is bounded where it is declared; the owner's end is the recovery | the net that calls it (§6 of PLAN) |
| `liveness-rung` | a rung of the arbiter's release ladder | the thing has an owner with a bound | field evidence that the rung is idle |
| `truth-witness` | a polled «is the player being lied to?» | the lie is a `story` scope / a hold; a level (`until`), not a watched edge | S6 |
| `set-aside-writer` | a write of the one «set aside» boolean | a record owned by what was set aside (it is already a scope of the tree: `step:set-aside`) | S4 |
| `surface-by-ref` | a surface reached through `shell.$refs` | the surface registers what it offers while mounted | S3 |
| `view-apply-write` | another domain's latch reset by the view-apply reaction | the latch ends with its submit / its prompt / its run | S4 · S6 |
| `resolver-mailbox` | a promise whose resolver is a module variable | a run's end; `createFlowSignal` + `signalled` under a bound | S6, per module |
| `controller-latch` | a bare latch `ref` in a controller | `scopedState` | done — one clock left |
| `supervisor-port` | a fact a net samples in the shell | a bound on its owner | the nets (§6 of PLAN) |

Also frozen by their own guards: the shell's size and its `watch` table (`shellControllers.spec.ts` — the shell only
shrinks; every row only delegates), the machines (`flowMachineRegister.spec.ts`), the Parliament's timers
(`parliamentNoTimers.spec.ts` — none), ceilings (`ceilingWaitGuard.spec.ts`).

**What «frozen» means for a fix.** A bug that sits in a frozen mechanism is fixed by moving the piece it touches onto
the kernel — a latch becomes a `scopedState` with its true owner, a missed edge a level, a sampled fact a bound of
its owner — never by one more rung, witness, door, flag or watch row. If the fix cannot be made that way in the
slice, say so in the PLAN's §0 list instead of growing a baseline.

---

## 6. Reading a freeze from the field

- `window.__conFlow()` in the page (or the field export): `tree` (every scope with its age, its state and what it
  waits for), `waits` (every row), `trace` (the last records), `stats`. The heartbeat carries a `flow` digest for
  every second the screen stood still.
- A scope that stands with an age out of proportion to its name IS the finding: `scene:hold:played-hero#4 41s`,
  `step:commit-fold-owed#7 38s`, `story:owed:board-beat-park#2 22s`, `step:set-aside#3 95s` with no restore card.
- `[flow] <scope> — <detail>` is a kernel anomaly (a callback that threw, a wait refused as a cycle, a bound that
  ended a wait): each names the scope and its ancestry.
- Then, as before: the wait graph's `[wait-graph] …` lines and the arbiter's `[liveness] …` — the nets the
  architecture is retiring; a line from them is a place where an owner should have ended something and did not.
