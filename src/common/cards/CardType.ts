export enum CardType {
    EVENT = 'event',
    ACTIVE = 'active',
    AUTOMATED = 'automated',
    PRELUDE = 'prelude',
    CORPORATION = 'corporation',
    CEO = 'ceo',
    STANDARD_PROJECT = 'standard_project',
    STANDARD_ACTION = 'standard_action',
    // Proxy cards are not real cards, but for operations that need a card-like behavior.
    PROXY = 'proxy',
    /**
     * A Turmoil Redux RESOLUTION — the Mars Parliament's own card family. Never
     * a project card: it lives in the parliament's deck (`server/parliament`),
     * is never in a hand or a tableau, and the premium face answers this type
     * with the resolution's OWN anatomy (the bill — `PremiumResolutionFace`).
     */
    RESOLUTION = 'resolution',
}
