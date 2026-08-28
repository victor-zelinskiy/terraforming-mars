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
  | 'departing' // remove-and-replace: the doomed tile lifts off the cell
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

/**
 * OCEAN ADJACENCY — "I built next to water, so THAT water paid me".
 *
 * A second, self-contained reward beat that runs AFTER the printed-bonus one
 * (never on top of it): each ocean the server says paid (`lastOceanBonus`)
 * wakes locally at the shore it shares with the new tile, condenses ONE M€
 * coin out of that light, and hands it to the shared Resource Transfer
 * Framework — one ocean, one coin, always. The flight, the halo, the touchdown
 * and the delta chip are the framework's, unchanged; only this entrance is new.
 */
/** The water's response at the shared shore (glow + expanding ring). */
export const OCEAN_PULSE_MS = 300;
/** How far into the pulse the coin starts condensing out of the lit water. */
export const OCEAN_COIN_LEAD_MS = 120;
/** Condensation → contour → gold mass → numeral + sheen (the whole birth). */
export const OCEAN_COIN_FORM_MS = 420;
/** The calm breath before the water wakes (after the tile — or the printed
 *  bonuses — has settled). The cause is read before the consequence starts. */
export const OCEAN_BEAT_BREATH_MS = 140;
/** Coin float above the water surface at birth (px @ uiScale 1). */
export const OCEAN_COIN_LIFT_PX = 12;
/** Number of condensation particles per coin — a hint of matter, not confetti. */
export const OCEAN_COIN_SPARKS = 6;

/**
 * Where along the ocean→tile axis a coin is BORN: 0 = the ocean's centre,
 * 0.5 = the shared border (the midpoint between two adjacent hex centres).
 * Kept inside the water so the coin visually BELONGS to the ocean and never
 * overlaps the tile that was just placed.
 */
export const OCEAN_COIN_T = 0.30;
/** Where the water's own response is centred — nearer the shared shore. */
export const OCEAN_PULSE_T = 0.40;
/** How far back INTO the ocean the pulse's light starts before sliding to the
 *  shore (as a fraction of the ocean hex width) — the directional sheen. */
export const OCEAN_PULSE_DRIFT = 0.22;

/** When the ocean beat's transfer wave launches, relative to the beat's start:
 *  the first coin has just finished forming. Later coins ride the SAME per-index
 *  stagger as the wave itself, so every chip is born on its own finished coin. */
export function oceanWaveLeadMs(): number {
  return OCEAN_COIN_LEAD_MS + OCEAN_COIN_FORM_MS;
}

/**
 * OCEAN COVER SPLASH — a tile landing ON the water (Ocean City and family).
 * The sea acknowledges the mass: one ring opens from under the seated tile
 * and a soft wash brightens the shoreline, then everything settles. Calm,
 * transform/opacity only, and strictly one-shot.
 */
export const OCEAN_SPLASH_MS = 460;

/**
 * A point on the segment from the OCEAN's centre toward the placed tile's
 * centre, at fraction `t`, lifted `liftPx` off the surface.
 *
 * Everything is viewport space (both rects come from `getBoundingClientRect`),
 * so board pan/zoom, the `--board-scale` transform and the TV `--con-ui-scale`
 * are already baked in — there is no second coordinate system to keep in sync.
 * Degenerate input (coincident centres) degrades to the ocean's own centre.
 */
export function oceanEdgePoint(ocean: TileRect, tile: TileRect, t: number, liftPx = 0): TransferPoint {
  const ox = ocean.x + ocean.w / 2;
  const oy = ocean.y + ocean.h / 2;
  const dx = (tile.x + tile.w / 2) - ox;
  const dy = (tile.y + tile.h / 2) - oy;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) {
    return {x: ox, y: oy - liftPx};
  }
  return {x: ox + dx * t, y: oy + dy * t - liftPx};
}

/** The unit vector ocean → tile (the shore direction), for the pulse's drift. */
export function oceanShoreDirection(ocean: TileRect, tile: TileRect): TransferPoint {
  const dx = (tile.x + tile.w / 2) - (ocean.x + ocean.w / 2);
  const dy = (tile.y + tile.h / 2) - (ocean.y + ocean.h / 2);
  const dist = Math.hypot(dx, dy);
  return dist < 1 ? {x: 0, y: -1} : {x: dx / dist, y: dy / dist};
}

