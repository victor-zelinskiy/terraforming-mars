import {InfluenceScaledEffect} from '@/common/parliament/influenceScaling';
import {resolutionCountKind} from '@/common/parliament/resolutionCounts';
import {WinnerRewardDeclaration} from '@/common/parliament/winnerReward';

/*
 * WHICH FAMILY OF SCENARIOS A RESOLUTION READS — derived from its DECLARATION
 * (`scaled` / `winnerReward` / a `count` / a `sequel` term), never from a table
 * keyed by resolution id: the «Полигон» stand opens the family of a resolution
 * it has never seen, and the contract guard (`ResolutionContract.spec`) asks
 * this function for every catalog entry so a card whose declaration fits no
 * family cannot ship silently.
 *
 *   influence     — a payout scaled by influence alone (onto a card, into the supply);
 *   counted       — a COUNT of cards + influence (Architecture Award);
 *   counted-tags  — a COUNT of tags + influence (Central Power Grid);
 *   winner-tile   — a supply payout by influence + the WINNER's tile (Biodome Contest);
 *   sequel        — a second half that reads what the first half left behind (Climate Research).
 */
export const RESOLUTION_FAMILIES = ['influence', 'counted', 'counted-tags', 'winner-tile', 'sequel'] as const;
export type ResolutionFamily = typeof RESOLUTION_FAMILIES[number];

/** The declaration facts the family reads — what the server definition and the client manifest share. */
export type ResolutionFamilyFacts = {
  scaled?: ReadonlyArray<InfluenceScaledEffect>;
  winnerReward?: WinnerRewardDeclaration;
};

/** The scaled part that reads a FIRST part's result (a sequel), if any. */
export function sequelEffectOf(facts: ResolutionFamilyFacts): InfluenceScaledEffect | undefined {
  return facts.scaled?.find((effect) => effect.sequel !== undefined);
}

/** The scaled part with a COUNT term, if any. */
export function countEffectOf(facts: ResolutionFamilyFacts): InfluenceScaledEffect | undefined {
  return facts.scaled?.find((effect) => effect.count !== undefined);
}

/** The scaled part paid ONTO A CARD (the shared picker asks where), if any. */
export function pickerEffectOf(facts: ResolutionFamilyFacts): InfluenceScaledEffect | undefined {
  return facts.scaled?.find((effect) => effect.unit.kind === 'cardResource');
}

export function familyOf(facts: ResolutionFamilyFacts): ResolutionFamily {
  // A SEQUENTIAL resolution first: its second half reads what its first half
  // leaves behind, which is a different instrument from a count.
  if (sequelEffectOf(facts) !== undefined) {
    return 'sequel';
  }
  const count = countEffectOf(facts)?.count;
  if (count !== undefined) {
    return resolutionCountKind(count.id).kind === 'tags' ? 'counted-tags' : 'counted';
  }
  // A winner's TILE with no card to pick for everyone's part: the winner-tile family.
  return facts.winnerReward !== undefined && pickerEffectOf(facts) === undefined ? 'winner-tile' : 'influence';
}
