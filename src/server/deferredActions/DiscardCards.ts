import {IPlayer} from '../IPlayer';
import {SelectCard} from '../inputs/SelectCard';
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {Message} from '../../common/logs/Message';
import {message} from '../logs/MessageBuilder';
import {IProjectCard} from '../cards/IProjectCard';
import {ColonyBonusDiscardMeta} from '../../common/models/PlayerInputModel';

export type DiscardCardsOptions = {
  /**
   * This discard is the closing half of a colony bonus ("draw N, then discard
   * N" — Pluto). Rides onto the prompt as a structural marker so the client can
   * present it inside the same payout the cards arrived in.
   */
  colonyBonus?: ColonyBonusDiscardMeta,
};

export class DiscardCards extends DeferredAction<ReadonlyArray<IProjectCard>> {
  constructor(
    player: IPlayer,
    public min: number = 1,
    public max: number = 1,
    public title?: string | Message,
    public options: DiscardCardsOptions = {},
  ) {
    super(player, Priority.DISCARD_CARDS);
  }

  public execute() {
    if (this.player.cardsInHand.length <= this.min) {
      const discards = [...this.player.cardsInHand];
      for (const card of discards) {
        this.player.discardCardFromHand(card);
      }
      this.cb(discards);
      return undefined;
    }

    let title: string | Message | undefined = this.title;
    if (title === undefined) {
      if (this.min === this.max) {
        if (this.min === 1) {
          title = 'Select 1 card to discard';
        } else {
          title = message('Select ${0} cards to discard', (b) => b.number(this.min));
        }
      } else {
        title = message('Select between ${0} and ${1} cards to discard', (b) => b.number(this.min).number(this.max));
      }
    }
    const select = new SelectCard(
      title,
      'Discard',
      this.player.cardsInHand,
      {min: this.min, max: this.max});
    if (this.options.colonyBonus !== undefined) {
      select.markColonyBonusDiscard(this.options.colonyBonus);
    }
    return select
      .andThen((discards) => {
        for (const card of discards) {
          this.player.discardCardFromHand(card);
        }
        this.cb(discards);
        return undefined;
      });
  }
}
