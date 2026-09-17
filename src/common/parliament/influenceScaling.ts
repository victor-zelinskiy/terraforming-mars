/*
 * INFLUENCE → A COMPUTED RESULT (Turmoil Redux).
 *
 * Most resolutions scale an effect by a player's INFLUENCE («1 animal per
 * point of influence», «2 M€ per influence», «steel = influence, max 5»).
 * The rule is one declaration — `InfluenceScaledEffect` — and ONE arithmetic
 * — `scaledAmount` — shared by the server (the actual payout) and the client
 * (the estimate on the vote surface, the fullscreen inspector, the picker's
 * header, the playground). Nothing re-derives the formula; a surface that
 * needs a number asks this module with the influence of the context it is in.
 *
 * The CONTEXTS a surface computes for are told apart (`InfluenceYieldContext`),
 * because the same rule answers different questions:
 *   estimate  — the viewer's CURRENT influence («if this were enacted now»);
 *   forecast  — a NAMED scenario (the viewer wins the vote: the Agenda
 *               advance of step 1 counts before the effect of step 3);
 *   resolving — the payout being made right now (the server's own amount);
 *   applied   — what was ACTUALLY paid (never recomputed from a later
 *               influence);
 *   reference — no player at all: the formula alone, no invented number.
 */
import {CardResource} from '../CardResource';
import {Resource} from '../Resource';
import {AGENDA_TRACK, influenceAtAgenda} from './ParliamentTypes';

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
  /** An upper bound of the whole amount (the «max 5» family). */
  cap?: number;
  /** Who receives it: every participant, or the winner of the vote only. */
  recipient: 'each' | 'winner';
};

/** The amount `effect` yields at `influence` — the ONE formula. */
export function scaledAmount(effect: InfluenceScaledEffect, influence: number): number {
  const raw = (effect.base ?? 0) + effect.perInfluence * Math.max(0, Math.floor(influence));
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
  /** `forecast` only: the Agenda step the scenario's influence is read at. */
  agendaStep?: number;
  /**
   * `resolving` / `applied`: the payout does NOT land — the server's reason
   * (an English i18n key: no influence, no card that can hold the resource).
   * `amount` stays what was owed, so a forfeited payout still names its size.
   */
  skipped?: string;
};

export function influenceYield(effect: InfluenceScaledEffect, context: Exclude<InfluenceYieldContext, 'reference' | 'forecast'>, influence: number): InfluenceYield {
  return {effect, context, influence, amount: scaledAmount(effect, influence)};
}

export function referenceYield(effect: InfluenceScaledEffect): InfluenceYield {
  return {effect, context: 'reference'};
}

/**
 * The «if you win the vote» scenario: the winner's marker advances ONE Agenda
 * step before the effect resolves (rulebook p.10 — step 1 precedes step 3),
 * so the influence read at the step reached counts. `influenceBonus` is every
 * influence the player holds beyond the track (card / colony bonuses).
 */
export function winnerForecastYield(effect: InfluenceScaledEffect, agendaPosition: number, influenceBonus: number): InfluenceYield {
  const step = Math.min(AGENDA_TRACK.length, Math.max(0, agendaPosition) + 1);
  const influence = influenceAtAgenda(step) + Math.max(0, influenceBonus);
  return {effect, context: 'forecast', influence, amount: scaledAmount(effect, influence), agendaStep: step};
}

/** A yield whose amount was fixed by the server (a live payout, a recorded outcome). */
export function fixedYield(effect: InfluenceScaledEffect, context: 'resolving' | 'applied', amount: number, influence?: number): InfluenceYield {
  return {effect, context, amount, influence};
}