/**
 * The transfer manifest of an ocean payout: ONE `perOcean` M€ spec per paying
 * ocean — never merged into a single fat chip, because the whole point is that
 * the player sees each ocean contribute its own share. (The DELTA CHIP is
 * aggregated separately, by releasing the panel hold once at the last
 * touchdown — see `consoleTilePlacement.runOceanBonusBeat`.)
 */
export function oceanTransferSpecs(count: number, perOcean: number): Array<ResourceTransferSpec> {
  const out: Array<ResourceTransferSpec> = [];
  for (let i = 0; i < count; i++) {
    out.push({channel: 'stock', resource: 'megacredits', amount: perOcean});
  }
  return out;
}

/**
 * TILE DEPARTURE — the opening beat of a REMOVE-AND-REPLACE placement
 * ("remove 1 of your greenery tiles and place a city there": Kaguya Tech on
 * Mars, Lunar Mine Urbanization on the Moon).
 *
 * The card does two physical things to ONE cell, so the scene shows two: the
 * standing tile is UNSEATED — it releases from the surface, rises off the
 * plane toward the camera with its thickness edge decompressing (the exact
 * inverse of the landing's contact squash), tips a little as it clears, and
 * fades out on its way — and the cell it leaves behind is a bare hex with its
 * PRINTED BONUS surfacing, which is precisely what the player is about to be
 * paid ("gain placement bonuses as usual"). Only then does the ordinary
 * flight bring the new tile in, and the ordinary reward beat pays those very
 * icons. Nothing about the arrival is special-cased: the removal is a
 * PREFIX, not a second dialect of landing.
 */
/** The lift-off (the whole unseating reads inside it). */
export const TILE_DEPART_MS = 380;
/** How far the tile rises, as a fraction of the hex height — proportional,
 *  so it survives board zoom and every display profile (never fixed px). */
export const TILE_DEPART_LIFT = 0.62;
/** …growing as it comes toward the camera (mirrors the arrival's cruise). */
export const TILE_DEPART_SCALE = 1.16;
/** …with a small carried tip, the mirror of the landing's unwinding tilt. */
export const TILE_DEPART_TILT_DEG = -4.5;
/** Where in the lift the tile starts to fade (it clears the cell first). */
export const TILE_DEPART_FADE_T = 0.42;
/** When the emptied cell's printed bonus starts surfacing, as a fraction of
 *  the lift — early enough to read as UNCOVERED BY the departure, late
 *  enough that the tile is no longer sitting on top of it. */
export const TILE_DEPART_REVEAL_T = 0.34;
/** The bonus reveal's own duration (the CSS one-shot mirrors this). */
export const TILE_DEPART_REVEAL_MS = 280;
/** One calm breath on the cleared cell — the player reads WHAT the removal
 *  uncovered before the replacement tile starts its approach. */
export const TILE_DEPART_BREATH_MS = 130;

/** The departing tile's lift in px for a live hex — proportional to the hex
 *  itself (post pan/zoom truth), with a floor so a tiny board still reads. */
export function departureLiftPx(hex: TileRect): number {
  return Math.max(16, Math.round(hex.h * TILE_DEPART_LIFT));
}

/**
 * The OWNER MARKER travels with the tile it was marking, so the departing
 * proxy carries a twin of the cell's cube. The board's own placement is
 * authored in px against the UNSCALED hex (`.board-space` 46×51,
 * `.player-cube.board-owner-cube { right: 7px; bottom: 14px }`, `:size="12"`)
 * and then rides the board's zoom transform; the proxy is a FIXED element
 * posed at the MEASURED (already-scaled) rect, so the same numbers have to be
 * re-derived as a fraction of that live box — otherwise the twin drifts off
 * its socket the moment the board is zoomed.
 */
const BOARD_HEX_W = 46;
const BOARD_HEX_H = 51;
const OWNER_CUBE_RIGHT = 7;
const OWNER_CUBE_BOTTOM = 14;
const OWNER_CUBE_SIZE = 12;

export type DepartingCubePose = {
  color: Color,
  /** `--pc-size` in px for this hex (PlayerCube's footprint prop). */
  size: number,
  right: number,
  bottom: number,
};

