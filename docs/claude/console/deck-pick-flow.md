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

## The deployment YIELDS THE STAGE (2026-08-08, iteration 2)

«РАЗЫГРАНО» belongs to the DEPLOYMENT, not to the step standing inside it. It
used to sit under the embedded step taking a third of the column's height from
cards the player was trying to read, because `.con-start__embed` was scoped to
`.con-start__queuecol`. The zone now spans the whole `.con-start__deploy` row,
and the shelf recedes in the queue's own phrase (`descendRecede` /
`descendReturn`, `runPlayedDockRelease` / `runPlayedDockReturn`).

Three properties are load-bearing, and they apply to the reveal exactly as they
do to the pick — same zone, same beats:

* **Never a `v-if`.** The shelf keeps its DOM, its counters and its stack
  identities (`[data-played-key]`, `[data-start-front]`), so nothing is rebuilt
  and the hero target it registers via `providePlayedHeroTarget` is never
  withdrawn.
* **It comes back FIRST.** `runStartEffectReturn` awaits BOTH halves
  (`Promise.all([runQueueReturn, runPlayedDockReturn])`) before the source
  card's continuation flight, because that flight MEASURES a slot inside the
  shelf — a card aiming at a receded (transformed, transparent) destination
  flies to a place that is not where it lands.
* **Only the SOURCE keeps its seat.** It is what the whole step is about.

Probe: `console-deck-pick.spec.ts` asserts the shelf is mounted-but-receded
during the pick, that the step's frame really got the row (`> 600 px`), and that
the shelf is back at full opacity by the time the card reaches it.

## ONE motion language for every deck flight

The batch arrival (`runBatchArrival`) and the deck-draw cinematic
(`runDeckDrawBeat`) are the same physical event — a card leaving the HUD pile —
and had drifted into two dialects. Five differences, all corrected in the SHARED
director, so the deck-pick, the action composer's beat stage and the reveal all
moved together:

1. **The peel was not centre-anchored.** With `transformOrigin: 'top left'`,
   growing the card 12 % while nudging only `y` slides its visual centre right
   AND down — the card crabbed sideways off the pile instead of lifting out of
   it. That drift IS what read as "the cards appear crookedly". Both axes are
   re-solved now, via the same `at(cx, cy, scale)` helper the deck-draw beat has
   always used.
2. **The birth tilt was 3.2x too loud** (a wider `jitterDeg` spread, then x1.6
   instead of x0.5). Scattered cards, not a stack being dealt. Same function,
   same magnitude as the cinematic now.
3. **No contact shadow.** `.con-deckdraw-proxy` has always flown with a
   `drop-shadow`; the shared `.con-deal-proxy` had none. WARNING: it goes on the
   two FACES — a `filter` on the perspective owner creates a containing block
   that flattens the 3D subtree (the trap `console_card_discard.less` records).
4. **The turn fought the flight for `scale`.** `addPremiumTurn` defaults to
   `settleScale: true`, and the travel leg tweens `scale` on the same proxy for
   the whole flip window: ~240 ms of two tweens writing one property per tick.
   `openPending`'s late branch already knew this; the primary path did not.
5. **`rotation` was never re-zeroed at the handoff.** An interrupted flight left
   a residual tilt that rested, crooked, in a perfectly square slot.

Plus one addition: the pile now **TICKS** as the first card separates
(`runDeckSettleTick`), so the deck visibly answers instead of standing inert.

### The wrap cap — a solved shape must be the shape that renders

`wsStageLayout` chooses `rows`/`perRow`, but `flex-wrap` breaks on the AVAILABLE
width — and the zoom is frequently bound by HEIGHT, which leaves the line
narrower than the room. Seven cards planned as 4+3 wrapped as **6+1**. The
engine now publishes `--con-ws-stage-rowmax` (the planned row width, padding
included) and the shared `.con-ws-stage-row` honours it.

WARNING: **a fit must reset its own outputs before measuring** — the cap is a
`max-width` on the very row whose `clientWidth` the fit reads, so the second
pass would measure the first pass's choice: narrower room, more rows, a narrower
cap. All three callers reset `--con-cards-zoom` AND `--con-ws-stage-rowmax`
before the probe. (This is the third instance of the same class in this flow;
the other two are in the fit-engine section above.)

## A single card in a workspace never goes fullscreen

