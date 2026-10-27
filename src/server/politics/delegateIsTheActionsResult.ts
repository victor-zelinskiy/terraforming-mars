/*
 * THE DELEGATE IS THE ACTION'S WHOLE RESULT — a light module (type imports only): `Executor` asks it, and the facade
 * (`PoliticalOps.ts`) pulls the engines and the cards in — importing that from the Executor closes a cycle through `Card`.
 */
import type {Behavior} from '../behavior/Behavior';
import type {ICard} from '../cards/ICard';

/** The keys of a behavior that yield nothing of their own — a price, a log line, a branch title. */
const NOT_A_YIELD: ReadonlySet<string> = new Set(['spend', 'log', 'title']);

/**
 * THE DELEGATE IS THE ACTION'S WHOLE RESULT (T07 Martian Media Center — «pay 3 M€ → add a delegate»): `behavior` is
 * `card`'s ACTION — or one BRANCH of its `or` (TR84 Titan Holdings: «2 leverage → a delegate OR 4 → two»: the
 * Executor checks and runs each branch apart, so the branch is the action as far as the price is concerned) — and
 * yields nothing but `turmoil.sendDelegates`. With no address for the delegate
 * (`delegatesHaveAnAddress`) such an action would be PAID AND PLACE NOTHING, so it is refused — `Executor.canExecute`
 * says no, `actionUnavailableReasons` names why («No resolution is up for a vote»). A PLAY is never this: the card
 * itself lands on the table (T03 Cultural Metropolis plays with its grant's NAMED skip), and neither is an action with
 * another yield beside the delegate (the skip is named, the rest still happens).
 */
export function delegateIsTheActionsResult(card: ICard, behavior: Behavior): boolean {
  if (!isTheActionOrABranch(card, behavior) || behavior.turmoil?.sendDelegates === undefined) {
    return false;
  }
  const keys = Object.keys(behavior).filter((key) => behavior[key as keyof Behavior] !== undefined);
  const turmoilKeys = Object.keys(behavior.turmoil).filter((key) => behavior.turmoil?.[key as keyof NonNullable<Behavior['turmoil']>] !== undefined);
  return keys.every((key) => key === 'turmoil' || NOT_A_YIELD.has(key)) && turmoilKeys.length === 1;
}

/** `behavior` IS what the card's action runs — the action itself, or one of its `or` branches (taken alone). */
function isTheActionOrABranch(card: ICard, behavior: Behavior): boolean {
  const action = card.actionBehavior;
  if (action === undefined) {
    return false;
  }
  return action === behavior || (action.or?.behaviors.some((branch) => branch === behavior) ?? false);
}
