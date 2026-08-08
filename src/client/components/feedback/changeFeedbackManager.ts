/**
 * @console-shared LIVE — console native stands on this file, so it is NOT covered
 * by the desktop-UI deprecation. Full quality bar applies (tests, guards, i18n).
 * Before changing it, check the console consumers in docs/DESKTOP_DEPRECATION_AUDIT.md.
 */
/*
 * Resource Change Feedback System — core manager.
 *
 * A module-level reactive store that tracks the last reported value
 * per (scopeKey, metricKey) tuple and reports deltas when a non-initial
 * change is detected. Designed to power the AnimatedMetricValue
 * component (and any future HUD widget that wants to flash on value
 * changes — global parameters, card resources, oxygen / temperature
 * tracks, etc).
 *
 * Contract:
 *
 *   manager.report(scopeKey, metricKey, newValue) → FeedbackEvent | null
 *
 * Returns null on the FIRST report for a given (scopeKey, metricKey)
 * pair — first observation is the baseline, not a change. Subsequent
 * reports return a FeedbackEvent IF and ONLY IF the new value differs
 * from the previously reported value.
 *
 * Rapid-fire COALESCING: if a second change arrives while a previous
 * delta is still "active" (haven't been cleared via clearActive()),
 * the returned event's `netDelta` is the *running net* delta from the
 * first change up to this one and `merged` is true. Example: stock
 * 61 → 63 → 66 within the chip lifetime produces {+2}, then {+5} (NOT
 * {+3}). AnimatedMetricValue uses `merged` to update the EXISTING chip
 * in place — one accumulator counting up — instead of remounting a
 * chip per change and stacking a row of numbers on screen.
 *
 * TWO RULES make that honest:
 *
 *   1. A SIGN IS NEVER COALESCED AWAY. A gain and a loss are two
 *      different events and always get two separate chips: a −1
 *      arriving on top of an active +3 does NOT become +2 (which
 *      would report a change that never happened and could even net
 *      to a chip-less 0). It starts a fresh −1 accumulation, and the
 *      +3 chip lives out its own life beside it.
 *   2. THE WINDOW MEASURES THE GAP BETWEEN CHANGES, not the age of
 *      the burst. Seven cards landing one by one over three seconds
 *      is ONE arrival, so `activeStartedAt` slides forward on every
 *      merge; the accumulation ends when the changes stop, which is
 *      exactly when the chip fades. Callers that know their own chip
 *      lifetime pass it as `mergeWindowMs` so the two agree exactly.
 *
 * Scope switching safety: each scope has its own entry table, so
 * switching the displayed player (color → color) is treated as a
 * fresh observation for the new color and no false delta fires. Pass
 * the game runId or epoch in scopeKey to discard state across game
 * sessions.
 *
 * Scope-switch-back safety: `recordScopeObservation()` tracks the
 * MOST RECENT scope observed per metric, returning whether the
 * caller's current scope still matches that recent one. Callers use
 * the returned boolean to suppress chips when remounting back to a
 * scope that was just observed under a DIFFERENT colour — covers the
 * "click another player, then act on own card → panel snaps back to
 * own scope, but no real value change happened" case where a remount
 * could otherwise misread its baseline as a delta.
 */

import {motionMs} from '@/client/components/motion/motionTokens';
import {reducedMotionActive} from '@/client/utils/reducedMotion';

export interface FeedbackEvent {
  readonly delta: number;
  readonly netDelta: number;
  readonly previousValue: number;
  readonly newValue: number;
  readonly merged: boolean;
}

interface Entry {
  lastValue: number;
  activeDelta: number;
  activeStartedAt: number;
}

class ChangeFeedbackManager {
  private readonly entries = new Map<string, Entry>();

  /*
   * Default activeDelta window — how long after a delta is observed we
   * consider a follow-up change a continuation of the same one rather
   * than a fresh change. It is the GAP allowance between two changes,
   * not the lifetime of the whole burst (see rule 2 in the header).
   *
   * Only a fallback: a caller that owns a visible chip passes its own
   * lifetime as `mergeWindowMs`, because the honest window IS "while
   * the chip is still on screen". With this constant alone the two
   * disagreed for real variants (resource-stock lives 2240ms), so a
   * change landing in the gap started a SECOND chip beside a chip that
   * was still fully visible.
   *
   * Scaled by the motion speed preset at compare time (motionMs), like
   * the chip lifetimes themselves.
   */
  private static readonly MERGE_WINDOW_MS = 2000;

  /*
   * Per-metric "the last scope we OBSERVED a value for" map. Used to
   * detect point-of-view switches that should NOT fire chip
   * animations — e.g. clicking another player's card to inspect
   * their resources, then triggering an action whose response
   * remounts the panel back to the viewer's own scope. Without this
   * the remount mistakes "scope flipped from red back to blue" for a
   * real value change and fires chips against any stale blue
   * baseline that wasn't refreshed since the last switch.
   *
   * Keyed by metricKey alone (the metric identity), NOT by scopeKey
   * — we want a single "currently-observed scope" per metric so that
   * "blue → red → blue" cleanly detects the switch back. The recorded
   * scope value is the full scope string (epoch | scopeKey) so cross-
   * game-session observations don't collide.
   */
  private readonly lastObservedScope = new Map<string, string>();

  private key(scopeKey: string, metricKey: string): string {
    return `${scopeKey} ${metricKey}`;
  }

