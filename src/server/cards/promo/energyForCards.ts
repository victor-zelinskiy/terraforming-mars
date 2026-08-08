import {Resource} from '@/common/Resource';
import {SelectAmount} from '@/server/inputs/SelectAmount';
import {IPlayer} from '@/server/IPlayer';
import * as actionReason from '../actionReasons';
import {ICard} from '@/server/cards/ICard';
import {cardSource} from '@/server/inputs/choiceContext';

export function canSpendEnergyForCards(player: IPlayer) {
  return player.energy > 0 && player.game.projectDeck.canDraw(1);
}

export function energyForCardsUnavailableReason(player: IPlayer) {
  if (player.energy <= 0) {
    return actionReason.notEnoughEnergy();
  }
  if (!player.game.projectDeck.canDraw(1)) {
    return actionReason.deckEmpty();
  }
  return undefined;
}

/** `card` is the ACTIVE card whose action this is (Hi-Tech Lab / Tycho
 *  Magnetics) — the keep-1 pick names it as its source, so the console can
 *  anchor the draw-and-choose flow on the card the player just activated. */
export function spendEnergyForCards(player: IPlayer, card: ICard) {
  const max = Math.min(player.energy, player.game.projectDeck.size());
  return new SelectAmount('Select amount of energy to spend', 'OK', 1, max, false, {
    icon: 'energy', result: {icon: 'cards', perUnit: 1, label: 'Cards drawn'},
  })
    .andThen((amount) => {
      player.stock.deduct(Resource.ENERGY, amount);
      player.game.log('${0} spent ${1} energy', (b) => b.player(player).number(amount));
      if (amount === 1) {
        player.drawCard();
        return undefined;
      }
      player.drawCardKeepSome(amount, {keepMax: 1, promptSource: cardSource(card)});
      return undefined;
    });
}
