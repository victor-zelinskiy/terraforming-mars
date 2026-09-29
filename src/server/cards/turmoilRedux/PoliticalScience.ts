import {IActionCard} from '../ICard';
import {IPlayer} from '../../IPlayer';
import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {CardResource} from '../../../common/CardResource';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {ActionCard} from '../ActionCard';

/**
 * TR02 — POLITICAL SCIENCE («Политология»), the fourth Turmoil Redux PROJECT card.
 *
 * An EFFECT the political phase fires — «whenever your delegates get discarded
 * from UNENACTED resolutions, add 1 data here per delegate discarded» — and a
 * declarative ACTION: spend 3 data from here to draw a card. The first card of
 * the set to HOLD data (the Redux scope only ever PAID data before: the
 * Scientists' action, Medical Database), and the first to carry a hook the
 * SITTING calls (`onDelegatesDiscarded`, docs/TURMOIL_REDUX_POLITICAL_SCIENCE.md).
 *
 * SCAN READING — the delegate figure in the orange MIN box beside the cost is
 * the REQUIREMENT («Requires that you have at least 3 delegates on resolutions
 * in the Voting Area» — `delegatesOnResolutions`); the corner holds the two
 * tags, Science and Earth. No VP badge. The purple Turmoil symbol at the
 * bottom left means «needs the political engine» — for a card of THIS
 * manifest that is the module itself (`compatibility: 'turmoil'` is the
 * upstream-adaptation marker and would demand `politics: 'redux'`).
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/PoliticalScience.spec.ts):
 *  1. The ONLY trigger is the sitting's REFRESH step (`ParliamentPhase.stepRefresh`):
 *     the two unenacted resolutions leave the voting area and their delegates go
 *     home — one call per leaving card, `count` = this player's delegates on it
 *     (neutral delegates never count). The hook is called by the phase, under
 *     `events.withEffect(player, card, 'delegates-discarded')`, so the journal,
 *     the notifications and the stats see the CARD as the source.
 *  2. The ENACTED resolution's delegates go home too (`stepEnact`) — but it
 *     was enacted: no data.
 *  3. The FINAL generation refreshes nothing (`effects → adjourn`): the delegates
 *     stay on the cards, no data. The card has no VP and a draw after the final
 *     sitting is worth nothing, so nothing is lost.
 *  4. A delegate taken back for the CHAIRMAN'S SEAT (`Parliament.removeLatestVote`)
 *     is MOVED, not discarded — the resolution is still up for a vote: no data.
 *  5. The requirement is `Parliament.votesOf(player)` — delegates on the THREE
 *     slots of the voting area; the lobby, the chair and the reserve never count.
 *  6. Data here are ORDINARY data: the Scientists' action and Medical Database
 *     see this card as a holder (`getResourceCards(DATA)`); nothing but the
 *     card's own action spends them, and data are never a payment unit.
 *  7. The action is declarative (`spend.resourcesHere` + `drawCard`): below 3
 *     data the automatic reason is «Not enough resources on this card».
 *  8. The collection goes through `addResourceTo` (the recorder, the log, the
 *     quest tracker) — never `resourceCount +=`.
 *  9. The chairman quest of the COMING generation is never advanced by the
 *     collection: `QuestTracker.eligible` refuses every mutation whose root is
 *     the political phase (the sitting belongs to the CLOSING generation).
 * 10. A reload mid-sitting never doubles the collection: `stepRefresh` is
 *     idempotent by its `refresh:<generation>` key, and the hook runs inside it.
 */
export class PoliticalScience extends ActionCard implements IActionCard {
  constructor() {
    super({
      name: CardName.POLITICAL_SCIENCE,
      type: CardType.ACTIVE,
      tags: [Tag.SCIENCE, Tag.EARTH],
      cost: 8,
      resourceType: CardResource.DATA,
      requirements: {delegatesOnResolutions: 3},

      action: {
        spend: {resourcesHere: 3},
        drawCard: 1,
      },

      metadata: {
        cardNumber: 'TR02',
        infoText: [{kind: 'effect-short', text: 'Delegates off unenacted resolutions: +1 data each'}],
        renderData: CardRenderer.builder((b) => {
          b.effect('Whenever your delegates get discarded from unenacted resolutions, add 1 data resource here per delegate discarded.', (eb) => {
            eb.delegates(1, {cancelled: true}).asterix().startEffect.resource(CardResource.DATA);
          }).br;
          b.action('Spend 3 data from here to draw a card.', (eb) => {
            eb.resource(CardResource.DATA, 3).startAction.cards(1);
          });
        }),
      },
    });
  }

  /**
   * The sitting's refresh discarded `count` of this player's delegates off an
   * UNENACTED resolution (rule 1): 1 data per delegate, through the recorder.
   * The phase wraps the call in the card's own effect scope and journals the
   * delta as a `card-effect` renewal event — the hook only collects.
   */
  public onDelegatesDiscarded(player: IPlayer, count: number): void {
    player.addResourceTo(this, {qty: count, log: true});
  }
}
