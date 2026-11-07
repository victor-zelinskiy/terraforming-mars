import {awardManifest} from '../awards/Awards';
import {BoardName} from '../../common/boards/BoardName';
import {GameOptions} from '../game/GameOptions';
import {milestoneManifest} from '../milestones/Milestones';
import {RandomMAOptionType} from '../../common/ma/RandomMAOptionType';
import {inplaceShuffle} from '../utils/shuffle';
import {Random, UnseededRandom} from '../../common/utils/Random';
import {MilestoneName, milestoneNames} from '../../common/ma/MilestoneName';
import {AwardName, awardNames} from '../../common/ma/AwardName';
import {synergies} from './MilestoneAwardSynergies';
import {isCompatible, MAManifest} from './MAManifest';
import {intersection} from '../../common/utils/utils';
import {randomExclusionGroup} from './MilestoneAwardExclusions';

type DrawnMilestonesAndAwards = {
  milestones: Array<MilestoneName>,
  awards: Array<AwardName>
}

// Compute max synergy of a given set of milestones and awards. Exported for testing.
export function maximumSynergy(names: ReadonlyArray<MilestoneName | AwardName>) : number {
  let max = 0;
  for (let i = 0; i < names.length - 1; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const synergy = synergies.get(names[i], names[j]);
      max = Math.max(synergy, max);
    }
  }
  return max;
}

type Constraints = {
    // No pairing may have a synergy greater than this.
    maxSynergyAllowed: number;
    // Sum of all the synergies may be no greater than this.
    totalSynergyAllowed: number;
    // 3) Limited a number of pair with synergy at |highThreshold| or above to |numberOfHighAllowed| or below.
    numberOfHighAllowed: number;
    highThreshold: number;
  }

export const LIMITED_SYNERGY: Constraints = {
  maxSynergyAllowed: 6,
  totalSynergyAllowed: 20,
  numberOfHighAllowed: 20,
  highThreshold: 4,
};

const UNLIMITED_SYNERGY: Constraints = {
  maxSynergyAllowed: 100,
  totalSynergyAllowed: 100,
  numberOfHighAllowed: 100,
  highThreshold: 100,
};

// vize1215 fork: the unified "all milestones and awards" pool (RandomMAOptionType.ALL)
// includes EVERY compatible milestone/award — base, fan and modular — with no synergy
// balancing. Several modular milestones are merely re-tuned clones of a classic one (same
// scoring, different threshold), so including both halves would place two milestones that
// reward the identical thing in one game. Each clone pair is collapsed to the single version
// chosen for this fork; the other variant is dropped from the unified pool (and the board
// defaults — see Milestones.ts — keep Terraformer29 / Tycoon10 to match).
const UNIFIED_POOL_EXCLUSIONS: ReadonlySet<string> = new Set<MilestoneName | AwardName>([
  'Terraformer', // -> Terraformer29 (flat 29 TR, no Turmoil branch)
  'Tycoon', // -> Tycoon10 (10 blue+green cards)
  'Spacefarer4', // -> Spacefarer (6 space tags)
  'Builder7', // -> Builder (8 building tags)
  'Terran5', // -> Terran (6 Earth tags)
  'Legend4', // -> Legend (5 events)
  'Tactician4', // -> Tactician (5 cards with requirements)
  'Pioneer4', // -> Pioneer (identical class)
  'Merchant3', // -> Merchant (the same six standard resources, 3 of each instead of 2 — Amazonis Planitia's printed clone)
]);

// vize1215 fork: the milestones / awards that arrived with Amazonis Planitia (upstream fc8bd8e0e1, 2026-11-06) stood
// out of every RANDOM pool through phase 1 of the board's adaptation (a random set reaches MarsBot's games and the bot
// had no row for them); phase 2 (2026-11-07, docs/claude/amazonis-planitia-marsbot.md) gave Innovator and Physicist
// their bot rows (`botMARules.ts`), and they joined the pools. Merchant3 never joins one: it clones Merchant
// (UNIFIED_POOL_EXCLUSIONS above — two «Негоциант» in one game).

/**
 * vize1215 fork: Amazonis Planitia's milestone with NO Redux Parliament in the game — the owner's FIXED substitute for
 * Activist (2026-11-06: «фиксированная замена» — the board's set stays deterministic, never a draw). Terraformer29 (a
 * flat 29 TR, the fork's one Terraformer) — the nearest «push the planet forward» goal that needs no Agenda track, and
 * in no other slot of the board's set (decision record: `docs/claude/amazonis-planitia-phase-1.md`).
 */
