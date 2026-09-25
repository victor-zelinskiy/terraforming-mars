/*
 * INFLUENCE → A COMPUTED RESULT (Turmoil Redux).
 *
 * Most resolutions scale an effect by a player's INFLUENCE («1 animal per
 * point of influence», «2 M€ per influence», «steel = influence, max 5»), and
 * many add a COUNT of the player's own state to it («+1 M€ production for
 * every Building card with a non-negative VP icon you have in play +
 * Influence, max 5»). The rule is one declaration — `InfluenceScaledEffect` —
 * and ONE arithmetic — `scaledAmount` — shared by the server (the actual
 * payout) and the client (the estimate on the vote surface, the fullscreen
 * inspector, the picker's header, the playground). Nothing re-derives the
 * formula; a surface that needs a number asks this module with the influence
 * (and the count) of the context it is in.
 *
 * THE CAP bounds the WHOLE amount (base + count term + influence term) — the
 * increase, never the player's resulting total: «max 5» on a production
 * increase lets production 10 become 15.
 *
 * The CONTEXTS a surface computes for are told apart (`InfluenceYieldContext`),
 * because the same rule answers different questions:
 *   estimate  — the viewer's CURRENT influence and count («if this were
 *               enacted now» — never a promise: both can change before the
 *               end of the generation);
 *   forecast  — a NAMED scenario (the viewer wins the vote: the Agenda
 *               advance of step 1 counts before the effect of step 3);
 *   resolving — the payout being made right now (the server's own amount);
 *   applied   — what was ACTUALLY paid (never recomputed from a later
 *               influence or a later tableau);
 *   reference — no player at all: the formula alone, no invented number.
 */
import {CardName} from '../cards/CardName';
import {CardResource} from '../CardResource';
import {ColonyName} from '../colonies/ColonyName';
import {Resource} from '../Resource';
import {Tag} from '../cards/Tag';
import {SpaceId} from '../Types';
import {AGENDA_TRACK, influenceAtAgenda} from './ParliamentTypes';
import {ResolutionCountByResource, ResolutionCountMetricModel, ResolutionCountTerm} from './resolutionCounts';

/** WHAT one unit of the yield is. */
export type InfluenceYieldUnit =
  /**
   * A resource ONTO the player's own cards. `resources` is the KIND of the
   * unit, as a LIST — one kind is the list of one (Aquifer Contest's animals,
   * Cloud Development's floaters); several kinds (Medical Database's «data or
   * microbe») mean the recipients are the holders of EITHER and each unit's
   * kind is its card's — never a second question to the player. `spread` is
   * the printed «each resource can go on a different card» (Cloud
   * Development): the amount is DISTRIBUTED over the holders through the
   * shared distribution step, never paid onto one card. Absent = one payout
   * onto ONE card (Aquifer Contest).
   */
  | {kind: 'cardResource', resources: ReadonlyArray<CardResource>, spread?: boolean}
  | {kind: 'stock', resource: Resource}
  | {kind: 'production', resource: Resource}
  | {kind: 'cards'}
  /**
   * The player's COLONY BONUSES, paid a NUMBER OF TIMES (Colonial Affairs:
   * «gain all your colony bonuses 2 times + 1/2 influence»). The amount is
   * the MULTIPLIER k — how many times every printed colony bonus of every
   * tile the player has a cube on is paid — never a resource: WHAT is paid
   * is the tile's own printed bonus, read off the colony's metadata by the
   * shared step plan (`colonyBonusSteps`), and every payout the plan makes
   * records `multiplier: k` beside its own unit. The seat's model carries the
   * registry (`ParliamentPlayerModel.colonyBonuses`) the reading multiplies.
   */
  | {kind: 'colonyBonuses'};

