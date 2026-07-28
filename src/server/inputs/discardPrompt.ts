import {ChoiceContextSource, ColonyBonusDiscardMeta, DiscardPromptMeta} from '../../common/models/PlayerInputModel';
import {CardType} from '../../common/cards/CardType';
import {ICard} from '../cards/ICard';

/**
 * Factory helpers for the {@link DiscardPromptMeta} marker attached to EVERY
 * "throw cards away" `SelectCard` (see `BasePlayerInput.markDiscardPrompt`).
 *
 * The console serves all discards through ONE flow — the hand overlay in
 * discard mode plus the card-leaves-the-hand animation — and it may not detect
 * a discard from the prompt's title or button label (i18n rewrites
 * `Message.message` in place, so an English match dies after the first render).
 * So the rule that demands the discard declares it structurally, CO-LOCATED
 * with the rule itself: when upstream changes the card, the marker is in the
 * same diff.
 *
 * Everything is backward compatible: an UNMARKED SelectCard over the hand still
 * renders as the plain hand-select pick — it just doesn't get the discard skin
 * or the animation.
 */

/** The `source` of a discard demanded by a card / corporation — for the call
 *  sites that build the marker through `DiscardCards`' options rather than
 *  attaching it to a bespoke `SelectCard` themselves. */
export function cardSource(card: ICard): ChoiceContextSource {
  return {
    kind: card.type === CardType.CORPORATION ? 'corporation' : 'card',
    card: card.name,
  };
}

/** The discard is demanded by a CARD or CORPORATION (the common case). */
export function cardDiscard(
  card: ICard,
  bounds: {min: number, max: number},
  extras?: {exchange?: DiscardPromptMeta['exchange']},
): DiscardPromptMeta {
  return {
    min: bounds.min,
    max: bounds.max,
    source: {
      kind: card.type === CardType.CORPORATION ? 'corporation' : 'card',
      card: card.name,
    },
    exchange: extras?.exchange,
  };
}

/** The discard is demanded by a COLONY (a trade bonus or a colony effect). */
export function colonyDiscard(
  bounds: {min: number, max: number},
  extras?: {colonyBonus?: ColonyBonusDiscardMeta},
): DiscardPromptMeta {
  return {
    min: bounds.min,
    max: bounds.max,
    source: {kind: 'colony'},
    colonyBonus: extras?.colonyBonus,
  };
}

/** The discard is demanded by a GAME RULE with no card to preview (a global
 *  event, a standard project, an engine-level cost). */
export function systemDiscard(
  bounds: {min: number, max: number},
  kind: ChoiceContextSource['kind'] = 'system',
): DiscardPromptMeta {
  return {min: bounds.min, max: bounds.max, source: {kind}};
}

/** `exchange` shorthand: the discard buys back N project cards (Mars
 *  University's science-tag effect, Ender's redraw). */
export function discardForCards(amount: number, perCard = false): DiscardPromptMeta['exchange'] {
  return {icon: 'cards', amount, perCard};
}

/** `exchange` shorthand: the discard pays M€ (Ceres Tech Market, Stefan). */
export function discardForMegacredits(amount: number, perCard = true): DiscardPromptMeta['exchange'] {
  return {icon: 'megacredits', amount, perCard};
}
