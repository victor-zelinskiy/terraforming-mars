import {IProjectCard} from '../IProjectCard';
import {IPlayer} from '../../IPlayer';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import {ActionEffect, ActionPreview, AgendaWalkModel} from '../../../common/models/ActionPreviewModel';
import {ChairmanSeat, UnseatBlocker} from '../../parliament/quests/ChairmanSeat';
import {NO_DELEGATE_IN_RESERVE_REASON} from '../../parliament/RemoveDelegate';
import {all} from '../Options';
import * as actionPreviews from '../actionPreviews';

/** The printed MIN plate: «at least 1 Influence». */
export const VOTE_OF_NO_CONFIDENCE_INFLUENCE = 1;
/** «Advance your Agenda marker 1 step» — the printed walk; the end of the track may cut it. */
export const VOTE_OF_NO_CONFIDENCE_STEPS = 1;

/** The chair is empty — there is no «current Chairman» to remove (rule 2). */
export const NO_CHAIRMAN_TO_REMOVE_REASON = 'There is no chairman to remove';
/** The player holds the chair — removing themselves to sit back down is not what the card prints (rule 2). */
export const ALREADY_CHAIRMAN_REASON = 'You are already the chairman';

/** The preview chip of the seat (rule 5): the chair taken, its note naming whose delegate leaves it. */
export const CHAIR_ICON = 'chair';
export const UNSEATS_NOTE = 'unseats ${0}';

/**
 * TR76 — VOTE OF NO CONFIDENCE («Вотум недоверия»), the Turmoil Redux REPLACEMENT of the classic Turmoil T16 —
 * the LAST of the set's seven replacements (`common/cards/turmoilReduxReplacements.ts`, `docs/TURMOIL_REDUX_CLASSIC_
 * CARDS.md` §3.2) and with it the last classic Turmoil card to cross into Redux. Registered as
 * `Vote Of No Confidence:redux` (upstream's enum spells «Of» — the RU name is keyed so; the plain name stays the
 * classic card's), the Redux manifest's `cardsToRemove` keeps the classic one out of every Redux deck. Nothing of the
 * classic engine (`Turmoil`, `setNewChairman`, the NEUTRAL chairman, the party leader) is carried over: under Redux
 * the chair is a player's or EMPTY (`Parliament.chairman`), and the card stands wholly on two engines that exist —
 * the office's own seating (`ChairmanSeat.unseatAndSeatFromReserve`, the quest's `seat()` without its lobby and
 * resolution branches) and the ONE walk of the Agenda track (`ChairmanSeat.walkAgenda`, the TR04 path).
 *
 * SCAN READING — cost 5; the yellow disc with the down arrow is the EVENT marker, never a tag: `tags` is empty. The
 * orange MIN plate holds «1» and the influence badge — `{influence: 1}` (TR04's kind). One row: «−» and the
 * chairman's figure in the ANY-PLAYER frame (the red-orange border), «+» and the player's own chairman's figure, and
 * the starred square — the printed unit «one step of the Agenda track» (`agendaStep(1)`). No VP badge. The number
 * box prints the placeholder «TR00» (all six project replacements do) — the card is TR76, the sixth project row.
 * Printed text: «Requires that you have at least 1 Influence. Remove the current Chairman and move your own delegate
 * (from the reserve) there instead. Advance your Agenda marker 1 step.» Lore: «The Chairman continues to disappoint
 * - we need new leadership to face the current crisis.» — the owner's line, keyed `T16`, borrowed with the T16 art
 * through `reimplements`.
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/VoteOfNoConfidenceRedux.spec.ts):
 *  1. «At least 1 Influence» is the player's WHOLE influence (`Parliament.influence` — the track's level + every
 *     bonus, T05 Event Analysts' too), read by the facade's `InfluenceRequirement` (TR04's kind).
 *  2. «Remove the current Chairman» needs one: an EMPTY chair (generation 1 before the first sitting) has nobody to
 *     remove — the card is not playable (`NO_CHAIRMAN_TO_REMOVE_REASON`, the owner's decision 1a). «…and move YOUR
 *     OWN delegate there instead» needs the chair to be somebody else's: removing yourself to sit back down changes
 *     nothing the card prints — not playable (`ALREADY_CHAIRMAN_REASON`, decision 2a). WHOSE the chair is does not
 *     matter otherwise: a rival's delegate or MarsBot's is removed alike (decision 3).
 *  3. «(from the reserve)» — the reserve ONLY, never the lobby, never a resolution, never a pick: an empty reserve
 *     makes the card unplayable (TR03's «No delegate in your reserve»). The reasons come in that order, ONE at a time
 *     (`ChairmanSeat.unseatBlocker`), after the printed requirement.
 *  4. ON PLAY, SYNCHRONOUSLY and in ONE journal group (the card's play): «${0} takes the chairmanship» first (the
 *     group's header — the quest's own line), the outgoing delegate leaves the seat (back in its owner's reserve by
 *     derivation; `chairman-seated {previous}` tells its owner), the player's own sits down from the reserve, and
 *     only THEN the marker walks one step (the office before the reward — the quest's order, «причина раньше
 *     следствия»), the step's bonus paid by the walk. The quest is untouched (the generation's, not the holder's);
 *     the sitting's `onDelegatesDiscarded` is never called; nothing is pending (no `pendingActions`).
 *  5. PREVIEW = EXECUTION — the chair chip (whose delegate leaves), the reserve chip («3 → 2»), the walk's chips and
 *     its SHOW step (`agendaWalkForecast` — the walk the play makes).
 *  6. MarsBot never plays the card (its deck is tags).  7. Save / load: an ordinary card.
 */
