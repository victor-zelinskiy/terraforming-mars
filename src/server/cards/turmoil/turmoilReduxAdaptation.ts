import {CardName} from '../../../common/cards/CardName';
import {GameOptions} from '../../game/GameOptions';

/**
 * CLASSIC TURMOIL CARDS UNDER TURMOIL REDUX — THE HOLD-BACK LIST. Temporary scaffolding.
 *
 * Rulebook p.12 plays the official Turmoil expansion's cards beside Redux («If you are
 * playing with the official Turmoil expansion, remove the Septem Tribus corporation card
 * from it…» — everything else shuffles into the decks), so `GameCards` includes
 * `TURMOIL_CARD_MANIFEST` whenever Turmoil Redux is on. But the manifest's cards still
 * READ THE CLASSIC ENGINE (`Turmoil.getTurmoil`, `behavior.turmoil` in the Executor,
 * `SendDelegateToArea`, party leaders of a party table) and none of them is covered by
 * the premium subsystems (module `turmoil` is outside every SCOPE set —
 * `docs/claude/expansion-adaptation-checklist.md`). Until a card is adapted it must not
 * be dealt into a Redux game: this list holds it back, and only this list — the
 * `politics` marker of `CardFactorySpec` gates OTHER modules' `compatibility: 'turmoil'`
 * entries and stays as it is; `instantiate: false` on the manifest would also hide the
 * cards from classic Turmoil games.
 *
 * THE LIST IS A WORKLIST. Every row is a card still to adapt, and adapting one ENDS with
 * deleting its row here (nothing else in this file changes). When the last row goes,
 * delete this file together with `GameCards.filterHeldBackUnderRedux`. Two kinds of row
 * — the per-card route is `docs/TURMOIL_REDUX_CLASSIC_CARDS.md`:
 *
 *  · ADAPT IN PLACE — the classic card stays the card: its political reads move onto
 *    `game.politics`, it enters the premium scope, its spec gains the Redux table.
 *  · REPLACED BY THE REDUX SET (`turmoilRedux/classicReplacements.ts` — the six project
 *    scans «Replacement - <Name>.png» and the Septem Tribus corporation) — the classic
 *    card is NEVER dealt under Redux. «Adapting» it = authoring the Redux replacement as a
 *    `:redux`-suffixed card of the Redux manifest and putting the classic name into that
 *    manifest's `cardsToRemove`; only then does its row leave this list (the guard fails a
 *    replaced classic card that is out of this list without `cardsToRemove`).
 *
 * A dev may still force a held-back card into a Redux game through the guaranteed cards
 * (`customProjectCards` / `customCorporationsList`) — `GameCards` adds those AFTER this
 * filter, which is how a single card is tested on a Redux table before its row goes.
 *
 * Guard and worklist printer: `tests/cards/turmoil/TurmoilCardsUnderRedux.spec.ts`.
 */

/** ADAPT IN PLACE — 11 project cards + 4 corporations (ordered by how much they touch politics). */
export const TURMOIL_CARDS_TO_ADAPT_IN_PLACE: ReadonlyArray<CardName> = [
  // A party requirement and a declarative body — `PartyRequirement` already reads `game.politics`;
  // the work is the premium scope (preview / information / reasons / lore) and the Redux spec table.
  CardName.DIASPORA_MOVEMENT, // Reds · 1 M€ per Jovian tag in play
  CardName.GMO_CONTRACT, // Greens · effect: 2 M€ per animal / plant / microbe tag you play
  CardName.PR_OFFICE, // Unity · +1 TR, 1 M€ per Earth tag
  CardName.PARLIAMENT_HALL, // Mars First · +1 M€ production per 3 Building tags
  CardName.RED_TOURISM_WAVE, // Reds · 1 M€ per empty area adjacent to your tiles
  CardName.SUPPORTED_RESEARCH, // Scientists · draw 2
  CardName.WILDLIFE_DOME, // Greens · a greenery
  // A chairman requirement only — `ChairmanRequirement` reads `game.politics`.
  CardName.PUBLIC_CELEBRATIONS, // 2 VP
  // A political EFFECT that reads the classic engine directly — the adaptation moves it onto the facade.
  CardName.CULTURAL_METROPOLIS, // Unity · places 2 delegates (`Turmoil.getAvailableDelegateCount` + `SendDelegateToArea`)
  CardName.EVENT_ANALYSTS, // Scientists · `behavior.turmoil.influenceBonus` (the Executor reads `Turmoil.getTurmoil`)
  CardName.MARTIAN_MEDIA_CENTER, // Mars First · action `behavior.turmoil.sendDelegates` (the Executor reads `Turmoil.getTurmoil`)
  // Corporations WITHOUT a political dependency — the premium adaptation only (lore, information model,
  // previews); MarsBot already plays their bot twins (`console-bot-corp-*.spec.ts`).
  CardName.LAKEFRONT_RESORTS,
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

/** The one set `GameCards` reads: every classic Turmoil card not yet allowed onto a Redux table. */
export const TURMOIL_CARDS_HELD_BACK_UNDER_REDUX: ReadonlySet<CardName> = new Set<CardName>([
  ...TURMOIL_CARDS_TO_ADAPT_IN_PLACE,
  ...TURMOIL_CARDS_AWAITING_REDUX_REPLACEMENT,
]);

/**
 * True when `cardName` must stay out of THIS game's decks because it is a classic
 * Turmoil card not yet adapted to the Mars Parliament. Answers only for a Redux table
 * without the classic engine (the only legal Redux configuration — `Game.newInstance`
 * refuses both at once); a classic Turmoil game deals every card of its manifest.
 */
export function isTurmoilCardHeldBackUnderRedux(cardName: CardName, gameOptions: GameOptions): boolean {
  if (gameOptions.turmoilReduxExpansion !== true || gameOptions.turmoilExtension === true) {
    return false;
  }
  return TURMOIL_CARDS_HELD_BACK_UNDER_REDUX.has(cardName);
}
