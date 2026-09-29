export enum ColonyName {
    CALLISTO = 'Callisto',
    CERES = 'Ceres',
    ENCELADUS = 'Enceladus',
    EUROPA = 'Europa',
    GANYMEDE = 'Ganymede',
    IO = 'Io',
    LUNA = 'Luna',
    MIRANDA = 'Miranda',
    PLUTO = 'Pluto',
    TITAN = 'Titan',
    TRITON = 'Triton',

    // Community
    // If you add a community colony, update
    // ColonyDealer.includesCommunityColonies
    IAPETUS = 'Iapetus',
    MERCURY = 'Mercury',
    HYGIEA = 'Hygiea',
    TITANIA = 'Titania',
    // (The community «Venus» tile was RETIRED on 2026-09-28 in favour of the
    // Turmoil Redux Venus below. Its name is not reused: an old save that still
    // holds `'Venus'` is the retired tile, and the deserializer drops it with
    // a warning instead of silently turning it into a tile with other rules.)
    LEAVITT = 'Leavitt',
    PALLAS = 'Pallas',
    DEIMOS = 'Deimos',
    TERRA = 'Terra',
    KUIPER = 'Kuiper',

    // Pathfinders
    LEAVITT_II = 'Leavitt II',
    IAPETUS_II = 'Iapetus II',

    // Turmoil Redux — REPLACEMENT tiles. A Redux tile stands in for its base
    // namesake when the expansion is on (ColonyDealer swaps it in); it is never
    // dealt beside the tile it replaces. The printed name is still «PLUTO» —
    // the suffix is the tile's IDENTITY (enum, i18n key, art alias), not its face.
    PLUTO_REDUX = 'Pluto Redux',
    // …and the Turmoil Redux ADDITION: a tile with no base twin, dealt only
    // when the expansion (and Venus Next — it terraforms Venus) is on. The
    // same identity scheme as Pluto's on purpose — the suffix is the enum,
    // the i18n key and the art alias; the printed face still reads «VENUS».
    VENUS_REDUX = 'Venus Redux',
    // The second Turmoil Redux ADDITION: «mechs, asteroids or fighters» onto
    // any card — the first tile whose card benefit spans SEVERAL kinds
    // (`ColonyMetadata.cardResources`). No base twin, no Venus Next needed;
    // the printed face reads «VESTA», and so does the name (no suffix — there
    // is no other Vesta tile to tell it from).
    VESTA = 'Vesta',

    // WHEN ADDING A NEW COLONY, ADD IT TO AllColonies.ts
}