export class VoteOfNoConfidenceRedux extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.VOTE_OF_NO_CONFIDENCE_REDUX,
      type: CardType.EVENT,
      tags: [],
      cost: 5,
      // Rule 1 — the printed «1 [influence]».
      requirements: {influence: VOTE_OF_NO_CONFIDENCE_INFLUENCE},

      metadata: {
        cardNumber: 'TR76',
        // The classic T16's art and lore — the same illustration and the printed quote.
        reimplements: CardName.VOTE_OF_NO_CONFIDENCE,
        infoText: [
          {text: 'Remove the current Chairman and seat your own delegate from the reserve there instead.', tokens: ['chairman']},
          {text: 'Advance your Agenda marker 1 step and collect its bonus.', tokens: ['agenda-step']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.minus().chairman({all}).nbsp.plus().chairman().nbsp.agendaStep(VOTE_OF_NO_CONFIDENCE_STEPS);
        }),
        description: 'Requires that you have at least 1 Influence. Remove the current Chairman and move your own delegate (from the reserve) there instead. Advance your Agenda marker 1 step.',
      },
    });
  }

  /** Rules 2–3 — somebody else in the chair, a delegate in the reserve. */
  public override bespokeCanPlay(player: IPlayer): boolean {
    const parliament = player.game.parliament;
    return parliament !== undefined && ChairmanSeat.unseatBlocker(player, parliament) === undefined;
  }

  /** Rules 2–3: the first blocker, by name — the chair, then the reserve (`unseatBlocker`, read once). */
  public unplayableReason(player: IPlayer): UnplayableReason | undefined {
    const parliament = player.game.parliament;
    // Never dealt outside the Mars Parliament; a table without one has no chairman to remove either.
    const blocker: UnseatBlocker | undefined = parliament === undefined ? 'vacant' : ChairmanSeat.unseatBlocker(player, parliament);
    switch (blocker) {
    case undefined:
      return undefined;
    case 'vacant':
      return {type: 'party', message: NO_CHAIRMAN_TO_REMOVE_REASON, chairmanNow: 'vacant'};
    case 'self':
      return {type: 'party', message: ALREADY_CHAIRMAN_REASON};
    case 'reserve':
      return {type: 'party', message: NO_DELEGATE_IN_RESERVE_REASON, current: 0};
    }
  }

  public override bespokePlay(player: IPlayer) {
    const parliament = player.game.parliament;
    if (parliament === undefined) {
      // Never dealt outside the Mars Parliament (the manifest is the deck gate).
      return undefined;
    }
    const game = player.game;
    // Rule 4 — the group's header first (the quest's own line), then the office, then the step it pays for.
    game.log('${0} takes the chairmanship', (b) => b.player(player));
    ChairmanSeat.unseatAndSeatFromReserve(player, parliament);
    ChairmanSeat.walkAgenda(player, parliament, VOTE_OF_NO_CONFIDENCE_STEPS, {reason: 'card', card: this.name});
    return undefined;
  }

  /** The walk this play would make — the ONE reading of the preview, the hand's plate and the inspector. */
  public agendaWalkForecast(player: IPlayer): AgendaWalkModel {
    return actionPreviews.agendaWalkModel(player, VOTE_OF_NO_CONFIDENCE_STEPS);
  }

  /** Rule 5 — the seat's two chips (the chair taken from its holder, the delegate out of the reserve), then the walk's. */
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const walk = this.agendaWalkForecast(player);
    return actionPreviews.playPreview(this, player,
      [...this.seatEffects(player), ...actionPreviews.agendaWalkEffects(player, walk)],
      [actionPreviews.agendaWalkStep(walk)]);
  }

  private seatEffects(player: IPlayer): Array<ActionEffect> {
    const game = player.game;
    const chairman = game.parliament?.chairman;
    if (chairman === undefined || chairman === player.id) {
      // Not playable (rule 2) — the preview has no seat to show.
      return [];
    }
    const holder = game.getPlayerById(chairman);
    return [
      {direction: 'gain', icon: CHAIR_ICON, amount: 1, note: UNSEATS_NOTE, noteParams: [holder.name]},
      actionPreviews.delegateFromReserve(player, 1),
    ];
  }
}
