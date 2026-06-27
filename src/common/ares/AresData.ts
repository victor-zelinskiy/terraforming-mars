import {PlayerId} from '../Types';
import {Color} from '../Color';

export type AresData = {
  includeHazards: boolean;
  hazardData: HazardData;
  milestoneResults: Array<MilestoneCount>;
}

export type HazardConstraint = {
    threshold: number,
    available: boolean,
    /**
     * The COLOUR of the player who crossed this threshold (set when the event
     * fires, i.e. when `available` flips to false). Stored as the colour — not the
     * id — because it is public + directly usable by the client UI (which never
     * receives other players' ids). Drives the premium scale-marker "claimed"
     * painting for a planetary event that rewards the triggering player
     * (`removeDustStormsOceanCount` → +1 TR); the no-reward hazard events record it
     * too (it is honestly "who triggered it") but the client leaves them neutral.
     * Absent on a threshold that hasn't fired (or an older save).
     */
    triggeredByColor?: Color,
}

export const HAZARD_CONSTRAINTS = [
  'erosionOceanCount',
  'removeDustStormsOceanCount',
  'severeErosionTemperature',
  'severeDustStormOxygen',
] as const;

/*
 * This is the same as
 * type HazardData = {
 *   erosionOceanCount: HazardConstraint;
 *   removeDustStormsOceanCount: HazardConstraint;
 *   severeErosionTemperature: HazardConstraint;
 *   severeDustStormOxygen: HazardConstraint;
 * }
 */
export type HazardData = Record<typeof HAZARD_CONSTRAINTS[number], HazardConstraint>;

export type MilestoneCount = {
  id: PlayerId;
  networkerCount: number;
  purifierCount: number;
}