export const AMAZONIS_PLANITIA_NO_PARLIAMENT_MILESTONE: MilestoneName = 'Terraformer29';

/** vize1215 fork: board-row names the fork put in place of a retired printed one — not a «printed on this board» fact. */
const FORK_SUBSTITUTE_SLOTS: Partial<Record<BoardName, ReadonlyArray<string>>> = {
  [BoardName.AMAZONIS_PLANITIA]: ['Activist'],
};

/** Amazonis Planitia's printed milestones for THIS game — Activist only under the Redux Parliament. */
export function amazonisPlanitiaMilestones(gameOptions: Pick<GameOptions, 'turmoilReduxExpansion'>): Array<MilestoneName> {
  return milestoneManifest.boards[BoardName.AMAZONIS_PLANITIA].map((name) =>
    name === 'Activist' && gameOptions.turmoilReduxExpansion !== true ? AMAZONIS_PLANITIA_NO_PARLIAMENT_MILESTONE : name);
}

// vize1215 fork: board-derived facts needed to avoid offering an unclaimable milestone in
// the random pool. Defaults assume the board is unknown (don't exclude anything), so callers
// without a built board (dev tools, isolated unit tests) keep the previous behaviour.
export type MASelectionContext = {
  /**
   * Whether the (already-built) board has any volcanic spaces. When false, Geologist — which
   * needs tiles ON or ADJACENT to volcanic areas — can never be claimed, so it's dropped.
   */
  hasVolcanicSpaces: boolean;
};

const DEFAULT_MA_CONTEXT: MASelectionContext = {hasVolcanicSpaces: true};

/**
 * @param rng the stream the DRAW reads. A game hands in its own seeded one (`Game.newInstance` — a stream of its own,
 *   beside the deal's), so a game that draws its set — the «random milestones and awards» box, and EVERY game on a map
 *   with no row of its own (Hollandia) — is reproducible by its seed like the rest of its setup. Absent = unseeded, as
 *   upstream draws it (the statistical specs of the selector).
 */
export function chooseMilestonesAndAwards(
  gameOptions: GameOptions,
  context: MASelectionContext = DEFAULT_MA_CONTEXT,
  rng: Random = UnseededRandom.INSTANCE): DrawnMilestonesAndAwards {
  let drawnMilestonesAndAwards: DrawnMilestonesAndAwards = {
    milestones: [],
    awards: [],
  };

  function push(milestones: ReadonlyArray<MilestoneName>, awards: ReadonlyArray<AwardName>) {
    drawnMilestonesAndAwards.milestones.push(...milestones);
    drawnMilestonesAndAwards.awards.push(...awards);
  }

  const requiredQty = gameOptions.venusNextExtension ? 6 : 5;

  switch (gameOptions.randomMA) {
  case RandomMAOptionType.NONE:
    const boardName = gameOptions.boardName;
    switch (gameOptions.boardName) {
    case BoardName.THARSIS:
    case BoardName.HELLAS:
    case BoardName.ELYSIUM:
    case BoardName.UTOPIA_PLANITIA:
    case BoardName.ARABIA_TERRA:
    case BoardName.AMAZONIS:
    case BoardName.TERRA_CIMMERIA:
    case BoardName.TERRA_CIMMERIA_NOVA:
    case BoardName.VASTITAS_BOREALIS:
    case BoardName.VASTITAS_BOREALIS_NOVA:
      push(milestoneManifest.boards[boardName], awardManifest.boards[gameOptions.boardName]);
      break;
    case BoardName.AMAZONIS_PLANITIA:
      push(amazonisPlanitiaMilestones(gameOptions), awardManifest.boards[boardName]);
      break;
    default:
      // vize1215 fork: boards without a fixed MA set (e.g. Hollandia) draw from the unified
      // "all" pool — pure random, deduped, expansion-filtered — same as the ALL button,
      // instead of the old synergy-limited classic-only fallback.
      return getRandomMilestonesAndAwards({...gameOptions, randomMA: RandomMAOptionType.ALL}, requiredQty, UNLIMITED_SYNERGY, context, 1, rng);
    }
    if (gameOptions.venusNextExtension) {
      push(milestoneManifest.expansions['venus'], awardManifest.expansions['venus']);
    }
    // vize1215 fork: the Ares milestones/awards (Networker, Purifier / Entrepreneur, Rugged)
    // are deliberately NOT force-added to every Ares game. They only enter play through the
    // "Random milestones and awards" pool (they're compatibility-filtered into the random
    // candidates when Ares is enabled). With randomMA === NONE they stay out.
    if (gameOptions.moonExpansion) {
      // One MA will reward moon tags, the other will reward moon tiles.
      if (rng.next() > 0.5) {
        push(['One Giant Step'], ['Lunar Magnate']);
      } else {
        push(['Lunarchitect'], ['Full Moon']);
      }
    }
    break;

  case RandomMAOptionType.LIMITED:
    drawnMilestonesAndAwards = getRandomMilestonesAndAwards(gameOptions, requiredQty, LIMITED_SYNERGY, context, 1, rng);
    break;
  case RandomMAOptionType.UNLIMITED:
    drawnMilestonesAndAwards = getRandomMilestonesAndAwards(gameOptions, requiredQty, UNLIMITED_SYNERGY, context, 1, rng);
    break;
  case RandomMAOptionType.ALL:
    // vize1215 fork: pure random from the full deduplicated, expansion-filtered pool.
    drawnMilestonesAndAwards = getRandomMilestonesAndAwards(gameOptions, requiredQty, UNLIMITED_SYNERGY, context, 1, rng);
    break;
  default:
    throw new Error('Unknown milestone/award type: ' + gameOptions.randomMA);
  }

  assertNoRetired(drawnMilestonesAndAwards);
  return drawnMilestonesAndAwards;
}

