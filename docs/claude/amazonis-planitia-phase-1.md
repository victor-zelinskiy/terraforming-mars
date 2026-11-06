# Amazonis Planitia — phase 1 (premium adaptation, no MarsBot) · record

Prompt: `docs/claude/prompts/amazonis-planitia-full-adaptation.md`. Done 2026-11-06. The board left
`BOARDS_PENDING_PREMIUM_ADAPTATION` (the list is empty): the creator offers it, «Случайная» deals it, every premium
guard walks it. MarsBot stays phase 2 — the board is not in `AUTOMA_SUPPORTED_BOARDS`; the creator's `board` rule names
it in words with the bot seated («MarsBot does not cover …»), the bot-seated map deck marks the tile `no`.

## Owner's decisions taken during the work (2026-11-06)

1. **Alt Venus on the 33 % track — «a step = a resource, the wild on 33»** (upstream's own arithmetic for the pair):
   one standard resource per STEP made at or above 16 % (18 … 30 in 2 % steps, then 31 · 32 · 33 in 1 % steps — 10
   resource cells), the wild resource on the map's MAXIMUM (33 %). One function: `common/venus/altVenusBonus.ts`
   (`altVenusBonusFor(level, steps, maxVenus)`, `altVenusResourceCells(maxVenus)`); the engine, the previews, the colony
   trade preview, the composer's pre-select, the scale's claims and the client's bonus-cell beat read it with
   `game.max.venus`. Alt Venus + Amazonis Planitia is allowed with no warning (upstream's `altVenusBoardOnAmazonis` was
   never ported). The scale draws the ten cells and the finish's gold cube on 33 (`scaleBonusZones.anchorDefsFor`).
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
- **Measured on the TV profile (4K, the box, e2e `console-amazonis-planitia` § the field)**: Tharsis hex 151.7 px,
  Amazonis Planitia hex 138.8 px — **91.5 %** of the Tharsis size, nothing of the scales or the flank on a hex, no scroll.
  The spec asserts ≥ 90 %; the layout spec asserts the dials' height ≤ 600 board px (Tharsis 554).
- **The dials** (`arcScaleConfigs.LARGE_ARCS`) are four circles of their own, solved against the grid by script: Venus a
  flat arc over the grid's flat top (19 values, ≈ 24 px a step), oceans the same under its flat bottom (11 values,
  ≈ 26 px), oxygen / temperature one circle each wrapping the side vertices (19 / 23 values). Guard
  `tests/console/largeBoardLayout.spec.ts`: band edges ≥ 12 px off every hex, the Venus row's 13 chips ≥ 6 px off it and
  inside the track, the dials ≥ 16 px apart, ≥ 22 px a step. The Venus chips are 15 px on this board and spread
  cluster-wise (`spreadClusters`); the ocean's identity badge and event chips stand OUTSIDE its band.
- **The off-Mars flank**: a honeycomb in the board's top corners (`src/styles/console_board_large.less`), the right
  cluster Luna · Dawn / Maxwell · Aurora / Stratopolis, the left its mirror — guarded by `offMarsCellPlacement.spec.ts`.
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
