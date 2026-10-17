# The played table («Разыграно», X) — THE TABLE IS A TABLE

**Status.** Shipped 2026-10-17 with TR65 (`docs/TURMOIL_REDUX_STRATEGIC_SHIFT.md` § 3 — the iteration's diagnosis, the before /
after frames and the share table). The law: `.claude/rules/console-ui.md` § THE PLAYED TABLE IS A TABLE. Ledger: section BC
(`docs/claude/gameplay-polish-ledger.md`, PL-610…). Before it, «Разыграно» was a DRAWER — 53 % of the 4K screen over the dimmed
board, every zone a PILE of name strips (a 371 px face with an 87 px peek, names at 13–17 px: 51 texts under the TV floor), the right
third of the band empty, the corporation one strip among the strips. The category descent (faces 441 px) and the physics (the lift,
the landing) were already right and are kept untouched.

## 1 · The chassis — a workspace SCREEN in the central opening

`ConsolePlayedOverlay.vue` (`.con-played`, `console_played.less`) stands on the workspace screen chassis: `.con-ws-stage-band()`
(top/bottom/left from the measured `--con-stage-*` tokens, `right: 0` — a screen declares its edge, never the policy token), the
`con-ws` marker on the standalone root (`.con-root--ws-open` lifts the player rail; the rail stays LIT — its resources are the
landing zone of nothing here, but it is context), `.con-root--rail-replaced` from the shell (the strategy rail's zone is the
table's), its own `__backdrop` (`.con-backdrop-dim()`, `absolute; inset: 0` — the opening's dim, never a full-bleed one), the body
on `.con-stage-surface()` (opaque — PL-137's law). z 11400 (under the task host at 11480: a mandatory surface closes the table
first), `--hero` 11520 (the landing scene stands over the band surfaces). The surface-motion director knows it as `'played'`
(`surfaceMotionModel.ts`; `NON_SHADE_OWNERS` — it owns its backdrop, the director fades it on dismiss; the root carries
`data-motion-surface="played"` only standalone and only outside the hero scene, so the landing's own enter / leave never pass
through the band hooks). The shell mounts it behind `<transition :css="false" @enter="surfaceEnterHook" @leave="surfaceLeaveHook">`
— the dismiss is the director's ONE phrase, never a `v-if` cut.

**The head is `ConsoleWsHead`** — root «РАЗЫГРАНО», subject the viewed seat's display name, the stage the category or the embedded
host's phrase (`crumbStage`), a trailing `__total` dot («· [card] N»). **The category view titles NOTHING**
(`ConsolePlayedCategoryView` lost its own head): it hands its stage name up, the crumb reads «РАЗЫГРАНО › PLAYER1 › АКТИВНЫЕ»
(e2e C: exactly one `.con-wshead` under `.con-played`). A bot seat prints its provenance line under the head (`__provenance`).

**The satellite lane.** The ДОП. РЕСУРСЫ satellite stands at z11470 at the player rail's seam and would cover the identity column's
caption (it did — «КОРПОРАЦИЯ» under «[mech] 2 · …»); every child of the panel but the head is pushed right by
`--con-played-satellite-w` (4.4rem; TV 4.8rem; handheld 3.5rem — `console.less` sets it on `.con-played` before the Info block),
applied as `margin-left` on `.con-played__panel > :not(.con-played__head)` when not embedded.

## 2 · The planner — shelves at the album's density, the corporation the hero (`consolePlayedModel.ts`)

`planPlayedTable({availW, availH, counts, corporations, spec, uiScale})` is PURE and solves the whole screen from the measured body
box (`__body`, a `ResizeObserver` on `offsetWidth / offsetHeight`) and the profile's ALBUM SPEC — never from the card count:

