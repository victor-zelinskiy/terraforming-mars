import {CardName} from './CardName';

/**
 * PRELUDE 2 — THE HOLD-BACK LIST. Temporary scaffolding (the classic-Turmoil pattern,
 * `docs/PRELUDE2_ADAPTATION.md`; the precedent `docs/TURMOIL_REDUX_CLASSIC_CARDS.md`).
 *
 * The module `prelude2` is in the premium scope since 2026-10-29 (`premiumScope.ts`) —
 * MINUS this list. A card still listed here is neither DEALT (`GameCards` drops it from
 * every deck the option would put it in) nor COVERED (no premium guard enumerates it,
 * no source catalogue draws it); adapting a card ENDS with deleting its row here, and
 * nothing else in this file changes — the same deletion deals the card to the table AND
 * puts it into every premium guard (`inPremiumScope`), which then print the work left
 * (`docs/claude/expansion-adaptation-checklist.md`). The list is a WORKLIST and the
 * premium scope at once; the owner walks it one card at a time.
 *
 * When the last row goes, delete this file together with the server predicate
 * (`server/cards/prelude2/prelude2Adaptation.ts`), `GameCards.filterHeldBackPrelude2`
 * and the `prelude2` clause of `inPremiumScope` — the module is then in scope WHOLE,
 * and the creator's Prelude 2 toggle is the owner's separate confirmation.
 *
 * Two kinds of row:
 *  · ADAPT IN PLACE — the card stays the card. A POLITICAL card (`compatibility:
 *    'turmoil'`) also moves its reads onto `game.politics` and is marked `politics:
 *    'redux'` in the manifest in the same diff — the console creator has no classic
 *    Turmoil, so an unmarked political card that left this list would be adapted and
 *    never dealt (the guard fails it).
 *  · REPLACED BY THE REDUX SET — the Turmoil Redux set prints ONE replacement prelude
 *    («Replacement - Corridors of Power.png»; rulebook p.1 «9 new Prelude cards (and 1
 *    replacement prelude)»). The classic card is NEVER dealt under Redux: «adapting» it =
 *    authoring the Redux replacement (`CORRIDORS_OF_POWER_REDUX` — TRP0, done 2026-10-31; the TR71…TR77 contract,
 *    `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.2) with the classic name in the Redux
 *    manifest's `cardsToRemove` and a `kind: 'prelude'` row in the replacement registry
 *    (`turmoilReduxReplacements.ts`); only then does its row leave this list.
 *
 * The NAMES live in `common` because the client reads the scope too (the premium-card
 * playground, the effect / action extraction flags) and must never import `src/server`.
 *
 * Guard and worklist printer: `tests/cards/prelude2/Prelude2CardsHeldBack.spec.ts`.
 */

/** ADAPT IN PLACE — 2 preludes, 5 corporations (ordered as the manifest prints them; every project card P68…P91 is adapted). */
export const PRELUDE2_CARDS_TO_ADAPT_IN_PLACE: ReadonlyArray<CardName> = [
  // ── Preludes (P43…P67; P47 Corridors of Power is REPLACED by TRP0 — below, crossed) ──
  CardName.VENUS_L1_SHADE, // P66 · Venus · declarative — Venus 3 steps
  CardName.WORLD_GOVERNMENT_ADVISOR, // P67 · behavior + action (`ActivePreludeCard`)
  // ── Corporations (PC01…PC05; MarsBot already plays its own twins — the human card is a separate adaptation) ──
  CardName.NIRGAL_ENTERPRISES, // PC01 · declarative
  CardName.PALLADIN_SHIPPING, // PC02 · behavior + `onCardPlayed` hook + action
  CardName.SAGITTA_FRONTIER_SERVICES, // PC03 · behavior + bespokePlay + `onCardPlayed` hook
  CardName.ECOTEC, // PC04 · behavior + `onCardPlayed` hook
  CardName.SPIRE, // PC05 · `onCardPlayed` hook
];

/**
 * REPLACED BY THE REDUX SET — the classic card never joins a Redux deck; a row leaves
 * when its `:redux` replacement is authored AND the classic name stands in the Redux
 * manifest's `cardsToRemove` AND in the replacement registry (the guard fails a row that
 * left without them). EMPTY since 2026-10-31: P47 Corridors of Power crossed as TRP0
 * (`turmoilRedux/CorridorsOfPowerRedux.ts`) — the registry keeps the classic out of the
 * premium scope (`inPremiumScope`). The constant goes with the list (§2.4).
 */
export const PRELUDE2_CARDS_AWAITING_REDUX_REPLACEMENT: ReadonlyArray<CardName> = [];

/** The one set `GameCards` (through the server predicate) and `inPremiumScope` read: every Prelude 2 card not yet adapted. */
export const PRELUDE2_CARDS_HELD_BACK: ReadonlySet<CardName> = new Set<CardName>([
  ...PRELUDE2_CARDS_TO_ADAPT_IN_PLACE,
  ...PRELUDE2_CARDS_AWAITING_REDUX_REPLACEMENT,
]);
