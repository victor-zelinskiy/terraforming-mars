import {IPlayer} from '../IPlayer';
import {ICard} from '../cards/ICard';
import {IProjectCard} from '../cards/IProjectCard';
import {SelectCard} from '../inputs/SelectCard';
import {cardDiscard} from '../inputs/discardPrompt';
import {message} from '../logs/MessageBuilder';

/**
 * The DISCARD a behavior's card cost (`spend.cards`) asks — «discard N cards to
 * …» (P86 Unexpected Application). The candidates are the hand WITHOUT the card
 * being paid for (it is leaving the hand to be played), the bounds are exact
 * (`min === max === count`), and the prompt wears the discard marker of the card
 * that demands it.
 *
 * ONE builder for both readers (the DP10/DP11 projection contract, as
 * `steelSpendSourceOptions`):
 *  - `Executor.execute` builds it WITH the discard callback and defers it FIRST
 *    (the rest of the behavior runs in its callback — the price before the
 *    result);
 *  - the read-only action preview (`stepsForBehavior`) builds it with a no-op
 *    callback and serializes it — the title, the candidates and the
 *    `discardPrompt` marker the batch replay addresses (`role: 'discard'`,
 *    source = this card) are then the live prompt's BY CONSTRUCTION.
 *
 * Returns `undefined` when fewer than `count` other cards are in hand — the card
 * cannot be played at all then (`Executor.canExecute`), and no prompt exists.
 */
export function spendCardsDiscardPrompt(
  player: IPlayer,
  card: ICard,
  count: number,
  onDiscard: (cards: ReadonlyArray<IProjectCard>) => void,
): SelectCard<IProjectCard> | undefined {
  const cards = player.cardsInHand.filter((c) => c !== card && c.name !== card.name);
  if (count <= 0 || cards.length < count) {
    return undefined;
  }
  return new SelectCard(
    message('Select ${0} card(s) to discard', (b) => b.number(count)),
    undefined,
    cards,
    {min: count, max: count},
  ).markDiscardPrompt(cardDiscard(card, {min: count, max: count})).andThen((chosen) => {
    onDiscard(chosen);
    return undefined;
  });
}
