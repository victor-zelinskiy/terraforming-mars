import {CardName} from './CardName';
import {GameModule} from './GameModule';
import {TURMOIL_REDUX_REPLACED_CLASSIC_NAMES} from './turmoilReduxReplacements';

/**
 * THE PREMIUM SCOPE — which cards every premium subsystem covers (previews, reasons, the
 * structured card text, the forecast, the lore, the premium face's catalogue, …) and every
 * coverage guard enumerates as its worklist (invariant 11). ONE definition, read by every
 * guard and every source-side catalogue; a hand-written module list anywhere else fails
 * `tests/cards/premiumScope.spec.ts`.
 *
 * The scope is a MODULE list with ONE card-level exception: the classic Turmoil module is
 * PART of Turmoil Redux (rulebook p.12 — its cards play beside the set; all 22 adapted by
 * 2026-10-25, `docs/TURMOIL_REDUX_CLASSIC_CARDS.md`) and is in scope WHOLE, minus the
 * classic cards the Redux set REPLACES (`turmoilReduxReplacements.ts`): those never reach a
 * Redux table — their `:redux` replacement is the card a Redux table deals and covers.
 * Widening to a whole new module is the expansion-adaptation procedure
 * (`docs/claude/expansion-adaptation-checklist.md`): add its key HERE, then let the
 * guards print the work.
 */
export const PREMIUM_SCOPE_MODULES: ReadonlyArray<GameModule> = [
  'base', 'corpera', 'promo', 'venus', 'colonies', 'prelude', 'ares', 'deltaProject', 'turmoilRedux',
  // Classic Turmoil — part of Redux; `inPremiumScope` drops the classic cards the Redux set replaces.
  'turmoil',
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
 * open to a module); the replaced classic Turmoil card's exception holds whatever the list.
 */
export function inPremiumScope(card: PremiumScopeSubject, modules: ReadonlyArray<GameModule> = PREMIUM_SCOPE_MODULES): boolean {
  if (!modules.includes(card.module)) {
    return false;
  }
  if (card.module !== 'turmoil') {
    return true;
  }
  // A REPLACED classic card never reaches a Redux table — its `:redux` replacement took over (`cardsToRemove`) and
  // is the Redux card in scope.
  return !TURMOIL_REDUX_REPLACED_CLASSIC_NAMES.has(card.name as CardName);
}
