import * as constants from '../../common/constants';
import {CardType} from '../../common/cards/CardType';
import {Tag} from '../../common/cards/Tag';
import {Resource} from '../../common/Resource';
import {FAILED_ACTION_MC, FAILED_ACTION_MC_EASY, TrackAction} from '../../common/automa/AutomaTypes';
import {IGame} from '../IGame';
import {IProjectCard} from '../cards/IProjectCard';
import {marsBotOf} from './AutomaSetup';

/**
 * Why MarsBot took a Failed Action. Each maps to its own full log template so
 * the journal always explains the cause (never a vague "failed"). Phase 7/9
 * add the tile/temperature/milestone/award reasons.
 */
export type FailedActionReason = 'no-tags' | 'track-maxed' | 'venus-maxed';

const FAILED_ACTION_TEMPLATES: Record<FailedActionReason, string> = {
  'no-tags': '${0} took a Failed Action (the card has no tags) and gained ${1} M€',
  'track-maxed': '${0} took a Failed Action (the track is already at its end) and gained ${1} M€',
  'venus-maxed': '${0} took a Failed Action (Venus is already complete) and gained ${1} M€',
};

/** A data-error guard only: layouts are strictly forward-moving, so a real game never gets near this. */
const MAX_CASCADE_DEPTH = 32;

/**
 * Resolves a MarsBot project card (rulebook p.5): top-right tags left-to-right,
 * one at a time, each advancing its track; landing on an action icon performs
 * it immediately (which may cascade); a maxed track / a tagless card is a
 * Failed Action; the icon of an expansion that is not in use is ignored.
 */
export class AutomaResolver {
  /**
   * The printed top-right tag row. The engine stores a card's tags WITHOUT the
   * event tag (no card declares Tag.EVENT — the red arrow is implied by
   * CardType.EVENT), while the physical card prints the event tag LAST. This
   * digital product's canonical tag order is the `tags` array as rendered —
   * the event tag is appended at the end to match the print.
   */
  public static printedTags(card: IProjectCard): Array<Tag> {
    const tags: Array<Tag> = card.tags.filter((tag) => tag !== Tag.EVENT);
    if (card.type === CardType.EVENT) {
      tags.push(Tag.EVENT);
    }
    return tags;
  }

  public static resolveProjectCard(game: IGame, card: IProjectCard): void {
    const tags = AutomaResolver.printedTags(card);
    if (tags.length === 0) {
      AutomaResolver.failedAction(game, 'no-tags');
      return;
    }
    for (const tag of tags) {
      AutomaResolver.resolveTag(game, tag);
    }
  }

  public static resolveTag(game: IGame, tag: Tag): void {
    const automa = game.automa;
    if (automa === undefined) {
      throw new Error('Not an automa game');
    }
    let trackIndex: number | undefined;
    if (tag === Tag.WILD) {
      // Prelude rules: a Wild tag advances the least-advanced track, topmost if
      // tied (getLeastAdvancedTrackIndex returns the first — topmost — on ties).
      trackIndex = automa.board.getLeastAdvancedTrackIndex();
    } else {
      trackIndex = automa.board.getTrackIndexForTag(tag);
      if (trackIndex === undefined) {
        // A tag with no track on this board (e.g. a Venus tag without Venus
        // Next) is an unused-expansion icon: ignored, no Failed Action.
        return;
      }
    }
    AutomaResolver.advanceTrack(game, trackIndex);
  }

  public static advanceTrack(game: IGame, trackIndex: number, depth: number = 0): void {
    if (depth > MAX_CASCADE_DEPTH) {
      throw new Error('MarsBot track cascade runaway — corrupt track data?');
    }
    const automa = game.automa;
    if (automa === undefined) {
      throw new Error('Not an automa game');
    }
    const track = automa.board.tracks[trackIndex];
    const result = track.advance();
    if (result.type === 'maxed') {
      // "MarsBot is already at the end of a track and needs to advance that
      // track" → Failed Action (rulebook p.6).
      AutomaResolver.failedAction(game, 'track-maxed');
      return;
    }
    if (result.type === 'action') {
      AutomaResolver.performTrackAction(game, result.action, trackIndex, depth);
    }
  }

  public static performTrackAction(game: IGame, action: TrackAction, trackIndex: number, depth: number = 0): void {
    const automa = game.automa;
    if (automa === undefined) {
      throw new Error('Not an automa game');
    }
    const bot = marsBotOf(game);

    if (action === 'advance') {
      // Easy difficulty: "Ignore the Advance Tracker action" (rulebook p.11).
      if (automa.difficulty === 'easy') {
        return;
      }
      AutomaResolver.advanceTrack(game, trackIndex, depth + 1);
      return;
    }
    if (action.startsWith('tag_')) {
      AutomaResolver.advanceTrack(game, Number(action.substring(4)), depth + 1);
      return;
    }
    if (/^tr\d$/.test(action)) {
      const steps = Number(action.substring(2));
      bot.increaseTerraformRating(steps, {log: true});
      return;
    }
    switch (action) {
    case 'venus':
      AutomaResolver.raiseVenus(game);
      return;
    case 'venus2':
      // A doubled Venus icon: two single steps, each checked separately (the
      // second raise on a just-completed Venus is a Failed Action).
      AutomaResolver.raiseVenus(game);
      AutomaResolver.raiseVenus(game);
      return;
    case 'floater':
    case 'floater2': {
      // "Gain Floater" (Adding Expansions p.2/p.4). Without Venus Next the token
      // physically goes to the Titan storage area — same single pool for the
      // research-phase floater spend, so `automa.floaters` is the one counter.
      const count = action === 'floater2' ? 2 : 1;
      automa.floaters += count;
      game.log('${0} gained ${1} floater(s)', (b) => b.player(bot).number(count));
      return;
    }
    case 'temperature':
    case 'temperature2':
    case 'greenery':
    case 'ocean':
    case 'city':
      throw new Error(`MarsBot track action '${action}' is not implemented yet (Automa Phase 7)`);
    case 'milestone':
    case 'award':
      throw new Error(`MarsBot track action '${action}' is not implemented yet (Automa Phase 9)`);
    default:
      throw new Error(`Unknown MarsBot track action '${action}'`);
    }
  }

  /**
   * "Raise Venus 1 Step" (Adding Expansions p.2): +1 step, TR per the normal
   * rules; a maxed Venus is a Failed Action. Without Venus Next the icon is an
   * unused-expansion icon: ignored, no Failed Action.
   */
  private static raiseVenus(game: IGame): void {
    if (!game.gameOptions.venusNextExtension) {
      return;
    }
    if (game.getVenusScaleLevel() >= constants.MAX_VENUS_SCALE) {
      AutomaResolver.failedAction(game, 'venus-maxed');
      return;
    }
    const bot = marsBotOf(game);
    game.increaseVenusScaleLevel(bot, 1);
    game.log('${0} raised Venus 1 step', (b) => b.player(bot));
  }

  /** "MarsBot gains 5 M€ from taking a Failed Action" (3 on Easy). */
  public static failedAction(game: IGame, reason: FailedActionReason): void {
    const automa = game.automa;
    if (automa === undefined) {
      throw new Error('Not an automa game');
    }
    const bot = marsBotOf(game);
    const mc = automa.difficulty === 'easy' ? FAILED_ACTION_MC_EASY : FAILED_ACTION_MC;
    bot.stock.add(Resource.MEGACREDITS, mc);
    game.log(FAILED_ACTION_TEMPLATES[reason], (b) => b.player(bot).number(mc));
  }
}
