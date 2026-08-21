import {TrackAction} from '../../../common/automa/AutomaTypes';
import {MarsBotCorpId, MarsBotCorpResource, MarsBotTrackCube, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {Resource} from '../../../common/Resource';
import {IGame} from '../../IGame';
import {AutomaTerraformer} from '../AutomaTerraformer';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import {MarsBotCorp} from './MarsBotCorp';

const INFO = marsBotCorpInfo(MarsBotCorpId.C43_PALLADIN_SHIPPING);
/** The card's printed name, for the journal templates. */
const NAME = 'Palladin Shipping';
/** What the setup box pays. */
const SETUP_MC = 5;

/** Which on-card kind a cube of this colour becomes once it is on the card. */
function kindOf(cube: MarsBotTrackCube): MarsBotCorpResource {
  return cube.cubeType === 'white' ? 'cube-white' : 'cube-black';
}

/**
 * MarsBot Palladin Shipping — official card C43:
 *
 *   STARTING TAGS   space, event
 *   DRAFT PRIORITY  Space > Event
 *   SETUP           MarsBot gains 5 MC. Place white cubes on the space track
 *                   on spaces #3, #4, #6, #8, #10, and #11. Place black cubes
 *                   on the event track on spaces #3, #4, #6, #8, #10, and #11.
 *   EFFECT          When MarsBot advances onto a white or a black cube, move
 *                   that cube to this card. Once there is one of both colored
 *                   cubes on this card, remove one of each and MarsBot raises
 *                   the temperature 1 step.
 *
 * A SHIPMENT NEEDS BOTH HALVES. The human Palladin Shipping pays for a card
 * that is a SPACE tag AND an EVENT — a space event — and turns the titanium it
 * earns into a step of temperature. The bot has no hand and no titanium, so the
 * same conjunction is struck on the only board it has: white cubes wait on the
 * SPACE track, black ones on the EVENT track, and a step of temperature costs
 * one of EACH. Its own two starting tags and its priority feed exactly those
 * two tracks, so the corporation spends the game trying to keep both moving —
 * a run of six space cards banks six cubes and warms nothing.
 *
 * THE CARD IS A PAIRING SLOT, NOT A STORE, and the printed rule is what makes
 * that a modelling fact rather than a convention: a matching pair leaves the
 * instant both colours are there, so ONE colour is on the card at any resting
 * point. The framework therefore keeps the ordinary single slot
 * (`corpResources` — Ecoline's plant, Spire's science, C35's flag) and adds
 * only WHICH KIND it currently holds (`corpResourceKind`), which makes «two
 * whites and a black» unrepresentable instead of merely wrong. The face draws
 * ONE capsule with the colour actually waiting there, which is what the table
 * looks like.
 *
 * NOTHING ELSE HERE IS NEW. The cube POSITIONS are card data (`trackCubes`,
 * addressed by each track's identity TAG); the seeding, the spent-once
 * bookkeeping and the regression rule are the framework's; and the payout is
 * the shared `AutomaTerraformer.raiseTemperature` — the very call C03's and
 * C41's own «raises the temperature 1 step» make, so it carries its own TR, its
 * own threshold bonuses, its own journal line and its own Failed Action.
 *
 * «MOVE THAT CUBE TO THIS CARD» HAPPENS FIRST, THEN THE PAIR IS CHECKED. That
 * ordering is only visible in one place — the counters: a cube that completes a
 * pair still MOVED (it is counted in `palladinCubesMoved`), it simply never
 * rests. Reading it the other way would under-count every second cube.
 *
 * NEITHER COLOUR SAYS «INSTEAD OF», so RB-B's general rule stands: the cube is
 * taken BEFORE and IN ADDITION to whatever the space prints — which is exactly
 * what returning nothing does. And a completed temperature does not hold the
 * pair back: the cubes are removed and the raise takes the shared Failed Action
 * (the C40/C45 reading of a printed price — it is spent whether or not the
 * thing it buys still exists).
 */
export const MarsBotPalladinShipping: MarsBotCorp = {
  info: INFO,

  setup(game: IGame): void {
    const bot = marsBotOf(game);
    bot.stock.add(Resource.MEGACREDITS, SETUP_MC, {log: false});
    game.log('${0} gained ${1} M€ from its corporation ${2} at setup',
      (b) => b.player(bot).number(SETUP_MC).string(NAME));
  },

  onTrackCubeTrigger(game: IGame, cube: MarsBotTrackCube, _printedAction: TrackAction | undefined): 'replaces-action' | void {
    const automa = game.automa;
    if (automa === undefined) {
      return;
    }
    const arriving = kindOf(cube);
    // What is ON the card right now. A count of 0 has no colour, so the two
    // are read together and never separately.
    const held = automa.corpResources > 0 ? automa.corpResourceKind : undefined;
    const bot = marsBotOf(game);
    const prior = AutomaTurnLog.getCause(game);
    AutomaTurnLog.setCause(game, {kind: 'corporation'});
    game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
    try {
      // The cube moves onto the card whichever way this goes.
      bumpCorpStat(game, 'palladinCubesMoved');
      if (held === undefined || held === arriving) {
        automa.corpResources += 1;
        automa.corpResourceKind = arriving;
        // Two keys rather than one with the colour interpolated: a colour is a
        // WORD, and a word inside a log token would ship untranslated.
        game.log(cube.cubeType === 'white' ?
          '${0} moved a white cube onto its corporation ${1} — it waits there for a black one' :
          '${0} moved a black cube onto its corporation ${1} — it waits there for a white one',
        (b) => b.player(bot).string(NAME));
        return;
      }
      // «Once there is one of both colored cubes on this card, remove one of
      // each»: the arriving cube never rests, and one of the waiting ones goes
      // back to the box with it.
      automa.corpResources -= 1;
      if (automa.corpResources === 0) {
        automa.corpResourceKind = undefined;
      }
      bumpCorpStat(game, 'palladinPairs');
      game.log('${0} paired a white and a black cube on its corporation ${1} — the temperature rises',
        (b) => b.player(bot).string(NAME));
      const before = game.getTemperature();
      AutomaTerraformer.raiseTemperature(game);
      // Counted only when the parameter actually MOVED: a completed
      // temperature took the shared Failed Action, which is a real outcome
      // rather than a step.
      if (game.getTemperature() > before) {
        bumpCorpStat(game, 'palladinTemperatureSteps');
      }
    } finally {
      game.events.endScope();
      AutomaTurnLog.setCause(game, prior);
    }
  },
};
