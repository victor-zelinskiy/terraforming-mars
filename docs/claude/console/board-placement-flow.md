# Board placement flow — the two-phase confirm + the placement reticle

*(2026-09-02, the premium board-experience iteration. Code:
`src/client/console/tilePlacement/placementFlow.ts`,
`src/client/components/console/ConsoleBoardCursor.vue`,
`ConsoleBoardSection.vue`, `ConsoleBoardInput.vue`, the shell's placement
branches; styles in `console.less` § placement reticle + `board.less`.)*

## Why

A tile placement is the one everyday action no undo can honestly unwind: the
submit records events, pays the cell's printed bonuses, may draw a card. The
historical protection was a centre-screen confirm dialog (covers the very
cell being confirmed; this fork shipped with it OFF by default), so on a pad
`A — РАЗМЕСТИТЬ ЗДЕСЬ` was a single, instantly-irreversible press — and
misaimed placements happened. The fix is a SECOND PHASE OF THE BOARD ITSELF,
never a modal.

## The state machine (`placementFlow.ts`)

`navigate → locked → committing`, one module-reactive singleton.

- **navigate** — the reticle travels the legal set. A on a legal cell (two-step
  mode) → `lockPlacementCell`: PURE presentation. Nothing is submitted, no
  event exists, no bonus moves, no card is drawn.
- **locked** — the projection settles into the hex, the other legal cells
  recede (`.con-board--locked`), the bar relabels
  (`A Подтвердить размещение` / `B Изменить клетку`), the dossier's cell bar
  turns amber «· Выбрано». B → back to navigate (zero consequence); a d-pad
  step UNLOCKS AND MOVES in the same press (no dead input); the whole-flow
  cancel is one more B away — the back hierarchy stays one level per press.
- **committing** — entered in `ConsoleBoardInput.confirmPlacement()`, the ONE
  commit funnel every source drives (pad A, mouse click, the legacy dialog).
  All board input is absorbed by phase; the transport's
  `isServerSideRequestInProgress` is the second, independent barrier. The
  reticle holds an amber breathing pose — that IS the pending feedback, no
  new surface.

### Input safety is structural

1. Press intents are edge-detected upstream — a held A never re-fires.
2. The commit requires the locking press to have been **released**
   (`armedRelease`, observed off the intent bus exactly like
   `consoleHoldConfirm` — observers are non-consuming and run before the
   routing handler, so the locking press is already reflected in
   `confirmDown` when the shell asks). A mouse lock (no button on the bus)
   arms immediately.
3. A **minimum lock dwell** (`LOCK_COMMIT_DWELL_MS` = 280 ms, deliberately
   NOT motion-scaled — same rule as `HOLD_CONFIRM_MS`) separates the two
   presses, so a double-tap or pad bounce cannot ride through before the
   locked pose has painted.
4. The **entry hold-gate**: if A is physically down when placement mode
   engages (the press that opened the mode), every board confirm is refused
   until one release — in BOTH modes.
5. `beginPlacementCommit` arms an 8 s safety: a commit whose request was
   dropped (raced another in-flight submit) falls back to `locked`.

### Refusal / world-moved

- A server refusal / network failure → `rollbackPlacementCommit()` from the
  transport's abort battery: back to `locked` with the cell intact
  (single-press mode: navigate), and the registered re-arm hook re-wires the
  board — **`confirmPlacement` nulls every per-cell onclick before posting,
  and before this hook a refusal left the whole board click-dead** (a real
  pre-existing bug).
- The shell watches `gameStateVersion(view)` (`placementWorldVersion`): a
  version move while `committing` = the commit succeeded straight into a
  CHAINED placement → reset to navigate; while `locked` = an off-turn update
  → the lock survives only if its cell is still `.board-space--available`.
  A refusal never moves the version, so rollback stays the abort battery's.

## The preference

`placementFlowState.twoStep` (localStorage `tm_place_confirm`, default ON) —
a `controls` row in `consoleSettingsModel` («Размещение тайла»: Два нажатия /
Одно нажатие). Single-press keeps the entry hold-gate and the committing
absorb. Turning two-step off mid-lock folds the lock. The MOUSE follows the
same setting: click = lock, click the locked cell again = confirm, click
another legal cell = move the lock (`onTileSelected`'s two-step branch — the
last gate re-checks `placementCommitReady()`, so no path can bypass it).

## The reticle (`ConsoleBoardCursor.vue`)

ONE persistent element teleported INSIDE `.board-cont` (resolved once at
mount — the board never remounts), positioned in intrinsic board px
(keep-px), so the planet's scale/pan transform carries it for free. Travel is
a retargetable 120 ms transform transition — a held direction (nav repeat
≈130 ms) always redirects the glide mid-flight; nothing queues. Coordinates
come from a module-level cache keyed `${boardName}|${spaceId}` (rect division
cancels the transform exactly, so a mid-tween measure is still correct; the
map key protects a rematch onto another board).

Poses: **legal** (mint ring + breathing ::after + the tile PROJECTION — the
real `board-space-tile--*` art at 0.5 opacity, slightly lifted, with the
owner cube at its true seat and a soft ground shadow) · **blocked** (muted
red ring, no projection) · **locked** (projection settles: opacity .88,
scale 1, shadow deepens; the amber lockring converges in one shot) ·
**committing** (lockring breathes quietly). The projection yields the cell to
the HERO SCENE the moment the transaction verifies (`tilePlacementState`
phase past `armed`) — the flying tile is the object from there, and the
commit's view-apply resets the flow, so proxy → real tile stays seamless.

Paint budget: transform/opacity/box-shadow only (the paint baseline strips
`filter`); both infinite loops are compositor-only and registered in the
fx-lite stop-list, the workspace pause-list and the reduced-motion media
block (the class-bridge sheet's «loops play once» covers the override path —
both loops are 0%/100%-symmetric).

## Field grammar around it

- `.con-board--placing` / `.con-board--locked` on the board root (never
  `body.placement-pending` — that class lost its writer with PlayerHome and
  its rules were dead; they are deleted).
- Non-focused availables dim to .74 while placing, .34 past the lock.
- The **availability wave**: on placement open each legal contour blooms in
  on a radial stagger (`--con-wave-d` per cell, set by
  `ConsoleBoardInput.playAvailabilityWave`); the classes are STRIPPED after
  playing — the board is `v-show`n and a display flip replays any standing
  CSS animation (the known trap).
- **Adjacency hints** (`ConsoleBoardSection.updateAdjacencyHints`): adjacent
  OCEANS get a cool interior wash, adjacent HAZARDS a warm-red one — the two
  always-true adjacencies only; tile identity from the view model, geometry
  from the intrinsic position cache (no per-step layout reads). The exact
  arithmetic stays the dossier's job.
- The focused cell's printed bonus icons take a 1.5 px seat-lift.
- The baseline hex contour gained an ~8 % interior well (board.less) — cells
  read as surveyed basins, separating the field from the terrain.

## e2e driving (the drivers changed!)

`placeTile` in `consoleStart.ts` presses Enter TWICE per cell attempt (lock →
confirm) and works in both modes. A spec whose subject is a landing scene or
a timing measurement — `zz-nomads-visual`, `console-board-card-bonus-
concurrency`, `console-tile-replacement` (mouse click = commit) — calls
`forceSwiftPlacement(page)` BEFORE boot. The flow's own guards:
`tests/client/components/console/placementFlow.spec.ts` (state machine,
release gate, dwell, rollback) and `tests/e2e/console-placement-confirm.spec.ts`
(server-truth: navigation/lock/B touch nothing; the second press commits
exactly once).
