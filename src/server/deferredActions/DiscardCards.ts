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
  /**
   * A colony's printed «draw 1, then discard 1» paid by ANOTHER source (an
   * enacted resolution — Turmoil Redux, Colonial Affairs): the tile and the
   * repeat's position, without routing the colony resolution's own flow
   * (see `DiscardPromptMeta.colonyRepeat`).
   */
  colonyRepeat?: ColonyBonusDiscardMeta,
  /**
   * The CANDIDATES, when the rule narrows the discard to a part of the hand
   * (Strategic Shift — «cards with a requirement»): the prompt offers exactly
   * these; the auto-discard shortcut counts these, not the whole hand.
   * Omitted → the whole hand.
   */
  cards?: ReadonlyArray<IProjectCard>,
  /**
   * The REST of the hand, offered DISABLED with the reason the rule refuses
   * each one — shown, never silently absent (invariant 3 / 4).
   */
  disabled?: ReadonlyArray<{card: IProjectCard, reason: string | Message}>,
  /** Offer the console's «select all» (a multi discard the player may take whole — Strategic Shift). */
  showSelectAll?: boolean,
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
    const candidates = this.options.cards ?? this.player.cardsInHand;
    if (candidates.length <= this.min) {
      const discards = [...candidates];
      for (const card of discards) {
        this.player.discardCardFromHand(card);
      }
      // No question was asked — so a card the player was just SHOWN being drawn (Pluto's «draw 1, then discard 1»
      // on an empty hand) is named on its reveal as already gone, never offered to be taken (colony polish 1, К-5).
      this.player.noteRevealAutoDiscard(discards);
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
      candidates,
      {min: this.min, max: this.max, disabled: this.options.disabled, showSelectAll: this.options.showSelectAll === true});
    // EVERY prompt this action builds is a discard — the client must never have
    // to tell it apart from a "reveal a card" / "keep a card" pick by its title.
    select.markDiscardPrompt({
      min: this.min,
      max: this.max,
      source: this.options.source ?? {kind: 'system'},
      exchange: this.options.exchange,
      colonyBonus: this.options.colonyBonus,
      colonyRepeat: this.options.colonyRepeat,
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
