/*
 * A PARAMETER MOVE, AND THE ROOM IT HAS (Turmoil Redux).
 *
 * TWO parts of an enactment move a global parameter, and both are read by the
 * SAME model — never by two:
 *
 *   · the WINNER'S TILE, whose own placement raises one step (Aquifer Contest
 *     an ocean, Biodome Contest oxygen) — `winnerReward.ts` declares the tile,
 *     the move is what the tile does;
 *   · a WORLD MOVE, which the enactment makes for the whole table and for
 *     nobody in particular (Gas Export: oxygen −1 step, Venus +2 steps, and
 *     no one gets the TR) — `ResolutionDefinition.worldMoves` declares it.
 *
 * WHAT A READING MAY HONESTLY SAY BEFORE THE ENACTMENT is the parameter's
 * ROOM: where it stands, where the declared steps would take it, and whether
 * the ceiling (or the floor) eats some of them. A move at its limit is NOT a
 * silent nothing — `applied: 0` with `atLimit: true` is exactly the sentence
 * the surface prints («кислород на максимуме: не понижается»).
 *
 * Pure, shared by the server (the step that pays, the contract guard) and the
 * client (the vote reading, the sitting's stage, the results, the stand). No
 * i18n, no DOM: every label is the reader's.
 */
import {
  MAX_OCEAN_TILES, MAX_OXYGEN_LEVEL, MAX_TEMPERATURE, MAX_VENUS_SCALE,
  MIN_OXYGEN_LEVEL, MIN_TEMPERATURE, MIN_VENUS_SCALE,
  OXYGEN_LEVEL_FOR_TEMPERATURE_BONUS,
} from '../constants';

/** Every global parameter a resolution can move — the winner's tile moves two of them, a world move any. */
export type ParameterMoveId = 'oxygen' | 'oceans' | 'venus' | 'temperature';

export const PARAMETER_MOVE_IDS: ReadonlyArray<ParameterMoveId> = ['oxygen', 'oceans', 'venus', 'temperature'];

/**
 * A WORLD MOVE as data: the enactment moves `parameter` by `steps` (negative
 * LOWERS it), and `terraformRating` says whether anybody is credited for it.
 *
 * `terraformRating: false` is the World Government's own mode asked for
 * explicitly (`IGame.increaseVenusScaleLevel(player, n, {unrewarded: true})`):
 * no TR for anyone, no track bonus, a crossed threshold claimed neutrally.
 * A lowering never pays a rating at all, so it always declares `false`.
 */
export type WorldParameterMove = {
  parameter: ParameterMoveId;
  steps: number;
  terraformRating: boolean;
};

/** The table facts a room reads — the game model's globals, as every surface already has them. */
export type ParameterTable = {
  oxygenLevel: number;
  temperature: number;
  oceans: number;
  /** Absent in a game without Venus Next — a Venus move is then simply impossible. */
  venusScaleLevel?: number;
};

/** How big ONE step of a parameter is on its own scale (Venus and temperature move 2 per step). */
export function parameterStepSize(parameter: ParameterMoveId): number {
  return parameter === 'venus' || parameter === 'temperature' ? 2 : 1;
}

export type ParameterBounds = {min: number; max: number};

export function parameterBounds(parameter: ParameterMoveId): ParameterBounds {
  switch (parameter) {
  case 'oxygen': return {min: MIN_OXYGEN_LEVEL, max: MAX_OXYGEN_LEVEL};
  case 'oceans': return {min: 0, max: MAX_OCEAN_TILES};
  case 'venus': return {min: MIN_VENUS_SCALE, max: MAX_VENUS_SCALE};
  case 'temperature': return {min: MIN_TEMPERATURE, max: MAX_TEMPERATURE};
  }
}

export function parameterValue(parameter: ParameterMoveId, table: ParameterTable): number {
  switch (parameter) {
  case 'oxygen': return table.oxygenLevel;
  case 'oceans': return table.oceans;
  case 'venus': return table.venusScaleLevel ?? 0;
  case 'temperature': return table.temperature;
  }
}

/** WHAT A DECLARED MOVE WOULD DO TO ITS PARAMETER RIGHT NOW. */
export type ParameterRoom = {
  parameter: ParameterMoveId;
  /** Where the parameter stands (in its own units — 5 % oxygen, 10 % Venus, −30 °C). */
  current: number;
  min: number;
  max: number;
  /** The steps the move ASKS for (negative lowers). */
  steps: number;
  /** …and the steps it would actually make, cut by the ceiling / the floor. */
  applied: number;
  /** The parameter moves at all. */
  moves: boolean;
  /** Nothing moves because the parameter already sits at the limit the move pushes towards. */
  atLimit: boolean;
  /** The value reached (== current when nothing moves). */
  resulting: number;
  /** A RAISE of oxygen through 8 % sets the temperature off one step too (while it can). */
  temperatureBonus: boolean;
};

/**
 * The room of ONE move against ONE table. Pure arithmetic over the engine's
 * own bounds — never a rule of its own: a raise stops at the ceiling, a
 * lowering at the floor, and Venus / temperature count 2 per step.
 */
export function parameterRoom(move: {parameter: ParameterMoveId; steps: number}, table: ParameterTable): ParameterRoom {
  const {parameter, steps} = move;
  const {min, max} = parameterBounds(parameter);
  const current = parameterValue(parameter, table);
  const size = parameterStepSize(parameter);
  const room = steps >= 0 ? (max - current) / size : (current - min) / size;
  const applied = steps >= 0 ? Math.min(steps, Math.floor(room)) : -Math.min(-steps, Math.floor(room));
  const resulting = current + applied * size;
  return {
    parameter,
    current,
    min,
    max,
    steps,
    applied,
    moves: applied !== 0,
    atLimit: applied === 0,
    resulting,
    temperatureBonus: parameter === 'oxygen' && applied > 0 &&
      current < OXYGEN_LEVEL_FOR_TEMPERATURE_BONUS && resulting >= OXYGEN_LEVEL_FOR_TEMPERATURE_BONUS &&
      table.temperature < MAX_TEMPERATURE,
  };
}

/**
 * The TR the move's steps are worth to whoever makes it: one per step when the
 * move is rewarded, none when it is not (the law that terraforms for nobody)
 * and none for a lowering. The temperature step an oxygen raise sets off is
 * the tile reading's own business (`winnerReward.ts`) — a world move declares
 * its steps and nothing else.
 */
export function parameterMoveTr(move: WorldParameterMove, room: ParameterRoom): number {
  return move.terraformRating && room.applied > 0 ? room.applied : 0;
}
