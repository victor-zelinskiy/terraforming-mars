import {CardName} from './CardName';

/**
 * CLASSIC TURMOIL CARDS UNDER TURMOIL REDUX — THE HOLD-BACK LIST. Temporary scaffolding.
 *
 * Rulebook p.12 plays the official Turmoil expansion's cards beside Redux («If you are
 * playing with the official Turmoil expansion, remove the Septem Tribus corporation card
 * from it…» — everything else shuffles into the decks), so `GameCards` includes
 * `TURMOIL_CARD_MANIFEST` whenever Turmoil Redux is on. But a classic card still READS THE
 * CLASSIC ENGINE (`Turmoil.getTurmoil`, `SendDelegateToArea`, party leaders of a party
 * table) until it is adapted, and it is covered by the premium subsystems only once it is
 * (`premiumScope.ts` — the module `turmoil` is in scope MINUS this list). Until a card is
 * adapted it must not be dealt into a Redux game: this list holds it back, and only this
 * list — the `politics` marker of `CardFactorySpec` gates OTHER modules' `compatibility:
 * 'turmoil'` entries and stays as it is; `instantiate: false` on the manifest would also
 * hide the cards from classic Turmoil games.
 *
 * THE LIST IS A WORKLIST AND THE PREMIUM SCOPE AT ONCE. Every row is a card still to
 * adapt; adapting one ENDS with deleting its row here (nothing else in this file changes)
 * — the same deletion deals the card to a Redux table AND puts it into every premium guard
 * (`inPremiumScope`). When the last row goes, delete this file together with
 * `GameCards.filterHeldBackUnderRedux` and the `turmoil` clause of `inPremiumScope`. Two
 * kinds of row — the per-card route is `docs/TURMOIL_REDUX_CLASSIC_CARDS.md`:
 *
 *  · ADAPT IN PLACE — the classic card stays the card: its political reads move onto
 *    `game.politics`, it enters the premium scope, its spec gains the Redux table.
 *  · REPLACED BY THE REDUX SET (`server/cards/turmoilRedux/classicReplacements.ts` — the
 *    six project scans «Replacement - <Name>.png» and the Septem Tribus corporation) — the
 *    classic card is NEVER dealt under Redux. «Adapting» it = authoring the Redux
 *    replacement as a `:redux`-suffixed card of the Redux manifest and putting the classic
 *    name into that manifest's `cardsToRemove`; only then does its row leave this list (the
 *    guard fails a replaced classic card that is out of this list without `cardsToRemove`).
 *
 * The NAMES live in `common` because the client reads the scope too (the premium-card
 * playground, the effect / action extraction flags); the server's predicate over
 * `GameOptions` stays in `server/cards/turmoil/turmoilReduxAdaptation.ts`.
 *
 * Guard and worklist printer: `tests/cards/turmoil/TurmoilCardsUnderRedux.spec.ts`.
 */

/** ADAPT IN PLACE — project cards + corporations (ordered by how much they touch politics). */
export const TURMOIL_CARDS_TO_ADAPT_IN_PLACE: ReadonlyArray<CardName> = [
  // Corporations WITHOUT a political dependency — the premium adaptation only (lore, information model,
  // previews); MarsBot already plays their bot twins (`console-bot-corp-*.spec.ts`). Lakefront Resorts left
  // 2026-10-23 (forecast twins of its ocean hook) — the template for the three below.
  CardName.PRISTAR,
  CardName.TERRALABS_RESEARCH,
  CardName.UTOPIA_INVEST,
];

/**
 * REPLACED BY THE REDUX SET — 6 project cards + 1 corporation. The classic card never
 * joins a Redux deck; the row leaves when its `:redux` replacement is authored AND the
 * classic name stands in the Redux manifest's `cardsToRemove`.
 */
export const TURMOIL_CARDS_AWAITING_REDUX_REPLACEMENT: ReadonlyArray<CardName> = [
  CardName.AERIAL_LENSES, // → Scientists, cost 3, Science tag, no VP penalty
  CardName.BANNED_DELEGATE, // → any delegate off a resolution or a Popular Support area
  CardName.POLITICAL_ALLIANCE, // → leader of 2 resolutions → 1 Agenda step (cost 2)
  CardName.RECRUITMENT, // → a NEUTRAL delegate on a resolution ↔ your own from the reserve
  CardName.SPONSORED_MOHOLE, // → Greens, 1 VP
  CardName.VOTE_OF_NO_CONFIDENCE, // → ≥1 influence; unseat the CURRENT chairman → 1 Agenda step
  // Also `compatibility: 'turmoil'` without a `politics` mark — `isCompatibleWith` keeps it out on its own.
  CardName.SEPTUM_TRIBUS, // → 40 M€, banner cubes grant party effects (`grantPartyEffect`)
];

/** The one set `GameCards` (through the server predicate) and `inPremiumScope` read: every classic Turmoil card not yet adapted. */
export const TURMOIL_CARDS_HELD_BACK_UNDER_REDUX: ReadonlySet<CardName> = new Set<CardName>([
  ...TURMOIL_CARDS_TO_ADAPT_IN_PLACE,
  ...TURMOIL_CARDS_AWAITING_REDUX_REPLACEMENT,
]);
