import {MilestoneName} from './MilestoneName';
import {AwardName} from './AwardName';
import {Expansion} from '../cards/GameModule';

type ClientMA<T> = {
  name: T;
  description: string;
  requirements: Expansion | undefined;
  // Numeric threshold needed to claim (Milestone) or to score one point (Award).
  // Only defined for the BaseMilestone / BaseAward implementations — special
  // ones (e.g. Terraformer, Coastguard) leave it undefined and the UI just
  // shows the current score without a target.
  threshold?: number;
}

export type ClientMilestone = ClientMA<MilestoneName>;
export type ClientAward = ClientMA<AwardName>;
