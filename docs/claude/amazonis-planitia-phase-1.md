# Amazonis Planitia — phase 1 (premium adaptation, no MarsBot) · record

Prompt: `docs/claude/prompts/amazonis-planitia-full-adaptation.md`. Done 2026-11-06. The board left
`BOARDS_PENDING_PREMIUM_ADAPTATION` (the list is empty): the creator offers it, «Случайная» deals it, every premium
guard walks it. MarsBot stays phase 2 — the board is not in `AUTOMA_SUPPORTED_BOARDS`; the creator's `board` rule names
it in words with the bot seated («MarsBot does not cover …»), the bot-seated map deck marks the tile `no`.

## Owner's decisions taken during the work (2026-11-06)

1. **Alt Venus on the 33 % track — the classic board's SEVEN cells, starting later** (revised by the owner 2026-11-07:
   «the NUMBER of bonuses identical to the ordinary alternative board, starting correspondingly later, the last double
   bonus at the very end»; the first take, 2026-11-06, paid a resource for every step from 16 % — ten cells, «too
   many»). One standard resource per STEP made into one of the cells 24 · 26 · 28 · 30 · 31 · 32 · 33 (from 22 % — the
   map's TR step, which pays no alternative bonus), the wild resource on the map's MAXIMUM (33 %). One function:
   `common/venus/altVenusBonus.ts` (`ALT_VENUS_CELL_COUNT` = the classic 16 → 30 run; `altVenusMinimumFor(maxVenus)`;
   `altVenusBonusFor(level, steps, maxVenus)`; `altVenusResourceCells(maxVenus)`); the engine, the previews, the colony
   trade preview, the composer's pre-select, the scale's claims, the forecast («… past 22 %») and the client's
   bonus-cell beat (`venusBonusCells(step, maxVenus)` — the board's own maximum off the view) read it with
   `game.max.venus`. Alt Venus + Amazonis Planitia is allowed with no warning (upstream's `altVenusBoardOnAmazonis` was
   never ported). The scale draws the seven cells, the finish's gold cube on 33 (`scaleBonusZones.anchorDefsFor`).
2. **Activist without the Redux Parliament — a FIXED substitute**: Terraformer29
   (`AMAZONIS_PLANITIA_NO_PARLIAMENT_MILESTONE`, `amazonisPlanitiaMilestones(gameOptions)` in `MilestoneAwardSelector.ts`).
   The printed row reads `… 'Sponsor', 'Activist'`; the fork's substitute slot is not a «printed on this board»
   appearance for the random pools (`FORK_SUBSTITUTE_SLOTS`) — Activist keeps its own random standing.

## Decisions I took (reversible — named in the report)

- Innovator / Physicist / Merchant3 stay out of every RANDOM pool in phase 1: a random set reaches MarsBot's games and
  the bot has no row for them (phase 2). Merchant3 never joins (a clone of Merchant).
- The creator labels the official board «Amazonis Planitia · large map» (RU «Большая Амазония») — the fan
  `BoardName.AMAZONIS` keeps «Равнина Амазония». The catalog is thirteen maps: the TV page holds 4 × 3 at the tile's
  minimum width, so the map deck opens a SECOND page (the spine «1 / 2»; e2e `console-create-map-grid` updated).
- The forecast / board-chain reasons name the MAP's threshold through one table (`trackBonusReason`, literal keys).

## The field (worklist 1–2)

- **Hexes keep the Tharsis size** (46 × 51, pitch 49 × 41): `largeBoardLayout.largeBoardHexMargins()` constructs the 91
  margins, `src/styles/board_large_positions.less` carries them under `.board-cont--large`; the planet grows ×1.147
  behind the grid (the disc r 225 → 258) and the corner hexes overhang its rim by ≈ 10–14 px, as the owner allowed.
- **The dials are ONE RING** (the owner, 2026-11-07, over the first take's 4K frame: «the planet is not centred — Venus
  runs off the screen while space is left under the bottom scale; the scales are DISHARMONIOUS — on the classic board
  every scale looks at the next by its EDGES; the heat and oxygen scales are cut left and right»). The first take had
  four circles of their own (Venus / the oceans flat arcs over the grid's flat top / bottom, the side dials one circle
  each); the content measured past the fit's 620 px clamp, so the fit framed less than was there and Venus slid under
  the status strip, and the side circles crossed the arc canvas's 600 × 600 box — an `<svg>` clips at its box, the
  bands were sliced on a straight line. Now (`arcScaleConfigs.LARGE_ARCS`): one circle round the grid's centre,
  `LARGE_RING_RADIUS` 286 (the band's inner edge ≥ 6 px off the middle row's end hexes — the grid's farthest points),
  Venus centred over 12 o'clock (4.95° = 25 px a step), the oceans under 6 o'clock (4.45° = 22 px), `LARGE_RING_GAP`
  8° between every two ends (18 px of open space), oxygen / temperature mirroring each other down the sides (97.2° —
  27 / 22 px a step). Content height = the ring: 594 board px (Tharsis 554) — nothing stands above or below it.
- **The Venus row steps around the corner hexes**: the top row's corner hexes reach into the ring's inner side, so the
  row's chips (15 px, a 5 px connector) keep out of the grid's own keep-out (`largeBoardLayout.largeChipKeepOut` —
  sampled from the construction, ≥ 4 px off every hex) and each free stretch is spread on its own
  (`arcScaleGeometry.spreadAroundKeepOut`); the connector re-aims at the true value as everywhere. The Venus badge stands
  outside the ring beside the flank; the oceans' badge INSIDE at 6 o'clock (`ArcScale.identityMiddle` — at the first
  value it sat on the corner hex inside, or hung 10 px under the ring outside and cost the planet that height).
- **The arc canvas** (`ArcScale.vue`) reaches 60 px past the dials' square on every side (`SVG_PAD`, the viewBox starts
  at −60): no ring can be sliced by its own canvas again.
- **The fit centres the RING across** (`ConsoleBoardSection.calibrate` — the four rails' union; the flank is not
  symmetric, Aurora closes the right honeycomb only); down the stage the content is the ring.
- **Measured on the TV profile (4K, the box, e2e `console-amazonis-planitia` § the field)**: first take — Tharsis hex
  151.7 px, Amazonis Planitia 138.8 px (91.5 %); THE RING — 141.3 px (**93.1 %**), the content 593 board px in a
  1826 px stage (the fit is honest — no clamp; a single ring cannot go tighter: below R 286 the Venus row no longer
  fits between the corner hexes). The spec asserts ≥ 92.5 %, the ring centred on the stage (± 2 board px), Venus clear of the status strip, the oceans above the dock's
  clearance and every rail inside its canvas. Guard `tests/console/largeBoardLayout.spec.ts`: one centre / radius /
  gap, band edges ≥ 6 px off every hex, the Venus row's 10 chips ≥ 4 px off it and inside the track, the dials ≥ 16 px
  apart, ≥ 22 px a step, the height = the ring.
- **The off-Mars flank**: a honeycomb in the board's top corners outside the ring (`src/styles/console_board_large.less`
  — its top row on the ring's own top, 15), the right cluster Luna · Dawn / Maxwell · Aurora / Stratopolis, the left its
  mirror — guarded by `offMarsCellPlacement.spec.ts`.
- **The camera**: the focus frame is the disc ∪ the grid (`ConsoleBoardSection.LARGE_PFOCUS_FRAME`); the cursor's
  first cell reads the eleven-row silhouette (`miniRowsOf`); d-pad travel is the generic geometric walk.
- **Names**: the five volcanoes are hover markers (`specialCellInfo` — E1 Hecates Tholus, H7 Olympus Mons, H9 Ascraeus
  Mons, J8 Pavonis Mons, K7 Arsia Mons; guard `tests/boards/amazonisPlanitiaCells.spec.ts`); coordinates read `space.a9`.

## The bonuses (worklist 3)

- Track bonuses from the map's table everywhere: the chips (`anchorDefsFor`), the claims, the forecast (7 % card, 11 %
  temperature, 16 % colony, 22 % TR, −12 °C plant production — `effectForecast.scaleBonusPass`), the board's chain notes
  (`BoardInformationEngine`), the scale-step beat (Venus in 1 % steps, the TR chip at the map's level, the −12 °C plant
  production token off its chip), the oxygen 7 % card's cover / source («Бонус шкалы кислорода»).
- **The standard-resource cell**: the CELL asks (`SelectResource` marked with the cell — the task host's source plate
  «КЛЕТКА ПОЛЯ · Бонус размещения [?]»), the answer is published (`GameModel.cellResourcePayouts`) and played by
  `console/cellResource/cellResourceBeat.ts` (the token leaves the cell for the rail row — another seat's for its
  plaque); a card's answer (Mining Guild, Solar Farm, the Surveys, Specialized Settlement) is a recorded reaction
  (`withEffect`); the dossier names the choice («Получите стандартный ресурс на выбор» with the «?» face); Solar Farm's
  preview names «if you choose plants». Guards `tests/boards/standardResourceCell.spec.ts`, `cellBonusFaceCoverage`.
- The client's maximum readers read the map: the strip («N/11», the dials' fill), the government support (Venus 1 %
  steps), the terraforming celebration, the Parliament's tables (`boardName`, `maxOceans`), the scale tooltip.

