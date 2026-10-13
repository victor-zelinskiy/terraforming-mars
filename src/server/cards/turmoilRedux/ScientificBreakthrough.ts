import {IProjectCard} from '../IProjectCard';
import {IPlayer} from '../../IPlayer';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardResource} from '../../../common/CardResource';
import {Tag} from '../../../common/cards/Tag';
import {PartyName} from '../../../common/turmoil/PartyName';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import {ActionPreview, ActionPreviewStep} from '../../../common/models/ActionPreviewModel';
import {CardRenderer} from '../render/CardRenderer';
import {all} from '../Options';
import {cardSource} from '../../inputs/choiceContext';
import {RemoveResourcesFromCard} from '../../deferredActions/RemoveResourcesFromCard';
import {drawSearchOf} from '../../deferredActions/drawSearch';
import {Priority} from '../../deferredActions/Priority';
import * as actionPreviews from '../actionPreviews';
import * as reason from '../actionReasons';

/** The printed «− [data][data]*» — taken off ONE card of ANY player. */
export const DATA_REMOVED = 2;
/** The printed two Science card backs — the search's count. */
export const SCIENCE_CARDS_DRAWN = 2;
/** The play's refusal: no card at the table holds the two data the play must take (rule 2). */
export const NO_DATA_SOURCE_REASON = 'No card has 2 data to remove';

/**
 * TR52 — SCIENTIFIC BREAKTHROUGH («Научный прорыв»), a Turmoil Redux PROJECT
 * card: the Scientists' plate over the set's first EVENT whose price is a
 * MANDATORY attack on a card of ANY player — the two data taken off one card
 * buy a search of the project deck for two Science cards (TR32's class:
 * `DrawSearchModel`, the reveal's sequence, the discard pile).
 *
 * SCAN READING — cost 6, a RED card (EVENT); two tags in the corner: SCIENCE
 * (the atom) and EVENT (the yellow disc with the arrow down). The orange MIN
 * plate beside the cost holds the SCIENTISTS' emblem (the flask): a
 * REQUIREMENT (`{party: SCIENTISTS}`), never a tag. One row: a minus, TWO data
 * squares in the red «any player» border with an asterisk («from ANY card»),
 * then TWO card backs each with a Science tag in its corner. No VP badge. No
 * quote — the lower block is the rule — so the lore is INVENTED
 * (`docs/claude/turmoil-redux-invented-lore.md`: «Eureka! Now, whose notes were
 * these?»). Only the module's icon at the bottom left: no `compatibility`. The
 * art's caption «Denis Ismagilov» is the art's, not the face's.
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/ScientificBreakthrough.spec.ts):
 *  1. The REQUIREMENT is the Scientists' plate — they rule, or 2 of the
 *     player's OWN delegates stand on their resolution — checked at the PLAY
 *     only; TR36 Council Seat lowers an EFFECT's threshold, never a requirement.
 *  2. The removal is MANDATORY («this is mandatory»): with no card that can give
 *     the two data the card is UNPLAYABLE, and says why («No card has 2 data to
 *     remove»). Solo is the neutral opponent's rule (it always has them).
 *  3. The target is ONE card of ANY player (the player's own included) holding
 *     AT LEAST 2 data — «2 data from a card», never 1 + 1; a holder with 1 is
 *     shown DISABLED with its reason («Not enough resources on this card»),
 *     never hidden (`RemoveResourcesFromCard` `requireFullCount`). MarsBot is a
 *     target while its attackable stock (its M€ supply stands in for any card
 *     resource — Automa rulebook) covers the two.
 *  4. The target is PRE-SELECTED in the composer and never applied
 *     automatically, a single candidate included (`autoselect: false`); a
 *     rival's card reads its owner's loss.
 *  5. ORDER: the removal (the card's own question, at `DEFAULT` — the price of
 *     the search), then the search for 2 Science-tagged cards (every card
 *     turned over without one is discarded), then the 2 into the hand. A deck
 *     emptied mid-search reshuffles the discard (the engine's rule — the cards
 *     this search threw away come back); no Science card left at all → the
 *     player keeps what was found, the reveal says `exhausted`.
 *  6. The SCIENCE tag wakes the table (Olympus Conference / Pharmacy Union ask
 *     before the press; Mars University's discard stands behind this play's
 *     draw — an honest follow-up; TR05 +2 data); the EVENT goes to the events
 *     pile and its Science tag leaves the count with it (the engine's rule).
 *  7. The ATTACK is the class's: the owner of the card loses the two data
 *     (`removeResourceFrom` with the attacker — the journal names the card, the
 *     victim's notification too); taking data off a card is not an addition, so
 *     nothing answers it (Martian Fiber stays silent).
 *  8. The JOURNAL: the removal with the attacker and the card, the search's
 *     public lines (the discards by name, the found cards by name), the draw.
 *  9. MarsBot never plays the card; save / load adds nothing.
 */
