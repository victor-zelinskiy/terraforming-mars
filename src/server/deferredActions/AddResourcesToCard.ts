import {IPlayer} from '../IPlayer';
import {SelectCard} from '../inputs/SelectCard';
import {SelectCardModel} from '../../common/models/PlayerInputModel';
import {CardResource} from '../../common/CardResource';
import {ICard} from '../cards/ICard';
import {Tag} from '../../common/cards/Tag';
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {Message} from '../../common/logs/Message';
import {message} from '../logs/MessageBuilder';

export type Options = {
  count?: number;
  restrictedTag?: Tag;
  // TODO(kberg): replace min with filter.
  min?: number;
  title?: string | Message;
  robotCards?: boolean;
  filter?(card: ICard): boolean;
  log?: boolean;
  /**
   * When `false`, NEVER apply silently even if only ONE card matches — always
   * present the pick so the player explicitly confirms WHERE the resource goes
   * (rather than it happening behind the board). The "add to ANY card"
   * behavior (`addResourcesToAnyCard`) passes `false`, because that is a real
   * board-wide choice. Left `undefined` (or `true`) by bespoke callers that
   * target a FIXED card (e.g. Ants → itself, via `filter`), which keeps the
   * instant apply on a single match.
   */
  autoSelect?: boolean;
}

export class AddResourcesToCard extends DeferredAction {
  constructor(
    player: IPlayer,
    /** The card type to add to. Undefined means any resource. */
    public resourceType: CardResource | undefined,
    public options: Options = {},
  ) {
    super(player, Priority.GAIN_RESOURCE_OR_PRODUCTION);
  }

  public getCards(): Array<ICard> {
    const playedCards = this.player.getResourceCards(this.resourceType);
    const srrCards = this.player.getSelfReplicatingRobotsTargetCards().filter((card) => {
      return this.resourceType === undefined || card.resourceType === this.resourceType;
    });

    let cards = playedCards;
    if (this.options.robotCards === true) {
      cards = cards.concat(srrCards);
    }
    const restrictedTag = this.options.restrictedTag;
    if (restrictedTag !== undefined) {
      cards = cards.filter((card) => {
        return card.tags.includes(restrictedTag) || card.tags.includes(Tag.WILD);
      });
    }
    if (this.options.filter !== undefined) {
      cards = cards.filter(this.options.filter);
    }
    const min = this.options.min;
    if (min) {
      cards = cards.filter((c) => c.resourceCount >= min);
    }
    return cards;
  }

  public execute() {
    const cards = this.getCards();
    if (cards.length === 0) {
      return undefined;
    }

    const qty = this.options.count ?? 1;

    // Apply instantly on a single match ONLY when the caller allows it
    // (default). The "add to ANY card" behavior passes autoSelect:false so the
    // player ALWAYS confirms WHERE the resource goes — even with one candidate —
    // instead of it being applied silently behind the board.
    if (cards.length === 1 && this.options.autoSelect !== false) {
      this.addResource(cards[0], qty);
      return undefined;
    }

    return this.buildSelectCard(cards)
      .andThen(([card]) => {
        this.addResource(card, qty);
        return undefined;
      });
  }

  /**
   * Build the `SelectCard` the live path presents (shared with the read-only
   * preview so the two never drift). A forced single pick (one candidate, but
   * autoSelect disabled) reads as a CONFIRMATION ("add here"), not a choice
   * ("select a card …"). Plain string keys (no resource/number token) so the
   * Russian text stays correct — the resource type + count are clear from the
   * shown card + the button.
   */
  private buildSelectCard(cards: ReadonlyArray<ICard>): SelectCard<ICard> {
    const qty = this.options.count ?? 1;
    const single = cards.length === 1;
    const buttonLabel = qty === 1 ? 'Add resource' : 'Add resources';
    const title: string | Message = this.options.title ?? (single ?
      (qty === 1 ? 'Add resource to this card' : 'Add resources to this card') :
      message('Select card to add ${0} ${1}', (b) => b.number(qty).string(this.resourceType || 'resources')));
    return new SelectCard(title, buttonLabel, cards);
  }

  /**
   * READ-ONLY: the `SelectCardModel` the live path WOULD present, or `undefined`
   * when the resource auto-applies (single candidate + autoSelect not false) or
   * there are no candidate cards. Used by the action-preview builder to host the
   * card-target picker INSIDE the confirmation modal — no mutation.
   */
  public previewSelectCard(): SelectCardModel | undefined {
    const cards = this.getCards();
    if (cards.length === 0) {
      return undefined;
    }
    if (cards.length === 1 && this.options.autoSelect !== false) {
      return undefined;
    }
    return this.buildSelectCard(cards).toModel(this.player);
  }

  private addResource(card: ICard, qty: number) {
    const autoLog = this.options.log !== false;
    this.player.addResourceTo(card, {qty, log: autoLog});
    this.cb(undefined);
  }
}