/**
 * A SEQUENTIAL term — the second half of a resolution whose result depends on
 * the FIRST half's result: «Increase your heat production 1 step per point of
 * Influence. THEN draw 1 card for every 3 steps of heat production you have»
 * (Climate Research). The amount is read from a player TOTAL the earlier
 * effect has just moved, never from influence: the influence is already
 * inside that total, and adding it a second time is exactly the over-count
 * this declaration exists to make impossible.
 *
 * THE TOTAL IS READ AFTER the earlier effect — the WHOLE total, not the step
 * it just gained and not the thresholds it just crossed; the remainder of the
 * division yields nothing; the total is NOT spent.
 */
export type InfluenceSequelTerm = {
  /** The effect (`InfluenceScaledEffect.id`) whose result this one reads. */
  after: string;
  /** WHICH player total is divided (the same unit vocabulary as `unit`). */
  total: InfluenceYieldUnit;
  /** How many units of the total yield ONE unit of this effect (floor division). */
  per: number;
};

/**
 * A LEVEL term — the effect brings the player UP TO a level instead of paying
 * an amount outright: «draw cards until you have 6 cards in hand + Influence»
 * (Joint Research). The formula (`scaledAmount`) then yields the TARGET
 * level; what is actually paid is the difference to the player's CURRENT
 * level of the same total (`topUpAmount` = max(0, target − current)), read
 * at the step from the engine (the hand as it stands) and never assumed. A
 * player at or above the target is paid nothing — and that zero is the rule
 * working, not a skip for want of influence: influence 0 still means a target
 * of 6, and a hand of 2 still draws 4.
 *
 * A reading of a level effect carries all three numbers: the target
 * (`InfluenceYield.target`), the level before and after (`total`) and the
 * payout (`amount`) — «up to 9 · 5 in hand → +4». A surface that printed the
 * target alone would promise «+9 cards».
 */
export type InfluenceLevelTerm = {
  /** WHICH player total is the current level (the same unit vocabulary as `unit`): `cards` = the hand. */
  total: InfluenceYieldUnit;
};

export type InfluenceScaledEffect = {
  /** Stable within the resolution — the outcome record and the UI key on it. */
  id: string;
  unit: InfluenceYieldUnit;
  /** Units per point of influence (0 for a purely sequential effect). */
  perInfluence: number;
  /**
   * THE INFLUENCE STEP (absent = 1): `perInfluence` units for every FULL
   * `influenceStep` points of influence — «+1 time per 2 points of Influence»
   * (Colonial Affairs) is `perInfluence: 1, influenceStep: 2`: influence 3 is
   * one extra time, influence 4 two. Floor division; the remainder yields
   * nothing. Applied BEFORE the cap, like every other term.
   */
  influenceStep?: number;
  /**
   * A SEQUENTIAL part (absent = none): the amount comes from a total an
   * EARLIER effect of the same enactment changed — see
   * {@link InfluenceSequelTerm}. Mutually exclusive with `count`.
   */
  sequel?: InfluenceSequelTerm;
  /**
   * A LEVEL part (absent = none): the formula is a level the player is
   * brought UP TO, and the payout is the difference to their current level
   * of `upTo.total` — see {@link InfluenceLevelTerm}. Mutually exclusive
   * with `count` and `sequel`.
   */
  upTo?: InfluenceLevelTerm;
  /** A flat part paid regardless of influence (absent = 0). */
  base?: number;
  /**
   * A per-player COUNTED part (absent = none): `count.per` units for every
   * item the player has (see `resolutionCounts.ts`) — added to the influence
   * part BEFORE the cap.
   */
  count?: ResolutionCountTerm;
  /** An upper bound of the whole amount (the «max 5» family) — the increase, not a resulting total. */
  cap?: number;
  /** Who receives it: every participant, or the winner of the vote only. */
  recipient: 'each' | 'winner';
};