  /**
   * Record that the caller is about to report a value for
   * (scopeKey, metricKey). Returns `true` when the scope MATCHES
   * the last observation of this metric — meaning the follow-up
   * `report()` event, if any, should fire its chip — and `false`
   * when the scope is DIFFERENT from the last observation, which
   * marks a point-of-view switch: the returned event should be
   * suppressed and the value silently baselined into the new scope.
   *
   * The first observation of a metric (no prior scope recorded)
   * returns `true` — initial mounts behave like same-scope
   * observations. `report()` itself returns `null` on a first
   * observation, so no chip fires either way; the `true` here just
   * lets subsequent same-scope mounts animate normally without
   * special-casing the first one.
   */
  recordScopeObservation(scopeKey: string, metricKey: string): boolean {
    const last = this.lastObservedScope.get(metricKey);
    const sameScope = last === undefined || last === scopeKey;
    this.lastObservedScope.set(metricKey, scopeKey);
    return sameScope;
  }

  /**
   * Record a new observation. Returns a FeedbackEvent if a change
   * was detected relative to the previous observation, or null if
   * this is the first observation for the key (baseline) or the
   * value matched the previous observation.
   *
   * `mergeWindowMs` is the caller's own chip lifetime (base ms, scaled
   * here by the motion preset). Omit it and the module default applies.
   */
  report(scopeKey: string, metricKey: string, newValue: number, mergeWindowMs?: number): FeedbackEvent | null {
    const key = this.key(scopeKey, metricKey);
    const existing = this.entries.get(key);
    const now = currentTimestamp();

    if (existing === undefined) {
      this.entries.set(key, {lastValue: newValue, activeDelta: 0, activeStartedAt: 0});
      return null;
    }

    if (newValue === existing.lastValue) {
      return null;
    }

    const previousValue = existing.lastValue;
    const delta = newValue - previousValue;

    const windowMs = motionMs(mergeWindowMs ?? ChangeFeedbackManager.MERGE_WINDOW_MS);
    const withinWindow = existing.activeDelta !== 0 && (now - existing.activeStartedAt) <= windowMs;
    // A gain and a loss are two events, never one — see rule 1 in the header.
    const merged = withinWindow && (delta > 0) === (existing.activeDelta > 0);

    const netDelta = merged ? existing.activeDelta + delta : delta;

    existing.lastValue = newValue;
    existing.activeDelta = netDelta;
    // Sliding window: the allowance is the gap to the NEXT change, so a steady
    // stream (cards landing one by one) stays one accumulation.
    existing.activeStartedAt = now;

    return {
      delta,
      netDelta,
      previousValue,
      newValue,
      merged,
    };
  }

  /**
   * Called by the visible chip after its full lifecycle ends. Clears
   * the active-delta state for the key so the next change starts a
   * fresh chip (rather than continuing to merge against a delta
   * whose chip already faded out).
   */
  clearActive(scopeKey: string, metricKey: string): void {
    const key = this.key(scopeKey, metricKey);
    const existing = this.entries.get(key);
    if (existing !== undefined) {
      existing.activeDelta = 0;
      existing.activeStartedAt = 0;
    }
  }

  /**
   * Force the baseline (last reported value) for a (scopeKey, metricKey)
   * WITHOUT emitting a delta, and clear any active-delta window so the next
   * change starts fresh.
   *
   * Used by the energy→heat conversion transition: after the paired
   * "Energy −X → Heat +X" animation has told that story, the upcoming commit
   * still carries production income on energy.stock / heat.stock. Re-baselining
   * those two metrics to their POST-conversion values here means the
   * AnimatedMetricValue chips that fire on the commit show only the production
   * REMAINDER (e.g. +3 energy / +4 heat), instead of the full net delta vs the
   * pre-conversion value — which would visually contradict the −X / +X chips
   * the conversion just showed.
   */
  setBaseline(scopeKey: string, metricKey: string, value: number): void {
    const key = this.key(scopeKey, metricKey);
    const existing = this.entries.get(key);
    if (existing === undefined) {
      this.entries.set(key, {lastValue: value, activeDelta: 0, activeStartedAt: 0});
    } else {
      existing.lastValue = value;
      existing.activeDelta = 0;
      existing.activeStartedAt = 0;
    }
    // Keep this metric's "currently observed scope" pointed at the seeded scope
    // so the next same-scope mount animates its remainder chip rather than
    // suppressing it as a point-of-view switch.
    this.lastObservedScope.set(metricKey, scopeKey);
  }

  /**
   * Drop every record for a specific scope. Useful when a scope is
   * known to be obsolete (e.g. a game has ended, an epoch changed)
   * to release memory and ensure any new scope re-baselines.
   */
  clearScope(scopeKey: string): void {
    const prefix = `${scopeKey} `;
    for (const key of Array.from(this.entries.keys())) {
      if (key.startsWith(prefix)) {
        this.entries.delete(key);
      }
    }
  }

  /**
   * Drop every record. Intended for test reset.
   */
  reset(): void {
    this.entries.clear();
    this.lastObservedScope.clear();
  }
}

function currentTimestamp(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

export const changeFeedbackManager = new ChangeFeedbackManager();

/**
 * Detect prefers-reduced-motion. Delegates to the ONE reactive source
 * (`utils/reducedMotion` on VueUse `usePreferredReducedMotion`) — kept here
 * under its historical name so the many existing importers stay unchanged. It
 * is now LIVE (reflects an OS-setting change mid-session) instead of the old
 * cache-forever snapshot, and still O(1) per read (safe for hot loops).
 */
export function prefersReducedMotion(): boolean {
  return reducedMotionActive();
}
