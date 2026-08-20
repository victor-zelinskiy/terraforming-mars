import {Resource} from '../../../common/Resource';
import {Tag} from '../../../common/cards/Tag';
import {MarsBotCorpId, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {IPlayer} from '../../IPlayer';
import {Board} from '../../boards/Board';
import {Space} from '../../boards/Space';
import {AutomaResolver} from '../AutomaResolver';
import {AutomaTilePlacer} from '../AutomaTilePlacer';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import {MarsBotCorp} from './MarsBotCorp';

const INFO = marsBotCorpInfo(MarsBotCorpId.C10_THARSIS_REPUBLIC);
/** What a human city pays the bot, and which track its own city pushes. */
const HUMAN_CITY_MC = 2;
const REWARD_TRACK = Tag.EVENT;

/**
 * Depth guard for the bot's own half: the event-track advance can place a
 * tile, and a board whose event track prints a CITY would re-enter here. Every
 * cycle costs an event-track step, so a real game never nests — this is a
 * runaway guard, not a rule.
 */
const MAX_DEPTH = 8;
let depth = 0;

/**
 * MarsBot Tharsis Republic — official card C10:
 *
 *   DRAFT PRIORITY  City
 *   SETUP           MarsBot places a city tile.
 *   EFFECT          When you place a city tile, MarsBot gains 2 MC.
 *                   When MarsBot places a city tile, advance the event track.
 *                   These effects also apply to setup.
 *
 * One trigger, two seats, two different rewards — and the ONE hook it needs is
 * `Game.addTile`, where every placement on Mars passes, whoever made it. The
 * seat decides which half fires; «a city tile» is the engine's own rule-true
 * predicate (`Board.isCitySpace`, so a capital counts too), never a hand-rolled
 * tile-type list.
 *
 * «These effects also apply to setup» needs no special case: the corporation
 * is seated before its own setup box runs, so the city it places right there
 * already pushes the event track through this same hook. (A city from the
 * HUMAN's corporation predates the bot's corporation in both the official
 * order — RB-B Setup 1 seats the bot AFTER the human plays theirs — and in
 * this engine, so neither pays.)
 */
export const MarsBotTharsisRepublic: MarsBotCorp = {
  info: INFO,

  setup(game: IGame): void {
    // The shared placer: city strategy, Ares avoidance, tie-breaks, the
    // Failed Action when the board has no room — and the placement itself
    // then triggers the effect below, exactly as «also apply to setup» says.
    AutomaTilePlacer.placeCity(game);
  },

  onTilePlaced(game: IGame, player: IPlayer, space: Space): void {
    if (!Board.isCitySpace(space)) {
      return;
    }
    if (player.isMarsBot) {
      advanceEventTrack(game);
      return;
    }
    payForHumanCity(game);
  },
};

/** «When you place a city tile, MarsBot gains 2 MC.» */
function payForHumanCity(game: IGame): void {
  const bot = marsBotOf(game);
  const prior = AutomaTurnLog.getCause(game);
  AutomaTurnLog.setCause(game, {kind: 'corporation'});
  game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
  try {
    bot.stock.add(Resource.MEGACREDITS, HUMAN_CITY_MC, {log: false});
    game.log('${0} gained ${1} M€ from its corporation ${2}: a city was founded',
      (b) => b.player(bot).number(HUMAN_CITY_MC).string('Tharsis Republic'));
  } finally {
    game.events.endScope();
    AutomaTurnLog.setCause(game, prior);
  }
  bumpCorpStat(game, 'tharsisHumanCities');
  bumpCorpStat(game, 'tharsisMc', HUMAN_CITY_MC);
}

/** «When MarsBot places a city tile, advance the event track.» */
function advanceEventTrack(game: IGame): void {
  const automa = game.automa;
  if (automa === undefined || depth >= MAX_DEPTH) {
    return;
  }
  const trackIndex = automa.board.getTrackIndexForTag(REWARD_TRACK);
  if (trackIndex === undefined) {
    return; // No event track on this board — nothing to push.
  }
  const bot = marsBotOf(game);
  const prior = AutomaTurnLog.getCause(game);
  AutomaTurnLog.setCause(game, {kind: 'corporation'});
  game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
  depth++;
  try {
    bumpCorpStat(game, 'tharsisBotCities');
    game.log('${0} founded a city — its corporation ${1} advances the event track',
      (b) => b.player(bot).string('Tharsis Republic'));
    // The shared advance: the space's printed icon, cascades, cubes and the
    // Failed Action on a completed track all behave as anywhere else.
    AutomaResolver.advanceTrack(game, trackIndex);
  } finally {
    depth--;
    game.events.endScope();
    AutomaTurnLog.setCause(game, prior);
  }
}
