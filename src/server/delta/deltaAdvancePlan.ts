import {IPlayer} from '../IPlayer';
import {Units} from '../../common/Units';
import {CardName} from '../../common/cards/CardName';
import {Tag} from '../../common/cards/Tag';
import {DELTA_TRACK_TAGS, DeltaProjectExpansion} from './DeltaProjectExpansion';

/**
 * THE ORDERED PROJECTED RESOURCE PLAN of one Hydronetwork advance.
 *
 * A single move is a SEQUENCE of resolution points, not one balance: the
 * movement payment leaves first, then every rewarded stage pays IN PATH
 * ORDER, and a pre-selected repeated action spends ITS OWN cost at the point
 * where its stage resolves. One unit of a resource therefore cannot be
 * promised both to the movement payment and to a later action — and an EARLY
 * guaranteed reward may fund a LATER action, while a late reward can never
 * fund an earlier cost. This module walks exactly that order and refuses any
 * prefix whose balance would go negative.
 *
 * WHAT IS AUTHORITATIVE HERE, and what deliberately is not:
 *  - Action eligibility is the card's OWN `canAct`, dry-run against the
 *    PROJECTED stock (see {@link withProjectedStock}) — the one real gate,
 *    never a copied cost table. Consumer-specific payment rules therefore
 *    apply themselves: Delta Works's steel-for-energy substitution exists
 *    only inside the movement payment (`resolveAdvancePayment`), and no
 *    projection ever turns steel into energy for a card's own cost.
 *  - The MANDATORY stock cost threaded to LATER points comes from the
 *    action's own declarative behavior (`card.actionBehavior.spend`) — the
 *    single place a data-defined action already states it. A bespoke action
 *    without a declarative spend still gets the full `canAct` dry-run at its
 *    own point; it merely cannot promise a structural cost to points after
 *    it (there is at most one costed commitment per move today — stage 7 is
 *    unique — and the walk stays general for more).
 *  - Guaranteed stage gains are the PROJECTION MIRROR of
 *    `DeltaProjectExpansion.resolveReward` — see {@link guaranteedStockGainAt},
 *    kept deliberately tiny and co-maintained with that switch.
 *
 * PURE of mutations: the dry-run overlay restores the exact stock in a
 * `finally`, records no events and never touches the deferred queue.
 */

/** One pre-selected repeated action, at the stage where it will execute. */
export type DeltaPlannedAction = {
  position: number;
  card: CardName;
};

/** Why a planned action fails AT ITS OWN point of the sequence. */
export type DeltaPlanConflict = {
  position: number;
  card: CardName;
  /**
   * `resources` — the projected balance cannot cover the action's own cost
   * there (the movement payment or an earlier commitment took it);
   * `eligibility` — the card's `canAct` refuses for a non-stock reason
   * (deck empty, card state, …) under the projected resources.
   */
  reason: 'resources' | 'eligibility';
  /** The first short resource, when the shortfall is structural. */
  resource?: keyof Units;
};

export type DeltaAdvancePlanVerdict = {
  feasible: boolean;
  conflicts: ReadonlyArray<DeltaPlanConflict>;
};

export type DeltaAdvancePlanInput = {
  fromPosition: number;
  toPosition: number;
  /** The movement payment mix (energy + Delta Works steel). */
  payment: {energy: number, steel: number};
  /** Choice-stage answers by position (1/2) — their guaranteed gains thread. */
  choices?: Readonly<Record<number, number>>;
  /** Pre-selected repeated actions, at their stages. */
  actions?: ReadonlyArray<DeltaPlannedAction>;
};

/**
 * Run `fn` with the player's stock TEMPORARILY set to `stock` — the dry-run
 * seam every projected eligibility check goes through. Direct field writes on
 * purpose: they bypass the event recorder (a projection must record nothing)
 * and are restored exactly in a `finally`, so no observer can ever see the
 * overlay. Nothing here defers, logs or draws.
 */
export function withProjectedStock<T>(player: IPlayer, stock: Readonly<Units>, fn: () => T): T {
  const before: Units = {
    megacredits: player.megaCredits,
    steel: player.steel,
    titanium: player.titanium,
    plants: player.plants,
    energy: player.energy,
    heat: player.heat,
  };
  try {
    player.megaCredits = stock.megacredits;
    player.steel = stock.steel;
    player.titanium = stock.titanium;
    player.plants = stock.plants;
    player.energy = stock.energy;
    player.heat = stock.heat;
    return fn();
  } finally {
    player.megaCredits = before.megacredits;
    player.steel = before.steel;
    player.titanium = before.titanium;
    player.plants = before.plants;
    player.energy = before.energy;
    player.heat = before.heat;
  }
}

