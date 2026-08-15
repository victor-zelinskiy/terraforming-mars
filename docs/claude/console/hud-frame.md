# The HUD FRAME — the full-bleed PERIMETER SHELL, ONE height token

*(2026-08-15 rework: «архитектурно-визуальный реворк верхнего и нижнего HUD-rail» + the same-day PERIMETER extension: «системный UI-архитектурный реворк внешнего shell».)*

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
  `.con-ws-band()` right edge is `0` (the viewport); the shared
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
