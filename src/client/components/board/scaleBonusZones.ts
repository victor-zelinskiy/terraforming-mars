/**
 * Data-driven definition of the GLOBAL-PARAMETER SCALE reward zones — the
 * bonus points printed on the Venus / Oxygen / Temperature tracks that the
 * game grants when a player advances the parameter past them.
 *
 * GAMEPLAY scale rewards (see src/server/Game.ts), NOT map-tile bonuses:
 *   • Venus    8%  → draw a card            • Venus 16% → +1 TR
 *   • Venus    18–28% → a standard resource  (Alternative Venus Board)
 *   • Venus    30% → standard + WILD resource — ONE gold cube (alt board)
 *   • Oxygen   8%  → raise temperature
 *   • Temp     -24°C / -20°C → +1 heat production   • Temp 0°C → place an ocean
 *
 * ── POSITIONING — proper anchor geometry, NOT eyeballed ───────────────────
 * The three tracks are concentric arcs (circle-fit of the globs.less number
 * anchors → shared centre ≈ (287, 288), in `.global-numbers` space). For each
 * bonus we take the EXACT number-centre coordinate of its division (`VALS`),
 * walk OUTWARD from the scale (toward the planet for Venus' inner bonuses, into
 * space for the others), and place:
 *
 *     number centre ─[BAND_HALF]─ band edge ═[POINTER_LEN]═▷ tip
 *                                  (pointer tip TOUCHES the band edge)
 *     ... ─[MARKER_GAP]─ marker edge ─[size/2]─ marker centre
 *
 * So the triangle pointer's tip lands exactly on the band edge + aims dead at
 * the division's number, and the marker sits cleanly BEHIND it, never on the
 * scale or the digits. Everything below derives from `anchorNode`; the four
 * constants are the only knobs (BAND_HALF = the scale's half thickness).
 *
 * ── PHASE-2 (claimed-by-colour) ──────────────────────────────────────────
 * Each node is OCCUPIABLE; the claim mechanic paints the node in the owner's
 * colour (neutral grey for a governmental-support claim). BonusZone.vue carries
 * the `state` + `claimColor` + surfaces the owner on hover.
 */

export type BonusZoneTier = 'regular' | 'final';

/** Claim state of a reward zone. */
export type BonusZoneState = 'available' | 'claimed' | 'government';

export type BonusScale = 'venus' | 'oxygen' | 'temperature';

/** When a zone is shown: always (base game), with Venus, or only the alt board. */
export type BonusZoneRequires = 'always' | 'venus' | 'altVenus';

/** Which side of the band the marker sits on. */
type BonusSide = 'inner' | 'outer';

// ── Scale geometry (the only positioning knobs) ────────────────────────────
// The three tracks are CONCENTRIC arcs. CENTER is the centre of the circle
// through the NUMBER CENTRES — verified with Playwright against the live render
// (the digits' measured centres fit it to ~0°). The `@*-vals` anchors are the
// digits' MARGIN (top-left) corner, so we add NUMBER_HALF (half the 26px digit
// box) to reach the digit centre before doing any radial maths — anchoring to
// the corner instead drifts the angle progressively along the arc.
const CENTER = {x: 300, y: 301};
/** Half the rendered digit box (`.global-numbers-value` is 26px). */
const NUMBER_HALF = 13;
/**
 * Distance (px, @vals) from a digit's centre to the coloured band edge FACING
 * the marker — i.e. how far out the pointer tip must reach to touch the scale.
 * PER-SCALE because the printed bands aren't concentric with the digits and the
 * digit sits at a different spot in each band (verified by sampling mars.png +
 * the live Playwright crops): the Venus digits sit near the band's OUTER edge
 * (so the inner edge the markers face is ~18 in), the Oxygen digit sits AT its
 * band's outer edge (~4), and the Temperature band extends well outward (~25).
 */
const BAND_EDGE: Record<BonusScale, number> = {venus: 18, oxygen: 14, temperature: 16};
/** Length of the triangle pointer (must match `.bonus-zone__pointer` height). */
const POINTER_LEN = 10;
/** Small gap between the pointer base and the marker edge. */
const MARKER_GAP = 2;

