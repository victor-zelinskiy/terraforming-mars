import {corpOwningBonusCard} from '../../common/automa/MarsBotCorpData';
import {bonusSideCap, dynamicBalanceOn} from '../../common/automa/DynamicBalance';
import {IGame} from '../IGame';
import {inplaceShuffle} from '../utils/shuffle';
import {AutomaActionCard, AutomaState} from './AutomaState';

/**
 * «ДИНАМИЧЕСКИЙ БАЛАНС», the EARLY half on the server (`common/automa/DynamicBalance.ts`):
 * the bonus side of a generation's action deck — the top card of the bonus deck
 * plus the recurring cards — under the switch's schedule. A shuffle picks which
 * cards come in; the rest wait:
 *  · the top card of the bonus deck goes back ON TOP of the bonus deck (it comes
 *    in with the next generation's deck — never discarded, never destroyed);
 *  · a recurring card simply sits this generation out (it stays recurring);
 *  · a card the bot's CORPORATION owns (Ecoline's B23) is the corporation's own
 *    mechanic, never part of the chance — always in, outside the count.
 * Silent: no journal line, no stat (hidden balance). Off, or from the 4th
 * generation on: the whole side, exactly as the rulebook builds it.
 */
export function composeBonusSide(game: IGame, state: AutomaState, top: AutomaActionCard | undefined, generation: number): Array<AutomaActionCard> {
  const recurring: Array<AutomaActionCard> = state.recurringBonusCards.map((id) => ({kind: 'bonus' as const, id}));
  const side = top !== undefined ? [top, ...recurring] : recurring;
  const cap = dynamicBalanceOn(game.gameOptions.automa) ? bonusSideCap(generation) : undefined;
  if (cap === undefined) {
    return side;
  }
  const owned = side.filter((e) => e.kind === 'bonus' && corpOwningBonusCard(e.id) !== undefined);
  const chance = side.filter((e) => !owned.includes(e));
  if (chance.length <= cap) {
    return side;
  }
  inplaceShuffle(chance, game.rng);
  const kept = chance.slice(0, cap);
  if (top !== undefined && !kept.includes(top)) {
    state.bonusDeck.unshift(top);
  }
  return [...kept, ...owned];
}
