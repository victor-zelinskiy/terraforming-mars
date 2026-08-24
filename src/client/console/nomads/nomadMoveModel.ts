/*
 * nomadMoveModel — PURE, DOM-free vocabulary + math of the console MARS
 * NOMADS MOVE scene (Flow B of the nomad choreography): the camp module
 * physically lifts off its cell, crosses to the adjacent hex on one carried
 * arc, DISPLACES the destination's printed bonuses on its approach, seats,
 * the bonuses become physical chips and pay out through the shared Resource
 * Transfer Framework — and then, because the rules never exhaust the cell,
 * the printed bonuses MATERIALIZE BACK onto the field.
 *
 * The FIRST placement (Flow A) deliberately lives elsewhere — it is a plain
 * marker LANDING with no reward of any kind, served by the shared
 * markerPlacementAnimation framework + the NomadToken landing keyframes.
 * The two flows are told apart by the SERVER's own declaration
 * (`SelectSpaceModel.placementEffect`: 'marker' = seat the camp, grant
 * nothing; 'bonus-only' = move the camp, grant the destination's printed
 * bonuses) — never by DOM state, never by resource deltas.
 *
 * This module owns everything unit-testable: the phase vocabulary, the
 * timings, the hop-arc geometry / scale / tilt / shadow profiles, the
 * from→to diff detection (own verify + the remote/undo diff), the token
 * anchor math and the targeted silent preview. GSAP lives in
 * nomadMoveDirector; the transaction lifecycle in consoleNomadMove.
 */

import {SpaceId} from '@/common/Types';
import {SpaceModel} from '@/common/models/SpaceModel';
import {TransferPoint} from '@/client/console/resourceTransfer/resourceTransferModel';
import {TileRect, findSpace, placementBonuses, PlacementBonus} from '@/client/console/tilePlacement/tilePlacementModel';

/**
 * The observable lifecycle of ONE move transaction:
 *  - nothing visual before the server PROVED the camp moved (`approaching`
 *    implies from→to verified on the response);
 *  - the real destination token paints (silently) only at `landed` — under
 *    the settled proxy, never beside it;
 *  - the commit lands between `landed` and `rewarding` under the panel
 *    reward hold, so the bonus delta chips fire at their chips' touchdowns;
 *  - `restoring` is the mandatory epilogue of a bonus cell: the printed
 *    icons materialize back (the source is not exhausted);
 *  - a bonus-less destination goes `landed` → `done` with no extra beat.
 */
export type NomadMovePhase =
  | 'idle'
  | 'armed'
  | 'approaching'
  | 'landed'
  | 'rewarding'
  | 'restoring'
  | 'done'
  | 'failed';

/** Timings (ms @ motion scale 1). The hop reads in ≈1 s; a bonus cell adds
 *  the collect wave + a compact ≈0.5 s restore; a bare cell adds NOTHING. */
export const NOMAD_LIFT_MS = 230;
export const NOMAD_FLIGHT_MS = 560;
export const NOMAD_SETTLE_MS = 170;
/** Reduced motion: one short controlled beat, same commit semantics. */
export const NOMAD_REDUCED_MS = 160;
/** A submit the server never answers can't strand the scene (arm net). */
export const NOMAD_ARM_SAFETY_MS = 12000;

/** When the destination's printed bonuses start their displacement rise,
 *  as a fraction of the FLIGHT leg (the camp is already bearing down). */
export const NOMAD_PRELIFT_START_T = 0.5;
/** The displaced icons' rise duration / hover height (the tile hero's
 *  displacement language — one physical rule for "something arrives"). */
export const NOMAD_BONUS_RISE_MS = 240;
export const NOMAD_BONUS_HOVER_PX = 14;
/** The breath between the commit and the chip wave. */
export const NOMAD_HANDOFF_BREATH_MS = 90;

/** The RESTORE beat: after the last chip's touchdown the cell's printed
 *  icons re-form in place — scale-up materialization + one warm glint per
 *  icon, staggered (see `board-space-bonuses--nomad-restore`). */
export const NOMAD_RESTORE_MS = 430;
export const NOMAD_RESTORE_STAGGER_MS = 80;
/** The quiet beat between the last chip's departure and the re-formation —
 *  the emptiness is READ before the field answers it. */
export const NOMAD_RESTORE_BREATH_MS = 160;

