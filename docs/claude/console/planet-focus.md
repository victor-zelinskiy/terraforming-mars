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

4. **The focus fit is DETERMINISTIC.** The Mars disc is a fixed 620×600
   asset at a fixed position in `.board-cont` (670×600), so the focus
   framing is a constant local rectangle (`PFOCUS_FRAME`) — pure arithmetic
   for `--board-scale` + `--con-board-dx/dy`, no measurement, nothing for a
   mid-transition rect to poison. Self-calibration is gated to phase
   `idle`; the stage vars are saved at enter and restored at exit.

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
