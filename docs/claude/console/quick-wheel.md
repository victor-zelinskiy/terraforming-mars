# Quick wheel — input lifecycle + the commit/collapse/reveal grammar

The RT/LT quick selectors (`ConsoleQuickSelector.vue`, entries from
`consoleQuickModel.ts`) are the console's most-used control. This doc is the
contract for their input lifecycle, the tile physicality and the transition
grammar into the opened surfaces. (2026-07-28 rework, v2 — the icon-flight
approach of v1 was REMOVED as arcade-feeling on 4K; do not reintroduce it.)

## The transition grammar

**PRESS → MECHANICAL COMMIT → DEPTH COLLAPSE → CONTEXT REVEAL.**
Nothing travels across the screen. Continuity is carried by:

- the chosen tile's **mechanical commit** (a fast, dense press-IN on the
  commit edge — GSAP in `surfaceMotionDirector`'s quick-leave, body+icon at
  slightly different inertia);
- **depth collapse**: neighbours lose their layer first, the chosen tile
  stays readable a few beats longer, the whole assembly recedes ONE layer
  back (scale 0.972 + small y — never a zoom, never a point-collapse);
- **dimming as an instrument**: the shared `.con-shade` gains a FOCUS
  vignette (`--focus`, driven by the shell while a slot is armed —
  opacity-only `::after` layer) and a retuned off-fade (260ms/40ms) so its
  darkness dissolves INTO an arriving workspace;
- **context reveal in parallel**: the destination enters in the same flush
  (directional bias from the chosen slot via `takeWheelOrigin`), and its
  header emblem **echoes** the pressed symbol (`takeWheelEcho` → a local
  materialize of `[data-wheel-anchor]`, scale .8→1 at ~90ms — never a
  flight); std-projects gets the firmer hub-expansion + row cascade.

## Input: one machine, two CONTROL STYLES (`quickWheel/wheelArmModel.ts`)

Pure reducer over `WheelInputState {focus, arm}`, parameterized by
`wheelControlMode` (`quickWheel/wheelControlMode.ts` — persisted
`tm_wheel_control_mode` + `?wheelControl=`, sanitize → `quick-select`,
Options row «Wheel control», applies instantly — the shell's
`wheelControl.mode` watcher cancels any mid-wheel state without executing).
The shell (`handleQuickIntent` → `feedWheelArm`) feeds edges in and
executes effects out; `wheelInput` drives `focusedSlot`/`armedSlot`/
`armedBlocked` AND the shade's `--focus` vignette (armed only).

**FOCUS-CONFIRM (the deliberate alternative):** directions and the stick
only MOVE the persistent `focus` — their release/neutral does NOTHING. The
d-pad follows the explicit spatial map (`stepWheelFocus`: centre→arm,
opposite→centre, perpendicular→that arm, same = felt edge, missing slot
keeps focus). The STICK walks the SAME map (never an absolute sector):
circling still sweeps the arms (a perpendicular deflection lands on that
arm) and an OPPOSITE deflection returns HOME to the centre — the centre is
not a sector, so an absolute-angle stick could never reach it, and
returning focus home on NEUTRAL is not an option (it would steal the focus
while the player lets the stick go to reach A). A DOWN fixes the action
(navigation FREEZES while A is held — later movement can never swap the
confirmed action), A UP commits — A confirms ANY focused tile. Fixed HOME
focus = the CENTRE tile (LT «Стандартные проекты», RT «Карты») on EVERY
open / LT↔RT switch / mode change — never remembered. Blocked tiles stay
focusable (A refuses, focus survives). Visuals: calm `--focus` state (less
than armed; neighbours NOT muted); the A-cap moves to the focused tile,
direction caps hide; the bar leads with «A Выбрать».

**QUICK-SELECT (default) — unchanged:**

- **Digital (d-pad / A)**: DOWN arms (the tile lifts toward the player), UP
  of the same control commits. Fast tap = its natural ~80 ms; no thresholds.
- **Analog (left stick) — the AIM protocol**: `aim` moves the FOCUS between
  sectors (circling is free), the CONFIRMED neutral (`aimEnd`) commits the
  focused slot. Digital and analog share one visual armed state.
- Conflict rules: repeats never arm; stick-flagged `nav` never digital-arms;
  A vs stick vs d-pad is first-wins EXCEPT the d-pad deliberately takes over
  a stick focus; the merged `navEnd` finishes a d-pad arm even when the
  stick let the direction go last; stale edges drop.

