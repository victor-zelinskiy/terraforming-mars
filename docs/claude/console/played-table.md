# The played table («Разыграно», X) — ONE PAGE OF TABLE STACKS; a zone is read in its category view

**Status.** TR65 (2026-10-17, `docs/TURMOIL_REDUX_STRATEGIC_SHIFT.md` § 3) made «Разыграно» a workspace SCREEN in the central opening
(the chassis below — kept). The owner's correction of 2026-10-19 replaced TR65's paged SHELF ALBUM: **«разыграно всегда должна быть
одна страница»** — every zone lies as a compact TABLE STACK on ONE page, its compactness solved from the free space and the counts;
pressing a zone opens its CATEGORY VIEW, and only there are pages allowed — an album of at least two rows, turned by LB / RB, the
player told that there are several, the seat NOT switched inside. The law: `.claude/rules/console-ui.md` § THE PLAYED TABLE IS ONE
PAGE OF STACKS. Ledger: sections BC (TR65, PL-610…627) and BH (the stacks, PL-683…).

## 1 · The chassis — a workspace SCREEN in the central opening (TR65, unchanged)

`ConsolePlayedOverlay.vue` (`.con-played`, `console_played.less`) stands on the workspace screen chassis: `.con-ws-stage-band()`
(top/bottom/left from the measured `--con-stage-*` tokens, `right: 0`), the `con-ws` marker on the standalone root, `.con-root--rail-replaced`
from the shell, its own `__backdrop` (`.con-backdrop-dim()`, `absolute; inset: 0`), the body on `.con-stage-surface()` (opaque — PL-137).
z 11400 (under the task host), `--hero` 11520 (the landing scene). The surface-motion director knows it as `'played'`; the shell mounts
it behind `<transition :css="false">` — the dismiss is the director's ONE phrase. **The head is `ConsoleWsHead`** — «РАЗЫГРАНО ›
‹участник› › ‹зона›», a trailing total; **the category view titles NOTHING** (it hands its stage up). A bot seat prints its provenance
line. **The satellite lane** (`--con-played-satellite-w` as a `margin-left` on the panel's children) keeps the ДОП. РЕСУРСЫ chips clear.

## 2 · The planner — one page, the compactness solved (`consolePlayedModel.planPlayedStacks`)

PURE; solves the whole table from the measured body box (`__body`, `offsetWidth / offsetHeight`) and the zones' counts:

- **The stacks** (`PLAYED_STACK_ORDER`): corporation · preludes · CEO · active · automated · events. The corporation and the events are
  ALWAYS drawn (a PREPARED place — a dashed outline that names what is missing, PL-620 — when empty); a project zone only when it holds
  a card (`drawnStacks`). An identity-only table keeps its two stacks at the left edge, the projects' room right of them saying so
  («Сыгранных проектов пока нет», `__none`).
- **A stack is a CASCADE** — every covered card shows its title BAND (`peek`), the newest lies whole in FRONT; a long zone continues in
  LANES (`splitLanes` — balanced contiguous runs of the play order, the earlier lanes take the remainder, so the newest card is always
  the front of the LAST lane — the landing's target is a whole face). The events are ONE face-down pile (one card box) with its count.
- **The compactness** is three numbers solved together: the FACE (one zoom for every stack, `STACK_MIN_ZOOM` 0.3 … `STACK_MAX_ZOOM` 1.0
  × uiScale — a few cards read large: the 4K screen is not left dark, the owner's rule), the BAND (`STACK_PEEK_COMFORT` 75 natural px — the whole plate and the divider; down to
  `STACK_PEEK_TIGHT` 52 — the name still reads) and the LANES (handed out one at a time to the tallest cascade while the width allows,
  until every cascade fits at the comfort band). The solver takes the LARGEST face at which every stack fits with a readable band
  (`density` `comfort` / `tight`); past every readable band the floor face takes whatever band the height leaves (`pile` — the zone is
  read in its category view). Measured (1480 × 800 body, 1080): the corporation alone → 320 px (the cap); 20 cards → 219 px, comfort;
  50 → 188 px, comfort with two lanes for the two long zones; 100 → 157 px, tight. 4K doubles every number; the Deck (1000 × 600)
  reads 150 / 119 / 100 px.
- **A short stack the height holds WHOLE is laid out whole** (`spread` — every card whole, `STACK_SPREAD_GAP` apart): never a band
  between the natural peek and the whole face (it would bare half a picture); the two preludes of an early table read whole.
- **The spare width spreads the stacks** (the gap grows up to `STACK_GAP_MAX`), the rest centres; the content never leaves the body.

A stack's CAPTION may run on into the gap before the next stack (`captionRoom` — a one-lane stack at 4K is narrower than
«АВТОМАТИЧЕСКИЕ 3»), never under the next caption; past that the label ellipsizes in its own box, the count and the A badge never
shrink. Every px knob multiplies by `conUiScale()` in lockstep (the unit spec's TV row). The root publishes `data-played-density`; a stack
`data-played-stack` (its key) and `data-played-lanes`; a focusable stack `data-played-cat`.

## 3 · Navigation — by STACK

The d-pad walks the stacks spatially (`pickSpatialTarget` over the live `[data-played-cat]` rects); A (and X) opens the focused zone —
a ONE-card zone goes straight to the fullscreen out of its slot (the smart open), the bot's corporation too; LB / RB walk the SEATS
(standalone; embedded the Information workspace owns the seat); LT / RT and the right stick have nothing to turn at the table. The stack
is on the CURSOR GRAMMAR (TR58 — `.con-cursor()`: the ring + halo a layer, the lift the stack's own transform — the whole stack rises as
one object). The bar reads «A Открыть · LB/RB Игрок · B Закрыть» — no page verb.

## 4 · The category view — one screen when it fits, else an ALBUM (`ConsolePlayedCategoryView`, `consolePlayedCategoryModel`)

`planCategoryView` decides: ONE card → the near-fullscreen stage; a zone that stands on ONE screen at a readable face (≥ the table's face
when it can, never under `CAT_GRID_MIN_ZOOM`) → the adaptive grid (`planHandGrid`); else the **PAGED ALBUM** (`planCategoryAlbum`):

- **The page grid** is the profile's hand page with AT LEAST TWO rows (`categoryAlbumSpec` — 5 × 2 on TV / FHD; the handheld's and
  «Крупные карты»'s 4 × 1 becomes 4 × 2); the face is a BOX fact (24 cards and 100 are the same face — the count only adds pages).
- **Strict pages on ONE transform strip** (the hand album's law — `--live` once the view stands, never a slide on mount); the page on
  screen is DERIVED from the focused card (`albumPageOf(focusIndex)` — no second page state); the page on screen and its neighbours
  mount faces.
- **LB / RB turn the pages** (`turnCategoryAlbum` — the relative slot on the next page, clamped into a partial last page); ◀ / ▶ off a
  page's edge continue onto the next one keeping the row (`stepCategoryAlbum`); the right stick flicks a page; the wheel too. **Inside a
  category the seat is NEVER switched** — standalone the overlay delegates every intent to the view; embedded the shell routes LB/RB
  past the seat switch while `categoryOpen ∨ categoryBusy`.
- **The page count is STATED**: the SPINE under the pages (`[data-cat-spine]` — the LB / RB glyphs, ghosted at their end, «N / M», a dot
  per page, the range «1–10 из 24»), the EDGE chevrons in the album's own lanes (ghosts at the ends). The bar adds «LB/RB Листать» while
  `consolePlayedUi.pageCount > 1` — the view writes the mirror and resets it on unmount.
- **The view never scrolls** (the grid's old scroll path is unreachable from the planner — the unit spec sweeps 2…120 cards).

## 5 · The physics — unchanged, re-anchored

- **A category LIFTS off its stack and returns**: the director reads `.con-played [data-played-key] .con-played__face :is(.pcard)` (a
  covered card's FULL rect — it slides out from under the cards above it) and the events' `.con-played__family--event .con-played__backstack`;
  the slots of the lifted zone keep their geometry and wear `--held-out` (ONE instance); an ALBUM flies the page on screen
  (`plannedFlightIndices(..., page)`) and the other pages' cards dissolve in place (grounded); the close flies the page on screen home.
  **The view stands over the table's BODY** (PL-626 — `catInset`), the crumb stays lit and reads the open zone.
- **A played card LANDS on its stack** (`providePlayedHeroTarget`, `measureHeroTarget` / `peekHeroTarget`, `heroHiddenKey` → `--incoming`):
  the table renders the +1 layout before the card arrives — the reserved slot is the FRONT of its zone's last lane; an EVENT lands on the
  pile. **The content renders ONCE, against the measured body** (PL-625).
- **The X viewer** rises out of the slot under the cursor; the table stays painted under it.

## 6 · Seats — the rival, the bot, the empty table, the embedded table

LB / RB walk the seats on ONE chassis (never an empty frame); a rival reads the same stacks of PUBLIC faces (`publicFaceModel`; the
corporation's stack carries its LIVE model — its stored resources on its own capsule); MarsBot — its corporation face on the first stack
(`__botcorp`) + its flipped pile, the provenance line; an early table — the corporation alone, the projects' room in words, the events'
place; nothing at all — `__void` in that room. **Embedded in «Информация»** — the same component, no marker / motion id / backdrop /
satellite lane; the planner runs against the host's zone.

## 7 · Perf

The planner is O(stacks × zoom steps) and allocates nothing per frame; the whole table mounts every face ONCE (a covered card takes the
`thumb` art tier — its art row never shows under a band ≤ the natural peek); the album mounts the page on screen ± 1. The perf probe
(`console-played-perf-probe`) opens the fullest stack.

## 8 · Guards

Unit: `consolePlayedModel.spec` (zones · `splitLanes` / `drawnStacks` · `planPlayedStacks` — one page for 5…180 cards, comfort → tight →
pile, the events one pile, the newest card the front of the last lane, the identity-only table at the left, the TV lockstep, stability),
`consolePlayedCategoryModel.spec` (the album — ≥ 2 rows, the box face, the page lookups, the d-pad across the edge, LB / RB, the slot
arithmetic = the flights'; never a scrolling grid 2…120), `ConsolePlayedStack.spec` (the cascade, the holds, the fleet on a dock's face),
`ConsolePlayedCategoryView.spec` (the album mounted, the spine, LB / RB, the d-pad crossing, a one-screen zone has no spine),
`ConsolePlayedOverlay.spec` (stacks, one page, the hero landing, the smart open, the bot, embedded), `cursorGrammarGuard` (the stack is a
MIGRATED surface; the ratchet fell 6 → 3 / 2 → 1). e2e `console-played-table.spec.ts`: **A** (fhd · tv4k · deck) the 20-card table one
page — nothing leaves the body, the front faces ≥ 190 / 380 / 120 px, no chrome under the TV floor, no page verb; **B** (fhd · tv4k) 50
cards on one page, a two-lane stack, the fullest zone opens as an ALBUM — the spine «1 / N», ≥ 2 rows, «Листать», RB / LB turn the page
and the crumb's seat stays, B home, RB at the table is the seat; **C** the lift and return; **E** the rival; **F** the early table + the
bot; **G** reduced motion. The landing keeps its own witnesses (`console-play-landing-geometry`, `-probe`, `console-played-zoom-return`).
