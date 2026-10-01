import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {ICard} from '../ICard';
import {IPlayer} from '../../IPlayer';
import {PlayerInput} from '../../PlayerInput';
import {OrOptions} from '../../inputs/OrOptions';
import {SelectOption} from '../../inputs/SelectOption';
import {effectChoice} from '../../inputs/choiceContext';
import {PlaceDelegatesOnResolution} from '../../parliament/PlaceDelegatesOnResolution';
import {POLITICAL_DONATION_NO_DELEGATE_REASON, POLITICAL_DONATION_NO_RESOLUTION_REASON} from './PoliticalDonation';
import * as actionPreviews from '../actionPreviews';

/**
 * THE CENSUS ACTION — printed word for word on two cards of the Turmoil Redux
 * set: TR15 Martian Census («Марсианская перепись») and TR24 Venusian Census
 * («Венерианская перепись»): «Action: Add 1 data resource here, OR spend 3
 * data from here to add a delegate to a resolution.»
 *
 * ONE implementation for both: each card's own file states only what differs
 * (its trigger, its requirement, its tags), and calls these four functions
 * with itself. Nothing here names a card.
 *
 *  A. +1 data on THIS card. Always available.
 *  B. 3 data off THIS card → 1 delegate onto a resolution of the VOTING AREA —
 *     by the grant's law: from the RESERVE, free, the lobby's cube untouched
 *     (the shared step `PlaceDelegatesOnResolution`, no `support`). The data
 *     are its PRICE (`price`): they leave the card inside the step's answer,
 *     after the reserve is re-read and right before the cube lands — so «paid
 *     and placed nothing» is impossible by construction, and the card file
 *     holds no `SelectParty` and no `placeVote` of its own.
 *
 * B is refused by ONE reason, judged in this order: fewer than 3 data on the
 * card («2 of 3 data on this card») → no resolution up for a vote → no
 * delegate in the reserve (the TR03 keys). A refused B is SHOWN disabled with
 * its reason, never hidden; one live branch is the whole action (no prompt).
 */

/** B's printed price — data spent from THIS card. */
export const CENSUS_DATA_COST = 3;

/** The two options, in the printed row order (A, then B) — the same order `censusActionPreview` declares. */
export const CENSUS_ADD_TITLE = 'Add 1 data resource to this card';
export const CENSUS_VOTE_TITLE = 'Spend 3 data from here to add a delegate to a resolution';

/** B's own blocker — the one condition the card adds over the grant's. */
export const CENSUS_SHORT_DATA_REASON = '${0} of 3 data on this card';

/** THE grant B places — built once, asked by the preview's door and queued by the action. */
export function censusGrant(player: IPlayer, card: ICard): PlaceDelegatesOnResolution {
  return new PlaceDelegatesOnResolution(player, 1, {kind: 'card', card: card.name}, {price: {card, count: CENSUS_DATA_COST}});
}

/** Why B cannot be taken now — ONE reason, in check order (the card's data, the voting area, the reserve). */
export function censusVoteReason(player: IPlayer, card: ICard): UnplayableReason | undefined {
  if (card.resourceCount < CENSUS_DATA_COST) {
    return {type: 'count', message: CENSUS_SHORT_DATA_REASON, params: [String(card.resourceCount)], current: card.resourceCount};
  }
  const parliament = player.game.parliament;
  if (parliament === undefined || parliament.partiesInVotingArea().length === 0) {
    return {type: 'party', message: POLITICAL_DONATION_NO_RESOLUTION_REASON};
  }
  if (parliament.reserve(player) < 1) {
    return {type: 'party', message: POLITICAL_DONATION_NO_DELEGATE_REASON, current: 0};
  }
  return undefined;
}

/**
 * The action itself (the card's `action()`): A always, B when its reason is
 * clear. One live option is the whole action — its callback runs at once (the
 * batch replay folds it, `reconcileBatchResponse`); two are an `OrOptions`
 * marked with the card as its giver.
 */
export function censusAction(player: IPlayer, card: ICard): PlayerInput | undefined {
  const options: Array<SelectOption> = [
    new SelectOption(CENSUS_ADD_TITLE, 'Add resource').andThen(() => {
      player.addResourceTo(card, {qty: 1, log: true});
      return undefined;
    }),
  ];
  if (censusVoteReason(player, card) === undefined) {
    options.push(new SelectOption(CENSUS_VOTE_TITLE, 'Spend').andThen(() => {
      // The data are NOT spent here: they are the grant's price, paid in its answer with the cube.
      player.game.defer(censusGrant(player, card));
      return undefined;
    }));
  }
  if (options.length === 1) {
    return options[0].cb(undefined);
  }
  return new OrOptions(...options).markChoiceContext(effectChoice(card));
}

/**
 * The action's read-only preview: two branches in the order `censusAction`
 * pushes its options. B carries the data leaving the card, the delegate
 * leaving the reserve and the DOOR — the resolution is chosen in the
 * Parliament (`delegateGrantStep` asks the very grant the action defers), so
 * the console stages the vote and A in the vote mode is the action's one POST.
 */
export function censusActionPreview(player: IPlayer, card: ICard): ActionPreview {
  const voteReason = censusVoteReason(player, card);
  return actionPreviews.orBranches(card, [
    {
      available: true,
      title: CENSUS_ADD_TITLE,
      effects: [actionPreviews.cardGain(card, 1)],
    },
    {
      available: voteReason === undefined,
      title: CENSUS_VOTE_TITLE,
      effects: [actionPreviews.cardCost(card, CENSUS_DATA_COST), actionPreviews.delegateFromReserve(player, 1)],
      steps: voteReason === undefined ? [actionPreviews.delegateGrantStep(card, censusGrant(player, card))] : [],
      unavailableReason: voteReason,
    },
  ]);
}
