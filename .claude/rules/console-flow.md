---
description: Console architecture v2 — the flow kernel (scopes, bounded waits, machines), the lifecycles already on it, and how to add to them.
paths:
  - "src/client/console/kernel/**"
  - "src/client/console/transport/**"
  - "src/client/console/consoleWorkspaceStack.ts"
  - "src/client/console/consoleWorkspaceFrame.ts"
  - "src/client/console/consoleWorkspaceOutcome.ts"
  - "src/client/console/consoleWorkspaceClaim.ts"
  - "src/client/console/consoleMandatoryAnnounce.ts"
  - "src/client/console/consoleMandatoryGate.ts"
  - "src/client/console/workspaceConclusionOwe.ts"
  - "src/client/console/shell/**"
  - "src/client/console/session/**"
  - "tests/console/kernelCoverage.spec.ts"
  - "tests/console/kernelCoverageBaseline.json"
  - "src/client/console/supervisor/**"
  - "tests/console/shellSource.ts"
  - "src/client/components/console/ConsoleShell.vue"
  - "scripts/shell-extract.mjs"
  - "scripts/shell-extract/**"
  - "tests/console/kernel/**"
  - "docs/claude/console/architecture-v2/**"
---

# Console flow rules (architecture v2)

The console client is being moved off implicit lifecycles (flags + watchers + timers + callbacks) onto ONE footing.
Plan and hand-over state: `docs/claude/console/architecture-v2/PLAN.md` (§0 says what is done). Kernel contract:
`docs/claude/console/architecture-v2/KERNEL.md`. **New lifecycle code is written on the kernel — never a new flag pair,
a new safety timer, or a new watcher mailbox.**

**Before writing or reviewing console lifecycle code read `docs/claude/console/architecture-v2/REVIEW.md`** — the
«I need to … → primitive» table, the sixteen laws a review checks, how to test a flow, and what is frozen.

