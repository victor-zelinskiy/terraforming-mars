/**
 * @console-shared LIVE — console native stands on this file.
 *
 * THE CLIENT HALF OF THE ORDERED RESOURCE PLAN — pure prefix arithmetic over
 * SERVER-SERVED numbers, mirroring `src/server/delta/deltaAdvancePlan.ts`.
 *
 * A Hydronetwork move is a sequence of resolution points: the movement
 * payment leaves first, then every rewarded stage pays in path order, and a
 * pre-selected repeated action spends ITS OWN cost at the point where its
 * stage resolves. The client repeats that walk to answer three presentation
 * questions the payment step and the Decision Rail must agree on:
 *
 *  1. the MINIMAL steel share that keeps every commitment fed (the
 *     auto-composition that protects a promised resource — Delta Works steel
 *     pays the movement so the action keeps its energy);
 *  2. which commitments CONFLICT when no composition can feed them (the rail
 *     card turns amber with the reason instead of wearing a false tick);
 *  3. what stands RESERVED at the payment point (the panel names it).
 *
 * NOTHING here computes a card cost: every commitment's cost arrives from
 * the server preview (`reuseActionCosts` — the stock the card's own action
 * needs: its declarative spend merged with its `canAct` floor), and the authoritative verdict is re-checked
 * atomically at commit by the server (`plannedActions` on the move step).
 * Unit-tested; no Vue / DOM / i18n.
 */
import {CardName} from '@/common/cards/CardName';
import {Units} from '@/common/Units';
import type {ActionPreview} from '@/common/models/ActionPreviewModel';

/** One guaranteed stage gain of the plan, in path order. */
export type HydroPlanGain = {
  position: number;
  gain: Partial<Units>;
};

/** One pre-selected action commitment, at the stage where it executes. */
export type HydroPlanCommitment = {
  position: number;
  card: CardName;
  /** The server-served stock the action needs (empty = needs no stock). */
  cost: Partial<Units>;
  /**
   * The server-served EXACT energy × steel reading (`reuseActionFrontiers`) —
   * present only for an OR-price a vector cannot state: index = energy left
   * at this point, value = the least steel it acts with (`null` = none). It
   * replaces the energy/steel half of `cost` in the CHECK; `cost` still
   * threads what the action spends.
   */
  frontier?: ReadonlyArray<number | null>;
};

export type HydroPlanMixVerdict = {
  /**
   * The MINIMAL steel share of the movement price that keeps every
   * commitment fed (energy-first stays the default — steel only covers what
   * the plan cannot spare). `undefined` ⇔ NO mix in [minSteel..maxSteel]
   * makes the whole plan feasible.
   */
  feasibleSteelMin: number | undefined;
  /** The HIGHEST feasible steel share — the dial's upper clamp: a manual
   *  raise past it would starve a steel-costing commitment. The feasible set
   *  is contiguous (energy need falls as the steel share rises, steel need
   *  rises), so the two ends describe it fully. */
  feasibleSteelMax: number | undefined;
  /** Commitments that fail under the BEST mix (empty when one is feasible). */
  conflicts: ReadonlyArray<{position: number, card: CardName, resource: keyof Units | undefined}>;
  /**
   * Stock the payment may not take at the CHOSEN feasible mix — what the
   * panel names as reserved (per resource, only the movement's own pools).
   */
  reserved: {energy: number, steel: number};
};

export type HydroPlanMixInput = {
  /** The player's live stock (the plan's starting snapshot). */
  start: Readonly<Units>;
  /** The movement price in energy-equivalent steps. */
  spend: number;
  /** The steel share bounds the payment rules allow (Delta Works). */
  minSteel: number;
  maxSteel: number;
  /** Ordered guaranteed gains of the move's rewarded stages. */
  gains: ReadonlyArray<HydroPlanGain>;
  /** Ordered pre-selected commitments. */
  commitments: ReadonlyArray<HydroPlanCommitment>;
};

function walkFeasible(input: HydroPlanMixInput, steelShare: number): {
  ok: boolean,
  firstConflict?: {position: number, card: CardName, resource: keyof Units | undefined},
} {
  const stock: Units = {...input.start};
  stock.energy -= (input.spend - steelShare);
  stock.steel -= steelShare;
  if (stock.energy < 0 || stock.steel < 0) {
    return {ok: false, firstConflict: undefined};
  }
  const gainsAt = new Map(input.gains.map((g) => [g.position, g.gain]));
  const points = [...new Set([
    ...input.gains.map((g) => g.position),
    ...input.commitments.map((c) => c.position),
  ])].sort((a, b) => a - b);
  const commitmentsAt = new Map(input.commitments.map((c) => [c.position, c]));
  for (const position of points) {
    const gain = gainsAt.get(position);
    if (gain !== undefined) {
      for (const key of Units.keys) {
        stock[key] += gain[key] ?? 0;
      }
    }
    const commitment = commitmentsAt.get(position);
    if (commitment === undefined) {
      continue;
    }
    const frontier = commitment.frontier;
    if (frontier !== undefined && frontier.length > 0) {
      const least = frontier[Math.min(Math.max(0, stock.energy), frontier.length - 1)];
      if (least === null || least === undefined) {
        return {ok: false, firstConflict: {position, card: commitment.card, resource: 'energy'}};
      }
      if (stock.steel < least) {
        return {ok: false, firstConflict: {position, card: commitment.card, resource: 'steel'}};
      }
    }
    for (const key of Units.keys) {
      if (frontier !== undefined && (key === 'energy' || key === 'steel')) {
        continue;
      }
      const need = commitment.cost[key] ?? 0;
      if (need > stock[key]) {
        return {ok: false, firstConflict: {position, card: commitment.card, resource: key}};
      }
    }
    for (const key of Units.keys) {
      stock[key] -= commitment.cost[key] ?? 0;
    }
  }
  return {ok: true};
}

