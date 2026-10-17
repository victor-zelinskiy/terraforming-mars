import {IProjectCard} from '../IProjectCard';
import {IPlayer} from '../../IPlayer';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {Resource} from '../../../common/Resource';
import {AltSecondaryTag} from '../../../common/cards/render/AltSecondaryTag';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {DiscardPromptMeta} from '../../../common/models/PlayerInputModel';
import {CardRenderer} from '../render/CardRenderer';
import {DiscardCards, DiscardCardsOptions} from '../../deferredActions/DiscardCards';
import {Priority} from '../../deferredActions/Priority';
import {recordSkippedEffect} from '../../deferredActions/skippedEffect';
import {cardSource} from '../../inputs/discardPrompt';
import * as actionPreviews from '../actionPreviews';

/** The printed exchange, per card thrown: «+X M€» … */
export const STRATEGIC_SHIFT_MEGACREDITS_PER_CARD = 1;
/** … «and draw that many cards». */
export const STRATEGIC_SHIFT_CARDS_PER_CARD = 1;
/** The live discard's title (and the preview step's — one key, one ask). */
export const STRATEGIC_SHIFT_DISCARD_TITLE = 'Discard any number of cards with a requirement';
/** WHY a card of the hand is not a candidate — shown on it, never a mute grey card. */
export const STRATEGIC_SHIFT_NO_REQUIREMENT_REASON = 'No requirement on this card';
/** The named skip's CAUSE (the after-the-fact record) when the hand holds no candidate at all — the shared table's row. */
export const STRATEGIC_SHIFT_NO_CANDIDATE_REASON = actionPreviews.SKIP_REASON.noRequirementCard;
/** The composer's warning BEFORE the press for the same case — the play itself stays legal. */
export const STRATEGIC_SHIFT_NO_CANDIDATE_NOTE = 'Nothing to discard: no card with a requirement in hand.';
/** The multi-pick's count label in the composer row. */
export const STRATEGIC_SHIFT_COUNT_LABEL = 'Cards to discard';

