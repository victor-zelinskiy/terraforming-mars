import {RequirementType} from '../../../common/cards/RequirementType';
import {IPlayer} from '../../IPlayer';
import {InequalityRequirement} from './InequalityRequirement';
import {tagRequirementScore} from './TagCardRequirement';

/**
 * «Requires that you have at least N of any one type of tag.» (Turmoil Redux —
 * TR01 Supreme Expertise is the first card to print it.)
 *
 * The score is the MAXIMUM over the tag types (`Tags.tagTypesInPlay` — Curator's
 * vocabulary: no wild tag, no clone tag, the event tag only under Odyssey), each
 * type counted exactly as the printed requirement «N tags of X» counts it
 * (`tagRequirementScore`). So a wild tag adds to every type at once and never
 * sums across them, and 5 building + 5 science tags are 5, never 10.
 */
export class TagsOfOneTypeRequirement extends InequalityRequirement {
  public readonly type = RequirementType.TAGS_OF_ONE_TYPE;
  public getScore(player: IPlayer): number {
    return Math.max(0, ...player.tags.tagTypesInPlay().map((tag) => tagRequirementScore(player, tag, {max: this.max, all: this.all})));
  }
}
