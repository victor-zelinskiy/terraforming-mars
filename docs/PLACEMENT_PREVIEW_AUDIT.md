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

## E. Placements that pick a cell WITHOUT placing a tile

The board has three shapes of "choose a cell" prompt, and only one of them places a tile. The
prompt now declares which (`SelectSpace.placementEffect`, default `'tile'`), so the preview stops
inferring it:

| Shape | Cards | Cell bonus granted? | Tile placed? | `onTilePlaced` fan-out? |
| --- | --- | --- | --- | --- |
| `'tile'` | everything else | yes | yes | yes |
| `'bonus-only'` | **Mars Nomads** — the camp MOVES | yes | **no** | **yes** (with `space.tile === undefined`) |
| `'marker'` | **Land Claim**, **Arcadian Communities** marker, Mars Nomads' initial seating, **St. Joseph of Cupertino Mission**'s cathedral | **no** | no | **no** |

**The Mars Nomads case is a tabletop rule, not an implementation detail.** The card's own source
records the ruling (BGG 3154812): *"Mining Guild and Philares cannot take advantage of it"* and
*"adjacency bonuses are not placement bonuses"* — because moving the camp is not placing a tile.
The engine already enforced it (`Game.addTile` is never called; `grantPlacementBonuses` gates Ares
adjacency and the Arcadian M€ on `space.tile !== undefined`; Mining Guild guards on
`game.nomadSpace`), but the PREVIEW could not see it: at preview time `game.nomadSpace` still
points at the camp's *current* cell, so the guard did not fire and the panel promised a steel
production step the commit would suppress.

Fixing it by teaching the preview about Mars Nomads would have hard-coded one card into a
corporation. Instead Mining Guild now states the rule it actually has — *"each time you place a
TILE"* → `if (!ctx.placesTile) return []` — and the prompt says whether a tile lands. That closes
the same hole for everything downstream: a camp move now previews the destination's placement
bonus and nothing else (no Ares adjacency, no endgame VP, no milestone/award count, no tile
trigger), and Land Claim / an Arcadian marker preview nothing at all instead of offering the cell
bonus they never grant.

## E-bis. The COST side of the same declaration (2026-09-03 iteration)

The 2026-09-03 pass (opened by a screenshot: a Mars Nomads camp move focused next to an Ares
hazard, and the panel read «ЭФФЕКТ КЛЕТКИ · Снизить производство −1») audited every fact family in
`boardCellPreview` against what each commit path actually charges/grants. Root cause: section E
gated the GAIN families on `ctx.placesTile`/`ctx.grantsPlacementBonus`, but `placementCostFacts`
was still called unconditionally — and every cost it prices (hazard cleanup M€, the
hazard-adjacency production penalty, Nuclear-Zone-style adjacency surcharges, the affordability
deficit) is charged by `Game.addTile` and ONLY by it. Since the on-field relation highlight is
driven by the same facts' `spaces`, the panel's false «−1 production» also lit the hazard as a
triggering source.

What the declaration now decides, each mirrored from the real commit path:

