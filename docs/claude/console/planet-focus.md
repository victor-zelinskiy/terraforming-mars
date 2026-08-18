# Planet Focus — the main-grid placement stage

The premium mode of a tile placement whose WHOLE candidate set lives on the
main Mars grid: the arc scales and the off-Mars flanks recede, the planet
expands into the freed space, and the entire placement — cell choice, the
tile-flight hero, the printed-bonus / ocean-adjacency beats, the card-bonus
cover lift — plays on the enlarged stage. Files:

- `src/client/console/planetFocus.ts` — the phase machine, the global-param
  display hold, the scale beat, the blocking hold, the pure predicates.
- `src/client/components/console/ConsoleBoardSection.vue` — phase → classes,
  the deterministic focus fit (`PFOCUS_FRAME`), calibration gating, the
  display-game override.
- `src/client/components/console/ConsoleStatusStrip.vue` — the same
  display-game override (ONE read: `displayGlobalParams`).
- `src/client/components/console/ConsoleShell.vue` — the target computed +
  driver watcher, the beat-ready watcher, the live-params source.
- `src/styles/console.less` — `.con-board--pfocus*` rules + the stage veil +
  the `con-scale-focus-oceans` accent variant.

## The four load-bearing decisions

1. **Engagement is RAW, sustain is guarded.** `planetFocusTarget` reads the
   placement prompt off `placementSpaceModel` (NOT the admission-gated
   `placementActive`) — a prompt held behind a reveal already focuses the
   board, and a chained second placement re-claims the mode before any exit
   runs. The tile-hero transaction and the card-bonus FIELD phases
   (`isBoardCardBonusFieldPhase`) only SUSTAIN an engaged mode
   (`… && isPlanetFocusEngaged()`) — a non-qualifying placement runs its
   hero on the normal stage.

2. **The hold must never cover the live placement.** The `placement`
   admission family waits on `presentation`, which folds blocking animation
   holds — a hold raised during `entering`/`active` would suppress the very
   prompt this mode decorates (deadlock). The `planet-focus` hold is active
   only for `exit-prep` / `exiting` / `beatPending` / `scaleBeat`.

3. **The scales move ONLY after the interface has returned.** The arcs and
   the top HUD are value-driven (a commit glides them instantly), so while
   engaged both read through `displayGlobalParams` (frozen snapshot). The
   release is the SCALE BEAT: after the exit lands, once
   `planetFocusBeatAllowed` says the scales can be READ (no reveal, no cards
   in transit, no cover scene, no discard — deliberately ignoring
   `presentation`/`anyAnimation`/`announceGate`, which the beat itself
   raises), the shell fires `playPlanetFocusScaleBeat`: values release → the
   markers glide, the fills advance, the HUD flips, the globals delta chips
   fire, the changed scales pulse `con-scale-focus-<param>` (the
   Government-Support accent CSS + a new oceans variant). `beatPending` is
   itself part of the blocking hold so no follow-up modal or bot-turn card
   slips into the quiet frame between the exit and the glide. A 15 s safety
   releases a stuck beat silently.

4. **The focus fit is DETERMINISTIC and frames the ALPHA-MEASURED disc.**
   mars.webp renders 620×600 in `.board-cont`, but the visible planet is a
   **449×449 circle at (93..541, 85..533)** — the rest of the canvas is
   transparent. `PFOCUS_FRAME` = that circle (+1px rim), fitted
   EDGE-TO-EDGE (no pads): the disc's border lands on the stage border.
   The first shipped frame targeted the canvas and burned a third of the
   growth on empty pixels — if the asset is ever re-cut, re-measure the
   alpha bbox (draw it into a canvas, scan alpha) and update the constant.
   Focus has its own scale ceiling (`PFOCUS_MAX_SCALE` — the overview
   `MAX_SCALE` clamp is for degenerate measurements, which the focus fit
   cannot have). Pure arithmetic for `--board-scale` + `--con-board-dx/dy`;
   self-calibration is gated to phase `idle`; the stage vars are saved at
   enter and restored at exit.

