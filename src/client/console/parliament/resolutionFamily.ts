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
 *   counted-board — a COUNT of the player's TILES on the board + influence (Colonization Funding's
 *                   space cities) — the instrument is a set of CELLS, not a tableau;
 *   distributed   — a card-resource payout LAID OUT over the player's holders, 0..N per card
 *                   (Cloud Development: floaters by Venus + Jovian tags + influence) — the count
 *                   is a term of it, the SPREAD is what the player works with;
 *   winner-tile   — a supply payout by influence + the WINNER's tile (Biodome Contest);
 *   sequel        — a second half that reads what the first half left behind (Climate Research);
 *   colony-bonuses — the player's COLONY BONUSES paid a number of times (Colonial Affairs: 2 + 1 per 2
 *                   influence) — the instrument is the LEDGER of the player's tiles, multiplied.
 */
export const RESOLUTION_FAMILIES = ['influence', 'counted', 'counted-tags', 'counted-board', 'distributed', 'winner-tile', 'sequel', 'colony-bonuses'] as const;
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

/** The card-resource part the player LAYS OUT over several holders (the shared distribution), if any. */
export function spreadEffectOf(facts: ResolutionFamilyFacts): InfluenceScaledEffect | undefined {
  return facts.scaled?.find((effect) => effect.unit.kind === 'cardResource' && effect.unit.spread === true);
}

/** The part paid as the player's COLONY BONUSES a number of times, if any. */
export function colonyBonusesEffectOf(facts: ResolutionFamilyFacts): InfluenceScaledEffect | undefined {
  return facts.scaled?.find((effect) => effect.unit.kind === 'colonyBonuses');
}

export function familyOf(facts: ResolutionFamilyFacts): ResolutionFamily {
  // THE COLONY LEDGER first: what is multiplied is the player's own tiles, an instrument no other family has.
  if (colonyBonusesEffectOf(facts) !== undefined) {
    return 'colony-bonuses';
  }
  // A SEQUENTIAL resolution next: its second half reads what its first half
  // leaves behind, which is a different instrument from a count.
  if (sequelEffectOf(facts) !== undefined) {
    return 'sequel';
  }
  // A SPREAD next: the player's instrument is the layout over their holders;
  // whatever counts toward N is a term of the reading, not the family.
  if (spreadEffectOf(facts) !== undefined) {
    return 'distributed';
  }
  const count = countEffectOf(facts)?.count;
  if (count !== undefined) {
    switch (resolutionCountKind(count.id).kind) {
    case 'tags': return 'counted-tags';
    case 'board': return 'counted-board';
    case 'cards': return 'counted';
    }
  }
  // A winner's TILE with no card to pick for everyone's part: the winner-tile family.
  return facts.winnerReward !== undefined && pickerEffectOf(facts) === undefined ? 'winner-tile' : 'influence';
}
