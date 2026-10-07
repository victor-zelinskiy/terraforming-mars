import {IPlayer} from '../IPlayer';
import {Tag} from '../../common/cards/Tag';
import {IProjectCard} from '../cards/IProjectCard';
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {CardResource} from '../../common/CardResource';
import {CardType} from '../../common/cards/CardType';
import {ChooseCards, ChooseOptions, LogType, keep} from './ChooseCards';
import {CardDrawRevealSource} from '../../common/models/CardDrawRevealModel';
import {RevealedCard} from '../IPlayer';
import {drawSearchOf, forbiddenTagsOn} from './drawSearch';
import {DrawSearchModel} from '../../common/models/CardDrawRevealModel';

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
  // Turmoil Redux: a party action (the Reds' recycle) names its party; the
  // enacted resolution's action (Open IP Trade) names the law.
  case 'party':
    return {type: 'party', party: source.name};
  case 'resolution':
    return {type: 'resolution', resolution: source.id};
  default:
    return undefined;
  }
}

export type DrawOptions = {
  tag?: Tag,
  resource?: CardResource,
  cardType?: CardType,
  /** Discard cards WITH any of these tags (`Behavior.DrawCard.withoutTags` — Red Tech Convention). */
  withoutTags?: ReadonlyArray<Tag>,
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
  /**
   * Every card this draw turned over, in the deck's real reveal order, with
   * the verdict that decided its fate. A CONDITIONAL search ("reveal until
   * you find two space tags") is the only case where this is more than the
   * kept cards — a plain "draw N" matches everything. Populated by
   * `execute()`; read by `keepAll`'s callback (which runs right after), so
   * the reveal can carry the honest sequence instead of just the result.
   */
  public readonly revealSequence: Array<RevealedCard> = [];
  /**
   * The search ran out of cards: the deck (and its reshuffled discard pile)
   * was turned over to the end and fewer than `count` cards matched. Set by
   * `execute()`, read by `keepAll` beside `revealSequence`.
   */
  public exhausted = false;

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
    this.revealSequence.length = 0;
    const withoutTags = this.options.withoutTags;
    const onReveal = (card: IProjectCard, matched: boolean) => {
      // The REASON a discard was thrown away, when it is a tag it carries —
      // read by the same function the verdict below used.
      const failedTags = matched ? [] : forbiddenTagsOn(this.player, card, withoutTags);
      this.revealSequence.push(failedTags.length > 0 ? {card, matched, failedTags} : {card, matched});
    };
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
      if (forbiddenTagsOn(this.player, card, withoutTags).length > 0) {
        return false;
      }
      if (this.options.include !== undefined && !this.options.include(card)) {
        return false;
      }
      return true;
    }, onReveal);
    this.exhausted = cards.length < this.count;

    this.cb(cards);
    return undefined;
  }

  /**
   * The rule this draw searches by (`DrawSearchModel`), or undefined for a
   * plain draw / an opaque `include` — the ONE descriptor the reveal, the
   * preview chip and the structured text share (`drawSearch.ts`).
   */
  public static searchOf(count: number, options: DrawOptions | undefined): DrawSearchModel | undefined {
    return drawSearchOf(count, options === undefined ? undefined : {
      tag: options.tag,
      type: options.cardType,
      resource: options.resource,
      withoutTags: options.withoutTags,
    });
  }

  public static keepAll(player: IPlayer, count: number = 1, options?: DrawOptions): DrawCards {
    const action = new DrawCards(player, count, options);
    const search = DrawCards.searchOf(count, options);
    return action.andThen((cards) => {
      // A filtered search reveals its cards — the kept ones are named in the
      // log like the discarded ones (`DREW_VERBOSE`).
      const verbosity: LogType = search !== undefined || options?.include !== undefined ? LogType.DREW_VERBOSE : LogType.DREW;
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
      //
      // The reveal SEQUENCE rides along so the client can replay the search
      // the deck actually performed (which card came up when, and whether it
      // was kept) instead of only seeing the result. `enqueueCardDrawReveal`
      // drops it when nothing was discarded — i.e. a plain draw carries none.
      //
      // A FILTERED search also carries its rule (`search`) and whether it ran
      // out of cards (`exhausted`) — the summary and the tray name both.
      player.enqueueCardDrawReveal(
        cards,
        options?.source ?? revealSourceFromContext(player),
        action.revealSequence,
        {search, exhausted: action.exhausted});
    });
  }

  public static keepSome(player: IPlayer, count: number = 1, options: AllOptions): DrawCards {
    return new DrawCards(player, count, options).andThen((cards) => player.game.defer(new ChooseCards(player, cards, options)));
  }
}
