import {Expansion, GameModule} from '../cards/GameModule';

/**
 * WHAT THE PARTY'S DECKS WILL HOLD — the server's own deck, counted (T04 «the deck is
 * visible before launch»). Answered by `PUT /api/deck-composition` for the creator's
 * CURRENT settings (the same body the launch sends), built by `GameCards` — the one
 * source that knows the banned, replaced, held-back, Automa-banned and variant-removed
 * cards. The client never counts a deck itself (`docs/claude/console/pregame-showcase.md`
 * § 6a).
 */

/** A project deck's three colours — the premium face's green / blue / red. */
export type DeckProjectTypes = {automated: number, active: number, event: number};

/** One deck: how many cards, and from which module each came. */
export type DeckCount = {total: number, byModule: Partial<Record<GameModule, number>>};

export type DeckComposition = {
  projects: DeckCount & {byType: DeckProjectTypes};
  corporations: DeckCount;
  /** 0 without the Prelude expansion — nobody is dealt a prelude then (the Valley Trust pile is not a deck). */
  preludes: DeckCount;
  /** What else the party deals beyond the three decks — each present only with the expansion that brings it. */
  extras: {
    /**
     * Colony tiles: the POOL the table deals from (what the meter prints), how many stand on
     * the table at the start (by seat count, MarsBot seated included), and the pool by the
     * expansion that PRINTS each tile (the base tiles are Colonies', the additions Redux's).
     */
    colonies?: {pool: number, inPlay: number, byExpansion: Partial<Record<Expansion, number>>},
    /** The Mars Parliament's resolution deck (Turmoil Redux). */
    resolutions?: number,
  };
};

/**
 * What ONE expansion brings to the decks — the cards it PRINTS (its own module), as the deck
 * holds them with that expansion on and the rest of the set as it stands, so an OFF tile
 * says what it WOULD add. By ORIGIN, never «with it − without it» (the owner, 2026-10-21):
 * the difference charged Colonies with the Redux cards that merely REQUIRE Colonies, netted
 * Ares' 26 cards against the 14 it replaces, and took a guaranteed card (added whatever the
 * modules) off its own module. A card a module deals only together with another is that
 * other's: the classic Turmoil cards adapted to Redux are Turmoil Redux's projects.
 */
export type ExpansionContribution = {
  projects: number,
  corporations: number,
  preludes: number,
  /** Colony tiles the expansion prints in the pool (Colonies: the base tiles; Turmoil Redux: its additions). */
  colonies: number,
  /** The resolution deck (Turmoil Redux's alone). */
  resolutions: number,
};

export type DeckCompositionModel = DeckComposition & {
  contributions: Partial<Record<Expansion, ExpansionContribution>>;
};

/**
 * The expansions the creator offers as toggles — the ones the server prices a contribution
 * for. The creator's own table (`createGameMeta.PREMIUM_EXPANSIONS`) is pinned to this list
 * by `tests/client/console/menu/deckCompositionModel.spec.ts`.
 */
export const DECK_COMPOSITION_EXPANSIONS: ReadonlyArray<Expansion> = [
  'corpera', 'prelude', 'venus', 'colonies', 'promo', 'ares', 'deltaProject', 'turmoilRedux',
];