export function departingCubePose(color: Color | undefined, hex: TileRect | undefined): DepartingCubePose | undefined {
  if (color === undefined || hex === undefined || hex.w < 8 || hex.h < 8) {
    return undefined;
  }
  return {
    color,
    size: (hex.w / BOARD_HEX_W) * OWNER_CUBE_SIZE,
    right: (hex.w / BOARD_HEX_W) * OWNER_CUBE_RIGHT,
    bottom: (hex.h / BOARD_HEX_H) * OWNER_CUBE_BOTTOM,
  };
}

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
 * TILED in this response — or OCEAN → an Ares ocean cover (Ocean City /
 * Farm / Sanctuary / New Holland land ON the water; `covers` carries the
 * ocean so the scene can keep the water visible under the flight and play
 * the landing splash). A hazard materializing (erosion / dust storm) is
 * deliberately NOT ours — the hazard has its own ominous entrance — and a
 * hazard being BUILT OVER rides the hazard-cleanup sequence; those return
 * undefined here and the scene unwinds.
 * `color` = the landed tile's owner (undefined for oceans / neutral tiles)
 * — it drives the premium cube drop after the touchdown.
 */
export function verifyPlacement(
  prevSpaces: ReadonlyArray<SpaceModel>,
  newSpaces: ReadonlyArray<SpaceModel>,
  spaceId: string,
  opts?: {
    /**
     * The prompt DECLARED this cell a remove-and-replace target (its
     * `hiddenTiles` names it — the server marker Kaguya Tech / Lunar Mine
     * Urbanization set). Only then may a tile→tile diff be read as "the old
     * tile was removed and the new one placed on the emptied cell"; without
     * the declaration an unexplained type change is still refused, exactly
     * as before, so a hazard cleanup or a server correction can never be
     * mistaken for a placement.
     */
    replacing?: boolean,
  },
): {
  tileType: TileType,
  color: Color | undefined,
  covers?: TileType,
  replaces?: {tileType: TileType, color: Color | undefined},
} | undefined {
  const prev = findSpace(prevSpaces, spaceId);
  const next = findSpace(newSpaces, spaceId);
  if (prev === undefined || next === undefined) {
    return undefined;
  }
  if (next.tileType === undefined || HAZARD_TILES.has(next.tileType)) {
    return undefined;
  }
  if (prev.tileType !== undefined) {
    if (prev.tileType === next.tileType) {
      return undefined; // nothing changed on the cell — no placement to show
    }
    // A DECLARED removal: the server emptied the cell and placed on it, so
    // the printed bonuses are granted "as usual" — the scene opens with the
    // doomed tile lifting away and pays those icons at the end. A hazard on
    // either side keeps its own ominous language.
    if (opts?.replacing === true && !HAZARD_TILES.has(prev.tileType)) {
      return {
        tileType: next.tileType,
        color: next.color,
        replaces: {tileType: prev.tileType, color: prev.color},
      };
    }
    // The ONE legal UNdeclared non-hazard replacement (`MarsBoard.canCover`):
    // a tile landing on a plain ocean. Everything else keeps its own sequence.
    if (prev.tileType !== TileType.OCEAN || next.tileType === TileType.OCEAN) {
      return undefined;
    }
    return {tileType: next.tileType, color: next.color, covers: prev.tileType};
  }
  return {tileType: next.tileType, color: next.color};
}

/** One fresh tile the response introduced on a previously-empty cell (or on
 *  a plain ocean it covers) — the remote-placement scene's unit of work. */
export type FreshPlacement = {
  spaceId: SpaceId;
  tileType: TileType;
  /** The owner (drives the flight origin — the acting player's chip in the
   *  status strip — and the cube drop). Undefined for oceans / neutral. */
  color: Color | undefined;
  /** The plain ocean this tile landed ON (Ares ocean covers): the held cell
   *  keeps painting the water, and the touchdown plays the splash. */
  covers?: TileType;
};

/**
 * Every fresh EMPTY → TILED placement in this response, in board order —
 * plus every OCEAN → cover replacement (Ocean City and family land on the
 * water with the same physical language) — the diff the REMOTE placement
 * scene presents (another player's build, a MarsBot turn). Hazards are
 * excluded (their ominous materialization is a separate language), and so
 * is a hazard being built over (the hazard-cleanup sequence). Index-aligned
 * like `shouldHoldForTilePlacement`, defensively guarded against id mismatch.
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
    if (next.tileType === undefined || HAZARD_TILES.has(next.tileType)) {
      continue;
    }
    if (prev.tileType !== undefined) {
      if (prev.tileType !== TileType.OCEAN || next.tileType === TileType.OCEAN) {
        continue;
      }
      out.push({spaceId: next.id, tileType: next.tileType, color: next.color, covers: prev.tileType});
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
