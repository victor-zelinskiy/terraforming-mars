/*
 * «ОБРАТНЫЙ ХОД» — the pure half of the scene of a PARAMETER SWING (Turmoil
 * Redux TR47 Ecological Experiment: «increase each Mars global parameter 1
 * step … THEN decrease each Mars global parameter that isn't at maximum by 1
 * step; keep the TR you gained»; docs/TURMOIL_REDUX_ECOLOGICAL_EXPERIMENT.md).
 *
 * THE FACT IS THE SERVER'S (`GameModel.parameterSwings`, the PL-133 class):
 * the two halves of the story routinely land in ONE response (every ocean at
 * its maximum — no removal is asked, the fall rides the play's own answer),
 * where the DIFF of the two views reads ZERO — the marker would not move and
 * the rating would tick with no cause on screen. So the scene is planned off
 * the RECORD, and the views only say what the player has ALREADY seen:
 *
 *  · an UP leg is played by this scene only when neither view shows the peak
 *    (the raise and the fall arrived together); a peak the diff glides to by
 *    itself — or one an earlier response already showed — is the ordinary
 *    scale beat's, never glided twice;
 *  · a DOWN leg is always this scene's: the display stands on the peak until
 *    the fall's own turn (cause before consequence, in the card's printed
 *    order — the ocean leaves, then the temperature, then the oxygen);
 *  · a parameter LEFT at its maximum (or at its minimum) is NAMED at its
 *    marker («МАКС») and does not move.
 *
 * Pure (no DOM, no Vue): which records are new (consumed once by `seq`), the
 * legs of a record against the two views, the display the scene starts from,
 * and the rating the scene itself must fly (the up legs nobody else showed).
 */
import {Color} from '@/common/Color';
import {GameModel} from '@/common/models/GameModel';
import {ParameterSwingModel} from '@/common/models/ParameterSwingModel';
import {ParameterMoveId} from '@/common/parliament/parameterMove';
import {HeldGlobalParams} from '@/client/console/planetFocus';
import {ScaleMarkerAccent} from '@/client/components/board/scaleMarkerArrival';

/** One parameter's presentation keys: the park's display key and the board marker's accent. */
export type SwingParam = {parameter: ParameterMoveId, key: keyof HeldGlobalParams, accent: ScaleMarkerAccent, unit: string};

const PARAMS: Readonly<Record<ParameterMoveId, SwingParam>> = {
  temperature: {parameter: 'temperature', key: 'temperature', accent: 'temperature', unit: '°C'},
  oxygen: {parameter: 'oxygen', key: 'oxygenLevel', accent: 'oxygen', unit: '%'},
  oceans: {parameter: 'oceans', key: 'oceans', accent: 'oceans', unit: ''},
  venus: {parameter: 'venus', key: 'venusScaleLevel', accent: 'venus', unit: '%'},
};

export function swingParamOf(parameter: ParameterMoveId): SwingParam {
  return PARAMS[parameter];
}

/** A beat of the scene: the raise of one parameter, its fall, or a limit named in place. */
export type SwingLeg =
  | SwingParam & {kind: 'up', from: number, to: number, tr: number}
  | SwingParam & {kind: 'down', from: number, to: number}
  | SwingParam & {kind: 'max' | 'min', at: number};

export type SwingPlan = {
  seq: number;
  /** The seat that played the card — the raise's rating is THEIRS. */
  player: Color;
  /** The viewer is that seat (their rail owns the rating tokens). */
  own: boolean;
  /** The legs in the scene's order: every raise the scene plays, then the fall in the record's order. */
  legs: ReadonlyArray<SwingLeg>;
  /** What the board and the HUD DISPLAY until each leg's turn (one key per parameter the scene moves). */
  start: Partial<HeldGlobalParams>;
  /** The rating tokens the scene flies itself: the up legs it plays (0 for a rival's view). */
  rating: number;
  /** The ocean the fall took off the board — its departure is the tile scene's; the ocean leg waits for it. */
  removed?: string;
};

/**
 * The records NEW in this response (in the applied ring, not in the one before), oldest first. A first view
 * (a reload) or another seat's view claims nothing — the ring is a memory, never a script to replay.
 */
