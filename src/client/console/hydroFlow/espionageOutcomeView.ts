/*
 * THE ESPIONAGE OUTCOME READING — one pure mapper from the SERVER's
 * per-player stage-outcome projection ({@link DeltaStageOutcomeProjection})
 * to the console's established reward vocabulary (`HydroRewardChip` — the
 * same chips every Hydronetwork stage renders through `HydroReward.vue`).
 *
 * Three surfaces read it and therefore cannot diverge: the target selector's
 * candidate rows, the play composer's setup summary, and the execution
 * scene's target-commit line. It ADDS no rule: amounts, candidates and void
 * clauses all arrive computed by the server; this module only chooses which
 * chip/sentence carries each shape.
 */

import type {DeltaStageOutcomeProjection} from '@/common/models/DeltaEspionageModel';
import type {HydroRewardChip} from '@/client/components/hydronetwork/hydroStages';

export type EspionageOutcomeView = {
  /** Chip rows — one row per alternative for a CHOICE (rendered «… или …»),
   *  one row otherwise. Empty when the outcome is a sentence, not chips. */
  chipOptions: ReadonlyArray<ReadonlyArray<HydroRewardChip>>;
  /** True ⇔ the subject picks one of `chipOptions` themselves. */
  isChoice: boolean;
  /** A VP terminal's value (positions 10/11) — rendered beside the 'VP' key. */
  vpAmount?: number;
  /** A NAMED void/fizzle («no silent loss») — an i18n key. */
  skippedKey?: string;
};

/** i18n keys of the named void clauses. */
export const ESPIONAGE_SKIP_KEY = {
  automaRules: 'No stage reward (Bot rules)',
  noRepeat: 'No usable action to repeat — the reward would fizzle',
  noAnimalHost: 'No card can host the animals — the reward would fizzle',
  jovianClaimed: 'The Jovian tag is already claimed — no effect',
} as const;

export function espionageOutcomeView(
  outcome: DeltaStageOutcomeProjection | undefined,
  rewardSkipped?: 'automa-rules',
): EspionageOutcomeView {
  if (rewardSkipped === 'automa-rules') {
    return {chipOptions: [], isChoice: false, skippedKey: ESPIONAGE_SKIP_KEY.automaRules};
  }
  if (outcome === undefined) {
    return {chipOptions: [], isChoice: false};
  }
  switch (outcome.kind) {
  case 'stock':
    return {chipOptions: [[{resource: outcome.resource, amount: outcome.amount}]], isChoice: false};
  case 'production':
    return {chipOptions: [[{resource: outcome.resource, amount: outcome.amount, production: true}]], isChoice: false};
  case 'choice':
    return {
      chipOptions: outcome.options.map((o) => [{
        resource: o.resource, amount: o.amount,
        ...(o.production === true ? {production: true} : {}),
      }]),
      isChoice: true,
    };
  case 'draw':
    return {chipOptions: [[{special: 'draw-4-keep-2'}]], isChoice: false};
  case 'repeat-action':
    if (outcome.candidates === 0) {
      return {chipOptions: [], isChoice: false, skippedKey: ESPIONAGE_SKIP_KEY.noRepeat};
    }
    return {chipOptions: [[{special: 'reuse-blue-action'}]], isChoice: false};
  case 'jovian-tag':
    if (outcome.alreadyClaimed) {
      return {chipOptions: [], isChoice: false, skippedKey: ESPIONAGE_SKIP_KEY.jovianClaimed};
    }
    return {chipOptions: [[{special: 'jovian-tag'}]], isChoice: false};
  case 'card-resource':
    if (outcome.candidates === 0) {
      return {chipOptions: [], isChoice: false, skippedKey: ESPIONAGE_SKIP_KEY.noAnimalHost};
    }
    return {chipOptions: [[{special: 'add-2-animals'}]], isChoice: false};
  case 'vp':
    return {chipOptions: [], isChoice: false, vpAmount: outcome.amount};
  case 'none':
    return {chipOptions: [], isChoice: false};
  default:
    return {chipOptions: [], isChoice: false};
  }
}
