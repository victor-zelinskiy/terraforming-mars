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
 * ── POSITIONING — derived from the LIVE band geometry, never eyeballed ──────
 * The colour band each scale is drawn at is the dynamic ArcScale band — a known
 * circle (`arcScaleConfigs`: centre, `bandRadius`, `bandWidth`). For every bonus
 * we take its value's EXACT angle (the config digit's measured angle) and run
 * the shared `placeArcMarker` geometry: the chip body sits just beyond the band
 * edge facing it, and its luminous connector spans from the chip edge to the
 * rail edge and PHYSICALLY TOUCHES it (the tip == the rail-edge point). This is
 * the same geometry the ocean event chips use, so the pointer-to-rail connection
 * is correct on every scale by construction — no per-scale magic offsets.
 *
 *     planet ← [chip] ═connector═▷ rail edge ── band ── (digit ring)
 *
 * Dense rows (the Venus cluster) FAN OUT: `scaleBonusZoneViews` spreads the
 * VISIBLE chips' angles so they don't overlap, while each connector re-aims at
 * its TRUE threshold rail point — a fanned chip never detaches from its value.
 *
 * ── PHASE-2 (claimed-by-colour) ──────────────────────────────────────────
 * Each node is OCCUPIABLE; the claim mechanic paints the node in the owner's
 * colour (neutral grey for a governmental-support claim). BonusZone.vue carries
 * the `state` + `claimColor` + surfaces the owner on hover.
 */

import {OXYGEN_ARC, TEMPERATURE_ARC, VENUS_ARC, DynamicArcConfig} from '@/client/components/board/arcScaleConfigs';
import {placeArcMarker, spreadValues, MarkerSide} from '@/client/components/board/arcScaleGeometry';

export type BonusZoneTier = 'regular' | 'final';

/** Claim state of a reward zone. */
export type BonusZoneState = 'available' | 'claimed' | 'government';

export type BonusScale = 'venus' | 'oxygen' | 'temperature';

/** When a zone is shown: always (base game), with Venus, or only the alt board. */
export type BonusZoneRequires = 'always' | 'venus' | 'altVenus';

/** Which side of the band the marker sits on. */
type BonusSide = 'inner' | 'outer';

// The live band geometry per scale (centre / bandRadius / bandWidth / digits).
const CONFIG: Record<BonusScale, DynamicArcConfig> = {
  venus: VENUS_ARC,
  oxygen: OXYGEN_ARC,
  temperature: TEMPERATURE_ARC,
};

// ── Marker knobs (the only positioning constants) ──────────────────────────
// Both small: the chip hugs the band (CLAUDE goal — native, not a floating
// jeton) and the connector is a short luminous stem ending in a rail anchor dot.
/** Gap (px) between the chip edge and the connector base. */
const GAP = 2;
/** Base connector length (px) for a radial chip; fan-out lengthens it. */
const CONNECTOR = 7;
/** Extra breathing room (px) added to the chip size for the fan-out min-gap. */
const FAN_BREATHING = 4;

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
};

const WILD = 'Gain a standard resource of your choice';
const res = (key: string, step: number): AnchorDef => ({
  key, scale: 'venus', step, side: 'inner', icon: 'bonus-zone-icon--wild', reward: WILD,
  tier: 'regular', requires: 'altVenus', size: 18,
});

const ANCHOR_DEFS: ReadonlyArray<AnchorDef> = [
  // Temperature track (base game) — OUTSIDE the band.
  {key: 't-heat-24', scale: 'temperature', step: -24, side: 'outer', icon: 'bonus-zone-icon--heat', reward: 'Gain 1 heat production', tier: 'regular', requires: 'always', size: 25},
  {key: 't-heat-20', scale: 'temperature', step: -20, side: 'outer', icon: 'bonus-zone-icon--heat', reward: 'Gain 1 heat production', tier: 'regular', requires: 'always', size: 25},
  {key: 't-ocean-0', scale: 'temperature', step: 0, side: 'outer', icon: 'bonus-zone-icon--ocean', reward: 'Place an ocean', tier: 'regular', requires: 'always', size: 25},
  // Oxygen track (base game) — OUTSIDE the band.
  {key: 'o-temp-8', scale: 'oxygen', step: 8, side: 'outer', icon: 'bonus-zone-icon--temperature', reward: 'Raise temperature 1 step', tier: 'regular', requires: 'always', size: 25},
  // Venus base bonuses (Venus expansion) — INSIDE (toward the planet), same
  // size/system as the alt resources so the whole Venus scale reads as ONE row.
  {key: 'v-card-8', scale: 'venus', step: 8, side: 'inner', icon: 'bonus-zone-icon--card', reward: 'Draw a card', tier: 'regular', requires: 'venus', size: 18},
  {key: 'v-tr-16', scale: 'venus', step: 16, side: 'inner', icon: 'bonus-zone-icon--tr', reward: 'Gain 1 TR', tier: 'regular', requires: 'venus', size: 18},
  // Venus Alternative Board resources (steps 18–28) — INSIDE the band.
  res('v18', 18), res('v20', 20), res('v22', 22),
  res('v24', 24), res('v26', 26), res('v28', 28),
  // Venus Alternative Board FINAL bonus — ONE gold cube anchored to 30%.
  {key: 'v30-final', scale: 'venus', step: 30, side: 'inner', icon: 'bonus-zone-icon--gold-cube', reward: 'Gain a standard resource and a wild resource', tier: 'final', requires: 'altVenus', size: 18},
];

