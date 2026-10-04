/** Tags that belong in `CardRenderItem.secondaryTag` that aren't part of `Tags`. */
export enum AltSecondaryTag {
  // 'req' => used for Cutting Edge Technology's discount on cards with requirements
  REQ = 'req',
  // 'oxygen' => used for Greenery tile that increases oxygen on placement
  OXYGEN = 'oxygen',
  // 'turmoil' => used in Political Uprising community prelude
  TURMOIL = 'turmoil',
  FLOATER = 'floater',
  BLUE = 'blue',
  // Fork: «a green (automated) card» — the chairman quests of the Mars
  // Parliament count card TYPES; the premium face draws the type as the
  // card cover with the type's header band (see premiumCardIcons).
  GREEN = 'green',
  NO_TAGS = 'no_tags',

  MOON_MINING_RATE = 'moon-mine',
  MOON_HABITAT_RATE = 'moon-colony',
  MOON_LOGISTIC_RATE = 'moon-road',

  NO_PLANETARY_TAG = 'no_planetary_tag',
  WILD_RESOURCE = 'wild-resource',
  // Fork: «payable with TITANIUM» — the M€ price of a Parliament bill
  // wears the titanium corner (Trade Industries: pay 12 M€, titanium
  // accepted). Both renderers draw it as the corner bubble on the M€ square.
  TITANIUM = 'titanium',

  // Fork: «a tile ON MARS» — the pink hex the Turmoil Redux set prints in the
  // corner of a tile glyph (TR14 Re-settlement: «remove a city tile you own on
  // Mars»). The premium face seats the owner's own hex asset as the corner,
  // unmasked (`secondaryBubbleOf` → `shape: 'tile'`). It has NO «in space»
  // twin: TR22 Nova City's scan prints the «space city» corner as the round
  // SPACE-TAG bubble — the existing `secondaryTag: Tag.SPACE` (Venera Base's
  // city), not a new entry here.
  MARS_TILE = 'mars-tile',

  // used in Faraday CEO
  DIVERSE = 'diverse',

  // Used in Ares community corp
  ARES = 'ares',
}
