/*
 * Energy → Heat conversion transition — controller + reactive state.
 *
 * This is the single "transition gate" for the end-of-generation energy→heat
 * conversion. It is the conversion analogue of the existing WGT-marker /
 * tile-placement holds in WaitingFor.vue: detect the conversion in the
 * prev→next view diff, play one bounded premium animation, and block the
 * commit of the new view (and therefore every next-phase modal / endgame
 * screen that keys off it) until the animation finishes.
 *
 * Ownership split:
 *   - the PURE detect / duration / interpolation maths live in
 *     `energyConversionModel.ts` (unit-tested under the server runner);
 *   - this module owns the reactive `energyConversionState` (the panel counter
 *     override + the overlay read it), the rAF interpolation, the dedup
 *     seen-set, the change-feedback baseline seeding, and the gate Promise.
 *
 * Both commit paths call the same three functions:
 *   detectEnergyConversion(prev, next) → runEnergyConversion(event) (await) →
 *   <commit the new view> → endEnergyConversion()
 * plus `isEnergyConversionActive()` as a re-entrancy guard.
 */

import {reactive} from 'vue';
import {Color} from '@/common/Color';
import {ViewModel} from '@/common/models/PlayerModel';
import {changeFeedbackManager, prefersReducedMotion} from './changeFeedbackManager';
import {
  EnergyConversionEvent,
  conversionDurationMs,
  interpolate,
  readConversionEvent,
} from './energyConversionModel';

type EnergyConversionState = {
  /**
   * True from the moment the animation starts until `endEnergyConversion()`
   * clears the override (just after the new view commits). While true:
   *   - PlayerResource shows the interpolated `displayEnergy` / `displayHeat`
   *     for the converting player's energy / heat rows (and the highlight);
   *   - the App-level EnergyConversionOverlay renders the arrow + paired chips;
   *   - the poll commit path is a no-op (re-entrancy guard).
   */
  active: boolean;
  /** Whose conversion — matched against PlayerResource.scopeKey (player color). */
  color: Color | '';
  amount: number;
  /** Interpolated counter values driving the panel override. */
  displayEnergy: number;
  displayHeat: number;
  /** Post-conversion targets (energyBefore − amount / heatBefore + amount). */
  energyAfter: number;
  heatAfter: number;
  /** Gate the floating delta chips on/off independently of `active`. */
  showChips: boolean;
  reducedMotion: boolean;
  /** Bumped on each run so the overlay re-measures cell rects. */
  nonce: number;
};

export const energyConversionState = reactive<EnergyConversionState>({
  active: false,
  color: '',
  amount: 0,
  displayEnergy: 0,
  displayHeat: 0,
  energyAfter: 0,
  heatAfter: 0,
  showChips: false,
  reducedMotion: false,
  nonce: 0,
});

// Replays of the same conversion (the same view re-fetched by the poll loop)
// must not re-animate. Claimed exactly once in `detectEnergyConversion`.
const seen = new Set<string>();

let rafId = 0;
let safetyTimerId = 0;
let resolveActive: (() => void) | undefined;