5. **THE MODE NEVER CHANGES LAYOUT.** The extra room comes from a
   downward BLEED, not from reclaiming space: the stage keeps its box and
   gets `clip-path: polygon(… 100% + var(--pfocus-bleed) …)` (sides still
   clipped, so returning arcs cannot smear over the rail), the focus fit
   uses `stageH + bleed`, and the re-centring into that virtual box rides
   `--con-board-dy` — a transform, therefore transitioned. The banner
   recedes by OPACITY, never `display`.
   Why it is written this way (device trace, 2560×1440 TV): the first cut
   reclaimed the dock clearance by shrinking `.con-board`'s padding. The
   stage is a CENTRING flex box, so handing that 77px back at the end moved
   its centre — and the planet — **39px in a single frame**, with the scale
   provably flat (`tf=2.0203` on both sides of the step). Layout cannot be
   transitioned, so no curve, duration or hold could ever have hidden it.
   The guard for a future change here: sample the stage box in focus,
   mid-return and at rest — all three must be identical.

## The motion, and the four traps that made it feel cheap

The band answers the planet: the growing disc PUSHES the instruments out of
orbit (opacity out + `scale(1.035)`, nearest shell first); the landing disc
lets them SETTLE back in, delayed ~300ms into the 700ms travel so both come
to rest together, in shells (ring → ocean band → outposts). The landing is
the LONGER of the two moves and both ride an expo-out tail.

- **A transition declared only on a transient class is CANCELLED when that
  class drops — the value snaps.** That is what turned the whole return
  into a hard cut. Every transition here lives on a BASE selector; the
  phase classes only override duration/delay.
- **The planet's transform transition is PERMANENT** (`.con-board--fitted`,
  set after the first fit so the mount doesn't animate up from `scale(1)`).
  `--board-scale` is re-derived after ANY stage layout change, and the
  mode's own handback (dock clearance + banner row returning) is exactly
  such a change, landing one frame after the phase ends — with a
  class-scoped transition that correction had nothing left to ride and
  SNAPPED. That is the "planet jumps as the hand dock comes back" bug.
  Corollary: **nothing may measure the board while it glides** — the fit
  arms `boardTweening` for the transition's length and calibration waits it
  out, or it chases a moving planet and wobbles.
- **A transform may only go on an element that is ALREADY positioned.** It
  becomes the containing block of its absolute children, and every arc
  digit / chip / off-Mars hex is authored against the board's coordinate
  space. `.arc-scale`, `.global-numbers-oceans`, `.board-outer-spaces`
  qualify; **`.global-numbers` and `.global-numbers-temperature` do not**
  (the latter is the one scale container without `position`) — those carry
  opacity only. `transform-origin` is the planet's own centre in board px
  (`300px 301px`, `310px 300px` — `keep-px`).
- **THE RETURN IS A REVERSAL, NOT A RE-DERIVATION** — the one that took
  three passes to find. The exit used to RE-FIT, so it landed on whatever
  the fit engine concluded at that moment, and the self-calibration pass
  that followed "improved" it again ~400ms AFTER the landing: a second,
  unanimated correction (measured at 5%, then 0.8% — both plainly visible)
  that reads as the planet jumping just as the hand dock returns. The exit
  now REPLAYS the framing captured at enter — `savedScale`, `naturalW/H`,
  `--con-board-dx/dy` — so the planet glides back to the pixel it left
  from. A fresh fit is the fallback for the only case a replay cannot
  cover: the viewport actually changed while focus was up.
- **Calibration must then be LOCKED to that viewport** (`calibrateLock`).
  Gating it on `phase === 'idle' && !arcsReturning && !boardTweening` is
  not enough: the stage's own handback goes through `scheduleFit`, which
  re-opens the pass budget and lets calibration correct the replayed
  framing anyway. Only a real viewport change lifts the lock.
- **A VISIBILITY FLIP IS NOT A GEOMETRY CHANGE** (`fitKey`) — the same
  lesson as `calibrateLock`, one level up, and the one that made the planet
  "slightly shift" every time the player closed the hand. The board is
  `v-show`n, so EVERY section round trip (hand / colonies / hydro) takes the
  stage to 0×0 and back and the `ResizeObserver` fires twice; `scheduleFit`
  answered both with a full re-derivation, calibration budget included. The
  framing the board comes back to is the one it left with — already on
  screen, already correct — so there is nothing to derive. The fit now
  remembers the FRAME it was derived for (stage box + viewport, as one key)
  and a resize back to that same key is a no-op. Frame-traced before the
  fix: the framing was untouched when the board returned, then re-derived
  ~800ms later and glided — 997→902px wide on one trip and back to 910 on
  the next, oscillating, never converging.
