/*
 * @console-shared LIVE — console native stands on this file.
 *
 * A CITY LANDS ON A COLONY TILE — the PURE half (Turmoil Redux TR22 Nova City;
 * docs/TURMOIL_REDUX_NOVA_CITY.md). No Vue, no DOM, no i18n: the pair-of-views
 * check, the beats and their timings, the descent's plan, and the stage's
 * reading of the server's `tileSite` marker.
 *
 * THE GRAMMAR this scene adds to the colonies:
 *  · the colony tile is a PLACE, the planet an OBJECT, the city a SECOND
 *    OBJECT of the tile — with a seat of its own that exists before the object;
 *  · a piece does not change its look by where it is put: the board's own city
 *    art, the board's own owner cube, the landing hero's own proxy anatomy and
 *    its own CONTACT (`tilePlacementDirector.addTileTouch`);
 *  · WEIGHT, not effect: the height is carried by the SHADOW (it lies on the
 *    seat — wide and faint under a hanging piece, tight and dark at contact),
 *    the descent ACCELERATES (the piece is laid down, it does not float in),
 *    the contact is short and dry — no bounce, no ripple, no glow;
 *  · only what was touched answers, once: the seat. The planet, the neighbour
 *    tiles, the track and the berths do not react.
 *
 * Every duration is a BASE in ms (the director passes it through `motionMs()`);
 * the numbers are pinned by tests/console/colonyCityModel.spec.ts — change them
 * by the storyboard, never silently.
 */
import {ColonyName} from '@/common/colonies/ColonyName';
import {ColonyModel, ColonyTileOnTileModel} from '@/common/models/ColonyModel';
import {ColonyTileSite} from '@/common/colonies/ColonyTileSite';
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {SpaceId} from '@/common/Types';
import {TILE_START_TILT_DEG} from '@/client/console/tilePlacement/tilePlacementModel';

// ── WHAT LANDED — the pair of views ─────────────────────────────────────────

/** A tile that came to lie on a colony tile between two views. */
export type ColonyCityLanding = {
  colony: ColonyName;
  tile: ColonyTileOnTileModel;
};

/** What the player confirmed at A — the landing the answer must carry. */
/** The seat's size token per host — the hex's height is the stylesheet's, the cube's logical px is the table's below. */
export type ColonyCitySeatSize = 'tile' | 'stage' | 'dossier';

/**
 * The owner cube's logical size per host of the seat — the board's own
 * proportion (a 21px cube on a 51px hex), so the piece reads as the same piece
 * everywhere. The box around it (`.con-colcity__cube`) carries the
 * `--con-ui-scale` zoom, as every px token in the console does.
 */
export const COLONY_CITY_CUBE_PX: Readonly<Record<ColonyCitySeatSize, number>> = {
  tile: 20,
  stage: 36,
  dossier: 40,
};

export type ColonyCityArm = {
  colony: ColonyName;
  space: SpaceId;
  color: Color;
  card?: CardName;
};

type Colonies = ReadonlyArray<Pick<ColonyModel, 'name' | 'tiles'>>;

/**
 * THE DIFF of two tables: every tile that lies on a colony tile NOW and did
 * not before (by its cell — a cell carries one tile). A tile that merely
 * stayed is not a landing; a colony tile that left the table carries none.
 */
export function colonyCityLandings(before: Colonies | undefined, after: Colonies | undefined): Array<ColonyCityLanding> {
  const stood = new Set<SpaceId>();
  for (const colony of before ?? []) {
    for (const tile of colony.tiles ?? []) {
      stood.add(tile.spaceId);
    }
  }
  const out: Array<ColonyCityLanding> = [];
  for (const colony of after ?? []) {
    for (const tile of colony.tiles ?? []) {
      if (!stood.has(tile.spaceId)) {
        out.push({colony: colony.name, tile});
      }
    }
  }
  return out;
}

/** Is this landing EXACTLY what was armed — the declared tile of the viewer's colour on the declared colony tile? */
export function landingMatchesArm(landing: ColonyCityLanding, arm: ColonyCityArm): boolean {
  return landing.colony === arm.colony &&
    landing.tile.spaceId === arm.space &&
    landing.tile.color === arm.color &&
    (arm.card === undefined || landing.tile.card === arm.card);
}

