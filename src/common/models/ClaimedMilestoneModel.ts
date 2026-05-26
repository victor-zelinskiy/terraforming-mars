import {Color} from '../Color';
import {MilestoneName} from '../ma/MilestoneName';

export type MilestoneScore = {
  color: Color;
  score: number;
  claimable?: boolean;
}

export type ClaimedMilestoneModel = {
  name: MilestoneName;
  playerName: string | undefined;
  color: Color | undefined;
  scores: Array<MilestoneScore>;
  // Per-game threshold and description. The server populates these so that
  // milestones whose target varies by expansion (e.g. Terraformer is 35
  // normally, 26 with Turmoil) report the correct number for this match.
  // Both are optional: callers can fall back to the static manifest data
  // when consuming the model outside live-game contexts (mocks, tests).
  threshold?: number;
  description?: string;
}