export type ScaleBonusZoneDef = AnchorDef & {
  /** Margin (top/left) of the marker in `.global-numbers` space. */
  top: number;
  left: number;
  /** Rotation (deg) of the connector so it aims at the division. */
  point: number;
  /** How far (px) to push the connector out from the marker centre toward the band. */
  pointerDist: number;
  /** Connector visible length (px) — chip edge → rail edge. */
  pointerLen: number;
};

function sideOf(d: AnchorDef): MarkerSide {
  return d.side === 'inner' ? 'inside' : 'outside';
}

/** Exact clock angle (deg) of a value, from the live config digit ring. */
function angleFor(scale: BonusScale, step: number): number {
  return CONFIG[scale].digits.find((x) => x.value === step)?.angle ?? 0;
}

/** Place one marker (radial unless `chipAngle` fans it off its threshold). */
function place(d: AnchorDef, chipAngle?: number) {
  const cfg = CONFIG[d.scale];
  return placeArcMarker({
    center: cfg.center,
    thresholdAngle: angleFor(d.scale, d.step),
    chipAngle,
    bandRadius: cfg.bandRadius,
    bandWidth: cfg.bandWidth,
    side: sideOf(d),
    gap: GAP,
    pointer: CONNECTOR,
    size: d.size,
    value: d.step,
  });
}

function toDef(d: AnchorDef): ScaleBonusZoneDef {
  const pl = place(d);
  return {
    ...d,
    top: Math.round(pl.chipCenter.y - d.size / 2),
    left: Math.round(pl.chipCenter.x - d.size / 2),
    point: pl.rotation,
    pointerDist: pl.pointerDist,
    pointerLen: pl.pointerLen,
  };
}

// Static RADIAL placement (every zone, no fan-out) — the source of truth for
// the reward-key lookup + the geometry tests. The live render fans the dense
// rows in `scaleBonusZoneViews`.
export const SCALE_BONUS_ZONES: ReadonlyArray<ScaleBonusZoneDef> = ANCHOR_DEFS.map(toDef);

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

function isVisible(zone: AnchorDef, v: ScaleBonusVisibility): boolean {
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

function viewFrom(d: AnchorDef, chipAngle: number): ScaleBonusZoneView {
  const pl = place(d, chipAngle);
  const top = Math.round(pl.chipCenter.y - d.size / 2);
  const left = Math.round(pl.chipCenter.x - d.size / 2);
  return {
    ...d,
    top,
    left,
    point: pl.rotation,
    pointerDist: pl.pointerDist,
    pointerLen: pl.pointerLen,
    style: {
      'margin': `${top}px 0 0 ${left}px`,
      'width': `${d.size}px`,
      'height': `${d.size}px`,
    },
  };
}

/**
 * Project the static defs to render-ready view models for the ACTIVE expansions.
 * Per scale, the VISIBLE chips are fanned out so a dense row never overlaps: we
 * spread their chip ANGLES to a minimum angular gap (derived from the chip size
 * + the chip radius), then re-place each chip at its spread angle — the
 * connector re-aims at the true threshold so the value link is preserved.
 */
export function scaleBonusZoneViews(v: ScaleBonusVisibility): ReadonlyArray<ScaleBonusZoneView> {
  const out: Array<ScaleBonusZoneView> = [];
  for (const scale of ['venus', 'oxygen', 'temperature'] as ReadonlyArray<BonusScale>) {
    const group = ANCHOR_DEFS.filter((d) => d.scale === scale && isVisible(d, v));
    if (group.length === 0) {
      continue;
    }
    const cfg = CONFIG[scale];
    const maxSize = Math.max(...group.map((d) => d.size));
    const half = cfg.bandWidth / 2;
    const off = GAP + CONNECTOR + maxSize / 2;
    // Approx chip radius on this scale's side → the angular gap the chips need.
    const chipRadius = group[0].side === 'inner' ? cfg.bandRadius - half - off : cfg.bandRadius + half + off;
    const minGapDeg = ((maxSize + FAN_BREATHING) / chipRadius) * (180 / Math.PI);
    const fanned = spreadValues(group.map((d) => angleFor(scale, d.step)), minGapDeg);
    group.forEach((d, i) => out.push(viewFrom(d, fanned[i])));
  }
  return out;
}
