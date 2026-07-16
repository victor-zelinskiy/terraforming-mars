import {CardModel} from './CardModel';
import {CardName} from '../cards/CardName';
import {ColonyName} from '../colonies/ColonyName';
import {GlobalParameter} from '../GlobalParameter';

/**
 * Where a batch of drawn cards came from, used to give the player a
 * contextual subtitle in the "cards received" reveal modal. Attributed where
 * cheaply known (the behavior executor knows the card being played; a colony
 * bonus tags itself; tile bonuses tag themselves); otherwise omitted → generic
 * text. A `card` / `colony` source renders as a HOVERABLE chip (mini-card
 * popover) + click-to-fullscreen for a card.
 *
 * `globalParameter` is a scale-threshold reward (the Venus 8% "draw a card"
 * bonus — the only base global-parameter card draw). It names the scale so
 * the console can lift the card-bonus cover off that scale's marker (mirrors
 * how `tile` drives the board-cell lift cinematic).
 */
export type CardDrawRevealSource =
  | {type: 'card', cardName: CardName}
  | {type: 'colony', colonyName: ColonyName}
  | {type: 'tile'}
  | {type: 'globalParameter', parameter: GlobalParameter}
  | {type: 'other'};

/**
 * ONE card as the deck actually turned it over during a CONDITIONAL search
 * ("reveal cards until you find two with a space tag" — Acquired Space
 * Agency), in the SERVER's reveal order.
 *
 * `matched` = it satisfied the search condition and went to the player's
 * hand; otherwise the deck discarded it. The client replays exactly this
 * sequence — it never re-derives or re-sorts the order.
 *
 * These names are ALREADY public: `Deck.drawByConditionOrThrow` logs
 * «Discarded ${0} cards ${1}» to the shared game log, so surfacing them to
 * the drawing player leaks nothing (and this model is self-only anyway).
 */
export type CardDrawRevealStep = {
  /** Serialized with the SAME options as `cards` so it renders identically. */
  card: CardModel;
  matched: boolean;
};

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
  /**
   * The conditional search's reveal sequence, in server order.
   *
   * Present ONLY when the search actually DISCARDED at least one card — a
   * plain "draw N" (and a search whose every reveal matched) leaves it
   * undefined, which is exactly the "no discard tray, plain draw visuals"
   * case. So the ordinary draw carries no extra payload at all.
   *
   * The matched steps' cards are the same ones listed in `cards`.
   */
  sequence?: ReadonlyArray<CardDrawRevealStep>;
};
