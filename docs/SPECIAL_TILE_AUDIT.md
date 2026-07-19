# Special-tile identity audit (BoardInformation)

Scope = the fork's current modules: `base`, `corpera`, `promo`, `venus`, `colonies`, `prelude`.
A tile is "special" per `Board.isSpecialTile` (everything except ordinary
`GREENERY`/`OCEAN`/`CITY`, moon tiles, hazard tiles, and `REY_SKYWALKER`).

Identity is now derived in `BoardInformationEngine.baseCellStatus`:
- **name** = `tileTypeToString[tileType]` (covers EVERY `TileType` → a known special tile
  is never nameless) — falls back to `space.tile.card` if ever unmapped.
- **kind** = header `Special city` (composite that counts as a city) / `Special tile`
  (any other special), set by `headerFor`; an ordinary city/ocean/greenery is NOT touched.
- **countsAs** = `countsAsFor(tileType)` from `CITY_TILES`/`OCEAN_TILES`/`GREENERY_TILES`
  (a composite is several — e.g. New Holland = city + ocean).
- **owner** = `space.player`/`coOwner` (chip, unchanged).
- **own scoring** = `existingTileScoringFacts` (Capital ocean VP, Commercial District city VP,
  plus the standard city-greenery rule for any city-like tile).

Classification: **A** already good · **B** was missing name/source · **C** wrongly shown as
ordinary city · **D** missing special rule/scoring · **E** data not available (needs plumbing).

| Tile | Source card / module | Was | Now | Class |
| --- | --- | --- | --- | --- |
| `CITY` (ordinary) | City SP / cards | "ГОРОД" + city-greenery scoring | unchanged (good) | A |
| `OCEAN` / `GREENERY` (ordinary) | base | good | unchanged | A |
| **`CAPITAL`** | Capital · base | "ГОРОД" | **ОСОБЫЙ ГОРОД: Столица** + countsAs city + **+1 ПО / соседний океан** (separate) + city-greenery rule | **C+D** |
| **`NEW_HOLLAND`** | New Holland · promo | "ГОРОД" | **ОСОБЫЙ ГОРОД: New Holland** + countsAs **city+ocean** + city-greenery rule | **C** |
| **`OCEAN_CITY`** | Ocean City · venus | "ГОРОД" | **ОСОБЫЙ ГОРОД** + countsAs **city+ocean** | **C** |
| **`COMMERCIAL_DISTRICT`** | Commercial District · base | "ОСОБЫЙ ТАЙЛ" (no name, no scoring) | name + **+1 ПО / соседний город** | **B+D** |
| `LAVA_FLOWS` | Lava Flows · base | "ОСОБЫЙ ТАЙЛ" | name | B |
| `MINING_AREA` / `MINING_RIGHTS` | Mining Area / Rights · base | "ОСОБЫЙ ТАЙЛ" (pickaxes) | name (distinct per card) | B |
| `MOHOLE_AREA` | Mohole Area · base | "ОСОБЫЙ ТАЙЛ" | name | B |
| `NATURAL_PRESERVE` | Natural Preserve · base | "ОСОБЫЙ ТАЙЛ" | name | B |
| `NUCLEAR_ZONE` | Nuclear Zone · base | "ОСОБЫЙ ТАЙЛ" | name | B |
| `ECOLOGICAL_ZONE` | Ecological Zone · base | "ОСОБЫЙ ТАЙЛ" | name (VP is card-resource → shown in VP overlay, not a board fact) | B |
| `RESTRICTED_AREA` | Restricted Area · base | "ОСОБЫЙ ТАЙЛ" | name | B |
| `INDUSTRIAL_CENTER` | Industrial Center · corpera | "ОСОБЫЙ ТАЙЛ" | name | B |
| `DEIMOS_DOWN` | Deimos Down · promo | "ОСОБЫЙ ТАЙЛ" | name | B |
| `GREAT_DAM` | Great Dam · promo/venus | "ОСОБЫЙ ТАЙЛ" | name | B |
| `MAGNETIC_FIELD_GENERATORS` | Magnetic Field Generators · promo/venus | "ОСОБЫЙ ТАЙЛ" | name | B |
| `BIOFERTILIZER_FACILITY` | Biofertilizer Facility · promo | "ОСОБЫЙ ТАЙЛ" | name | B |
| `METALLIC_ASTEROID` | Metallic Asteroid · promo | "ОСОБЫЙ ТАЙЛ" | name | B |
| `SOLAR_FARM` | Solar Farm · promo | "ОСОБЫЙ ТАЙЛ" | name | B |
| `OCEAN_FARM` / `OCEAN_SANCTUARY` | venus/colonies | "ОСОБЫЙ ТАЙЛ" | name + countsAs **ocean** | B |