/**
 * TR65 — STRATEGIC SHIFT («Смена стратегии»), a Turmoil Redux EVENT: «Discard as
 * many cards with a requirement from your hand as you like. Then gain the same
 * amount of M€ and draw that many cards.» Cost 2, red, no tags, no VP, no
 * requirement.
 *
 * SCAN READING — a red frame, cost 2, an EMPTY orange MIN plate beside the
 * price (no requirement — the TR66 / TR05 shape), the event's yellow disc in the
 * corner, no tag. The bottom block: «−X [a card wearing the yellow REQUIREMENT
 * plate in its corner] +X [a gold M€ square printed X] +X [a card]» — the first
 * card IS the «card with a requirement» the rules speak of, the one
 * `AltSecondaryTag.REQ` already prints for Cutting-Edge Technology; the text:
 * «(Discard as many cards with a requirement from your hand as you like. Then
 * gain the same amount of M€ and draw that many cards.)». Printed lore:
 * «Strategy isn't about what you do. It's about what you decide NOT to do.»
 * (`lore_texts.json` «TR65»; the art: gorodenkoff / istockphoto). Only the
 * module's icon at the bottom left: no `compatibility`.
 *
 * THE MECHANISM is three known pieces and nothing new: Public Plans' MULTI
 * pick of the hand (any number, «select all», a live per-card payout), the
 * DISCARD skin of Sponsored Academies / Ender (`DiscardCards` with the
 * structural `discardPrompt` marker — the cards physically LEAVE), and the
 * EMBEDDED draw of the play's own response (the hand workspace's «ДОБОР КАРТ»
 * stage, TR57) — the pick is pre-collected in the composer and rides the play's
 * ONE POST, addressed to this card's own discard.
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/StrategicShift.spec.ts):
 *  1. No requirement; an EVENT — it lies face down on the events pile.
 *  2. «A card with a requirement» = `card.requirements.length > 0` (Forecaster,
 *     Nobel Prize, Cutting-Edge Technology, Xavier read it the same way): a
 *     parameter, a tag count, a party plate, resources, cities, a generation —
 *     every descriptor kind alike. A card WITHOUT one is NOT a candidate — it is
 *     offered DISABLED with this reason, never hidden without a word. The card
 *     itself has already left the hand when the live prompt is built; the
 *     preview excludes it the same way (and marks it «being played»).
 *  3. The choice is a DISCARD, never a reveal: ONE `DiscardCards(0, eligible,
 *     …)` with the candidates narrowed to rule 2 (`options.cards`, the rest of
 *     the hand `disabled` with its reason), `min 0` (X may be zero — the
 *     player's choice), `max` = every candidate, the console's «select all»
 *     offered. With NO candidate there is no question: the loss is NAMED
 *     (`effect-skipped`, this file's reason) and the play goes on — the event
 *     is still played (its 2 M€, its «events played» count).
 *  4. THEN, in the discard's own answer and in the printed order: +1 M€ per
 *     card thrown (`stock.add`, logged, this card the source), then that many
 *     cards drawn. Zero thrown → nothing, no lines. A deck shorter than owed
 *     says so («Only N of M cards were left in the deck») — never a silent loss.
 *  5. PREVIEW = EXECUTION: one `selectCardStep` over the SAME candidate set
 *     (self + the no-requirement cards `disabled` with their reasons), `min 0`,
 *     «select all», the multi-pick's count label with its TWO per-card payouts
 *     (`revealGain` in M€, `drawPerCard` in cards), ADDRESSED to this card's
 *     discard (`for: {role: 'discard'}`) and carrying the live prompt's own
 *     marker from ONE builder (`discardOptions`) — the album wears the discard's
 *     skin before the press exactly as the live prompt would. The `effects`
 *     list carries NO counted chip: the number is the player's, not the table's.
 *  6. The answer lands ONLY on this card's discard (`{role: 'discard', source:
 *     {card}}`); the replay guard's cheapest answer — zero cards — is legal.
 *  7. ONE POST: the whole play is `[play, {discard}]`; the draw happens INSIDE
 *     the response and the cards arrive on the hand workspace's embedded draw
 *     stage (the standalone reveal never mounts).
 *  8. The table does not answer: no tag wakes anything (the card has none),
 *     Mars University reads a SCIENCE tag played (not a discard), Research
 *     Startups answers a patent SALE (not a discard), Olympus Conference /
 *     Mons Insurance have nothing to say to a draw.
 *  9. The zero-candidate case speaks BEFORE the press through the preview's
 *     named warning (the `actionFutility` channel is for ACTIONS only).
 * 10. MarsBot never plays the card; save / load is an ordinary event; the
 *     preview mutates nothing.
 */