/** The amount BEFORE the cap — what the formula adds up to. */
export function uncappedAmount(effect: InfluenceScaledEffect, influence: number, counted: number = 0): number {
  const countPart = effect.count === undefined ? 0 : effect.count.per * Math.max(0, Math.floor(counted));
  // The influence term counts FULL steps of the declared size (1 = every point).
  const step = Math.max(1, Math.floor(effect.influenceStep ?? 1));
  const influencePart = effect.perInfluence * Math.floor(Math.max(0, Math.floor(influence)) / step);
  return (effect.base ?? 0) + countPart + influencePart;
}

/** The amount `effect` yields at `influence` (and `counted` items of its count term) — the ONE formula. */
export function scaledAmount(effect: InfluenceScaledEffect, influence: number, counted: number = 0): number {
  const raw = uncappedAmount(effect, influence, counted);
  return effect.cap === undefined ? raw : Math.min(effect.cap, raw);
}

/**
 * The amount a SEQUENTIAL effect yields from `total` — the player total the
 * earlier effect left behind, read AFTER it. The ONE formula for the second
 * half: floor division, the remainder yields nothing, influence never enters
 * twice. An effect without a sequel term yields its ordinary amount at zero
 * influence (a caller that mixes them up gets the flat part, never a guess).
 */
export function sequelAmount(effect: InfluenceScaledEffect, total: number): number {
  const term = effect.sequel;
  if (term === undefined) {
    return scaledAmount(effect, 0);
  }
  const raw = (effect.base ?? 0) + Math.floor(Math.max(0, Math.floor(total)) / term.per);
  return effect.cap === undefined ? raw : Math.min(effect.cap, raw);
}

/**
 * The amount a LEVEL effect pays from `current` — the ONE formula for the
 * top-up: max(0, target − current), the target being the ordinary formula's
 * result. Shared by the server (the payout), the readings and the stand, so
 * the number a surface prints can never disagree with the one the step
 * draws. An effect without a level term pays its ordinary amount (a caller
 * that mixes them up gets the formula, never a guess).
 */
export function topUpAmount(effect: InfluenceScaledEffect, influence: number, current: number, counted: number = 0): number {
  const target = scaledAmount(effect, influence, counted);
  if (effect.upTo === undefined) {
    return target;
  }
  return Math.max(0, target - Math.max(0, Math.floor(current)));
}

export type InfluenceYieldContext = 'reference' | 'estimate' | 'forecast' | 'resolving' | 'applied';

/**
 * One computed reading of a scaled effect for ONE context. `influence` and
 * `amount` are absent for `reference` (no player → no personal number);
 * `agendaStep` names the step the forecast's scenario stands on.
 */
