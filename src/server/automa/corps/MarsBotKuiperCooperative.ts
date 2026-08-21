import {TrackAction} from '../../../common/automa/AutomaTypes';
import {MarsBotCorpId, MarsBotTrackCube, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {AutomaTerraformer} from '../AutomaTerraformer';
import {AutomaTilePlacer} from '../AutomaTilePlacer';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import {MarsBotCorp} from './MarsBotCorp';

const INFO = marsBotCorpInfo(MarsBotCorpId.C41_KUIPER_COOPERATIVE);
/** The card's printed name, for the journal templates. */
const NAME = 'Kuiper Cooperative';

/**
 * MarsBot Kuiper Cooperative — official card C41:
 *
 *   STARTING TAG    space
 *   DRAFT PRIORITY  Space
 *   SETUP           Place a white cube on the space track on spaces #4, #8
 *                   and #12. Place a black cube on the space track on spaces
 *                   #7, #10 and #14.
 *   EFFECT          When MarsBot advances onto a white cube, MarsBot raises
 *                   the temperature 1 step. When MarsBot advances onto a
 *                   black cube, MarsBot places an ocean tile.
 *
 * THE WHOLE CARD IS ONE TRACK. Its starting tag, its draft priority and all
 * six of its cubes sit on the SPACE track: the corporation drafts space cards,
 * every one of them pushes that track, and the track is mined with six
 * milestones that terraform Mars for free. The human Kuiper Cooperative hurls
 * asteroids and comets from beyond Neptune — heat and water — and these are
 * exactly the two things its cubes deliver.
 *
 * NOTHING HERE IS A NEW MECHANISM. The cube POSITIONS are card data
 * (`info.trackCubes`, addressed by the track's identity TAG); the seeding, the
 * spent-once bookkeeping and the regression rule are the framework's
 * (`AutomaCorporations.onTrackAdvanced`); and each colour's consequence is a
 * SHARED primitive — `AutomaTerraformer.raiseTemperature` (the very function
 * C03 Helion's black cube calls, so the two printed «raises the temperature 1
 * step» sentences are one implementation) and `AutomaTilePlacer.placeOcean`.
 * Both carry their own TR, their own placement bonuses, their own journal line
 * and their own Failed Action, so this module owes none of that a second
 * voice. No separate push module is extracted: what C14/C19/C23 share is a
 * RULE (which track a colour advances), while these two colours share only
 * primitives that are already one function each.
 *
 * NEITHER COLOUR SAYS «INSTEAD OF», so RB-B's general rule stands: the cube
 * fires BEFORE and IN ADDITION to whatever the space prints — which is exactly
 * what returning nothing does. On the Tharsis mat that is visible at #14,
 * where a black cube lays an ocean and the space then raises the temperature
 * on its own.
 */
export const MarsBotKuiperCooperative: MarsBotCorp = {
  info: INFO,

  onTrackCubeTrigger(game: IGame, cube: MarsBotTrackCube, _printedAction: TrackAction | undefined): 'replaces-action' | void {
    const bot = marsBotOf(game);
    const prior = AutomaTurnLog.getCause(game);
    AutomaTurnLog.setCause(game, {kind: 'corporation'});
    game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
    try {
      if (cube.cubeType === 'white') {
        bumpCorpStat(game, 'kuiperWhiteCubes');
        game.log('${0} reached a white cube of its corporation ${1} — the temperature rises',
          (b) => b.player(bot).string(NAME));
        const before = game.getTemperature();
        AutomaTerraformer.raiseTemperature(game);
        // Counted only when the parameter actually MOVED: a completed
        // temperature took the shared Failed Action, which is a real outcome
        // rather than a step.
        if (game.getTemperature() > before) {
          bumpCorpStat(game, 'kuiperTemperatureSteps');
        }
        return;
      }
      bumpCorpStat(game, 'kuiperBlackCubes');
      game.log('${0} reached a black cube of its corporation ${1} — an ocean is placed',
        (b) => b.player(bot).string(NAME));
      const oceansBefore = game.board.getOceanSpaces().length;
      AutomaTilePlacer.placeOcean(game);
      if (game.board.getOceanSpaces().length > oceansBefore) {
        bumpCorpStat(game, 'kuiperOceans');
      }
    } finally {
      game.events.endScope();
      AutomaTurnLog.setCause(game, prior);
    }
  },
};