- **…BUT A FRAMING MODE CHANGE IS ONE** (`fitMode`) — the other side of the
  same key, and the bug it shipped is the whole mode failing to look engaged.
  The mode ENGAGES ON THE RAW PROMPT (decision 1), which routinely arrives
  while a workspace still owns the screen: a card played out of the HAND
  leaves the shell on the `hand` section, so the board is `v-show`n away and
  the placement is held behind the played-hero and the outcome's reward beats.
  `fitBoard` bails on a 0×0 stage, so the focus fit is skipped — and when the
  outcome outlasts the enter transition (any card with a production/reward
  stage does), the mode's own `entering → active` re-fit lands in that same
  hidden window and is skipped too. The board then comes back to THE SAME BOX
  it left with, and the key alone answered "already fitted": the player got
  receded arcs, the veil and a compact dock around a planet at OVERVIEW size.
  Reported on «Колонисты в лавовых трубках»; traced with a rAF probe —
  `pfocus-settled` at t=6597 with the stage still 0×0, board back at t=7414,
  `--board-scale` never leaving 1.6876. The identity is now (frame, mode), so
  the return is a real re-derivation and the fit it never got runs there
  (~one frame after the board appears; the permanent transform transition
  glides the growth). `restoreNormalFraming` sets the mode back
  unconditionally — an exit that lands while the board is hidden cannot
  measure a box, but the framing it replayed is a normal one all the same.
  Guarded by `console-planet-focus.spec.ts` § «a placement handed over from
  the HAND», which plays a card whose outcome is SLOW on purpose («Мохол»:
  production, then the tile) and asserts both that the mode really took a
  hidden stage and that the planet grew.
- **…which means the convergence has to FINISH where it starts.** The old
  budget was 2 passes per "fit cycle", and any stage resize re-opened it —
  so an unfinished boot convergence was not a bug that showed, it was a bug
  that WAITED, and the section round trip was merely what let it out. Making
  the round trip a no-op therefore *froze* the wrong framing until the
  convergence itself was fixed; the two are one change, not two.
- **THE OFFSET FOLD IS A TRANSFORM CHANGE TOO** — the root cause, and the
  one the earlier `boardTweening` guard just missed. `--con-board-dx/dy`
  ride the SAME declaration as the scale, so folding an offset starts a
  300ms glide exactly like a re-fit does — but only a re-fit armed the
  guard. The next pass therefore measured a planet mid-flight and folded a
  partial correction **on top of a partial correction** (the fold is
  cumulative), and the convergence chased itself until the budget ran out.
  Device trace at 4K: the boot stopped at `scale 3.5052` with the content
  **371px right and 200px above** the stage centre and stayed there. With
  the fold arming the same guard, the same boot converges to `3.0910` at
  `dx≈0, dy≈0`. Rule: anything that writes the board's transform arms
  `armBoardTween` — there is exactly one transform, so there is exactly one
  guard.
- **"Settled" has no single timestamp** (`armLateVerify`) — the deal
  cinematic, the arcs' travel and the start scene's handback all finish at
  their own pace, so a convergence that ran before them measured a board
  that no longer exists. A bounded WIDENING ladder (4 rungs, 1.5s apart and
  growing, each with a fresh budget) re-measures until it lands; it arms
  both when a pass converges *and* when the budget runs out, because "ran
  out of road" is exactly the case that must look again. It cannot fire
  during play — the frame key does not change during play. This matters
  because **the union bbox is bounded left and right by the ARC MARKERS**,
  which travel to their values (≤1280ms).
- **Diagnose this class of bug with a per-frame trace, not by reading
  code** — sample `--board-scale`, the computed `transform`, the stage
  height and the phase classes every rAF through the return. The
  discontinuity's timestamp names its cause immediately; two of the three
  fixes above were wrong guesses before the trace existed. The guard that
  came out of it is `tests/e2e/console-board-framing.spec.ts` — per-rAF, and
  it asserts BOTH halves (nothing moves on a round trip; a real resize still
  re-fits, so the guard cannot be satisfied by an engine that stopped
  working). Note the older `console-surface-motion` check samples only
  ~450ms after a section exit, which is why it stayed green through this.
