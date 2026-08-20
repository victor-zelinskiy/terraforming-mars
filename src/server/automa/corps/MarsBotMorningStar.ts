import {Tag} from '../../../common/cards/Tag';
import {BonusCardId, TrackAction} from '../../../common/automa/AutomaTypes';
import {MarsBotCorpId, MarsBotTrackCube, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {inplaceShuffle} from '../../utils/shuffle';
import {AutomaResolver} from '../AutomaResolver';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import type {BonusCardOutcome} from '../AutomaBonusCards';
import {advanceFurthestMartianParameter} from '../AutomaBonusCards';
import {LOBBYISTS_VARIANTS, destroyBonusCard} from './MarsBotBonusDeckOps';
import {takeSilverCube} from './MarsBotSilverCubePayout';
import {MarsBotCorp} from './MarsBotCorp';

const INFO = marsBotCorpInfo(MarsBotCorpId.C27_MORNING_STAR);
/** The corporation's own bonus card, shuffled into the bonus deck at setup. */
const OWN_CARD = BonusCardId.B26_VENUSIAN_LOBBY;
/** The track B26 raises and advances, named by TAG (never an index). */
const OWN_TRACK = Tag.VENUS;

/**
 * MarsBot Morning Star Inc. — official card C27:
 *
 *   STARTING TAGS   Venus, Venus
 *   SETUP           Use this corporation only when playing with Venus Next.
 *                   Destroy Lobbyists from the bonus deck.
 *                   Shuffle Venusian Lobby into the bonus deck.
 *                   Place a silver resource cube on the Venus track on spaces
 *                   #5, #6, #7, #8, #9, #11, and #12.
 *   EFFECT          When MarsBot advances onto a silver resource cube, MarsBot
 *                   gains it as MC.
 *
 * plus its corporation-specific bonus card B26 Venusian Lobby.
 *
 * A CLOSED LOOP ON ONE TRACK. Two printed Venus tags start it two spaces up,
 * its cubes line the far half of that same track, and its own bonus card
 * advances that very track — so every Venusian Lobby is a step toward the next
 * 5 M€, and the money funds nothing but more Venus. C13 Cheung Shing Mars runs
 * the identical payout on the building track and stops there; this one added a
 * card that drives the wheel.
 *
 * THE EFFECT IS C13'S, WORD FOR WORD, so both cards run the ONE implementation
 * in `MarsBotSilverCubePayout` — this file contributes only its identity, its
 * counters and WHERE its cubes sit. They share the legend and the effect text
 * (one rule, one phrasing) and nothing else.
 *
 * THE CUBE RUN IS NOT «FROM #5 ON»: the card lists #5–#9, #11 and #12, so #10
 * is deliberately BARE. Every position is written out in the data rather than
 * generated, and a test pins the gap — a generated run would have quietly
 * invented an eighth cube.
 *
 * «DESTROY LOBBYISTS» is the C05 primitive with the shared variant pair: the
 * deck carries the Venus printing or the base one depending on the modules,
 * and destroying both ids is exact because only one is ever in play. This
 * corporation always plays with Venus Next, so in practice it is B15 — but the
 * pair costs nothing and cannot be wrong.
 */
export const MarsBotMorningStar: MarsBotCorp = {
  info: INFO,

  setup(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined) {
      return;
    }
    const bot = marsBotOf(game);
    for (const id of LOBBYISTS_VARIANTS) {
      if (destroyBonusCard(game, id)) {
        game.log('${0} destroyed Lobbyists from its bonus deck', (b) => b.player(bot));
      }
    }
    // Its own card joins the ordinary bonus rotation (the C12/B31 shape:
    // owned, one-shot, not recurring).
    automa.bonusDeck.push({kind: 'bonus', id: OWN_CARD});
    inplaceShuffle(automa.bonusDeck, game.rng);
  },

  onTrackCubeTrigger(game: IGame, cube: MarsBotTrackCube, _printedAction: TrackAction | undefined): 'replaces-action' | void {
    takeSilverCube(game, cube, {
      original: INFO.original,
      displayName: 'Morning Star Inc.',
      stats: {hits: 'morningCubesHit', mc: 'morningMc'},
    });
    // No «instead of» on this card: the Venus space's printed icon still runs.
  },

  resolveBonusCard(game: IGame, id: BonusCardId): BonusCardOutcome {
    if (id !== OWN_CARD) {
      throw new Error(`MarsBot Morning Star Inc. does not own bonus card ${id}`);
    }
    return venusianLobby(game);
  },
};

/**
 * B26 Venusian Lobby:
 *
 *   "MarsBot raises Venus 1 step and advances its Venus tag track.
 *    Then, MarsBot raises oxygen 1 step, places an ocean, or raises
 *    temperature 1 step, whichever is furthest from being complete."
 *
 * TWO UNCONDITIONAL SENTENCES, in printed order — neither is a fallback for
 * the other, so a maxed Venus does not stop the Martian half, and a finished
 * Mars does not stop the Venus half. Both use the engine's own shared rules:
 * `raiseVenus` through the ordinary track cell (`venus`), and
 * `advanceFurthestMartianParameter`, which is the very function three base
 * bonus cards already use for the same printed sentence.
 *
 * «ADVANCES ITS VENUS TAG TRACK» IS AN ADVANCE, NOT A RESOLVED TAG: no tag was
 * played, so it goes through `advanceTrack` (the C22/C23 reading). That matters
 * here more than anywhere — the Venus track is where this corporation's own
 * silver cubes wait, so the advance can pay it 5 M€ on the spot, and it does so
 * through the shared dispatcher rather than a special case.
 */
function venusianLobby(game: IGame): BonusCardOutcome {
  const automa = game.automa;
  if (automa === undefined) {
    throw new Error('Not an automa game');
  }
  const bot = marsBotOf(game);
  bumpCorpStat(game, 'lobbyPlayed');

  // The Venus half needs the track this corporation is built around. It is
  // always there (the card cannot be seated without Venus Next), but an absent
  // track must not take the MARTIAN half down with it — the two sentences are
  // independent.
  const venusTrack = automa.board.getTrackIndexForTag(OWN_TRACK);
  if (venusTrack !== undefined) {
    // 1. «Raises Venus 1 step» — the shared raise, with its own TR and the
    //    Failed Action on a completed Venus, exactly as any other route.
    AutomaResolver.performTrackAction(game, 'venus', venusTrack);
    bumpCorpStat(game, 'lobbyVenus');

    // 2. «And advances its Venus tag track.»
    game.log('${0} advances its Venus track from its corporation ${1}',
      (b) => b.player(bot).string('Morning Star Inc.'));
    AutomaResolver.advanceTrack(game, venusTrack);
  }

  // 3. «Then … whichever is furthest from being complete» — the shared rule,
  //    an INDEPENDENT second sentence: it runs even if Venus could not move.
  if (advanceFurthestMartianParameter(game)) {
    bumpCorpStat(game, 'lobbyParameter');
    AutomaTurnLog.setBonusBranch(game, {key: 'Venus, then the furthest Martian parameter'});
  } else {
    AutomaTurnLog.setBonusBranch(game, {key: 'Venus moved; Mars was already complete'});
  }
  return 'discard';
}