- **The identity column** (`identityW = max(TABLE_IDENTITY_MIN × s, availW × TABLE_IDENTITY_SHARE)` — 240 px floor, so the Deck's
  hero still outweighs its shelf face; 20 %): the corporation HERO (`hero.zoom` = the shelf zoom × `TABLE_HERO_GAIN` 1.35, capped by
  the column's width and by the height the events stack leaves; two corporations (Merger) share the room), a bot's corporation face at
  the hero zoom (`__botcorp`), a PREPARED place before the corporation is chosen (`__seat-place`), and the EVENTS stack
  (`ConsolePlayedEventsPile`, `events.zoom` = shelf × `TABLE_EVENTS_GAIN` 0.8) whose box is RESERVED always — the first event's
  landing never re-lays the hero out.
- **The shelf album** right of it: `tableAlbumSpec(spec)` composes `cols − 1` of the profile page (`albumSpecFor` — 5×2 TV / FHD →
  4×2; 4×1 handheld → 3×2 — the table's page is never one row, `TABLE_MIN_ROWS`), the same constants the hand album solves with (`ALBUM_GAP_X`, `ALBUM_MIN_ZOOM`, `ALBUM_MAX_ZOOM`,
  `PAGE_STRIDE_EXTRA` — shared, never `planHandAlbum` itself). The STANDARD face = `min(widthZoom(cols), heightZoom(rowsPerPage))`
  clamped to the album's zoom bounds — a box fact: one card and fifty are the same face, a growing table only adds pages.
  **The rows are the PROFILE's, never the box's** (PL-622, the owner's decision 2026-10-17 on the measured numbers): 4×2 on TV / FHD,
  TWO rows of three on the handheld (`TABLE_MIN_ROWS` = 2 — the hand album keeps its one-row density, the table does not: ≈ 191 px
  faces, 20 cards in 4 pages, the body filled to its foot; one row read 208 px, 7 pages, the lower half empty). A first cut let the box ADD a row whenever it cost under a tenth of the
  face (`TABLE_ROW_ADD_TOLERANCE`, deleted): on the Deck that sat on a knife's edge — the body measures 1000–1045 px wide, so the same
  twenty cards laid out two rows of 191 px on one seat and one row of 208–223 px on another (a bot's provenance line is enough), and
  LB / RB re-laid every face. Measured on the real Deck body: one row = 208 px / 7 pages, two rows = 191 px / 4 pages (the batch
  question had quoted 248 vs 195 off a synthetic box — corrected in the ledger, PL-622). Two rows are height-bound on every
  profile, so a bot's provenance line shortens that seat's face a little (the same composition, never a different row count).
  **The showcase**: a table that is ONE short row (`rows.length === 1 && count < cols`) grows into its room, bounded by the width its
  few slots get, the one-row height and `TABLE_SHOWCASE_GAIN` 1.5 (a face past it stops reading as a table).
- **Shelves are zone RUNS packed on rows** (`packShelves(counts, cols)`, `PLAYED_SHELF_ORDER` = prelude · ceo · active ·
  automated): a zone starts a new row unless the WHOLE zone fits in the row's free slots; a long zone splits across rows; append-only
  (a card landing never re-packs what stands before it). `pageShelves(rows, rowsPerPage)` cuts strict pages; `pageOfShelfCard`,
  `zonePages`, `zonesOnPage` are the lookups the navigation and the flights use.
- **Captions**: a run's caption reads the zone's label + its count, or the RANGE of its cards on this page when the zone is split
  («6–10»), and «Открыть» beside the focused zone; `data-played-cat` stands on a zone's FIRST run of a page only (one target per
  zone per page), `data-played-run` on every run.
- `unionNavRects(rects)` — one rect per key, the UNION of a zone's runs on the page: a zone split over two rows is ONE spatial
  target. Nothing in the planner reads the DOM.

Every px knob multiplies by `conUiScale()` in lockstep (the unit spec's TV row).

## 3 · Pages — strict, transform-positioned, derived from the focus

The album is a `__pagestrip` of `__page[data-played-page-index]` → `__row` → `__run.con-played__family` → caption +
`ConsolePlayedShelf` (a row of full-face slots `[data-played-key][data-zoom-slot]`, art tier by `artTierForWidth(slotW)`; the hero
column passes the LIVE `CardModel` (`live`), the shelves `publicFaceModel`). The strip moves by ONE retargetable transform (the
hand album's law: `--live` after mount settles, 180 ms; never while the hero scene stands — `--live:not(--hero)`), every page
positioned by transform, the active page DERIVED from the focused zone (`ensurePageForZone`) and from the landing card
(`ensurePageOfCard`) — no second page state. The root publishes `data-played-page` / `data-played-pages` and mirrors
`consolePlayedUi.page / pageCount` for the bar («LT / RT Листать» only while `pageCount > 1`).

Navigation: spatial over the union rects of the active page (identity blocks + the page's runs); ▶ off the page's right edge /
◀ off its left TURN the page; LT / RT (`prevTab` / `nextTab` → `turnPage`), the right-stick flick and the wheel do the same
unadvertised. Pages that are not mounted still have cards: `offPageRect(name)` answers a PACKET rect beyond the album's edge
(left for earlier pages, right for later), which the category view's lift / return and the landing use as the card's home
(`offPageRect` prop → `tableauRect` fallback) — a card on another page LEAVES toward its packet and comes back from it, never from
nowhere.

## 4 · The physics — unchanged, re-anchored

- **A category LIFTS off the shelf and returns** (`ConsolePlayedCategoryView`, `playedCategoryState`; the director reads
  `.con-played [data-played-key] .con-played__face :is(.pcard)` and the events' `.con-played__family--event .con-played__backstack`):
  the slots of the lifted zone keep their geometry and wear `--held-out` (ONE instance — the grid draws the copies, the shelf holds the
  places), X in the grid opens the viewer out of the grid's real slot (`slotZoomOrigin`), B flies every card home and releases every
  hold. **The view stands over the table's BODY** (PL-626): the overlay hands it the body's insets inside the root (`catInset`,
  measured on the opening edge and on every body resize; `boxInset` on the view's root), so the crumb above it stays LIT and reads
  the open zone («РАЗЫГРАНО › PLAYER1 › АКТИВНЫЕ») and the ДОП. РЕСУРСЫ lane stays clear — at `inset: 0` over the whole root the
  view's 0.97-alpha panel covered the head (the crumb ghosted through at ≈ 3 %) and its grid reached under the satellite; the panel
  is OPAQUE now (PL-137's law). **A lift never shrinks a face — unless that is what keeps the zone on ONE screen** (PL-619):
  the grid's floor is the shelf's own face (`faceFloorZoom` = `plan.album.zoom`), and the generous AIR of a small set yields
  first (`planCategoryView` tries the count's air, then the tight one, at the floor); a zone that cannot stand on one screen at
  the shelf's face shrinks just enough to (the project's first goal — single screen, no scroll); only a zone too big even for
  that (one screen would push the face under the grid's readable floor) scrolls — and then AT the shelf's face, never a smaller
  face and a scroll both (the Deck's fourteen active cards: one screen needs ≈ 132 px, they scroll at the 191 px shelf face; the
  engine's own pick had read 182 px) (the owner's choice 2026-10-17: one screen with smaller faces over the shelf's face with a scroll). Measured: on
  the Deck four cards fell to 186 px under a 208 px one-row shelf because of the air alone — now one row at the shelf's face; at 4K fourteen active cards still read 414 px under a 528 px shelf, all fourteen on one screen (a floor that held
  the shelf's face there scrolled the zone, and on the Deck it scrolled even four cards — refused).
- **A played card LANDS on its shelf** (`providePlayedHeroTarget`, `measureHeroTarget` / `peekHeroTarget`, `heroHiddenKey` → the
  slot's `--incoming` pose): the hero scene's proxy aims at the exact slot the planner gave the card (the page of that card is ensured
  first); an EVENT lands on the events stack (its count ticks after the reveal — TR65's e2e E). The chassis changed, the
  landing's anchors are the same three functions. **The table renders its content ONCE, against the measured body** (the tails pass): the
  body is a flex box whose size never depends on what it holds, so the first render lays the chassis out, `mounted()` measures it (a
  forced layout, no paint yet) and the faces render a single time with the real plan; the landing card's page is re-derived on that
  first measure, and the hero scene mounts the landing card's page ALONE (the neighbours exist for the slide, which a landing never
  plays). A fallback plan rendered first re-laid every face and re-picked every art tier on the landing's first frames.
- **The X viewer** rises out of the slot under the cursor and the table stays painted under it (`visibility: visible` — e2e C).

## 5 · Seats — the rival, the bot, the empty table, the embedded table

- **LB / RB walk the seats on ONE chassis** (`consolePlayedUi` mirrors the viewed seat; the subject segment of the crumb crossfades,
  the body re-plans — never an empty frame, never a `v-if` of the whole table).
- **A rival** reads the same shelves of their PUBLIC faces (`publicFaceModel`) — the corporation hero included; their events stack
  face-down with its count.
- **MarsBot**: its corporation face at the hero zoom + its flipped pile; the provenance line under the head.
- **An early table** (corporation alone, no cards): the identity column with the hero, an honest `__none` shelf line in the album
  (no fake slots), the events box reserved; **no corporation yet**: the prepared place (`__seat-place`). **No cards at all** → `__void`.
- **A prepared place is an OUTLINE, never a plate** (PL-620): `__seat-place` is a dashed border with no fill (a filled card-sized
  box read as a blank card standing on the rival's table), and the events' place names what is missing in one quiet line at the
  floor — «Событий пока нет» (`__seat-note`). The box keeps its exact size: the first event lands there.
- **Embedded in «Информация»** (the `embedded` prop — host-agnostic by the six-rule contract): the same component, no `con-ws`
  marker, no motion id, no backdrop, no satellite lane, the head's stage handed up to the host; the planner runs against the HOST's zone
  (the old `fitEmbeddedRoom` / `roomGain` fit is DELETED — the shelf planner fills the room by construction). The Information
  workspace's stage phrase appends the open category's label (`ConsoleInfoMode.stagePhrase`).

## 6 · Perf budget

The planner is O(cards) and allocates nothing per frame; the strip moves by one transform; a page turn mounts nothing (the active
page and its neighbours are in the DOM; the HERO scene mounts the landing card's page alone). The content renders ONCE, against the
measured body (§ 4). Measured with `console-played-perf-probe` on the GPU (`TM_E2E_GPU=1`, LocalFilesystem seeds 20 / 50 / 100 /
200 cards, three builds back to back, 2026-10-17):

| самая длинная задача главного потока, мс (20 · 50 · 100 · 200 карт) | до TR65 (ящик) | TR65 | TR65 + хвосты |
| --- | --- | --- | --- |
| 4K · открытие стола | 83 · 141 · 171 · 131 | 168 · 206 · 249 · 284 | 115 · 144 · 144 · 146 |
| 4K · открытие категории | 113 · 156 · 213 · 356 | 0 · 125 · 186 · 284 | 0 · 102 · 152 · 204 |
| Deck ×4 CPU · открытие стола | 377 · 465 · 522 · 577 | 508 · 528 · 452 · 474 | 190 · 202 · 219 · 451 |
| Deck ×4 CPU · цикл открыть / закрыть, p50 | 398 · 654 · 1044 · 1277 | 435 · 418 · 550 · 510 | 300 · 327 · 272 · 254 |
| Deck · узлов стола | 614 · 1316 · 2437 · 4663 | 489 · 677 · 677 · 677 | 321 · 360 · 360 · 360 |

The Deck's category is not in the table: the one-row profile opens a different (smaller) zone first, so the row is not like for
like (every build stays under 0.18 s there; the drawer's 30–40-card zones took 0.25–0.78 s). ⚠ **The probe itself had rotted and
lied** (PL-627): its Information step pressed X (the dossier's ring opens a zone with A since TR60), its face census counted
every `.pcard` inside each mutation batch, and its frame pump took an 8 × 8 SCREENSHOT inside the measured windows — on the GPU a
synchronous capture that stalled the renderer 1–3 s at 4K («long tasks» of 1.6–3.5 s a Chromium trace of the same open never
shows). On the GPU the pump is the pause alone; the census runs on a 40 ms sampler; the category is chosen and clicked on the
VISIBLE page (a click into a neighbour page beyond the album's clip waited 22 s – 7 min). The cross-check is a Chromium trace of
the same open (`screenshots/tr65/perf.stand.spec.ts`, long tasks broken down by timeline event).

## 7 · Guards

Unit (`tests/client/components/console/`): `consolePlayedModel.spec` (zones · `packShelves` · `pageShelves` / the lookups ·
`planPlayedTable` — the identity column + the album, the box fact, the showcase, the hero / events gains, the TV scale, the rows
are the profile's (no knife edge between two seats), stability · `unionNavRects` · `pickSpatialTarget`), `consolePlayedCategoryModel.spec`
(the lift's face floor — the air yields first, a zone too big for one screen at the shelf's face shrinks to one screen, a small one still grows), `ConsolePlayedShelf.spec` (full faces in a
row, a dock's fleet on its face), `ConsolePlayedOverlay.spec` (category navigation, the shelf album's pages / focus-derived page /
LT-RT, hero mode — the landing page mounted alone, the content only against a measured body, the smart category open, honest
caption counts, the bot seat + embedded mode). e2e `console-played-table.spec.ts`: **A**
(fhd · tv4k · deck) the 20-card table is one screen in the opening — the box against the stage tokens, `con-root--rail-replaced`,
faces ≥ the profile's floor (250 / 520 / 150 px), the hero larger than a shelf face, the content reaches the right and the bottom
(> 85 %), no chrome text under the TV floor; **B** (fhd · tv4k) 50 cards — strict pages, LT / RT, the focus walk turns them,
neighbours stay mounted; **C** the category lift and return — slots held, one copy, the grid's face ≥ the shelf's or the whole
zone on one screen with no scroll, the view's box = the body's and the crumb not under it, X out of the real slot, the table painted under the viewer; **E** LB / RB on one chassis, the rival's empty events place (an outline + «Событий пока нет», no fill), the bot's pile; **F** the early table and the bot; **G** reduced motion. The landing on the
shelf keeps its own witnesses: `console-play-landing-geometry` (the proxy's geometry = the slot's), `console-play-landing-probe`,
`console-played-zoom-return`. Static: `e2eLiveness` (35 specs wait on `con-played` hooks — every one still rendered),
`consoleTvTypeFloor`, `glyphLiteralGuard`.

## 8 · What not to break

- The shelf face comes from the BOX and the profile spec — never from the card count (the one bounded exception is the showcase);
  the rows are the profile's — a box rule that adds a row is a knife's edge between two seats of one table.
- A lifted category never shows a face smaller than the shelf it came from unless the whole zone needs the room to stand on one
  screen; the view stands over the BODY, never over the crumb.
- The perf probe measures the product, not itself: no capture, no DOM census inside a measured window; a click only on what a
  player can see.
- One instance: the lift draws copies over HELD slots; the planner is append-only so a landing never moves a standing card.
- Pages are transforms; a scroll container inside the album is a bug (the hand album's law).
- The category view never draws a head; the embedded table never carries the marker / the motion id / a backdrop.
- A card on an unmounted page has a HOME (`offPageRect`) — a flight from or to «nowhere» is a dev warn, never a snap.
- The satellite lane is a margin on the panel's children, never a hidden satellite.
