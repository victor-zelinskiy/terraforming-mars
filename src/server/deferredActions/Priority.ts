export enum Priority {
  /** Legacy value that should not be further used. */
  SUPERPOWER = -1,
  /** Used for Pathfinders. First thing a player must do before further effects. */
  DECLARE_CLONE_TAG,
  /** Cost of a blue card action, or paying Reds costs. Must happen before the effects. */
  COST,
  /** Special case effects that should occur before Pharmacy Union */
  BEFORE_PHARMACY_UNION,
  /** Pharmacy Union special case, players typically prefer to resolve this early. */
  PHARMACY_UNION,
  /** Any effect from one of your opponent's card that triggers during your turn. */
  OPPONENT_TRIGGER,
  /**
   * Resolve Hyperspace Drive Prototype before Olympus Conference
   *
   * https://docs.google.com/drawings/d/1VXfVmoJWU_QmMDwZ-liVh5ZvWVmmpl2kuo_3ANz4omY/edit?usp=sharing
   */
  HYPERSPACE_DRIVE_PROTOTYPE,
  /**
   * Resolve Olympus Conference before Sponsored Academies and Mars U.
   */
  OLYMPUS_CONFERENCE,
  /** When you must discard before you can draw. Making a determination that Sponsored Academies should come before Mars U. */
  SPONSORED_ACADEMIES,
  DRAW_CARDS,
  BUILD_COLONY,
  INCREASE_COLONY_TRACK,
  /**
   * An on-play resource CHOICE (and the card-target pick it leads to) that must
   * resolve BEFORE any tile placement the same card queues. Cards like Imported
   * Hydrogen / Large Convoy place an ocean (`behavior.ocean`, deferred at
   * PLACE_OCEAN_TILE) AND offer a "gain plants / add microbes / add animals"
   * choice; upstream returns that choice at DEFAULT priority, so the ocean
   * (PLACE_OCEAN_TILE) lands FIRST and the premium play modal can't pre-collect
   * the choice (the batch hits the SelectSpace before the OrOptions). Deferring
   * the choice + its `AddResourcesToCard` target pick here puts them ahead of the
   * ocean so the modal collects them up front and the ocean rides PlacementBanner.
   * The two are independent, so the outcome is identical — only the prompt order
   * (choice → tile, instead of tile → choice) changes. See `gainOrAddResource.ts`.
   */
  PLAY_CARD_RESOURCE_CHOICE,
  PLACE_OCEAN_TILE,
  IDENTIFY_UNDERGROUND_RESOURCE,
  EXCAVATE_UNDERGROUND_RESOURCE,

  /** Anything that doesn't fit into another category. */
  DEFAULT,

  /**
   * When you must discard before you can draw. Mars U, Ender (CEO).
   *
   * Note: This used to be before DRAW_CARDS, and I don't know why it would be.
   * Moving this just after DEFAULT. See #5488
   */
  DISCARD_AND_DRAW,
  /** Effects that make your opponents lose resources or production. */
  ATTACK_OPPONENT,
  /** Effects that make you lose resource or production "as much as possible". Pharmacy Union, Mons. */
  LOSE_AS_MUCH_AS_POSSIBLE,
  GAIN_RESOURCE_OR_PRODUCTION,
  LOSE_RESOURCE_OR_PRODUCTION,
  DECREASE_COLONY_TRACK_AFTER_TRADE,
  DISCARD_CARDS,
  ROBOTIC_WORKFORCE,
  BACK_OF_THE_LINE,
}
