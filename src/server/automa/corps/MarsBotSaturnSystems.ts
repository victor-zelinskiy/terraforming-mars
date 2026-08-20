import {Tag} from '../../../common/cards/Tag';
import {MarsBotCorpId, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {IPlayer} from '../../IPlayer';
import {ICard} from '../../cards/ICard';
import {AutomaResolver} from '../AutomaResolver';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import {MarsBotCorp} from './MarsBotCorp';

const INFO = marsBotCorpInfo(MarsBotCorpId.C08_SATURN_SYSTEMS);
/** The tag the effect watches, and the track it pays into. */
const TRIGGER_TAG = Tag.JOVIAN;
const REWARD_TRACK = Tag.EVENT;

/**
 * MarsBot Saturn Systems — official card C08:
 *
 *   STARTING TAGS   jovian, space, space, space
 *   DRAFT PRIORITY  Jovian > space
 *   EFFECT          When either you play a card containing a Jovian tag or
 *                   MarsBot resolves a Jovian tag, including this, advance
 *                   the event track.
 *
 * The first corporation that watches BOTH SEATS: the human's Jupiter projects
 * push the bot's event track just as the bot's own Jovian tags do. Each side
 * is triggered at its own granularity, exactly as printed — «you play a CARD
 * containing a Jovian tag» is one advance per card however many Jovian tags it
 * carries, while «MarsBot resolves a Jovian TAG» is one per tag, because that
 * is how the bot processes a card at all (tag by tag, left to right).
 *
 * «Including this» is the corporation's own printed Jovian starting tag: it
 * runs through the very same `resolveTag` path at setup, so it triggers with
 * no special case — the bot opens the game with an event-track step.
 *
 * No recursion is possible: the reward ADVANCES a track, and a track advance
 * never resolves a tag (a `tag_N` cell advances another track directly).
 */
export const MarsBotSaturnSystems: MarsBotCorp = {
  info: INFO,

  onTagResolved(game: IGame, tag: Tag): void {
    if (tag !== TRIGGER_TAG) {
      return;
    }
    advanceEventTrack(game, 'saturnFromBot',
      '${0} resolved a Jovian tag — its corporation ${1} advances the event track');
  },

  onHumanCardPlayed(game: IGame, player: IPlayer, card: ICard): void {
    // «A card CONTAINING a Jovian tag» — the printed row, counted the same way
    // the human Saturn Systems counts it (a literal tag, never a wild one).
    if (player.tags.cardTagCount(card, TRIGGER_TAG) === 0) {
      return;
    }
    advanceEventTrack(game, 'saturnFromHuman',
      '${1} advances the event track of ${0}: a Jovian card was played');
  },
};

function advanceEventTrack(game: IGame, stat: string, template: string): void {
  const automa = game.automa;
  if (automa === undefined) {
    return;
  }
  const trackIndex = automa.board.getTrackIndexForTag(REWARD_TRACK);
  if (trackIndex === undefined) {
    return; // No event track on this board — nothing to pay into.
  }
  const bot = marsBotOf(game);
  const prior = AutomaTurnLog.getCause(game);
  AutomaTurnLog.setCause(game, {kind: 'corporation'});
  game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
  try {
    bumpCorpStat(game, 'saturnEventAdvances');
    bumpCorpStat(game, stat);
    game.log(template, (b) => b.player(bot).string('Saturn Systems'));
    // The shared advance: the space's printed icon, cascades, cubes, Failed
    // Action on a completed track — all exactly as any other advance.
    AutomaResolver.advanceTrack(game, trackIndex);
  } finally {
    game.events.endScope();
    AutomaTurnLog.setCause(game, prior);
  }
}