export class ScientificBreakthrough extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.SCIENTIFIC_BREAKTHROUGH,
      type: CardType.EVENT,
      tags: [Tag.SCIENCE],
      cost: 6,
      requirements: {party: PartyName.SCIENTISTS},

      metadata: {
        cardNumber: 'TR52',
        renderData: CardRenderer.builder((b) => {
          b.minus().resource(CardResource.DATA, {amount: DATA_REMOVED, all}).asterix().nbsp.cards(SCIENCE_CARDS_DRAWN, {secondaryTag: Tag.SCIENCE});
        }),
        infoText: [
          {text: 'Remove 2 data from a card of ANY player (mandatory).', tokens: ['res-data']},
          {text: 'Reveal cards from the project deck until you reveal 2 cards with a science tag. Take them into your hand and discard the rest.', tokens: ['cards']},
        ],
        description: 'Requires the Scientists to be ruling or that you have 2 delegates there. Remove 2 data resources from ANY player\'s card (this is mandatory) to draw 2 Science cards. (Discard cards from the deck until you find them.)',
      },
    });
  }

  /** THE removal (rules 2–4, 7) — the ONE construction the gate, the preview and the play all ask. */
  private removal(player: IPlayer): RemoveResourcesFromCard {
    return new RemoveResourcesFromCard(player, CardResource.DATA, DATA_REMOVED, {
      source: 'all',
      mandatory: true,
      autoselect: false,
      requireFullCount: true,
      log: true,
      cause: cardSource(this),
    });
  }

  /** Rule 2 — a target that can give the WHOLE two (the neutral opponent always can). */
  private hasSource(player: IPlayer): boolean {
    return player.game.isSoloMode() || RemoveResourcesFromCard.hasTarget(player, CardResource.DATA, 'all', DATA_REMOVED);
  }

  public override bespokeCanPlay(player: IPlayer): boolean {
    return this.hasSource(player);
  }

  public unplayableReason(player: IPlayer): UnplayableReason | undefined {
    return this.hasSource(player) ? undefined : reason.targetReason(NO_DATA_SOURCE_REASON);
  }

  /** Rule 5 — the removal at the card's own priority; the search follows the answer. */
  public override bespokePlay(player: IPlayer) {
    player.game.defer(this.removal(player), Priority.DEFAULT).andThen((response) => {
      if (response.proceed) {
        player.drawCard(SCIENCE_CARDS_DRAWN, {tag: Tag.SCIENCE, source: {type: 'card', cardName: this.name}});
      }
    });
    return undefined;
  }

  /**
   * The composer's reading in the PRINTED order: «−2 [data]» (WHICH card pays it is the target step's own reading —
   * `current → resulting` and the owner's VP over EXACTLY the set the live prompt offers) and the search's chip with
   * its rule (the same descriptor its reveal will carry — `drawSearch.ts`).
   */
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const removal = this.removal(player);
    const model = removal.previewRemovalModel();
    const target: ActionPreviewStep | undefined = model === undefined ? undefined : {
      kind: 'input',
      input: model,
      amount: -DATA_REMOVED,
      cardResource: actionPreviews.cardResourceIcon(CardResource.DATA),
      vpBox: actionPreviews.targetVictoryPoints(player, removal.previewTargetCards(), -DATA_REMOVED),
    };
    const search = drawSearchOf(SCIENCE_CARDS_DRAWN, {tag: Tag.SCIENCE});
    return actionPreviews.playPreview(this, player, [
      actionPreviews.cardResourceCost(CardResource.DATA, DATA_REMOVED),
      {...actionPreviews.drawGain(SCIENCE_CARDS_DRAWN), ...(search !== undefined ? {search} : {})},
    ], [target]);
  }
}
