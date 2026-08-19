import {MarsBotCorpId, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {AutomaResolver} from '../AutomaResolver';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import {MarsBotCorp} from './MarsBotCorp';

const INFO = marsBotCorpInfo(MarsBotCorpId.C06_MINING_GUILD);
/** The printed bank: 10 M€ on the card, refilling into building-track advances. */
const BANK = INFO.mcBank ?? {size: 10, trackTag: INFO.startingTags[0]};

/**
 * Re-entrancy depth. The bank drains INSIDE the gain that fed it, and its own
 * advance can produce another gain (a covered bonus icon, a Failed Action's
 * 5 M€) which drains it again. Every cycle costs a full bank, so a real game
 * never nests deeply — this is a runaway guard, not a rule.
 */
const MAX_DRAIN_DEPTH = 8;
let drainDepth = 0;

/**
 * MarsBot Mining Guild — official card C06:
 *
 *   STARTING TAGS  building, building
 *   SETUP          Place 10 MC on this card.
 *   EFFECT         If the building track is not yet at #18, when MarsBot gains
 *                  MC, take it from this card instead. When this card empties,
 *                  place 10 MC on this card and advance the building track.
 *
 * The card is a REFILLABLE RESERVOIR, not a toll: the bot still receives every
 * M€ it earns — they are simply taken from this card rather than the general
 * supply. What the card actually converts is INCOME INTO TEMPO: each full 10
 * M€ the bot earns advances the building track one space, for free, on top of
 * whatever earned the M€.
 *
 * «If the building track is not yet at #18» is the card's own off-switch, and
 * #18 is the END of the track — so the check is against the track's own
 * maxPosition (Venus-style shorter tracks stay correct, and the advance can
 * never become a Failed Action).
 *
 * The drain is a LOOP, not a single subtraction: a gain bigger than what is
 * left on the card empties it, refills it, advances, and keeps taking from the
 * fresh stack (a 25 M€ gain with a full card = two advances and 5 M€ left).
 */
export const MarsBotMiningGuild: MarsBotCorp = {
  info: INFO,

  setup(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined) {
      return;
    }
    automa.corpResources = BANK.size;
    game.log('${0} placed ${1} M€ on its corporation ${2}',
      (b) => b.player(marsBotOf(game)).number(BANK.size).string('Mining Guild'));
  },

  onMegacreditsGained(game: IGame, amount: number): void {
    drainBank(game, amount);
  },
};

function drainBank(game: IGame, amount: number): void {
  const automa = game.automa;
  if (automa === undefined || amount <= 0) {
    return;
  }
  const trackIndex = automa.board.getTrackIndexForTag(BANK.trackTag);
  if (trackIndex === undefined) {
    return; // No such track on this board — the card has nothing to drive.
  }
  if (drainDepth >= MAX_DRAIN_DEPTH) {
    game.logIllegalState('MarsBot Mining Guild bank recursion', {corporation: INFO.cardNumber});
    return;
  }
  drainDepth++;
  const bot = marsBotOf(game);
  const prior = AutomaTurnLog.getCause(game);
  AutomaTurnLog.setCause(game, {kind: 'corporation'});
  game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
  try {
    let left = amount;
    while (left > 0) {
      const track = automa.board.tracks[trackIndex];
      // The printed condition, checked EVERY step: once the track reaches its
      // end the card stops paying and the rest comes from the supply as usual.
      if (track.position >= track.maxPosition) {
        return;
      }
      const taken = Math.min(left, automa.corpResources);
      automa.corpResources -= taken;
      left -= taken;
      bumpCorpStat(game, 'miningGuildBanked', taken);
      if (automa.corpResources > 0) {
        return; // Still stocked — nothing else happens.
      }
      automa.corpResources = BANK.size;
      bumpCorpStat(game, 'miningGuildRefills');
      game.log('${0} emptied its corporation ${1} — ${2} M€ go back on the card and the building track advances',
        (b) => b.player(bot).string('Mining Guild').number(BANK.size));
      // The shared advance: cell actions, cubes, cascades and the journal all
      // behave exactly as they do for a tag — and it may itself pay the bot,
      // which re-enters this drain with the refilled card.
      AutomaResolver.advanceTrack(game, trackIndex);
    }
  } finally {
    game.events.endScope();
    AutomaTurnLog.setCause(game, prior);
    drainDepth--;
  }
}