export type InfluenceYield = {
  effect: InfluenceScaledEffect;
  context: InfluenceYieldContext;
  influence?: number;
  amount?: number;
  /** An effect with a count term: the counted items the reading stands on (B). */
  count?: number;
  /** …and WHICH cards they are — so the number can be explained (absent when unknown). */
  counted?: ReadonlyArray<CardName>;
  /** …and what EACH of them contributed (a tag count: a two-power-tag card is 2). */
  countedUnits?: ReadonlyArray<number>;
  /** A count over SEVERAL tags: each tag's own total («Venus 1 · Jovian 2») — the reading's breakdown. */
  countedByTag?: ReadonlyArray<{tag: Tag, count: number}>;
  /** A BOARD count: WHICH cells were counted (a tile has no card — the list that explains the number is of cells). */
  countedSpaces?: ReadonlyArray<SpaceId>;
  /** …and, on the `tiers` measure, what EACH cell contributed (its stack's height, aligned with `countedSpaces`). */
  countedTiers?: ReadonlyArray<number>;
  /** A THRESHOLD count: the BREAKDOWN of the metric (there is no list — the value, the threshold, the step, the sets explain the number). */
  countedMetric?: ResolutionCountMetricModel;
  /** A PRODUCTION count: each resource's own steps («steel 2 · titanium 1 · energy 3») — the reading's breakdown, the twin of `countedByTag`. */
  countedByResource?: ReadonlyArray<ResolutionCountByResource>;
  /** A COLONIES count: WHICH tiles the counted cubes stand on (a name per cube — the list that explains the number where no card can). */
  countedColonies?: ReadonlyArray<ColonyName>;
  /** The formula's sum before the cap — above `amount` exactly when the cap bit. */
  uncapped?: number;
  /**
   * `resolving` / `applied` of a DISTRIBUTED card resource: where each unit
   * LANDED («Dirigibles +2 · Floating Habs +1») — the server's record, so the
   * reading can name the destinations without knowing the cards.
   */
  targets?: ReadonlyArray<{card: CardName, amount: number, resource?: CardResource}>;
  /**
   * A SEQUENTIAL effect: the player total this reading divides, BEFORE and
   * AFTER the earlier effect moved it («heat production 4 → 6 → 2 cards»).
   * `after` is what the amount stands on — for a live or recorded reading it
   * is the server's own value, never `before + influence`.
   */
  total?: {before: number, after: number};
  /**
   * A LEVEL effect: the level the formula brings the player UP TO («6 +
   * influence» cards in hand) — `total.before` is their level now, `amount`
   * the difference paid, `total.after` the level reached. For a live or
   * recorded reading it is the server's own target, never recomputed.
   */
  target?: number;
  /**
   * `resolving` / `applied` of a DRAW: what was actually dealt, when the
   * deck could not supply the whole amount. Absent = the full amount landed.
   */
  delivered?: number;
  /** `forecast` only: the Agenda step the scenario's influence is read at. */
  agendaStep?: number;
  /**
   * `resolving` / `applied`: the payout does NOT land — the server's reason
   * (an English i18n key: no influence, no card that can hold the resource).
   * `amount` stays what was owed, so a forfeited payout still names its size.
   */
  skipped?: string;
};

/** The counted part of a reading: how many items, which cards (or which cells, for a board count), and what each contributed. */
export type YieldCount = {
  count: number,
  cards?: ReadonlyArray<CardName>,
  units?: ReadonlyArray<number>,
  /** A multi-tag count's per-tag totals (the reading's breakdown). */
  byTag?: ReadonlyArray<{tag: Tag, count: number}>,
  /** A board count's cells (the list that explains the number where no card can). */
  spaces?: ReadonlyArray<SpaceId>,
  /** …and each cell's stack height on the `tiers` measure (aligned with `spaces`). */
  tiers?: ReadonlyArray<number>,
  /** A threshold count's breakdown of the metric (what explains the number where no list can). */
  metric?: ResolutionCountMetricModel,
  /** A production count's per-resource steps (the reading's breakdown). */
  byResource?: ReadonlyArray<ResolutionCountByResource>,
  /** A colonies count's tiles (a name per cube — the list that explains the number). */
  colonies?: ReadonlyArray<ColonyName>,
};

function withCount(y: InfluenceYield, effect: InfluenceScaledEffect, count: YieldCount | undefined): InfluenceYield {
  if (effect.count !== undefined && count !== undefined) {
    y.count = count.count;
    if (count.cards !== undefined) {
      y.counted = count.cards;
    }
    if (count.units !== undefined) {
      y.countedUnits = count.units;
    }
    if (count.byTag !== undefined) {
      y.countedByTag = count.byTag;
    }
    if (count.byResource !== undefined) {
      y.countedByResource = count.byResource;
    }
    if (count.colonies !== undefined) {
      y.countedColonies = count.colonies;
    }
    if (count.spaces !== undefined) {
      y.countedSpaces = count.spaces;
    }
    if (count.tiers !== undefined) {
      y.countedTiers = count.tiers;
    }
    if (count.metric !== undefined) {
      y.countedMetric = count.metric;
    }
  }
  if (effect.cap !== undefined && y.influence !== undefined) {
    y.uncapped = uncappedAmount(effect, y.influence, y.count ?? 0);
  }
  return y;
}

