export const SpaceName = {
  GANYMEDE_COLONY: 'c01',
  NOCTIS_CITY: '31',
  PHOBOS_SPACE_HAVEN: 'c02',
  LUNA_METROPOLIS: 'c70',
  DAWN_CITY: 'c71',
  STRATOPOLIS: 'c72',
  MAXWELL_BASE: 'c73',
  HELLAS_OCEAN_TILE: '61',

  STANFORD_TORUS: 'c69',

  // Vastitas Borealis
  VASTITAS_BOREALIS_NORTH_POLE: '33',

  // Pathfinders
  CERES_SPACEPORT: 'c75',
  DYSON_SCREENS: 'c76',
  LUNAR_EMBASSY: 'c77',
  VENERA_BASE: 'c78',

  // Turmoil Redux — a HOSTED cell: its place is a colony tile, never the board (`hostedSpaces.ts`).
  NOVA_CITY: 'c79',
  // Turmoil Redux — «next to the Venus track»: the fifth cell of the board's Venus flank, drawn by the board
  // beside the four Venus Next cities (TR27 Aurora Station). An ordinary off-Mars cell, never a hosted one.
  AURORA_STATION: 'c80',
} as const;
