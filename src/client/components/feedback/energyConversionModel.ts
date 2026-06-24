/*
 * Energy → Heat conversion transition — PURE model layer.
 *
 * Deliberately free of Vue / DOM so it can be unit-tested under the plain
 * server test runner (like victoryPointsModel / cardSelectionFit). The reactive
 * state machine, the rAF interpolation and the modal gate live in the sibling
 * `energyConversionTransition.ts`, which imports these pure helpers.
 *
 * The semantic conversion event is the SAME for both triggers — the automatic
 * end-of-generation "all energy turns to heat" and the Supercapacitors
 * player-chosen amount — they differ only in WHERE the amount comes from
 * (server-side, both already snapshotted onto `PlayerViewModel.energyHeatConversion`).
 */

import {ViewModel, PlayerViewModel} from '@/common/models/PlayerModel';
import {Color} from '@/common/Color';

/**
 * A fully-resolved conversion ready to animate. `source`/`target` mirror the
 * shape the spec asks for (a paired resource delta) so the visual layer reads
 * as ONE conversion rather than two unrelated changes.
 */
export type EnergyConversionEvent = {
  readonly color: Color;
  /** Game runId / epoch — used to address the change-feedback baselines. */
  readonly runId: string;
  readonly trigger: 'end-generation';
  /** Energy converted into heat (≥ 1). */
  readonly amount: number;
  readonly source: {
    readonly resource: 'energy';
    readonly before: number;
    readonly after: number;
    readonly delta: number; // = -amount
  };
  readonly target: {
    readonly resource: 'heat';
    readonly before: number;
    readonly after: number;
    readonly delta: number; // = +amount
  };
  /** `${color}:${generation}` — the client dedups replays on this. */
  readonly dedupeKey: string;
};

// Duration tuning. Weighty enough to read as a premium beat, a touch longer for
// a big battery dump, hard-capped so a 30-energy conversion never drags.
//   duration = clamp(1100 + amount * 45, 1200, 2200)
// (≈ +400 ms over the first pass — small reads ~1200, medium ~1400-1700, large
// caps at 2200.)
export const CONVERSION_BASE_MS = 1100;
export const CONVERSION_PER_ENERGY_MS = 45;
export const CONVERSION_MIN_MS = 1200;
export const CONVERSION_MAX_MS = 2200;
// prefers-reduced-motion: a brief readable highlight, no long counter travel —
// still a clear beat, never instant.
export const CONVERSION_REDUCED_MS = 480;

export function conversionDurationMs(amount: number, reducedMotion: boolean): number {
  if (reducedMotion) {
    return CONVERSION_REDUCED_MS;
  }
  const raw = CONVERSION_BASE_MS + Math.max(0, amount) * CONVERSION_PER_ENERGY_MS;
  return Math.min(CONVERSION_MAX_MS, Math.max(CONVERSION_MIN_MS, raw));
}

function asPlayerView(view: ViewModel | undefined): PlayerViewModel | undefined {
  // Spectator views carry no `thisPlayer` / conversion field.
  if (view === undefined) {
    return undefined;
  }
  const pv = view as PlayerViewModel;
  return pv.thisPlayer !== undefined ? pv : undefined;
}

/**
 * Read the server-provided conversion snapshot off a view, resolving it into a
 * full paired event. Returns undefined when there's nothing to animate (no
 * snapshot, zero amount, or a spectator view).
 */
export function readConversionEvent(view: ViewModel | undefined): EnergyConversionEvent | undefined {
  const pv = asPlayerView(view);
  if (pv === undefined) {
    return undefined;
  }
  const conv = pv.energyHeatConversion;
  if (conv === undefined || conv.amount <= 0) {
    return undefined;
  }
  const color = pv.thisPlayer.color;
  const energyAfter = conv.energyBefore - conv.amount;
  const heatAfter = conv.heatBefore + conv.amount;
  return {
    color,
    runId: pv.runId,
    trigger: 'end-generation',
    amount: conv.amount,
    source: {resource: 'energy', before: conv.energyBefore, after: energyAfter, delta: -conv.amount},
    target: {resource: 'heat', before: conv.heatBefore, after: heatAfter, delta: conv.amount},
    dedupeKey: `${color}:${conv.generation}`,
  };
}

/**
 * Should this event animate right now? False when already seen (a poll replay)
 * or when there is no previous view to transition FROM — a fresh page load /
 * F5 landing straight on the post-production view shouldn't replay a conversion
 * that happened before the player was looking. Pure so the gate's dedup logic
 * is testable without the reactive controller.
 */
export function shouldAnimateConversion(
  prev: ViewModel | undefined,
  event: EnergyConversionEvent | undefined,
  seen: ReadonlySet<string>): boolean {
  if (event === undefined) {
    return false;
  }
  if (seen.has(event.dedupeKey)) {
    return false;
  }
  if (prev === undefined) {
    return false;
  }
  return true;
}

export function easeOutCubic(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - c, 3);
}

/** Eased interpolation between two values; clamps t to [0, 1]. */
export function interpolate(from: number, to: number, t: number): number {
  return from + (to - from) * easeOutCubic(t);
}
