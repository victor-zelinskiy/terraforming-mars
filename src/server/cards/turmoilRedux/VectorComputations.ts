import {ICard, IActionCard} from '../ICard';
import {IPlayer} from '../../IPlayer';
import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {CardResource} from '../../../common/CardResource';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {ActionCard} from '../ActionCard';
import {digit} from '../Options';
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import * as actionPreviews from '../actionPreviews';
import * as forecast from '../effectForecastPreviews';

/** The printed «add 2 data» of the effect — per science tag played. */
export const DATA_PER_SCIENCE_TAG = 2;

/**
 * TR05 — VECTOR COMPUTATIONS («Векторные вычисления»), the sixth Turmoil Redux
 * PROJECT card.
 *
 * An EFFECT on the card-played channel — «whenever you play a Science tag
 * (including this), add 2 data resources to this card» — and a declarative
 * ACTION: spend 4 data from here to draw a Space card (the deck is discarded
 * down to the first one). The first card of the set with a CARD-PLAYED
 * trigger, so the first to owe the forecast twin (`cardPlayedForecast`,
 * guarded by `effectForecastCoverage` / `effectForecastParity`); the second
 * data holder after TR02.
 *
 * SCAN READING — the corner holds TWO tags, Science (the atom) and Space (the
 * yellow star on black — not Energy). The orange MIN box beside the cost is
 * EMPTY: no requirement. No VP badge. The effect row prints TWO data icons,
 * the action row «4 [data]» as a digit. The purple Turmoil symbol at the bottom
 * left means «needs the political engine» — for a card of THIS manifest that
 * is the module itself (no `compatibility`, see TR02).
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/VectorComputations.spec.ts):
 *  1. The trigger counts EVERY science tag of the played card —
 *     `player.tags.cardTagCount(card, Tag.SCIENCE)`, exactly as Olympus
 *     Conference and Mars University: two science tags pay 4. A WILD tag is
 *     never a science tag here (the upstream reading of both); a Mars tag
 *     under Habitat Marte is (inside `cardTagCount`). A played EVENT with a
 *     science tag counts — a play is a play.
 *  2. «Including this» comes for free: `Player.playCard` puts the card into
 *     `playedCards` BEFORE the `onCardPlayed` fan-out, so this card answers
 *     its own play with 2 data. The forecast engine walks the played card as
 *     a reactor of its own play the same way.
 *  3. A science tag NOT from a card (Leavitt, a colony) arrives through
 *     `onNonCardTagAdded` — 2 data per tag, the Olympus mirror.
 *  4. The collection goes through `addResourceTo` (the recorder, the log, the
 *     quest tracker) under the engine's own `events.withEffect` scope — never a
 *     `defer` (nothing is asked) and never `resourceCount +=`.
 *  5. The action is declarative (`spend.resourcesHere` + `drawCard.tag`): below
 *     4 data the automatic reason is «Not enough resources on this card»; an
 *     empty deck is the automatic «The deck is empty».
 *  6. The filtered draw is the engine's: `DrawCards` discards every non-Space
 *     card until one matches (`Deck.drawByConditionOrThrow` — the «Discarded N
 *     cards» log line, the reveal SEQUENCE the console's discard tray replays).
 *     A deck with no Space card at all is searched through and the action ends
 *     with nothing drawn — never an exception.
 *  7. Data here are ORDINARY data: the Scientists' action, Medical Database and
 *     TR01 put data here; nothing but the card's own action spends them, and
 *     data are never a payment unit.
 */
export class VectorComputations extends ActionCard implements IActionCard {
  constructor() {
    super({
      name: CardName.VECTOR_COMPUTATIONS,
      type: CardType.ACTIVE,
      tags: [Tag.SCIENCE, Tag.SPACE],
      cost: 6,
      resourceType: CardResource.DATA,

      action: {
        spend: {resourcesHere: 4},
        drawCard: {count: 1, tag: Tag.SPACE},
      },

      metadata: {
        cardNumber: 'TR05',
        infoText: [
          {kind: 'effect-short', text: 'Science tag: +2 data here'},
          // The rule reads 44 characters in English, but ~75 in Russian — past the clamp on every profile.
          {kind: 'action-short', text: 'Spend 4 data to draw a Space card'},
        ],
        renderData: CardRenderer.builder((b) => {
          b.effect('Whenever you play a Science tag (including this), add 2 data resources to this card.', (eb) => {
            eb.tag(Tag.SCIENCE).startEffect.resource(CardResource.DATA, 2);
          }).br;
          b.action('Spend 4 data from here to draw a Space card.', (eb) => {
            eb.resource(CardResource.DATA, {amount: 4, digit}).startAction.cards(1, {secondaryTag: Tag.SPACE});
          });
        }),
      },
    });
  }

  public onCardPlayed(player: IPlayer, card: ICard): void {
    this.onScienceTagAdded(player, player.tags.cardTagCount(card, Tag.SCIENCE));
  }

  public onNonCardTagAdded(player: IPlayer, tag: Tag): void {
    if (tag === Tag.SCIENCE) {
      this.onScienceTagAdded(player, 1);
    }
  }

  /** Rules 1–4: 2 data per science tag, at once, through the recorder. */
  private onScienceTagAdded(player: IPlayer, count: number): void {
    if (count > 0) {
      player.addResourceTo(this, {qty: DATA_PER_SCIENCE_TAG * count, log: true});
    }
  }

  /**
   * Mirrors `onCardPlayed`: an EXACT, immediate gain — 2 data per science tag
   * of the played card, read by the SAME `cardTagCount` («including this»: the
   * engine offers this card its own play). Nothing is asked, nothing deferred.
   */
  public cardPlayedForecast(cardOwner: IPlayer, _activePlayer: IPlayer, card: ICard): ReadonlyArray<EffectForecastFact> {
    const scienceTags = cardOwner.tags.cardTagCount(card, Tag.SCIENCE);
    if (scienceTags === 0) {
      return [];
    }
    return [forecast.exact(forecast.sourceOf(this, cardOwner, 'card-played'),
      [actionPreviews.cardGain(this, DATA_PER_SCIENCE_TAG * scienceTags)],
      forecast.tagReason(Tag.SCIENCE),
      {id: 'science', reasonTag: Tag.SCIENCE})];
  }
}
