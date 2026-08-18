# The HUD FRAME — the full-bleed PERIMETER SHELL, ONE height token

*(2026-08-15 rework: «архитектурно-визуальный реворк верхнего и нижнего HUD-rail» + the same-day PERIMETER extension: «системный UI-архитектурный реворк внешнего shell»; 2026-08-16: the MIRRORED EDGE SYSTEM — the reserved gutter retired.)*

## THE MIRRORED EDGE SYSTEM (fifth pass — the dead gutter removed)

**One edge token, `--con-edge-x`, on the html scope** (base `.6rem` / TV `.7rem`
/ handheld `.45rem`), and `.con-root { --con-pad-x: var(--con-edge-x) }`. The
former vw-clamped viewport gutter (base `1.6vw`, TV `clamp(.9rem, 1.8vw,
2.6rem)` — ~31–70 physical px) is RETIRED: after the perimeter pass made the
chassis full-bleed, that inset survived as a **dead stripe inside every bar**
(content at the old floating-era line — measured 51.7px@FHD / 111px@4K of
empty band, and the left rail's rows were so starved the production chips
overflowed their plates). Modern TV game/PC modes do not overscan; a small
OPTICAL pad is all the edge needs.

Consequences, all token-derived (no per-surface change):
- The beams' content padding `--con-hud-pad-x = pad-x + 1.05rem` shrinks to
  `1.65rem`/`1.75rem`/`1.3rem` — still the rails' instrument-column line.
- **The rails' content took the freed width**: `--con-rail-w` base `9.1 → 10rem`,
  TV `9.8 → 11rem`, handheld `7.3 → 7.55rem` — `--con-rail-outer-w` (and so the
  board) is within a few px of where it was. The left row fits
  `icon + 4-digit value + «+12» chip`; the strat value track fits a 4-digit
  duel with cubes + «+N» on its value line.
- `--con-stage-x: var(--con-pad-x)` everywhere (the TV clamp is gone): large
  visual objects sit on the bare edge pad, text keeps the content line via
  `--con-stage-gain` (now a constant `1.05rem`).
- JS mirror: `ConsoleCommandBar.runPlan` rootPad = `.7/.45/.6` per profile.
- Diagnostics (`consoleDisplayDiagnostics`) read `--con-edge-x`;
  `--con-safe-x`/`--con-safe-y` no longer exist.
- **The rails' hull-darkening gradients follow the thin hull**: reach
  `calc(--con-pad-x + .55rem)` (the old `+1.4rem` was tuned for the vw
  gutter and put the instrument columns inside the shade — a value flush
  against darkness reads as cropped even when every pixel is drawn).
- The left resource row is a GRID `var(--cr-icon) minmax(0,1fr) auto`
  (icon → value → production): the chip has its own end track and cannot be
  pushed out; `__stockwrap { justify-self: end }` keeps the delta-chip
  anchor on one axis.

Guards: `tests/e2e/console-rail-contract.spec.ts` (value line = structural
`vw − pad-x − .3rem`, production chip whole inside its row plate) +
`console-hud-frame.spec.ts` (bleed compensation = exactly the edge pad).

## THE TWO-LEVEL SAFE AREA + THE STABLE STATUS RAIL (fourth pass, same day)

Three tokens on `.con-root` (profiles override THERE):

| Token | Base | TV | Handheld | Meaning |
| --- | --- | --- | --- | --- |
| `--con-stage-x` | `var(--con-pad-x)` | (same) | (same) | **VISUAL-STAGE inset** — how close large VISUAL objects (card galleries, grids, icon plates, hero objects) may come to the physical edge. |
| `--con-stage-gain` | `calc(--con-hud-pad-x - --con-stage-x)` | — | — | What a TEXT row inside a stage-inset panel adds back to sit on the content-safe line. |
| `--con-ws-foot-h` | `2.5rem` | `3.2rem` | `2.1rem` | **THE STABLE STATUS-RAIL height** — a workspace foot is a FIXED-height instrument (border-box, overflow hidden, one line, ellipsis). |

- **One boundary, one inset.** A workspace panel whose body is card/grid matter
  takes `padding-right: var(--con-stage-x)`; its status rail (TEXT) adds
  `padding-right: var(--con-stage-gain)`. Never stack `screen inset +
  workspace padding + gallery padding` for the same edge. An `--embedded`
  surface zeroes the gain (there is no viewport boundary inside a host zone).
