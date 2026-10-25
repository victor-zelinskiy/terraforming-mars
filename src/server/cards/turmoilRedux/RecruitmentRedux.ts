import {IProjectCard} from '../IProjectCard';
import {IPlayer} from '../../IPlayer';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {NO_DELEGATE_IN_RESERVE_REASON, NO_NEUTRAL_ON_RESOLUTION_REASON, RemoveDelegate} from '../../parliament/RemoveDelegate';
import * as actionPreviews from '../actionPreviews';

/** The printed «− [neutral delegate]* + [delegate]» — ONE figure out, ONE in. */
export const DELEGATES_EXCHANGED = 1;

/**
 * TR74 — RECRUITMENT («Вербовка»), the Turmoil Redux REPLACEMENT of the classic Turmoil T11 — the fifth of the
 * set's seven replacements to be delivered (`common/cards/turmoilReduxReplacements.ts`,
 * `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.2; the number is the registry row's, not the delivery order's),
 * registered as `Recruitment:redux` (the plain name stays the classic card's; the Redux manifest's `cardsToRemove`
 * keeps the classic one out of every Redux deck). It stands WHOLLY on TR72's figure pick: the step is the shared
 * `parliament/RemoveDelegate` with `{source: 'exchange'}` — the same input (`SelectPartyDelegate`), the same
 * Parliament mode (`delegate`), the same staged door — narrowed to the neutral figures on the bills, with the
 * player's own delegate set down in the neutral one's place. Nothing of the classic engine (`Turmoil`,
 * `SendDelegateToArea {replace: 'NEUTRAL'}`, the party leader) is carried over: under Redux the delegates stand on
 * RESOLUTIONS, never in a party.
 *
 * SCAN READING — cost 2; the yellow disc with the down arrow is the EVENT marker, never a tag: `tags` is empty. The
 * MIN box is EMPTY: no requirement. One row: «−» and a DARK (neutral) delegate with an asterisk, «+» and a WHITE
 * (the player's own) delegate — `minus().neutralDelegate(1).asterix().nbsp.plus().delegates(1)`. The parenthesised
 * line under it spells the asterisk: «Exchange one NEUTRAL delegate on a resolution with one of your own from the
 * reserve.» No VP badge. The module's symbol at the bottom left only (no `compatibility`). The number box prints the
 * placeholder «TR00» (all six project replacements do) — the card is TR74, the fourth project row of the
 * replacement registry. Printed lore: «Join us, and your voice will be heard.» — keyed `T11` in `lore_texts.json`
 * (the owner's line) and borrowed with the T11 art through `reimplements`.
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/RecruitmentRedux.spec.ts):
 *  1. «one NEUTRAL delegate ON A RESOLUTION» — a neutral cube on a resolution UP FOR A VOTE (the enacted card is not
 *     one); never a Popular Support area (its cubes are neutral too — the scan says «on a resolution»), never a
 *     seat's or MarsBot's cube, never the chair or the lobby. NO «non-leader» clause (the classic card's is gone):
 *     a bill whose only cubes are neutral is a target.
 *  2. «with one of your own FROM THE RESERVE» — the reserve, never the lobby (that cube is the generation's free
 *     vote), and free (no M€: a grant, never a vote).
 *  3. The card is NOT playable with no neutral cube on any resolution, or with an empty reserve — ONE named reason,
 *     the table's first (`NO_NEUTRAL_ON_RESOLUTION_REASON`), the reserve's second (TR03's key).
 *  4. The exchange is ONE operation: the latest neutral cube of that bill returns to the common supply, the
 *     player's own stands on the same bill LAST (a new `seq` — a tie it makes is judged by the rule: the earlier
 *     first delegate leads). The votes on the bill do not change in number; the leader, the winner and the
 *     player's access re-read the table live (a SECOND delegate there opens the party's effect — the access diff
 *     announces it). The sitting's `onDelegatesDiscarded` is never called.
 *  5. PREVIEW = EXECUTION: the staged door into the Parliament's delegate mode carries the very prompt the play
 *     raises, with the server's forecast after BOTH moves for every target.
 *  6. MarsBot never plays the card (its deck is tags); its cubes are never targets.  7. Save / load: an ordinary card.
 */
export class RecruitmentRedux extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.RECRUITMENT_REDUX,
      type: CardType.EVENT,
      tags: [],
      cost: 2,

      metadata: {
        cardNumber: 'TR74',
        // The classic T11's art and lore — the same illustration and the printed quote.
        reimplements: CardName.RECRUITMENT,
        renderData: CardRenderer.builder((b) => {
          b.minus().neutralDelegate(DELEGATES_EXCHANGED).asterix().nbsp.plus().delegates(DELEGATES_EXCHANGED);
        }),
        description: 'Exchange one NEUTRAL delegate on a resolution with one of your own from the reserve.',
      },
    });
  }

  /** THE step `bespokePlay` defers — built once, asked by the preview (its twin), by the play and by the gate. */
  private exchange(player: IPlayer): RemoveDelegate {
    return new RemoveDelegate(player, {kind: 'card', card: this.name}, {source: 'exchange'});
  }

  /** Rule 3 — a neutral cube on a bill, and a cube in the reserve. */
  public override bespokeCanPlay(player: IPlayer): boolean {
    return this.unplayableReason(player) === undefined;
  }

  /** Rule 3: the first blocker, by name — the table, then the reserve (the step's own judgement, read once). */
  public unplayableReason(player: IPlayer): UnplayableReason | undefined {
    if (player.game.parliament === undefined) {
      // Never dealt outside the Mars Parliament; a table with no Parliament has no neutral cube on a bill either.
      return {type: 'target', message: NO_NEUTRAL_ON_RESOLUTION_REASON};
    }
    const lost = this.exchange(player).previewSkip();
    if (lost === undefined) {
      return undefined;
    }
    return lost.reason === NO_DELEGATE_IN_RESERVE_REASON ?
      {type: 'party', message: lost.reason, current: 0} :
      {type: 'target', message: lost.reason};
  }

  public override bespokePlay(player: IPlayer) {
    if (player.game.parliament === undefined) {
      // Never dealt outside the Mars Parliament (the manifest is the deck gate).
      return undefined;
    }
    player.game.defer(this.exchange(player));
    return undefined;
  }

  /**
   * Rule 5 — the delegate leaving the reserve (the one target-independent number) and the DOOR into the
   * Parliament's delegate mode, the very prompt the play raises.
   */
  public cardPlayPreview(player: IPlayer): ActionPreview {
    return actionPreviews.playPreview(this, player,
      [actionPreviews.delegateFromReserve(player, DELEGATES_EXCHANGED)],
      [actionPreviews.delegateRemovalStep(this, this.exchange(player))]);
  }
}