The headless path exists because a lone received card has no context worth
framing — the fullscreen viewer IS the reveal. Inside a workspace the opposite
is true, and being thrown full-bleed is exactly the break the embedding removes.

`ConsoleRevealOverlay.singleCardMode` used to test the `embedded` PROP, which is
derived from the embed SLOT existing — and the slot is published `flush:'post'`.
For the frames between the claim and the host's mount `embedded` is false while
the card is unambiguously the workspace's, `mounted()` fires in exactly that
window, and it opens the viewer `mandatory: true`, which nothing later retracts.
It now asks the CLAIM (`workspaceClaimsDrawReveal` / `workspaceClaimsColonyReveal`),
which is live from submit time — ownership, not readiness.

**The BOARD lift still goes fullscreen by construction, not by a flag:** a cover
lifted off a cell carries `{type:'tile'}` / `{type:'globalParameter'}`, which no
workspace claim can match. The one board source that IS a colony (Pluto's build
bonus) is carved out by asking the bonus scene itself
(`boardCardBonusClaimsReveal`).

## Iteration 3 — the production polish pass (2026-08-09)

Eight reports, and they resolved into five root causes. Recorded because four
of them are general and will bite the next flow that does this.

### 1. The cards flew in FROM THE RIGHT EDGE, not off the deck

A `position: fixed` proxy resolves against the nearest ancestor that
establishes a containing block — and the surface is TELEPORTED into a host's
zone. The start workspace's embed zone runs a 260 ms arrival `animation`, and an
animating `transform` contains fixed descendants for its whole duration; that is
exactly the window the deal launches in. Every coordinate therefore carried the
zone's own offset, so «the deck's position» rendered off the right edge.

**The flight layer is APP LEVEL** (`ConsoleDeckPickLayer`, mounted by the
shell), like every other flight stage in the console. The surface names the
faces (`armDeckPickFlight`) and reads the bodies back (`deckPickProxyEls`); it
never hosts them. *Rule: a flight stage inside a teleported surface is a bug,
however correct the coordinates are.*

### 2. The step was NARROWED by its own source card

The source seat was a flex SIBLING, so showing it pushed the step right: its
header and status line started where the source ended, visibly inset against the
workspace's own status rail directly below them, and the cards lost that width.
The seat is now **absolutely placed** and only the CARD ROW steps around it,
through `--con-ws-stage-inset` on the shared row — and because the fit already
subtracts the row's padding, the solved card size follows for free.

*Rule: context must not shrink the thing it is context for.*

### 3. A committed pose added MATERIAL

`.con-deckpick--sending/--clearing` re-declared `box-shadow` after the
`--embedded` block, so confirming drew a rectangle around a step that has no
plate of its own. Scoped to standalone. *Rule: a committed pose may change
WEIGHT; it may never add material.*

### 4. The deployment let go before the effect's return had played

`deploymentSettled` keyed on `embedActive` — the SERVER question («is the effect
still asking?») — and went true a beat before the SCREEN question («has what the
effect started finished moving?»). Two reported bugs, one cause:

* on the LAST prelude the scene dissolved straight to the board and the card's
  play animation never ran;
* on every prelude the shelf kept a **blanked** slot: `awayCard` still naming a
  card whose settle never reached the line that clears it, so the family painted
  nothing but its peek strip.

`effectReturnPending` (source card still seated, or either half of the
deployment still receded) is now part of the gate. Fenced by
`console-deck-pick.spec.ts` § «the LAST prelude still plays its card home».

Two supporting fixes: the RELEASE is now guaranteed on the `embedActive` rising
edge (it hung off the hero's `depart` beat, and a claim that arrived without one
left nothing receded — so there was no return to play and the queue reappeared
in a single frame), and `measureFrontAnchor` refuses to settle on a RECEDED
shelf (a hidden element is still laid out, so its rect is real, stable, and
1.5 % wrong — the stability loop could not tell «settled» from «settled in the
parked pose»).

### 5. The attention beacon fired where the prompt WAS served

`mandatoryChipAttention` derived «you are not where the decision is» by NEGATING
a rendering condition (`!mandatoryAnnounceVisible`) — so everything in that
condition which is not about location (`!isAnimationHoldActive()`,
`!presentationHeld`, `consoleRevealMode === undefined`, …) became a reason to
raise the alarm. An embedded reveal / draw / pick lights up every one of them,
so the chip flashed amber while the player looked straight at the decision.