- **The disc is a 2.6k-px box carrying a 100px drop-shadow**, so
  `will-change: transform` is set for the transition's lifetime — without
  it the first frames pay for the layer promotion, which is most of what
  read as "not smooth".

## The hand dock has THREE poses (and every pair interpolates)

The pack at the bottom centre is part of the same scene, so it answers the
planet. `ConsoleHandDock` resolves ONE pose class in the component
(`compact && !raised`) — the CSS never has to fight its own cascade:

| Pose | When | Knobs |
| --- | --- | --- |
| **1 · default** | board home | `--hd-scale 1`, no sink, no fan |
| **2 · compact** | Planet Focus engaged (`phase !== 'idle'`) | `--hd-compact-scale` (.6 / .72 on the Deck), `--hd-compact-sink`, `--hd-fade .82` |
| **3 · raised** | RT wheel open, or hover | full size, `--hd-lift`, `--hd-fan 1`, `--hd-spread 1.12` |

Ordering is by URGENCY: raised ≻ compact ≻ default. Opening the RT wheel
over an expanded planet is legal (`nextTab` on the board home works during
placement — P20), so **compact → raised → compact** is a real run and both
directions are one interpolation of the same knobs.

The whole-pack knobs (`--hd-scale` / `--hd-sink` / `--hd-fade`) live on
`.con-handdock__pack`, NOT on the cards: the compact pose is one uniform
shrink of one physical object (animating per-card width/height is banned,
and a partial shrink would change the fan's read). The pack already was a
stacking context (`z-index: 11704`), so the added transform changes no
layering, and flight anchors read `getBoundingClientRect` — post-transform,
so an intake lands on the card where it VISUALLY is in every pose. The
CHASSIS (plate, wings, «КАРТЫ N/M») is untouched in all three: what the
player still needs during placement is the COUNT, not the silhouette.

## The recede is opacity-only (do not "improve" it into a transform)

`.global-numbers` and `.board-outer-spaces` live INSIDE `.board-cont`, so
the planet's own scale transition carries them outward while they fade —
one physical motion. A `transform` on `.global-numbers` would make it the
containing block of every absolutely-positioned arc child and JUMP the
whole ring by the container's own margin on the first frame. `--pfocus-settled`
then `display: none`s both containers: zero rects for the gamepad nav
(free-roam can't land on an invisible Ganymede) and nothing to paint.

## Sequencing (the contract, end to end)

```
prompt (all-main-grid) ──▶ ENTER (arcs fade, planet grows, HUD freezes)
  pick cell (enlarged stage; R3/RT/strict-grid nav unchanged)
  A confirm ──▶ armBoardCardBonus? ─▶ armTilePlacement (SNAPS a mid-enter
  growth settled so the hero measures a static hex) ─▶ POST
  response ──▶ tile hero (flight → touchdown → silent real-tile paint)
  commit (display hold keeps arcs/HUD still) ──▶ reward beats on the field
  (printed icons → chips → rail; ocean coins; card cover lift/gather)
  field story over ──▶ EXIT (exit-prep frame → return transition)
  world quiet (reveal closed, intake landed) ──▶ SCALE BEAT (glide + accent
  + HUD flip + delta chips, blocking) ──▶ follow-ups / announces / bot story
```

Cancel (B / server-cancellable round-trip) exits the same way; nothing
changed, so the beat degenerates to a silent release. A reversal (chained
placement) at ANY exit stage re-enters natively (CSS transitions reverse
from current values) and keeps the ORIGINAL snapshot — the final beat tells
the whole chain in one glide.

## Traps for future work

- `armTilePlacement` calls `snapPlanetFocusSettled()` — keep that ordering
  if the arm ever moves.
- The shell registers `registerPlanetFocusParamsSource` (the playerView
  root identity changes per response — the module must never hold the
  object).
- A new "outer zone" space family must keep `SpaceType.COLONY` (or extend
  `qualifiesForPlanetFocus`) or it will be hidden under an engaged focus
  while still being a legal candidate.
- e2e guards most likely to notice a regression here:
  `tests/e2e/console-hazard-placement.spec.ts` (placement panel) and
  `tests/e2e/console-surface-motion.spec.ts` (`--board-scale` continuity
  probe on section exits — focus deliberately never runs during those).
- Unit spec: `tests/client/components/console/planetFocus.spec.ts`.
