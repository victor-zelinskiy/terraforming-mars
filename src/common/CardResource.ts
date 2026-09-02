export enum CardResource {
  // Base
  ANIMAL = 'Animal',
  MICROBE = 'Microbe',
  FIGHTER = 'Fighter',
  SCIENCE = 'Science',

  // Venus
  FLOATER = 'Floater',
  ASTEROID = 'Asteroid',

  // Colonines
  CAMP = 'Camp',

  // Turmoil
  PRESERVATION = 'Preservation',

  // Prelude 2
  DIRECTOR = 'Director',

  // Promo
  DISEASE = 'Disease',
  GRAPHENE = 'Graphene',
  HYDROELECTRIC_RESOURCE = 'Hydroelectric resource',

  // Fan cards
  RESOURCE_CUBE = 'Resource cube',
  DATA = 'Data',
  // Delta Project (Modular Floodgates, DP11): PHYSICAL steel cubes stored on
  // the card. «It can be used as a steel resource and counts as on your player
  // board» — the spendable half lives in the payment layer (`floodgateSteel`
  // in Spendable.ts), never as a silent merge into `player.steel`.
  STEEL = 'Steel',

  // Moon
  SYNDICATE_FLEET = 'Syndicate Fleet',

  // Pathfinders
  VENUSIAN_HABITAT = 'Venusian Habitat',
  SPECIALIZED_ROBOT = 'Specialized Robot',
  SEED = 'Seed',
  AGENDA = 'Agenda',
  ORBITAL = 'Orbital',

  // Star Wars
  CLONE_TROOPER = 'Clone Trooper',

  // Underworld
  TOOL = 'Tool',
  WARE = 'Ware',
  JOURNALISM = 'Journalism',
  ACTIVIST = 'Activist',
  SUPPLY_CHAIN = 'Supply Chain',
}
