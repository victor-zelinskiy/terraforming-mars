# DRAW & SELECT — «посмотри N карт колоды, оставь K»

*(Landed 2026-08-08. Server marker `deckPickPrompt`; client surface
`ConsoleDeckPick.vue` + `consoleDeckPick.ts`; probe
`tests/e2e/console-deck-pick.spec.ts`. Read this before touching `ChooseCards`,
the `cardSelect` routing, or the start workspace's embed zone.)*

## Why it exists

«Корпоративные архивы» (7 → 2), «Деловые контакты» (4 → 2), «Конкурс
изобретений» (3 → 1), Nanotech Industries (3 → 2), Leavitt, the Delta science
stage, the discard-pile diggers — one decision shape with **thirteen** producers
in the game, and no console home.

On the wire the prompt is a bare `SelectCard`: N candidates, a `min` and a
`max`. That is byte-identical to «выберите карту в чужом tableau», so
`consoleTaskRouter` classified it `cardSelect/target` — its `else` branch — and
the generic card browser served it. Everything that makes the moment what it is
was therefore unsayable, and unsaid:

| the truth | what the browser showed |
|---|---|
| the cards came off the deck a second ago | they appeared out of nothing |
| they belong to nobody | «ЦЕЛЬ НА КАРТЕ» — as if one were being targeted |
| the picks become your hand | they teleported into the dock |
| the rest is discarded | they were deleted with the DOM |

Inside the start workspace it also **failed outright**: the browser rendered in
the prelude's narrow embed column and overflowed it (four of seven cards clipped
away), and the start scene kept the pad, so the bottom bar advertised
«A РАЗЫГРАТЬ» over cards the player could not select at all.

## The server half — ONE marker, ONE funnel

`DeckPickPromptMeta` (`src/common/models/PlayerInputModel.ts`) rides
`BaseInputModel`:

```ts
{revealed: number, min: number, max: number,
 origin: 'deck' | 'discard', mode: 'keep' | 'buy',
 source?: ChoiceContextSource}
```

Attached in exactly one place — **`ChooseCards.execute()`** — because every
producer funnels through it: the behavior DSL's `drawCard: {count, keep|pay}`,
the bespoke `drawCardKeepSome` callers, the Leavitt colony, the Delta science
stage, the discard-pile diggers and the research buy. A card that starts drawing
tomorrow is covered by construction; there is no per-card table.

Serialized on **`SelectCard.toModel`**, not centrally — the same
nesting-survival reason `discardPrompt` is (Venus Orbital Survey offers the free
Venus cards and the paid rest as two branches of one decision).

Bounds are **copied off the real config**, never re-derived: the paying branch
narrows `max` by affordability, and a marker disagreeing with the input it rides
would be worse than no marker.

What each CALL SITE contributes is `promptSource` (built with the existing
`inputs/choiceContext.ts` factories — this family coins none of its own) and,
when it is not the project deck, `origin: 'discard'`. Both live in the rule that
builds the draw, so an upstream change carries the attribution in the same diff.
`Executor` passes `cardSource(card)` for the DSL path — the `keepAll` branch had
carried a reveal source all along; the `keepSome` branch simply attributed
nothing.

## The client half