- Adopters: `.con-stdp__panel`, `.con-ma__panel`, `.con-draftws`,
  `.con-hand__frame`, `.con-colonies__frame`, `.con-hydro` (root). Text
  compensators: `.con-stdp__foot`, `.con-ma__foot`, `.con-colonies__rail`,
  `.con-hand__verdictbar`, `.con-draftws .con-wshead`.
- **`min-height` on a workspace foot is the jumping-grid bug**: the stdp foot
  grew with the focused row's chips, the scroll host re-shared its rows and
  the whole grid moved on every cursor step. Foot height is the TOKEN, fixed;
  a profile ladder must not re-introduce a `min-height` there.

## THE JUNCTION GRAMMAR v2 (same pass)

- **The beams carry ONE graded accent each** (`.con-status::after` /
  `.con-footer > .con-cmdbar::after`): full-width, quiet over the side-post
  projections, brightest across the stage opening — the light belongs to the
  scene. The old per-junction weld TICKS and the flat hairline are gone.
- **The posts fade their accents before the beams** (`.con-res-host::after`,
  `.con-strat::after` — vertical hairlines with faded ends) and their TOP
  edge receives the beam's falling shadow (`inset 0 .6rem 1rem -.6rem`):
  the T-junction is an overlap (beam ON posts), never two lines colliding.
  State accents (ws-lift / info) still re-draw the post edge at full
  strength via `box-shadow` on `.con-res` itself.
- **The stage is RECESSED**: `.con-board::before` is a static four-side
  interior shade (strongest from the top beam); `.con-stage-surface()`
  carries the same falling top shade — a workspace opens UNDER the beam.
- **Both side rails speak the INSTRUMENT-PLATE grammar**: rows/items bleed
  through the hull zone to the physical edge (`margin` into the gutter +
  compensating padding), content on the safe line — `.con-res__row`,
  `.con-score`, `.con-tagmx`, and now `.con-strat__item`.
- **Layer rule: the beams span the full width and OVERLAP the posts'
  projection** — top-rail content (player chips) may legitimately cross the
  side-rail column; the posts' faded accents are what make that read as one
  construction.
- ⚠ A profile ladder that re-states a compensated `padding` as a bare
  shorthand strips the safe inset (shipped thrice: handheld `.con-res__row`,
  handheld `.con-score__cell`, handheld `.con-ma__panel`). Repeat the
  compensation in the override, with a comment.

## THE PERIMETER MODEL (second pass, same day)

The two horizontal rails turned out to be half of the system: the side
rails and the workspaces still floated as rounded cards inside viewport
gutters. The shell is now ONE cockpit hull:

- **Four hull members weld to the viewport edges.** Top/bottom (below) plus
  the LEFT resource rail and the RIGHT strategy rail: `.con-main` spans the
  full width (`margin: 0`), a side rail's chassis is
  `--con-rail-outer-w = --con-pad-x + --con-rail-w` wide with the extra as
  `padding` toward the physical edge — **full-bleed chrome + safe-inset
  content**, content boxes byte-identical to the floating era. Square
  corners; ONE accent hairline on the stage-facing edge (the top rail's
  bottom-line grammar, mirrored); a subtle hull-darkening gradient toward
  the physical edge. The ws-mode lift and the info-mode accent recolor that
  same edge — never a full ring.
- **One seam.** `--con-main-gap: var(--con-hud-gap)` — every rail↔stage
  joint is the same narrow void «expansion joint» (top/bottom/left/right of
  the stage opening).
- **A workspace SCREEN is a state of the central scene, not a modal.**
  `.con-ws-band()` right edge is `0` (the viewport) — ⚠️ **superseded
  2026-08-17**: only SCREENS still weld right (`.con-ws-stage-band()`); a
  DIALOG's band stops at the strategy rail. See § THE CENTRAL OPENING at the end
  of this file. The shared
  `.con-stage-surface()` mixin re-dresses every full-screen workspace plate
  (hand / colonies / card-actions / info / MA / std-projects / draft /
  bounded start): square, welded right, machined top seam + quiet left/
  bottom hairlines, `padding-right: var(--con-hud-pad-x)` puts the right
  CONTENT line on the same guide as the top rail's content. The old bright
  cyan ring + `border-radius .7rem` + `right: pad-x` — the «giant modal»
  reading — are gone. DIALOGS (task cards, confirm, colinspect, govsupport,
  sheets, composers) deliberately KEEP their centred-card shape.