/**
 * The GUARANTEED stock gain of one rewarded stage — the projection mirror of
 * `DeltaProjectExpansion.resolveReward`, kept beside it on purpose (a reward
 * change there is a change here, one diff). Only DETERMINISTIC stock gains
 * count: a choice stage counts its CHOSEN alternative (an unmade choice
 * guarantees nothing), drawn cards are not stock, production is not stock,
 * and an interactive stage promises nothing to later points.
 */
export function guaranteedStockGainAt(player: IPlayer, position: number, choice: number | undefined): Partial<Units> {
  switch (DELTA_TRACK_TAGS[position]) {
  case Tag.BUILDING: // 2 steel OR 2 plants — the chosen alternative only.
    if (choice === 0) {
      return {steel: 2};
    }
    if (choice === 1) {
      return {plants: 2};
    }
    return {};
  case Tag.PLANT: // 1 plant per plant tag — deterministic at plan time.
    return {plants: player.tags.count(Tag.PLANT)};
  default:
    return {};
  }
}

/** The action's MANDATORY declarative stock cost (data-defined cards). */
export function declaredActionCost(player: IPlayer, card: CardName): Partial<Units> {
  const played = player.tableau.get(card);
  const spend = played?.actionBehavior?.spend;
  if (spend === undefined) {
    return {};
  }
  const cost: Partial<Units> = {};
  for (const key of Units.keys) {
    const v = spend[key];
    if (typeof v === 'number' && v > 0) {
      cost[key] = v;
    }
  }
  return cost;
}

function minus(stock: Units, cost: Partial<Units>): Units {
  const out = {...stock};
  for (const key of Units.keys) {
    out[key] -= cost[key] ?? 0;
  }
  return out;
}

function plus(stock: Units, gain: Partial<Units>): Units {
  const out = {...stock};
  for (const key of Units.keys) {
    out[key] += gain[key] ?? 0;
  }
  return out;
}

function firstShortfall(stock: Units, cost: Partial<Units>): keyof Units | undefined {
  for (const key of Units.keys) {
    if ((cost[key] ?? 0) > stock[key]) {
      return key;
    }
  }
  return undefined;
}

/**
 * THE ONE PREFIX WALK — the authoritative verdict over a whole planned
 * advance. Used by the commit gate (`DeltaProjectExpansion.advance`, before
 * any mutation) and by the runtime preview; the client only ever REPEATS the
 * arithmetic over server-served numbers, it never computes a card cost.
 */
export function deltaAdvancePlanVerdict(player: IPlayer, input: DeltaAdvancePlanInput): DeltaAdvancePlanVerdict {
  const conflicts: Array<DeltaPlanConflict> = [];
  // The starting snapshot, minus the movement payment — the first point of
  // the sequence. (The payment's own validity — the mix shape, the Delta
  // Works gate — is `resolveAdvancePayment`'s question, asked by the caller.)
  let stock: Units = minus({
    megacredits: player.megaCredits,
    steel: player.steel,
    titanium: player.titanium,
    plants: player.plants,
    energy: player.energy,
    heat: player.heat,
  }, {energy: input.payment.energy, steel: input.payment.steel});

  const actionsAt = new Map<number, DeltaPlannedAction>();
  for (const a of input.actions ?? []) {
    actionsAt.set(a.position, a);
  }

  const steps = DeltaProjectExpansion.traversalSteps(player, input.fromPosition, input.toPosition);
  for (const step of steps) {
    // A stage guarantees its gain only when this move actually PAYS it (the
    // destination, or a crossed stage under the traversal modifier) — a
    // standing-rule crossing promises nothing to later points.
    if (step.rewarded) {
      stock = plus(stock, guaranteedStockGainAt(player, step.position, input.choices?.[step.position]));
    }

    // A DECLARED commitment is checked wherever it was declared — the walk
    // stays order-generic; which stages may legally hold one is the track's
    // (and the caller's) question, not the balance engine's.
    const planned = actionsAt.get(step.position);
    if (planned === undefined) {
      continue;
    }
    // THE REAL GATE, at the projected point: the card's own `canAct` (via the
    // same reusable-actions filter the reward itself uses), dry-run against
    // the balance THIS point actually holds.
    const eligible = withProjectedStock(player, stock, () =>
      DeltaProjectExpansion.getUsedActionCards(player).some((c) => c.name === planned.card));
    if (!eligible) {
      const cost = declaredActionCost(player, planned.card);
      const short = firstShortfall(stock, cost);
      conflicts.push({
        position: step.position,
        card: planned.card,
        reason: short !== undefined ? 'resources' : 'eligibility',
        resource: short,
      });
      continue;
    }
    // The action's mandatory cost leaves HERE — a later commitment (or a
    // later prefix check) sees the balance after it.
    stock = minus(stock, declaredActionCost(player, planned.card));
  }

  return {feasible: conflicts.length === 0, conflicts};
}
