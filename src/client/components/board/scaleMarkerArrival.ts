import {reactive} from 'vue';

/**
 * WHERE EACH SCALE'S CURSOR STANDS — published by the board's one
 * `AnimatedScaleMarker` per accent, read by whoever must wait for the cursor
 * to ARRIVE before telling what the step paid (Turmoil Redux TR24 Venusian
 * Census: the data tokens are born at the marker only once it has reached the
 * division that paid them — docs/TURMOIL_REDUX_VENUSIAN_CENSUS.md).
 *
 * A SIGNAL, never a timer: the marker's own WAAPI glide reports its finish
 * here, and every snap (no glide to play — hidden board, reduced motion, first
 * placement) reports the position it was written to. `value` is the value the
 * cursor RESTS on; while a glide runs it is `undefined` and `moving` is true.
 */
export type ScaleMarkerAccent = 'temperature' | 'oxygen' | 'venus' | 'oceans';

export type ScaleMarkerPose = {
  /** The value the cursor rests on — `undefined` while it travels or stands off the printed dial. */
  value: number | undefined;
  moving: boolean;
  /** Where a running glide is heading. */
  target: number | undefined;
};

function idle(): ScaleMarkerPose {
  return {value: undefined, moving: false, target: undefined};
}

export const scaleMarkerPoses = reactive<Record<ScaleMarkerAccent, ScaleMarkerPose>>({
  temperature: idle(),
  oxygen: idle(),
  venus: idle(),
  oceans: idle(),
});

/** The cursor started a glide toward `target`. */
export function noteScaleMarkerMoving(accent: ScaleMarkerAccent, target: number): void {
  scaleMarkerPoses[accent] = {value: undefined, moving: true, target};
}

/** The cursor RESTS on `value` (a finished glide, or a snap); `undefined` = off the printed dial. */
export function noteScaleMarkerSettled(accent: ScaleMarkerAccent, value: number | undefined): void {
  scaleMarkerPoses[accent] = {value, moving: false, target: undefined};
}

/**
 * Has the cursor ARRIVED at `after` — resting on it or past it (a raise the
 * next response carried further retargets the glide: the cursor never rests on
 * the earlier division, and it has passed it)? A cursor that never published
 * anything (no board mounted) has not.
 */
export function scaleMarkerArrived(accent: ScaleMarkerAccent, after: number): boolean {
  const pose = scaleMarkerPoses[accent];
  return !pose.moving && pose.value !== undefined && pose.value >= after;
}

/** Specs / a game switch: forget every pose. */
export function resetScaleMarkerPoses(): void {
  for (const accent of Object.keys(scaleMarkerPoses) as Array<ScaleMarkerAccent>) {
    scaleMarkerPoses[accent] = idle();
  }
}
