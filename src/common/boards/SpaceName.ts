export const SpaceName = {
  GANYMEDE_COLONY: '01',
  NOCTIS_CITY: '31',
  PHOBOS_SPACE_HAVEN: '02',
  LUNA_METROPOLIS: '70',
  DAWN_CITY: '71',
  STRATOPOLIS: '72',
  MAXWELL_BASE: '73',
  HELLAS_OCEAN_TILE: '61',

  STANFORD_TORUS: '69',

  // Vastitas Borealis
  VASTITAS_BOREALIS_NORTH_POLE: '33',

  // Pathfinders
  CERES_SPACEPORT: '75',
  DYSON_SCREENS: '76',
  LUNAR_EMBASSY: '77',
  VENERA_BASE: '78',

  // Turmoil Redux — a HOSTED cell: its place is a colony tile, never the board (`hostedSpaces.ts`).
  NOVA_CITY: '79',
  // Turmoil Redux — «next to the Venus track»: the fifth cell of the board's Venus flank, drawn by the board
  // beside the four Venus Next cities (TR27 Aurora Station). An ordinary off-Mars cell, never a hosted one.
  AURORA_STATION: '80',
} as const;