/** The armed landing among the views' diff — or `undefined` (a parked tail, a re-ask, a refusal: the arm is dropped). */
export function armedLandingOf(before: Colonies | undefined, after: Colonies | undefined, arm: ColonyCityArm): ColonyCityLanding | undefined {
  return colonyCityLandings(before, after).find((landing) => landingMatchesArm(landing, arm));
}

/** A landing's identity — «the player's own gate already played this one» (the watcher's seed must not play it twice). */
export function landingSignature(landing: ColonyCityLanding): string {
  return `${landing.colony}|${landing.tile.spaceId}|${landing.tile.color}`;
}

// ── THE BEATS ───────────────────────────────────────────────────────────────

export type ColonyCityBeat = 'handover' | 'materialize' | 'weight' | 'land' | 'cube' | 'read';

/**
 * ONE scene, two profiles. The player's OWN landing plays on the tile's STAGE
 * with the whole phrase; a WATCHER's (another player's city, or one's own
 * parked tail landing later) plays at the TILE's scale — the same phrase,
 * smaller and shorter, with no «weight» pause.
 */
export type ColonyCityProfile = {
  /** How far above its seat the piece appears, in hex HEIGHTS. */
  liftHexes: number;
  /** The scale it appears at (it lands at 1). */
  startScale: number;
  /** MATERIALIZE: the edge first, then the art. */
  materializeMs: number;
  edgeMs: number;
  artFromMs: number;
  /** WEIGHT: full stillness — the piece «in the hand over the table». */
  weightMs: number;
  /** LANDING: one progress tween; contact at `contactAt` of it. */
  landMs: number;
  /** CUBE: the owner's cube — approach, then drop. */
  cubeApproachMs: number;
  cubeDropMs: number;
  /** READ: the seated city is read before the stage folds home. */
  readMs: number;
};

/** Where in the landing tween the piece TOUCHES (the rest is the contact's own settle). */
export const CITY_CONTACT_AT = 0.8;
/** The tilt unwinds by this part of the landing. */
export const CITY_TILT_OUT_AT = 0.6;
/** The tile's «press» answer under the cube (scale .985 → 1). */
export const CITY_PRESS_MS = 120;
export const CITY_PRESS_SCALE = 0.985;
/** Reduced motion / fx-lite: final poses and ONE answer of the seat. */
export const CITY_REDUCED_MS = 120;
/** The projection's art opacity (the ghost on every candidate). */
export const CITY_GHOST_ALPHA = 0.35;

export const OWN_CITY_PROFILE: ColonyCityProfile = {
  liftHexes: 0.9,
  startScale: 1.22,
  materializeMs: 340,
  edgeMs: 140,
  artFromMs: 100,
  weightMs: 120,
  landMs: 380,
  cubeApproachMs: 140,
  cubeDropMs: 200,
  readMs: 680,
};

export const WATCHER_CITY_PROFILE: ColonyCityProfile = {
  liftHexes: 0.9,
  startScale: 1.12,
  materializeMs: 260,
  edgeMs: 110,
  artFromMs: 80,
  weightMs: 0,
  landMs: 320,
  cubeApproachMs: 100,
  cubeDropMs: 140,
  readMs: 0,
};

/** When each beat STARTS, in base ms from the handover — the storyboard's table. */
export type ColonyCityTimeline = {
  materializeAt: number;
  weightAt: number;
  landAt: number;
  /** The frame of CONTACT — the commit applies here, the real tile paints under the proxy. */
  contactAt: number;
  cubeAt: number;
  /** The cube's touchdown — the count flips, the VP line lights. */
  cubeLandAt: number;
  readAt: number;
  /** The whole scene (through the read). */
  totalMs: number;
};

export function colonyCityTimeline(profile: ColonyCityProfile): ColonyCityTimeline {
  const materializeAt = 0;
  const weightAt = materializeAt + profile.materializeMs;
  const landAt = weightAt + profile.weightMs;
  const contactAt = landAt + Math.round(profile.landMs * CITY_CONTACT_AT);
  const cubeAt = landAt + profile.landMs;
  const cubeLandAt = cubeAt + profile.cubeApproachMs + profile.cubeDropMs;
  const readAt = cubeLandAt;
  return {materializeAt, weightAt, landAt, contactAt, cubeAt, cubeLandAt, readAt, totalMs: readAt + profile.readMs};
}