export function freshParameterSwings(
  before: ReadonlyArray<ParameterSwingModel> | undefined,
  after: ReadonlyArray<ParameterSwingModel> | undefined,
  hadBefore: boolean,
): Array<ParameterSwingModel> {
  if (!hadBefore || after === undefined || after.length === 0) {
    return [];
  }
  const known = new Set((before ?? []).map((r) => r.seq));
  return after.filter((r) => !known.has(r.seq)).sort((a, b) => a.seq - b.seq);
}

function valueOf(game: GameModel, key: keyof HeldGlobalParams): number {
  return game[key];
}

/**
 * THE PLAN of one record against the previous view (`seen`) and the applied one (`live`). Pure. The previous
 * view, never the park's held values: a raise the park still holds is the park's own story (its drain glides it
 * and the scale beat flies its rating), and this scene's fall waits for that drain before it starts.
 */
export function swingPlanOf(record: ParameterSwingModel, seen: HeldGlobalParams, live: GameModel, viewer: Color | undefined): SwingPlan {
  const legs: Array<SwingLeg> = [];
  const start: Partial<HeldGlobalParams> = {};
  let rating = 0;
  const own = viewer !== undefined && viewer === record.player;
  for (const up of record.up) {
    const p = swingParamOf(up.parameter);
    const shown = seen[p.key];
    const now = valueOf(live, p.key);
    // The scene plays the raise only when NOTHING shows the peak: the player has not seen it, and the applied
    // view does not glide there by itself (the fall arrived with it). Else it is the ordinary scale beat's.
    if (shown < up.after && now < up.after) {
      legs.push({...p, kind: 'up', from: shown, to: up.after, tr: up.tr});
      start[p.key] = shown;
      if (own) {
        rating += up.tr;
      }
    }
  }
  for (const down of record.down) {
    const p = swingParamOf(down.parameter);
    if ('atMax' in down) {
      legs.push({...p, kind: 'max', at: down.at});
      continue;
    }
    if ('atMin' in down) {
      legs.push({...p, kind: 'min', at: down.at});
      continue;
    }
    // A fall the applied view does not end on is not this record's to tell (a later response moved it again).
    if (valueOf(live, p.key) !== down.after) {
      continue;
    }
    legs.push({...p, kind: 'down', from: down.before, to: down.after});
    if (start[p.key] === undefined) {
      start[p.key] = down.before;
    }
  }
  return {
    seq: record.seq,
    player: record.player,
    own,
    legs,
    start,
    rating,
    ...(record.removed !== undefined ? {removed: record.removed.space} : {}),
  };
}

/** Does the plan move anything or name anything (a plan of no legs is not played at all)? */
export function swingPlanPlays(plan: SwingPlan): boolean {
  return plan.legs.length > 0;
}

/** The tag a leg wears at its marker: the fall's «−N · РТ остаётся», a limit's «МАКС» / «МИН». The raise wears none. */
export type SwingTagKind = 'down' | 'max' | 'min';

export function swingTagOf(leg: SwingLeg): {kind: SwingTagKind, amount: number, unit: string} | undefined {
  switch (leg.kind) {
  // The amount in the SCALE's own unit (the temperature falls 2 °C a step) — the number the marker's dial prints.
  case 'down': return {kind: 'down', amount: leg.from - leg.to, unit: leg.unit};
  case 'max': return {kind: 'max', amount: 0, unit: ''};
  case 'min': return {kind: 'min', amount: 0, unit: ''};
  default: return undefined;
  }
}

/** The beat between two legs — the eye moves to the next marker; never a lag. */
export const SWING_LEG_GAP_MS = 220;
/** A limit named in place reads for this long (no motion to wait for). */
export const SWING_LIMIT_READ_MS = 700;
/** The longest a leg waits for its marker's arrival before it moves on (the scene can never wedge). */
export const SWING_ARRIVAL_MAX_MS = 2600;
/** A rail-less leg (the ocean count) waits for the HUD's flip instead of a marker. */
export const SWING_HUD_FLIP_MS = 640;
/** The tags stand for one read after the last leg, then the scene lets go. */
export const SWING_READ_MS = 1100;
/** The longest the scene waits for its stage (a board the player can see) before it degrades honestly. */
export const SWING_STAGE_DUE_MS = 40_000;