**Out of scope** (no change; covered by the same generic name layer when their module is added):
Pathfinders (`WETLANDS`/`RED_CITY`/`MARTIAN_NATURE_WONDERS`/`CRASHLANDING`), Moon
(`MOON_*`/`LUNA_*`), Underworld (`MAN_MADE_VOLCANO`/`MARS_NOMADS`), Star Wars
(`REY_SKYWALKER`), Ares bonus tiles (`MINING_STEEL_BONUS`/`MINING_TITANIUM_BONUS`),
Automa (`NEURAL_INSTANCE`). Hazard tiles render as `hazard`.

**Class E (none in scope).** `tileTypeToString` guarantees a name for every `TileType`, so no
in-scope special tile needs source plumbing. The *source card* (`space.tile.card`) equals the
eponymous card for every in-scope special tile, so the header name already conveys the source;
a dedicated "Источник: карта «…»" line is intentionally omitted as redundant (single-screen goal).
When Ares lands, a tile placed by a non-eponymous effect would be the first real Class-E case —
thread the placing source onto the tile then.

## Iteration 2 — off-Mars / external tiles (location ≠ countsAs)

Problem: `countsAs: city/ocean` was treated as "participates in Mars city-greenery / ocean
scoring". An off-Mars reserved city slot (Maxwell Base etc.) is an ordinary `CITY` tile placed
on a `COLONY` space — it `countsAs` a city but has NO Mars adjacency, so showing
"city scores for greeneries: 0" + a "city" tooltip was false/noise.

