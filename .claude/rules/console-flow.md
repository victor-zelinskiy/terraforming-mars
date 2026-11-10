---
description: Console architecture v2 — the flow kernel (scopes, bounded waits, machines), the lifecycles already on it, and how to add to them.
paths:
  - "src/client/console/kernel/**"
  - "src/client/console/transport/**"
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
- Specs: `tests/console/submitMachine.spec.ts` (the protocol, on a manual clock),
  `tests/client/console/gameTransportFunnel.spec.ts` (the funnel with a fake root / fetch — use
  `__setTransportPresenterForTesting` to play a scene of your own as a gate).