// Number-centre coordinates ({x: margin-left, y: margin-top}) of each bonus's
// division, copied from the globs.less `@*-vals` arrays (the exact anchors the
// client renders the digits at).
const VALS: Record<BonusScale, Record<number, {x: number; y: number}>> = {
  venus: {
    8: {x: 197, y: 36}, 16: {x: 301, y: 20},
    18: {x: 327, y: 23}, 20: {x: 352, y: 28}, 22: {x: 377, y: 36},
    24: {x: 401, y: 46}, 26: {x: 425, y: 58}, 28: {x: 446, y: 72}, 30: {x: 466, y: 88},
  },
  oxygen: {8: {x: 20, y: 295}},
  temperature: {[-24]: {x: 490, y: 461}, [-20]: {x: 517, y: 423}, 0: {x: 540, y: 199}},
};

type AnchorDef = {
  key: string;
  scale: BonusScale;
  step: number;
  side: BonusSide;
  icon: string;
  reward: string;
  tier: BonusZoneTier;
  requires: BonusZoneRequires;
  size: number;
  /** Tangent tilt of the node visuals (the crystals follow the arc). */
  rot: number;
  /** Per-bonus band-edge override (else BAND_EDGE[scale]) — for spots where
   *  the printed band sits at a different distance from the digit than its
   *  neighbours (the Temperature ocean@0 band is thinner than the heat bands). */
  bandEdge?: number;
};

const WILD = 'Gain a standard resource of your choice';
const RES = (key: string, step: number, rot: number): AnchorDef => ({
  key, scale: 'venus', step, side: 'inner', icon: 'bonus-zone-icon--wild', reward: WILD,
  tier: 'regular', requires: 'altVenus', size: 18, rot,
});

const ANCHOR_DEFS: ReadonlyArray<AnchorDef> = [
  // Temperature track (base game) — OUTSIDE the band.
  {key: 't-heat-24', scale: 'temperature', step: -24, side: 'outer', icon: 'bonus-zone-icon--heat', reward: 'Gain 1 heat production', tier: 'regular', requires: 'always', size: 25, rot: 0},
  {key: 't-heat-20', scale: 'temperature', step: -20, side: 'outer', icon: 'bonus-zone-icon--heat', reward: 'Gain 1 heat production', tier: 'regular', requires: 'always', size: 25, rot: 0},
  {key: 't-ocean-0', scale: 'temperature', step: 0, side: 'outer', icon: 'bonus-zone-icon--ocean', reward: 'Place an ocean', tier: 'regular', requires: 'always', size: 25, rot: 0, bandEdge: 12},
  // Oxygen track (base game) — OUTSIDE the band.
  {key: 'o-temp-8', scale: 'oxygen', step: 8, side: 'outer', icon: 'bonus-zone-icon--temperature', reward: 'Raise temperature 1 step', tier: 'regular', requires: 'always', size: 25, rot: 0},
  // Venus base bonuses (Venus expansion) — BELOW the band, same size/system as
  // the alt resources so the whole Venus scale reads as ONE mechanism.
  {key: 'v-card-8', scale: 'venus', step: 8, side: 'inner', icon: 'bonus-zone-icon--card', reward: 'Draw a card', tier: 'regular', requires: 'venus', size: 18, rot: 0},
  {key: 'v-tr-16', scale: 'venus', step: 16, side: 'inner', icon: 'bonus-zone-icon--tr', reward: 'Gain 1 TR', tier: 'regular', requires: 'venus', size: 18, rot: 0},
  // Venus Alternative Board resources (steps 18–28) — INSIDE the band.
  RES('v18', 18, 7.8), RES('v20', 20, 13.6), RES('v22', 22, 19.6),
  RES('v24', 24, 25.25), RES('v26', 26, 30.65), RES('v28', 28, 36.46),
  // Venus Alternative Board FINAL bonus — ONE gold cube anchored to 30%.
  {key: 'v30-final', scale: 'venus', step: 30, side: 'inner', icon: 'bonus-zone-icon--gold-cube', reward: 'Gain a standard resource and a wild resource', tier: 'final', requires: 'altVenus', size: 18, rot: 0},
];

export type ScaleBonusZoneDef = AnchorDef & {
  /** Margin (top/left) of the marker in `.global-numbers` space. */
  top: number;
  left: number;
  /** Rotation (deg) of the triangle pointer so it aims at the division. */
  point: number;
  /** How far (px) to push the pointer out from the marker centre toward the band. */
  pointerDist: number;
};

/**
 * Anchor a marker + pointer to a division. Returns the marker margin, the
 * pointer rotation (aimed at the number) and how far to push the pointer so its
 * TIP lands on the band edge.
 */
