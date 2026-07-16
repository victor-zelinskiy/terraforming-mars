/*
 * tilePlacementModel — PURE, DOM-free vocabulary + math of the console TILE
 * PLACEMENT hero scene: the player's chosen tile physically travels to the
 * picked hex, touches down with mass, and the cell's PRINTED resource
 * bonuses are physically collected — the visible field icons materialize
 * into resource chips and ride the shared Resource Transfer Framework onto
 * the exact left-panel stock zones.
 *
 * Design contract (the premium direction, in one paragraph): after the
 * SERVER confirms the placement, the tile lifts off the table edge (the
 * neutral supply every placement source shares), crosses the board on one
 * confident low arc — big and close to the camera at departure, easing down
 * into the board's scale for the approach — unwinds square, and lands in
 * the exact live hex geometry with a shadow that tightens from hover to
 * contact. The REAL board tile paints silently under the landed proxy
 * (frame-perfect handoff, the project idiom), the commit lands under the
 * PANEL REWARD HOLD, and then the cell's printed icons rise through the
 * placed tile, become physical chips and pay out. A bonus-less cell gets
 * the same landing and NOT ONE extra millisecond.
 *
 * This module owns everything unit-testable: the phase vocabulary, the
 * flight geometry/scale/tilt/shadow profiles, the timing constants, the
 * printed-bonus → transfer extraction (stock resources ONLY — cards keep
 * their own cinematic, everything else rides the ordinary commit), and the
 * targeted silent-preview helper. GSAP lives in tilePlacementDirector; the
 * transaction lifecycle in consoleTilePlacement.
 */

import {Color} from '@/common/Color';
import {SpaceId} from '@/common/Types';
import {SpaceBonus} from '@/common/boards/SpaceBonus';
import {SpaceModel} from '@/common/models/SpaceModel';
import {TileType, HAZARD_TILES} from '@/common/TileType';
import {ResourceTransferSpec, TransferPoint} from '@/client/console/resourceTransfer/resourceTransferModel';

/**
 * The explicit, observable lifecycle of ONE placement transaction:
 *  - the flight NEVER starts before the server proved the tile landed on
 *    the armed space (`approaching` implies server success);
 *  - the real board tile paints (silently) only at `landed` — under the
 *    settled proxy, never beside it;
 *  - the playerView commit happens between `landed` and `rewarding`, under
 *    the panel reward hold, so the printed bonuses' delta chips fire only
 *    when their chips physically arrive;
 *  - a bonus-less placement goes `landed` → `done` with no reward beat.
 */
export type TilePlacementPhase =
  | 'idle'
  | 'armed' // space pick submitted — nothing visual yet
  | 'approaching' // server success proven; the tile flies to the hex
  | 'landed' // touchdown + settle done; real tile painted under the proxy
  | 'rewarding' // post-commit: printed bonuses materialize + pay out
  | 'done'
  | 'failed'; // refused placement / stall — transaction unwound, zero trace

/** Timings (ms @ motion scale 1). The landing reads in ≈0.75 s; a bonus
 *  cell adds a compact ≈0.8–1.0 s reward beat, a bare cell adds NOTHING. */
export const TILE_FLIGHT_MS = 520;
export const TILE_SETTLE_MS = 150;
/** The touch confirmation (surface brightness + shadow snap) overlaps the
 *  settle — a beat INSIDE the landing, never an extra pause. */
export const TILE_TOUCH_MS = 180;
/** Reduced motion: one short controlled transition (the console 160 ms cap
 *  convention), same commit semantics. Raw ms — never preset-scaled. */
export const TILE_REDUCED_MS = 160;
/** A submit the server never answers can't strand the scene (arm net). */
export const TILE_ARM_SAFETY_MS = 12000;

/**
 * The printed bonuses are DISPLACED UPWARD by the arriving tile — the
 * "card revealed from under the tile" beat: the icon proxies seamlessly
 * replace the printed icons (same rects, same sprites), rise off the
 * surface WHILE the tile descends into the hex (the tile slides UNDER
 * them — a bonus is never covered and never pops out from beneath), hover
 * over the seated tile through the commit, and hand off to their chips.
 */