function now(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function cancelTimers(): void {
  if (rafId !== 0) {
    if (typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(rafId);
    }
    rafId = 0;
  }
  if (safetyTimerId !== 0) {
    clearTimeout(safetyTimerId);
    safetyTimerId = 0;
  }
}

export function isEnergyConversionActive(): boolean {
  return energyConversionState.active;
}

/**
 * Detect (and atomically CLAIM) a conversion to animate for the prev→next view
 * transition. Returns the event only when it should animate now; returns
 * undefined when there's nothing, when it was already seen, or when this is a
 * fresh load (no `prev`) — in the latter two cases the dedupe key is still
 * marked seen so a subsequent poll doesn't replay it. Claiming here (not in
 * `runEnergyConversion`) keeps it synchronous, so two near-simultaneous poll
 * responses can't both fire it.
 */
export function detectEnergyConversion(
  prev: ViewModel | undefined,
  next: ViewModel | undefined): EnergyConversionEvent | undefined {
  const event = readConversionEvent(next);
  if (event === undefined) {
    return undefined;
  }
  if (seen.has(event.dedupeKey)) {
    return undefined;
  }
  // Claim it once, regardless of whether we end up animating. A fresh load
  // (no prev) still claims it so a later poll doesn't replay a conversion the
  // player never saw happen.
  seen.add(event.dedupeKey);
  return prev === undefined ? undefined : event;
}

/**
 * Start the conversion animation and return a Promise that resolves when it has
 * finished (the caller then commits the new view). `state.active` is set
 * SYNCHRONOUSLY before returning so the re-entrancy guard is closed immediately.
 * A safety timer guarantees the Promise resolves even if rAF is frozen (e.g. a
 * backgrounded tab), so the modal gate can never hang forever.
 */
export function runEnergyConversion(event: EnergyConversionEvent): Promise<void> {
  cancelTimers();
  const reduced = prefersReducedMotion();

  energyConversionState.active = true;
  energyConversionState.color = event.color;
  energyConversionState.amount = event.amount;
  energyConversionState.energyAfter = event.source.after;
  energyConversionState.heatAfter = event.target.after;
  energyConversionState.displayEnergy = event.source.before;
  energyConversionState.displayHeat = event.target.before;
  energyConversionState.reducedMotion = reduced;
  energyConversionState.showChips = true;
  energyConversionState.nonce++;

  const duration = conversionDurationMs(event.amount, reduced);
  const startedAt = now();

  const promise = new Promise<void>((resolve) => {
    resolveActive = resolve;
  });

  const finish = () => {
    energyConversionState.displayEnergy = event.source.after;
    energyConversionState.displayHeat = event.target.after;
    // Re-baseline so the production-income chips on the upcoming commit show the
    // remainder, not the full pre-conversion delta. See setBaseline().
    const scope = `${event.runId}|${event.color}`;
    changeFeedbackManager.setBaseline(scope, 'energy.stock', event.source.after);
    changeFeedbackManager.setBaseline(scope, 'heat.stock', event.target.after);
    cancelTimers();
    const r = resolveActive;
    resolveActive = undefined;
    r?.();
  };

  if (reduced || typeof requestAnimationFrame !== 'function') {
    // Reduced motion (or no rAF, e.g. tests): snap the override to the result,
    // hold for a brief readable highlight, then resolve.
    energyConversionState.displayEnergy = event.source.after;
    energyConversionState.displayHeat = event.target.after;
    safetyTimerId = window.setTimeout(finish, duration) as unknown as number;
  } else {
    const tick = () => {
      const t = Math.min(1, (now() - startedAt) / duration);
      energyConversionState.displayEnergy = interpolate(event.source.before, event.source.after, t);
      energyConversionState.displayHeat = interpolate(event.target.before, event.target.after, t);
      if (t >= 1) {
        finish();
        return;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    // rAF is paused in background tabs; this guarantees resolution + commit.
    safetyTimerId = window.setTimeout(finish, duration + 400) as unknown as number;
  }

  return promise;
}

/**
 * Clear the panel override + overlay AFTER the new view has committed. Call on
 * the next tick so the freshly-mounted panel reads the canonical (final) values
 * — and the seeded production chips fire — without a flash of the pre-commit
 * value. Idempotent.
 */
export function endEnergyConversion(): void {
  cancelTimers();
  energyConversionState.active = false;
  energyConversionState.showChips = false;
  energyConversionState.color = '';
}

/** Test-only full reset (state + dedup + timers). */
export function resetEnergyConversion(): void {
  cancelTimers();
  resolveActive = undefined;
  seen.clear();
  energyConversionState.active = false;
  energyConversionState.color = '';
  energyConversionState.amount = 0;
  energyConversionState.displayEnergy = 0;
  energyConversionState.displayHeat = 0;
  energyConversionState.energyAfter = 0;
  energyConversionState.heatAfter = 0;
  energyConversionState.showChips = false;
  energyConversionState.reducedMotion = false;
  energyConversionState.nonce = 0;
}