/**
 * vize1215 fork: a RETIRED milestone / award (`MAManifestSpec.retired`) never enters a new game by any road. The random
 * candidates already skip it (it is `deprecated`); this catches the other roads — a board set or an expansion set that
 * starts naming one — loudly, at game creation, so a replacement is decided instead of a broken MA shipping.
 */
function assertNoRetired(drawn: DrawnMilestonesAndAwards): void {
  const retired = [
    ...drawn.milestones.map((name) => [name, milestoneManifest.all[name].retired] as const),
    ...drawn.awards.map((name) => [name, awardManifest.all[name].retired] as const),
  ].filter(([, reason]) => reason !== undefined);
  if (retired.length > 0) {
    const named = retired.map(([name, reason]) => `${name} (${reason})`).join(', ');
    throw new Error(`Retired milestone/award reached a new game: ${named} — choose a replacement`);
  }
}

/**
 * Return the list of possible milestones and awards for a given game. Only meant to work with random selection.
 *
 * Isn't meant to work with RandomMAOptionType.NONE
 *
 * exported for tests
 */
export function getCandidates(gameOptions: GameOptions, context: MASelectionContext = DEFAULT_MA_CONTEXT): [Array<MilestoneName>, Array<AwardName>] {
  function include<T extends string>(name: T, manifest: MAManifest<T, any>): boolean {
    // Never include deprecated MAs in random candidates.  They generally have "more official" versions that will be
    // considered for inclusion.
    if (manifest.all[name].deprecated) {
      return false;
    }
    // vize1215 fork: Geologist needs tiles ON or ADJACENT to volcanic areas, so on a board with
    // no volcanic spaces it can never be claimed — never offer it there (the former kberg TODO).
    if (name === 'Geologist' && context.hasVolcanicSpaces === false) {
      return false;
    }

    // vize1215 fork: the unified "all" pool — every compatible milestone/award (base, fan and
    // modular), no synergy filter, with the clone pairs collapsed to a single chosen variant.
    if (gameOptions.randomMA === RandomMAOptionType.ALL) {
      if (UNIFIED_POOL_EXCLUSIONS.has(name)) {
        return false;
      }
      return isCompatible(name, manifest, gameOptions);
    }

    const random = manifest.all[name].random;
    if (gameOptions.modularMA) {
      if (random === undefined) {
        return false;
      }
    } else {
      // The game boards this MA appears in, if any. A slot the fork FILLED (Amazonis Planitia's Activist, the retired
      // Lobbyist's substitute) is not a printed appearance — the MA keeps its own random standing.
      const boards = Object.values(BoardName).filter((boardName) =>
        manifest.boards[boardName].includes(name) && !(FORK_SUBSTITUTE_SLOTS[boardName] ?? []).includes(name));

      // Always include the milestones and awards from the official boards
      if (intersection(boards, [BoardName.THARSIS, BoardName.ELYSIUM, BoardName.HELLAS]).length > 0) {
        return true;
      }
      // Conditionally include milestones and awards from unofficial boards.
      if (boards.length > 0 && gameOptions.includeFanMA === false) {
        return false;
      }
      // Modular MAs are not part of our own built random MAs.
      if (random === 'modular') {
        return false;
      }
    }

    if (!isCompatible(name, manifest, gameOptions)) {
      return false;
    }

    return true;
  }

  const candidateMilestones = milestoneNames.filter((name) => include(name, milestoneManifest));
  const candidateAwards = awardNames.filter((name) => include(name, awardManifest));

  return [candidateMilestones, candidateAwards];
}

