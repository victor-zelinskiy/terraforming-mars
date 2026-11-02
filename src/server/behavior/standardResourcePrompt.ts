import {IPlayer} from '../IPlayer';
import {ICard} from '../cards/ICard';
import {Behavior} from './Behavior';
import {SelectResource} from '../inputs/SelectResource';
import {SelectResources} from '../inputs/SelectResources';
import {cardEffect} from '../inputs/choiceContext';
import {message} from '../logs/MessageBuilder';

/** The `standardResource` entry, normalized: how many units, and whether they must all be ONE kind. */
export function standardResourceEntry(behavior: Behavior): {count: number, same: boolean} | undefined {
  const entry = behavior.standardResource;
  if (entry === undefined) {
    return undefined;
  }
  const count = typeof(entry) === 'number' ? entry : entry.count;
  const same = typeof(entry) === 'number' ? true : entry.same ?? true;
  return count > 0 ? {count, same} : undefined;
}

/**
 * THE ONE BUILDER of the «standard resource of your choice» prompt — the live
 * `Executor.execute` defers it, the action / play preview pre-collects its
 * `toModel()` as a step (`stepsForBehavior`), so the batch's addressed answer
 * (`{role: 'resource', source: this card}` — the `choiceContext` names the
 * asker) meets exactly the prompt it was collected for: same type, same
 * `include`, same amount, same title, same marker. The declarative twin of
 * Philares' payout: a bare resource dial with no attribution is a prompt the
 * player cannot explain (see `docs/PROMPT_SOURCE_AUDIT.md`).
 *
 * `same` (the default): ONE kind × count — `SelectResource`; `same: false`:
 * a free split — `SelectResources`.
 */
export function standardResourcePrompt(player: IPlayer, card: ICard, entry: {count: number, same: boolean}): SelectResource | SelectResources {
  const {count, same} = entry;
  const reward = cardEffect(card, undefined, 'reward');
  if (same === false) {
    return new SelectResources(message('Gain ${0} standard resources', (b) => b.number(count)), count)
      .markChoiceContext(reward)
      .andThen((units) => {
        player.stock.adjust(units, {log: true});
        return undefined;
      });
  }
  return new SelectResource(message('Gain ${0} units of a standard resource', (b) => b.number(count)))
    .withGainAmount(count)
    .markChoiceContext(reward)
    .andThen((unit) => {
      player.stock.add(unit, count, {log: true});
      return undefined;
    });
}
