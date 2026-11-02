import {IPlayer} from '../IPlayer';
import {ICard} from '../cards/ICard';
import {Behavior, AddResource} from './Behavior';
import {AddResourcesToCard, Options} from '../deferredActions/AddResourcesToCard';

/**
 * THE ONE CANDIDATE SET of an `addResourcesToAnyCard` addition — the
 * deferred action every reader builds: `Executor.canExecute`, the live
 * `Executor.execute` defer, the action reasons, the preview's chip and its
 * pre-collected pick, the futility reader. Five separate constructions agreed
 * on the tableau holders but not on the rule below, so the preview offered a
 * branch the live action refused (P43, 2026-11-02).
 *
 * THE RULE: a branch that PAYS with this card's own resources
 * (`spend.resourcesHere`) never offers this card as the target. «Remove 1
 * science here to add 1 resource to ANY card» onto itself is a pure zero
 * (−1, +1) — and upstream's own guard (`Executor.canExecute`: «not playable
 * if the only candidate is the card itself», Applied Science) only covered
 * the lone-candidate case, so with any other holder in play the pick still
 * listed the card as a target worth a press. The fork drops it from the set
 * altogether: the sole-self case then has no candidate (the branch is
 * unavailable, by the SAME count every reader takes) and the other cases
 * never show a no-op target. Decision recorded in
 * `tests/cards/prelude2/AppliedScience.spec.ts`.
 */
export function addToAnyCardTarget(
  player: IPlayer,
  card: ICard,
  behavior: Behavior,
  addition: Omit<AddResource, 'mustHaveCard'>,
  options: Options = {},
): AddResourcesToCard {
  const paysFromHere = (behavior.spend?.resourcesHere ?? 0) > 0;
  const own = options.filter;
  const filter = paysFromHere ?
    (c: ICard) => c !== card && c.name !== card.name && (own === undefined || own(c)) :
    own;
  return new AddResourcesToCard(player, addition.type, {
    restrictedTag: addition.tag,
    min: addition.min,
    robotCards: addition.robotCards !== undefined,
    ...options,
    ...(filter !== undefined ? {filter} : {}),
  });
}
