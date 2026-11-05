import {ICorporationCard} from '../corporation/ICorporationCard';
import {CorporationCard} from '../corporation/CorporationCard';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {ICard} from '../ICard';
import {AltSecondaryTag} from '../../../common/cards/render/AltSecondaryTag';
import {GainResourcesDeferred} from '../../deferredActions/GainResourcesDeferred';
import {Resource} from '../../../common/Resource';
import {Tag} from '../../../common/cards/Tag';
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import * as actionPreviews from '../actionPreviews';
import * as forecast from '../effectForecastPreviews';

/** «Gain 4 M€» — the first effect row: a card with no tags. */
export const SAGITTA_NO_TAGS_MC = 4;
/** «You gain 1 M€» — the second effect row: a card with exactly 1 tag. */
export const SAGITTA_ONE_TAG_MC = 1;
/** The forecast's reasons — ONE i18n key per row (RU in `effect_forecast.json`). */
export const SAGITTA_NO_TAGS_REASON = 'You play a card with no tags';
export const SAGITTA_ONE_TAG_REASON = 'You play a card with exactly 1 tag';

/**
 * PC03 — SAGITTA FRONTIER SERVICES, the fourth corporation of Prelude 2 to cross (upstream `cardNumber: 'PC03'`
 * «// Renumber» — kept: the art and the lore are keyed by it). The only corporation of the set WITHOUT TAGS, the first
 * with a SEARCH on its reveal, and the first whose own play pays it into the SAME row its printed start fills.
 *
 * SCAN READING — the CORPORATION frame; NO TAGS (the top right corner is empty); the word mark: a black and green
 * arrow emblem, the green outlined «SAGITTA», under it «FRONTIER SERVICES» in black capitals. «31» M€ and a production
 * box: energy · «2» M€; below them a CARD BACK with a small crossed white disc in its corner — «(You start with 31 M€.
 * Increase your energy production 1 step and your M€ production 2 steps. Draw a card that has no tag.)». The EFFECT
 * box, two rows: «[a white disc crossed out] : 4 M€» and «[an empty white disc]* : 1 M€» — «(Effect: When you play a
 * card with no tags, including this, gain 4 M€. When you play a card with EXACTLY 1 TAG, you gain 1 M€.)». The
 * Prelude 2 mark at the left; no number printed on the scan.
 *
 * RULE READINGS (pinned by tests/cards/prelude2/SagittaFrontierServices.spec.ts):
 *  1. START: 31 M€; energy production +1 and M€ production +2; no tags.
 *  2. THE DRAW IS A SEARCH — «draw a card that has no tag» is the NAMED search `drawCard: {count: 1, noTags: true}`
 *     (`hasNoPrintedTags`): reveal until the first card with NO PRINTED TAG that is not an event; it goes to the hand,
 *     the revealed ones to the discard pile, each named with the tags that barred it (the event's own, a wild one). A
 *     card whose only tag is a wild one does NOT match (the tag is printed) — the upstream filter and its spec.
 *  3. «HOW MANY TAGS» FOR THE EFFECT (`tagsCounted` — one expression, read by the hook and its forecast twin): the
 *     printed tags except the wild one, plus 1 for an event («Event tag is a tag», «Wild tag is not a tag» — the
 *     upstream specs). Zero → +4 M€; exactly one → +1 M€; two or more → nothing.
 *  4. TWO READINGS OF «NO TAGS», BOTH NAMED: the SEARCH (no printed tag at all, not an event) and the EFFECT / the
 *     rail's count (`Tags.numberOfCardsWithNoTags` — a wild tag is ignored, not an event). They part on exactly one
 *     card shape — a card whose only tag is a wild one: the search throws it away, the play pays +4. Both are upstream
 *     rules; neither is folded into the other (`noTagsCards.ts`).
 *  5. «INCLUDING THIS» comes BY CONSTRUCTION: the corporation stands in `playedCards` before its own `onCardPlayed`
 *     walks the tableau, and it has no tags → +4 M€: the real start is 35 M€.
 *  6. «WHEN YOU PLAY»: the owner's own plays only, by any road through `playCard`; a rival's card or a bot flip — no.
 *     The payout is DEFERRED (`GainResourcesDeferred` at `Priority.GAIN_RESOURCE_OR_PRODUCTION`, the Hartlan grammar)
 *     behind the play's own questions, under this card's effect scope (`events.withEffect(…, 'card-played')`) — it
 *     can never pay the card that set it off.
 *  7. MARSBOT: the human Sagitta and the bot twin C44 never meet on one table (the collision by `original`); the twin
 *     is untouched. A second corporation (Merger): its play is a card with no tags too (+4) and a search too.
 */
