import {MilestoneName} from '../../common/ma/MilestoneName';
import {AwardName} from '../../common/ma/AwardName';

export type MAName = MilestoneName | AwardName;

/**
 * vize1215 fork — random-pool de-duplication policy.
 *
 * The unified random milestone/award pool (RandomMAOptionType.ALL / UNLIMITED, and the Hollandia /
 * "no fixed set" fallback) is "pure random" with no synergy balancing. Without a guard that lets two
 * milestones/awards that reward THE SAME THING land in one game — e.g. a milestone for "7 steel+titanium
 * production" next to an award for "the most steel+titanium production", or two awards both rewarding
 * animal resources. Those pairs read as duplicates (and several even share a Russian name), and make the
 * setup strategically flat.
 *
 * Each entry below groups milestones/awards by their SCORING VECTOR (what the player must actually build
 * to score it). The random selector picks AT MOST ONE milestone/award from each group, so a random game
 * never offers two MAs that chase the same engine. This is the analog of the official synergy table for
 * the pool that deliberately switched the synergy filter off — but it is explicit metadata keyed on the
 * stable MA name, so it can't silently drift, and it's the SINGLE SOURCE OF TRUTH for the regression
 * guard (tests/ma/MilestoneAwardDeduplication.spec.ts) that also enforces Russian-name uniqueness.
 *
 * Notes:
 * - Exact clone pairs (same effect, redundant — Terraformer/Terraformer29, Tycoon/Tycoon10, Smith/
 *   Metallurgist, Tradesman/Trader, Builder/Builder7, …) are handled separately: the non-canonical clone
 *   is marked `deprecated` (or sits in UNIFIED_POOL_EXCLUSIONS), so it never enters the pool at all. Only
 *   the canonical survivor appears here.
 * - This guard applies to the RANDOM selector only (the Accumulator). It does NOT touch the fixed/NONE
 *   board sets — those are official, hand-curated layouts (e.g. the Ares pair Networker + Entrepreneur is
 *   meant to be played together) and must be left exactly as designed.
 * - A member that needs an expansion is filtered out before the selector runs (compatibility check), so a
 *   group whose members are all disabled simply never triggers.
 */
export const RANDOM_EXCLUSION_GROUPS: Readonly<Record<string, ReadonlyArray<MAName>>> = {
  // --- Terraform rating -----------------------------------------------------
  'terraform-rating': ['Terraformer29', 'Benefactor'],

  // --- Production engines ---------------------------------------------------
  'broad-production': ['Producer', 'Mogul'], // total production vs. most non-M€ production
  'mc-production': ['Fundraiser', 'Banker'],
  'steel-titanium-engine': ['Smith', 'Blacksmith', 'Miner'],
  'heat-stock': ['Firestarter', 'Thermalist'],
  'plant-production': ['C. Forester', 'Botanist'],

  // --- Board / tiles --------------------------------------------------------
  'city-tiles': ['Mayor', 'Metropolist'],
  'greenery-tiles': ['Gardener', 'Cultivator'],
  'colonies': ['Pioneer', 'Colonizer'],
  'adjacency-bonus-tiles': ['Networker', 'Entrepreneur'],
  'ocean-adjacent-tiles': ['Coastguard', 'Estate Dealer'],
  'edge-tiles': ['Edgedancer', 'Suburbian'],
  'moon-tiles': ['Lunarchitect', 'Lunar Magnate'],

  // --- Tags -----------------------------------------------------------------
  'building-tags': ['Builder', 'Contractor'],
  'science-tags': ['Researcher', 'Scientist'],
  'power-tags': ['V. Electrician', 'Electrician'],
  'earth-tags': ['Terran', 'Investor'],
  'jovian-tags': ['Rim Settler', 'Voyager'],
  'space-tags': ['Spacefarer', 'V. Spacefarer', 'Space Baron'],
  'bio-tags': ['Ecologist', 'Biologist'],
  'moon-tags': ['One Giant Step', 'Full Moon'],

  // --- Card resources -------------------------------------------------------
  'animal-microbe-resources': ['Farmer', 'A. Zoologist', 'Zoologist'],

  // --- Cards ----------------------------------------------------------------
  'events': ['Legend', 'Promoter'],
  'requirement-cards': ['Tactician', 'Forecaster'],
  'expensive-cards': ['Sponsor', 'Celebrity'],
  'cards-in-hand': ['Planner', 'Visionary'],

  // --- Turmoil / Underworld -------------------------------------------------
  'delegates-politics': ['T. Politician', 'Politician'],
  'underground-tokens': ['Tunneler', 'Excavator'],
} as const;

const groupByName: Map<MAName, string> = new Map();
for (const [group, names] of Object.entries(RANDOM_EXCLUSION_GROUPS)) {
  for (const name of names) {
    if (groupByName.has(name)) {
      throw new Error(`Milestone/Award ${name} appears in more than one random exclusion group ` +
        `(${groupByName.get(name)} and ${group}). Each MA may belong to at most one group.`);
    }
    groupByName.set(name, group);
  }
}

/**
 * The random-pool exclusion group a milestone/award belongs to, or undefined when it has no peer that
 * rewards the same thing. The random selector never picks two MAs sharing a group.
 */
export function randomExclusionGroup(name: MAName): string | undefined {
  return groupByName.get(name);
}