- **`--con-ws-left` = `--con-rail-outer-w + --con-main-gap`** — unchanged
  meaning (the stage's left seam), and `.con-info` / `.con-cardactions`
  anchor with it (they used the raw `rail-w + gap` pair before, which broke
  the moment `.con-main` went full-width).
- **Right-edge overlays are welded drawers**: `.con-journal` and
  `.con-inspector` grow by `--con-pad-x` (chassis to the edge, content box
  unchanged), round only their inner corners, and carry the same
  edge-accent + hull-darkening grammar. `.con-played` (fixed band) welds
  via `right: 0` + `padding-right: var(--con-hud-pad-x)` (reset to 0 in its
  `--embedded` seat).
- **TV width caps on filled panels are gone** (`.con-stdp__panel`,
  `.con-ma__panel` → `width: 100%`): a capped centred panel inside a welded
  band was the modal look reborn at 4K. Handheld/TV frame-padding ladders
  keep the right component on `var(--con-hud-pad-x)`.
- The hydro section stays plate-less (its track already lives on the open
  void — the «scene» reading by construction); it only honours the shared
  right content guide now.

Guards: `tests/e2e/console-hud-frame.spec.ts` § 7–9 (rails at x=0 / x=vw
with safe-inset content, ONE seam value on all three joints, the hand
workspace welded + square + safe-inset + same rail seam as the board).

## THE ADAPTIVE-SURFACES PASS (third pass, same day)

The shell had grown but the CONTENT still lived in the old geometry (grids
pinned to the top of 4K bodies, fixed art sizes, the rail internals sized
for the floating era). The policy layer:

- **`.con-fill-scroll()`** — a scroll-hosted layout FILLS the body it was
  given: the ConsoleScrollArea viewport becomes a flex column and the
  content grows to AT LEAST the viewport (`flex: 1 0 auto` — the scroll
  behaviour is untouched). The host's grid takes `flex: 1 0 auto` +
  `grid-auto-rows: minmax(<floor>, 1fr)`: rows SHARE the real height when
  the list fits, fall back to readable content rows when it scrolls.
  ⚠️ **Never set `display` inside the mixin's content scope** —
  `content-class` puts the host's GRID class on that very element, and a
  higher-specificity `display: flex` silently flattened the stdp 2-column
  grid into one full-width column.
- **Adaptive art stages** (`.con-ma__stage`, `.con-stdp__stage`):
  `align-self: center; height: 100%; aspect-ratio: 1/1` between a readable
  floor and an art-quality ceiling — the % height resolves against the
  definite filled card, a scrolling content-sized card falls to the floor.
  ⚠️ The MA card had to become **flex** (was an inner grid): a grid's
  `auto` first column resolves BEFORE stretch, circularly off the min
  floor — the medal never grew. Flex stretches the cross axis first (the
  stdp tile was the working reference).
- **Strategy rail**: medal/number tokens up a class (base 3.3rem / tv 4rem
  / done-poses up to 5.4rem), dense pose from SIX items (`> 5` — the
  enlarged base medal fits exactly the standard five in the zone height).
- **Left rail**: the instrument plates (rows, score cap, tag seam) BLEED
  into the hull zone (`margin-left: -pad-x` + compensating content
  padding) — content stays on the safe line; profile ladders that
  re-declare cell padding must repeat the first-cell compensation
  (`console_tv.less .con-score__cell:first-child`).
- **Beam material + weld points**: both HUD rails carry a layered
  overhead-sheen gradient; a short bright segment on the stage-facing
  accent at the LEFT hull column marks the T-junction (constant geometry;
  the right column deliberately unmarked — a workspace welds to the edge
  there). Side rails carry top/bottom cap lights.

⚠️ **The game server CACHES static files at boot** — after `make:css` an
already-running `npm start` on 8080 keeps serving the OLD styles.css and
Playwright's `reuseExistingServer` happily uses it. Kill the listener
before a visual run (`Get-NetTCPConnection -LocalPort 8080`).

Guards: § 10 of the same spec — «ДОСТИЖЕНИЯ» zone title, medal size, rail
plate bleed + safe content line, stdp/MA grid fills ≥ host, art-stage
growth; screenshots `stdp-adaptive.png` / `ma-adaptive.png`.

The top status strip (`ConsoleStatusStrip` / `.con-status`) and the bottom
command bar (the shell instance of `ConsoleCommandBar` inside `.con-footer`)
are the two horizontal borders of the console cockpit. They are **full-bleed
chrome welded to the physical viewport edges** and **strictly equal in
height** — that equality is an architectural invariant carried by ONE token,
never a visual coincidence of two similar constants.

## The tokens (html scope — `console.less` § THE HUD FRAME)

| Token | Base | TV | Handheld | Meaning |
| --- | --- | --- | --- | --- |
| `--con-hud-h` | `2.2rem` | `2.3rem` | `1.7rem` | THE shared rail height. Both rails' `height:`; borders/inner chrome live INSIDE it (`border-box`). |
| `--con-hud-gap` | `.3rem` | `.35rem` | `.25rem` | Breathing between a rail and `.con-main` (= the root's flex `gap`). Border + focus-ring clearance, nothing more. |
| `--con-bar-h` | `var(--con-hud-h)` | — | — | Legacy alias (dock wings etc.). Never redefine per profile. |
| `--con-band-top` / `--con-band-bottom` | `calc(var(--con-hud-h) + var(--con-hud-gap))` | — | — | The modal-band contract — symmetric BY CONSTRUCTION now. |
| `--con-hud-pad-x` (on `.con-root`) | `calc(var(--con-pad-x) + .35rem)` | follows `--con-pad-x: var(--con-safe-x)` | `+ .25rem` | The rails' CONTENT inset: **full-bleed chrome + safe-inset content**. |

Declared on `html.console-mode, html.console-native` (NOT `.con-root`) so
body-level floating layers — the notification stack, the teleported bot
review — anchor to the same numbers. Profiles override the tokens on their
own `html.con-profile-*` scope (equal specificity; source order decides —
`console_tv.less` imports after `console.less`, the handheld block sits
later in the same file).

## The rules that make it hold

- **`.con-root` carries NO padding** (`padding: 0`); the horizontal inset
  lives on `.con-main` as **margin** (margin, not padding — the absolute
  overlays inside `.con-main` (journal / info workspace / context panel)
  must keep anchoring to the same box edges).
- The top rail: `height: var(--con-hud-h)`, `padding: 0 var(--con-hud-pad-x)`,
  `border-radius: 0`, frame accent on the **bottom** edge (inset box-shadow —
  perf-lite safe). The terra underline anchors to the rail's bottom
  (`bottom: .14rem`) instead of buying a padding row; the params row and the
  player chips centre in the one line. Player chips **never wrap** — a
  crowded table ellipsizes `__pname` (`max-width`), the pill never truncates.
- The bottom rail: the base `.con-cmdbar` KEEPS its floating-card look (the
  menus / bot review embed it) — the shell instance is re-dressed by
  **`.con-root .con-footer > .con-cmdbar`** (three classes ON PURPOSE: the
  per-profile `.con-cmdbar` height/padding overrides for the menu bars must
  never re-dress the welded rail). Accent on the **top** edge.
- The hand dock is welded with the bar: `bottom: 0`, the plate is
  `height: var(--con-hud-h)` (FLUSH with the rail — the bay socket no longer
  pokes above the frame; only the CARDS rise over it, as an overlay), pack
  `bottom: .45rem` → static card tops ≈ `4.85rem` from the viewport bottom
  (handheld ≈ `4.1rem`). `.con-board { padding-bottom: 3.05rem }` (handheld
  `2.8rem`) reserves exactly that + the raised pose's `.45rem` lift.
- Floating chrome anchors derive from the token, never from a vh guess:
  `.con-banner` (`hud−.35`), `.con-drafttray` (`hud+.05`), `.con-mandatory`
  (`hud+1.75`), `.con-banner--events` (`hud+4.55`), the console
  `notifications-layer` (`hud+1.9`), `.con-notice`
  (`band-bottom + 1.3`). No per-profile re-anchors remain.
- **Feedback chips flip DOWN in the top rail**: at y=0 a chip popping above
  the readout leaves the screen, so `.con-status` overrides the
  `--global-parameter` / `--misc` host anchors to `bottom: -1.35rem` — a
  transient overlay over the board's top edge.
- The FINAL generation is **colour only**: the label renders the ordinary
  `GEN.` key («ПКЛ.») always; the `--final` class recolours label + value
  gold. Never an added word/badge/icon (the «ФИНАЛЬНОЕ» word is gone, the
  `FINAL GEN.` key is deleted from `ru/console.json`).
- `ConsoleCommandBar.runPlan`'s `barPad` mirrors the `.35rem`/`.25rem`
  breathing of `--con-hud-pad-x` — keep them in step.

## Guards

- `tests/e2e/console-hud-frame.spec.ts` — FHD + forced-TV 4K: computed
  strip height == bar height == the token; strip at y=0 full width; bar at
  the bottom edge full width; root padding `0px`; plate flush with the bar;
  `.con-main` == viewport − 2×(rail+gap); both side rails stretch to it;
  the generation label carries no final marker; the board stage clears the
  dock card tops. Screenshots → `screenshots/hud-frame/<preset>/`.
- `tests/client/components/console/consoleStatusStrip.spec.ts` § generation
  label — ordinary vs final: same `GEN.` text, `--final` class only.

---

# THE CENTRAL OPENING — what a modal may cover, and who may replace a bar
*(2026-08-17 — supersedes «`.con-ws-band()` right edge is `0` (the viewport)» above)*

The frame is **four hull members and an OPENING**: the status strip (top), the
command bar (bottom), the player rail (left) and the strategy rail (right) are
permanent chrome; the box they enclose is the CENTRAL STAGE. Two rules and the
carve-out:

1. **A modal — and its dim — live strictly inside the opening.** No decision
   surface reaches under a bar, and no bar is ever greyed out. The rails are
   chrome the player reads THROUGH a decision (stocks and production are the
   landing zone of every resource flight; the trophy gallery is *why* they are
   choosing at all), so dimming them costs information for no focus.
2. **A surface that IS the stage takes the right rail's zone** — and then the
   rail stops being **drawn**, rather than sitting dimmed underneath. That is
   every WORKSPACE SCREEN (card actions · standard projects · MA · hand ·
   colonies · hydro · draft · info · «РАЗЫГРАНО» · the start workspace's bounded
   deployment), plus the two right-edge DRAWERS that were always its
   replacement: «Журнал» and the board dossier (all three of its modes —
   `placement` · `cell` · `track`). A SECTION workspace (hand / colonies / hydro
   / draft) additionally has the rail `v-show`n away, which is why its geometry
   was already correct before this pass and a SHEET workspace's (card actions /
   std projects / MA) was not: there `section` stays `'board'`, the rail is still
   laid out, and only the policy frees its zone.
3. Full-bleed **cinematics** (reveal · ceremonies · the mandatory gate ·
   fullscreen inspect · the system menu · the start scene · the endgame) and
   **flight layers** are not in this family at all — they own the whole screen
   and position themselves. Two SYSTEM failure surfaces stay full-bleed for the
   same reason: `.con-stranded` (the leak guard) and `.con-alert`
   (`ConsoleSystemAlert`) must be unmissable.

## GEOMETRY is measured; REPLACEMENT is policy

The two halves are answered in two different places ON PURPOSE, because they are
different questions:

- **Where is the opening** — geometry, measured live by
  `useWorkspaceBandGeometry` (`src/client/console/composables/`) and published as
  four px insets on `<html>`: `--con-stage-t / -b / -l / -r`. It reads
  `.con-main`'s rect, the column's own `columnGap` (so a profile override needs
  no second constant) and BOTH rails' rects. The tokens
  (`--con-band-top`, `--con-ws-left`, …) remain the pre-mount fallback and are
  exact at every shipped profile — the mirror exists for the cases a token cannot
  express: a content-sized strip, a rail that is `v-show`n away, a resize.
  ⚠️ It observes the RAILS as well as the column: a rail flip changes no box
  inside `.con-main`, so the column's own observer never fires for the one event
  that moves the opening's edge most.
- **Is the rail being replaced** — policy, and a policy is a state of the SHELL,
  not a rect. `ConsoleShell.conRootClasses` raises
  **`.con-root--rail-replaced`**, which sets `--con-stage-r-eff: 0px` and hides
  `.con-strat`. It is derived from the WORKSPACE STACK (`frames.length > 0`) plus
  the two workspace-shaped overlays that are not stack frames (`playedOpen`,
  `infoWorkspaceUp`) and the two drawers (`journalPanelVisible`,
  `contextOverlayMode`) — never a second list of surface names to rot.
  Hiding the rail is not belt-and-braces: `.con-root--ws-open` (the
  `conWsPresenceBridge.ts` class — the ex-`:has(.con-ws)`, same DOM-presence
  semantics) LIFTS it to z11520, i.e. **above** every band surface
  (11480–11515), so an unhidden rail paints on top of the very screen that
  took its zone.

**A SCREEN's own edge is not this policy.** The token has exactly two consumers —
the shared dim and the compact dialogs, both of which are asking «is the rail
visible right now». A screen welds itself (`right: 0`), because the policy flips
on the frame the stack empties, which is the frame the surface starts FADING: a
screen that spent the token would re-fit its content inside a 468px-narrower box
(at 4K) while dissolving. Same law as the rail's own lift, which deliberately
rides DOM presence (`conWsPresenceBridge` → `.con-root--ws-open`) so it holds
through the leave for free.

**`visibility`, never `display`.** The rail's BOX must survive the replacement,
or `.con-main`'s flex re-lays out and the board rescales for a mode change —
which is the one thing every overlay in this family exists to avoid. (It also
keeps the rail measurable as a flight anchor.)

## Who spends what

| Consumer | Spends | Note |
| --- | --- | --- |
| `.con-modal-band()` | all four stage insets | **THE** band (dialogs). `.con-ws-band()` is now literally this plus the `con-ws` marker contract. |
| `.con-ws-sides()` | `--con-stage-l` + `--con-stage-r-eff` | The two sides for a DIALOG that owns its own top/bottom. |
| `.con-ws-stage-band()` / `.con-ws-stage-sides()` | `--con-stage-l` + **`right: 0`** | The SCREEN variants: `.con-draftws` · `.con-ma` · `.con-stdp` (fixed) and `.con-cardactions` · `.con-info` · `.con-played` · `.con-start--bounded` (own top/bottom). **A screen declares its edge, never the policy token** — `right: 0` cannot disagree with «am I on screen», while the token flips the frame the stack empties, i.e. the frame the surface starts FADING: the grid would re-fit inside a 468px-narrower box (at 4K) mid-dissolve. |
| `.con-shade` | all four | The ONE shared dim. `--fullbleed` (`FULL_BLEED_SHADE_OWNERS`, `surfaceMotionState.ts`) is the cinematic carve-out. |
| own `__backdrop` | `position: absolute; inset: 0` | `.con-sheet` · `.con-ma` · `.con-info` · `.con-played-cat` — bounded by their own band. A `fixed; inset: 0` dim greys all four members and only *looked* right because two of them out-stacked it; the side rails never did. |

**One definition, because the defect was never per-surface.** «A modal must not
cover a bar» is a property of the FAMILY: the category view over «РАЗЫГРАНО»
inherited `left: 0` from the old full-width band and reached clean across the
player rail — no per-surface fix would have found it. So the band mixin itself
carries the opening, and a member that legitimately takes the rail's zone does
not opt out either: the shell raises one class and every band surface follows.

## Guards

- `tests/e2e/console-workspace-band.spec.ts` — per reachable surface: the band
  clears all four members; the shared dim covers exactly the same opening; and
  the right edge splits the two families by the shell's own policy class (a
  workspace screen reaches the physical edge with the rail NOT drawn but its box
  intact; a dialog clears a LIT rail). Plus **«the opening FOLLOWS a window
  resize»**: a measured box is exactly what can be left standing on stale
  numbers, and SHRINKING is the dangerous direction — a band still sized for the
  old viewport reaches *under* the bars rather than leaving a gap. It resizes
  inside the same profile band on purpose (a profile flip re-mounts surfaces and
  would mask a stale-geometry bug), and it goes back: the opening is a state, not
  a one-way narrowing.
- `tests/e2e/console-right-drawer.spec.ts` — «Журнал» + the board dossier: the
  drawer covers the rail's box, the rail is not drawn, its box survives, and it
  comes BACK when the drawer closes.
- `tests/e2e/console-stdp-stable-geometry.spec.ts` — the walk that proves the
  measured band does not jitter with focus. ⚠️ It pumps BeginFrames
  (`forceFrame`): headless Chromium does not FINISH an idle entrance tween, it
  FREEZES it — which reads as «settled» to any sampler, and the first keypress
  then lands the remaining px on the guard's head.
