export enum ColonyBenefit {
    ADD_RESOURCES_TO_CARD,
    ADD_RESOURCES_TO_VENUS_CARD,
    COPY_TRADE,
    DRAW_CARDS,
    DRAW_CARDS_AND_BUY_ONE,
    DRAW_CARDS_AND_DISCARD_ONE,
    DRAW_CARDS_AND_KEEP_ONE,
    GAIN_CARD_DISCOUNT,
    GAIN_PRODUCTION,
    GAIN_RESOURCES,
    GAIN_SCIENCE_TAG,
    GAIN_TR,
    GAIN_VP,
    INCREASE_VENUS_SCALE,
    LOSE_RESOURCES,
    OPPONENT_DISCARD,
    PLACE_OCEAN_TILE,
    STEAL_RESOURCES,
    GAIN_INFLUENCE,
    PLACE_DELEGATES,
    GIVE_MC_PER_DELEGATE,
    GAIN_SCIENCE_TAGS_AND_CLONE_TAG,
    RAISE_PLANETARY_TRACK,
    PLACE_HAZARD_TILE,
    ERODE_SPACES_ADJACENT_TO_HAZARDS,
    GAIN_MC_PER_HAZARD_TILE,
    DRAW_EARTH_CARD,
    WGT_RAISE_GLOBAL_PARAMETER,
    GAIN_MC_FOR_EARTH_TAGS,
    /**
     * Turmoil Redux — «Add n delegates to a RESOLUTION»: the delegates go from
     * the player's reserve onto ONE resolution in the voting area (the Redux
     * Venus tile: two per settlement, one or two at the top of the track).
     * Deliberately NOT `PLACE_DELEGATES`: that one seats delegates in a classic
     * Turmoil PARTY (Pallas) — a different table, a different ledger, and a
     * game has one of the two political engines, never both. Appended LAST:
     * the enum is numeric and exported to `genfiles/colonies.json`.
     */
    PLACE_DELEGATES_ON_RESOLUTION,
}
