import {IPlayer} from '../IPlayer';
import {Tag} from '../../common/cards/Tag';
import {IProjectCard} from '../cards/IProjectCard';
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {CardResource} from '../../common/CardResource';
import {CardType} from '../../common/cards/CardType';
import {ChooseCards, ChooseOptions, LogType, keep} from './ChooseCards';
import {CardDrawRevealSource} from '../../common/models/CardDrawRevealModel';

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
      // through their own SelectCard and never reach here.
      player.enqueueCardDrawReveal(cards, options?.source);
    });
  }

  public static keepSome(player: IPlayer, count: number = 1, options: AllOptions): DrawCards {
    return new DrawCards(player, count, options).andThen((cards) => player.game.defer(new ChooseCards(player, cards, options)));
  }
}
