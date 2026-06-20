import {IPlayer} from '../IPlayer';
import {Tag} from '../../common/cards/Tag';
import {IProjectCard} from '../cards/IProjectCard';
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {CardResource} from '../../common/CardResource';
import {CardType} from '../../common/cards/CardType';
import {ChooseCards, ChooseOptions, LogType, keep} from './ChooseCards';
import {CardDrawRevealSource} from '../../common/models/CardDrawRevealModel';

/**
 * Best-effort attribution for the "you drew cards" reveal modal when the caller
 * didn't pass an explicit `source`: derive it from the ACTIVE analytics scope
 * (the card / corporation / standard-project / colony whose action or effect is
 * running right now). This is the SAME context `recordCardsDrawn` resolves the
 * draw against, so a card-action draw (Mars University, Factorum, Olympus
 * Conference, …) — and any future one — names its source with no per-call-site
 * change. An explicit `options.source` always wins; no scope → generic text.
 */
function revealSourceFromContext(player: IPlayer): CardDrawRevealSource | undefined {
  const source = player.game?.events?.captureContext()?.source;
  if (source === undefined) {
    return undefined;
  }
  switch (source.kind) {
  case 'card':
  case 'corporation':
  case 'standardProject':
    return {type: 'card', cardName: source.card};
  case 'colony':
    return {type: 'colony', colonyName: source.name};
  default:
    return undefined;
  }
}

export type DrawOptions = {
  tag?: Tag,
  resource?: CardResource,
  cardType?: CardType,
  include?(card: IProjectCard): boolean,
  /**
   * Attribution for the "you drew cards" reveal modal, when cheaply known
   * (e.g. the behavior executor passes the card being played; tile bonuses
   * pass {type:'tile'}). Omitted → generic "you received N cards" text.
   */
  source?: CardDrawRevealSource,
}

export type AllOptions = DrawOptions & ChooseOptions;

export class DrawCards extends DeferredAction<ReadonlyArray<IProjectCard>> {
  // Visible for tests.
  public constructor(
    player: IPlayer,
    public count: number = 1,
    public options: AllOptions = {},
  ) {
    super(player, Priority.DRAW_CARDS);
  }

  public execute(): undefined {
    this.player.game.resettable = false;
    const game = this.player.game;
    const cards = game.projectDeck.drawByConditionLegacy(game, this.count, (card) => {
      if (this.options.resource !== undefined && this.options.resource !== card.resourceType) {
        return false;
      }
      if (this.options.cardType !== undefined && this.options.cardType !== card.type) {
        return false;
      }
      if (this.options.tag !== undefined && !this.player.tags.cardHasTag(card, this.options.tag)) {
        return false;
      }
      if (this.options.include !== undefined && !this.options.include(card)) {
        return false;
      }
      return true;
    });

    this.cb(cards);
    return undefined;
  }

  public static keepAll(player: IPlayer, count: number = 1, options?: DrawOptions): DrawCards {
    return new DrawCards(player, count, options).andThen((cards) => {
      let verbosity: LogType = LogType.DREW;
      if (options !== undefined) {
        if (options.tag !== undefined ||
          options.resource !== undefined ||
          options.cardType !== undefined ||
          options.include !== undefined) {
          verbosity = LogType.DREW_VERBOSE;
        }
      }
      keep(player, cards, [], verbosity);
      // Analytics: attribute the draw to the active effect/action (the source
      // is resolved from the correlation context, e.g. Mars University).
      player.game?.events?.recordCardsDrawn(player, cards.length);
      // This is exactly the "effect draws and keeps every card" path — the
      // player never sees a selection prompt, so surface the cards in the
      // reveal modal. keepSome / ChooseCards (research / buy / keep-some) go
      // through their own SelectCard and never reach here. The source is the
      // caller's explicit one, else the active scope's card/colony — so the
      // modal ALWAYS names where the draw came from when it's known.
      player.enqueueCardDrawReveal(cards, options?.source ?? revealSourceFromContext(player));
    });
  }

  public static keepSome(player: IPlayer, count: number = 1, options: AllOptions): DrawCards {
    return new DrawCards(player, count, options).andThen((cards) => player.game.defer(new ChooseCards(player, cards, options)));
  }
}