// Selects |numberMARequested| milestones and |numberMARequested| awards from all available awards and milestones (optionally including
// Venusian.) It does this by following these rules:
// 1) No pair with synergy above |maxSynergyAllowed|.
// 2) Total synergy is |totalSynergyAllowed| or below.
// 3) Limited a number of pair with synergy at |highThreshold| or above to |numberOfHighAllowed| or below.
function getRandomMilestonesAndAwards(gameOptions: GameOptions,
  numberMARequested: number,
  constraints: Constraints,
  context: MASelectionContext = DEFAULT_MA_CONTEXT,
  attempt: number = 1,
  rng: Random = UnseededRandom.INSTANCE): DrawnMilestonesAndAwards {
  // 5 is a fine number of attempts. A sample of 100,000 runs showed that this algorithm
  // didn't get past 3.
  // https://github.com/terraforming-mars/terraforming-mars/pull/1637#issuecomment-711411034
  // 2025-11-30: raised to 6.
  // vize1215 fork: raised to 10 — the Accumulator now also rejects a candidate that shares a
  // random-exclusion group with one already chosen (see MilestoneAwardExclusions), which thins a few
  // shuffles; the larger budget keeps generation robust. The pool is far larger than the requested
  // count, so in practice this still resolves on the first attempt.
  // 2026-07-29: raised to 50 — a stress run (200k modularMA/UNLIMITED draws) found a single-attempt
  // failure rate near 33%: MilestoneAwardSynergies.ts gives every VBN-board milestone/award a blanket
  // +5 synergy against EVERY OTHER milestone/award (not just other VBN entries), regardless of the
  // actual board in play. Once just 2 VBN-tagged names land in the accumulator, that alone burns
  // ~95 of totalSynergyAllowed's 100 budget, so every remaining candidate — VBN or not — pushes it
  // over and gets rejected, exhausting the pool before reaching the requested count. At a ~33%
  // per-attempt failure rate, exhausting 10 straight attempts happens roughly 1 in 200,000 games
  // (`tests/ma/MilestoneAwardDeduplication.spec.ts`'s "modular MA mode, 1000 draws" hit exactly this
  // in CI); at 50 attempts (each independently re-shuffled, ~0.1-0.2ms) the odds are negligible
  // (0.33^50), and the added budget costs nothing when — as in the overwhelming majority of games —
  // the first attempt already succeeds.
  const maxAttempts = 50;
  if (attempt > maxAttempts) {
    throw new Error('No limited synergy milestones and awards set was generated after ' + maxAttempts + ' attempts. Please try again.');
  }

  const [candidateMilestones, candidateAwards] = getCandidates(gameOptions, context);

  inplaceShuffle(candidateMilestones, rng);
  inplaceShuffle(candidateAwards, rng);

  const accum = new Accumulator(constraints);

  // Keep adding milestones or awards until there are as many as requested
  while (accum.milestones.length + accum.awards.length < numberMARequested * 2) {
    // If there is enough award, add a milestone. And vice versa. If still need both, flip a coin to decide which to add.
    if (accum.awards.length === numberMARequested || (accum.milestones.length !== numberMARequested && Math.round(rng.next()))) {
      const newMilestone = candidateMilestones.splice(0, 1)[0];
      // If not enough milestone are left to satisfy the constraints, restart the function with a recursive call.
      if (newMilestone === undefined) {
        return getRandomMilestonesAndAwards(gameOptions, numberMARequested, constraints, context, attempt+1, rng);
      }
      accum.add(newMilestone, true);
    } else {
      const newAward = candidateAwards.splice(0, 1)[0];
      // If not enough awards are left to satisfy the constraints, restart the function with a recursive call.
      if (newAward === undefined) {
        return getRandomMilestonesAndAwards(gameOptions, numberMARequested, constraints, context, attempt+1, rng);
      }
      accum.add(newAward, false);
    }
  }

  if (!verifySynergyRules(accum.milestones, accum.awards, constraints)) {
    throw new Error('The randomized milestones and awards set does not satisfy the given synergy rules.');
  }

  return {
    milestones: accum.milestones,
    awards: accum.awards,
  };
}

