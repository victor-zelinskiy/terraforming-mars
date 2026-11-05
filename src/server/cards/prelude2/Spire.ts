import {CorporationCard} from '../corporation/CorporationCard';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {ICard} from '../ICard';
import {Tag} from '../../../common/cards/Tag';
import {digit} from '../Options';
import {SelectCard} from '../../inputs/SelectCard';
import {cardDiscard} from '../../inputs/discardPrompt';
import {CardResource} from '../../../common/CardResource';
import {ICorporationCard} from '../corporation/ICorporationCard';
import {message} from '../../logs/MessageBuilder';
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import * as actionPreviews from '../actionPreviews';
import * as forecast from '../effectForecastPreviews';

/** «Draw 4 cards» — the first action's draw. */
export const SPIRE_FIRST_ACTION_DRAW = 4;
/** «then discard 3 cards» — exactly three, from the WHOLE hand. */
export const SPIRE_FIRST_ACTION_DISCARD = 3;
/** «at least 2 tags» — the first effect row's threshold. */
export const SPIRE_TAG_THRESHOLD = 2;
/** The forecast's reason — one i18n key (RU in `effect_forecast.json`). */
export const SPIRE_TAGS_REASON = 'You play a card with at least 2 tags';

/**
 * PC05 — SPIRE, the fifth and last corporation of Prelude 2 to cross (upstream `cardNumber: 'PC05'` «// Renumber» —
 * kept: the art and the lore are keyed by it). The first corporation of the set with a FIRST ACTION that draws and then
 * asks, and the second (after Kuiper Cooperative's asteroids) whose resource pays a STANDARD PROJECT.
 *
 * SCAN READING — the CORPORATION frame; tags CITY · EARTH; the word mark: a black plate with a silver skyline whose
 * spire rises above the frame, a star and «SPIRE». At the left «50» M€ · «+4 [card]» · «−3 [card]» — «(You start with
 * 50 M€. As your first action, draw 4 cards, then discard 3 cards from hand.)». The EFFECT box, two rows:
 * «[blank tag][blank tag]* : [science resource]» and «[the Standard Project plate] : [science resource] = 2 M€» —
 * «(Effect: When you play a card with AT LEAST 2 tags, including this, add 1 science resource here. When you pay for a
 * standard project, science resources here may be used as 2 M€ each.)». The Prelude 2 mark at the left; no number.
 *
 * RULE READINGS (pinned by tests/cards/prelude2/Spire.spec.ts):
 *  1. START: 50 M€; tags CITY and EARTH. «Including this»: the corporation stands in `playedCards` before its own
 *     `onCardPlayed` walks the tableau, and it has two tags → 1 science lands on it at the reveal.
 *  2. THE FIRST ACTION: draw 4 cards, then discard 3 cards FROM THE HAND — the whole hand (the cards bought at the
 *     start included), exactly three, mandatory. The draw is SEALED by the pause it names (`sealCardDrawReveal` with
 *     the discard it waits on — the Pluto pair's grammar: «one action, one take», the take closed by its question);
 *     the discard is one `SelectCard` marked `discardPrompt` with this card as its source, and the cards leave in
 *     the order of the answer (the upstream spec pins `discardPile` deep-equal).
 *  3. «AT LEAST 2 TAGS» (`tagsCounted` — one expression, read by the hook and its forecast twin): the printed tags,
 *     THE WILD ONE COUNTED, plus 1 for an event; ≥ 2 → 1 science on this card. One science per card, however many
 *     tags; the owner's own plays only. The resource lands SYNCHRONOUSLY (the upstream table reads it at once).
 *  4. PAYING: when paying for a STANDARD PROJECT (card type `STANDARD_PROJECT`), a science resource here counts as
 *     2 M€ — not a card from the hand, not an action, not a milestone or an award. No change is given: an overpayment
 *     in science is lost by the general rule of payment. The rule lives in the engine by this card's name
 *     (`Spendable.spireScience`, `Player.paymentOptionsForCard`, `StandardProjectCard.canPlayOptions`).
 *  5. MARSBOT: the human Spire and the bot twin C45 never meet on one table (the collision by `original`); the twin
 *     is untouched.
 *
 * TWO COUNTS OF TAGS AT TWO CORPORATIONS, BOTH NAMED (never folded): Sagitta (PC03) does NOT count the wild tag
 * («Wild tag is not a tag» — its upstream spec); Spire DOES (`card.tags.length` upstream). Both are upstream rules and
 * both read in the player's favour.
 */
