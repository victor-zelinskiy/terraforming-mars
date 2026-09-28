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
    VENUS = 'Venus',
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

    // WHEN ADDING A NEW COLONY, ADD IT TO AllColonies.ts
}