export class StrategicShift extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.STRATEGIC_SHIFT,
      type: CardType.EVENT,
      cost: 2,

      metadata: {
        cardNumber: 'TR65',
        // The structured text in two blocks — the printed «Then» is carried by the block order (the information
        // model's law), never by the word; the description below stays the scan's text word for word.
        infoText: [
          {text: 'Discard any number of cards with a requirement from your hand.', tokens: ['cards']},
          {text: 'Gain 1 M€ and draw 1 card for each card discarded.', tokens: ['megacredits', 'cards']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.minus().cards(1, {secondaryTag: AltSecondaryTag.REQ, text: 'X'})
            .plus().megacredits(1, {text: 'X'})
            .plus().cards(1, {text: 'X'});
        }),
        description: 'Discard as many cards with a requirement from your hand as you like. Then gain the same amount of M€ and draw that many cards.',
      },
    });
  }

  /** Rule 2 — the candidates: the hand's cards with a requirement, this card never among them. */
  public eligibleCards(player: IPlayer): Array<IProjectCard> {
    return player.cardsInHand.filter((c) => c.name !== this.name && c.requirements.length > 0);
  }

  /** The rest of the hand — offered DISABLED, each with the reason. */
  private ineligibleCards(player: IPlayer): Array<IProjectCard> {
    return player.cardsInHand.filter((c) => c.name !== this.name && c.requirements.length === 0);
  }

  /** THE discard this card asks — ONE source + exchange for the live `DiscardCards` and the preview's marker. */
  private discardOptions(): {source: NonNullable<DiscardCardsOptions['source']>, exchange: NonNullable<DiscardPromptMeta['exchange']>} {
    return {
      source: cardSource(this),
      exchange: {icon: 'megacredits', amount: STRATEGIC_SHIFT_MEGACREDITS_PER_CARD, perCard: true, draw: STRATEGIC_SHIFT_CARDS_PER_CARD},
    };
  }

  /** Rules 3–4 — the discard, then the payout in the discard's own answer. */
  public override bespokePlay(player: IPlayer) {
    const eligible = this.eligibleCards(player);
    if (eligible.length === 0) {
      recordSkippedEffect(player, STRATEGIC_SHIFT_NO_CANDIDATE_REASON, {label: actionPreviews.SKIPPED_LABEL.discardCards});
      return undefined;
    }
    player.game.defer(new DiscardCards(player, 0, eligible.length, STRATEGIC_SHIFT_DISCARD_TITLE, {
      ...this.discardOptions(),
      cards: eligible,
      showSelectAll: true,
      disabled: this.ineligibleCards(player).map((card) => ({card, reason: STRATEGIC_SHIFT_NO_REQUIREMENT_REASON})),
    }), Priority.DISCARD_AND_DRAW).andThen((discarded) => this.payOff(player, discarded.length));
    return undefined;
  }

  /** Rule 4 — +1 M€ and +1 card per card thrown; a short deck is named. */
  private payOff(player: IPlayer, thrown: number): void {
    if (thrown <= 0) {
      return;
    }
    player.stock.add(Resource.MEGACREDITS, thrown * STRATEGIC_SHIFT_MEGACREDITS_PER_CARD, {log: true, from: {card: this}});
    const owed = thrown * STRATEGIC_SHIFT_CARDS_PER_CARD;
    const before = player.cardsInHand.length;
    player.drawCard(owed, {source: {type: 'card', cardName: this.name}});
    const drawn = player.cardsInHand.length - before;
    if (drawn < owed) {
      player.game.log('Only ${0} of ${1} card(s) were left in the deck for ${2}', (b) =>
        b.number(drawn).number(owed).player(player));
    }
  }

  /** Rules 5 and 9 — the pre-collected discard (or the named warning), nothing counted in the effects. */
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const eligible = this.eligibleCards(player);
    if (eligible.length === 0) {
      return actionPreviews.playPreview(this, player, [], [
        actionPreviews.warningNote(STRATEGIC_SHIFT_NO_CANDIDATE_NOTE, {skipped: {label: actionPreviews.SKIPPED_LABEL.discardCards}}),
      ]);
    }
    const discard = this.discardOptions();
    return actionPreviews.playPreview(this, player, [], [
      actionPreviews.selectCardStep(player, STRATEGIC_SHIFT_DISCARD_TITLE, 'Discard', eligible, {
        min: 0,
        max: eligible.length,
        showSelectAll: true,
        // Self rides the disabled channel with the concrete reason (Public Plans' form), and so does every card
        // without a requirement — a picker showing the WHOLE hand never leaves one a mute grey card.
        disabled: [
          {card: this, reason: 'This card is being played'},
          ...this.ineligibleCards(player).map((card) => ({card, reason: STRATEGIC_SHIFT_NO_REQUIREMENT_REASON})),
        ],
        multiSelect: {
          countLabel: STRATEGIC_SHIFT_COUNT_LABEL,
          revealGain: {resource: Resource.MEGACREDITS, amount: STRATEGIC_SHIFT_MEGACREDITS_PER_CARD},
          drawPerCard: STRATEGIC_SHIFT_CARDS_PER_CARD,
        },
        // The live prompt is `DiscardCards` — a DISCARD of this card's: the answer is addressed to exactly that.
        for: {role: 'discard', source: discard.source},
        // …and the live discard's own marker, from the ONE builder above.
        discard: {min: 0, max: eligible.length, ...discard},
      }),
    ]);
  }
}
