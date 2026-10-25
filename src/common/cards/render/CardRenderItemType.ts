export enum CardRenderItemType {
  TEMPERATURE = 'temperature',
  OXYGEN = 'oxygen',
  OCEANS = 'oceans',
  VENUS = 'venus',
  PLANTS = 'plants',
  TR = 'tr',
  HEAT = 'heat',
  ENERGY = 'energy',
  TITANIUM = 'titanium',
  STEEL = 'steel',
  MEGACREDITS = 'megacredits',
  CARDS = 'cards',
  TAG = 'tag',
  RESOURCE = 'resource',

  COLONIES = 'colonies',
  TRADE = 'trade',
  TRADE_DISCOUNT = 'trade_discount',
  TRADE_FLEET = 'trade_fleet',
  COLONY_TILE = 'colony_tile',
  CHAIRMAN = 'chairman',
  PARTY_LEADERS = 'party_leaders',
  DELEGATES = 'delegates',
  INFLUENCE = 'influence',
  /** Turmoil Redux: the WINNER-ONLY part of a resolution's enactment (the star beside the effect). */
  VOTE_WINNER = 'vote-winner',
  /** Turmoil Redux: ONE STEP OF THE CAREER (AGENDA) TRACK — drawn as the career insignia (TR04 «advance 2 steps»). */
  AGENDA_STEP = 'agenda-step',
  /**
   * Turmoil Redux: «a card with a requirement of ANY party» — the orange
   * requirement plate with the purple «?» party pill inside (TR13 Political
   * Think Tank's check). Not a party (`PARTY_LEADERS` / a party plate), not a
   * tag: the object is the REQUIREMENT a card prints.
   */
  PARTY_REQUIREMENT = 'party-requirement',
  /**
   * Turmoil Redux: «a card WITH A REQUIREMENT» — the requirement plate alone,
   * the yellow MIN banner the printed footnote shows (RX36 Live Experiments'
   * quest: «2 [plate]»). The same drawing as `PARTY_REQUIREMENT` without the
   * party pill: the object is ANY printed requirement.
   */
  REQUIREMENT_PLATE = 'requirement-plate',
  /**
   * Turmoil Redux: ONE NAMED PARTY's seal (TR62 Tharsis Alliance prints «[Mars
   * First] = [Reds]» and «[Mars First][Reds] RULING : [card]»): the party's own
   * emblem plate, the party carried by `ICardRenderItem.party`. A `stacked`
   * seal overlaps the one before it (the scan's pair), its `innerText` the
   * caption printed under the pair («RULING»).
   */
  PARTY_SEAL = 'party-seal',
  /**
   * Turmoil Redux Septem Tribus:redux: «YOUR CUBE ON A PARTY'S BANNER» — the printed purple wild-party pill («?»:
   * any party) with the player's white cube seated in its lower-left corner. The object of the rule is the CUBE on
   * the banner (a grant of that party's effect), never a delegate and never a party requirement.
   */
  BANNER_CUBE = 'banner-cube',
  /**
   * A CARD THAT PRINTS A VP ICON (and, through `secondaryTag`, the tag it
   * prints): the card cover with the tag's bubble and the VP plate in its
   * corner — Turmoil Redux's «Building card with a VP icon» (Architecture
   * Award). Never a bare tag: a tag alone would read as «any tag you have».
   */
  VP_CARD = 'vp-card',
  /**
   * A CARD THAT HOLDS RESOURCES — the white card with three orange cubes
   * (Turmoil Redux TR53 Frontier Labs: «a card that ALREADY has a resource»).
   * The object of the rule is the HOLDER, never a cube (one unit) and never a
   * tag: the glyph is the card cover with the cubes on its face.
   */
  RESOURCE_CARD = 'resource-card',
  NO_TAGS = 'no_tags',
  EMPTY_TAG = 'empty_tag',
  WILD = 'wild',
  DIVERSE_TAG = 'diverse_tag',
  CITY = 'city',
  GREENERY = 'greenery',
  PLATE = 'plate',
  TEXT = 'text',
  NBSP = 'nbsp',
  EMPTY_TILE = 'empty_tile',
  EMPTY_TILE_GOLDEN = 'empty_tile_golden',
  EMPTY_TILE_SPECIAL = 'empty_tile_special',
  SELF_REPLICATING = 'self_replicating',
  MULTIPLIER_WHITE = 'multiplier_white',
  IGNORE_GLOBAL_REQUIREMENTS = 'ignore_global_requirements',
  PRELUDE = 'prelude',
  AWARD = 'award',
  MILESTONE = 'milestone',
  CORPORATION = 'corporation',
  VP = 'vp',
  COMMUNITY = 'community',
  RESOURCE_CUBE = 'resource_cube',
  MOON_HABITAT = 'moon-colony',
  MOON_HABITAT_RATE = 'moon-colony-rate',
  MOON_ROAD = 'moon-road',
  MOON_LOGISTIC_RATE = 'moon-logistic-rate',
  MOON_MINE = 'moon-mine',
  MOON_MINING_RATE = 'moon-mine-rate',
  PLANETARY_TRACK = 'plantary-track',
  GLOBAL_EVENT = 'global-event',
  FIRST_PLAYER = '1p',
  RULING_PARTY = 'ruling-party',
  POLICY = 'policy',
  CATHEDRAL = 'cathedral',
  NOMADS = 'nomads',
  CITY_OR_SPECIAL_TILE = 'city-or-special-tile',
  ONE = 'one',

  // CEO Extension:
  ARROW_OPG = 'arrow-opg',
  REDS = 'reds',
  REDS_DEACTIVATED = 'reds-deactivated',
  HAZARD_TILE = 'hazard-tile',
  ADJACENCY_BONUS = 'adjacency-bonus',

  // Fork premium primitives (icons-only face — replace bespoke prose blocks
  // with graphics; the full rule lives in the fullscreen info blocks).
  PROTECTION = 'protection',        // «protected from removal» shield
  DECK_LOOK = 'deck-look',          // look at / reveal cards
  DISCARD = 'discard',              // discard cards
  ACTION_REPLAY = 'action-replay',  // reuse a card action

  // Underworld
  IDENTIFY = 'identify',
  EXCAVATE = 'excavate',
  CORRUPTION = 'corruption',
  NEUTRAL_DELEGATE = 'neutral-delegate',
  UNDERGROUND_RESOURCES = 'underground-resources',
  CORRUPTION_SHIELD = 'corruptive-block',
  GEOSCAN_ICON = 'geoscan-icon',
  UNDERGROUND_SHELTERS = 'underground-shelters',
}