/** Departure/arrival pose of the flying module, relative to its board size. */
export const NOMAD_CRUISE_SCALE = 1.32;
export const NOMAD_LIFT_SCALE = 1.14;
/** Carried tilt INTO the travel direction at cruise (deg, sign = direction). */
export const NOMAD_TILT_DEG = 9;
/** Lift-off rise before the arc starts (px @ uiScale 1). */
export const NOMAD_LIFT_RISE_PX = 11;
/** Landing settle amplitude (px @ uiScale 1) — microscopic, damped. */
export const NOMAD_SETTLE_PX = 2;

/**
 * Where the resting token sits INSIDE a hex, as fractions of the hex box.
 * Derived from the board geometry: the token is anchored in the freed top
 * area of the 46×51 hex (`.board-nomad` in board.less — change one, change
 * both). Measuring from fractions (not a captured element rect) keeps every
 * leg of the scene correct across board zoom / planet focus / TV scale.
 */
export const NOMAD_ANCHOR_FX = 0.5;
export const NOMAD_ANCHOR_FY = 0.245;

/** The resting token's footprint as a fraction of the hex WIDTH (16px in
 *  the 46px hex space — one authority for проxy sizing at any zoom). */
export const NOMAD_SIZE_F = 16 / 46;

export function nomadAnchorOf(hex: TileRect): TransferPoint {
  return {x: hex.x + hex.w * NOMAD_ANCHOR_FX, y: hex.y + hex.h * NOMAD_ANCHOR_FY};
}

export function nomadSizeOf(hex: TileRect): number {
  return Math.max(8, Math.round(hex.w * NOMAD_SIZE_F));
}

export interface NomadFlightPlan {
  /** Quadratic Bézier: P0 = lifted departure, C = control, P1 = arrival. */
  p0: TransferPoint;
  c: TransferPoint;
  p1: TransferPoint;
  /** Horizontal travel sign (the carried tilt leans INTO it). */
  dir: number;
}

function clamp(lo: number, hi: number, v: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Plan the hop: adjacent hexes are CLOSE, so the arc must earn its read from
 * HEIGHT, not distance — the lift is proportionally much taller than the
 * tile hero's carried arc (a hop over the terrain, not a delivery glide).
 */
export function nomadFlightPlan(from: TransferPoint, to: TransferPoint): NomadFlightPlan {
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const lift = clamp(26, 130, dist * 0.72);
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
    dir: to.x === from.x ? 0 : Math.sign(to.x - from.x),
  };
}

/** Point on the hop at t ∈ [0,1]. */
export function nomadFlightPoint(plan: NomadFlightPlan, t: number): TransferPoint {
  const u = 1 - t;
  return {
    x: u * u * plan.p0.x + 2 * u * t * plan.c.x + t * t * plan.p1.x,
    y: u * u * plan.p0.y + 2 * u * t * plan.c.y + t * t * plan.p1.y,
  };
}

function easeInOut(k: number): number {
  return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
}

/**
 * Scale along the hop, relative to the resting board size: rises out of the
 * lift pose to the cruise crest at the apex, then eases back into the
 * board's own scale for the whole approach — exactly 1 at touchdown.
 */
export function nomadScaleAt(t: number): number {
  const k = clamp(0, 1, t);
  if (k <= 0.42) {
    return NOMAD_LIFT_SCALE + (NOMAD_CRUISE_SCALE - NOMAD_LIFT_SCALE) * easeInOut(k / 0.42);
  }
  return NOMAD_CRUISE_SCALE - (NOMAD_CRUISE_SCALE - 1) * easeInOut((k - 0.42) / 0.58);
}

/** Carried tilt into the travel direction: leans through the cruise, fully
 *  upright by 78% of the path — the landing never rolls. */
export function nomadTiltAt(t: number, dir: number): number {
  const k = clamp(0, 1, t);
  if (dir === 0 || k >= 0.78) {
    return 0;
  }
  const rise = k < 0.3 ? easeInOut(k / 0.3) : 1 - easeInOut((k - 0.3) / 0.48);
  return NOMAD_TILT_DEG * dir * rise;
}

/** The DESTINATION ground shadow through the approach (parked at the target
 *  anchor): absent through the first half, then converging wide→contact. */