/**
 * The one mix walk: try every legal steel share from the ENERGY-FIRST end
 * (the smallest steel) upward, take the first fully-feasible one. The track's
 * price is ≤ 11, so the sweep is trivially bounded — and exact, which a
 * closed-form reserve is not once gains and multiple commitments interleave.
 */
export function hydroPlanMixVerdict(input: HydroPlanMixInput): HydroPlanMixVerdict {
  if (input.commitments.length === 0) {
    return {feasibleSteelMin: undefined, feasibleSteelMax: undefined, conflicts: [], reserved: {energy: 0, steel: 0}};
  }
  let min: number | undefined;
  let max: number | undefined;
  let firstConflict: HydroPlanMixVerdict['conflicts'][number] | undefined;
  for (let steel = Math.max(0, input.minSteel); steel <= input.maxSteel; steel++) {
    const walk = walkFeasible(input, steel);
    if (walk.ok) {
      if (min === undefined) {
        min = steel;
      }
      max = steel;
    } else if (firstConflict === undefined && walk.firstConflict !== undefined) {
      firstConflict = walk.firstConflict;
    }
  }
  if (min === undefined) {
    // A conflict is ONLY ever a COMMITMENT's own failure (`firstConflict`,
    // from a walk that paid the movement and then starved the action).
    // «No share can even pay the movement» is the server's own
    // `destination.affordable` question — manufacturing commitment blame
    // there double-reports the shortage against the wrong owner (and gated
    // the CTA on a fact the affordability flag already owns).
    return {
      feasibleSteelMin: undefined,
      feasibleSteelMax: undefined,
      conflicts: firstConflict !== undefined ? [firstConflict] : [],
      reserved: {energy: 0, steel: 0},
    };
  }
  // What the payment protects at the chosen mix: the energy it deliberately
  // did NOT take (the raise of the steel share over the plain deficit), and
  // any steel a commitment itself needs.
  const plainMinSteel = Math.max(0, input.spend - input.start.energy);
  const reservedEnergy = Math.max(0, min - Math.max(plainMinSteel, input.minSteel));
  let reservedSteel = 0;
  for (const c of input.commitments) {
    reservedSteel += c.cost.steel ?? 0;
  }
  return {feasibleSteelMin: min, feasibleSteelMax: max, conflicts: [], reserved: {energy: reservedEnergy, steel: reservedSteel}};
}

/**
 * THE PRICE A REWARD-ONLY CLAIM PAYS before the claimed stage resolves (Dutch
 * Mountains: 3 energy, then the stage's reward — on stage 7 a repeated
 * action). Read off the SOURCE's served action preview — the branch whose
 * step IS the stage claim (`deltaStageReward`), its declared stock cost
 * chips — never a per-card number. No such branch (Corporate Espionage's free
 * own step) → no price.
 */
export function claimTollOf(preview: Pick<ActionPreview, 'branches'> | undefined): Partial<Units> {
  const branch = preview?.branches.find((b) =>
    b.steps.some((st) => st.kind === 'input' && st.input.type === 'deltaStageReward'));
  const toll: Partial<Units> = {};
  for (const e of branch?.effects ?? []) {
    if (e.direction === 'cost' && (Units.keys as ReadonlyArray<string>).includes(e.icon)) {
      const key = e.icon as keyof Units;
      toll[key] = (toll[key] ?? 0) + e.amount;
    }
  }
  return toll;
}

/**
 * The repeat candidates a REWARD-ONLY claim cannot feed — the claim twin of
 * the advance plan's greyed rows. There is no movement payment: the claim's
 * own price ({@link claimTollOf}) leaves first, then the repeated action
 * needs its served stock at the claimed stage. The same walk, spend 0.
 */
export function claimRepeatInfeasible(input: {
  start: Readonly<Units>,
  toll: Partial<Units>,
  position: number,
  candidates: ReadonlyArray<CardName>,
  costs: Partial<Record<CardName, Partial<Units>>> | undefined,
  frontiers?: Partial<Record<CardName, ReadonlyArray<number | null>>>,
}): Array<{name: CardName, resource: keyof Units | undefined}> {
  const start: Units = {...input.start};
  for (const key of Units.keys) {
    start[key] -= input.toll[key] ?? 0;
  }
  const out: Array<{name: CardName, resource: keyof Units | undefined}> = [];
  for (const name of input.candidates) {
    const cost = input.costs?.[name];
    const frontier = input.frontiers?.[name];
    if (cost === undefined && frontier === undefined) {
      continue;
    }
    const verdict = hydroPlanMixVerdict({
      start, spend: 0, minSteel: 0, maxSteel: 0, gains: [],
      commitments: [{position: input.position, card: name, cost: cost ?? {}, ...(frontier !== undefined ? {frontier} : {})}],
    });
    if (verdict.feasibleSteelMin === undefined && verdict.conflicts.length > 0) {
      out.push({name, resource: verdict.conflicts[0]?.resource});
    }
  }
  return out;
}
