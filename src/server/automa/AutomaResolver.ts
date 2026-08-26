import * as constants from '../../common/constants';
import {CardType} from '../../common/cards/CardType';
import {CardResource} from '../../common/CardResource';
import {GlobalParameter} from '../../common/GlobalParameter';
import {Tag} from '../../common/cards/Tag';
import {TrackAction} from '../../common/automa/AutomaTypes';
import {IGame} from '../IGame';
import {IProjectCard} from '../cards/IProjectCard';
import {failedAction} from './AutomaFailedAction';
import {AutomaCorporations} from './corps/AutomaCorporations';
import {AutomaHumanTagReactions} from './AutomaHumanTagReactions';
import {AutomaMilestonesAwards} from './AutomaMilestonesAwards';
import {AutomaTurnLog} from './AutomaTurnLog';
import {marsBotOf} from './AutomaUtil';
import {AutomaTerraformer} from './AutomaTerraformer';
import {AutomaTilePlacer} from './AutomaTilePlacer';

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

  /**
   * Resolve a flipped project card: its printed tags, left to right.
   * `tagLimit` cuts that row short — C11 Thorgate's white cube resolves a card
   * «ignoring all except its first tag». A card with NO tags is still the
   * official Failed Action, limit or not.
   */
  public static resolveProjectCard(game: IGame, card: IProjectCard, options?: {tagLimit?: number}): void {
    const printed = AutomaResolver.printedTags(card);
    if (printed.length === 0) {
      failedAction(game, 'no-tags');
      return;
    }
    const tags = options?.tagLimit === undefined ? printed : printed.slice(0, options.tagLimit);
    // Phase B: attribute each tag's steps to its printed position so the review
    // builds one cause → effect chain per tag (left to right), from data.
    for (let i = 0; i < tags.length; i++) {
      AutomaTurnLog.setCause(game, {kind: 'tag', index: i});
      AutomaResolver.resolveTag(game, tags[i]);
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
        // Next) is an unused-expansion icon: ignored, no Failed Action — but
        // the tag WAS resolved, so a corporation watching for it still reacts.
        AutomaTurnLog.note(game, {kind: 'tag', tag});
        AutomaCorporations.onTagResolved(game, tag);
        return;
      }
    }
    AutomaTurnLog.note(game, {kind: 'tag', tag, trackIndex});
    AutomaResolver.advanceTrack(game, trackIndex);
    // The corporation's own «when MarsBot resolves a <tag>» clause (C08),
    // AFTER the tag did its work — the trigger reacts to a finished event.
    AutomaCorporations.onTagResolved(game, tag);
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
    const from = track.position;
    const result = track.advance();
    if (result.type === 'maxed') {
      // "MarsBot is already at the end of a track and needs to advance that
      // track" → Failed Action (rulebook p.6).
      failedAction(game, 'track-maxed');
      return;
    }
    // The space the marker came to REST on. Captured here because the printed
    // icon below may carry the marker further ('advance'), and every «which
    // space did it reach?» question is about the landing, not the chain's end.
    const landed = track.position;
    AutomaTurnLog.note(game, {
      kind: 'advance',
      trackIndex,
      from,
      to: landed,
      ...(result.type === 'action' ? {action: result.action} : {}),
      // Phase B: the cascade depth (0 = the tag's direct advance) — the review
      // nests the chain reaction from data instead of guessing by order.
      ...(depth > 0 ? {depth} : {}),
    });
    // Colonies (Adding Expansions p.6): reaching the 9th space of the POWER
    // track unlocks the 2nd trade fleet — in ADDITION to the space's effect.
    // «Place a second Trade Fleet on the 9th space of the [power] track»
    // (Adding Expansions p.4); the Hellas board prints that very reminder on
    // its power track's space 9 too. Addressed by ROLE, never by row index.
    // Inline (no AutomaColonies import) to keep the module graph acyclic.
    if (game.gameOptions.coloniesExtension && !automa.secondFleetUnlocked &&
        trackIndex === automa.board.getTrackIndexOfRole('power') && track.position === 9) {
      automa.secondFleetUnlocked = true;
      game.log('${0} unlocked its second trade fleet', (b) => b.player(marsBotOf(game)));
    }
    // A cell whose printed icon is a MICROBE tag (Venus board, cell 9): a
    // «microbe advancement» — the sanctioned human reactors (Pharmacy Union /
    // Splice) resolve as if a card with a microbe was played (RB-B FAQ).
    if (track.definition.microbeTagCells?.includes(track.position)) {
      AutomaHumanTagReactions.onBotMicrobeAdvancement(game);
      // … and the BOT's own corporation, if its clause watches microbes: the
      // same FAQ, read symmetrically (C24 Splice). No tag was resolved here,
      // so `onTagResolved` deliberately does not fire and nothing double-pays.
      AutomaCorporations.onMicrobeAdvancement(game);
    }
    // A corporation CUBE seeded on this space (RB-B «Special Cubes»): it fires
    // BEFORE the printed icon and IN ADDITION to it — unless the card
    // explicitly replaces that icon (Helion's white cube takes over the
    // temperature raise). Spent once, never re-armed by a regression.
    const printed = result.type === 'action' ? result.action : undefined;
    const cubeReplacedAction = AutomaCorporations.onTrackAdvanced(game, trackIndex, landed, printed);
    if (result.type === 'action' && !cubeReplacedAction) {
      AutomaResolver.performTrackAction(game, result.action, trackIndex, depth);
    }
    // The landed-on space is now fully resolved, cascade and all — the moment a
    // corporation worded «when a track reaches #N, AFTER resolving the effect»
    // acts on (C29). The AFTER twin of the cube/advance dispatch above; it may
    // advance this very track again, which is why it gets `depth`.
    AutomaCorporations.onTrackSpaceResolved(game, trackIndex, landed, depth);
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
      //
      // The icon is printed with BOTH expansion badges (Venus + Colonies) on the
      // map boards that carry it, and is defined in both sections of Adding
      // Expansions. With NEITHER expansion it is an icon of an unused expansion:
      // ignored, no Failed Action (rulebook p.7). No-op on Tharsis, whose only
      // floater cells live on the Venus board itself.
      if (!game.gameOptions.venusNextExtension && !game.gameOptions.coloniesExtension) {
        return;
      }
      const count = action === 'floater2' ? 2 : 1;
      automa.floaters += count;
      game.log('${0} gained ${1} ${2}', (b) => b.player(bot).number(count).cardResource(CardResource.FLOATER));
      return;
    }
    case 'temperature':
      AutomaTerraformer.raiseTemperature(game);
      return;
    case 'temperature2':
      // A doubled icon: two single steps, each checked separately (the second
      // raise onto a just-completed temperature is a Failed Action).
      AutomaTerraformer.raiseTemperature(game);
      AutomaTerraformer.raiseTemperature(game);
      return;
    case 'greenery':
      AutomaTilePlacer.placeGreenery(game);
      return;
    case 'ocean':
      AutomaTilePlacer.placeOcean(game);
      return;
    case 'city':
      AutomaTilePlacer.placeCity(game);
      return;
    case 'milestone':
      AutomaMilestonesAwards.claimMilestoneAction(game);
      return;
    case 'award':
      AutomaMilestonesAwards.fundAwardAction(game);
      return;
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
    // Without the module there is nothing to raise and nothing to replace —
    // the corporation is consulted only where a real raise was going to be
    // attempted (C36).
    if (AutomaCorporations.replacesParameterRaise(game, GlobalParameter.VENUS)) {
      return;
    }
    if (game.getVenusScaleLevel() >= constants.MAX_VENUS_SCALE) {
      failedAction(game, 'venus-maxed');
      return;
    }
    const bot = marsBotOf(game);
    game.increaseVenusScaleLevel(bot, 1);
    game.log('${0} raised ${1} ${2} step(s)', (b) => b.player(bot).globalParameter(GlobalParameter.VENUS).number(1));
  }
}
