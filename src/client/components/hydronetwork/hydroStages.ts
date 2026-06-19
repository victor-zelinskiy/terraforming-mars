import {Tag} from '@/common/cards/Tag';
import {Resource} from '@/common/Resource';
import {DELTA_STAGE_NAMES} from '@/common/delta/deltaStages';

/**
 * Static, presentation-only definition of the Delta Project ("Гидросеть") track.
 * The DYNAMIC parts (current position, legality, missing tags, occupancy) come
 * from the server preview ({@link DeltaTrackPreviewModel}); this is the fixed
 * per-stage data the overlay merges with it (names, required tag, reward,
 * follow-up flow). Indexed by track position 0..11.
 *
 * The reward `rewardOptions` order MUST match the server's reward `OrOptions`
 * order in `DeltaProjectExpansion.resolveReward` (steel before plants; energy
 * before heat) — the chosen alternative INDEX is submitted as the OrOptions
 * response, so they must line up.
 */

export type HydroSpecialReward =
  | 'plants-per-plant-tag'
  | 'draw-4-keep-2'
  | 'reuse-blue-action'
  | 'jovian-tag'
  | 'add-2-animals';

/** One reward token — a standard resource/production gain OR a special effect. */
export type HydroRewardChip = {
  resource?: Resource;
  amount?: number;
  production?: boolean;
  special?: HydroSpecialReward;
};

/** A reward needing a post-confirm premium flow (not pre-collected in the modal). */
export type HydroFollowUp = 'draw' | 'reuse-action' | 'add-animals';

export type HydroStage = {
  position: number;
  /** English i18n key (DELTA_STAGE_NAMES[position]) — translated by the overlay. */
  nameKey: string;
  /** Required tag for positions 1..9 (undefined for start / VP slots). */
  tag?: Tag;
  /** End-game VP for the finish slots (2 for pos 10, 5 for pos 11). */
  vp?: number;
  /** Reward alternatives: a single option is fixed; two options are a choice. */
  rewardOptions: ReadonlyArray<ReadonlyArray<HydroRewardChip>>;
  /** A reward resolved by a premium follow-up flow after confirming. */
  followUp?: HydroFollowUp;
};

export const HYDRO_STAGES: ReadonlyArray<HydroStage> = [
  {position: 0, nameKey: DELTA_STAGE_NAMES[0], rewardOptions: []},
  {
    position: 1, nameKey: DELTA_STAGE_NAMES[1], tag: Tag.BUILDING,
    rewardOptions: [
      [{resource: Resource.STEEL, amount: 2}],
      [{resource: Resource.PLANTS, amount: 2}],
    ],
  },
  {
    position: 2, nameKey: DELTA_STAGE_NAMES[2], tag: Tag.POWER,
    rewardOptions: [
      [{resource: Resource.ENERGY, amount: 1, production: true}],
      [{resource: Resource.HEAT, amount: 1, production: true}],
    ],
  },
  {
    position: 3, nameKey: DELTA_STAGE_NAMES[3], tag: Tag.EARTH,
    rewardOptions: [[{resource: Resource.MEGACREDITS, amount: 2, production: true}]],
  },
  {
    position: 4, nameKey: DELTA_STAGE_NAMES[4], tag: Tag.SPACE,
    rewardOptions: [[{resource: Resource.TITANIUM, amount: 1, production: true}]],
  },
  {
    position: 5, nameKey: DELTA_STAGE_NAMES[5], tag: Tag.SCIENCE,
    rewardOptions: [[{special: 'draw-4-keep-2'}]], followUp: 'draw',
  },
  {
    position: 6, nameKey: DELTA_STAGE_NAMES[6], tag: Tag.PLANT,
    rewardOptions: [[{special: 'plants-per-plant-tag'}]],
  },
  {
    position: 7, nameKey: DELTA_STAGE_NAMES[7], tag: Tag.MICROBE,
    rewardOptions: [[{special: 'reuse-blue-action'}]], followUp: 'reuse-action',
  },
  {
    position: 8, nameKey: DELTA_STAGE_NAMES[8], tag: Tag.JOVIAN,
    rewardOptions: [[{special: 'jovian-tag'}]],
  },
  {
    position: 9, nameKey: DELTA_STAGE_NAMES[9], tag: Tag.ANIMAL,
    rewardOptions: [[{special: 'add-2-animals'}]], followUp: 'add-animals',
  },
  {position: 10, nameKey: DELTA_STAGE_NAMES[10], vp: 2, rewardOptions: []},
  {position: 11, nameKey: DELTA_STAGE_NAMES[11], vp: 5, rewardOptions: []},
];

/** True when the stage's reward is a player choice (positions 1 and 2). */
export function hydroStageNeedsChoice(stage: HydroStage): boolean {
  return stage.rewardOptions.length > 1;
}

/** i18n key describing a follow-up flow ("После подтверждения: …"). */
export const HYDRO_FOLLOWUP_KEY: Readonly<Record<HydroFollowUp, string>> = {
  'draw': 'Look at the top 4 cards, take up to 2',
  'reuse-action': 'Use a blue card action already used this generation',
  'add-animals': 'Add 2 animals to any card',
};