| Fact family | `'tile'` | `'bonus-only'` | `'marker'` | Commit source of truth |
| --- | --- | --- | --- | --- |
| Ares placement costs (cleanup M€ / production penalty / adjacency M€ / deficit) | yes | **no** | no | `Game.addTile` → `AresHandler.payAdjacencyAndHazardCosts` |
| Map PAY-TO-USE bonus price (Hellas ocean 6 M€, Vastitas temperature…) | yes (in `spaceCosts`) | **yes** (`placementCostInfo({placesTile:false})` keeps it; affordability = `canAffordPlacementBonuses`) | no | `grantSpaceBonuses` defers the payment |
| Printed cell bonus on a HAZARD-covered cell | **no** (`bonusesCovered`) | **no** | no | `addTile`'s `coveringExistingTile = space.tile !== undefined`; Mars Nomads' own `hasHazardTile` branch |
| Hazard-cleanup TR | yes | **no** | no | `addTile` only |
| `onTilePlaced` trigger facts (`tilePlacedPreview`) | yes | yes (hooks self-gate on ctx) | **no** (`firesTileTriggers`) | Mars Nomads' action runs the fan-out; Land Claim/markers never do |
| Deflection-zone impact | yes | **no** | no | protection is a function of OWNED TILES |
| «Your tile will grant an adjacency bonus» (source card's own declaration) | yes | no | no | needs a tile to land |

`PlacementPreviewContext` grew two fields for this: **`bonusesCovered`** («the commit will skip the
printed bonuses» — any tile INCLUDING a hazard; distinct from `covering`, which mirrors the placed
tile's `covers` field, the thing the survey-family hooks test) and **`firesTileTriggers`**
(`placementEffect !== 'marker'`). Note the deliberate corner kept CONSISTENT with upstream: the
survey cards' `grantsBonusNow` reads `space.tile?.covers`, which a REMOVED hazard never sets, so
the commit pays the survey extra even on a hazard-covered cell where the placement bonus itself is
suppressed — the preview mirrors that commit (via `ctx.covering`, not `bonusesCovered`), so the two
cannot disagree even where the upstream rule is debatable.

Guard: `tests/boards/placementEffectConsistency.spec.ts` — drives PREVIEW and the REAL COMMIT over
the same board geometry for every row above (camp-next-to-hazard, tile-next-to-hazard, mixed
severities, Athena's waiver, hazard-covered destinations for both effects, survey triggers for
bonus-only vs marker, deflection, read-only purity).

### Entry-point matrix (every Mars-board «pick a space», audited 2026-09-03)

`createMarsSelectSpace` is the only path that can declare `placementEffect`; a bare
`new SelectSpace` cannot. In-scope prompts all declare correctly: the four `'marker'`/`'bonus-only'`
sites (Mars Nomads ×2, Land Claim, Arcadian Communities) plus St. Joseph's cathedral move (declared
`'marker'` this pass), and every real tile placement threads `tileType`/`sourceCard` per section A.
Prompts with NO `placementType` (Desperate Measures, Eris, `RemoveOceanTile`, the WGT
hazard-removal) never request a preview, so they promise nothing false — the panel shows neutral
cell info only.

## F. Frontier (known, not fixed)

1. **Multi-tile cards** (`ocean: {count: 2}` — Great Aquifer, Ice Asteroid, Lake Marineris, Giant
   Ice Asteroid) preview each placement independently; the panel does not say "this is the first of
   two". The prompt title already does.
2. **Desperate Measures** (and the other removal/selection prompts) open a `SelectSpace` with no
   `placementType`, so the client never requests a preview for them at all. St. Joseph's cathedral
   now declares `'marker'` (2026-09-03), which also stops the client arming a tile-flight hero for
   a marker move.
2-bis. **Pathfinders' Survey Mission and Gagarin Mobile Base** (out of premium scope) are
   bonus-collecting picks still declared/defaulted `'tile'` — Survey Mission passes
   `placementType: 'land'`, so with Pathfinders enabled its dossier promises Ares adjacency,
   milestone progress and endgame VP its commit (claim + `grantSpaceBonuses` + ONLY Mining Guild's
   trigger, no ocean-adjacency M€) never grants. They cannot simply declare `'bonus-only'`: the
   client routes that effect into the Mars-Nomads move choreography (`armNomadMove`), and their
   grant scope differs from the nomads' (`grantSpaceBonuses` — printed only — vs
   `grantPlacementBonuses` — printed + ocean M€), so adapting them is expansion-checklist work:
   client marker/landing support + either a finer effect vocabulary or per-card `placementPreview`
   hooks. The underworld identify/excavate/claim prompts are the same frontier class (no
   `placementType` today, so no active lie). See `docs/claude/expansion-adaptation-checklist.md`.
3. **Herbivores' VP.** Its `victoryPoints: {resourcesHere, per: 2}` means one animal is worth half a
   VP; stating a 0-or-1 delta would require re-implementing the `per: 2` rule locally, so the
   animal gain is previewed and the VP is not.
4. **Off-Mars fixed-space cities** (Ganymede Colony, Phobos Space Haven, Stanford Torus, Maxwell
   Base, Dawn City, Luna Metropolis, Stratopolis) never open a `SelectSpace` at all — `Executor`
   calls `addCity` directly — so there is no preview surface to improve. Their "no Mars placement
   bonus, no Tharsis production" consequence is only visible after the fact.

---

Implementation + invariants: `docs/claude/board-information.md` (iteration "the placement preview
learns WHAT THE CARD DOES") and `.claude/rules/board.md`.
Tests: `tests/boards/placementCardPreview.spec.ts`,
`tests/client/components/board/BoardPlacementPreviewContent.spec.ts`.