/** The beats of ONE landing, in order. Reduced motion plays none — final poses and the seat's one answer. */
export function colonyCityBeats(profile: ColonyCityProfile, opts: {reduced?: boolean} = {}): ReadonlyArray<ColonyCityBeat> {
  if (opts.reduced === true) {
    return [];
  }
  const beats: Array<ColonyCityBeat> = ['handover', 'materialize'];
  if (profile.weightMs > 0) {
    beats.push('weight');
  }
  beats.push('land', 'cube');
  if (profile.readMs > 0) {
    beats.push('read');
  }
  return beats;
}

// ── THE DESCENT — one progress, the resting pose WRITTEN at the end ─────────

export type CityDescentPose = {
  /** The piece's lift above its seat, in hex heights (0 = seated). */
  lift: number;
  scale: number;
  /** Degrees. */
  tilt: number;
  /** The shadow LIES ON THE SEAT: its spread (1 = the contact shadow) and its darkness (0…1). */
  shadowScale: number;
  shadowAlpha: number;
  /** The piece has touched (q ≥ the contact point). */
  touched: boolean;
};

/** `power2.in` — the piece is laid down with acceleration, it never floats in. */
function easeIn(t: number): number {
  return t * t;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * The pose at progress `q` (0 = hanging, 1 = at rest). ONE function drives the
 * whole landing — three chained tweens would leave the piece hanging a lift
 * above its seat on a slow renderer; here the resting pose is what q = 1 IS.
 */
export function cityDescentAt(q: number, profile: ColonyCityProfile): CityDescentPose {
  const p = clamp01(q);
  // The fall reaches the seat at the contact point; past it the pose is the seat's.
  const fall = clamp01(p / CITY_CONTACT_AT);
  const down = easeIn(fall);
  const tiltLeft = 1 - clamp01(p / CITY_TILT_OUT_AT);
  return {
    lift: profile.liftHexes * (1 - down),
    scale: profile.startScale + (1 - profile.startScale) * down,
    tilt: TILE_START_TILT_DEG * tiltLeft,
    // Wide and faint at height → tight and dark in contact.
    shadowScale: 1.55 - 0.55 * down,
    shadowAlpha: 0.22 + 0.48 * down,
    touched: p >= CITY_CONTACT_AT,
  };
}

// ── THE STAGE'S READING — the server's marker, phrased ──────────────────────

/** «РАЗМЕЩЕНИЕ ГОРОДА» — what the stage's result rail states, read off `tileSite` (the client counts nothing). */
export type ColonyCityReading = {
  /** The colony tile the city is being placed on. */
  colony: ColonyName;
  /** The city: its card (the name IS the i18n key) and its owner's colour. */
  card: CardName;
  color: Color;
  /** The player's space cities now → once the tile has landed (the server's `Counter`). */
  cities: {before: number, after: number};
  /** The placing card's VP after the landing — absent when its VP does not count the city. */
  victoryPoints?: number;
  /** The one calm line: the city takes no berth and changes nothing about the trade (an i18n key). */
  note: string;
};

export const COLONY_CITY_NOTE = 'Takes no colony berth · trade and track unchanged';

export function colonyCityReading(site: ColonyTileSite, colony: ColonyName): ColonyCityReading {
  const reading: ColonyCityReading = {
    colony,
    card: site.card,
    color: site.color,
    cities: {before: site.spaceCities.before, after: site.spaceCities.after},
    note: COLONY_CITY_NOTE,
  };
  if (site.victoryPoints !== undefined) {
    reading.victoryPoints = site.victoryPoints;
  }
  return reading;
}

/** The city act as the stage reads it — pinned at the press (the answer takes the prompt away mid-scene). */
export type ColonyCityStageView = {
  reading: ColonyCityReading;
  /** A's verb: the play's own on a staged door, the server's on a live one (i18n keys). */
  verbKey: string;
  /** The crumb's stage («ГОРОД»). */
  stageKey: string;
};

/** The crumb's stage name of a city act (an i18n key). */
export const COLONY_CITY_STAGE = 'City';