**Where this work sits in the project's road** (`CLAUDE.md` § North star; `docs/claude/vapor/ROADMAP.md`): architecture
v2 is stage **V2** of the road to a global `createVaporApp(App)` — after the Vue 3.6 pilot (V1), before the rework of
every component (V3). It is the half of that rework that changes BEHAVIOUR: what it takes out of the components (logic
in `methods`, lifetimes in hooks, `$refs` between surfaces, the shell's `watch` table) is exactly what would make them
expensive to convert. So a slice here is also judged by what it leaves in the component: **a controller / a module is
written so that the component above it could be `<script setup>` tomorrow** — it takes refs and plain functions,
never `this`; it reaches a surface through a registration, never a `$ref`; it adds no `getCurrentInstance()`.

## Two ledgers — both must stay green
- **`tests/console/kernelCoverage.spec.ts`** — nothing in `src/client` WAITS outside a scope. Its baseline is empty.
- **`tests/console/architectureDebt.spec.ts`** — what still runs on a mechanism the kernel REPLACES is counted and
  FROZEN: a file may not gain a use, a new file starts at zero, each row prints the kernel form to write instead.
  Since 2026-11-12 the DECISION rows are all **RETIRED — guarded at zero, they do not come back**: a `$refs` read in a
  controller (→ the surface registry), a write of «set aside» (→ the two verbs), a latch reset by the view-apply
  reaction (→ the question's scope), a resolver mailbox (→ `owedAnswer`), a bare latch `ref` (→ `scopedState`). What
  is still FROZEN is the supervisory layer — the NETS (a wait-graph source or door, a liveness rung, a truth witness,
  the supervisor's port): each retires on field evidence (PLAN §6), none is added. **A fix inside a frozen mechanism
  moves the piece it touches onto the kernel** — never one more rung / witness / door / flag / reaction row.
  When a count drops: `npm run debt:architecture`. PLAN §11 is the table.
- **An answer somebody waits for is `owedAnswer(label, {owner, orphaned})`** (`console/session/owedAnswer.ts`) —
  never `let xResolve: (() => void) | undefined`. `arm(resolve)` · `armed` · `settle(…)` · `drop()` · `take()`
  (hand it over for after your own cleanup) · `owes(fn)`: a step of the flow tree while owed, given once, and CLOSED
  when its owner ends — released with `orphaned()` (`() => []` for a promise somebody awaits: a gate, a scene's end)
  or dropped (a pick whose caller left with the screen). Name the narrowest true owner (`() => run.scope`): the
  waiting side is then released by EVERY ending of that run and no exit path has to remember it.
- **A controller reaches a surface by NAME** — `shell.surfaces.at<T>('handSection')` (`shell/surfaceRegistry.ts`;
  the template stands it with `:ref="surfaces.bind.<name>"`), never `$refs`. A new surface is a name in
  `SURFACE_NAMES`.
- **The server's question is a scope** — `questionScope()` (`session/questionScope.ts`; `advanceQuestion(key)` in the
  view-apply reaction opens the next one FIRST, then ends the one that stood). What exists only for the question (a
  branch sent to place, a client-built payment, the composer, a pick) is `scopedState(label, rest, questionScope)` and
  falls by itself — with `{outlives}` when the question's own ANSWER still needs it after the server moved on. The
  view-apply reaction lowers NOTHING by hand: each domain reconciles itself in its own controller.
- **«Set aside» is a record with two verbs** — `setQuestionAside(what)` · `takeUpQuestion(why)`
  (`console/setAside.ts`); `consoleState.task.deferred` is its read-only projection (an assignment is a compile
  error). Parked ⇒ set aside is the record's own rule.
- **What a module ARMS for a press declares its unwind** — `onPressUnlanded('<label>', abortX, <at>)` at module
  scope (`console/transport/pressUnwind.ts`); the transport's refusal / lost-answer path runs ONE ordered pass
  (`unwindUnlandedPress()`) and holds no list of modules (`pressUnwind.spec`). **What holds a finished workspace open**
  (beyond a nested frame, its claim, a prompt it serves) is ONE row of `FRAME_HOLDS` (`shell/outcomeController.ts`)
  — read by the conclusion AND by the ghost test; the row says whether a phantom can hide behind it
  (`workspaceHolds.spec`). Never a list of other modules kept in somebody else's file.
- **A latch is `scopedState(label, rest, owner?)`** (`console/session/scopedState.ts`) — the same `Ref`, but every
  raised span is a `step` scope: it falls back to rest when its owner ends and the tree names it with its age. Name
  the narrowest true owner (`() => workspaceFrameScope(kind)`, `() => run.scope`); the session is the default.

## The five rules
1. **A run of anything with a lifetime is a `FlowScope`**, opened in the scope of what it must not outlive; what it
   acquires is `scope.defer(...)`-ed; it ends once. No `begin…` / `release…` pair joined by a callback.
2. **Async work is `scope.run(label, task, {bound})`** — a throw is that child's `failed` end, said once.
3. **You wait through `scope.wait(target, {bound})`** — the bound is required, the result (`met | bound | cancelled |
   cycle`) is handled. No `Promise.race` against a `setTimeout`, no `await` of a bare animation promise.
4. **Waiting for another flow's end goes through `flowKinds.WAITS_ON`** — the table is a DAG (spec); a new pair is a
   design decision with its reason in a comment. A decision never waits on a story; nothing waits for the plate.
5. **A lifecycle with a protocol in time is a machine in a scope** (`startFlowActor`), registered in
   `kernel/flowMachines.ts`; every state is `rest` · `player` (+ `meta.accepts`) · `beat` (+ `after` + `meta.waitsOn`).
   `tests/console/kernel/flowLaw.spec.ts` judges the definition and the reachable snapshots;
   `flowMachineRegister.spec.ts` fails on an unregistered `createMachine(`.

## Timers, frames and runs — nothing waits outside a scope (PLAN §10)
- **No raw `setTimeout` / `setInterval` / `requestAnimationFrame` / `delayedCall`-as-a-timer in CLIENT code** — the
  console, and the shared layer under it (`src/client/**`). The ledger (`tests/console/kernelCoverage.spec.ts` over
  `kernelCoverageBaseline.json`) counts them per file: a file may not grow, **a new file starts at zero**, and the
  baseline is EMPTY — the whole client waits on the kernel. The two files that may hold a raw primitive are named in
  the spec's `DEVICE_CLOCKS` with their reason and their exact count (the gamepad's sampling loop and its one
  coalesced frame: a device driver is not a wait, and the kernel's clock is not free per tick) — a new row there is a
  decision to defend in review, not a place to park a timer.
- **Pick the OWNER first**: the run the wait serves — a module flow's (`createFlowRun(label, {orphaned})`), a hold's
  (`beginAnimationHold(…).scope`), a frame's (`workspaceFrameScope(kind)`), a submit's; a component's own
  (`setup() { return {flow: useFlowScope('<label>')}; }`); the session's (`consoleSessionScope()`) only for what
  outlives every flow by design.
- **PACING or RELEASE — decide before you type.** «Do the next thing later» (a step, a safety that ABORTS, a poll)
  is `owner.after(ms, what, run)` / `owner.afterFrame(what, run)`: it must NOT run once the owner is gone. «Let
  something go later» (a promise somebody awaits, a gate's resolver, a hold, a flag that marks) must happen even when
  the owner ends first — `const disarm = owner.guarantee(ms, what, release)` (called at `ms` or at the owner's end,
  once; `disarm()` when the thing came by itself), or a span `await owner.sleep(ms)`; it never rides a timer that can
  be taken back. A `const safety = setTimeout(finish, budget)` … `clearTimeout(safety)` beside a tween is a
  `guarantee`.
- **The idioms have names** (`console/session/sessionWaits.ts`): «two painted frames» is `await whenPainted()` (a
  bare double `requestAnimationFrame` promise never resolves in a window that does not paint); «a beat of stillness»
  is `await span(ms)`; a measure loop's tick is `probeTick(fn)` (never a bare frame: a poll counted in frames stands
  for ever on a quiet compositor); a poll against a ceiling is `await untilCeiling(spec, read, owner)`; a frame loop
  (a counter's interpolation) is `owner.everyFrame(what, tick)` with a `guarantee` beside it for what must happen
  when no frame comes.
- **A beat that paces TWEENS rides GSAP's clock, with an owner** — `motionAfter(ms, what, run, owner?)` (pacing) ·
  `motionGuarantee(ms, what, release, owner?)` (release) · `await motionSpan(ms, owner?)` (`session/sessionWaits.ts`):
  a bare `gsap.delayedCall` has no owner; a wall-clock timer beside a tween fires early on a starved frame (GSAP's lag
  smoothing stretches the tween, not the timer). Never move a `delayedCall` onto `after` / `guarantee` — keep its
  clock, give it an owner.
- **In a COMPONENT** the owner is the component: `const flow = useFlowScope('<kebab-name>')` in `<script setup>` (the
  form of every new component), or `setup() { return {flow: useFlowScope('<kebab-name>')}; }` in an Options-API one, then
  `flow.after(…)` / `this.flow.after(…)` / `.afterFrame(…)` / `.guarantee(…)`; the `beforeUnmount` list of
  `clearTimeout`s goes with it. **The scope is parented by WHERE THE COMPONENT STANDS** (`componentSessionScope`):
  inside a console shell — that shell's session; outside any shell (a menu, an app-level layer beside the shell, a
  bare mount in a spec) — the page's scope. Never «the session that stands»: an app-level layer set up while a game is
  on screen would lose every timer when that game's screen leaves, and live on. **⚠ The setup key SHADOWS a member of
  the same name** (`data` / `computed` / `methods` / `props`) at run time, silently — vue-tsc does not see it. A
  component that already has a `flow` (its module's flow state — the Parliament section, the deck pick, the hydro
  section) names the key `flowScope`; the ledger fails on a collision. **The scope is LAZY** — opened by the first
  thing asked of it — so a leaf component with hundreds of instances (a board cell, a card's art, a journal chip)
  costs nothing and writes nothing to the flow trace until one of them actually waits. **It is bound to the caller's
  EFFECT SCOPE and the injection context — never to a component instance** (Vue 3.6: `getCurrentInstance()` is `null`
  inside a Vapor component), so the same call serves a virtual-DOM component, a Vapor one and a composable run in a bare
  `effectScope()` (a controller under a spec, no mount): it ends on the component's `unmounted` edge, with the scope's
  disposal as the net under the hook, and at once when a bare scope stops. The test for each callback:
  **does anything OUTSIDE the component depend on it running** — a promise's `resolve`, a module function, a hold's release, a class on `document.body`, an `$emit` a
  parent waits for? Then it is a RELEASE (`this.flow.guarantee` — it also comes due at unmount). If it only touches
  the component's own state or refs it is PACING (`this.flow.after` — taken back at unmount).
- **In a MODULE with no run of its own** (a director, a state module's one stray timer) the owner is
  `consoleSessionScope()` and the default is a RELEASE (`guarantee` / `span` / `whenPainted`): the sequence that
  awaits it runs out on its own terms when the game screen leaves, exactly as it did on a raw timer — only an
  ABORT-style safety («nothing answered — recall») or a poll that should die with its flow is `after`, and a module
  that has that many of them wants a run (`createFlowRun`).
- **What lives as long as the PAGE** (the gamepad's poll, the layout profile, the loading curtain, the campaign's
  channel, a menu's own beat, the field recorder) is owned by `consoleAppScope()` — never by the game session, which
  would take it back (or release it) when a game screen leaves.
- **A safety that WARNS when it fires** («never signalled ready in N ms») must not come due at the owner's end — it
  is `after` plus a `defer`-ed silent release, never a `guarantee` whose release prints the warn.
- **A tick is `owner.every(ms, what, tick)`** (a sampler, a heartbeat, a poll chain — one row for its life, stopped by
  its handle, by its own `false`, or with its owner; a tick that throws is said and the tick goes on). A LIVENESS
  chain — the transport's poll, a reconnect — is never a pacing timer of a scope that can be re-homed under it: it is
  a `guarantee` of its own root (`transportScope().guarantee(ms, 'the poll\'s next look', askForUpdate)`), disarmed
  by its teardown.
- **A flow whose state has MANY WRITERS is a DERIVED run** — `deriveFlowRun(label, () => state.promised ||
  state.live, {orphaned})` (`session/flowRun.ts`): a sync watcher that only records opens and ends the run with the
  flag, so no writer can forget it (the Parliament's walk / rally / quest, the board's story, the terraformed scene,
  the loading curtain). One writer → `createFlowRun` with `begin` / `end` beside the flag.
- **A remote queue is a run too** (`consoleRemotePlacement`, the nomads' remote leg): opened by the first staged
  event (`remoteRun.scope ?? remoteRun.begin()`), ended where the queue drains or aborts; its links of an `await`
  (the settle before a landing, the next look at a covered board) are `guarantee`s of `remoteRun.scope ??
  consoleSessionScope()` — never `remoteRun.begin()` from inside a look (a look after the end must not open a run).
- **A module flow's run is a scope** — `run.begin()` where it starts, `run.end()` beside every line that lowers its
  flag, its timers `run.after` (no timer id, no `clearTimeout`), its beats `await run.sleep(ms)` (over at once when
  the run is aborted — re-check the flag after it), `orphaned` = its abort (the session ended under it). **Its hold
  stays a SUPPLIER derived from state** — never turn a supplier into a handle: derived cannot diverge.
- **`await` of a frame is `scope.wait(frames(n), {bound})`** — a raw rAF promise never resolves in a window that does
  not paint; a poll built on it never re-reads its own deadline.
- A new flow-state module (`reactive` state with a `live` / `active` flag) whose run is not a scope fails the ledger
  (a flag that is NOT a lifetime — a cursor's on/off — is declared in the spec's `NOT_A_FLOW` with its reason).
- **A registry the nets read is a VIEW of the tree, never a second book**: a hold is `scene:hold:<label>`, a ceiling
  wait (`beginCeilingWait` / `raceCeiling` / `untilCeiling`) is a row of the session's wait table bounded by its
  ceiling, an owed story of the presentation ledger is `story:owed:<id>` — each ends with its session. A new registry
  of «things somebody waits for» opens scopes / notes rows (`scope.note(what, withdraw, boundMs)`); it does not keep
  a Map that the session cannot end.

## A decision that ACTS has a place in the tick
- **What the tick IS, is written down and pinned** (the Vue 3.6 pilot — `docs/claude/vapor/ROADMAP.md` §3.5;
  `tests/console/vueReactivityContract.spec.ts`, `tests/client/console/vueTickOrder.spec.ts`): a watcher of no
  component runs before every component's; the watchers of ONE component run in the order their sources were
  TRIGGERED (the `watch` block's order decides only between watchers of the SAME source); a reaction woken by a
  reaction runs after the waiting ones and before the render; sync watchers of one source run in creation order.
  All of that is identical on 3.5 and 3.6. **What is NOT a contract: which of several reactions ONE mutation of a
  collection wakes first** (its `length` reader, its iterator, a key reader) — it flipped between the two versions.
  A flow whose correctness needs that order is ONE reaction with the order in its body — never two watchers.
- A reaction taken off the reactions table (`shell/shellReactions.ts`) loses its ROW — and the row was its place in the tick. The facts of one
  decision routinely move in two steps inside one tick (a door falls, a reaction of the shell then stands the step
  up); read between the two, the decision is wrong. Both free forms were tried on the box and both failed e2e: a
  watcher of no component, pre-flush, runs BEFORE every component's watchers (Vue 3.5) — the owed conclusion closed
  the hand under its own colony step (`console-multi-effect-sequence`); post-flush runs after the RENDER — a second
  DOM patch in the tick split the Pluto trade's closing beat (`console-colony-pluto-embed`).
- **So: a decision that ACTS (closes a workspace, opens a door) is asked from a row of the shell's REACTIONS TABLE**
  (`console/shell/shellReactions.ts` — what the `watch` block was) — a watcher of the game screen, among its own,
  before the render. The kernel's `until` (sync) is for a wait that only RECORDS. The table IS «the session's place
  in the tick» (S-last): it is installed by the shell's composition after every controller's own watchers, in ONE
  order, and its rows are watchers of the component that stands — virtual-DOM today, Vapor tomorrow (a `watch` in
  `setup` is the same call in both). Never improvise a second place per reaction.
- **«A decision owed» is a run, not a mailbox** (`console/workspaceConclusionOwe.ts` is the model): opened in the
  scope of what owes it; re-asked on the key of the SAME facts object the decision is made from (never a second,
  hand-written list of its ingredients — the row watches that key); bounded by its re-ask cadence; gone with its
  scope.

## The submit transport (lifecycle 4 — on the kernel)
- **One submit = one scope + `submitMachine`** (`sending` → `presenting` → `applied | staged | refused | failed |
  silent | abandoned`). The funnel is busy exactly while that scope lives; `transportState` / `transportHolds` /
  `root.isServerSideRequestInProgress` are its MIRRORS — never write them outside `gameTransport.ts`.
- **`submitInput` / `submitBatch` / `cancelPlacement` return a `SubmitTicket`.** `accepted: false` = the funnel was
  busy, nothing was sent: put back NOW whatever you armed for the press. `ticket.settled` / `onSubmitSettled` resolve
  exactly once however the submit went — reset a surface-local «submitting» state there, not on a watcher that hopes
  for a view change.
- **A cinematic gate is `gate(submit, hold, () => run…())`** inside `presentAnswer` — never a bare
  `transportHolds.x = true; await …`. The hold is the child's life; a scene that throws, never ends or outlives
  `GATE_MAX_MS` does not hold the submit: the commit goes on. Keep the documented ORDER of the gates; a flag that must
  stand until the commit is `{keep: true}`.
- A gate's `false` means the SUBMIT is over — `return 'over'`, apply nothing.

## The workspace frame (lifecycle 2) and the outcome claim (lifecycle 1)
- **A frame is a scope** — `workspaceFrameScope(kind)` (one answer for the live stack, the park and aside for the
  board). What belongs to a frame is opened / `defer`-red THERE: it ends with the frame by every verb. Never a watcher
  of the shape «if my frame is gone, reset my flag».
- **A verb that moves or removes frames ends with `syncFrameLifetimes()`**; a frame's phase is written only through
  `writeFramePhase` (`setWorkspaceFramePhase` outside the stack) — the record's `phase` is the `frameMachine`'s mirror.
- **A beat (`executing` · `completing`) is bounded on stage** and LEASED to the press made in the same synchronous
  stretch: a press that did not land puts the frame back. Cross the commit boundary and submit in ONE stretch — a
  frame put in `executing` for a submit that is sent after an `await` is not leased (roll it back yourself on
  `ticket.settled`).
- **A claim is bound to its host frame's scope** (`consoleWorkspaceOutcome.bindClaimHost`): never sample «is the host
  still somewhere». Its timers are `claimMachine` states — a new backstop is a state with an `after`, never a module
  `setTimeout`. `stage` / `beatDone` / `arrivalDone` of `workspaceOutcomeState` are mirrors: write them through the
  facade's functions only.
- Specs: `tests/console/workspaceFrameLifetime.spec.ts`, `tests/console/workspaceClaimLifetime.spec.ts`.

## The announce plate (lifecycle 3)
- **One run per beat key** (`consoleMandatoryGate` starts and ends it; `announceMachine`): `pending` is a BEAT with its
  own bound, past it the plate's door runs. The three keys of `mandatoryGateState` keep their writers — each tells the
  machine in the same call. Spec: `tests/console/mandatoryAnnounceRun.spec.ts`.

## THE SHELL IS LAYOUT — `console/shell/` (S-last, 2026-11-12)
- **`ConsoleShell.vue` is its template, the components it renders, its props and ONE line of `setup`** —
  `return useConsoleShell(props)`. It has NO `data`, `computed`, `methods`, `watch` or hooks, and nothing in it says
  `this` (guarded — `shellControllers.spec.ts`). The composition is three modules: `shellMembers.ts`
  (`composeShellMembers` — the mirrors of module state, the shell's own template refs, the surface registry and every
  controller, constructed in ONE order and spread into the object the template reads), `shellReactions.ts` (the
  ordered reactions table), `useConsoleShell.ts` (session → members → port bound → reactions → the two wiring hooks,
  registered LAST). It asks for no component instance: the same composition runs under a virtual-DOM component, a
  `<script setup>` / Vapor one, or a bare `effectScope()`.
- **New shell behaviour is a CONTROLLER member** — a domain's state, derivations and verbs live in
  `create<Domain>Controller(shell: <Domain>Port)` (Composition API — `ref` / `computed` / functions, no `this`),
  constructed in `composeShellMembers` (a new controller goes at the END — construction order is the order of its
  watchers and hooks) and spread into its return. What the game screen registers with other modules while it stands
  (probes, suppliers, leases) is the `wiring` controller's `shellMounted` / `shellLeaving`.
- **The PORT is the controller's whole dependency on the rest of the shell** — typed, explicit, `readonly` unless the
  row says WRITTEN. It is served by ONE late-bound object (`shellPort.ts` — `port.as<XPort>()`): the members every
  controller returned (a `Ref` read and written through), the props, `$nextTick` — **not the component instance**.
  `shell.x` for anything not in the port is a compile error; `shellPortsConform(shell)` in `shellMembers.ts` is the
  proof (plain tsc and vue-tsc) that the composed shell provides every port. Narrow a port when you touch a
  controller; never widen one to reach «just one more» member without asking whether the member belongs to this domain.
- **A controller is built before the shell exists**: reading `shell.…` AT CONSTRUCTION throws, by name — only inside
  a `computed`, a function or a hook. A WRITTEN row names a ref (a write to a function, a mirror or a prop is
  refused). Its own lifecycle (a registration, a listener) is `onMounted` / `onBeforeUnmount` inside the controller.
- **Taking an Options component apart is mechanical** (the next monolith's V3 wave): `node scripts/shell-extract.mjs
  report|apply <sfc> <spec.json>` (the header of the script is its manual; PLAN §5 · S2 the procedure; S-last the
  recipe for the last step — hooks become methods, `$el` a template ref, `$watch` a `watch`, then the `watch` block
  becomes an ordered table of `watch()` rows). It refuses what cannot be moved verbatim (a bare `this`, an eager data
  read, a local shadowing the port) and aliases a member whose name also occurs free (`ownX`).
- **Every domain of the shell is out** — 34 controllers (the last one `wiring`); PLAN §5 · S6 has the table of their
  ports (the big ones are the knots: `padRouter`, `commandBar`, `router`, `outcome`, `mandatory`). They are ordinary
  source: edit them by hand. `scripts/shell-extract/` keeps the inputs of that one-time extraction (the tool reads an
  Options component — it has nothing left to read in the shell).
- **The composition is guarded** (`tests/console/shellControllers.spec.ts`): the SFC's options are exactly `name` ·
  `components` · `props` · `setup`; the composition keeps its order and asks for no instance; one member, one owner
  (two controllers returning a name, or a name both returned and declared by the shell itself — a prop, a mirror, a
  ref of its own — is a silent shadow); no template `ref="x"` named like a member (Vue would write the element into
  it); every controller constructed once and spread; every port has its conformance row; no named import from a
  `.vue`; the mirrors and the reactions only shrink.
- **The reactions are a TABLE, in its order** (`shellReactions.ts`). Every row is
  `watch(() => shell.<member>, (v) => shell.when<Key>Changes(v)[, {options}])`; the reaction's body is the function
  in its domain's controller. Never reorder the rows, never put a body in one — creation order is load-bearing; a
  new reaction is a level-triggered decision in its controller, not a new row.
- **A `.ts` module cannot import a named export of a `.vue` file** (plain tsc — the production build's checker —
  sees `*.vue` through the shim; `vue-tsc` does not catch it): a type an SFC shares with a controller lives in a
  sibling `<component>Types.ts` (the SFC imports and re-exports it), and what a controller reads off a surface's
  instance is typed BY NAME there (the instance itself is `any` to plain tsc). After a shell slice run BOTH
  `npm run lint:client` and plain tsc over `src/**/*.ts` (or `npm run build`).
- **Source guards read the shell's code through `tests/console/shellSource.ts`** (`shellCode()` — the SFC and every
  controller, in the monolith's dialect), never `ConsoleShell.vue` by path: a member that moved is still found, in
  the same words. A product table that names a FILE (`COPIED_ACTION_STANCES`) is updated in the diff that moves it.

## The session (`console/session/consoleSession.ts`)
- **One root per game screen, with an identity.** The shell's `setup()` opens `session:game#n`
  (`useConsoleSession`) and ends THAT one on `unmounted`; everything on the kernel ends with it — every hold among
  them (taken down through its `expire`). A flow is opened inside `consoleSessionScope()`, asked every time — never
  cached: with no game screen up it answers the LOBBY's root (the menus, the campaign, a spec), which a game that
  comes and goes does not end. A module that keeps a root of its own goes through `sessionChild(held, kind, label)`.
- **Module state of the running game DECLARES itself** — `sessionState('<label>', resetX, <at>)` at module scope,
  beside its own reset — and the leaving shell says ONE thing: `leaveConsoleSession()` (its `beforeUnmount`, after it
  dropped its own probes and suppliers) takes every declared state down in one ordered pass; a reset that throws is
  said and the pass goes on. **The shell's `beforeUnmount` holds NO `reset…()` / `abort…()` row** (the ledger's ⑤ is
  zero and may not grow). `at` is the state's place in the pass, and the pass is a total order (two states never share
  a label or a number — guarded): the order matters (a scene's abort recalls what it staged; the stack falls before
  the picks that pop their frames from it), so a new state takes a free number beside its family. A flow whose whole
  state is its RUN declares nothing — `orphaned` is its ending. (`onConsoleSessionEnd(reset)` is the one-shot form,
  for a reset that belongs to ONE session.)
- **Two edges, in this order:** the shell's `beforeUnmount` → `leaveConsoleSession()` (module state, while the
  shell's children still stand); the shell's `unmounted` → the session's SCOPE ends (every flow, hold, timer and wait
  of the game — after the children's own scopes). A `guarantee` of the session therefore fires AFTER the resets: its
  release must be the idempotent «let go» it is named for, never a step that re-arms state.
- **The supervisor** (`console/supervisor/supervisorController.ts`) is the one sampler. Its PORT is the list of what
  the nets read of the shell — it only shrinks; a new net is a state with an `after` in a machine, not a new row.

## Specs of the transport
- `tests/console/submitMachine.spec.ts` (the protocol, on a manual clock),
  `tests/client/console/gameTransportFunnel.spec.ts` (the funnel with a fake root / fetch — use
  `__setTransportPresenterForTesting` to play a scene of your own as a gate).
