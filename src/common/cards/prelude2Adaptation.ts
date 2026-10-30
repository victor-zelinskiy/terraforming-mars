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
 *    authoring the Redux replacement (`CORRIDORS_OF_POWER_REDUX`, the TR71…TR77 contract,
 *    `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.2) with the classic name in the Redux
 *    manifest's `cardsToRemove` and a `kind: 'prelude'` row in the replacement registry
 *    (`turmoilReduxReplacements.ts`); only then does its row leave this list.
 *
 * The NAMES live in `common` because the client reads the scope too (the premium-card
 * playground, the effect / action extraction flags) and must never import `src/server`.
 *
 * Guard and worklist printer: `tests/cards/prelude2/Prelude2CardsHeldBack.spec.ts`.
 */

/** ADAPT IN PLACE — 24 project cards, 24 preludes, 5 corporations (ordered as the manifest prints them). */
export const PRELUDE2_CARDS_TO_ADAPT_IN_PLACE: ReadonlyArray<CardName> = [
  // ── Project cards (P68…P91) ──
  CardName.COLONIAL_REPRESENTATION, // P71 · Colonies + POLITICAL · declarative — 3 M€ per colony
  CardName.ENVOYS_FROM_VENUS, // P72 · Venus + POLITICAL · declarative — 2 delegates in 1 party
  CardName.COLONIAL_ENVOYS, // P70 · Colonies + POLITICAL (Unity) · declarative — a delegate per colony
  CardName.SPECIAL_PERMIT, // P82 · POLITICAL (Greens) · bespokePlay — steal 4 plants (a SHOWN target, invariant 3)
  CardName.FLOATING_REFINERY, // P73 · Venus · behavior + bespoke action
  CardName.FRONTIER_TOWN, // P74 · POLITICAL (Mars First) · bespokePlay — a city with its own placement rule
  CardName.JOVIAN_ENVOYS, // P77 · POLITICAL · declarative — 2 delegates in 1 party
  CardName.MICROGRAVITY_NUTRITION, // P79 · Colonies · bespokePlay — M€ production per colony
  CardName.SOIL_STUDIES, // P81 · Venus + Colonies · declarative — plants per Venus tag / plant tag / colony
  CardName.STRATOSPHERIC_EXPEDITION, // P84 · Venus · declarative — 2 floaters to ANY card + 2 Venus cards
  CardName.UNEXPECTED_APPLICATION, // P86 · Venus · declarative — discard 1 to raise Venus
  CardName.VENUS_ALLIES, // P87 · Venus + Colonies · declarative — Venus 2 steps + 4 M€ per colony
  CardName.VENUS_ORBITAL_SURVEY, // P88 · Venus · bespoke action (listed SAFE in `actionCaption.spec` while out of scope)
  CardName.VENUS_SHUTTLES, // P89 · Venus · behavior + bespoke action
  CardName.VENUS_TRADE_HUB, // P90 · Colonies + Venus · an EFFECT card (no play / action hook)
  CardName.WG_PROJECT, // P91 · POLITICAL (chairman) · bespokePlay — draw 3 preludes, play 1
  // ── Preludes (P43…P67; P47 Corridors of Power is REPLACED, below) ──
  CardName.APPLIED_SCIENCE, // P43 · declarative — 6 science resources here
  CardName.ATMOSPHERIC_ENHANCERS, // P44 · Venus · behavior + bespokePlay — a parameter choice + 2 floater cards
  CardName.BOARD_OF_DIRECTORS, // P45 · behavior + action (`ActivePreludeCard`) — director resources
  CardName.COLONY_TRADE_HUB, // P46 · Colonies · behavior + `onColonyAdded` hook (a forecast twin)
  CardName.EARLY_COLONIZATION, // P48 · Colonies · behavior + bespokePlay — a colony + 3 energy
  CardName.FLOATING_TRADE_HUB, // P49 · action (`ActivePreludeCard`)
  CardName.FOCUSED_ORGANIZATION, // P50 · behavior + action — the AndOptions-nested SelectCard (checklist gotcha)
  CardName.HIGH_CIRCLES, // P51 · POLITICAL · `PartyRequirement` + behavior + bespokePlay
  CardName.INDUSTRIAL_COMPLEX, // P52 · bespokePlay — lose 18 M€, every production below 1 to 1
  CardName.MAIN_BELT_ASTEROIDS, // P53 · bespokePlay + `onResourceAdded` hook — asteroids here, VP per 2
  CardName.NOBEL_PRIZE, // P54 · behavior + bespokePlay — 5 M€ + 2 cards with requirements
  CardName.OLD_MINING_COLONY, // P55 · Colonies · behavior + bespokePlay — a colony, discard 1
  CardName.PLANETARY_ALLIANCE, // P56 · Venus · behavior + bespokePlay — 2 TR + a Jovian and a Venus card
  CardName.PRESERVATION_PROGRAM, // P57 · bespokePlay — 5 TR
  CardName.PROJECT_EDEN, // P58 · an ocean, a city and a greenery, discard 3 — three placements
  CardName.RECESSION, // P59 · behavior + bespokePlay — EACH OPPONENT loses 5 M€ and 1 M€ production (cross-player)
  CardName.RISE_TO_POWER, // P60 · POLITICAL · declarative — +3 M€ production, 3 delegates
  CardName.SOIL_BACTERIA, // P61 · behavior + `onCardPlayed` hook (a forecast twin)
  CardName.SPACE_LANES, // P62 · declarative — 3 titanium
  CardName.SUITABLE_INFRASTRUCTURE, // P63 · behavior + `onProductionGain` hook (a forecast twin)
  CardName.TERRAFORMING_DEAL, // P64 · `onIncreaseTerraformRating` hook
  CardName.VENUS_CONTRACT, // P65 · Venus · behavior + `onGlobalParameterIncrease` hook
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
 * REPLACED BY THE REDUX SET — 1 prelude. The classic card never joins a Redux deck;
 * the row leaves when its `:redux` replacement is authored AND the classic name stands
 * in the Redux manifest's `cardsToRemove` (the guard fails a row that left without it).
 */
export const PRELUDE2_CARDS_AWAITING_REDUX_REPLACEMENT: ReadonlyArray<CardName> = [
  CardName.CORRIDORS_OF_POWER, // P47 · POLITICAL · scan «Preludes/Replacement - Corridors of Power.png»
];

/** The one set `GameCards` (through the server predicate) and `inPremiumScope` read: every Prelude 2 card not yet adapted. */
export const PRELUDE2_CARDS_HELD_BACK: ReadonlySet<CardName> = new Set<CardName>([
  ...PRELUDE2_CARDS_TO_ADAPT_IN_PLACE,
  ...PRELUDE2_CARDS_AWAITING_REDUX_REPLACEMENT,
]);
