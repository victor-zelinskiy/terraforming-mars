import {MilestoneName} from '../../common/ma/MilestoneName';
import {IPlayer} from '../IPlayer';
import {IGame} from '../IGame';

export interface IMilestone {
  name: MilestoneName;
  description: string;
  canClaim(player: IPlayer): boolean;
  getScore(player: IPlayer): number;
  // Optional per-game overrides. Most milestones have a single fixed
  // threshold + description; a few (Terraformer) vary by expansion (e.g.
  // Turmoil's lower terraform-rating target). When implemented, the server
  // uses these to populate ClaimedMilestoneModel for the current game so
  // the client shows the right numbers without baking expansion logic in.
  getThreshold?(game: IGame): number;
  getDescription?(game: IGame): string;
}

/**
 * The milestone's threshold FOR THIS GAME: the per-game override first
 * (Terraformer's lower Turmoil target), else the printed number.
 *
 * `undefined` for a milestone whose rule is not «score ≥ N» — a caller must
 * not invent a number for those (the console renders them as met / not-met
 * instead of a progress bar).
 *
 * One helper because two consumers must agree by construction: the model the
 * client receives (`Server.getMilestones`) and the scale MarsBot's progress is
 * normalized onto (`AutomaMAEvaluation.botMilestoneScore`).
 */
export function milestoneThreshold(milestone: IMilestone, game: IGame): number | undefined {
  if (milestone.getThreshold !== undefined) {
    return milestone.getThreshold(game);
  }
  return (milestone as Partial<BaseMilestone>).threshold;
}

export abstract class BaseMilestone implements IMilestone {
  public readonly name: MilestoneName;
  public readonly description: string;
  public readonly threshold: number;

  constructor(name: MilestoneName, description: string, threshold: number) {
    this.name = name;
    this.description = description;
    this.threshold = threshold;
  }

  public abstract getScore(player: IPlayer): number;
  public canClaim(player: IPlayer): boolean {
    return this.getScore(player) >= this.threshold;
  }
}
