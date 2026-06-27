/*
 * Hazard-cleanup transition — PURE model (no Vue / DOM), unit-tested under the
 * server runner. The premium "build over a hazard → it is cleared, then the new
 * tile materialises, then the cost/TR feedback" sequence, mirroring the split
 * used by `energyConversionModel` (pure) + `energyConversionTransition`
 * (controller). This file owns ONLY the maths: detect the cleanup in a
 * prev→next board diff, derive its severity / cost / TR, and map the animation
 * progress to per-element intensities + the discrete phase.
 *
 * Expansion-NEUTRAL: nothing here names an add-on; the rules it reads
 * (hazard tile types, cleanup cost 8 M€/step, +1 TR/step) are the real ones.
 */

import {ViewModel} from '@/common/models/PlayerModel';
import {SpaceModel} from '@/common/models/SpaceModel';
import {TileType, HAZARD_TILES} from '@/common/TileType';
import {hazardSeverity, HAZARD_STEPS} from '@/common/AresTileType';

/** The two hazard families (different cleanup visual language). */
export type HazardKind = 'dust-storm' | 'erosion';
export type HazardCleanupSeverity = 'mild' | 'severe';

/** One cell being cleared of a hazard by a tile placed on it. */
export type HazardCleanupEvent = {
  spaceId: string;
  hazardTileType: TileType;
  kind: HazardKind;
  severity: HazardCleanupSeverity;
  /** The tile that is placed on the now-cleared cell. */
  newTileType: TileType;
  /** Placer colour (the new tile's owner), '' if unknown. */
  color: string;
  /** Extra M€ paid to clear the hazard (mild 8 / severe 16). */
  cost: number;
  /** TR gained for the cleanup (mild +1 / severe +2). */
  trReward: number;
  /** Stable id for dedup across poll replays of the same board diff. */
  dedupeKey: string;
};

/** The cleanup animation's discrete phases (one-shot, deterministic). */
export type HazardCleanupPhase =
  | 'focus'
  | 'cleanup-start'
  | 'cleanup-resolve'
  | 'tile-materialize'
  | 'reward-feedback'
  | 'done';

/** Extra M€ charged per hazard step (mild = 1 step → 8, severe = 2 → 16). */
const COST_PER_STEP = 8;

function kindOf(t: TileType): HazardKind {
  return (t === TileType.DUST_STORM_MILD || t === TileType.DUST_STORM_SEVERE) ? 'dust-storm' : 'erosion';
}

/** A placeable, scoring tile that is NOT itself a hazard (the cleanup target). */
function isRealNonHazardTile(t: TileType | undefined): t is TileType {
  return t !== undefined && !HAZARD_TILES.has(t);
}

/**
 * Detect every cell that went from a HAZARD tile to a real non-hazard tile in
 * the prev→next board diff — i.e. a build that cleared a hazard. Ordinary
 * placements (empty → tile) and hazard intensifications (mild → severe) are NOT
 * cleanups and never match. 100% client-derived: the severity → cost (8/16) and
 * TR (+1/+2) are the deterministic real rules, so no server payload is needed.
 */
export function detectHazardCleanups(
  prev: ViewModel | undefined,
  next: ViewModel | undefined): ReadonlyArray<HazardCleanupEvent> {
  if (prev === undefined || next === undefined) {
    return [];
  }
  const prevById = new Map<string, SpaceModel>(prev.game.spaces.map((s) => [s.id, s]));
  const out: Array<HazardCleanupEvent> = [];
  for (const ns of next.game.spaces) {
    const ps = prevById.get(ns.id);
    if (ps === undefined) {
      continue;
    }
    const old = ps.tileType;
    if (old === undefined || !HAZARD_TILES.has(old)) {
      continue; // the cell must have held a hazard
    }
    if (!isRealNonHazardTile(ns.tileType)) {
      continue; // and now hold a real, non-hazard tile (not e.g. mild→severe)
    }
    const severity = hazardSeverity(old);
    if (severity === 'none') {
      continue;
    }
    const steps = HAZARD_STEPS[severity];
    out.push({
      spaceId: ns.id,
      hazardTileType: old,
      kind: kindOf(old),
      severity,
      newTileType: ns.tileType,
      color: ns.color ?? '',
      cost: steps * COST_PER_STEP,
      trReward: steps,
      dedupeKey: `${ns.id}:${old}->${ns.tileType}`,
    });
  }
  return out;
}

