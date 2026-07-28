import {IPlayer} from '../IPlayer';
import {SelectCard} from '../inputs/SelectCard';
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {Message} from '../../common/logs/Message';
import {message} from '../logs/MessageBuilder';
import {IProjectCard} from '../cards/IProjectCard';
import {ChoiceContextSource, ColonyBonusDiscardMeta, DiscardPromptMeta} from '../../common/models/PlayerInputModel';

export type DiscardCardsOptions = {
  /**
   * WHO demands the discard — a card, a colony, a global event, the engine.
   * Rides onto the prompt inside the `discardPrompt` marker so the console's
   * unified discard flow can name the source instead of asking the player to
   * infer it. Defaults to the anonymous `system` source.
   */
  source?: ChoiceContextSource,
  /**
   * What the discard BUYS when it is an exchange rather than a pure loss
   * (Ender's redraw, Sponsored Academies' three cards).
   */
  exchange?: DiscardPromptMeta['exchange'],
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
    // EVERY prompt this action builds is a discard — the client must never have
    // to tell it apart from a "reveal a card" / "keep a card" pick by its title.
    select.markDiscardPrompt({
      min: this.min,
      max: this.max,
      source: this.options.source ?? {kind: 'system'},
      exchange: this.options.exchange,
      colonyBonus: this.options.colonyBonus,
    });
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