`promptServedWhereIStand` states the positive fact instead: `shellTaskOnSurface`
for the kinds it covers, plus a PRESENTING workspace claim — the surface is
teleported into the workspace the player is standing in, which is the definition
of «here». (The start workspace projects onto neither navigation axis, so
`section` could never have answered this.)

*Rule: never derive «where the player is» by negating a rendering condition.*

### Also in this pass

* **B «свернуть» and L3 «источник» are offered EMBEDDED.** B minimizes the
  HOSTING workspace — the documented verb for a nested step, and the same thing
  the start scene's own B does one level up, so the button never changes meaning
  as the player descends. L3 lifts the host's real source card (a physical
  origin), matching what the reveal beside it already offered.
* **«ИСТОЧНИК» dissolves with the departure**, not after it: the caption is set
  `--departing` before anything is measured, so the fade overlaps the flight.
* **The wrap cap.** `wsStageLayout` publishes `--con-ws-stage-rowmax`, because
  `flex-wrap` breaks on the available width and a height-bound zoom then fits
  more per line than the chosen shape has (7 planned as 4+3 wrapped as 6+1) —
  and the fit RESETS that property before measuring, or the second pass reads
  the first pass's choice.
* **The embedded reveal fills its zone.** It was `align-self: center` in a flex
  zone, so it shrink-wrapped to its card; the zone is a block now and the step
  gets `width/height: 100%`.

## Iteration 4 — composition and choreography (2026-08-09)

Four reports about the same screen, and the fix for three of them turned out to
be one number that was silently zero.

### The source seat's reserve was NEVER applied

It was expressed as a `padding-left` on the SHARED row, carrying a custom
property — and both halves failed:

* the profile ladders (`html.con-profile-tv .con-cards__strip.con-ws-stage-row`)
  re-declare the row's `padding` SHORTHAND, which wipes a longhand inset;
* the property itself was a `calc(...)`, and `getPropertyValue('--x')` returns
  the token **unresolved** — `parseFloat` gives NaN and the fallback gives 0.
  (`cssLengthPx` covers plain `rem`/`px`, which is exactly why the trap
  survives it.)

So the reserve was 0. The source card sat ON TOP of the first revealed card,
and — because `availW` was ~300 px too generous — the layout engine also kept
choosing a SINGLE row of seven small cards.

**The reserve is MEASURED off the real seat now** (`sourceReservePx`) and
subtracted from the row's width on BOTH sides. The group is centred, so its
margin is then guaranteed to be at least the seat's own width: the two never
occupy the same space, in any phase, at any focus scale. No z-index is
involved, and none can be — that is the point.

*Rule: never read a length-valued custom property back out of the cascade. If
the element exists, measure the element.*

### Multi-row is allowed to win

`WRAP_GAIN` was 1.18 — «wrapping has to EARN the break». Right for a two-card
result, wrong for a seven-card reveal on a 4K TV: a single line of seven is
width-bound long before it is height-bound, so the band's height went unused
and the composition read as a web carousel. **1.03** now: a genuine tie still
prefers one line, and anything better than a tie takes the height.

⚠️ The WRAP CAP (`--con-ws-stage-rowmax`) is a `max-width` on the row, so it may
only carry the row's OWN padding. Folding the seat reserve into `padXPx` made
the cap wider than the shape it caps, and 4 + 3 broke as **5 + 2**.

Row centring needed nothing: `flex-wrap` + `justify-content: center` already
centres the short last row under the one above it.

### The cascade was a burst

`stepDecay: 0.7` collapsed the stagger — seven cards launched inside 271 ms,
four of them within 200 ms — so the eye read ONE ejection off the pile.
**0.86** keeps the tightening (a twelve-card batch still converges) while a
seven-card draw spreads over ~390 ms, the smallest window in which «several
separate cards» is legible. `flipAt` 0.28 → 0.32, so the card reads as a back
travelling off the deck for a beat before it opens: the turn is the event, and
an event needs a before.

### The arrival is now a landing

The settle was a single vertical breath. It also brings the depth and tilt the
turn was still carrying to rest WITH the landing (not after it), and adds a
whisper of compression against the slot — all inside `settleMs`, so the cascade
still reads as a layout assembling itself card by card. `scale` is safe here
and only here: the travel leg's own scale tween has ended by touchdown, which
is the same reason the in-flight turn passes `settleScale: false`.

### Navigation follows the geometry

