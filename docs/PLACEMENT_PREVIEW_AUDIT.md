# Tile-placement preview audit

**Question:** when the player is standing on a cell with `SelectSpace` open, does the right-hand
panel tell them *everything* that confirming will do?

**Scope:** every card that places a tile in the premium-subsystem modules — `base`, `corporation`,
`promo`, `venusNext`, `colonies`, `prelude`, `ares` — plus the placement-bearing standard projects,
plus every card in those modules that REACTS to a placement (`onTilePlaced`).

Before this pass the panel could describe only the CELL (printed bonus, ocean-adjacency M€,
city/greenery endgame VP, Ares adjacency, hazard cost, placement cost). It knew nothing about the
CARD doing the placing, nothing about other players' triggers, and nothing about progress tracks.
The bug that opened the audit — Solar Farm, whose entire decision is *which* area, because its
energy production equals the plant bonuses printed there — showed "Cell bonus +2 plants" and
nothing else.

Classification: **A** = now previewed · **B** = previewed generically (no per-card work) ·
**C** = deliberately out of the cell preview (it belongs to the card-play modal, which already
shows it) · **D** = documented frontier.

---

## A. Space-dependent consequences of the PLACING card (`ICard.placementPreview`)

| Card / project | What was invisible | Class |
| --- | --- | --- |
| **Solar Farm** (ares) | +1 energy PRODUCTION per PLANT bonus on the chosen area (0/1/2) — the card's whole payload | **A** |
| **Mining Area / Mining Rights** (+ their Ares variants) | +1 permanent STEEL **or** TITANIUM production, decided by which bonus the area prints; on a dual-bonus area a follow-up asks which | **A** |
| **Flooding** (base) | *Who* can be hit for 4 M€ is decided by the ocean's neighbours; with several candidates a follow-up asks which | **A** |
| **Immigrant City** (base) | The `.andThen` −1 energy / −2 M€ production (not declarative, so no other surface showed it) | **A** |
| **Urbanized Area** (base) | The `.andThen` −1 energy production (only the +2 M€ is declarative) | **A** |
| **Noctis City** (base) | −1 energy production, applied bespoke on both paths | **A** |
| **City standard project** | +1 M€ production is granted inside `commit(space)` — i.e. only after a space is picked | **A** |
| **PolderTech Dutch** (promo) | Its second, chained greenery step never declared its `tileType`, so that prompt previewed neither oxygen/TR nor its own +1 plant | **A** (fixed by threading `tileType`) |

## B. Generic engine work — no per-card table

| Gap | Fix | Class |
| --- | --- | --- |
| **Capital / Commercial District** placement VP (+1 VP per adjacent ocean / city) was explained on HOVER of a placed tile but never while choosing where to put it | `specialTileAdjacencyVpFacts` is now shared by both surfaces | **B** |
| **The tile's own Ares adjacency contract** — what future neighbours gain, and Nuclear Zone's 2 M€ tax on every neighbour including your own | derived from `behavior.tile.adjacencyBonus ?? Card.adjacencyBonus` | **B** |
| **Global-parameter CHAIN** — a greenery crossing 8% O₂ silently raises the temperature, which can cross a heat-production step (−24/−20 °C) or the free-ocean step (0 °C) | previewed with `current → resulting` on each parameter | **B** |
| **TR promised during World Government** — the commit grants none (`phase !== SOLAR` gate) | TR facts suppressed in `Phase.SOLAR` | **B** |
| **Arcadian Communities** +3 M€ for building on an area you reserved | keyed on `space.player === player`, exactly as `Game.addTile` does | **B** |
| **Milestone / award progress**, including a placement that COMPLETES a milestone | new `progressFacts` group, scored through the real `getScore` via `withHypotheticalTile` | **B** |
| A PRODUCTION delta rendered as a one-off gain (also affected the printed `ENERGY_PRODUCTION` cell bonus) | `BoardFactRow` forwards `delta.production` as the chip's `production` note | **B** |

## C. Other players' triggers (`ICard.tilePlacedPreview`) — "no surprises" in the strict sense

Placing a tile can enrich an OPPONENT. None of it was visible before; all of it now lands in the
"Other players receive" block, attributed to the owning player.