/**
 * The reading at `influence` (and the player's `count` for an effect with a
 * count term). An effect that COUNTS something cannot be read without its
 * count — the caller falls back to `referenceYield` rather than inventing 0.
 */
export function influenceYield(effect: InfluenceScaledEffect, context: Exclude<InfluenceYieldContext, 'reference' | 'forecast'>, influence: number, count?: YieldCount): InfluenceYield {
  return withCount({effect, context, influence, amount: scaledAmount(effect, influence, count?.count ?? 0)}, effect, count);
}

export function referenceYield(effect: InfluenceScaledEffect): InfluenceYield {
  return {effect, context: 'reference'};
}

/**
 * The «if you win the vote» scenario: the winner's marker advances ONE Agenda
 * step before the effect resolves (rulebook p.10 — step 1 precedes step 3),
 * so the influence read at the step reached counts. `influenceBonus` is every
 * influence the player holds beyond the track (card / colony bonuses); the
 * count term rides along at its current value (the phase changes no tableau
 * before the effect).
 */
export function winnerForecastYield(effect: InfluenceScaledEffect, agendaPosition: number, influenceBonus: number, count?: YieldCount): InfluenceYield {
  const step = Math.min(AGENDA_TRACK.length, Math.max(0, agendaPosition) + 1);
  const influence = influenceAtAgenda(step) + Math.max(0, influenceBonus);
  return withCount({effect, context: 'forecast', influence, amount: scaledAmount(effect, influence, count?.count ?? 0), agendaStep: step}, effect, count);
}

/**
 * The reading of a SEQUENTIAL effect for a total that has NOT been moved yet
 * (an estimate / a forecast): `before` is the player's total now, `steps` is
 * what the earlier effect is projected to add, and the amount stands on their
 * sum. The projection is the caller's — this module never guesses which
 * effect feeds which; it only divides once, in one place.
 */
export function sequelYield(
  effect: InfluenceScaledEffect,
  context: Exclude<InfluenceYieldContext, 'reference'>,
  before: number,
  steps: number,
  opts?: {influence?: number, agendaStep?: number},
): InfluenceYield {
  const after = Math.max(0, before + Math.max(0, steps));
  const y: InfluenceYield = {effect, context, amount: sequelAmount(effect, after), total: {before, after}};
  if (opts?.influence !== undefined) {
    y.influence = opts.influence;
  }
  if (opts?.agendaStep !== undefined) {
    y.agendaStep = opts.agendaStep;
  }
  return y;
}

/**
 * A SEQUENTIAL reading the SERVER fixed — the totals are the ones it read
 * (before and after its own change), the amount is the one it computed, and
 * `delivered` is what actually landed when the deck could not supply it all.
 * Nothing is recomputed from today's production.
 */
export function fixedSequelYield(
  effect: InfluenceScaledEffect,
  context: 'resolving' | 'applied',
  amount: number,
  total: {before: number, after: number},
  opts?: {influence?: number, delivered?: number},
): InfluenceYield {
  const y: InfluenceYield = {effect, context, amount, total};
  if (opts?.influence !== undefined) {
    y.influence = opts.influence;
  }
  if (opts?.delivered !== undefined && opts.delivered !== amount) {
    y.delivered = opts.delivered;
  }
  return y;
}

/**
 * The reading of a LEVEL effect for a level that has NOT been topped up yet
 * (an estimate / a forecast): `before` is the player's level now (the hand as
 * the model carries it), the target is the formula's result at `influence`,
 * and the amount is the ONE top-up division. A player at or above the target
 * reads a zero with the level term's own reason — the rule working, never a
 * lost payout.
 */
export function levelYield(
  effect: InfluenceScaledEffect,
  context: Exclude<InfluenceYieldContext, 'reference'>,
  influence: number,
  before: number,
  opts?: {agendaStep?: number},
): InfluenceYield {
  const level = Math.max(0, Math.floor(before));
  const target = scaledAmount(effect, influence);
  const amount = topUpAmount(effect, influence, level);
  const y: InfluenceYield = {effect, context, influence, amount, target, total: {before: level, after: level + amount}};
  if (opts?.agendaStep !== undefined) {
    y.agendaStep = opts.agendaStep;
  }
  return y;
}

