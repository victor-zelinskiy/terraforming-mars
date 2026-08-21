import {Tag} from '../../../common/cards/Tag';
import {MarsBotCorpId, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {IPlayer} from '../../IPlayer';
import {Board} from '../../boards/Board';
import {Space} from '../../boards/Space';
import {AutomaResolver} from '../AutomaResolver';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import {MarsBotCorp} from './MarsBotCorp';

const INFO = marsBotCorpInfo(MarsBotCorpId.C35_LAKEFRONT_RESORTS);
/** The card's printed name, for the journal templates. */
const NAME = 'Lakefront Resorts';
/** Which track a spent cube pushes. */
const REWARD_TRACK = Tag.BUILDING;
/** The printed rate for a tile placed beside water — the human twin's number. */
const WATERFRONT_BONUS = 3;

/**
 * How deep the flip may re-enter itself. A building-track advance can land on
 * a space that places an OCEAN (the mat prints ocean spaces on every track),
 * and that ocean flips this card again — a real, terminating chain, because
 * only every SECOND ocean spends a cube and every spend costs a track step.
 * A corrupted mat must still not be able to hang a turn: this is a runaway
 * guard, not a rule. Module-level and never serialized (C22's law).
 */
const MAX_CASCADE = 20;
let cascadeDepth = 0;

/**
 * MarsBot Lakefront Resorts — official card C35:
 *
 *   SETUP   Place a white cube on this card.
 *   EFFECT  When an ocean tile is placed, if there is a white cube on this
 *           card, remove it and advance the building track. Otherwise, place
 *           a white cube here.
 *           MarsBot's bonus for placing adjacent to an ocean tile is 3 MC
 *           (instead of 2 MC).
 *
 * A CARD WITH A MEMORY OF EXACTLY ONE BIT. Every other corporation reacts to
 * an event the same way each time; this one alternates, so what an ocean is
 * worth depends on the ocean before it. The cube IS that bit — the setup box
 * places it precisely so the FIRST ocean of the game is a paying one, and
 * from then on the odd oceans (1st, 3rd, 5th…) push the building track while
 * the even ones re-arm the card. It lives in the same on-card socket every
 * other corp resource does (`AutomaState.corpResources`, serialized and
 * public), because on the table it is the same physical thing: a cube sitting
 * on the corporation card.
 *
 * «WHEN AN OCEAN TILE IS PLACED» IS BOTH SEATS AND THE ENGINE'S OWN READING.
 * The sentence names no placer, so a human ocean flips the card exactly as
 * the bot's own does — one hook (`Game.addTile`) sees both. And the HUMAN
 * Lakefront Resorts prints that same trigger for its own production gain, so
 * the predicate is taken from it rather than re-derived:
 * `Board.isUncoveredOceanSpace` — a genuinely NEW ocean, never an Ocean City
 * or a sanctuary laid over one that was already there.
 *
 * THE SECOND SENTENCE IS ONE FIELD, and it is the field the human twin uses:
 * `player.oceanBonus` (the engine pays `adjacent oceans × oceanBonus` in the
 * shared `Game.grantPlacementBonuses`, whoever placed the tile — its own
 * comment used to note that the bot simply keeps the default 2). Setting it
 * at setup inherits every path at once: the bot's own tiles, tiles from a
 * track space, tiles a bonus card places. Nothing about it is restated here;
 * this file only MEASURES what the rate added, and the measurement re-derives
 * the neighbour count through the board's own query — the money is the
 * engine's alone.
 */
export const MarsBotLakefrontResorts: MarsBotCorp = {
  info: INFO,

  setup(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined) {
      return;
    }
    const bot = marsBotOf(game);
    const prior = AutomaTurnLog.getCause(game);
    AutomaTurnLog.setCause(game, {kind: 'corporation'});
    game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
    try {
      automa.corpResources = 1;
      // The standing rate — the same field the human Lakefront Resorts sets.
      bot.oceanBonus = WATERFRONT_BONUS;
      game.log('${0} placed a white cube on its corporation ${1} — its tiles beside water now pay ${2} M€',
        (b) => b.player(bot).string(NAME).number(WATERFRONT_BONUS));
    } finally {
      game.events.endScope();
      AutomaTurnLog.setCause(game, prior);
    }
  },

  onTilePlaced(game: IGame, player: IPlayer, space: Space): void {
    // What the bot's own placement earned beside the water — measured, never
    // paid here: `grantPlacementBonuses` already settled it at the printed
    // rate. The count comes from the board's own adjacency query, so this can
    // never disagree with what was paid.
    if (player.isMarsBot) {
      const {oceans} = game.board.oceanAdjacencyBonus(player, space);
      if (oceans > 0) {
        bumpCorpStat(game, 'lakefrontWaterfront');
        bumpCorpStat(game, 'lakefrontExtraMc', oceans * (WATERFRONT_BONUS - 2));
      }
    }
    if (!Board.isUncoveredOceanSpace(space)) {
      return;
    }
    flip(game);
  },
};

/**
 * «If there is a white cube on this card, remove it and advance the building
 * track. Otherwise, place a white cube here.»
 */
function flip(game: IGame): void {
  const automa = game.automa;
  if (automa === undefined || cascadeDepth >= MAX_CASCADE) {
    return;
  }
  const bot = marsBotOf(game);
  bumpCorpStat(game, 'lakefrontOceans');
  const trackIndex = automa.board.getTrackIndexForTag(REWARD_TRACK);
  const prior = AutomaTurnLog.getCause(game);
  AutomaTurnLog.setCause(game, {kind: 'corporation'});
  game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
  cascadeDepth++;
  try {
    if (automa.corpResources >= 1) {
      if (trackIndex === undefined) {
        return; // No building track on this board — the cube stays armed.
      }
      automa.corpResources--;
      game.log('${0} spent the white cube on its corporation ${1}: a new ocean advances the building track',
        (b) => b.player(bot).string(NAME));
      bumpCorpStat(game, 'lakefrontSteps');
      // The shared advance: the space's printed icon, cascades, cubes and the
      // Failed Action on a completed track all behave as anywhere else.
      AutomaResolver.advanceTrack(game, trackIndex, cascadeDepth);
    } else {
      automa.corpResources++;
      game.log('${0} put a white cube back on its corporation ${1}: a new ocean re-armed it',
        (b) => b.player(bot).string(NAME));
    }
  } finally {
    cascadeDepth--;
    game.events.endScope();
    AutomaTurnLog.setCause(game, prior);
  }
}
