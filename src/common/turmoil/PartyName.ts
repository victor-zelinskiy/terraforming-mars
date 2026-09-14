export enum PartyName {
    MARS = 'Mars First',
    SCIENTISTS = 'Scientists',
    UNITY = 'Unity',
    KELVINISTS = 'Kelvinists',
    REDS = 'Reds',
    GREENS = 'Greens',
    /**
     * Turmoil Redux only. The classic engine never seats this party (its
     * `ALL_PARTIES` table is typed over {@link ClassicPartyName}); under Redux
     * every mention of Kelvinists resolves to Greens (rulebook p.13).
     */
    INDUSTRIALISTS = 'Industrialists',
}

/** The six parties of the ORIGINAL Turmoil board (what the classic engine models). */
export type ClassicPartyName = Exclude<PartyName, PartyName.INDUSTRIALISTS>;