The last row of a wrapped group is CENTRED, so a column-preserving index
stepper sends the cursor to a card that is visibly not the one below it. The
surface navigates by **`nearestInDirection`** (the fork's shared physical
stepper, already the start wizard's) and keeps the index stepper only as the
pre-layout fallback.

### On `card3dInner`

Nothing was duplicated and nothing needed to be. The flying body IS the shared
3D chassis — `.con-deal-proxy` owns the `perspective`, `.con-deal-proxy__flip`
owns `preserve-3d`, the faces own `backface-visibility` — which is precisely
the chassis `card3dInner` formalizes (its own doc: *«the faces keep their
`.con-deal-proxy__face/__back` names, so every shared rule still applies»*).
The turn is `addPremiumTurn`, the ONE opening motion, layered onto the flight's
own timeline at `flipAtMs` — mid-travel, never after landing. Rebuilding the
same DOM through `buildCard3DInner` would replace Vue-owned markup with
JS-built markup for no behavioural difference.

### The «clipped» cards on the shelf

The thin band under a played card is the DEPTH STRIP — `PLAYED_PEEK_NATURAL`
(75 px: the card's title plate) clipped by design, `keep-art` on, art intact.
What was actually wrong is fixed in iteration 3: the family's TOP card was
being blanked by a stale `awayCard`, so only the strip painted.
`console-deck-pick.spec.ts` asserts `shelfBlanked === 0` through the whole
return.

## Iteration 5 — the layout could solve a shape that does not fit (2026-08-09)

### A floor made an infeasible shape win

`wsStageLayout` clamped every candidate with `max(0.42 * ui, raw)` and then
compared the CLAMPED values. `shapeZoom` already returns the largest zoom a
shape can afford — so raising a result to a floor is, by definition, asking for
a card that does not fit. On a 4K profile a seven-card reveal solved three rows
whose raw zoom was under the floor, got clamped UP to it, out-scored the
feasible two-row shape, and rendered **cut off at the top AND bottom** with
nothing to scroll to.

The floor is gone. Only the CEILING remains (a ceiling can only make a shape fit
better), shapes are compared on the value they will actually render at, and a
starved band now yields small honest cards instead of cropped ones.

⚠️ One more overflow hid behind it: the gap is solved as a function of the zoom
(focus headroom) but ALSO has a floor (`MIN_GAP_PX * ui`), and on a tight band
that floor is the larger of the two — so the row came out wider than the budget
its zoom was solved against. The zoom is **back-solved** against the gap that
will actually be used; one pass is exact, because shrinking the zoom can only
shrink the headroom, at which point the floor dominates and the gap stops
moving.

Both are fenced by a SWEEP — every `ui` × band × count combination must satisfy
`usedH <= availH` and `usedW <= availW`. It is the guarantee the whole engine
exists to make, so it is stated once and checked exhaustively rather than
sampled.

### The shelf reduced a family to a crop

While an embedded step runs, the card that opened it physically leaves the
shelf for the step's source seat. If that card happened to be the TOP of its
family, the top slot rendered with `con-deal-hold` (opacity 0) and the family
painted nothing but the 31 px depth strip underneath — which reads, correctly,
as a clipped card, because the only thing rendered WAS a crop.

The pile now shows what is actually on top of it: the card underneath, promoted
out of the strips at full size. The away card keeps the slot's IDENTITY
(`topKey`, separate from `topFace` for the first time) so the flight bringing it
home still has a destination, and the promoted face gives way to it on
touchdown — the same prev-top handoff the receiving state already performs. A
family whose ONLY card is the one on loan legitimately shows its prepared place.

### L3 on the source opened a SECOND copy of it

`workspaceSourceZoomOrigin` — the ONE resolver every host is supposed to share —
only knew the card-actions composer's hero column. In the start workspace it
resolved to nothing, so the viewer degraded to its TEXTUAL entrance: it rose out
of nowhere while the seat kept its card, and the player saw two of the same card
at once. It now falls back to the start host's `[data-embed-source-slot]`, so
the card LIFTS out of whichever seat is holding it and that slot is held empty
for the trip. Fenced: `zoomOpen && seatHeld` while the viewer is up.

### Timing

`travelMs` 620 → 700 and `settleMs` 130 → 150. With the cascade from iteration 4
the last of seven cards leaves at ~390 ms and the batch settles around 1.4 s:
brisk for two cards, unhurried for seven, and the same numbers for both.

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
