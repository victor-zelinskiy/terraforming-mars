import {Tag} from '../../../common/cards/Tag';
import {IPlayer} from '../../IPlayer';
import {InequalityRequirement} from './InequalityRequirement';
import {Options} from './CardRequirement';
import {RequirementType} from '../../../common/cards/RequirementType';

/** The adjectives of a printed tag requirement that change how it counts. */
export type TagRequirementReading = {max?: boolean, all?: boolean};

/**
 * The event tag is the card TYPE, never printed in `card.tags`, so `Tags.count`
 * never sees it. Under Odyssey the played events stay face up (`eventTagsInPlay`)
 * and each one shows its tag — the count Curator reads (`getPlayedEventsCount`).
 */
function faceUpEventTags(player: IPlayer, tag: Tag): number {
  return tag === Tag.EVENT && player.tags.eventTagsInPlay() ? player.getPlayedEventsCount() : 0;
}

/**
 * THE ONE READING of a printed tag requirement «N tags of X»: the tags of `tag`
 * the player has for the requirement. `TagCardRequirement` asks it for its own
 * tag; «N tags of any one type» (`TagsOfOneTypeRequirement`, Turmoil Redux TR01)
 * asks it for every tag type in play and keeps the maximum — so every
 * substitution a printed requirement honours (wild tags, the Scientists' wild
 * tag, R&D Funding's science tags, Earth Embassy, Habitat Marte, the classic
 * Scientists P4 bonus) reaches both the same way.
 */
export function tagRequirementScore(player: IPlayer, tag: Tag, reading: TagRequirementReading = {}): number {
  const mode = reading.max !== true ? 'default' : 'raw-pf';
  let tagCount = player.tags.count(tag, mode) + faceUpEventTags(player, tag);

  if (reading.all) {
    player.opponents.forEach((p) => {
      // Don't include opponents' wild tags because they are not performing the action.
      tagCount += p.tags.count(tag, 'raw') + faceUpEventTags(p, tag);
    });
  }
  // PoliticalAgendas Scientists P4 hook
  if (tag === Tag.SCIENCE && player.hasTurmoilScienceTagBonus) {
    tagCount += 1;
  }

  return tagCount;
}

/**
 * Evaluate whether a player (or all players) have played at least (or at most) a given number of tags.
 *
 * (e.g. Requires 2 energy tags, or requires at most 1 science tag.)
 */
export class TagCardRequirement extends InequalityRequirement {
  public readonly type = RequirementType.TAG;
  public readonly tag: Tag;
  constructor(tag: Tag, options?: Partial<Options>) {
    super(options);
    this.tag = tag;
  }

  public getScore(player: IPlayer): number {
    return tagRequirementScore(player, this.tag, {max: this.max, all: this.all});
  }
}
