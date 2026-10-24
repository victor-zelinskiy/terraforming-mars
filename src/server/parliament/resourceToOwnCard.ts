/*
 * «PUT A RESOURCE ON ONE OF YOUR CARDS — THE KIND IS A BRANCH» (Turmoil
 * Redux): the ONE prompt two members of the parliament's action family ask —
 * the Scientists' party action («2 data or 2 microbes onto one of your cards»)
 * and Manufacturing Run's law (RX37: «2 floaters or 1 fighter or 1 mech onto
 * any card»). The same shape, the same console form (the composer's «РЕСУРС»
 * row, then «КАРТА-ЦЕЛЬ»), the same response — only the kinds, the amounts,
 * the marker and the source differ, so they are handed in.
 *
 * THE READING (decision Р2 of RX37): the kind is a BRANCH, never a property
 * of the card. The printed «OR» is a variant choice and the amounts differ by
 * kind (2 floaters but 1 fighter), so «the kind follows from the card»
 * (Medical Database's distributed shape, RX18) would answer a question the
 * card asks. One `OrOptions` over the kinds that have a holder (a kind with
 * none is not offered — the gate names the empty case), each branch a
 * `SelectCard` over that kind's holders, ONE card, always shown — even a
 * single holder (no auto-select: the player sees which card is hit and its
 * `current → resulting` before the press).
 *
 * THE COMMIT CONTRACT is the caller's: building changes nothing; the answer
 * is the commit, run by the caller's own funnel (`runPartyAction` /
 * `runResolutionAction`) inside `give`.
 */
import {CardResource} from '../../common/CardResource';
import {Message} from '../../common/logs/Message';
import {ActionEffect} from '../../common/models/ActionPreviewModel';
import {ChoiceContextSource, DisabledOptionModel} from '../../common/models/PlayerInputModel';
import {message} from '../logs/MessageBuilder';
import {IPlayer} from '../IPlayer';
import {BasePlayerInput} from '../PlayerInput';
import {OrOptions} from '../inputs/OrOptions';
import {SelectCard} from '../inputs/SelectCard';
import {InputError} from '../inputs/InputError';
import {ICard} from '../cards/ICard';
import {cardResourceIcon, targetVictoryPoints} from '../cards/actionPreviews';

/** One printed outcome: so many units of one kind, onto one card. */
export type ResourceYield = {resource: CardResource, amount: number};

export type ResourceToOwnCardOptions = {
  /** The `OrOptions`' title (journal text only — the console reads the markers). */
  title: string | Message;
  buttonLabel: string;
  /** Stamps the family's structural marker (`markPartyActionPrompt` / `markResolutionActionPrompt`) on every prompt built. */
  mark: (input: BasePlayerInput<any>) => unknown;
  /** Who asks (`markChoiceContext`). */
  source: ChoiceContextSource;
  trigger: string;
  /** The input error when no kind has a holder (the gate refuses first; this is the belt to its braces). */
  noHolder: string;
  /** THE COMMIT — the caller's funnel around `addResourceTo`. */
  give: (card: ICard, outcome: ResourceYield) => void;
};

/** The kinds of `yields` that have at least one holder in `player`'s tableau, in the printed order. */
export function yieldsWithHolders(player: IPlayer, yields: ReadonlyArray<ResourceYield>): Array<ResourceYield> {
  return yields.filter((y) => player.getResourceCards(y.resource).length > 0);
}

export function resourceToOwnCardChoice(player: IPlayer, yields: ReadonlyArray<ResourceYield>, opts: ResourceToOwnCardOptions): OrOptions {
  const options = new OrOptions()
    .setTitle(opts.title)
    .setButtonLabel(opts.buttonLabel);
  opts.mark(options);
  options.markChoiceContext({source: opts.source, trigger: opts.trigger, mode: 'effect-choice'});
  // A kind no card of the seat can hold is SHOWN, disabled with its reason (never hidden) — display only, the
  // live options keep their runtime indices.
  const refused: Array<DisabledOptionModel> = [];
  for (const outcome of yields) {
    const cards = player.getResourceCards(outcome.resource);
    if (cards.length === 0) {
      refused.push({
        title: message('Add ${0} ${1} to a card', (b) => b.number(outcome.amount).string(outcome.resource)),
        reason: message('No card of yours can hold ${0}', (b) => b.string(outcome.resource)),
      });
      continue;
    }
    const pick = new SelectCard(
      message('Add ${0} ${1} to a card', (b) => b.number(outcome.amount).string(outcome.resource)),
      'Add',
      cards,
      {min: 1, max: 1})
      .markResourceGainPrompt({
        amount: outcome.amount,
        cardResource: cardResourceIcon(outcome.resource),
        vpBox: targetVictoryPoints(player, cards, outcome.amount),
      });
    opts.mark(pick);
    pick.andThen(([card]) => {
      opts.give(card, outcome);
      return undefined;
    });
    options.options.push(pick);
  }
  if (options.options.length === 0) {
    throw new InputError(opts.noHolder);
  }
  return options.setDisabledOptions(refused);
}

/**
 * The result chips of the action tile — one per kind, «+N [kind] · to a card». Without a seat (the manifest, a
 * stand) every printed kind; with one, only the kinds the seat can hold (none at all → the printed rate, so the
 * blocked tile still reads what the action would do).
 */
export function resourceToOwnCardPreview(yields: ReadonlyArray<ResourceYield>, player?: IPlayer): Array<ActionEffect> {
  const held = player === undefined ? [] : yieldsWithHolders(player, yields);
  const shown = held.length > 0 ? held : yields;
  return shown.map((y) => ({direction: 'gain', icon: cardResourceIcon(y.resource), amount: y.amount, note: 'to a card'}));
}
