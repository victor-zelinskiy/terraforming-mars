import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {SelectCard} from '../../inputs/SelectCard';
import {isSpecialTile} from '../../boards/Board';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as actionPreviews from '../actionPreviews';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import * as reason from '../actionReasons';

export class AstraMechanica extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.AUTOMATED,
      name: CardName.ASTRA_MECHANICA,
      tags: [Tag.SCIENCE],
      cost: 7,

      metadata: {
        cardNumber: 'X51',
        renderData: CardRenderer.builder((b) => {
          b.cards(2, {secondaryTag: Tag.EVENT}).asterix();
        }),
        description: 'RETURN UP TO 2 OF YOUR PLAYED EVENT CARDS TO YOUR HAND. THEY MAY NOT BE CARDS THAT PLACE SPECIAL TILES.',
      },
    });
  }

  private static UNUSABLE_CARDS = [
    CardName.PATENT_MANIPULATION,
    CardName.RETURN_TO_ABANDONED_TECHNOLOGY,
    CardName.HOSTILE_TAKEOVER,
  ];

  private getCards(player: IPlayer): ReadonlyArray<IProjectCard> {
    return player.playedCards.projects().filter((card) => {
      if (card.type !== CardType.EVENT) {
        return false;
      }
      if (AstraMechanica.UNUSABLE_CARDS.includes(card.name)) {
        return false;
      }
      if (card.tilesBuilt.some(isSpecialTile)) {
        return false;
      }
      return true;
    });
  }

  private hasUnusableCards(player: IPlayer): boolean {
    return AstraMechanica.UNUSABLE_CARDS.some((cardName) => player.playedCards.get(cardName) !== undefined);
  }

  public override bespokeCanPlay(player: IPlayer) {
    if (this.hasUnusableCards(player)) {
      this.warnings.add('unusableEventsForAstraMechanica');
    }
    return this.getCards(player).length > 0;
  }

  public unplayableReason(player: IPlayer): UnplayableReason | undefined {
    if (this.getCards(player).length === 0) {
      return reason.targetReason('No returnable event card in play');
    }
    return undefined;
  }

  public override bespokePlay(player: IPlayer) {
    const events = this.getCards(player);
    if (events.length === 0) {
      player.game.log('${0} had no events', (b) => b.player(player));
      return undefined;
    }
    return new SelectCard(
      'Select up to 2 events to return to your hand',
      'Select',
      events,
      {max: 2, min: 0})
      .andThen(
        (cards) => {
          for (const card of cards) {
            player.playedCards.remove(card);
            player.cardsInHand.push(card);
            card.onDiscard?.(player);
            player.game.log('${0} returned ${1} to their hand', (b) => b.player(player).card(card));
          }
          return undefined;
        });
  }

  // PRE-COLLECT the "return UP TO 2 events" choice IN the play modal. The live
  // play is a SINGLE SelectCard, so the modal shows up to TWO SLOTS (each a single
  // board pick over the played EVENT cards, the second de-duped against the first)
  // and `mergeCardSteps` merges the filled slots into ONE `{type:'card', cards:[...]}`
  // response on confirm. `min: 0` — the rules allow returning NOTHING, so the CTA
  // stays enabled with no slot filled; the `emptyWarning` confirm popup makes an
  // empty submit a conscious choice rather than a misclick. Only emit a second slot
  // when ≥2 events exist. The RESULT chip shows how many cards go back to hand.
  // Built read-only (no mutation).
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const events = this.getCards(player);
    const steps = [
      actionPreviews.selectCardStep(player, 'Select first event to return to hand', 'Select', events),
    ];
    if (events.length > 1) {
      steps.push(actionPreviews.selectCardStep(player, 'Select second event to return to hand', 'Select', events, {dedupeFromSteps: [0]}));
    }
    return actionPreviews.playPreview(this, player, [], steps, {
      mergeCardSteps: {
        min: 0,
        emptyWarning: 'No events are selected. The card will be played, but no events will return to your hand.',
      },
    });
  }
}
