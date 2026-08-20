import {Resource} from '../../../common/Resource';
import {TrackAction} from '../../../common/automa/AutomaTypes';
import {MarsBotCorpId, MarsBotTrackCube, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {drawAndResolveProjectCard} from '../AutomaCardDraw';
import {AutomaTerraformer} from '../AutomaTerraformer';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import {MarsBotCorp} from './MarsBotCorp';

const INFO = marsBotCorpInfo(MarsBotCorpId.C11_THORGATE);
/** The printed setup gift. */
const SETUP_MC = 10;

/**
 * MarsBot ThorGate — official card C11:
 *
 *   STARTING TAG    power
 *   DRAFT PRIORITY  Power
 *   SETUP           MarsBot gains 10 MC. Place a white cube on the power track
 *                   on spaces #4, #6, #8, and #10.
 *   EFFECT          When MarsBot advances onto a white cube, MarsBot draws a
 *                   card from the project deck and resolves it, ignoring all
 *                   except its first tag. Then, MarsBot raises the temperature
 *                   1 step.
 *
 * The cubes are data (`info.trackCubes`); seeding, spent-once and the
 * regression rule belong to the framework. What is this card's own is the
 * RESTRICTED resolution: the flipped card is played normally — the journal,
 * the played pile, the corporation dispatch and the RB-B human reactors all
 * see the whole card — but only its FIRST printed tag advances a track
 * (`tagLimit: 1`). «Ignoring all except its first tag» is about which tracks
 * MarsBot moves, not about which card entered play.
 *
 * Nothing says «instead of», so RB-B's general rule stands: the space's own
 * printed icon resolves too, after the cube (the caller's job). The closing
 * temperature step rides the shared raise, so a completed temperature turns it
 * into the official Failed Action instead of a silent no-op.
 */
export const MarsBotThorgate: MarsBotCorp = {
  info: INFO,

  setup(game: IGame): void {
    const bot = marsBotOf(game);
    bot.stock.add(Resource.MEGACREDITS, SETUP_MC, {log: false});
    game.log('${0} received ${1} M€ from its corporation ${2}',
      (b) => b.player(bot).number(SETUP_MC).string('ThorGate'));
  },

  onTrackCubeTrigger(game: IGame, cube: MarsBotTrackCube, _printedAction: TrackAction | undefined): 'replaces-action' | void {
    if (cube.cubeType !== 'white') {
      return;
    }
    const bot = marsBotOf(game);
    const prior = AutomaTurnLog.getCause(game);
    AutomaTurnLog.setCause(game, {kind: 'corporation'});
    game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
    try {
      bumpCorpStat(game, 'thorgateCubesHit');
      game.log('${0} reached a white cube of its corporation ${1} — it draws a card and resolves only its first tag',
        (b) => b.player(bot).string('ThorGate'));
      if (drawAndResolveProjectCard(game, {tagLimit: 1})) {
        bumpCorpStat(game, 'thorgateCardsDrawn');
      }
      // «Then, MarsBot raises the temperature 1 step» — the shared raise logs
      // its own line and turns a completed track into the official Failed
      // Action, so the cube owes no second voice.
      const before = game.getTemperature();
      AutomaTerraformer.raiseTemperature(game);
      if (game.getTemperature() > before) {
        bumpCorpStat(game, 'thorgateTemperatureSteps');
      }
    } finally {
      game.events.endScope();
      AutomaTurnLog.setCause(game, prior);
    }
    // No «instead of» on this card: the space's printed icon still resolves.
  },
};
