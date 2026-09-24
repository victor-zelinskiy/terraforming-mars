/*
 * THE LEVY of a resolution (Turmoil Redux — the BUDGET family: Greens,
 * Industrialist, Mars First, Reds, Scientists, Unity Budget). The first thing
 * every one of those cards does at the enactment is TAKE a fixed sum from
 * every participant («Lose 10 M€») — the first NEGATIVE amount a resolution
 * ever moves — and only then pay by the seat's own count and influence.
 *
 * A levy is NOT an influence-scaled effect with a negative rate: `scaledAmount`
 * and every reading built on it answer «how much is RECEIVED», and a skip at
 * `amount ≤ 0` would turn the loss into «nothing happened». So the levy is its
 * own declaration (`ResolutionDefinition.levy`), paid by ONE shared step
 * (`server/parliament/resolutions/ResolutionLevy.ts`) and read by ONE
 * arithmetic — this module — shared by the server (the payout), the client
 * (the vote panel's net line, the sitting's reading, the results) and the
 * stand. A card declares the sum and nothing else; the next budget declares
 * 12 instead of 10.
 *
 * THE TWO LAWS OF A LEVY:
 *   · it can never take the seat below zero — a seat holding less pays what it
 *     holds, and that shortfall is NAMED (the record carries both what was
 *     taken and what was owed; a seat holding nothing pays nothing and still
 *     receives the payout — the card asks no solvency);
 *   · the printed order IS the executed order: the levy runs FIRST, then the
 *     payout, then the flat part. Never reordered «so the player can afford
 *     it» — that changes the outcome for the seat that is short.
 *
 * Pure: numbers and English keys, no engine, no DOM.
 */
import {Resource} from '../Resource';
import {InfluenceScaledEffect} from './influenceScaling';

/** A FIXED sum every participant LOSES at the enactment, before anything is paid. */
export type ResolutionLevy = {
  resource: Resource;
  /** The printed sum (> 0) — what is OWED; what is TAKEN is `levyPaid`. */
  amount: number;
  /** Every participant (the family knows no winner-only levy). */
  recipient: 'each';
};

/** The step key the shared levy step reports under — the client finds the record by it (structural, never a title). */
export const LEVY_STEP_KEY = 'levy';

/** THE ONE ARITHMETIC: what a seat holding `held` actually pays of the levy — never more than it holds, never negative. */
export function levyPaid(levy: ResolutionLevy, held: number): number {
  return Math.max(0, Math.min(Math.floor(levy.amount), Math.floor(held)));
}

/** The seat is SHORT: it holds less than the levy owes. */
export function levyShort(levy: ResolutionLevy, held: number): boolean {
  return levyPaid(levy, held) < Math.floor(levy.amount);
}

/**
 * THE SKIP REASON of a levy that could take NOTHING (the seat holds none of
 * the resource) — the server's record carries it, every reading prints it.
 */
export function levyNothingReasonKey(resource: Resource): string {
  return resource === Resource.MEGACREDITS ? 'No M€ to pay the levy' : 'Nothing to pay the levy with';
}

/** THE NOTE of a PARTIAL levy — taken, but less than owed (a paying record with a reason, never a skip). */
export function levyShortReasonKey(resource: Resource): string {
  return resource === Resource.MEGACREDITS ? 'Not enough M€: the rest of the levy is not taken' : 'Not enough resources: the rest of the levy is not taken';
}

/** The vote panel's WARNING beside the reading of a seat that could not pay the whole levy right now. */
export function levyShortNoteKey(resource: Resource): string {
  return resource === Resource.MEGACREDITS ? 'Not enough M€ for the levy' : 'Not enough resources for the levy';
}

/**
 * THE PAYOUT THE NET STANDS ON: the scaled part paid INTO THE SUPPLY in the
 * levy's own currency, to every participant («−10 M€ → +7 M€ = −3 M€»).
 * Undefined when the card pays nothing in that currency — the levy then
 * reads alone. A production part is never the net's other half: today's
 * pocket and next generation's income are two horizons, never one sum.
 */
export function levyNetEffectOf(levy: ResolutionLevy, scaled: ReadonlyArray<InfluenceScaledEffect> | undefined): InfluenceScaledEffect | undefined {
  return scaled?.find((effect) => effect.unit.kind === 'stock' && effect.unit.resource === levy.resource && effect.recipient === 'each' && effect.sequel === undefined);
}

/** A levy is declared with a positive whole sum of a standard resource, to everybody — the guard's own check. */
export function levyDeclared(levy: ResolutionLevy | undefined): levy is ResolutionLevy {
  return levy !== undefined && Number.isInteger(levy.amount) && levy.amount > 0 && levy.recipient === 'each';
}

export type LevyReadingContext = 'estimate' | 'resolving' | 'applied';

/**
 * ONE READING of a levy for one seat and one context — the vote panel's
 * estimate from what the seat holds now, the sitting's live line, the
 * recorded amount afterwards. `paid` is what LEAVES (≥ 0; 0 = nothing to
 * take); `net` is the day's balance once the payout in the same currency is
 * known («−10 → +7 = −3»), absent when the card pays nothing in it.
 */
export type LevyReading = {
  resource: Resource;
  context: LevyReadingContext;
  owed: number;
  paid: number;
  /** Less than owed was (or would be) taken. */
  short: boolean;
  /** The supply the estimate was read from (an estimate only). */
  held?: number;
  /** The payout in the same currency (the net's other half) — the effect and its amount, when known. */
  payout?: {effectId: string, amount: number};
  /** `paid` and the payout, netted: negative = the seat ends the enactment poorer today. */
  net?: number;
  /** The server's own words for a levy that took nothing / less than owed (an English key). */
  note?: string;
};

function netted(reading: LevyReading, payout: {effectId: string, amount: number} | undefined): LevyReading {
  if (payout === undefined) {
    return reading;
  }
  return {...reading, payout, net: payout.amount - reading.paid};
}

/** The ESTIMATE from what the seat holds now (the vote panel), with the payout the net stands on when known. */
export function levyEstimate(levy: ResolutionLevy, held: number, payout?: {effectId: string, amount: number}): LevyReading {
  const paid = levyPaid(levy, held);
  const short = levyShort(levy, held);
  const reading: LevyReading = {resource: levy.resource, context: 'estimate', owed: Math.floor(levy.amount), paid, short, held};
  if (paid === 0) {
    reading.note = levyNothingReasonKey(levy.resource);
  } else if (short) {
    reading.note = levyShortReasonKey(levy.resource);
  }
  return netted(reading, payout);
}

/**
 * The READING OF A RECORD — what the server actually took (a `stock` record
 * with a negative amount, or a `skipped` one that took nothing), never
 * recomputed from a later supply. `owed` rides the record; an older record
 * without it reads the declaration's sum.
 */
export function levyRecorded(
  levy: ResolutionLevy,
  record: {kind: string, amount?: number, owed?: number, reason?: string},
  context: 'resolving' | 'applied',
  payout?: {effectId: string, amount: number},
): LevyReading {
  const paid = record.kind === 'skipped' ? 0 : Math.max(0, -(record.amount ?? 0));
  const owed = record.owed ?? Math.floor(levy.amount);
  const reading: LevyReading = {resource: levy.resource, context, owed, paid, short: paid < owed};
  if (record.reason !== undefined) {
    reading.note = record.reason;
  }
  return netted(reading, payout);
}
