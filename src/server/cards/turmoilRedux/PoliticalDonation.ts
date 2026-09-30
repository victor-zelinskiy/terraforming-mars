import {IProjectCard} from '../IProjectCard';
import {IPlayer} from '../../IPlayer';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import {PlaceDelegatesOnResolution} from '../../parliament/PlaceDelegatesOnResolution';
import * as actionPreviews from '../actionPreviews';

/** «Then add UP TO 3 neutral delegates» — the printed count; the area and the supply decide how many land. */
export const POLITICAL_DONATION_SUPPORT = 3;

/** The two blockers of the play, in the order they are judged — ONE is named at a time. */
export const POLITICAL_DONATION_NO_RESOLUTION_REASON = 'No resolution is up for a vote';
export const POLITICAL_DONATION_NO_DELEGATE_REASON = 'No delegate in your reserve';

/**
 * TR03 — POLITICAL DONATION («Политическое пожертвование»), the seventh Turmoil Redux PROJECT card.
 *
 * A green (AUTOMATED) card: «Add a delegate to a resolution. Then add up to 3
 * neutral delegates to the Popular Support Area of that resolution's party.»
 * The first card of the set to PLACE A DELEGATE by being played — the vote's
 * third door (the action · an effect's grant · a card's play), all three on
 * ONE body: the card defers the shared step `PlaceDelegatesOnResolution` and
 * writes no `SelectParty` and no `placeVote` of its own. And the first card
 * effect on POPULAR SUPPORT, which only the sitting paid until now.
 *
 * SCAN READING — cost 4, one tag in the corner (the red planet: Mars). The MIN
 * box beside the cost is EMPTY: no requirement. No VP badge. The graphic is
 * one row: the player's own (white) delegate · a gap · three NEUTRAL (dark)
 * delegates wearing a purple «?» pill and an asterisk — the pill is «the party
 * of THAT resolution», never a choice of party. The purple Turmoil symbol at
 * the bottom left means «needs the political engine» — for a card of THIS
 * manifest that is the module itself (`compatibility: 'turmoil'` is the
 * upstream-adaptation marker and would demand `politics: 'redux'`).
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/PoliticalDonation.spec.ts):
 *  1. The delegate comes from the RESERVE, free, onto a resolution of the
 *     VOTING AREA (never the enacted one) — the grant's own law: the lobby's
 *     cube is the generation's free vote and an effect does not spend it.
 *  2. The card is unplayable with no resolution up for a vote, or with no
 *     delegate in the reserve — ONE reason per blocker, judged in that order;
 *     a cube standing in the lobby does not lift the second («all your
 *     delegates are in play» would be a lie there, hence the key of its own).
 *     Outside Turmoil Redux the card is never dealt; `canPlay` there is false.
 *  3. «Then» = after the delegate has landed, into the party of the CHOSEN
 *     resolution — no second question.
 *  4. The support is `Parliament.addPopularSupport(party, 3)`: as many as the
 *     area (3) and the common supply take. Fewer than 3 is not an error; none
 *     is a NAMED skip (`effect-skipped`) and the card is still played — the
 *     delegate is its first effect. The player never picks the number.
 *  5. The neutral delegates do NOT stand on the resolution voted for: they lie
 *     in the party's area and become votes on that party's NEXT card (the
 *     sitting's refresh).
 *  6. The card's delegate is an ordinary delegate: it counts toward «delegates
 *     on resolutions» (TR02), toward the party's effect at two, toward a
 *     chairman quest of «send N delegates» and `totalDelegatesPlaced`.
 *  7. The shared step keeps its slot (`Priority.GAIN_RESOURCE_OR_PRODUCTION`);
 *     a chairman quest the play completes is gated at `BACK_OF_THE_LINE`, so it
 *     is asked AFTER the card's own question.
 *  8. MarsBot never plays it (the bot's deck is tags); the step's bot branch
 *     stays as it is.
 */
export class PoliticalDonation extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.POLITICAL_DONATION,
      type: CardType.AUTOMATED,
      tags: [Tag.MARS],
      cost: 4,

      metadata: {
        cardNumber: 'TR03',
        infoText: [
          {text: 'Add 1 delegate from your reserve to a resolution in the Voting Area.', tokens: ['delegates']},
          {text: 'Add up to 3 neutral delegates to the Popular Support Area of that resolution\'s party.', tokens: ['neutral-delegate']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.delegates(1).nbsp.nbsp.neutralDelegate(3).plate('?').asterix();
        }),
        description: 'Add a delegate to a resolution. Then add up to 3 neutral delegates to the Popular Support Area of that resolution\'s party.',
      },
    });
  }

  /** THE step `bespokePlay` defers — built once, asked by the gate's twin (the preview) and queued by the play. */
  private grant(player: IPlayer): PlaceDelegatesOnResolution {
    return new PlaceDelegatesOnResolution(player, 1, {kind: 'card', card: this.name}, {support: POLITICAL_DONATION_SUPPORT});
  }

  public override bespokeCanPlay(player: IPlayer): boolean {
    return this.unplayableReason(player) === undefined;
  }

  /** Rule 2: the first blocker, by name — the voting area, then the reserve. */
  public unplayableReason(player: IPlayer): UnplayableReason | undefined {
    const parliament = player.game.parliament;
    if (parliament === undefined || parliament.partiesInVotingArea().length === 0) {
      return {type: 'party', message: POLITICAL_DONATION_NO_RESOLUTION_REASON};
    }
    if (parliament.reserve(player) < 1) {
      return {type: 'party', message: POLITICAL_DONATION_NO_DELEGATE_REASON, current: 0};
    }
    return undefined;
  }

  public override bespokePlay(player: IPlayer) {
    player.game.defer(this.grant(player));
    return undefined;
  }

  /**
   * One branch: the delegate leaving the reserve (the only target-independent
   * number), and the DOOR — the resolution is chosen in the Parliament, where
   * the vote's forecast and the party's support read per target. The support
   * is deliberately not an `effects` chip: it depends on the resolution.
   */
  public cardPlayPreview(player: IPlayer): ActionPreview {
    return actionPreviews.playPreview(this, player,
      [actionPreviews.delegateFromReserve(player, 1)],
      [actionPreviews.delegateGrantStep(this, this.grant(player))]);
  }
}
