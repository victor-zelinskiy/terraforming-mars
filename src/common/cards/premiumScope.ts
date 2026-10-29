import {CardName} from './CardName';
import {GameModule} from './GameModule';
import {PRELUDE2_CARDS_HELD_BACK} from './prelude2Adaptation';
import {TURMOIL_REDUX_REPLACED_CLASSIC_NAMES} from './turmoilReduxReplacements';

/**
 * THE PREMIUM SCOPE — which cards every premium subsystem covers (previews, reasons, the
 * structured card text, the forecast, the lore, the premium face's catalogue, …) and every
 * coverage guard enumerates as its worklist (invariant 11). ONE definition, read by every
 * guard and every source-side catalogue; a hand-written module list anywhere else fails
 * `tests/cards/premiumScope.spec.ts`.
 *
 * The scope is a MODULE list with TWO card-level exceptions:
 *  · the classic Turmoil module is PART of Turmoil Redux (rulebook p.12 — its cards play
 *    beside the set; all 22 adapted by 2026-10-25, `docs/TURMOIL_REDUX_CLASSIC_CARDS.md`)
 *    and is in scope WHOLE, minus the classic cards the Redux set REPLACES
 *    (`turmoilReduxReplacements.ts`): those never reach a Redux table — their `:redux`
 *    replacement is the card a Redux table deals and covers;
 *  · Prelude 2 joins CARD BY CARD (since 2026-10-29, `docs/PRELUDE2_ADAPTATION.md`): a card
 *    still in the hold-back list (`prelude2Adaptation.ts`) is neither dealt nor in scope,
 *    and leaving the list does both at once — the worklist and the scope are one object.
 *    The list is temporary scaffolding; when it empties, the module is in scope whole.
 * Widening to a whole new module is the expansion-adaptation procedure
 * (`docs/claude/expansion-adaptation-checklist.md`): add its key HERE, then let the
 * guards print the work.
 */
export const PREMIUM_SCOPE_MODULES: ReadonlyArray<GameModule> = [
  'base', 'corpera', 'promo', 'venus', 'colonies', 'prelude', 'ares', 'deltaProject', 'turmoilRedux',
  // Classic Turmoil — part of Redux; `inPremiumScope` drops the classic cards the Redux set replaces.
  'turmoil',
  // Prelude 2 — card by card; `inPremiumScope` drops the cards still held back.
  'prelude2',
];

/**
 * The premium FACE's catalogue also draws the CEOs (desktop-removal wave 4: every L-card
 * renders on the premium face with its prose zone) — the face is the one subsystem that
 * covers that module; the rest of the premium layer does not.
 */
export const PREMIUM_FACE_SCOPE_MODULES: ReadonlyArray<GameModule> = [...PREMIUM_SCOPE_MODULES, 'ceo'];

/** The fields of a card the scope reads — a server manifest entry, a client card, an `ICard`. */
export type PremiumScopeSubject = {readonly module: GameModule, readonly name: CardName | string};

/**
 * Is `card` covered? `modules` narrows or widens the module list for a subsystem whose
 * scope differs and says why at its call site (the face's CEOs, a console path not yet
 * open to a module); the two card-level exceptions hold whatever the list.
 */
export function inPremiumScope(card: PremiumScopeSubject, modules: ReadonlyArray<GameModule> = PREMIUM_SCOPE_MODULES): boolean {
  if (!modules.includes(card.module)) {
    return false;
  }
  switch (card.module) {
  case 'turmoil':
    // A REPLACED classic card never reaches a Redux table — its `:redux` replacement took over (`cardsToRemove`) and
    // is the Redux card in scope.
    return !TURMOIL_REDUX_REPLACED_CLASSIC_NAMES.has(card.name as CardName);
  case 'prelude2':
    // A card still held back is neither dealt nor covered — TEMPORARY, goes with the list.
    return !PRELUDE2_CARDS_HELD_BACK.has(card.name as CardName);
  default:
    return true;
  }
}
