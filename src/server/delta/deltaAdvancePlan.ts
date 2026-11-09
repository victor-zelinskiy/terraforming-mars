import {IPlayer} from '../IPlayer';
import {Units} from '../../common/Units';
import {CardName} from '../../common/cards/CardName';
import {Tag} from '../../common/cards/Tag';
import {isIActionCard} from '../cards/ICard';
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
 *  - The STOCK an action NEEDS ({@link actionStockNeed}) is read off the
 *    card itself, never a table: its declarative spend
 *    (`card.actionBehavior.spend`) merged with the floor its OWN `canAct`
 *    holds at, probed by the same dry-run. The floor is what makes a BESPOKE
 *    action honest — Dutch Mountains states no declarative spend, so a
 *    spend-only reading served it as free, the client offered the repeat
 *    after a payment that left 1 of its 3 energy, and the commit refused the
 *    whole move (2026-11-09). The same number is served to the client
 *    (`reuseActionCosts`) and threaded to later points here.
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

function liveStock(player: IPlayer): Units {
  return {
    megacredits: player.megaCredits,
    steel: player.steel,
    titanium: player.titanium,
    plants: player.plants,
    energy: player.energy,
    heat: player.heat,
  };
}

/**
 * THE STOCK ONE ACTION NEEDS to be performable — per resource, the larger of
 * its declarative spend and the FLOOR its own `canAct` holds at.
 *
 * The floor is probed by dry-run ({@link withProjectedStock}): with every
 * other resource at its live value, the lowest amount of THIS resource the
 * card still acts at (binary search over `[1, live]` — an action's need is
 * monotone in a resource). A resource the card acts without at 0 needs
 * nothing (an OR-price like Electro Catapult's plant-or-steel needs neither
 * while the player holds both). A card that cannot act on the live stock at
 * all is not probed — it is not a candidate.
 *
 * Probed against the LIVE stock, so it answers for the resources the
 * Hydronetwork move can take away (the payment, an earlier commitment); the
 * authoritative gate stays the `canAct` dry-run at the projected point.
 */
export function actionStockNeed(player: IPlayer, cardName: CardName): Partial<Units> {
  const need = declaredActionCost(player, cardName);
  const card = player.tableau.get(cardName);
  if (card === undefined || !isIActionCard(card)) {
    return need;
  }
  const live = liveStock(player);
  const actsAt = (stock: Units): boolean => withProjectedStock(player, stock, () => card.canAct(player));
  if (!actsAt(live)) {
    return need;
  }
  for (const key of Units.keys) {
    if (live[key] === 0 || actsAt({...live, [key]: 0})) {
      continue;
    }
    let lo = 1;
    let hi = live[key];
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (actsAt({...live, [key]: mid})) {
        hi = mid;
      } else {
        lo = mid + 1;
      }
    }
    need[key] = Math.max(need[key] ?? 0, lo);
  }
  return need;
}

/**
 * THE EXACT ENERGY × STEEL READING of one action — only where its
 * {@link actionStockNeed} vector is NOT exact. The two resources a move can
 * take (the payment; Delta Works makes steel part of it) can form an OR-price:
 * Focused Organization spends «any 1 standard resource», so on a table holding
 * only energy and steel it needs NEITHER alone and one of the two together —
 * a vector says «free», and a move taking both would be refused at commit.
 *
 * Index = energy at the repeat's point (0 … live), value = the least steel
 * (0 … live) the card's own `canAct` acts with there, `null` = none. Probed by
 * the same dry-run; `undefined` when the vector already says exactly this
 * (the common case — the payload stays byte-identical).
 */
export function actionSteelFrontier(player: IPlayer, cardName: CardName, need: Partial<Units>): Array<number | null> | undefined {
  const card = player.tableau.get(cardName);
  if (card === undefined || !isIActionCard(card)) {
    return undefined;
  }
  const live = liveStock(player);
  const actsAt = (energy: number, steel: number): boolean =>
    withProjectedStock(player, {...live, energy, steel}, () => card.canAct(player));
  if (!actsAt(live.energy, live.steel)) {
    return undefined;
  }
  const frontier: Array<number | null> = [];
  for (let e = 0; e <= live.energy; e++) {
    if (!actsAt(e, live.steel)) {
      frontier.push(null);
      continue;
    }
    let lo = 0;
    let hi = live.steel;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (actsAt(e, mid)) {
        hi = mid;
      } else {
        lo = mid + 1;
      }
    }
    frontier.push(lo);
  }
  const implied = (e: number): number | null => e < (need.energy ?? 0) ? null : (need.steel ?? 0);
  return frontier.every((v, e) => v === implied(e)) ? undefined : frontier;
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
  let stock: Units = minus(liveStock(player), {energy: input.payment.energy, steel: input.payment.steel});

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
    const need = actionStockNeed(player, planned.card);
    if (!eligible) {
      const short = firstShortfall(stock, need);
      conflicts.push({
        position: step.position,
        card: planned.card,
        reason: short !== undefined ? 'resources' : 'eligibility',
        resource: short,
      });
      continue;
    }
    // The action's need leaves HERE — a later commitment (or a later prefix
    // check) sees the balance after it (the same number the client threads).
    stock = minus(stock, need);
  }

  return {feasible: conflicts.length === 0, conflicts};
}
