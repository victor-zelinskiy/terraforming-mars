export type PlacementType =
  'land' |
  'ocean' |
  'greenery' |
  'city' |
  'away-from-cities' |
  'isolated' |
  'volcanic' |
  'upgradeable-ocean' |
  'upgradeable-ocean-new-holland' |
  /**
   * A CITY TIER (Turmoil Redux — Skyscrapers): the tile lands ON TOP of one
   * of the player's own cities on Mars and raises that cell's stack. The
   * legal cells are exactly those cities; nothing about the cell is paid
   * again (its printed bonus and its ocean adjacency were collected when the
   * first city landed) — `Game.addCityTier`.
   */
  'city-tier' |
  /**
   * AN OCEAN REMOVAL (Turmoil Redux — Water Export: «the First Player removes
   * 1 ocean tile from the board»): the pick names a PLAIN ocean tile that
   * leaves the board — the legal cells are exactly the plain oceans
   * (`getOceanSpaces({upgradedOceans: false})`, the filter `RemoveOceanTile`
   * reads). Nothing lands and nothing is granted; the prompt says so through
   * `placementEffect: 'remove'`.
   */
  'ocean-removal' |
  /**
   * A CITY MOVE (Turmoil Redux TR14 Re-settlement): a city of the player's own
   * on Mars travels to a cell adjacent to the one it stands on. The legal
   * cells are every destination SOME movable city has (`boards/cityMove.ts`);
   * which city reaches which cell is the prompt's `tileMove` marker, and the
   * prompt says what the pick does through `placementEffect: 'move'`.
   */
  'city-move' |
  /**
   * AN OCEAN MOVE (Turmoil Redux TR39 Canyon Carving): any plain ocean on the
   * board travels to a cell adjacent to the one it stands on — an empty ocean
   * reserve, or land «not reserved at all» (Artificial Lake's family). The
   * legal cells are every destination SOME ocean has (`boards/oceanMove.ts`);
   * which ocean reaches which cell is the prompt's `tileMove` marker, and the
   * prompt says what the pick does through `placementEffect: 'move'`. The
   * ocean parameter never moves — the move pays its own TR (`Game.moveOceanTile`).
   */
  'ocean-move';
