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
  'city-tier';
