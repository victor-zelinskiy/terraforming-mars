# Prompt admission — one response, one demand on the player

`src/client/console/consolePromptAdmission.ts` · spec `tests/client/components/console/consolePromptAdmission.spec.ts`

## The problem it solves

One server response routinely carries a **finished effect** and the **next prompt**
together. `Executor.execute` runs `behavior.drawCard` **synchronously**
(`Player.drawCard` → `DrawCards.keepAll(...).execute()`) and only **defers**
`behavior.greenery` — so **Experimental Forest** (prelude: draw 2 plant-tag cards
+ place a greenery) answers with `cardDrawReveals` **and**
`waitingFor = SelectSpace` in the same `PlayerViewModel`. They are peer fields;
there is no sequencing on the wire and none is wanted — the server is right, the
client owns presentation.

The console then played both at once: the drawn-cards reveal assembled over the
board **while** the board went live for the greenery, force-switched the section
and closed every layer underneath. Two demands on the player in the same frame,
from one play.

This is a **class** of bug, not one card — any effect that both draws (or plays a
cinematic) and raises a follow-up prompt hits it.

## Why it happened

The shell already had the right machinery — `animationHold` → `presentationFlow`
→ the shell's hold computeds. What it did **not** have was one place to ask the
question. Admission was hand-written at each surface:

| family | gate before |
| --- | --- |
| `activeConsoleTask` (task host) | 8 terms |
| `shellTask` (sections) | 5 terms + a 6th for `corpFirstAction` |
| `startTask` (start scene) | 3 terms |
| `placementActive` (board) | **none — raw `waitingFor.type === 'space'`** |

A hand-copied gate drifts; the one nobody copied is the one that spams.

## The mechanism

`consolePromptAdmission.ts` is **pure policy** + a tiny reactive mirror. The shell
owns the signals, the module owns the table:

```
ConsoleShell.admissionSignals  ──►  isPromptAdmitted(surface, signals)
                                    promptAdmissionBlock(surface, signals) → why
```

`ConsoleShell.admits('<family>')` is the ONE question. The `PromptSurface` union
is exhaustive over the policy record, so **a new surface family cannot compile
without declaring what it waits for**.

### Families

| family | who |
| --- | --- |
| `host` | `ConsoleTaskHost` + the panels cascading off it (WGT, production loss) |
| `section` | shell-section tasks (projectCard → hand / std sheet, colony → rail) |
| `standaloneModal` | the corp first-action confirm — hosts **none** of the running cinematics |
| `scene` | the T5 full-screen start scene |
| `placement` | the server's top-level `SelectSpace`, served by the always-mounted board |

### Deliberate policy differences

- **`section` is not held by a card arrival.** The hydro draw lands its cards
  *inside* a section pick and the card deal plays *inside* the host — holding
  those would unmount the very stage the cinematic runs on.
- **`standaloneModal` alone waits out `anyAnimation`** (every scope, including
  `'notification-only'`): the corp confirm animates nothing of its own, so it can
  wait for the intake / deal that legitimately play over other surfaces. Safe
  from self-deadlock for the same reason.
- **`placement` skips `board-bonus`.** The board card-bonus cover lift is armed
  **by a placement's own confirm** (A on the cell, *before* the POST). Folding it
  into `cardArrival` would make a placement cancel **itself** the instant the
  player pressed A. Its meaningful window — the cards actually being shown — is
  covered for `placement` by `reveal*`, which the same response raises.
- **`scene` yields only to a reveal or a blocking presentation** — it owns the
  screen and hosts its own cinematics.

## The draw contract

> A draw's prompt is over only when the **last card has physically landed in the
> dock** — not when the modal closes.

deck-draw search → reveal overlay → the player takes each card → the intake
flight touches down. The chain is continuous **by construction**:
`deckDrawHolds()` covers the search, `revealOpen`/`revealPending` the modal, and
`runHandIntake` appends its flight **synchronously** with the take commit, so no
frame falls between the links. Nothing new may be asked of the player inside it.

## The placement mirror

The board is **always mounted**, so placement has no `v-if` to suppress — the
verdict *is* the suppression. Two affordances live outside the shell, in the
legacy `WaitingFor.vue`:

- the legacy `SelectSpace`, whose `mounted()` paints `.board-space--available`
  onto the hexes;
- the `PlacementBanner`, teleported to `<body>` (CSS-hidden in console mode, but
  it still mounts).

Both are keyed off `waitingFor` alone. `setConsolePlacementHeld` mirrors the
shell's verdict so `WaitingFor`'s existing blank-render hold list covers them for
exactly the same window — otherwise the hexes light up under the reveal modal
while every other placement affordance is correctly held.

**Desktop-safe by construction:** only `ConsoleShell` ever writes the mirror, so
outside console mode it stays `false` and every reader is a constant no-op.
Cleared on shell unmount (`resetPromptAdmission`).

## Traps

- **Client-side pickers are NOT gated.** `convertPlantsPending` /
  `taskSpacePending` are hand-offs the player just initiated from a surface that
  unmounts itself for the pick. Holding those leaves the prompt with no surface
  at all — the exact strand `setConsoleTaskSpacePlacement` exists to prevent.
  Only the **server** `SelectSpace` branch is admission-gated.
- **No strand risk for placement.** `taskFor` classifies a `space` prompt into
  `SHELL_NATIVE_KINDS`, so `runLeakDetection` early-returns before the
  serving-surface scan; the holds themselves are also covered by its
  `isAnimationHoldActive()` early-return.
- **No deadlock.** Every block is bounded — the animation-hold ceiling (35 s),
  the deck-draw scene safety (30 s), the tile-arm safety — and `announce-gate`
  never fires for a `space` task (the mandatory gate deliberately excludes it).
- **`tileHero` is false while merely `'armed'`** (`tilePlacementHolding()`), so a
  placement never blocks its own submit funnel. A *chained* placement (tile 2 of
  2) correctly waits out tile 1's hero.

## Adding a signal or a family

- **New signal** → add it to `AdmissionSignals`, `AdmissionBlock`, `BLOCK_ORDER`,
  `raised()` and the policy sets that should honour it. Fill it in
  `ConsoleShell.admissionSignals` — the single collection point, so it reaches
  every family at once.
- **New family** → add it to `PromptSurface`; `POLICY` is a
  `Record<PromptSurface, …>`, so the compile fails until it has a policy. Add a
  spec row.
