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
 * Rapid-fire merging: if a second change arrives while a previous
 * delta is still "active" (haven't been cleared via clearActive()),
 * the returned event's `delta` is the *running net* delta from the
 * first change up to this one. Example: stock 61 → 63 → 66 within
 * the chip lifetime produces deltas {+2}, then {+5} (NOT {+3}). The
 * AnimatedMetricValue uses this to update an existing chip in place
 * rather than stacking chips.
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
   * The activeDelta window — how long after a delta is observed we
   * consider a follow-up change a "merge" rather than a fresh
   * change. Matches the chip's visible+fadeout window so that the
   * merge behaviour stays in sync with what the player sees — and is
   * therefore scaled by the motion speed preset at compare time
   * (motionMs), like the chip lifetimes themselves.
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
   */
  report(scopeKey: string, metricKey: string, newValue: number): FeedbackEvent | null {
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

    const stillActive = existing.activeDelta !== 0 &&
      (now - existing.activeStartedAt) <= motionMs(ChangeFeedbackManager.MERGE_WINDOW_MS);

    const netDelta = stillActive ? existing.activeDelta + delta : delta;

    existing.lastValue = newValue;
    existing.activeDelta = netDelta;
    existing.activeStartedAt = stillActive ? existing.activeStartedAt : now;

    return {
      delta,
      netDelta,
      previousValue,
      newValue,
      merged: stillActive,
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
 * Detect prefers-reduced-motion in a browser-safe way. SSR / tests
 * default to false (no reduced motion). Memoised because the media
 * query never changes within a session and a hot poll loop shouldn't
 * pay for matchMedia repeatedly.
 */
let cachedReducedMotion: boolean | undefined;
export function prefersReducedMotion(): boolean {
  if (cachedReducedMotion !== undefined) {
    return cachedReducedMotion;
  }
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    cachedReducedMotion = false;
    return false;
  }
  cachedReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return cachedReducedMotion;
}
