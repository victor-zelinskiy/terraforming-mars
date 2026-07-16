import {IPlayer} from '../../IPlayer';
import {CardName} from '../../../common/cards/CardName';
import {PreludeCard} from './PreludeCard';
import {PlayProjectCard} from '../../deferredActions/PlayProjectCard';
import {CardRenderer} from '../render/CardRenderer';
import {Size} from '../../../common/cards/render/Size';
import {PreludesExpansion} from '../../preludes/PreludesExpansion';

/** M€ off the one card this prelude lets the player play. */
const ECCENTRIC_SPONSOR_DISCOUNT = 25;

export class EccentricSponsor extends PreludeCard {
  constructor() {
    super({
      name: CardName.ECCENTRIC_SPONSOR,

      metadata: {

        infoText: [

          {text: 'Play a card from hand, reducing its cost by 25 M€.', tokens: ['text']},

        ],
        cardNumber: 'P11',
        renderData: CardRenderer.builder((b) => {
          b.text('Play a card from hand, reducing its cost by 25 M€', Size.SMALL, true);
        }),
      },
    });
  }

  /**
   * Whether the player has anything to play with this card's 25 M€ off — i.e.
   * whether this prelude does anything at all right now. Answering it here is
   * what makes `selectPreludeToPlay` flag the card `preludeFizzle` (so the UI
   * warns before the player commits it) and settle it straight to
   * {@link PreludesExpansion.fizzle}'s 15 M€ instead of the empty round trip
   * through `bespokePlay`.
   *
   * The question is asked about the POST-PLAY state, because the discount is not
   * observable yet: `getCardDiscount` only grants it once this card sits in the
   * tableau AND `lastCardPlayed` names it. A hypothetical `extraDiscount` is the
   * WHOLE difference — playing a prelude costs nothing, this card carries no
   * tags (so it triggers nothing) and grants no resources.
   *
   * It runs through the REAL `getPlayableCards`, never a private copy of the
   * affordability rules: this answer can only be wrong in the safe direction. A
   * false "yes" costs nothing (`bespokePlay` still fizzles when the follow-up
   * finds no card), while a false "no" would silently rob the player of the
   * card — so anything undecidable must stay playable.
   */
  public override canPlay(player: IPlayer): boolean {
    const playable = player.getPlayableCards({extraDiscount: ECCENTRIC_SPONSOR_DISCOUNT}).length > 0;
    // `getPlayableCards` STAMPS warnings + additional costs onto every hand card
    // as it answers. Recompute them without the hypothesis so the live hand (it
    // is on screen during the prelude phase) never describes a discount that is
    // not active yet. Same function, so it restores exactly what it wrote.
    player.getPlayableCards();
    return playable;
  }

  public override getCardDiscount(player: IPlayer) {
    if (player.lastCardPlayed === this.name) {
      return ECCENTRIC_SPONSOR_DISCOUNT;
    }
    return 0;
  }

  public override bespokePlay(player: IPlayer) {
    player.game.defer(new PlayProjectCard(player))
      .andThen((card) => {
        if (card === undefined) {
          PreludesExpansion.fizzle(player, this);
          // If this card fizzles, don't apply the discount to the next card.
          player.lastCardPlayed = undefined;
        }
      });
    return undefined;
  }
}
