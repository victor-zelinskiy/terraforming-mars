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
    /** Colony tiles: on the table at the start (by seat count, MarsBot seated included) out of the pool. */
    colonies?: {inPlay: number, pool: number},
    /** The Mars Parliament's resolution deck (Turmoil Redux). */
    resolutions?: number,
  };
};

/**
 * What ONE expansion brings to the decks given the rest of the set — «with it − without
 * it», so it is the honest number for an OFF tile too («would add»). Never negative in
 * practice; a replacement (a Redux colony twin) nets out.
 */
export type ExpansionContribution = {
  projects: number,
  corporations: number,
  preludes: number,
  /** Colony tiles the expansion adds to the POOL (Colonies: the whole pool; Turmoil Redux: its additions). */
  colonies: number,
  resolutions: number,
  /** Classic Turmoil cards the expansion lets in (Turmoil Redux — the adapted ones, card by card). */
  classic: number,
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
