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

  // Turmoil Redux (EVA Mechs, TR09): a full card resource — any card may store
  // or add mechs; the ones ON EVA Mechs are also the `mechs` payment unit
  // (`Spendable.ts`), worth a flat 5 M€ each on a Space-tag card play.
  // The literal is LOAD-BEARING: the sprite (`assets/resources/mech.png`),
  // the graphic id (`res-mech`) and the CSS class (`.card-resource-mech`) are
  // all derived from it.
  MECH = 'Mech',

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