export class SagittaFrontierServices extends CorporationCard implements ICorporationCard {
  constructor() {
    super({
      name: CardName.SAGITTA_FRONTIER_SERVICES,
      startingMegaCredits: 31,

      behavior: {
        production: {energy: 1, megacredits: 2},
        // «Draw a card that has no tag» is a NAMED search (rule 2), never an opaque `include`: the reveal, the preview
        // chip, the card text and the journal fact all name it.
        drawCard: {count: 1, noTags: true},
      },

      metadata: {
        cardNumber: 'PC03', // Renumber
        // TWO effect frames: each caption addresses its frame by the printed order (no `tokens`).
        infoText: [
          {kind: 'effect-short', text: 'Card with no tags played: gain 4 M€'},
          {kind: 'effect-short', text: 'Card with exactly 1 tag played: gain 1 M€'},
        ],
        renderData: CardRenderer.builder((b) => {
          // The draw's rule as the scan prints it: the card back wearing the crossed blank tag in its corner.
          b.megacredits(31).production((pb) => pb.energy(1).megacredits(2)).cards(1, {secondaryTag: AltSecondaryTag.NO_TAGS}).br;
          b.effect('When you play a card with no tags, including this, gain 4 M€.', (eb) => eb.noTags().startEffect.megacredits(SAGITTA_NO_TAGS_MC)).br;
          b.effect('When you play a card with EXACTLY 1 TAG, you gain 1 M€.', (eb) => eb.emptyTag().asterix().startEffect.megacredits(SAGITTA_ONE_TAG_MC)).br;
        }),
        description: 'You start with 31 M€. Increase energy production 1 step and M€ production 2 steps. Draw a card that has no tag.',
      },
    });
  }

  /** Rule 3 — the tags the EFFECT counts: printed, the wild one excepted, an event's own tag added. */
  public static tagsCounted(card: ICard): number {
    return card.tags.filter((tag) => tag !== Tag.WILD).length + (card.type === CardType.EVENT ? 1 : 0);
  }

  /** Rule 3 — what a play is owed: 4 for none, 1 for exactly one, nothing otherwise. */
  private static payoutFor(card: ICard): number {
    switch (SagittaFrontierServices.tagsCounted(card)) {
    case 0: return SAGITTA_NO_TAGS_MC;
    case 1: return SAGITTA_ONE_TAG_MC;
    default: return 0;
    }
  }

  /** Rule 6 — the payout, deferred behind the play's own prompts, under this card's effect scope. */
  public onCardPlayed(player: IPlayer, card: ICard) {
    const count = SagittaFrontierServices.payoutFor(card);
    if (count > 0) {
      player.game.defer(new GainResourcesDeferred(player, Resource.MEGACREDITS, {count, log: true}));
    }
    return undefined;
  }

  /**
   * The mirror (rule 3): the same count, one exact fact on the row it pays — row #0 for a card with no tags, row #1 for
   * a card with exactly one (its one tag named; an event without printed tags names the event tag). A card with two
   * tags or more forecasts NOTHING (Sagitta is not «almost» on it — no chip on every other card of the hand).
   */
  public cardPlayedForecast(cardOwner: IPlayer, _activePlayer: IPlayer, card: ICard): ReadonlyArray<EffectForecastFact> {
    const counted = SagittaFrontierServices.tagsCounted(card);
    if (counted > 1) {
      return [];
    }
    const noTags = counted === 0;
    const amount = noTags ? SAGITTA_NO_TAGS_MC : SAGITTA_ONE_TAG_MC;
    const reasonTag = noTags ? undefined : card.tags.find((tag) => tag !== Tag.WILD) ?? Tag.EVENT;
    return [forecast.exact(
      {...forecast.sourceOf(this, cardOwner, 'card-played'), printedEffect: noTags ? 0 : 1},
      [actionPreviews.stockGain(cardOwner, Resource.MEGACREDITS, amount)],
      noTags ? SAGITTA_NO_TAGS_REASON : SAGITTA_ONE_TAG_REASON,
      {...forecast.AFTER_CARD_GAIN, ...(reasonTag !== undefined ? {reasonTag} : {})},
    )];
  }
}
