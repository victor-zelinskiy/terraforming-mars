import {Resource} from '../../../common/Resource';
import {Tag} from '../../../common/cards/Tag';
import {BonusCardId} from '../../../common/automa/AutomaTypes';
import {MarsBotCorpId, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {AutomaResolver} from '../AutomaResolver';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import type {BonusCardOutcome} from '../AutomaBonusCards';
import {MarsBotCorp} from './MarsBotCorp';

const INFO = marsBotCorpInfo(MarsBotCorpId.C20_FACTORUM);
/** The track whose every advance stocks the card, named by TAG (never an index). */
const COLLECTING_TRACK = Tag.BUILDING;
/** What one advance of that track puts on the card. */
const STORED_PER_ADVANCE = 1;
/** What B24 withdraws — «3 MC, or as much as possible». */
const WITHDRAWAL_MC = 3;
/** The track B24 pushes when the card turns out to be empty. */
const EMPTY_FALLBACK_TRACK = Tag.POWER;

/**
 * MarsBot Factorum — official card C20:
 *
 *   STARTING TAG         power
 *   SETUP                Replace the tracker for the building track with a
 *                        white cube as a reminder for this corporation's
 *                        effect.
 *   EFFECT               When MarsBot advances the building track, place 1 MC
 *                        on this card.
 *   BEFORE ACTION PHASE  Add Supply & Demand to MarsBot's action deck.
 *
 * plus its corporation-specific bonus card B24 Supply & Demand:
 *
 *   "MarsBot gains 3 MC, or as much as possible, from the Factorum
 *    corporation card. If it gained 0 MC, advance the power track. At the
 *    beginning of every generation, shuffle this into MarsBot's action deck."
 *
 * A TILL, not a bank. C06 Mining Guild's card starts full and DRAINS as the
 * bot earns; this one starts empty and FILLS — one M€ per building-track
 * advance — and its own recurring card is the only way the money comes off.
 * The loop is «build → the till fills → Supply & Demand cashes it out», so
 * the corporation converts construction tempo into money on a delay, and a
 * generation with no building at all cashes out nothing.
 *
 * THE SETUP BOX IS PURE PRESENTATION (the C04 primitive): `whiteMarkerTracks`
 * + `markerLegend` paint the building track's marker white on the mat and say
 * what it reminds of. There is no game state in it.
 *
 * «OR AS MUCH AS POSSIBLE» IS A PARTIAL PAYMENT, and deliberately not the
 * all-or-nothing «if able» of C15/B28 — this card set spells the two
 * differently, and B24 spells this one out further with its own else-branch
 * («if it gained 0 MC»), which only exists because a partial take is possible.
 * So: take `min(3, on the card)`, and the power track moves only on a take of
 * exactly ZERO — one M€ on the card is still a take, and the fallback stays
 * shut.
 *
 * LIFECYCLE. B24 rides the recurring mechanism of B23/B25/B28, with the
 * generation-1 insertion done here because the deck was built at game
 * creation, before the corporation existed.
 */
export const MarsBotFactorum: MarsBotCorp = {
  info: INFO,

  onTrackAdvance(game: IGame, trackIndex: number, _position: number): void {
    const automa = game.automa;
    if (automa === undefined || automa.board.getTrackIndexForTag(COLLECTING_TRACK) !== trackIndex) {
      return;
    }
    // Deliberately NOT `MarsBotTrackPayout`: that primitive's whole contract is
    // «MarsBot GAINS N MC», and this M€ never reaches the bot — it is placed on
    // the card. Same trigger, different destination.
    const bot = marsBotOf(game);
    const prior = AutomaTurnLog.getCause(game);
    AutomaTurnLog.setCause(game, {kind: 'corporation'});
    game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
    try {
      automa.corpResources += STORED_PER_ADVANCE;
      game.log('${0} put ${1} M€ on its corporation ${2}',
        (b) => b.player(bot).number(STORED_PER_ADVANCE).string('Factorum'));
    } finally {
      game.events.endScope();
      AutomaTurnLog.setCause(game, prior);
    }
    bumpCorpStat(game, 'factorumStored', STORED_PER_ADVANCE);
  },

  beforeActionPhase(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined) {
      return;
    }
    if (!automa.recurringBonusCards.includes(BonusCardId.B24_SUPPLY_AND_DEMAND)) {
      automa.recurringBonusCards.push(BonusCardId.B24_SUPPLY_AND_DEMAND);
    }
    const present = automa.actionDeck.some((entry) => entry.kind === 'bonus' && entry.id === BonusCardId.B24_SUPPLY_AND_DEMAND);
    if (!present) {
      const index = game.rng.nextInt(automa.actionDeck.length + 1);
      automa.actionDeck.splice(index, 0, {kind: 'bonus', id: BonusCardId.B24_SUPPLY_AND_DEMAND});
      // Journal-only (no scope): the deck join is public bookkeeping, not an
      // event worth a notification — the card announces itself when flipped.
      game.log('${0} shuffled Supply and Demand into its action deck', (b) => b.player(marsBotOf(game)));
    }
  },

  resolveBonusCard(game: IGame, id: BonusCardId): BonusCardOutcome {
    if (id !== BonusCardId.B24_SUPPLY_AND_DEMAND) {
      throw new Error(`MarsBot Factorum does not own bonus card ${id}`);
    }
    return supplyAndDemand(game);
  },
};

/** B24 Supply & Demand. Always ends in the recurring holding (never destroyed). */
function supplyAndDemand(game: IGame): BonusCardOutcome {
  const automa = game.automa;
  if (automa === undefined) {
    throw new Error('Not an automa game');
  }
  const bot = marsBotOf(game);
  bumpCorpStat(game, 'supplyDemandPlayed');

  const taken = Math.min(WITHDRAWAL_MC, automa.corpResources);
  if (taken > 0) {
    automa.corpResources -= taken;
    // The bot really RECEIVES this money — an ordinary gain, so the journal,
    // the event stream and any corporation watching income all see it.
    bot.stock.add(Resource.MEGACREDITS, taken, {log: false});
    game.log('${0} took ${1} M€ off its corporation ${2}',
      (b) => b.player(bot).number(taken).string('Factorum'));
    bumpCorpStat(game, 'factorumWithdrawn', taken);
    AutomaTurnLog.setBonusBranch(game, {key: 'Cashed ${0} M€ out of the card', params: [`${taken}`]});
    return 'discard';
  }

  // «If it gained 0 MC, advance the power track» — the printed else-branch,
  // reachable only on a completely empty card.
  bumpCorpStat(game, 'supplyDemandEmpty');
  const trackIndex = automa.board.getTrackIndexForTag(EMPTY_FALLBACK_TRACK);
  if (trackIndex === undefined) {
    return 'discard'; // No power track on this board — nothing to push.
  }
  AutomaTurnLog.setBonusBranch(game, {key: 'The card was empty — the power track moves instead'});
  game.log('${0} found its corporation ${1} empty — the power track moves instead',
    (b) => b.player(bot).string('Factorum'));
  // The shared advance: the space's printed icon, cascades and the Failed
  // Action on a completed track all behave as anywhere else.
  AutomaResolver.advanceTrack(game, trackIndex);
  return 'discard'; // Recurring: `routeBonusCard` keeps it in the holding pool.
}
