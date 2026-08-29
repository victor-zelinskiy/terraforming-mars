/*
 * THE HYDRO DECISION PLAN — the pure shape of «what this movement still asks».
 *
 * A track advance may owe the player DECISIONS before the commit: today that
 * is exactly ONE (the stage-1/2 reward choice — pos 7/9 target picks ride
 * their own nested steps), but the track's future explicitly holds moves that
 * grant SEVERAL stage rewards in one plan. The presentation therefore speaks
 * in a LIST from the start: the reward step renders a plan of length 1
 * through the very same component a longer plan would use, so growing the
 * list is data, never a rework.
 *
 * SERVER-AUTHORITATIVE BY CONSTRUCTION: a decision's options come from the
 * stage model the server's preview vetted; this module only shapes and
 * counts. Nothing here derives eligibility.
 */
import type {HydroStage} from '@/client/components/hydronetwork/hydroStages';
import type {HydroDeltaLine} from '@/client/components/hydronetwork/hydroReward';

/** One reward alternative of a decision — the chips the track prints and the
 *  honest «сейчас → станет» line built for the viewer's own economy. */
export type HydroPlanOption = {
  chips: HydroStage['rewardOptions'][number];
  line: HydroDeltaLine | undefined;
};

/** One decision the movement plan owes before its commit. */
export type HydroPlanDecision = {
  /** Stable identity within the plan (focus anchors to it, never to an index). */
  id: string;
  /** The stage this decision belongs to — every choice stays tied to its stop. */
  stagePosition: number;
  stageNameKey: string;
  options: ReadonlyArray<HydroPlanOption>;
  /** The held option, `undefined` while the decision is still open. */
  chosen: number | undefined;
};

export type HydroPlanProgress = {
  done: number;
  total: number;
  /** The first OPEN decision — where the cursor belongs; -1 when all are made. */
  activeIdx: number;
};

/** Count the plan — pure, spec'd; the strip's progress chip reads this. */
export function hydroPlanProgress(steps: ReadonlyArray<HydroPlanDecision>): HydroPlanProgress {
  let done = 0;
  let activeIdx = -1;
  steps.forEach((s, i) => {
    if (s.chosen !== undefined) {
      done += 1;
    } else if (activeIdx === -1) {
      activeIdx = i;
    }
  });
  return {done, total: steps.length, activeIdx};
}

/** Are all mandatory decisions made? The commit gate of a multi-step plan. */
export function hydroPlanComplete(steps: ReadonlyArray<HydroPlanDecision>): boolean {
  return steps.every((s) => s.chosen !== undefined);
}