export class Spire extends CorporationCard implements ICorporationCard {
  constructor() {
    super({
      name: CardName.SPIRE,
      tags: [Tag.CITY, Tag.EARTH],
      startingMegaCredits: 50,
      initialActionText: 'Draw 4 cards, then discard 3 cards.',
      resourceType: CardResource.SCIENCE,

      metadata: {
        cardNumber: 'PC05', // Renumber
        // TWO effect frames: each caption addresses its frame by the printed order (no `tokens`).
        infoText: [
          {text: 'As your first action, draw 4 cards and discard 3 cards from your hand.', tokens: ['cards']},
          {kind: 'effect-short', text: 'Card with at least 2 tags played: 1 science here'},
          {kind: 'effect-short', text: 'Standard project: science here pays 2 M€ each'},
        ],
        renderData: CardRenderer.builder((b) => {
          b.megacredits(50).plus().cards(SPIRE_FIRST_ACTION_DRAW, {digit}).minus().cards(SPIRE_FIRST_ACTION_DISCARD, {digit}).br;
          b.effect('When you play a card with at least 2 tags, including this, add 1 science resource here.',
            (eb) => eb.emptyTag(SPIRE_TAG_THRESHOLD).asterix().startEffect.resource(CardResource.SCIENCE)).br;
          b.effect('When you pay for a standard project, science resources here may be used as 2 M€ each.',
            (eb) => eb.plate('Standard Project').startEffect.resource(CardResource.SCIENCE).equals().megacredits(2)).br;
        }),
        description: 'You start with 50 M€. As your first action, draw 4 cards, then discard 3 cards from your hand.',
      },
    });
  }

  /** Rule 3 — the tags the EFFECT counts: every printed tag (the wild one too), an event's own tag added. */
  public static tagsCounted(card: ICard): number {
    return card.tags.length + (card.type === CardType.EVENT ? 1 : 0);
  }

  /** Rule 2 — the draw, sealed by the discard it waits on; then the discard of three from the whole hand. */
  public override initialAction(player: IPlayer) {
    player.drawCard(SPIRE_FIRST_ACTION_DRAW);
    player.sealCardDrawReveal({kind: 'discard', card: this.name});
    const count = SPIRE_FIRST_ACTION_DISCARD;
    return new SelectCard(message('Select ${0} card(s) to discard', (b) => b.number(count)), 'Discard', player.cardsInHand, {min: count, max: count})
      .markDiscardPrompt(cardDiscard(this, {min: count, max: count}))
      .andThen((cards) => {
        for (const card of cards) {
          player.discardCardFromHand(card);
        }
        return undefined;
      });
  }

  // The draw is exact (4 from the deck); the discard cannot be pre-collected — the cards are unknown until the draw —
  // so the briefing promises the STEP, never its answer.
  public firstActionPreview() {
    return actionPreviews.firstActionBranch(this, [actionPreviews.drawGain(SPIRE_FIRST_ACTION_DRAW)], [
      actionPreviews.noteStep('generic', 'Then discard 3 cards from your hand — any 3, the drawn ones included.'),
    ]);
  }

  /** Rule 3 — synchronous: the science lands at once. */
  public onCardPlayed(player: IPlayer, card: ICard) {
    if (Spire.tagsCounted(card) >= SPIRE_TAG_THRESHOLD) {
      player.addResourceTo(this, {qty: 1, log: true});
    }
  }

  /**
   * The mirror (rule 3): the same count, one exact fact on printed effect #0 — «+1 science» on this card. A card below
   * the threshold forecasts NOTHING (no chip on every other card of the hand).
   */
  public cardPlayedForecast(cardOwner: IPlayer, _activePlayer: IPlayer, card: ICard): ReadonlyArray<EffectForecastFact> {
    if (Spire.tagsCounted(card) < SPIRE_TAG_THRESHOLD) {
      return [];
    }
    return [forecast.exact(
      {...forecast.sourceOf(this, cardOwner, 'card-played'), printedEffect: 0},
      [actionPreviews.cardGain(this, 1)],
      SPIRE_TAGS_REASON,
    )];
  }
}
