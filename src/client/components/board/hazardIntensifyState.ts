import {HAZARD_STEPS, hazardSeverity} from '@/common/AresTileType';
import {TileType} from '@/common/TileType';

/**
 * One-shot "hazard intensified" (mild → severe) animation tracker. A planetary
 * event upgrades hazards in place; without this they'd snap to the severe sprite
 * in one frame. This remembers each cell's last severity and, on an INCREASE,
 * starts a ~1.4s pulse.
 *
 * Module-level on purpose: the board (inside PlayerHome) REMOUNTS on the very
 * server response that delivers the new severity, so a component-local trigger
 * would re-fire (or be lost) on every poll. The caller feeds the returned ELAPSED
 * ms into a NEGATIVE animation-delay, so the keyframe stays continuous across
 * remounts and plays exactly once. First sighting (appearance), a weakening, or
 * reduced-motion → -1 (no animation): only a real strengthening animates.
 */

export const HAZARD_INTENSIFY_MS = 1400;

type Cell = {severity: number, start: number};
const cells = new Map<string, Cell>();

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : 0;
}

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** 0 (none) / 1 (mild) / 2 (severe). */
export function hazardSeverityLevel(tileType: TileType | undefined): number {
  return HAZARD_STEPS[hazardSeverity(tileType)];
}

/**
 * Elapsed ms of an active intensify animation for this cell, or -1 when it is not
 * animating. Feed a non-negative result into `animation-delay: -<elapsed>ms`.
 */
export function hazardIntensifyElapsed(spaceId: string, tileType: TileType | undefined): number {
  const severity = hazardSeverityLevel(tileType);
  const c = cells.get(spaceId);
  if (c === undefined) {
    cells.set(spaceId, {severity, start: 0});
    return -1;
  }
  if (severity > c.severity) {
    // Animate only a STRENGTHENING (the cell was ALREADY a hazard, mild → severe).
    // A 0 → mild/severe rise is an APPEARANCE, not a strengthening — no pulse.
    const wasHazard = c.severity >= 1;
    c.severity = severity;
    c.start = wasHazard && !reducedMotion() ? nowMs() : 0;
  } else if (severity !== c.severity) {
    c.severity = severity;
    c.start = 0;
  }
  if (c.start <= 0) {
    return -1;
  }
  const elapsed = nowMs() - c.start;
  return elapsed >= 0 && elapsed < HAZARD_INTENSIFY_MS ? elapsed : -1;
}

/** Test hook — clear all tracked cells. */
export function resetHazardIntensify(): void {
  cells.clear();
}