**Shared in both styles:** B always cancels without executing; `reset`
dissolves everything silently; availability is RE-CHECKED at the commit
edge (an action that died between press and release refuses); a blocked
slot arms in resistance mode and REFUSES on its commit edge; the commit
enters the ONE Mechanical Commit → Depth Collapse → Context Reveal
pipeline (no per-mode timelines, no second polling loop, no second DOM).

### The AIM protocol (`gamepadPollModel.ts` §3.5)

Model-level guarantees (all unit-tested):
- engage only past `AIM_ENGAGE_AT` (0.45) — drift/noise below never engages;
- sector borders carry `AIM_HYSTERESIS_DEG` (12°) angular hysteresis — no
  flicker at diagonals; circling hands focus over decisively;
- `aimEnd` fires only after neutral HELD `AIM_NEUTRAL_MS` (45ms) below
  `AIM_RELEASE_AT` (0.3) — a single noisy frame never commits;
- a release FLICK swinging through the far sector re-aims only if sustained
  `AIM_REAIM_FRAMES` (3 polls);
- the in-between radial band interrupts the neutral confirm;
- **`pollStatePending`** keeps `gamepadCore`'s idle early-out diffing while
  any protocol is mid-flight — without it the neutral timer freezes at rest
  and `aimEnd` never fires. Never remove that condition.

`nav`/`navEnd` carry an `analog` flag (stick-sourced); lists ignore it, the
wheel ignores analog `nav` (aim owns the stick). Keyboard arrows stay
digital (keydown arm / keyup commit via the key bridge).

## Handoffs (`quickWheel/wheelHandoffModel.ts` + `wheelPulse.ts`)

Declarative per-entry table `WHEEL_HANDOFFS` — `echo` (destination emblem
id) OR `pulse` (live HUD elements that acknowledge a direct action). The
coverage spec fails on a surface-opening entry without an echo row.

- echoes: trading / card-actions / std-projects / hydro / confirm (pass and
  max-temp heat retarget via `retargetWheelEcho(CONFIRM_HANDOFF.echo)`);
- pulses: `convertHeat` → `res-heat` (the reservoir answers the commit; the
  SERVER result's own flip/delta/marker animations carry the change —
  pulses never pre-time or fake), `cards` → `hand-dock` (the dock, already
  raised under the RT wheel, is the hand's continuity; the existing reveal
  flies the fan out of it);
- no handoff: skipTurn (status flip is the reveal), convertPlants (the
  placement mode itself is the reveal), voting (never commits).
- Pulses fire only when the commit stayed DIRECT (the shell checks the
  confirm card didn't open instead).

## Tile physicality (LESS `.con-quick`)

- **Armed = toward the player**: body `translateY(-.1rem) scale(1.014)` +
  elevated ground shadow + live ring + brighter inner edge + icon parallax.
  Small travel by design — 4K magnifies excursions; depth carries the state.
  The commit press-IN is GSAP's (never CSS) — it drives from the live
  armed pose.
- **Neighbours recede half a layer** (`--muted`: opacity 0.88 + scale 0.988
  + calmer shadows) — the wheel stays ONE readable machine; they never
  disappear.
- **The icon well**: every icon family (line glyphs, resource icons, text
  fallbacks) sits in the same recessed lens (`__slot-icon` — fixed box,
  radial recess, hairline ring) — one optical mass, one armed response.
- Reasons are QUIET at rest (amber 72%) and brighten on the blocked arm
  (+ one small pulse; no shake, no red).
- Key caps float on the shell (the fixed part of the mechanism).
- All state cues are box-shadow/transform/opacity — perf-lite safe.

## Command bar while the wheel is open

Context is `''` (the wheel's kicker already names the mode — the start-scene
precedent); commands advertise the OPPOSITE trigger («LT Базовые действия» /
«RT Действия» — the switch affordance is otherwise invisible) + «B Закрыть».

## Gotchas

- `data-wheel-anchor` hosts must be transformable (inline-block/flex) — a
  plain inline element silently ignores echo/pulse transforms.
- The echo sets the emblem's `autoAlpha` from 0 INSIDE the enter timeline —
  a surface opened WITHOUT a wheel commit shows its emblem statically
  (no concealment leaks: `takeWheelEcho` is consume-once).
- Handheld profile overrides target `__slot` (min-height) and `__slot-body`
  (padding) separately — keep both in sync when resizing tiles.
- The armed visual lives on `__slot-body` (CSS class); GSAP entrance/exit
  animates `__slot`/panel — the layers never fight.