**Routing.** `taskFor` checks the marker before the `buyMode` split and the
generic fallthrough, and returns the new kind `deckSelect` — **only for
`mode === 'keep'`**. A PAYING reveal already has a first-class flow (the
card-actions workspace's embedded «ПОКУПКА» stage, the research rise), so it
keeps its home; the marker rides along on it anyway, which is what will let a
later iteration unify the two without another server change.

**The surface.** `ConsoleDeckPick.vue` (`.con-deckpick`) reuses the shared card
chassis wholesale — `.con-cards` slots, focus ring, pick band, status rail,
`consoleWsStageLayout` geometry, `ConsoleWsStageHead`. What it adds is only what
is genuinely its own: **a causal chain**.

```
the deck answers  → N cards physically leave `.con-deckstack__pile`
                    (runBatchArrival, mode 'in-flight-reveal'), each on its own
                    trajectory into its own prepared slot; the HUD counter is
                    frozen at its pre-draw value and released on the separation
the player picks  → the ordinary console grammar (A toggles, X inspects,
                    RT commits, L3 the source)
the picks LEAVE   → runHandIntake flies them into the hand dock, which comes out
                    of its compact pose to receive them
only THEN         → applyDiscardExit tumbles away the cards left behind
```

**Host-agnostic.** One `embedded` prop strips exactly three things: the `con-ws`
rail marker, `ConsoleWsHead`, and the band geometry. Teleported into the start
workspace's `.con-start__embed` it becomes a step of the prelude's play; with no
claim it stands in its own band.

## The three things that are load-bearing

### 1. The surface OUTLIVES its own prompt

The prompt dies at the submit — `waitingFor` names the next one (or nothing)
before the picks have moved a pixel — and **both closing beats live after it**.
So `consoleDeckPick.ts` holds a module-level commit (`deckPickHolding()`, read
by the shell's mount gate) and the component **freezes** the candidate list,
the bounds and the source at confirm time. Without the freeze the row renders
off a model that has already moved on and all seven cards unmount on the very
frame the flight was supposed to start from them.

A refusal takes the same door: after the beats, if the server is still asking
the same question (checked with a bounded grace for a slow answer), the flow
rolls back to `choosing` rather than unmounting a screen that is still owed an
answer.

### 2. The fit engine must never read its own output

`wsStageLayout` is solved against the row's budget. The row is `flex: 1` inside
a frame the HOST sizes — and a flex item's default `min-height: auto` lets
content push the box past its container. Reading `row.clientHeight` therefore
fed the engine its own result: a bigger zoom grew the row, which bought a bigger
zoom, until seven cards were laid out for a band twice the size of the one on
screen and half of them hung off it. Adding a ResizeObserver is what turned that
latent circularity into a reliable overflow, which is the honest way it should
have failed in the first place.

Three rules, all three needed:
* `min-height: 0` (+ `height: 100%`, `overflow: hidden`) on the embedded root
  and the frame, so the host's zone genuinely bounds them;
* the budget is `rowBudgetPx()` — the **frame's** inner height minus the
  measured chrome — never the row's own height;
* the ResizeObserver watches the **host's zone**, never anything this surface
  can grow.

### 3. It owns the pad, ahead of the start scene

`startSceneOwnsPad` now yields to `deckPickServing`, exactly as it already
yielded to a hosted hand or colonies step. B is **not** offered while embedded:
a step inside a workspace has nowhere to minimize TO (the start workspace is
full-bleed and blocks its own B for the same reason), and advertising a verb
whose only outcome is an unreachable restore card is how a flow soft-locks.

## Two fixes this pulled in on the way

* **The start workspace's execution beat was a timer.** Nobody called
  `markWorkspaceOutcomeBeatDone()` for a start-hosted outcome, so every draw and
  every pick there sat out the full 2.6 s `BEAT_SAFETY` before its surface was
  allowed to mount — a real beat followed by an arbitrary wait. The scene now
  releases it when the source card physically lands in its seat, which is
  precisely what the gate is waiting to be told.
* **The task host drew a second copy of the source card while embedded.** It
  renders `console-source-dock` whenever the prompt has a source — and the moment
  the server started attributing draw picks, the embedded buy stage grew a
  duplicate «ИСТОЧНИК» beside the workspace's own hero and its card halved. The
  dock is now suppressed while embedded: inside a workspace the source is already
  on stage, and `L3 Источник` lifts that very card.

## The crumb

`deploymentCrumb`'s embed subject is the **source card itself** now, not its
manifest group: «СТАРТ ПАРТИИ › КОРПОРАТИВНЫЕ АРХИВЫ › ВЫБОР». Naming the group
(«ПРОЛОГИ») was a true sentence about the wrong thing — the player is inside ONE
card's effect, and that is the whole reason the effect renders in this workspace
rather than in a modal. Same grammar `sponsorCrumb` already used.

Stage tail, handed UP via `setWorkspaceOutcomePhase`: «БЕРЁМ КАРТЫ ИЗ КОЛОДЫ…» →
«ВЫБОР» → «ПОЛУЧЕНО».

## Adding a producer

Nothing, in the common case: build the draw the way the game already does and
the marker is attached for you. Two optional touches, both co-located in the
rule:

* `promptSource` — who asked (the console anchors the whole flow on it);
* `origin: 'discard'` — when the cards never left the deck.

## The one special case

The Delta science stage keeps its OWN cinematic (`hydroDraw`): the cards fan out
of the track cell the marker just landed on, which is a truer origin there than
the deck. While that scene is CLAIMED the surface mounts veiled — invisible but
measurable, so the flight has real slot rects to aim at — and materializes
around the landed cards. `ConsoleHydroDrawLayer` looks for
`.con-deckpick [data-zoom-slot]` as well as the task host's.

## Specs

| what | where |
|---|---|
| the marker: attached, agreeing, serialized, attributed | `tests/deferredActions/DeckPickPrompt.spec.ts` |
| the routing rows (keep vs buy vs plain target) | `tests/client/components/console/consoleTaskRouter.spec.ts` |
| the copy + the completeness anchor | `consoleTaskSummary.spec.ts` |
| the commit hold, the rollback, the beats-are-not-destinations rule | `consoleDeckPick.spec.ts` |
| the whole flow at the real surface | `tests/e2e/console-deck-pick.spec.ts` |