/** When the rise starts, as a fraction of the flight (the tile is already
 *  descending into the hex — the displacement reads as caused by it). */
export const BONUS_PRELIFT_START_T = 0.52;
/** The rise duration (finishes ≈ at touchdown — guard-tested). */
export const BONUS_RISE_MS = 240;
/** The hover height over the seated tile (px @ uiScale 1). */
export const BONUS_HOVER_PX = 14;
/** The breath between the commit and the chip wave — the player reads the
 *  hovering bonuses over the placed tile for one calm beat. */
export const BONUS_HANDOFF_BREATH_MS = 90;

/** Departure pose: the tile is picked up CLOSE to the camera… */
export const TILE_START_SCALE = 1.32;
/** …with a slight carried tilt that fully unwinds before the approach. */
export const TILE_START_TILT_DEG = -3.5;
/** Landing settle amplitude (px @ uiScale 1) — microscopic, damped. */
export const TILE_SETTLE_PX = 2.5;

/**
 * PROVENANCE is carried by the flight POSE, not a color/glow: the viewer's
 * OWN tile is picked up from their hand — big, close to the camera; a
 * REMOTE tile (an opponent's build, a MarsBot turn) arrives from THEIR side
 * of the table — already near the board's scale, with the carried tilt
 * MIRRORED (the other hand). Same arc, same landing, same physics.
 */
export interface TileFlightProfile {
  startScale: number;
  cruiseScale: number;
  startTiltDeg: number;
}

export const OWN_FLIGHT_PROFILE: TileFlightProfile = {
  startScale: TILE_START_SCALE,
  cruiseScale: 1.22,
  startTiltDeg: TILE_START_TILT_DEG,
};

export const REMOTE_FLIGHT_PROFILE: TileFlightProfile = {
  startScale: 1.14,
  cruiseScale: 1.08,
  startTiltDeg: 3.2,
};

export type TileRect = {x: number, y: number, w: number, h: number};

export interface TileFlightPlan {
  /** Quadratic Bézier: P0 = supply point, C = control, P1 = hex centre. */
  p0: TransferPoint;
  c: TransferPoint;
  p1: TransferPoint;
}