## Icons (worklist 5) — the audit list

| Glyph | Where | Was | Now / decision |
| --- | --- | --- | --- |
| Temperature (o-temp chip) | oxygen 11 % chip | `global-parameters/temperature.png` 163 × 547 | kept — a premium-family raster (glass thermometer), ≥ 3 × the chip's 4K size |
| TR | Venus 22 % chip | `resources/tr.png` 535 × 396 | kept — premium family (laurel plate) |
| Ocean | temperature 0 °C chip | `tiles/ocean.png` 836 × 966 | kept — the premium ocean tile |
| Card | oxygen 7 %, Venus 8 % chips, card cells | `resources/card.webp` 1336 × 1912 | kept — premium |
| **Colony** (new) | Venus 16 % chip | — | `tiles/colony.png` 746 × 648 — the premium colony tile the card faces print |
| **Plant production** (new) | temperature −12 °C chip | — | the production frame (the energy-production cove's) + premium `plant.png` — CSS |
| Standard resource | E3 · E9 · K3 cells, the dossier, the source plate | `resources/wild.png` 512² | kept — premium; added to the portrait / plate table (`BONUS_ICON`) |
| Standard resource (miniature) | the creator's board miniature | a bare «?» stroke | an SVG plate + «?» (the board's own face in line), a signature glyph |
| Steel · titanium · plant · energy | cells | premium 512² rasters | kept |
| Delegate | B2, H7 ×2, H9 | `misc/delegate.svg` | kept — SVG |
| Merchant3 · Innovator · Physicist · Constructor | the MA rail / workspaces | none / legacy 140 × 83 | composites of their premium families (see `ma-premium-icons-worklist.md`) |

No legacy Pathfinders / PNG contour reaches this board (volcanoes are markers, not sprites; guard `cellBonusFaceCoverage`).

## Evidence

e2e `console-amazonis-planitia` (the box, tv4k): the field; the bonuses (a greenery on the standard-resource cell —
the 7 % card, the cell's question with its plate, steel → Mining Guild's steel production; −12 °C; 16 % Venus → a colony
to build); the finish (Venus 30 → 31 → 32 → 33 hosted in the standard projects, the wild's OR on 33, the 11th ocean,
+14 °C, 18 %). Frames: `screenshots/amazonis-planitia/`.

## Left open (named)

- The live resource palette clips a three-digit «277 → 278» reading in its narrow tile (a shared TR54 palette issue,
  visible here with test-mode money) — not specific to this board.
- H7's two delegates are pinned by the board spec (`AmazonisPlanitiaBoard.spec` § double delegate) — the Parliament's
  grant step is the shared one (Vastitas Borealis Nova's Viking e2e plays it); no Amazonis-specific e2e.
- MarsBot on the board — phase 2.
