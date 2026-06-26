/**
 * Premium PLANETARY-EVENT markers for the global-parameter arc scales, driven by
 * the LIVE hazard thresholds (`AresData.hazardData`) — so the marker sits on the
 * REAL threshold digit (extreme-variant safe) and shows the actual reward.
 *
 * Replaces the legacy CSS-positioned `global-ares-*` icons (PNG jetons) with the
 * unified `ArcScaleMarkerChip` language (the same chips the scale reward bonuses
 * and the dev ocean markers use). The four events:
 *
 *   • ocean  →  erosions appear            (hazard, no payout)
 *   • ocean  →  dust storms recede         (planetary event, +1 TR to the trigger)
 *   • temp   →  erosions intensify         (hazard, no payout)
 *   • oxygen →  dust storms intensify      (hazard, no payout)
 *
 * UI is diegetic & expansion-NEUTRAL: titles read "Planetary event", no add-on
 * name surfaces. Ocean markers are positioned by OceanArcScale (linear band);
 * the temperature / oxygen markers are positioned HERE on the hand-tuned dynamic
 * configs (mirroring scaleBonusZones), since their digit angles are non-linear.
 */

import {AresData} from '@/common/ares/AresData';
import {OXYGEN_ARC, TEMPERATURE_ARC, DynamicArcConfig} from '@/client/components/board/arcScaleConfigs';
import {placeArcMarker} from '@/client/components/board/arcScaleGeometry';
import {GlobalParameterThresholdMarker} from '@/client/components/board/oceanThresholdMarkers';

/** The 4 planetary-event markers built from the live hazard thresholds. */
export function aresThresholdMarkers(aresData: AresData): ReadonlyArray<GlobalParameterThresholdMarker> {
  const h = aresData.hazardData;
  if (h === undefined) {
    return [];
  }
  return [
    {
      id: 'ares-erosions',
      parameter: 'oceans',
      value: h.erosionOceanCount.threshold,
      kind: 'hazard-event',
      icon: 'ocean-event-icon--hazard',
      title: 'Planetary event',
      description: 'Erosions appear across the surface.',
      reward: {recipient: 'none', deltas: []},
      enabled: true,
      visible: true,
    },
    {
      id: 'ares-remove-dust-storms',
      parameter: 'oceans',
      value: h.removeDustStormsOceanCount.threshold,
      kind: 'planetary-event',
      icon: 'bonus-zone-icon--tr',
      title: 'Planetary event',
      description: 'Dust storms recede across the surface.',
      reward: {recipient: 'triggering-player', deltas: [{resource: 'tr', amount: 1}]},
      rewardLabel: '+1 TR',
      enabled: true,
      visible: true,
    },
    {
      id: 'ares-severe-erosions',
      parameter: 'temperature',
      value: h.severeErosionTemperature.threshold,
      kind: 'hazard-event',
      icon: 'ocean-event-icon--hazard',
      title: 'Planetary event',
      description: 'Erosions intensify into severe hazards.',
      reward: {recipient: 'none', deltas: []},
      enabled: true,
      visible: true,
    },
    {
      id: 'ares-severe-dust-storms',
      parameter: 'oxygen',
      value: h.severeDustStormOxygen.threshold,
      kind: 'hazard-event',
      icon: 'ocean-event-icon--hazard',
      title: 'Planetary event',
      description: 'Dust storms intensify into severe hazards.',
      reward: {recipient: 'none', deltas: []},
      enabled: true,
      visible: true,
    },
  ];
}

export type ScaleEventMarkerView = {
  marker: GlobalParameterThresholdMarker;
  top: number;
  left: number;
  size: number;
  point: number;
  pointerDist: number;
  pointerLen: number;
  reached: boolean;
};

// Match the standard scale-bonus markers (scaleBonusZones.ts): size 25, gap 2,
// connector 7 — so events read the SAME size + distance as the reward bonuses on
// every scale (only the cramped Venus row uses a smaller chip, and it has no events).
const CHIP = 25;
const GAP = 2;
const CONNECTOR = 7;

/** Exact clock angle of a value on a dynamic config; interpolates if no digit. */
function digitAngle(cfg: DynamicArcConfig, value: number): number {
  const exact = cfg.digits.find((d) => d.value === value);
  if (exact !== undefined) {
    return exact.angle;
  }
  const sorted = [...cfg.digits].sort((a, b) => a.value - b.value);
  let lo = sorted[0];
  let hi = sorted[sorted.length - 1];
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].value <= value && value <= sorted[i + 1].value) {
      lo = sorted[i];
      hi = sorted[i + 1];
      break;
    }
  }
  if (hi.value === lo.value) {
    return lo.angle;
  }
  const t = (value - lo.value) / (hi.value - lo.value);
  return lo.angle + t * (hi.angle - lo.angle);
}

/**
 * Position a TEMPERATURE / OXYGEN marker on its dynamic config (OUTSIDE the band,
 * clear of the inner planet) + compute the reached (already-fired) state from the
 * current parameter value. Ocean markers are positioned by OceanArcScale instead.
 */
export function aresDynamicMarkerView(
  marker: GlobalParameterThresholdMarker,
  currentValue: number,
  // The value to POSITION at — defaults to the threshold, but the caller passes a
  // glided value so the marker animates along the arc when the threshold shifts
  // (Butterfly Effect). `reached` always uses the REAL threshold (marker.value).
  positionValue: number = marker.value,
): ScaleEventMarkerView {
  const cfg = marker.parameter === 'temperature' ? TEMPERATURE_ARC : OXYGEN_ARC;
  const pl = placeArcMarker({
    center: cfg.center,
    thresholdAngle: digitAngle(cfg, positionValue),
    bandRadius: cfg.bandRadius,
    bandWidth: cfg.bandWidth,
    side: 'outside',
    gap: GAP,
    pointer: CONNECTOR,
    size: CHIP,
    value: positionValue,
  });
  return {
    marker,
    top: Math.round(pl.chipCenter.y - CHIP / 2),
    left: Math.round(pl.chipCenter.x - CHIP / 2),
    size: CHIP,
    point: pl.rotation,
    pointerDist: pl.pointerDist,
    pointerLen: pl.pointerLen,
    reached: currentValue >= marker.value,
  };
}
