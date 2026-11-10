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
  - "src/client/console/shell/**"
  - "src/client/console/session/**"
  - "src/client/console/supervisor/**"
  - "tests/console/shellSource.ts"
  - "src/client/components/console/ConsoleShell.vue"
  - "scripts/shell-extract.mjs"
  - "tests/console/kernel/**"
  - "docs/claude/console/architecture-v2/**"
---

# Console flow rules (architecture v2)

The console client is being moved off implicit lifecycles (flags + watchers + timers + callbacks) onto ONE footing.
Plan and hand-over state: `docs/claude/console/architecture-v2/PLAN.md` (§0 says what is done). Kernel contract:
`docs/claude/console/architecture-v2/KERNEL.md`. **New lifecycle code is written on the kernel — never a new flag pair,
a new safety timer, or a new watcher mailbox.**

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

## The shell is being taken apart — `console/shell/*Controller.ts`
- **New shell behaviour is NOT a new member of `ConsoleShell.vue`.** A domain's state, derivations and verbs live in
  `create<Domain>Controller(shell: <Domain>Port)` (Composition API — `ref` / `computed` / functions, no `this`); the
  shell's `setup()` constructs it and spreads it, so the template, the watchers and the remaining options read its
  members under the same names.
- **The PORT is the controller's whole dependency on the rest of the shell** — typed, explicit, `readonly` unless the
  row says WRITTEN. `shell.x` for anything not in the port is a compile error; `shellPortsConform()` in the shell is
  the proof the shell still provides every port (vue-tsc). Narrow a port when you touch a controller; never widen one
  to reach «just one more» member without asking whether the member belongs to this domain.
- **A controller is built in `setup()`, before the options exist**: never read `shell.…` at construction — only inside
  a `computed`, a function or a hook. Its own lifecycle (a registration, a listener) is `onMounted` /
  `onBeforeUnmount` inside the controller, not a row of the shell's hooks.
- **Moving members out is mechanical**: `node scripts/shell-extract.mjs report|apply <sfc> <spec.json>` (the header of
  the script is its manual; PLAN §5 · S2 the procedure). It refuses what cannot be moved verbatim (a bare `this`, an
  eager data read, a local shadowing the port) and aliases a member whose name also occurs free (`ownX`).
- **The `watch` block is a TABLE, in its order.** Every watcher is `key(v) { this.when<Key>Changes(v); }`; the
  reaction's body is the method (it moves with its domain). Never reorder the rows, never put a body back in one —
  creation order is load-bearing; a new reaction is a level-triggered decision in its controller, not a new row.
- **A `.ts` module cannot import a named export of a `.vue` file** (plain tsc — the production build's checker —
  sees `*.vue` through the shim; `vue-tsc` does not catch it): a type an SFC shares with a controller lives in a
  sibling `<component>Types.ts` (the SFC imports and re-exports it), and what a controller reads off a `$refs`
  instance is typed BY NAME there (the instance itself is `any` to plain tsc). After a shell slice run BOTH
  `npm run lint:client` and plain tsc over `src/**/*.ts` (or `npm run build`).
- **Source guards read the shell's code through `tests/console/shellSource.ts`** (`shellCode()` — the SFC and every
  controller, in the monolith's dialect), never `ConsoleShell.vue` by path: a member that moved is still found, in
  the same words. A product table that names a FILE (`COPIED_ACTION_STANCES`) is updated in the diff that moves it.

## The session (`console/session/consoleSession.ts`)
- **One root.** A flow is opened inside `consoleSessionScope()` (asked every time — never cached: it is re-opened
  after the game screen left). The shell ends it on `unmounted`; everything on the kernel ends with it.
- Module state that is not a flow yet hangs its reset on the session (`onConsoleSessionEnd(reset)`) instead of
  adding a row to the shell's `beforeUnmount`.
- **The supervisor** (`console/supervisor/supervisorController.ts`) is the one sampler. Its PORT is the list of what
  the nets read of the shell — it only shrinks; a new net is a state with an `after` in a machine, not a new row.

## Specs of the transport
- `tests/console/submitMachine.spec.ts` (the protocol, on a manual clock),
  `tests/client/console/gameTransportFunnel.spec.ts` (the funnel with a fake root / fetch — use
  `__setTransportPresenterForTesting` to play a scene of your own as a gate).
