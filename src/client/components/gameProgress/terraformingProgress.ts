import {
  MAX_OCEAN_TILES,
  MAX_OXYGEN_LEVEL,
  MAX_TEMPERATURE,
  MAX_VENUS_SCALE,
  MIN_TEMPERATURE,
} from '@/common/constants';

/**
 * The ONE shared "how terraformed is Mars" calculation, used by BOTH the
 * desktop right-sidebar gauge and the console top-HUD progress rail so the
 * two modes can never disagree (and so the math exists exactly once).
 *
 * RULE (deliberate, matches the base game-end condition): the total counts
 * ONLY Temperature + Oceans + Oxygen. Venus is a separate expansion
 * parameter — it is NEVER an input here and never affects the percent or
 * the completion flag. (Game-end VARIANTS that additionally require Venus /
 * Moon completion are the server's `game.isTerraformed` concern — see
 * `finalGenerationActive` in `terraformingCelebration.ts` — not this
 * display-progress helper.)
 */

/** The three inputs — named after the GameModel fields so a `game` model
 *  can be passed directly. Venus is deliberately NOT accepted. */
export type TerraformingProgressInput = {
  temperature: number;
  oxygenLevel: number;
  oceans: number;
};

export type TerraformingProgress = {
  /** Per-axis progress, each clamped to 0..1. */
  temperature: number;
  oxygen: number;
  oceans: number;
  /** Aggregate (equal-weight mean of the three axes), 0..1. */
  total: number;
  /** Stable integer percent for display. Capped at 99 until `complete` —
   *  the readout may only ever say 100% when all three parameters are
   *  genuinely maxed. */
  percent: number;
  /** True iff Temperature AND Oxygen AND Oceans are all complete. */
  complete: boolean;
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function terraformingProgress(input: TerraformingProgressInput): TerraformingProgress {
  const temperature = clamp01((input.temperature - MIN_TEMPERATURE) / (MAX_TEMPERATURE - MIN_TEMPERATURE));
  const oxygen = clamp01(input.oxygenLevel / MAX_OXYGEN_LEVEL);
  const oceans = clamp01(input.oceans / MAX_OCEAN_TILES);
  const total = (temperature + oxygen + oceans) / 3;
  const complete = temperature >= 1 && oxygen >= 1 && oceans >= 1;
  const percent = complete ? 100 : Math.min(Math.round(total * 100), 99);
  return {temperature, oxygen, oceans, total, percent, complete};
}

/**
 * Venus display progress (0..1) — kept in the same module so every surface
 * shares one clamp/scale, but as a SEPARATE function: it can never leak
 * into the total above.
 */
export function venusDisplayProgress(venusScaleLevel: number): number {
  return clamp01(venusScaleLevel / MAX_VENUS_SCALE);
}
