import {Tag} from '../../../common/cards/Tag';
import {TrackAction} from '../../../common/automa/AutomaTypes';
import {MarsBotCorpId, MarsBotTrackCube, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {ColoniesHandler} from '../../colonies/ColoniesHandler';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import {pushCubeTrack} from './MarsBotCubeTrackPush';
import {MarsBotCorp} from './MarsBotCorp';

const INFO = marsBotCorpInfo(MarsBotCorpId.C30_ARIDOR);
/** The track every cube pays into, named by TAG (never an index). */
const PAID_TRACK = Tag.EVENT;
/**
 * ONE journal line for both colours: this card's own sentence draws no
 * distinction between them, so borrowing C14/C19's per-colour keys would state
 * a rule Aridor does not print.
 */
const CUBE_LOG = '${0} reached a cube of its corporation ${1} — its event track moves';

/**
 * MarsBot Aridor — official card C30:
 *
 *   STARTING TAGS   none
 *   DRAFT PRIORITY  least-advanced
 *   SETUP           Use this corp only when playing with Colonies.
 *                   Place 5 white cubes: building track #3, space track #3,
 *                   science #3, power track #3, Jovian track #6.
 *                   Place 4 black cubes: Earth track #3, city track #6,
 *                   plant track #3 and #6.
 *                   Add an additional Colony tile to play.
 *   EFFECT          When MarsBot advances onto a black or white cube, advance
 *                   the event track.
 *
 * THE CARD THAT TURNS BREADTH INTO EVENTS. Its priority feeds whichever track
 * lags furthest behind, its cubes ring EVERY track but one at #3 (and again at
 * #6 on the three that carry two tags), and every one of them pays the SAME
 * track — the event one, which is the only track it leaves bare. So the bot
 * spreads because the draft makes it spread, and the spreading itself drives a
 * track nothing else on the card touches. C14 Point Luna is the inverse shape:
 * ONE track as the clock, the whole mat as the payout.
 *
 * THE COLOUR IS A COMPONENT, NOT A RULE. «A black OR white cube» is one
 * sentence with one outcome — the card uses two colours because nine cubes of
 * one colour are not in the box. So both colours push the same track, share
 * one journal line and one counter, and the mat draws ONE legend row with both
 * swatches. Reading a difference into the colours here would invent a rule.
 *
 * THE MAT'S TRACKS ARE FEWER THAN THE CARD'S NAMES. Power and Jovian are one
 * track, Earth and city are another — so «power track #3, Jovian track #6»
 * seeds ONE row twice, and «Earth track #3, city track #6» does the same. The
 * data says what the CARD says (addressed by tag) and `cubesOf` resolves it,
 * which is exactly why cube positions were made tag-addressed in the first
 * place.
 *
 * «ADD AN ADDITIONAL COLONY TILE TO PLAY» is the one thing a bot corporation
 * has never done before: it changes the SHARED table, not the bot's own
 * material — the new colony is open to the human too. The choice is the only
 * part that differs from the human Aridor's identical sentence (the bot never
 * receives a prompt, so it takes one at seeded random); everything after the
 * choice is the engine's own `seatColonyTile`, shared with that card.
 */
export const MarsBotAridor: MarsBotCorp = {
  info: INFO,

  setup(game: IGame): void {
    const bot = marsBotOf(game);
    // The pool is what the dealer set aside at game creation. It can be empty
    // (a forced colony list of exactly the dealt size), and an empty box is
    // not an error — the human card's own path logs and moves on too.
    const available = game.discardedColonies;
    if (available.length === 0) {
      game.log('No available colony tiles for ${0} to choose from', (b) => b.player(bot));
      return;
    }
    const colonyTile = available[game.rng.nextInt(available.length)];
    ColoniesHandler.seatColonyTile(game, bot, colonyTile);
    bumpCorpStat(game, 'aridorColonyAdded');
  },

  onTrackCubeTrigger(game: IGame, cube: MarsBotTrackCube, _printedAction: TrackAction | undefined): 'replaces-action' | void {
    pushCubeTrack(game, cube, {
      original: INFO.original,
      displayName: 'Aridor',
      pushes: {
        white: {target: PAID_TRACK, logKey: CUBE_LOG, stat: 'aridorCubesHit'},
        black: {target: PAID_TRACK, logKey: CUBE_LOG, stat: 'aridorCubesHit'},
      },
      stepsStat: 'aridorSteps',
    });
    // No «instead of» on this card: the landed-on space's printed icon still runs.
  },
};