| Card | Fires on | Class |
| --- | --- | --- |
| Arctic Algae (base) | any uncovered OCEAN, by anyone → 2 plants | **A** |
| Rover Construction (base) | any CITY, by anyone → 2 M€ | **A** |
| Immigrant City (base) | any CITY, by anyone → +1 M€ production | **A** |
| Pets (base) | any CITY, by anyone → 1 animal | **A** |
| Herbivores (base) | YOUR greenery → 1 animal | **A** |
| Tharsis Republic (corp) | any CITY → +1 M€ production (not on a `COLONY` slot); +3 M€ only when YOU place it | **A** |
| Mining Guild (corp) | your tile on a steel/titanium area, or next to an Ares steel/titanium source → +1 steel production. Names the *absence* too, since it is the corp's core placement incentive | **A** |
| Hospitals / Vermin (promo) | any CITY → 1 card resource | **A** |
| Neptunian Power Consultants (promo) | any uncovered OCEAN → an OPTIONAL 5 M€ purchase (previewed as an upcoming choice + what it buys) | **A** |
| Philares (promo) | every new adjacency between your tile and another player's → that many wild resources | **A** |
| PolderTech Dutch (promo) | YOUR ocean → 1 energy; YOUR greenery → 1 plant | **A** |
| Ecological / Geological Survey (ares) | +1 extra of each matching resource the placement grants, including via an adjacent Ares source, plus the Mars-First-policy and Arctic-Algae fallbacks | **A** |
| Marketing Experts (ares) | **no hook, on purpose** — its +1 M€ is not an `onTilePlaced`; it lives in `AresHandler.earnAdjacencyBonus`, which the engine ALREADY mirrors (`tile-owner-benefit`, amount 2). A card hook would double-count. | **B** |

## D. Deliberately NOT in the cell preview

These are identical on every cell, so they belong to the card-play modal (`cardPlayPreview`), which
already shows them; repeating them per-cell would be noise:
Lava Flows' +2 temperature, Nuclear Zone's +2 temperature / −2 VP, Mohole Area's +4 heat production,
Magnetic Field Generators' +3 TR, Metallic Asteroid's temperature + titanium, the various
`removeAnyPlants` attacks, Convoy/Large Convoy draws, Ice Moon Colony / Space Port colony builds.

Placement CONSTRAINTS (Ecological Zone "adjacent to a greenery", Industrial Center "adjacent to a
city", Great Dam "adjacent to an ocean", Urbanized Area "2+ adjacent cities", Mining Area "adjacent
to your tile", the `filterForEnergy` energy-coverage filter) are already surfaced by the per-cell
illegality reasons (`computeIllegalReasons` + `customReasoner`), not by the preview.

## E. Frontier (known, not fixed)

1. **Mars Nomads + Mining Guild.** Previewing a nomad MOVE onto a steel/titanium area promises
   Mining Guild's +1 steel production, which the commit suppresses: the live path sets
   `game.nomadSpace` to the destination *before* the trigger fan-out and the preview cannot know
   that. The nomad space is excluded from every legal placement, so this can only misfire on a
   hovered ILLEGAL cell.
2. **Multi-tile cards** (`ocean: {count: 2}` — Great Aquifer, Ice Asteroid, Lake Marineris, Giant
   Ice Asteroid) preview each placement independently; the panel does not say "this is the first of
   two". The prompt title already does.
3. **Placements that place no tile** — Land Claim, Arcadian Communities' marker, Mars Nomads,
   St. Joseph's cathedral, Desperate Measures — have no `tileType`, so the tile-driven facts
   (including milestone progress) are correctly silent, but nothing card-specific is shown for them
   either.
4. **Herbivores' VP.** Its `victoryPoints: {resourcesHere, per: 2}` means one animal is worth half a
   VP; stating a 0-or-1 delta would require re-implementing the `per: 2` rule locally, so the
   animal gain is previewed and the VP is not.
5. **Off-Mars fixed-space cities** (Ganymede Colony, Phobos Space Haven, Stanford Torus, Maxwell
   Base, Dawn City, Luna Metropolis, Stratopolis) never open a `SelectSpace` at all — `Executor`
   calls `addCity` directly — so there is no preview surface to improve. Their "no Mars placement
   bonus, no Tharsis production" consequence is only visible after the fact.

---

Implementation + invariants: `docs/claude/board-information.md` (iteration "the placement preview
learns WHAT THE CARD DOES") and `.claude/rules/board.md`.
Tests: `tests/boards/placementCardPreview.spec.ts`,
`tests/client/components/board/BoardPlacementPreviewContent.spec.ts`.
