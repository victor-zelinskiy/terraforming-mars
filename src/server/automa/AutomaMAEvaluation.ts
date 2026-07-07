import {Tag} from '../../common/cards/Tag';
import {IAward} from '../awards/IAward';
import {IMilestone} from '../milestones/IMilestone';
import {IGame} from '../IGame';
import {marsBotOf} from './AutomaUtil';
import {THARSIS_TRACK} from './boards/TharsisMarsBot';

function trackPosition(game: IGame, index: number): number {
  return game.automa?.board.tracks[index]?.position ?? 0;
}

/**
 * How MarsBot evaluates milestones & awards (rulebook pp.8-9, Tharsis; +
 * Hoverlord/Venuphile from Adding Expansions pp.2-3): its strength comes from
 * the board reference card - its tracks and tiles - never from played cards.
 * A dedicated module (no AwardScorer import) so AwardScorer itself can consult
 * it without an import cycle.
 */
export class AutomaMAEvaluation {
  /** "How MarsBot determines how it meets milestones" — Tharsis reference card. */
  public static botMilestoneMet(milestone: IMilestone, game: IGame): boolean {
    const bot = marsBotOf(game);
    switch (milestone.name) {
    case 'Builder': // Space 8 on the Building track (the human counts building tags).
      return trackPosition(game, THARSIS_TRACK.BUILDING) >= 8;
    case 'Planner': // Space 4 on every track — except Venus (Adding Expansions p.2).
      return game.automa?.board.tracks
        .filter((t) => !t.definition.tags.includes(Tag.VENUS))
        .every((t) => t.position >= 4) ?? false;
    case 'Hoverlord': // Unchanged: 7 floater resources (Adding Expansions p.2).
      return (game.automa?.floaters ?? 0) >= 7;
    default:
      // "Unchanged" milestones (Terraformer — incl. the fork's Terraformer29
      // threshold variant — Mayor, Gardener) evaluate the bot exactly like a
      // player: its TR and its tiles are real, so the milestone's own canClaim
      // is the honest source. A card-based milestone that cannot appear here
      // (validateOptions pins the board set) reads the bot's empty tableau and
      // is honestly "not met".
      return milestone.canClaim(bot);
    }
  }

  /** A display value for the milestone score list (progress toward the automa criterion). */
  public static botMilestoneScore(milestone: IMilestone, game: IGame): number {
    const bot = marsBotOf(game);
    switch (milestone.name) {
    case 'Builder': return trackPosition(game, THARSIS_TRACK.BUILDING);
    case 'Planner': {
      const tracks = game.automa?.board.tracks.filter((t) => !t.definition.tags.includes(Tag.VENUS)) ?? [];
      return tracks.length === 0 ? 0 : Math.min(...tracks.map((t) => t.position));
    }
    case 'Hoverlord': return game.automa?.floaters ?? 0;
    default: return milestone.getScore(bot); // "Unchanged" milestones: the bot is an ordinary player.
    }
  }

  /**
   * "How MarsBot determines how it stands within each award" — Tharsis
   * reference card (+ Venuphile). Easy difficulty: every value −5 (rulebook
   * p.11, no floor — the printed rule has none).
   */
  public static botAwardScore(award: IAward, game: IGame): number {
    const bot = marsBotOf(game);
    let score: number;
    switch (award.name) {
    case 'Landlord': // Unchanged: tiles owned in play.
      score = award.getScore(bot);
      break;
    case 'Banker':
      score = trackPosition(game, THARSIS_TRACK.BUILDING) + trackPosition(game, THARSIS_TRACK.EVENT);
      break;
    case 'Scientist':
      score = trackPosition(game, THARSIS_TRACK.SCIENCE);
      break;
    case 'Thermalist':
      score = trackPosition(game, THARSIS_TRACK.ENERGY) + 5;
      break;
    case 'Miner':
      score = trackPosition(game, THARSIS_TRACK.SPACE) + 5;
      break;
    case 'Venuphile': { // Venus track position (Adding Expansions p.3).
      const venusTrack = game.automa?.board.tracks.find((t) => t.definition.tags.includes(Tag.VENUS));
      score = venusTrack?.position ?? 0;
      break;
    }
    default:
      // Tile-based awards evaluate the bot's real board presence; anything else
      // cannot appear (validateOptions pins the Tharsis set).
      score = award.getScore(bot);
      break;
    }
    if (game.automa?.difficulty === 'easy') {
      score -= 5;
    }
    return score;
  }
}
