import {CardModel} from './CardModel';
import {CardName} from '../cards/CardName';
import {ColonyName} from '../colonies/ColonyName';

/**
 * Where a batch of drawn cards came from, used to give the player a
 * contextual subtitle in the "cards received" reveal modal. Attributed where
 * cheaply known (the behavior executor knows the card being played; a colony
 * bonus tags itself; tile bonuses tag themselves); otherwise omitted → generic
 * text. A `card` / `colony` source renders as a HOVERABLE chip (mini-card
 * popover) + click-to-fullscreen for a card.
 */
export type CardDrawRevealSource =
  | {type: 'card', cardName: CardName}
  | {type: 'colony', colonyName: ColonyName}
  | {type: 'tile'}
  | {type: 'other'};

/**
 * One batch of cards a player drew via an in-game EFFECT (card effect, tile
 * bonus, …) — NOT via research / draft / buy / keep-some choices, which the
 * player already sees through their own selection prompt.
 *
 * Lives only on the owner's PlayerViewModel (next to cardsInHand), so it is
 * never sent to other players. The server queue that backs this is transient
 * (not serialized to the database) so stale reveals never resurface after a
 * refresh / reconnect.
 */
export type CardDrawRevealModel = {
  /** Monotonic id, unique within a player; the client acks by this id. */
  id: number;
  source?: CardDrawRevealSource;
  /** Serialized with the SAME options as cardsInHand so they render identically. */
  cards: ReadonlyArray<CardModel>;
};
