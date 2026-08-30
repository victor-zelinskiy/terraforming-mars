import {RequirementType} from '../../../common/cards/RequirementType';
import {IPlayer} from '../../IPlayer';
import {InequalityRequirement} from './InequalityRequirement';

/**
 * «Requires that you have moved N steps on the Delta Project track.»
 *
 * The Hydronetwork position IS the steps-moved count — movement on the track
 * is monotone (positions only ever increase; nothing moves a marker back), so
 * no separate lifetime counter exists or is needed: the server-authoritative
 * `deltaProjectData.position` is the exact source of truth. The start cell
 * (position 0) counts as zero steps by construction. Defaults to 0 when the
 * Delta Project module is off (`deltaProjectData` is seeded only with the
 * module — the same guard DP01/DP04 use), so the requirement is simply
 * unmeetable rather than a crash in a mixed-deck edge.
 */
export class DeltaPositionRequirement extends InequalityRequirement {
  public readonly type = RequirementType.DELTA_POSITION;
  public getScore(player: IPlayer): number {
    return player.deltaProjectData?.position ?? 0;
  }
}
