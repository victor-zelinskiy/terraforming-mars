# Quick wheel — press→release lifecycle + shared-element flights

The RT/LT quick selectors (`ConsoleQuickSelector.vue`, entries from
`consoleQuickModel.ts`) are the console's most-used control. This doc is the
contract for their input lifecycle, the tile physicality and the icon flights
into the opened surfaces. (2026-07-28 rework.)

## Input: arm on DOWN, commit on UP (`quickWheel/wheelArmModel.ts`)

Pure reducer, unit-tested (`tests/client/components/console/wheelArmModel.spec.ts`).
The shell (`handleQuickIntent` → `feedWheelArm`) feeds edges in and executes
effects out; `wheelArm` (shell data) drives the `armedSlot`/`armedBlocked`
props.

- **DOWN** (A / a d-pad direction) **arms** the slot — the tile's body seats
  visually. **UP of the same control commits.** A fast tap arms+commits in its
  natural ~80 ms; there is **no hold threshold and no timer** anywhere.
- Hold-repeat (`nav` `repeat: true`) never arms — a direction held from before
  the wheel opened cannot ghost-arm.
- First-wins across sources (A vs d-pad); **rocking the d-pad re-arms** onto
  the live direction (the stale direction's `navEnd` no longer matches).
- A release matching nothing (control already down at open, arm cancelled) is
  dropped — no phantom commits.
- **B always disarms AND closes** without executing. LT/RT switch feeds
  `reset` first. A shell watcher on `consoleState.quick` clears the arm on any
  external close (`closeConsoleLayers`).
- A **blocked** (unavailable) slot arms in `blocked` mode — shallow seat,
  amber ring, reason pulse — and its release **refuses** (notice restates the
  reason). Nothing executes.

### The `navEnd` intent (d-pad falling edge)

`gamepadPollModel.diffSnapshots` §3 emits `{kind: 'navEnd', dir}` on full
release **and on direction change** (old dir ends before the new begins).
The keyboard bridge mirrors it from arrow `keyup`. **Every falling edge dies
in `ConsoleShell.handleIntent`'s release block** — only the quick wheel (while
open) consumes them; list-navigation consumers never see the kind. Button
layout swap (`remapConsoleIntent`) passes `navEnd` through untouched.

## Tile physicality (LESS `.con-quick`)

Two-layer mechanism: the **shell** (`__slot`, positioning cell) carries the
floating **key cap** (`__slot-key`, the glyph on its own mount plate — the
FIXED part); the **body** (`__slot-body`, the plate with the material) is the
MOVING part that sinks on arm. Icon counter-floats (parallax). Neighbours get
`--muted`. All state cues are box-shadow/transform/opacity — **perf-lite safe**
by construction. Disabled tiles keep an opaque chassis (content dims, never
whole-tile opacity).

LT↔RT switches swap the cross in place: keyed `<transition>` (`con-quick-swapl`
/ `-swapr`), direction follows the pulling trigger. Reduced motion: fade only.

Entrance/exit are GSAP in `surfaceMotionDirector.ts` (`wheel-open`: hub-out
assembly, centre pops first, arms slide from the hub, key caps print last;
commit leave: neighbours unlock outward + the chosen slot's release pop;
dismiss leave: inward collapse). Slot-level GSAP transforms never collide with
the body-level CSS arm transforms.

## Flights (`quickWheel/wheelFlightModel.ts` + `wheelFlight.ts`)

On commit the slot's icon detaches and travels into the opened surface's
anchor — the wheel and destination read as one gesture. **Declarative table**
`WHEEL_FLIGHTS` (entry id → `{anchor, character, landing}`); a new wheel entry
gets its transition by adding a row, never bespoke shell code. The coverage
spec (`wheelFlightModel.spec.ts`) fails on an entry without a row.

- Runtime: `beginWheelFlight` (called in `activateQuickSlot`, same tick as the
  commit, wheel still mounted) measures the icon, blanks it, arms the request;
  the always-mounted `ConsoleWheelFlightLayer` (z 11710) poses a real-Vue proxy
  and runs the director: detach lift → **rAF acquisition** of
  `[data-wheel-anchor="<id>"]` (one stable frame; the surface opens in
  PARALLEL — the flight never delays logic or the overlay's own entry) →
  character travel leg (quadratic arc via `flightArcPoint`).
- **Landings**: `become` — the anchor IS the icon (concealed at acquisition,
  takes over at touchdown; restored on any kill); `absorb` — a live HUD element
  (dock plate, heat row) swallows the proxy with a pulse, never concealed.
- **Degrades honestly**: missing anchor → mid-air dissolve; reduced motion →
  no flight at all; episode-guarded (new commit kills the live flight);
  safety-timed. `retargetWheelFlight(CONFIRM_FLIGHT)` redirects pass /
  max-temp heat into the confirm card's emblem; guarded execute paths call
  `cancelWheelFlight()`. `resetWheelFlight()` runs in the shell unmount chain.

### Anchors shipped

| id | element |
| --- | --- |
| `trading` | `ConsoleColoniesSection` kicker emblem (screen retitled **«Торговля»** = existing `Trading` key; command bar already said it) |
| `card-actions` | `ConsoleCardActions` kicker emblem (browse mode only; repeat keeps `⟳`) |
| `std-projects` | `ConsoleStdProjectsScreen` `.con-stdp__emblem` |
| `hydro` | `ConsoleHydroSection` `__glyph` (now the `hydronetwork` BarButtonIcon) |
| `confirm` | the shell confirm card's `__emblem` (pass flag / heat icon) |
| `hand-dock` | `ConsoleHandDock` `__plate` (absorb — the hand rises out of it) |
| `res-heat` | `ConsoleResourcePanel` heat row icon (absorb) |
| `temp` | `ConsoleStatusStrip` temperature icon (the ember spark's landing) |

Characters: `orbit` (trading), `surge` (card actions), `forge` (std projects),
`wave` (hydro), `deal` (cards→dock), `flag` (confirm hop), `ember` (heat row,
then a spark rises to the temperature readout), `sprout` (dive into the board
as placement mode lights up), `stamp` (skip turn — directional dash, no
destination).

## Gotchas

- The flight layer is decoration: pointer-inert, **no animation hold, no leak
  detector registration** (it never serves a prompt). Do not add gating to it.
- `data-wheel-anchor` hosts must be transformable (`inline-block`/flex) — a
  plain inline `<i>` silently ignores the receive pulse.
- The proxy is a real Vue render (BarButtonIcon / resource icon / glyph — the
  same visual triple as `QuickEntry`), NOT `cloneNode`.
- Handheld profile overrides target `__slot` (min-height) and `__slot-body`
  (padding) separately — keep both in sync when resizing tiles.
