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
  'ocean-removal';
