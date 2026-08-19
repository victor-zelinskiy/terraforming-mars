import {TrackAction} from '../../../common/automa/AutomaTypes';
import {MarsBotCorpId, MarsBotTrackCube, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {drawAndResolveProjectCard} from '../AutomaCardDraw';
import {AutomaTerraformer} from '../AutomaTerraformer';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import {MarsBotCorp} from './MarsBotCorp';

/**
 * MarsBot Helion — official card C03:
 *
 *   SETUP   Place a white cube on the building track space #6, the space
 *           track space #9, the science track space #10, the power track
 *           spaces #5 and #9, the plant track space #11.
 *           Place a black cube on the Earth track spaces #3, #6, #9, #12,
 *           #13, and #14.
 *   EFFECT  When MarsBot advances onto a white cube, instead of raising the
 *           temperature, MarsBot draws and resolves a card from the project
 *           deck. When MarsBot advances onto a black cube, MarsBot raises the
 *           temperature 1 step.
 *
 * The cube POSITIONS are card data (`info.trackCubes`, addressed by the
 * track's identity TAG); seeding, the spent-once bookkeeping and the
 * regression rule are the framework's (`AutomaCorporations.onTrackAdvanced`).
 * This module is only the two printed consequences.
 *
 * WHITE — the card's explicit «instead of» case: every white cube of C03 sits
 * on a printed TEMPERATURE space (verified against the Tharsis layout), and
 * the draw REPLACES that raise (`'replaces-action'`). Should a white cube ever
 * sit on a non-temperature space (no official card does), the general RB-B
 * rule applies instead — the draw resolves BEFORE and IN ADDITION to the
 * printed icon — which is exactly what returning nothing does.
 *
 * BLACK — no «instead of» clause, so the general rule stands: +1 temperature
 * BEFORE and IN ADDITION to whatever the space prints (Earth #9 award, #12/#14
 * greenery, #13 TR — all still resolve).
 */
export const MarsBotHelion: MarsBotCorp = {
  info: marsBotCorpInfo(MarsBotCorpId.C03_HELION),

  onTrackCubeTrigger(game: IGame, cube: MarsBotTrackCube, printedAction: TrackAction | undefined): 'replaces-action' | void {
    const bot = marsBotOf(game);
    const prior = AutomaTurnLog.getCause(game);
    AutomaTurnLog.setCause(game, {kind: 'corporation'});
    game.events.beginEffect(bot, {kind: 'corporation', card: this.info.original, owner: bot.color}, 'automa-corporation');
    try {
      if (cube.cubeType === 'white') {
        bumpCorpStat(game, 'whiteCubesHit');
        const replaces = printedAction === 'temperature' || printedAction === 'temperature2';
        game.log(replaces ?
          '${0} reached a white cube of its corporation ${1} — instead of the temperature it draws a card' :
          '${0} reached a white cube of its corporation ${1} — it draws a card',
        (b) => b.player(bot).string('Helion'));
        if (drawAndResolveProjectCard(game)) {
          bumpCorpStat(game, 'helionCardsDrawn');
        }
        if (replaces) {
          bumpCorpStat(game, 'helionTemperatureReplaced');
          return 'replaces-action';
        }
        return;
      }
      // BLACK: the printed icon still resolves afterwards (the caller's job).
      bumpCorpStat(game, 'blackCubesHit');
      game.log('${0} reached a black cube of its corporation ${1}', (b) => b.player(bot).string('Helion'));
      const before = game.getTemperature();
      // The shared raise logs its own line and turns a completed track into
      // the official Failed Action — the cube owes no second voice.
      AutomaTerraformer.raiseTemperature(game);
      if (game.getTemperature() > before) {
        bumpCorpStat(game, 'helionTemperatureSteps');
      }
    } finally {
      game.events.endScope();
      AutomaTurnLog.setCause(game, prior);
    }
  },
};