// Verify whether a given array of |milestoneAwardArray| satisfies the following these rules:
// 1) No pair with synergy above |maxSynergyAllowed|.
// 2) Total synergy is |totalSynergyAllowed| or below.
// 3) Limited a number of pair with synergy at |highThreshold| or above to |numberOfHighAllowed| or below.
export function verifySynergyRules(
  milestones: ReadonlyArray<MilestoneName>,
  awards: ReadonlyArray<AwardName>,
  constraints: Constraints): boolean {
  let max = 0;
  let totalSynergy = 0;
  let numberOfHigh = 0;
  const mas: Array<string> = [...milestones];
  mas.push(...awards);
  for (let i = 0; i < mas.length - 1; i++) {
    for (let j = i + 1; j < mas.length; j++) {
      const synergy = synergies.get(mas[i], mas[j]);
      max = Math.max(synergy, max);
      totalSynergy += synergy;
      if (synergy >= constraints.highThreshold) {
        numberOfHigh++;
      }
    }
  }
  return max <= constraints.maxSynergyAllowed &&
      totalSynergy <= constraints.totalSynergyAllowed &&
      numberOfHigh <= constraints.numberOfHighAllowed;
}

class Accumulator {
  milestones: Array<MilestoneName> = [];
  awards: Array<AwardName> = [];

  private accumulatedHighCount = 0;
  private accumulatedTotalSynergy = 0;
  // vize1215 fork: scoring-vector groups already represented in this set. A random game offers at most
  // one milestone/award per group, so two MAs that reward the same thing never appear together.
  private readonly usedGroups: Set<string> = new Set();

  constructor(private constraints: Constraints) {
  }

  // Conditionally add a milestone or award when it doesn't
  // violate synergy constraints.
  //
  // |ma| is the milestone or award, |milestone| is true when
  // |ma| represents a milestone and false when it represents
  // an award.
  //
  // Returns true when successful, false otherwise.
  //
  add(candidate: MilestoneName | AwardName, milestone: boolean): boolean {
    // vize1215 fork: never accept a second milestone/award from the same scoring-vector group, so the
    // random pool can't offer two MAs (or a milestone + award) that reward the identical thing. This
    // applies to every random mode; the official fixed/NONE board sets bypass the Accumulator entirely.
    const group = randomExclusionGroup(candidate);
    if (group !== undefined && this.usedGroups.has(group)) {
      return false;
    }

    let totalSynergy = this.accumulatedTotalSynergy;
    let highCount = this.accumulatedHighCount;
    let max = 0;

    // Find the maximum synergy of this new item compared to the others
    (this.milestones as Array<string>).concat(this.awards).forEach((ma) => {
      const synergy = synergies.get(ma, candidate);
      totalSynergy += synergy;
      if (synergy >= this.constraints.highThreshold) {
        highCount++;
      }
      max = Math.max(synergy, max);
    });
    // Check whether the addition violates any rule.
    if (max <= this.constraints.maxSynergyAllowed &&
        highCount <= this.constraints.numberOfHighAllowed &&
        totalSynergy <= this.constraints.totalSynergyAllowed) {
      if (milestone) {
        this.milestones.push(candidate as MilestoneName);
      } else {
        this.awards.push(candidate as AwardName);
      }
      // Update the stats
      this.accumulatedHighCount = highCount;
      this.accumulatedTotalSynergy = totalSynergy;
      if (group !== undefined) {
        this.usedGroups.add(group);
      }
      return true;
    } else {
      return false;
    }
  }
}
