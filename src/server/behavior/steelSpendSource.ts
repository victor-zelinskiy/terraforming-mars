import {IPlayer} from '../IPlayer';
import {ICard} from '../cards/ICard';
import {CardName} from '../../common/cards/CardName';
import {Message} from '../../common/logs/Message';
import {OptionMetadata} from '../../common/models/PlayerInputModel';
import {ActionEffect} from '../../common/models/ActionPreviewModel';
import {OrOptions} from '../inputs/OrOptions';
import {SelectOption} from '../inputs/SelectOption';
import {cardEffect} from '../inputs/choiceContext';
import {message} from '../logs/MessageBuilder';

/**
 * The steel-SOURCE choice for a behavior's unit-steel cost (`spend.steel`)
 * when Modular Floodgates (DP11) holds any steel. The stored steel «counts as
 * on your player board», so it is a legal source for a cost paid in steel
 * UNITS (Space Elevator, Electro Catapult, …) — but it is a PROTECTED source:
 * never auto-taken, the split between the supply and the card is always the
 * player's own explicit pick. Options are ordered supply-first, so the
 * default focus never touches the card; an option whose supply share exceeds
 * the live stock is simply not offered.
 *
 * ONE builder for both readers (the DP10/DP11 projection contract):
 *  - `Executor.execute` builds it WITH a spend callback and defers it;
 *  - the read-only action preview (`stepsForBehavior`) builds it with a no-op
 *    callback and serializes it — the pre-collected answer is an OPTION
 *    INDEX, so sharing the construction is what makes the replay
 *    byte-identical (order and titles cannot drift).
 *
 * Returns `undefined` when the card holds no steel (or none is needed): the
 * supply then pays silently, the historical path, and no prompt exists on
 * either side.
 */
export function steelSpendSourceOptions(
  player: IPlayer,
  card: ICard,
  amount: number,
  onSpend: (fromSupply: number, fromCard: number) => void,
): OrOptions | undefined {
  const available = Math.min(player.getSpendable('floodgateSteel'), amount);
  if (available <= 0) {
    return undefined;
  }
  const options: Array<SelectOption> = [];
  for (let fromCard = 0; fromCard <= available; fromCard++) {
    const fromSupply = amount - fromCard;
    if (fromSupply > player.steel) {
      continue;
    }
    options.push(new SelectOption(sourceTitle(fromSupply, fromCard))
      .withMetadata(sourceMetadata(player, fromSupply, fromCard))
      .andThen(() => {
        onSpend(fromSupply, fromCard);
        return undefined;
      }));
  }
  if (options.length === 0) {
    // Unreachable past `canExecute` (supply + card cover the cost), but the
    // read-only preview must stay total.
    return undefined;
  }
  // `spend-source` is the STRUCTURAL genre marker: the premium decision screen
  // reads it to ask about the source («Выберите источник стали»), never the
  // generic «choose an effect» — a title match would die on i18n's in-place
  // mutation, so the mode is what carries the shape.
  const orOptions = new OrOptions(...options).markChoiceContext(cardEffect(card, undefined, 'spend-source'));
  orOptions.title = 'Select steel source';
  return orOptions;
}

/**
 * The premium reading of ONE split option, in the console's shared chip
 * vocabulary (`ActionEffectChip` renders these on every surface — the action
 * composer's rows, the effect-decision screen and the task-host fallback):
 * each share is a cost chip with the live `current → resulting` of ITS OWN
 * store, and the card share carries the `on the card` note so two chips of the
 * same resource can never be confused (load-bearing in the mixed split, where
 * both stand side by side). `card` is the option's structural identity — the
 * client may hang inspection or a badge off it without parsing the label.
 */
function sourceMetadata(player: IPlayer, fromSupply: number, fromCard: number): OptionMetadata {
  const effects: Array<ActionEffect> = [];
  if (fromSupply > 0) {
    effects.push({direction: 'cost', icon: 'steel', amount: fromSupply, current: player.steel, resulting: player.steel - fromSupply});
  }
  if (fromCard > 0) {
    const onCard = player.getSpendable('floodgateSteel');
    effects.push({direction: 'cost', icon: 'steel', amount: fromCard, current: onCard, resulting: onCard - fromCard, note: 'on the card'});
  }
  return {
    kind: 'generic',
    icon: 'steel',
    amount: fromSupply + fromCard,
    ...(fromCard > 0 ? {card: CardName.MODULAR_FLOODGATES} : {}),
    effects,
  };
}

function sourceTitle(fromSupply: number, fromCard: number): Message {
  if (fromCard === 0) {
    return message('Spend ${0} steel from your supply', (b) => b.number(fromSupply));
  }
  if (fromSupply === 0) {
    return message('Spend ${0} steel from ${1}', (b) => b.number(fromCard).cardName(CardName.MODULAR_FLOODGATES));
  }
  return message('Spend ${0} steel from your supply and ${1} from ${2}',
    (b) => b.number(fromSupply).number(fromCard).cardName(CardName.MODULAR_FLOODGATES));
}
