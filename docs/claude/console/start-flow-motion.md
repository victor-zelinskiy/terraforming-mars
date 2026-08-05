# The Game Start Workspace — the PHYSICAL CARD LANGUAGE

*(2026-08-06 motion-polish iteration. Not auto-loaded; read when touching
`startDockMotion.ts`, `startStageDirector.ts`, `cardFlight/card3dInner.ts` or
the transition methods of `ConsoleStartScene.vue`.)*

The subject of this document is **when** things happen, not what they look
like. Every defect it records was an ordering defect wearing a visual costume.

---

## 1. The stage used to change at the press — that was the whole bug

```ts
// BEFORE — startDockMotion.collectToDock(sources, pile, onCovered, onDock)
collectToDock(sources, pile, () => {
  this.state.stepIdx = this.railPos + 1;   // ← at t = 0, before ANY card moved
}, …);
```

`onCovered` fired the instant the proxies had spawned. So on RT the Prelude
table was already standing (and fading in) while the chosen Corporation was
still travelling to the shelf **over it**: two card surfaces on screen, and a
card of the old stage crossing a table it never belonged to.

It is not a z-index problem, and raising the flyer layer does not fix it — the
*phases of life* were in the wrong order. Hence the split:

| | |
|---|---|
| **ACTIVE stage** | what is physically on screen — `consoleStartState.stepIdx` |
| **PENDING stage** | what the player asked for — `startTransition.to` |

`startStageDirector.ts` owns the pending half and the phase order; the scene
performs it. The commit is a PHASE, and on every forward path it sits after
the docking.

### The orders (unit-guarded: `startStageDirector.spec.ts`)

```
step-forward   accept → compress → lift → transfer → park → dock → COMMIT → reveal → stabilize
to-summary     accept → compress → lift → prepare-summary → park → COMMIT → distribute → dock-all → status → stabilize
step-back      accept → park → COMMIT → reveal → prepare-slots → release → transfer-home → dock-home → stabilize
from-summary   accept → compress → lift → park → COMMIT → reveal → prepare-slots → transfer-home → dock-home → stabilize
```

**Forward and backward are NOT mirror images**, and one symmetric crossfade
cannot express either:

- **FORWARD** — the player TAKES cards off the table they are standing at, so
  that table must still be there to take them from. Cards leave first, the
  surface retires behind them, the next surface opens once the shelf has them.
- **BACKWARD** — the player asks for cards BACK, so the receiving table must
  exist first. The current surface retires, the previous one returns (cached),
  its reserved slot stands empty, and only then is the card released.

`commitFollowsSeparation()` / `nextSurfaceVisible()` / `currentSurfaceVisible()`
state these as predicates so a test can walk every phase of every kind.

---

## 2. THE SUMMARY TELEPORT — a shared layer, two owners

The other headline bug. The projects glided grid → summary *while* the earlier
piles opened into theirs: two convoys, one proxy layer, and **each convoy
cleared the whole layer when it finished**:

```ts
// BEFORE — the tail of every entry point
clearLayer();          // layerEl.innerHTML = ''  ← everyone's proxies
```

The shorter convoy finished first and deleted the longer one's still-airborne
bodies. Its GSAP timeline kept running and kept firing per-card `onDock`s, so
the destinations kept revealing — with nothing in the air. Visible result:
*the first projects fly, the last ones pop into place one at a time*, and it
got worse the more projects were bought.

**Fix:** `ProxyBatch` — a flight owns its own bodies and disposes only those.
Two convoys may now share the layer and outlive each other. There is no card
cap in the module and no instant-placement path.

The old per-card degeneracy (`if (!proxy || !target) { onLanded(); }`) is gone
too: a missing source or destination is a **bug**, it warns in dev, and the
card still hands off through the normal path instead of appearing from nowhere.

Guards: `startDockMotion.spec.ts` («one convoy finishing does NOT destroy
another convoy still in the air», 20-card batch) + the live probe
`tests/e2e/console-start-motion.spec.ts`, whose teleport assertion is exact —
*a summary tile may never turn visible while nothing is in the air*.

---

## 3. Prewarm — destinations are measured, never assumed

A summary that lays itself out while cards are arriving has no stable rect to
offer them, and every tile that had not laid out yet used to degrade into
"just appear". So `prewarmSummary()` mounts the pane **invisible at exactly
the box it will occupy** (an absolute copy of the cards body's rect,
`box-sizing: border-box`), runs the fit search there, and only then is a card
allowed to move. Releasing the prewarm is a pure paint change: nothing
re-flows and every measured rect survives the swap.

`visibility: hidden`, not `opacity: 0` — only `display: none` destroys
geometry, so a hidden pane is still fully measurable while being genuinely
unseeable (by the player, by hit-testing and by a Playwright driver).

`fitLocked` freezes both fit engines for the duration of a flight: re-solving
a zoom mid-carry moves the destinations out from under cards planned against
the old rects. Each landing also re-reads its own destination once, at 80 % of
the carry, applying the delta as a ramped correction (continuous path, exact
landing) — that is the safety net for a late art decode.

---

## 4. `Card3DInner` — the physical card body

`src/client/console/cardFlight/card3dInner.ts` + `console_card3d.less`.

This is the fork's existing chassis (`.con-deal-proxy__flip / __face / __back`
+ `addPremiumTurn`) **formalized**, not a second one: the faces keep those
exact class names, so every shared rule riding them (the `--revealing` glint,
the hand-reveal dim recipes, the margin resets) applies unchanged.

```
CardMotionOuter  (.con-card3d-outer)   x/y/scale/trajectory/shadow/opacity — AND `perspective`
└── Card3DInner  (.con-card3d)         rotationY / a small rotationX / z — nothing else
    ├── __face                          both mounted from birth, culled by backface-visibility
    ├── __back
    └── __edge                          a real plane through the centre line
```

