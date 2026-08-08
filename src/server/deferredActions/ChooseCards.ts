import {IPlayer} from '../IPlayer';
import {IProjectCard} from '../cards/IProjectCard';
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {SelectCard} from '../inputs/SelectCard';
import {SelectPaymentDeferred} from './SelectPaymentDeferred';
import {LogHelper} from '../LogHelper';
import {oneWayDifference} from '../../common/utils/utils';
import {message} from '../logs/MessageBuilder';
import {Message} from '../../common/logs/Message';
import {Aerotech} from '../cards/community/Aerotech';
import {CardName} from '../../common/cards/CardName';
import {ChoiceContextSource} from '../../common/models/PlayerInputModel';
import {deckPickPrompt} from '../inputs/deckPickPrompt';

export const LogType = {
  DREW: 'drew',
  BOUGHT: 'bought',
  DREW_VERBOSE: 'drew_verbose',
  BOUGHT_VERBOSE: 'bought_verbose',
} as const;
export type LogType = typeof LogType[keyof typeof LogType];

export type ChooseOptions = {
  keepMax?: number,
  logDrawnCard?: boolean,
  paying?: boolean,
  /** When true (and paying), log the bought cards publicly by name instead of just the count. */
  logBoughtCards?: boolean,
  /**
   * WHO turned these cards over — the console's source anchor and breadcrumb
   * subject for the pick. Co-located with the rule that builds the draw (the
   * behavior executor passes the card being played; a colony passes itself), so
   * an upstream change to that rule carries the attribution in the same diff.
   * Absent → the pick is presented without a source, which is honest for the
   * research phase and for an engine-level deal.
   */
  promptSource?: ChoiceContextSource,
  /**
   * WHERE the cards physically came from. Defaults to the project deck; the
   * pile-digging effects (Junk Ventures, Return to Abandoned Technology) say
   * `'discard'` so the console flies them off the right stack instead of
   * claiming the deck produced cards it never lost.
   */
  origin?: 'deck' | 'discard',
}

export class ChooseCards extends DeferredAction {
  public constructor(
    player: IPlayer,
    public cards: ReadonlyArray<IProjectCard>,
    public options: ChooseOptions = {},
  ) {
    super(player, Priority.DRAW_CARDS);
  }

  public execute() {
    const {options, cards, player} = this;

    let max = options.keepMax || cards.length;
    let msg: string | Message = message('Select ${0} card(s) to keep', (b) => b.number(max));
    if (options.paying) {
      const spendableMegacredits = this.player.spendableMegacredits();
      const affordableCards = Math.floor(spendableMegacredits / this.player.cardCost);
      max = Math.min(max, affordableCards);
      if (max === 0) {
        msg = 'You cannot afford any cards';
      } else if (max < this.cards.length) {
        // We're being offered more cards than we're able to buy
        // So we should be specific on maximum number of cards
        msg = message('Select up to ${0} card(s) to buy', (b) => b.number(max));
      } else {
        msg = 'Select card(s) to buy';
      }
    }

    const min = options.paying ? 0 : options.keepMax;

    const button = max === 0 ? 'Ok' : (options.paying ? 'Buy' : 'Select');
    // `buyMode` is the STRUCTURAL "this is a paying research buy" signal the
    // client reads (cost badge / total / M€ check / «КУПИТЬ»), replacing the old
    // `title.includes('buy')` sniff that broke once i18n rewrote the title.
    // Matches the previous title exactly: a "…to buy" title is built only when
    // paying AND at least one card is affordable (max === 0 → "You cannot afford
    // any cards", no buy UI).
    const buyMode = options.paying === true && max > 0;
    return new SelectCard(msg, button, cards, {max, min, played: !options.paying, buyMode})
      // THE STRUCTURAL "these are a temporary reveal" SIGNAL. Attached here and
      // nowhere else: every producer of this prompt in the game — the behavior
      // DSL's `drawCard: {count, keep|pay}`, the bespoke `drawCardKeepSome`
      // callers, the Leavitt colony, the Delta science stage, the discard-pile
      // diggers and the research buy — funnels through this one `execute()`, so
      // a card that starts drawing tomorrow is covered without touching it.
      // Bounds are copied off the config above (the paying branch narrows `max`
      // by affordability) so the marker can never disagree with its own input.
      .markDeckPickPrompt(deckPickPrompt({
        revealed: cards.length,
        // `?? 1` mirrors `SelectCard`'s own default for an omitted `min` — the
        // marker states what the input will actually enforce, not what was
        // passed to it.
        min: min ?? 1,
        max,
        origin: options.origin,
        mode: options.paying === true ? 'buy' : 'keep',
        source: options.promptSource,
      }))
      .andThen((selected) => {
        if (selected.length > max) {
          throw new Error('Selected too many cards');
        }
        const unselected = oneWayDifference(cards, selected);
        if (options.logDrawnCard === true) {
          LogHelper.logRevealedCards(player, cards);
        }
        const boughtLogType = options.logBoughtCards === true ? LogType.BOUGHT_VERBOSE : LogType.BOUGHT;
        if (options.paying && selected.length > 0) {
          const cost = selected.length * player.cardCost;
          player.game.defer(
            new SelectPaymentDeferred(
              player,
              cost,
              {title: message('Select how to spend ${0} M€ for ${1} cards', (b) => b.number(cost).number(selected.length))})
              .andThen(() => keep(player, selected, unselected, boughtLogType)));
        } else {
          keep(player, selected, unselected, options.paying ? boughtLogType : LogType.DREW);
        }
        return undefined;
      });
  }
}

/**
 * Adds `cards` to the player's hand, discards `discards` to the project deck, and logs the outcome per `logType`.
 */
export function keep(player: IPlayer, cards: ReadonlyArray<IProjectCard>, discards: ReadonlyArray<IProjectCard>, logType: LogType = LogType.DREW): void {
  player.cardsInHand.push(...cards);
  player.game.projectDeck.discard(...discards);

  switch (logType) {
  case LogType.DREW_VERBOSE:
    LogHelper.logDrawnCards(player, cards);
    break;
  case LogType.BOUGHT_VERBOSE:
    if (cards.length === 0) {
      player.game.log('${0} bought no cards', (b) => b.player(player));
    } else {
      player.game.log('${0} bought ${1}', (b) => b.player(player).cards(cards));
    }
    break;
  case LogType.DREW:
  case LogType.BOUGHT:
    player.game.log('${0} ${1} ${2} card(s)', (b) => b.player(player).string(logType).number(cards.length));
    if (logType === LogType.BOUGHT) {
      if (cards.length > 0) {
        player.game.log('You bought ${0}', (b) => b.cards(cards), {reservedFor: player});
      }
    } else {
      LogHelper.logDrawnCards(player, cards, /* privateMessage */ true);
    }
    break;
  }
  // Aerotech gains titanium per unbought card. Run its hook inside a passive-effect
  // scope (fork-only) so the Effects overlay attributes the titanium to Aerotech —
  // a raw stock.add carries no effect scope and would be missed by effectOverlayStats.
  // withEffect is lazy, so wrapping only when the corp is in play keeps behaviour identical.
  const aerotech = player.tableau.get(CardName.AEROTECH);
  const events = player.game?.events;
  if (aerotech !== undefined && events !== undefined) {
    events.withEffect(player, aerotech, 'cards-not-bought', () => Aerotech.onDrawCards(player, cards, discards));
  } else {
    Aerotech.onDrawCards(player, cards, discards);
  }
}