function anchorNode(d: AnchorDef): ScaleBonusZoneDef {
  const p = VALS[d.scale][d.step];
  // The digit CENTRE (the @vals anchor is its top-left margin corner).
  const nx = p.x + NUMBER_HALF;
  const ny = p.y + NUMBER_HALF;
  const ux = nx - CENTER.x;
  const uy = ny - CENTER.y;
  const m = Math.hypot(ux, uy);
  const sign = d.side === 'inner' ? -1 : 1; // unit pointing toward the marker
  const ox = (sign * ux) / m;
  const oy = (sign * uy) / m;
  // Marker centre: out past the band edge, the pointer and a small gap. The
  // pointer tip then lands exactly on the band edge (BAND_EDGE from the digit).
  const bandEdge = d.bandEdge ?? BAND_EDGE[d.scale];
  const dist = bandEdge + POINTER_LEN + MARKER_GAP + d.size / 2;
  const cx = nx + ox * dist;
  const cy = ny + oy * dist;
  // Pointer rotation: an up-triangle rotated by `point` aims at the number
  // (direction -out): (sin, -cos) = -out → point = atan2(-ox, oy).
  const point = Math.round((Math.atan2(-ox, oy) * 180) / Math.PI);
  // Push the pointer box out so its tip reaches the band edge.
  const pointerDist = d.size / 2 + MARKER_GAP + POINTER_LEN / 2;
  return {
    ...d,
    top: Math.round(cy - d.size / 2),
    left: Math.round(cx - d.size / 2),
    point,
    pointerDist,
  };
}

export const SCALE_BONUS_ZONES: ReadonlyArray<ScaleBonusZoneDef> = ANCHOR_DEFS.map(anchorNode);

export type ScaleBonusZoneView = ScaleBonusZoneDef & {
  /** Inline style positioning + sizing the node. */
  style: Record<string, string>;
};

// ── Claim resolution (phase 2, live) ──────────────────────────────────────
// Player colours for tinting a claimed node (slightly brightened from the
// canonical variables.less colours so they read on the small dark chip).
const CLAIM_COLOR_HEX: Record<string, string> = {
  red: 'rgb(204, 56, 34)',
  green: 'rgb(38, 176, 38)',
  yellow: 'rgb(198, 198, 44)',
  black: 'rgb(126, 126, 134)',
  blue: 'rgb(40, 122, 255)',
  purple: 'rgb(168, 72, 255)',
  orange: 'rgb(236, 132, 40)',
  pink: 'rgb(245, 132, 196)',
};

export type ScaleBonusClaim = {
  state: BonusZoneState;
  /** CSS colour the node is painted in (claimed only; '' otherwise). */
  claimColor: string;
  /** Display name of the owner ('' when available / government). */
  claimedBy: string;
};

/**
 * Resolve a zone's claim from the game's `scaleBonusClaims` map. 'neutral' ⇒
 * taken via World Government (no owner); a player colour ⇒ claimed by them.
 */
export function resolveScaleBonusClaim(
  claims: Record<string, string> | undefined,
  scale: BonusScale,
  step: number,
  players: ReadonlyArray<{color: string; name: string}>,
): ScaleBonusClaim {
  const claim = claims?.[`${scale}-${step}`];
  if (claim === undefined) {
    return {state: 'available', claimColor: '', claimedBy: ''};
  }
  if (claim === 'neutral') {
    return {state: 'government', claimColor: '', claimedBy: ''};
  }
  return {
    state: 'claimed',
    claimColor: CLAIM_COLOR_HEX[claim] ?? '',
    claimedBy: players.find((p) => p.color === claim)?.name ?? '',
  };
}

export type ScaleBonusVisibility = {venus: boolean; altVenus: boolean};

function isVisible(zone: ScaleBonusZoneDef, v: ScaleBonusVisibility): boolean {
  switch (zone.requires) {
  case 'always': return true;
  case 'venus': return v.venus;
  case 'altVenus': return v.altVenus;
  }
}

/** The reward i18n key for a claim key (`<scale>-<step>`) — for the notification. */
export function scaleBonusRewardKey(claimKey: string): string {
  return SCALE_BONUS_ZONES.find((z) => `${z.scale}-${z.step}` === claimKey)?.reward ?? '';
}

/** Project the static defs to render-ready view models. */
export function scaleBonusZoneViews(v: ScaleBonusVisibility): ReadonlyArray<ScaleBonusZoneView> {
  return SCALE_BONUS_ZONES.filter((z) => isVisible(z, v)).map((z) => ({
    ...z,
    style: {
      'margin': `${z.top}px 0 0 ${z.left}px`,
      'width': `${z.size}px`,
      'height': `${z.size}px`,
    },
  }));
}