**Why the start-flow turn read as a picture swap:** `.con-startdock-proxy` had
no `perspective`. The rotation was real, but with no projecting parent it was
ORTHOGRAPHIC — the face simply narrowed to a line and the back widened out of
the same line. Nothing was "swapping"; there was just no depth for the turn to
happen in. (Live proof in the probe: `perspective=900px`, `matrix3d` samples,
peak edge opacity 1.0.)

Two rules the module exists to keep — both have shipped as bugs before:

1. **Never `opacity` on the inner.** Any value below 1 is a grouping property:
   it forces `transform-style: flat`, backface culling stops, and a 180° turn
   renders a MIRROR of the face instead of the back. Fade the OUTER (flat by
   construction) or dim the `__back` leaf.
2. **Never overshoot on `rotationY`.** An angular overshoot past 0°/180°
   flashes the mirrored backface. Settle overshoot rides SCALE, on the outer.

The turn is **layered onto the caller's flight timeline** (a structural
timeline type, like `addPremiumTurn`) and rides the heart of the carry —
"fly" and "turn over" are one gesture, never two chained beats. It works in
**both** directions, which `addPremiumTurn` (180 → 0 only) could not express.

**Reusable by design.** Candidates that can adopt it as-is: the deck-draw
cinematic, `runBatchArrival`, the hand intake director, the played hero, the
patent-sale and card-discard flyers — all already render the same face/back
chassis and would gain the edge + the guaranteed projection. Migration is
deliberately NOT part of this iteration.

---

## 5. RETIRE THE SURFACE, NOT THE CARDS

Unpicked cards are never animated individually — that is visual noise ("why is
that one leaving?") and, on a 10-card grid, ten composited layers instead of
one. `parkSurface()` steps the whole table back in depth and dims it out as
ONE cached layer; `unparkSurface()` brings it back. `SEPARATION_BEAT_MS` (55)
is the deliberate offset between "the picks have left" and "the table starts
to retire" — it is what makes the gesture read as *I took THESE cards off THAT
table*.

A REVISITED table never re-deals: `cardDealMemory.shouldRunDealOnce` (module
level, keyed on player+frame+card set) and `state.visited` (the CSS
first-visit stagger) are both untouched by this rework and both survive a
defer/restore.

---

## 6. Instant response without transitional text

Nothing textual changes during a transition. A word that lives 300 ms cannot
be read — it can only flicker. The response is physical and starts in the
press's own interaction frame:

- `capture.impulse()` — a 44 ms compression against the table, then the lift
  is queued behind it and left RUNNING (the caller gets its frame back at once
  and prepares the destination while the cards come up; the flight's take then
  takes the lift over via `overwrite: 'auto'`);
- the **Journey Rail's directional pulse** — the active marker does NOT move
  (the stage has not changed yet); the requested stage takes one short light
  sweep entering from the side the move comes from (`pendingIndex` +
  `pulseKey` + `pulseDir`);
- backward, where there is nothing on the table to pick up: the shelf pile
  that is about to give the cards back physically stirs (`pressPile`) and the
  current surface starts retiring.

Input is locked for the whole transition (`startFlowBusy()` now includes
`startTransitionActive()`) and released only on `stabilizing-focus` — but the
lock is never *felt*, because the answer began in frame one.

---

## 7. The exact handoff — one frame, one owner

```
reveal the destination  →  next animation frame  →  remove the proxy
```

Never a crossfade: the two copies are pixel-identical, so a fade can only
expose what differs between them (the proxy's shadow, its rounding, the focus
ring the slot is about to grow) — which is exactly what read as a flicker.
Never "hide then reveal" either: that is a blank frame. Two frames of
pixel-identical double is the only combination with neither artefact.

The shadow lands on `CARD3D_SHADOW.contact` and STAYS there, because the
destination's own resting shadow is the same family — fading it to none
blinked instead.

**The shelf follows the cards, in ONE tick.** `dockDrift` stands in for cards
that are physically elsewhere than the state says. Two traps paid for here:

- **No `−N` pre-drift on a collect.** The step is not `collected` until the
  stage commits, so its target back count is still 0: a `−N` pre-drift is
  cancelled by the `+1` landings and the pile stays empty until the commit —
  the proxy retires onto NOTHING and the card is briefly gone from the world.
  (That worked before only because the stage committed at t=0.)
- **The summary's `+picks` drift belongs in the commit's own tick.** Applied
  one phase early it doubles every earlier pile's count for ~300 ms — the
  shelf claiming more cards than the player picked.

---

## 8. What was verified

`tests/e2e/console-start-motion.spec.ts` samples the live DOM at ~40 ms
through real transitions (1920×1080, CrediCor, 18 bought projects):

| | |
|---|---|
| step advance | card airborne 72–1094 ms, live pane flips at 1229 ms — the next stage opens **after** the last card is down |
| crumb | at most two distinct words across the whole transition, and the old one for the whole flight |
| summary convoy | 18 projects + 2 preludes + corp = **21 bodies airborne at once**, span ~2.8 s, all 21 land, zero teleport samples |
| shelf | never claims more than the player picked; the landed corporation is on the shelf in every frame after the flight |
| the turn | `perspective: 900px`, `matrix3d` on the body, peak edge opacity 1.0 |
| return | every card back in its ORIGINAL slot, badges intact, summary gone, no proxy left behind |

Also green: `console-start-summary`, `console-start-summary-fit` (6 / 9 / 12
projects × fhd/4K), `start-scene-profiles` (720 / deck-800 / 1080 / 4K),
`start-shelf-art`.
