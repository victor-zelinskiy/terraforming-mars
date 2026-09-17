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
import {Resource} from '../Resource';
import {AGENDA_TRACK, influenceAtAgenda} from './ParliamentTypes';
import {ResolutionCountTerm} from './resolutionCounts';

/** WHAT one unit of the yield is. */
export type InfluenceYieldUnit =
  | {kind: 'cardResource', resource: CardResource}
  | {kind: 'stock', resource: Resource}
  | {kind: 'production', resource: Resource}
  | {kind: 'cards'};

export type InfluenceScaledEffect = {
  /** Stable within the resolution — the outcome record and the UI key on it. */
  id: string;
  unit: InfluenceYieldUnit;
  /** Units per point of influence. */
  perInfluence: number;
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
  return (effect.base ?? 0) + countPart + effect.perInfluence * Math.max(0, Math.floor(influence));
}

/** The amount `effect` yields at `influence` (and `counted` items of its count term) — the ONE formula. */
export function scaledAmount(effect: InfluenceScaledEffect, influence: number, counted: number = 0): number {
  const raw = uncappedAmount(effect, influence, counted);
  return effect.cap === undefined ? raw : Math.min(effect.cap, raw);
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
  /** The formula's sum before the cap — above `amount` exactly when the cap bit. */
  uncapped?: number;
  /** `forecast` only: the Agenda step the scenario's influence is read at. */
  agendaStep?: number;
  /**
   * `resolving` / `applied`: the payout does NOT land — the server's reason
   * (an English i18n key: no influence, no card that can hold the resource).
   * `amount` stays what was owed, so a forfeited payout still names its size.
   */
  skipped?: string;
};

/** The counted part of a reading: how many items, which cards, and what each contributed. */
export type YieldCount = {count: number, cards?: ReadonlyArray<CardName>, units?: ReadonlyArray<number>};

function withCount(y: InfluenceYield, effect: InfluenceScaledEffect, count: YieldCount | undefined): InfluenceYield {
  if (effect.count !== undefined && count !== undefined) {
    y.count = count.count;
    if (count.cards !== undefined) {
      y.counted = count.cards;
    }
    if (count.units !== undefined) {
      y.countedUnits = count.units;
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
 * A yield whose amount was fixed by the server (a live payout, a recorded
 * outcome). The recorded inputs travel as recorded — `uncapped` is the
 * server's own sum, never recomputed here.
 */
export function fixedYield(
  effect: InfluenceScaledEffect,
  context: 'resolving' | 'applied',
  amount: number,
  influence?: number,
  recorded?: {count?: number, counted?: ReadonlyArray<CardName>, countedUnits?: ReadonlyArray<number>, uncapped?: number},
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
  if (recorded?.uncapped !== undefined) {
    y.uncapped = recorded.uncapped;
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
