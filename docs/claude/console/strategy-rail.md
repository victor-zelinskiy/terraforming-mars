# The right STRATEGY RAIL — Milestones/Awards premium HUD (P30)

The console board home's right edge is `ConsoleStrategyRail.vue` (`.con-strat`)
— a narrow icon-first HUD of the two 3-slot races, the LEFT resource rail's
geometric twin. It replaced the wide P27 «right home panel» (card-actions
block + text rows + progress bars); the freed band belongs to the board.

## The composition contract

- **Twin rails.** `.con-strat { width: var(--con-rail-w) }` — the SAME seam
  token `.con-res` reads (base 9.1rem / TV 9.8 / handheld 7.3). Never a second
  constant: the invariant «the board sits centred between two equal rails» is
  structural. Guard: `tests/e2e/console-strategy-rail.spec.ts` (FHD + 4K TV +
  Deck, box-to-box).
- **The dossier is an OVERLAY now.** `ConsoleContextPanel` (placement / cell /
  track modes; the idle mode is deleted) mounts only while a mode is active,
  `position: absolute; top/right/bottom: 0` inside `.con-main` — the journal's
  idiom. The board NEVER reflows for a mode change (the planet-focus «mode
  never changes layout» rule holds by construction). ⚠️ The overlay's
  `position: absolute` is load-bearing AND fragile: a later `position:
  relative` in the same block (the old scroll-affordance anchor) silently
  overrides it and re-enters the panel into the flex flow — that shipped
  once and is now a comment in the block.
- **Zones are FIXED halves** (`flex: 1 1 0`): the 3/3 recomposition
  redistributes INSIDE a constant box (keyed leave + FLIP move + a scale
  pose), so the rail's outer geometry cannot jump.

## The information grammar

Icon-first: the medal art (`assets/ma/<slug>.png`, shared `maArt` slugs) is
the identity; COLOUR is the owner; the diamond GEM/pip is the slot state;
POSITION + SIZE is race hierarchy. No names, no bars, no tables — the
workspaces (LB/RB, also click) hold the detail; rows carry `aria-label`
one-liners (deliberately no hover tooltip: the rail clips its list against
extreme-mod overflow, and a clipped bubble is worse than none).

- Zone head = the DOOR: the LB/RB `GamepadGlyph` cap + title (a `<button>`,
  mouse-clickable). Below it the SYSTEM line: the 3-diamond slot tray (the MA
  workspace header's tally grammar — filled with each taker's colour) + the
  compact live price (`maCosts` via the shell — `--free` mint rim at 0).
  Completed → the price yields to the sealed gold ✓ mark.
- Milestone row = medal + MY count (`7/16`; conditional milestones render
  ✓/—; a zero count recedes via `--zero`). `my.ready` (server `claimable`) =
  steady mint halo — «yours, waiting», NOT an error; `availableNow` (offered
  in the waitingFor tree) = the halo breathes (`strat-now-pulse`,
  opacity-only, disabled under `prefers-reduced-motion`).
- Award row = medal (unsponsored = `--quiet`, art dimmed) + the DUEL stack:
  leader unit above at full scale, chaser below at `scale(.8)`/dimmed —
  hierarchy by position + size, never a crown. Ties: ≤2 cubes, else 1 + «+N».
  The viewer's cube is white-rimmed. The funder is the medal's GEM, distinct
  from the race values (funder ≠ scorer stays readable).
- Completed poses differ ON PURPOSE: milestones 3/3 = a fixed TROPHY column
  (bigger medals, values gone — the race is settled); awards 3/3 = a LIVE
  scoreboard (bigger medals AND bigger numbers — the race runs to game end).

## The motion machine (all in the component)

Seed-then-diff (the `maCeremonyState` idiom): `created()` seeds silently per
epoch (`playerView.runId`), so mount / reload / reconnect never replay — not
even for one frame. A live claim/fund queues a SEAL:

- `covered` prop (shell: `!boardHomeIdle || reveal || start scene`) defers the
  beat — a claim made inside the MA workspace seals when the workspace folds
  and the player lands on the board: the ceremony's continuation. TTL 45s →
  silent apply (an old ceremony must never replay late).
- The seal renders the HELD pre-claim face until its beat (`heldByKey` — the
  last OPEN snapshot, numbers intact), then `--sealing` animates the owner
  plate + gem + light kiss in while the value cell fades (950ms, staggered
  340ms for a multi-claim response).
- The third seal HOLDS the composition for a read beat (1050ms), then
  `composed` flips: open rows leave (pinned absolute — `pinLeaving` sets
  top/left, or they snap to the list origin), survivors FLIP (`-move`), the
  medal pose settles via `--arriving`'s one-shot scale.
- Leader changes: units keyed by GROUP colour signature — a lead⇄chase swap
  keeps both keys, so the TransitionGroup MOVES them (the scale/opacity
  hierarchy lives on the INNER `__unitbody`, or the FLIP transform would
  fight it); a changed group crossfades. Value changes tick (`--tick`) only
  on a REAL diff while watchable; an UNDO rolls everything back silently.
- Reduced motion: everything applies instantly (`:css=false`, no seals).

## Guards

- Model: `tests/client/components/console/consoleMaHudModel.spec.ts` (pure
  `buildMaHudZone` — ready/offered, leader/second/ties, funder≠scorer,
  completed facts, price pass-through).
- Component: `ConsoleStrategyRail.spec.ts` (render grammar, doors, poses, the
  seal pipeline through a captured-timer queue, undo, epoch reseed). ⚠️ Its
  rAF polyfill is SUITE-scoped — a top-level `before` in a spec file is a
  mocha ROOT hook of the whole shared bundle and silently un-degrades every
  later spec (shipped as two CardSelectionContent failures).
- e2e: `console-strategy-rail.spec.ts` — twin-rail geometry at FHD / Deck /
  4K TV, no `.con-inspector` on idle, the dossier overlay raises without a
  board reflow, LB/RB round trips.