**Architectural fix (no per-tile hardcode):** the engine now derives a `BoardCellStatus.external`
flag from the REAL adjacency graph — `onMarsGrid(board, space) = getAdjacentSpaces(space).length > 0`
(mirrors `calculateVictoryPoints`, which scores cities via `getAdjacentSpaces`; a `COLONY` slot
returns `[]`). City-greenery scoring + ocean-adjacency facts are gated on `onMarsGrid`; an occupied
off-grid tile instead gets a neutral `external-area` fact ("Внешняя область — обычное соседство на
Марсе не применяется"). `countsAs` is still shown (separately) — it is NOT scoring.
An off-grid tile is also marked `special` even if its `TileType` is a plain `CITY` (so it reads as
a special city, not "ГОРОД"), and named from its source card (`space.tile.card`, set by `behavior.city`).
Reserved-cell checks (`COLONY`/`RESTRICTED`/Noctis) now fire only when EMPTY — an occupied reserved
slot flows to the tile branch (real identity), so the stale empty-cell lore no longer shows over a placed tile.

Classification this iteration: **A** normal Mars surface · **B** special Mars surface · **C** composite
Mars surface · **D** off-Mars special tile · **E** reserved external (empty) · **F** colony/Venus slot · **G** data ambiguous.

| Tile / slot | Source | Location | countsAs | Was | Now | Class |
| --- | --- | --- | --- | --- | --- | --- |
| **New Holland** | New Holland · promo | Mars surface (covers an ocean, on-grid) | city + ocean | city scoring + ocean adj (CORRECT) | unchanged + clean 2-row header | **C** (verified on-grid — NOT external) |
| Capital | Capital · base | Mars surface | city | special city + ocean VP | unchanged | C |
| Industrial Center / Mining Area (Горнопром. р-н) | base/corpera | Mars surface | — | "ОСОБЫЙ ТАЙЛ :" colon-wrap | clean 2-row header, name, owner | B (header fix) |
| **Maxwell Base** | Maxwell Base · venus | `COLONY` off-grid (reserved) | city | "ГОРОД" + false 0-VP city scoring + stale "reserved colony" lore | **ОСОБЫЙ ГОРОД / Maxwell Base** + owner + **external-area note**, NO false scoring | **D** (fixed) |
| Ganymede Colony / Phobos Space Haven | base | `COLONY` off-grid | city | same false scoring | external special city, no false scoring | **D** (fixed) |
| Stanford Torus / Luna Metropolis / Dawn City / Stratopolis | corpera/venus | `COLONY` off-grid | city | same | external special city, no false scoring | **D** (fixed) |
| Empty Maxwell/Ganymede/… reserved slot | — | `COLONY` off-grid, no tile | — | lore + "reserved colony" | unchanged (lore: "only X can be placed here" + reserved fact) | **E** |
| Colony tiles (Colonies expansion) | colonies | separate `ColonyTile` UI, NOT board spaces | — | n/a (not board hexes) | n/a — handled by the Colonies overlay, not BoardInformation | **F** (out of board-hex scope) |

**Class G (none in scope).** Every off-grid city records its source card via `behavior.city`
(`space.tile.card`), so the name is always available; `getAdjacentSpaces` is the unambiguous
location signal. When Ares adds tiles placed by non-eponymous effects, thread the placing source
onto the tile (the only future Class-G case).

**Ordinary Mars city is NOT regressed:** `special` is false for an on-grid plain `CITY`
(`isSpecialTile(CITY)` false + `external` false) → header "City", normal greenery scoring — exactly
as before (regression-guarded by the New Holland on-grid test + the existing city tests).

## Asteroid Deflection Zone (Hollandia) — fixed

The old tooltip ("при случайной карте эти клетки сохраняют фиксированное положение") was the
**wrong rule** and is removed (the dead i18n key was deleted too). The real rule, mirrored from
`Game.ts` (`player.withinDeflectionZone = inside.length > 0 && outside.length === 0`, consumed by
`Player.plantsAreProtected`): **a player is protected from plant destruction while ALL their tiles
are inside the zone.**

- Hover a deflection cell → the rule + a per-player **Защита растений** status list
  (`zoneProtection`, viewer first): `active` (Защищён) / `inactive-no-zone-tiles`
  (Нет тайлов в зоне) / `inactive-has-tiles-outside` (Тайлы вне зоны).
- Placement preview → a `deflection-impact` fact: in-zone → activates/keeps/won't-restore;
  off-zone while protected → **warning** "Отключает вашу защиту…".

Engine: `deflectionCounts`/`deflectionStatusOf`/`buildZoneProtection`/`deflectionPlacementFact`
(read-only, mirrors the real `Board.ownedBy` partition). Model: `ZoneProtection`/`ZonePlayerProtection`
+ `BoardCellInfo.zoneProtection`. Client: `BoardCellInfoPopover` (countsAs line + protection block).

**Plant-destruction target gating (TODO / out of this iteration):** the protection is already
enforced server-side in `Player.plantsAreProtected()` (used by `RemoveAnyPlants` etc.), so a
protected player is correctly skipped as a target. Surfacing *"Nastya защищена Зоной отклонения"*
in the attack-target picker is a separate enrichment — see the deferred-attack metadata frontier
in `CHOICE_CONTEXT_AUDIT.md`; the rule source is `Player.ts:plantsAreProtected`.
