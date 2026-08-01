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

5. **Focus reclaims non-participating chrome** (console.less,
   `.con-root:has(.con-board--pfocus)`): the banner row above the board
   hides (the placement panel already titles the task) and `.con-board`'s
   hand-dock clearance drops to `.4rem` (the dock is an absolute layer and
   paints over the disc's bottom rim). These are layout flips — the fit
   runs on `$nextTick` after the class patch so it measures the GROWN
   stage, and the disc's transform transition carries the visible motion.

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
- **Self-calibration is the jerk in the landing's last frame.** It measures
  the content union and re-fits WITHOUT a transition; run it while the band
  is still condensing and it reports a wrong natural box. It is gated on
  `phase === 'idle' && !arcsReturning`, and re-armed by the
  `arcsReturning` watcher once the scene is measurable again.
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
