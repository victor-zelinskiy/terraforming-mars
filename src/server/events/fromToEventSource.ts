import {From, isFromPlayer} from '../logs/From';
import {EventSource} from '../../common/events/EventSource';
import {CardType} from '../../common/cards/CardType';
import {Color} from '../../common/Color';

/**
 * Projects the runtime `From` (object refs) into the serializable
 * {@link EventSource}. A player-only `From` returns undefined: a bare player is
 * not an analytics "engine" — the caller attributes via the active action
 * context instead. A card `From` is classified corporation-vs-card by its type
 * and tagged with `owner` (the live `From` carries only the card NAME).
 */
export function fromToEventSource(from: From | undefined, owner?: Color): EventSource | undefined {
  if (from === undefined) {
    return undefined;
  }
  if (isFromPlayer(from)) {
    return undefined;
  }
  if ('card' in from) {
    if (typeof from.card === 'object') {
      const kind = from.card.type === CardType.CORPORATION ? 'corporation' : 'card';
      return {kind, card: from.card.name, owner};
    }
    return {kind: 'card', card: from.card, owner};
  }
  if ('globalEvent' in from) {
    const name = typeof from.globalEvent === 'object' ? from.globalEvent.name : from.globalEvent;
    return {kind: 'globalEvent', name};
  }
  if ('party' in from) {
    return {kind: 'party', name: from.party.name};
  }
  if ('partyName' in from) {
    return {kind: 'party', name: from.partyName};
  }
  return undefined;
}
