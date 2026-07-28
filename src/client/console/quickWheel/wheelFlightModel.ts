/*
 * QUICK-WHEEL FLIGHT MODEL — the PURE declarative half of the wheel's
 * shared-element transitions (no Vue / DOM / GSAP; unit-tested).
 *
 * When a wheel slot COMMITS, its icon detaches from the tile and travels to
 * the natural anchor of whatever the action opened — the next screen's
 * header emblem, the hand dock's plate, the heat row of the resource panel —
 * so the wheel and its destination read as ONE continuous gesture, never as
 * two unrelated surfaces. This module declares, per wheel entry:
 *
 *   anchor     the `data-wheel-anchor` id the icon lands on (undefined =
 *              a self-contained finalization beat at the tile);
 *   character  the flight's personality (trajectory / easing family);
 *   landing    'become' — the anchor IS the travelled icon (it stays hidden
 *              until touchdown, then the proxy hands over — one object);
 *              'absorb' — the anchor is a live HUD element the icon melts
 *              INTO (never concealed — the dock counter / heat row must
 *              stay readable throughout).
 *
 * The RUNTIME (wheelFlight.ts) resolves anchors from the REAL interface at
 * flight time and degrades honestly: an anchor that never appears dissolves
 * the proxy mid-air; reduced motion skips the flight entirely. Nothing here
 * ever gates game logic — the action itself is dispatched before the first
 * frame of the flight.
 */

/** The flight personalities (implemented by the director, one timeline each). */
export type WheelFlightCharacter =
  | 'orbit' // trading: a calm, wide orbital arc into the screen's emblem
  | 'surge' // card actions: an energetic direct shot with a firm settle
  | 'forge' // standard projects: a weighty geometric descent
  | 'wave' // hydronetwork: a soft swell that rolls into the header
  | 'deal' // cards: a short dive down into the hand dock's plate
  | 'flag' // pass: a brief hop onto the confirm card's emblem
  | 'ember' // heat: into the heat row, then a spark rises to the temperature readout
  | 'sprout' // plants: dives toward the board, dissolving into the placement glow
  | 'stamp'; // skip turn: a directional dash at the tile, no destination

export type WheelFlightLanding = 'become' | 'absorb';

export type WheelFlightSpec = {
  anchor?: string,
  character: WheelFlightCharacter,
  landing?: WheelFlightLanding,
};

/**
 * The closed per-entry transition table (wheel entry id → its flight).
 * Declarative on purpose: a NEW wheel entry gets its transition by adding a
 * row here — never by threading bespoke animation calls through the shell.
 */
export const WHEEL_FLIGHTS: Readonly<Record<string, WheelFlightSpec>> = {
  trading: {anchor: 'trading', character: 'orbit', landing: 'become'},
  cards: {anchor: 'hand-dock', character: 'deal', landing: 'absorb'},
  cardActions: {anchor: 'card-actions', character: 'surge', landing: 'become'},
  standardProjects: {anchor: 'std-projects', character: 'forge', landing: 'become'},
  hydro: {anchor: 'hydro', character: 'wave', landing: 'become'},
  skipTurn: {character: 'stamp'},
  pass: {anchor: 'confirm', character: 'flag', landing: 'become'},
  convertHeat: {anchor: 'res-heat', character: 'ember', landing: 'absorb'},
  convertPlants: {character: 'sprout'},
};

/** The flight for a committed entry (undefined = no transition declared). */
export function wheelFlightSpecFor(entryId: string): WheelFlightSpec | undefined {
  return WHEEL_FLIGHTS[entryId];
}

/**
 * A commit that lands in the shared CONFIRM card instead of executing
 * directly (pass always; heat at max temperature) retargets its flight to
 * the confirm card's emblem with the short 'flag' hop — the character of
 * "the question arrives" rather than "the action fires".
 */
export const CONFIRM_FLIGHT: WheelFlightSpec = {anchor: 'confirm', character: 'flag', landing: 'become'};

// ── pure flight geometry (unit-tested; the director only samples it) ────────

export type FlightPoint = {x: number, y: number};

/**
 * Quadratic bezier sample for the curved characters. `bulge` displaces the
 * control point perpendicular to the from→to chord (positive = to the left
 * of travel), as a fraction of the chord length — so the SAME arc reads
 * correctly at any distance and any UI scale.
 */
export function flightArcPoint(t: number, from: FlightPoint, to: FlightPoint, bulge: number): FlightPoint {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const cx = mx - dy * bulge;
  const cy = my + dx * bulge;
  const u = 1 - t;
  return {
    x: u * u * from.x + 2 * u * t * cx + t * t * to.x,
    y: u * u * from.y + 2 * u * t * cy + t * t * to.y,
  };
}

/** Per-character arc bulge (0 = straight). Sign picks the visual side. */
export function flightBulgeOf(character: WheelFlightCharacter): number {
  switch (character) {
  case 'orbit': return 0.22;
  case 'wave': return -0.14;
  case 'ember': return -0.18;
  case 'flag': return 0.08;
  default: return 0;
  }
}

/** Base travel duration per character (ms at standard speed; motionMs folds
 *  the preset). The wheel is a high-frequency control — everything is short. */
export function flightTravelMsOf(character: WheelFlightCharacter): number {
  switch (character) {
  case 'orbit': return 380;
  case 'wave': return 360;
  case 'forge': return 320;
  case 'surge': return 260;
  case 'deal': return 230;
  case 'flag': return 250;
  case 'ember': return 280;
  case 'sprout': return 330;
  case 'stamp': return 240;
  }
}

/** How long the runtime keeps polling for the destination anchor before the
 *  proxy dissolves mid-air (REAL ms — acquisition is DOM readiness, not
 *  choreography, so the motion preset must not stretch it). */
export const FLIGHT_ACQUIRE_TIMEOUT_MS = 700;

/** The travelling proxy's lift at detach (scale-up over the tile). */
export const FLIGHT_DETACH_SCALE = 1.16;
