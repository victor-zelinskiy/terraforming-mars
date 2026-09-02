# Card bonus × resource payout — the CONCURRENCY contract

*(2026-09-02. The board card-bonus cover-lift scene (`src/client/console/boardCardBonus/`)
meeting the resource payouts of the SAME placement — printed cell bonuses, ocean
adjacency, Ares adjacency (`consoleTilePlacement` reward beats + the shared
resource-transfer framework). Coordinator: `src/client/console/rewardPayoutQuiet.ts`.)*

## The defect this contract removes

One placement routinely pays a card AND resources (Terra Cimmeria Nova prints
`STEEL + DRAW_CARD` on cell 36 and `DRAW_CARD + DRAW_CARD` on 38; an Ares
neighbour pays adjacency while the placed cell's own card cover is lifting).
Both scenes are armed by the same submit, but they were UNCOORDINATED, and the
coupling ran through a third party — the reveal overlay:

- `rawDrawnRevealPending` is FALSE while `tilePlacementHolds` /
  `nomadMoveHolds`, so the reveal overlay for the staged batch **cannot mount
  until the whole reward beat (the chips) is over**;
- the SINGLE-card scene finished itself on a **fixed 300 ms post-arrival
  timer**: with the overlay parked, the standing card was unmounted and the
  scene deactivated before anything could take it over — the card visibly
  VANISHED at the presentation point, and when the viewer finally opened,
  `openSingleCardFullscreen` saw `isBoardCardBonusActive() === false` and used
  the TEXTUAL entrance (the physical FLIP origin resolves only while the scene
  is live);
- the MULTI path measured `.con-reveal [data-zoom-slot]` rects behind a
  40-frame poll (~660 ms): the parked overlay never produced slots in time →
  `degradeToInstant()` — the covers vanished outright and the cards later
  popped in with no motion.

A cell that pays ONLY a card never showed it: with no reward beat the tile
scene finishes right after the commit and the overlay mounts within a tick.
The bug needed exactly the concurrency.

## The contract

**The card and the chips FLY in parallel; the card's COVERING surfaces wait
for the money; every wait is a real signal, bounded, and exits with the
scene.** Concretely:

1. `rewardPayoutSettling()` (rewardPayoutQuiet.ts) is the ONE answer to «is a
   resource payout still owning the screen»: `tilePlacementHolding() ∨
   nomadMoveHolding() ∨ isResourceTransferActive()` (the transfers term
   includes absorb tails — a chip dissolving into the rail is still money in
   the air). Every term is module-reactive.
2. **Single card**: the cover flies to the presentation point in parallel with
   the chips. Its handoff (`releaseSingleTakeover` in the layer) is sequenced
   on signals: payout quiet → `markBonusZoomEntryReady()` (the viewer opens
   off the STANDING cover — the scene is still active, so the physical FLIP
   origin resolves) → the scene ends a short beat after the viewer actually
   opened (`waitZoomTakeover` polls `consoleCardZoom.card`, bounded by
   `ZOOM_TAKEOVER_MAX_MS`) — never a bare post-arrival timer. The input-gate
   lesson stands: the scene must NOT stay active once the viewer owns the
   take (that swallowed «A Взять»), hence the short post-open beat.
3. **Multi**: `startMulti` awaits `waitRewardPayoutQuiet` BEFORE measuring
   slots — the cover keeps its honest HOVER over the cell while the chips fly
   (phase stays `hover`, so Planet Focus holds the field stage and the overlay
   stays veiled), then gather → fan → frame → handoff run unchanged. The
   40-frame slot poll only ever covers mount latency again, not a parked
   overlay.
4. **Pacing** (the premium half): while the card-bonus scene is live the tile
   scene's waves pass `pace: TRANSFER_CONCURRENT_PACE` (0.85 — printed, ocean
   and Ares beats alike; `tileRewardTransferPace()`), and a single cover
   launching over a settling payout takes `concurrentBonusSceneTimings` —
   only `singleFlightMs` stretches (`CONCURRENT_SINGLE_FLIGHT_STRETCH` 1.3).
   Same arcs, same easing, same flip — the chips stay ahead, the card breathes.
   `concurrentResourcePayout()` (the stretch's test) deliberately reads
   `tilePlacementRewardsSettling()` — rewards OWED or PAYING — not the broad
   holding predicate, so a card flying alone is never slowed by a plain
   landing.

## Load-bearing boundaries

- **The SELF-ARM gate keeps exactly the overlay park's own terms**
  (`tilePlacementHolding() && nomadMoveHolding()` — never a transfers term):
  the arm must land in the SAME reactive flush that releases the reveal park,
  or the un-parked overlay auto-opens the batch before any scene claims it
  (the venus re-arm lesson's mirror image). Residual absorb tails overlap only
  the cover's LIFT at the cell; the covering surfaces are sequenced by the
  scene's own waits (point 2/3).
- **Import direction**: `rewardPayoutQuiet` sits ABOVE the payout systems.
  `consoleTilePlacement` imports the card-bonus CONTROLLER (for
  `tileRewardTransferPace`), so the controller must never import the
  coordinator — the LAYER is its consumer.
- Waits ride `probeTick` (a quiet screen is exactly the state they wait in),
  are bounded (`REWARD_QUIET_MAX_WAIT_MS` 8 s, well inside the scene's 15 s
  arm safety), and exit on `alive()` — an abort is never held on a foreign
  payout.

## Guards

- `tests/client/components/console/rewardPayoutQuiet.spec.ts` — the predicate
  terms, the reward-vs-holding distinction, the wait's three exits.
- `consoleTilePlacement.spec.ts` § concurrent payout — pace decision +
  `tilePlacementRewardsSettling` lifecycle (owed → paying → quiet; card-only
  cell never settles).
- `boardCardBonusModel.spec.ts` / `resourceTransferModel.spec.ts` — the
  stretch touches ONLY the single leg; the pace clamp.
- e2e `tests/e2e/console-board-card-bonus-concurrency.spec.ts` — frame-by-frame
  on the real TCN cells: card continuity from lift to viewer, chip-and-card
  concurrency witnessed, chips (tails included) gone before the fullscreen,
  multi = exactly N covers and no vanish before the frame.
