import {Resource} from '../../../common/Resource';
import {BonusCardId} from '../../../common/automa/AutomaTypes';
import {MarsBotCorpId, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {AutomaResolver} from '../AutomaResolver';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import type {BonusCardOutcome} from '../AutomaBonusCards';
import {MarsBotCorp} from './MarsBotCorp';

const INFO = marsBotCorpInfo(MarsBotCorpId.C15_ROBINSON_INDUSTRIES);
/** The printed setup gift — the war chest B28 spends. */
const SETUP_MC = 10;
/** What B28 charges for the push it just made. */
const DIVERSIFICATION_MC = 4;

/**
 * MarsBot Robinson Industries — official card C15:
 *
 *   SETUP                MarsBot gains 10 MC.
 *   BEFORE ACTION PHASE  Add Diversification to MarsBot's action deck.
 *
 * plus its corporation-specific bonus card B28 Diversification:
 *
 *   "Advance the least-advanced track, topmost if tied. MarsBot loses 4 MC,
 *    if able. At the beginning of every generation, shuffle this into
 *    MarsBot's action deck."
 *
 * The card prints NEITHER a starting tag NOR a draft priority (the top-right
 * tag socket and the priority plate are simply absent — compare C11, which
 * prints both), because this corporation owns exactly one idea: it BUYS
 * progress. The 10 M€ is the war chest and B28 spends it four at a time on
 * whichever front the bot is worst at, so the bot never develops a weak
 * flank. The trade costs real score: MarsBot's leftover M€ convert to VP at
 * final scoring (`AutomaScoring.mcPerVp`), so every push is paid for out of
 * its own endgame points.
 *
 * «LOSES 4 MC, IF ABLE» IS ALL-OR-NOTHING. This card set spells a PARTIAL
 * payment «up to X» (B01: "loses up to 5 plants"); «X, if able» is the other
 * wording, and the rulebook FAQ's own «spends 2 MC if able» (St. Joseph of
 * Cupertino Mission) is implemented the same way in this engine. Below 4 M€
 * the bot simply pays nothing — that is the card's printed else-branch, not
 * a Failed Action.
 *
 * THE TWO SENTENCES ARE INDEPENDENT, resolved in printed order: the advance
 * ALWAYS happens (and may itself hand the bot the very M€ that then pays for
 * it — a track space can pay), and the payment follows whatever it produced.
 * A least-advanced track that is maxed means EVERY track is maxed, so the
 * shared `advanceTrack` turns that into the official Failed Action — and the
 * bot still pays, because the printed sentence charges unconditionally.
 *
 * LIFECYCLE. B28 rides the same recurring mechanism as Ecoline's B23 and
 * Inventrix's B25 (`AutomaState.recurringBonusCards` +
 * `AutomaResearch.finishActionDeck`): never part of the random bonus-deck
 * rotation, never discarded. The generation-1 insertion happens here because
 * this engine builds that deck at game creation, before the corporation
 * exists; the presence check keeps the hook idempotent — there is exactly ONE
 * B28 in the game, ever.
 */
export const MarsBotRobinsonIndustries: MarsBotCorp = {
  info: INFO,

  setup(game: IGame): void {
    const bot = marsBotOf(game);
    bot.stock.add(Resource.MEGACREDITS, SETUP_MC, {log: false});
    game.log('${0} received ${1} M€ from its corporation ${2}',
      (b) => b.player(bot).number(SETUP_MC).string('Robinson Industries'));
  },

  beforeActionPhase(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined) {
      return;
    }
    if (!automa.recurringBonusCards.includes(BonusCardId.B28_DIVERSIFICATION)) {
      automa.recurringBonusCards.push(BonusCardId.B28_DIVERSIFICATION);
    }
    const present = automa.actionDeck.some((entry) => entry.kind === 'bonus' && entry.id === BonusCardId.B28_DIVERSIFICATION);
    if (!present) {
      const index = game.rng.nextInt(automa.actionDeck.length + 1);
      automa.actionDeck.splice(index, 0, {kind: 'bonus', id: BonusCardId.B28_DIVERSIFICATION});
      // Journal-only (no scope): the deck join is public bookkeeping, not an
      // event worth a notification — the card announces itself when flipped.
      // The card name lives IN the template so the RU journal can name it.
      game.log('${0} shuffled Diversification into its action deck', (b) => b.player(marsBotOf(game)));
    }
  },

  resolveBonusCard(game: IGame, id: BonusCardId): BonusCardOutcome {
    if (id !== BonusCardId.B28_DIVERSIFICATION) {
      throw new Error(`MarsBot Robinson Industries does not own bonus card ${id}`);
    }
    return diversification(game);
  },
};

/** B28 Diversification. Always ends in the recurring holding (never destroyed). */
function diversification(game: IGame): BonusCardOutcome {
  const automa = game.automa;
  if (automa === undefined) {
    throw new Error('Not an automa game');
  }
  const bot = marsBotOf(game);
  bumpCorpStat(game, 'diversificationPlayed');

  // «The least-advanced track, topmost if tied» is the engine's existing wild
  // rule, so it reuses the board's own `getLeastAdvancedTrackIndex` — the very
  // helper `AutomaResolver.resolveTag(Tag.WILD)` uses — rather than a second
  // implementation that could drift from it. The push goes through
  // `advanceTrack`, not `resolveTag`, because no TAG was resolved: writing a
  // wild-tag note into the turn review would be a lie about what happened.
  const trackIndex = automa.board.getLeastAdvancedTrackIndex();
  const before = automa.board.tracks[trackIndex].position;
  AutomaResolver.advanceTrack(game, trackIndex);
  // The track's OWN position — a cascade may have moved others too, and only
  // this one answers "did the printed push land?".
  const advanced = automa.board.tracks[trackIndex].position > before;
  if (advanced) {
    bumpCorpStat(game, 'diversificationPushes');
  }

  // «MarsBot loses 4 MC, if able» — in full or not at all, and AFTER the
  // advance, which may itself have paid the bot enough to cover it.
  const paid = bot.megaCredits >= DIVERSIFICATION_MC;
  if (paid) {
    bot.stock.deduct(Resource.MEGACREDITS, DIVERSIFICATION_MC, {log: true});
    bumpCorpStat(game, 'diversificationMc', DIVERSIFICATION_MC);
  } else {
    bumpCorpStat(game, 'diversificationFree');
    game.log('${0} could not cover the ${1} M€ of Diversification — the step was free',
      (b) => b.player(bot).number(DIVERSIFICATION_MC));
  }

  if (!advanced) {
    // Every track is finished — `advanceTrack` already recorded the official
    // Failed Action; the branch only says WHY the card had nothing to push.
    AutomaTurnLog.setBonusBranch(game, {key: 'Every track is already finished'});
  } else if (paid) {
    AutomaTurnLog.setBonusBranch(game, {key: 'Bought a step on its weakest track for ${0} M€', params: [`${DIVERSIFICATION_MC}`]});
  } else {
    AutomaTurnLog.setBonusBranch(game, {key: 'A free step on its weakest track — the treasury was empty'});
  }
  return 'discard'; // Recurring: `routeBonusCard` keeps it in the holding pool.
}
