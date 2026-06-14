import {ChoiceContext} from '../../common/models/PlayerInputModel';
import {CardType} from '../../common/cards/CardType';
import {CardName} from '../../common/cards/CardName';
import {Message} from '../../common/logs/Message';
import {ICard} from '../cards/ICard';

/**
 * Factory helpers for the OPTIONAL `ChoiceContext` attached to a top-level choice
 * prompt (see `BasePlayerInput.markChoiceContext`). They keep card code terse and
 * CO-LOCATED: a card describes WHO asks (`this`) and WHY (the trigger) and the
 * helper produces the structured context the premium client (ContextualChoiceContent)
 * renders as a contextual modal — source-card preview + trigger line + rich options.
 *
 * Everything is optional + backward-compatible: a prompt without it renders via
 * the existing ModernOptionPicker.
 *
 * The `trigger` string is an English i18n key (translated client-side); add new
 * keys to `src/locales/<lang>/ui.json`.
 */

/**
 * A choice produced by a CARD or CORPORATION (the common case). The source kind
 * is derived from the card's type, so a corporation reads "Корпорация" and a
 * project/active card reads "Карта". `trigger` explains why the choice appeared
 * (e.g. "A science tag was played."); `mode` tunes the kicker/accent.
 */
export function cardEffect(card: ICard, trigger?: string | Message, mode: ChoiceContext['mode'] = 'optional-effect'): ChoiceContext {
  return {
    source: {
      kind: card.type === CardType.CORPORATION ? 'corporation' : 'card',
      card: card.name,
    },
    trigger,
    mode,
  };
}

/** A choice produced by a card/corp that targets an OPPONENT (steal / remove). */
export function attackEffect(card: ICard, trigger?: string | Message): ChoiceContext {
  return cardEffect(card, trigger, 'attack');
}

/** A choice that picks between two real effects of a card (no skip). */
export function effectChoice(card: ICard, trigger?: string | Message): ChoiceContext {
  return cardEffect(card, trigger, 'effect-choice');
}

/**
 * A choice produced by a non-card source (a colony bonus, a standard project, or
 * a game-system rule) — no source card to preview, only the kind chip + trigger.
 */
export function systemChoice(kind: 'standardProject' | 'colony' | 'system', trigger?: string | Message, mode?: ChoiceContext['mode']): ChoiceContext {
  return {source: {kind}, trigger, mode};
}

/** A choice produced by a specific named card the caller knows by name (when the
 *  ICard instance isn't on hand, e.g. inside a shared deferred action). */
export function namedCardEffect(card: CardName, isCorporation: boolean, trigger?: string | Message, mode: ChoiceContext['mode'] = 'optional-effect'): ChoiceContext {
  return {source: {kind: isCorporation ? 'corporation' : 'card', card}, trigger, mode};
}