/**
 * Animation length. Premium but brisk (the brief: weak ~800–900 ms, strong
 * ~1000–1150 ms). Reduced motion collapses to a short readable beat.
 */
export function cleanupDurationMs(severity: HazardCleanupSeverity, reduced: boolean): number {
  if (reduced) {
    return 440;
  }
  return severity === 'severe' ? 1120 : 860;
}

// Phase boundaries as fractions of the duration. The hazard fully dissolves
// BEFORE the new tile materialises — the load-bearing ordering of the feature.
const FOCUS_END = 0.16;
const CLEANUP_START_END = 0.34;
const CLEANUP_RESOLVE_END = 0.58;
const MATERIALIZE_END = 0.80;
/** The new tile is swapped into the board at this progress (cleanup is done). */
export const TILE_SWAP_FRACTION = CLEANUP_RESOLVE_END;
/**
 * The cost / TR chips appear with the materialising tile and STAY through commit
 * — i.e. for the back ~42% of the sequence (~360 ms mild / ~470 ms severe), a
 * clear read window without lengthening the dissolve.
 */
const REWARD_VISIBLE_FROM = CLEANUP_RESOLVE_END;

/** The discrete phase at a 0..1 progress. */
export function phaseAt(progress: number): HazardCleanupPhase {
  if (progress >= 1) {
    return 'done';
  }
  if (progress < FOCUS_END) {
    return 'focus';
  }
  if (progress < CLEANUP_START_END) {
    return 'cleanup-start';
  }
  if (progress < CLEANUP_RESOLVE_END) {
    return 'cleanup-resolve';
  }
  if (progress < MATERIALIZE_END) {
    return 'tile-materialize';
  }
  return 'reward-feedback';
}

/** Per-element intensities for the overlay (frame-accurate, synced to progress). */
export type HazardCleanupFx = {
  /** Warning-ring intensity (rises through focus, fades as the dissolve takes over). */
  warning: number;
  /** Hazard dissolve progress (0 → 1 across the cleanup-resolve window). */
  dissolve: number;
  /** Remaining hazard-tile opacity (1 → 0 as it dissolves). */
  hazardOpacity: number;
  /** New-tile materialisation (0 → 1 across the materialize window). */
  materialize: number;
  /** The cost / TR delta cluster is shown. */
  rewardVisible: boolean;
};

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
/** Map [a,b] of `x` to 0..1 (0 below a, 1 above b). */
function ramp(x: number, a: number, b: number): number {
  return b <= a ? (x >= b ? 1 : 0) : clamp01((x - a) / (b - a));
}

export function hazardFxAt(progress: number): HazardCleanupFx {
  const dissolve = ramp(progress, CLEANUP_START_END, CLEANUP_RESOLVE_END);
  // Warning glow rises to its peak by the end of cleanup-start, then recedes as
  // the dissolve consumes the hazard.
  const warningRise = ramp(progress, 0, CLEANUP_START_END);
  const warning = clamp01(warningRise * (1 - dissolve));
  return {
    warning,
    dissolve,
    hazardOpacity: 1 - dissolve,
    materialize: ramp(progress, CLEANUP_RESOLVE_END, MATERIALIZE_END),
    // The chips land WITH the materialising tile and stay through commit.
    rewardVisible: progress >= REWARD_VISIBLE_FROM,
  };
}