export function nomadDstShadowAt(t: number): {scale: number, alpha: number} {
  const k = clamp(0, 1, t);
  if (k < 0.34) {
    return {scale: 1.5, alpha: 0};
  }
  const p = easeInOut((k - 0.34) / 0.66);
  return {scale: 1.5 - 0.5 * p, alpha: 0.62 * p};
}

/** The SOURCE contact shadow through the LIFT: stays on the surface and
 *  weakens/widens as the module rises off it. */
export function nomadSrcShadowAt(t: number): {scale: number, alpha: number} {
  const k = clamp(0, 1, t);
  return {scale: 1 + 0.34 * k, alpha: 0.9 * (1 - easeInOut(k))};
}

// ── the from→to diff (server truth) ─────────────────────────────────────────

export type NomadMoveDiff = {
  fromId: SpaceId;
  toId: SpaceId;
};

/**
 * The camp's from→to pair in this response: exactly one cell LOST the flag
 * and exactly one GAINED it. This is what a MOVE looks like from any seat —
 * the mover's own submit, another player's move arriving on a poll, and an
 * UNDO of a move (the camp honestly walks back). A bare appearance (first
 * placement) or a bare disappearance returns undefined.
 */
export function detectNomadMoveDiff(
  prevSpaces: ReadonlyArray<SpaceModel>,
  newSpaces: ReadonlyArray<SpaceModel>,
): NomadMoveDiff | undefined {
  let fromId: SpaceId | undefined;
  let toId: SpaceId | undefined;
  const len = Math.min(prevSpaces.length, newSpaces.length);
  for (let i = 0; i < len; i++) {
    const prev = prevSpaces[i];
    const next = newSpaces[i];
    if (prev.id !== next.id) {
      continue;
    }
    if (prev.nomads === true && next.nomads !== true) {
      if (fromId !== undefined) {
        return undefined; // two departures — not a shape we can present
      }
      fromId = prev.id;
    } else if (prev.nomads !== true && next.nomads === true) {
      if (toId !== undefined) {
        return undefined;
      }
      toId = next.id;
    }
  }
  if (fromId === undefined || toId === undefined) {
    return undefined;
  }
  return {fromId, toId};
}

/**
 * The server-authoritative success proof for the ARMED move: the response
 * moved the camp exactly onto the space the player picked.
 */
export function verifyNomadMove(
  prevSpaces: ReadonlyArray<SpaceModel>,
  newSpaces: ReadonlyArray<SpaceModel>,
  toSpaceId: string,
): NomadMoveDiff | undefined {
  const diff = detectNomadMoveDiff(prevSpaces, newSpaces);
  if (diff === undefined || diff.toId !== toSpaceId) {
    return undefined;
  }
  return diff;
}

/**
 * The printed bonuses this MOVE physically collects: the destination's stock
 * icons — exactly the tile hero's extraction, and exactly what the server's
 * `grantPlacementBonuses` pays. A destination carrying a HAZARD TILE grants
 * NOTHING (the published ruling; the server passes `coveringExistingSpace`),
 * and its printed icons are not even rendered — the scene flies the module
 * and stays honest about the empty hand.
 */
export function nomadMoveBonuses(destination: SpaceModel | undefined): Array<PlacementBonus> {
  if (destination === undefined || destination.tileType !== undefined) {
    return [];
  }
  return placementBonuses(destination.bonus);
}

/**
 * The targeted counterpart of `applyMarkerPlacementPreview` for the move:
 * flip BOTH flags on the displayed view in one synchronous turn — the real
 * destination token paints silently under the settled proxy (the caller has
 * already pre-adopted both cells in the marker baseline), and the marker
 * framework's own diff walk then sees nothing left to hold for.
 */
export function applyNomadMovePreview(
  prevSpaces: ReadonlyArray<SpaceModel>,
  newSpaces: ReadonlyArray<SpaceModel>,
  diff: NomadMoveDiff,
): void {
  const from = findSpace(prevSpaces, diff.fromId);
  const to = findSpace(prevSpaces, diff.toId);
  const fromNext = findSpace(newSpaces, diff.fromId);
  const toNext = findSpace(newSpaces, diff.toId);
  if (from === undefined || to === undefined || fromNext === undefined || toNext === undefined) {
    return;
  }
  from.nomads = fromNext.nomads;
  to.nomads = toNext.nomads;
}