/**
 * A LEVEL reading the SERVER fixed — the target it computed, the level it
 * read before and after its own draw, the amount it owed, and `delivered`
 * when the deck could not supply it all. Nothing is recomputed from today's
 * hand.
 */
export function fixedLevelYield(
  effect: InfluenceScaledEffect,
  context: 'resolving' | 'applied',
  amount: number,
  target: number,
  total: {before: number, after: number},
  opts?: {influence?: number, delivered?: number},
): InfluenceYield {
  const y: InfluenceYield = {effect, context, amount, target, total};
  if (opts?.influence !== undefined) {
    y.influence = opts.influence;
  }
  if (opts?.delivered !== undefined && opts.delivered !== amount) {
    y.delivered = opts.delivered;
  }
  return y;
}

/**
 * A yield whose amount was fixed by the server (a live payout, a recorded
 * outcome). The recorded inputs travel as recorded — `uncapped` is the
 * server's own sum, never recomputed here.
 */
export function fixedYield(
  effect: InfluenceScaledEffect,
  context: 'resolving' | 'applied',
  amount: number,
  influence?: number,
  recorded?: {
    count?: number, counted?: ReadonlyArray<CardName>, countedUnits?: ReadonlyArray<number>,
    countedByTag?: ReadonlyArray<{tag: Tag, count: number}>, countedSpaces?: ReadonlyArray<SpaceId>, countedTiers?: ReadonlyArray<number>,
    countedMetric?: ResolutionCountMetricModel,
    countedByResource?: ReadonlyArray<ResolutionCountByResource>, countedColonies?: ReadonlyArray<ColonyName>,
    uncapped?: number, targets?: ReadonlyArray<{card: CardName, amount: number, resource?: CardResource}>,
  },
): InfluenceYield {
  const y: InfluenceYield = {effect, context, amount, influence};
  if (recorded?.count !== undefined) {
    y.count = recorded.count;
  }
  if (recorded?.counted !== undefined) {
    y.counted = recorded.counted;
  }
  if (recorded?.countedUnits !== undefined) {
    y.countedUnits = recorded.countedUnits;
  }
  if (recorded?.countedByTag !== undefined) {
    y.countedByTag = recorded.countedByTag;
  }
  if (recorded?.countedByResource !== undefined) {
    y.countedByResource = recorded.countedByResource;
  }
  if (recorded?.countedColonies !== undefined) {
    y.countedColonies = recorded.countedColonies;
  }
  if (recorded?.countedSpaces !== undefined) {
    y.countedSpaces = recorded.countedSpaces;
  }
  if (recorded?.countedTiers !== undefined) {
    y.countedTiers = recorded.countedTiers;
  }
  if (recorded?.countedMetric !== undefined) {
    y.countedMetric = recorded.countedMetric;
  }
  if (recorded?.uncapped !== undefined) {
    y.uncapped = recorded.uncapped;
  }
  if (recorded?.targets !== undefined && recorded.targets.length > 0) {
    y.targets = recorded.targets;
  }
  return y;
}

/** The cap bit this reading: the formula added up to more than was (or would be) paid. */
export function yieldCapped(y: InfluenceYield): boolean {
  return y.uncapped !== undefined && y.amount !== undefined && y.uncapped > y.amount;
}

/**
 * The reading stands AT the effect's maximum — the most it can ever pay, so
 * another card or point of influence would add nothing. What the player's
 * «max» mark says (whether the sum reached the cap or went past it).
 */
export function yieldAtCap(y: InfluenceYield): boolean {
  return y.effect.cap !== undefined && y.amount !== undefined && y.amount >= y.effect.cap && y.skipped === undefined;
}