function clamp(lo: number, hi: number, v: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Plan the tile's flight: ONE confident low arc — a carried component, not
 * a toss (the lift is markedly flatter than the resource chips'), so the
 * tile reads as guided by a steady hand and the landing approach comes in
 * shallow, never dive-bombed.
 */
export function tileFlightPlan(from: TransferPoint, to: TransferPoint): TileFlightPlan {
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const lift = clamp(36, 110, dist * 0.18);
  const apex = {
    x: (from.x + to.x) / 2,
    y: Math.min(from.y, to.y) - lift,
  };
  return {
    p0: from,
    c: {
      x: 2 * apex.x - (from.x + to.x) / 2,
      y: 2 * apex.y - (from.y + to.y) / 2,
    },
    p1: to,
  };
}

/** Point on the flight at t ∈ [0,1]. */
export function tileFlightPoint(plan: TileFlightPlan, t: number): TransferPoint {
  const u = 1 - t;
  return {
    x: u * u * plan.p0.x + 2 * u * t * plan.c.x + t * t * plan.p1.x,
    y: u * u * plan.p0.y + 2 * u * t * plan.c.y + t * t * plan.p1.y,
  };
}

/**
 * Scale along the flight, RELATIVE to the hex-fitted landing scale: the
 * tile departs large (picked up, close to the camera), CRUISES near that
 * size through the first half, then eases down into the board's own scale
 * for the whole approach — entering the field's perspective, not shrinking
 * at the last frame. Monotone non-increasing; exactly 1 at touchdown.
 * The profile carries the provenance pose (own = big pick-up, remote =
 * already near the board's scale).
 */
export function tileScaleAt(t: number, profile: TileFlightProfile = OWN_FLIGHT_PROFILE): number {
  const k = clamp(0, 1, t);
  if (k <= 0.45) {
    return profile.startScale - (profile.startScale - profile.cruiseScale) * easeInOut(k / 0.45);
  }
  return profile.cruiseScale - (profile.cruiseScale - 1) * easeInOut((k - 0.45) / 0.55);
}

/** Carried tilt: fully square by 75% of the path — the landing never rolls. */
export function tileTiltAt(t: number, profile: TileFlightProfile = OWN_FLIGHT_PROFILE): number {
  const k = clamp(0, 1, t);
  if (k >= 0.75) {
    return 0;
  }
  return profile.startTiltDeg * (1 - easeInOut(k / 0.75));
}

/**
 * The GROUND SHADOW under the target hex — the altitude cue: wide + faint
 * while the tile is high, tightening + darkening through the approach,
 * reaching contact (scale 1, full alpha) exactly at touchdown.
 */
export function tileShadowAt(t: number): {scale: number, alpha: number} {
  const k = clamp(0, 1, t);
  return {
    scale: 1.45 - 0.45 * easeInOut(k),
    alpha: 0.16 + 0.34 * easeInOut(k),
  };
}

function easeInOut(k: number): number {
  return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
}

// ── printed-bonus extraction (the reward beat's manifest) ───────────────────

/** SpaceBonus → the left panel's stock resource key. ONLY these are
 *  physically collected by the placement scene — a card bonus keeps its own
 *  cinematic (ConsoleBoardCardBonusLayer), production / oceans / temperature
 *  / card-resources / delegates ride the ordinary game flow untouched. */
const STOCK_BONUS: Partial<Record<SpaceBonus, string>> = {
  [SpaceBonus.STEEL]: 'steel',
  [SpaceBonus.TITANIUM]: 'titanium',
  [SpaceBonus.PLANT]: 'plants',
  [SpaceBonus.HEAT]: 'heat',
  [SpaceBonus.ENERGY]: 'energy',
  [SpaceBonus.MEGACREDITS]: 'megacredits',
};

/** The board's icon css suffix per bonus (Bonus.vue's map, stock subset).
 *  MEGACREDITS has NO printed sprite (the Ares board draws it differently)
 *  → its transfer flies from the hex itself, never from a missing icon. */
const STOCK_BONUS_ICON: Partial<Record<SpaceBonus, string>> = {
  [SpaceBonus.STEEL]: 'steel',
  [SpaceBonus.TITANIUM]: 'titanium',
  [SpaceBonus.PLANT]: 'plant',
  [SpaceBonus.HEAT]: 'heat',
  [SpaceBonus.ENERGY]: 'energy',
};

export type PlacementBonus = {
  /** Index into `space.bonus` — the printed icon's ordinal in the cell
   *  (the DOM renders one `.board-space-bonus` per entry, in order). */
  bonusIndex: number;
  /** The transfer this printed icon becomes: ONE unit per printed icon —
   *  the player collects exactly what is printed, icon by icon. */
  spec: ResourceTransferSpec;
  /** The board sprite suffix (`board-space-bonus--<icon>`); undefined →
   *  no printed sprite exists (Ares M€) → hex-center origin fallback. */
  icon: string | undefined;
};

/**
 * Which of the cell's PRINTED bonuses the placement scene physically
 * collects. One entry per printed stock icon (never merged here — each
 * printed symbol lifts off the field itself; the wave stagger + the panel's
 * merge window organize the arrival).
 */
export function placementBonuses(bonus: ReadonlyArray<SpaceBonus>): Array<PlacementBonus> {
  const out: Array<PlacementBonus> = [];
  bonus.forEach((b, i) => {
    const resource = STOCK_BONUS[b];
    if (resource === undefined) {
      return;
    }
    out.push({
      bonusIndex: i,
      spec: {channel: 'stock', resource, amount: 1},
      icon: STOCK_BONUS_ICON[b],
    });
  });
  return out;
}

// ── placement verification + the targeted silent preview ───────────────────

export function findSpace(spaces: ReadonlyArray<SpaceModel>, id: string): SpaceModel | undefined {
  return spaces.find((s) => s.id === id);
}

/**
 * The server-authoritative success proof: the armed space went EMPTY →
 * TILED in this response. A hazard materializing (erosion / dust storm) is
 * deliberately NOT ours — the hazard has its own ominous entrance — and a
 * covered/replaced tile (hazard cleanup, Ares upgrades) rides its own
 * premium sequence; both return undefined here and the scene unwinds.
 * `color` = the landed tile's owner (undefined for oceans / neutral tiles)
 * — it drives the premium cube drop after the touchdown.
 */
export function verifyPlacement(
  prevSpaces: ReadonlyArray<SpaceModel>,
  newSpaces: ReadonlyArray<SpaceModel>,
  spaceId: string,
): {tileType: TileType, color: Color | undefined} | undefined {
  const prev = findSpace(prevSpaces, spaceId);
  const next = findSpace(newSpaces, spaceId);
  if (prev === undefined || next === undefined) {
    return undefined;
  }
  if (prev.tileType !== undefined || next.tileType === undefined) {
    return undefined;
  }
  if (HAZARD_TILES.has(next.tileType)) {
    return undefined;
  }
  return {tileType: next.tileType, color: next.color};
}

/** One fresh tile the response introduced on a previously-empty cell —
 *  the remote-placement scene's unit of work. */
export type FreshPlacement = {
  spaceId: SpaceId;
  tileType: TileType;
  /** The owner (drives the flight origin — the acting player's chip in the
   *  status strip — and the cube drop). Undefined for oceans / neutral. */
  color: Color | undefined;
};

/**
 * Every fresh EMPTY → TILED placement in this response, in board order —
 * the diff the REMOTE placement scene presents (another player's build, a
 * MarsBot turn). Hazards are excluded (their ominous materialization is a
 * separate language), and so are covered/replaced tiles (hazard cleanup /
 * Ares upgrades ride their own premium sequences). Index-aligned like
 * `shouldHoldForTilePlacement`, defensively guarded against id mismatch.
 */
export function detectFreshPlacements(
  prevSpaces: ReadonlyArray<SpaceModel>,
  newSpaces: ReadonlyArray<SpaceModel>,
): Array<FreshPlacement> {
  const out: Array<FreshPlacement> = [];
  const len = Math.min(prevSpaces.length, newSpaces.length);
  for (let i = 0; i < len; i++) {
    const prev = prevSpaces[i];
    const next = newSpaces[i];
    if (prev.id !== next.id) {
      continue;
    }
    if (prev.tileType !== undefined || next.tileType === undefined) {
      continue;
    }
    if (HAZARD_TILES.has(next.tileType)) {
      continue;
    }
    out.push({spaceId: next.id, tileType: next.tileType, color: next.color});
  }
  return out;
}

/**
 * The targeted counterpart of `applyTilePlacementPreview` (the shared
 * board framework): copy JUST the armed space's fresh tile onto the
 * displayed view — with the placement-animation gate UNARMED, so the real
 * tile paints SILENTLY under the landed proxy (the frame-perfect handoff).
 * Other fresh tiles in the same response (a hazard spawning at a
 * temperature threshold) are left for the existing generic hold, which
 * runs after this and sees only the remaining diff.
 */
export function applySpacePreview(
  prevSpaces: ReadonlyArray<SpaceModel>,
  newSpaces: ReadonlyArray<SpaceModel>,
  spaceId: string,
): void {
  const prev = findSpace(prevSpaces, spaceId);
  const next = findSpace(newSpaces, spaceId);
  if (prev === undefined || next === undefined || next.tileType === undefined) {
    return;
  }
  prev.tileType = next.tileType;
  if (next.color !== undefined) {
    prev.color = next.color;
  }
  if (next.rotated !== undefined) {
    prev.rotated = next.rotated;
  }
}
