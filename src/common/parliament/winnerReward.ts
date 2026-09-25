/*
 * THE WINNER'S PART OF AN ENACTMENT, AS DATA (Turmoil Redux).
 *
 * Several resolutions give the player who WON the vote something on top of the
 * effect every participant receives: Aquifer Contest an ocean, Biodome Contest
 * a greenery that raises oxygen 1 step, Colony Contest a COLONY built for free,
 * Mohole Contest a STEP of a global parameter with no tile at all (the
 * temperature, 2 steps). The sentence lives in the catalog (`text.winner`);
 * the DATA lives here, so every surface that has to say «what does the winner
 * get, and what will it do to the table right now» reads ONE declaration and
 * the SAME rules the engine pays by — never a per-card table, never a
 * re-derived number:
 *
 *   · a TILE and the global parameter its OWN placement moves — exactly one
 *     step: «places a greenery tile and raises Oxygen 1 step» is the greenery's
 *     own raise (`Game.addGreenery`), never a second one on top of it;
 *   · the Redux greenery revision's TR for the tile itself
 *     (`REDUX_GREENERY_TILE_TR` — the constant `ParliamentHandler
 *     .onGreeneryPlaced` pays), which stands with oxygen at its maximum too;
 *   · the parameter's ROOM (`winnerParameterRoom`): a maxed oxygen no longer
 *     rises (the greenery still lands and still pays its own TR); no ocean
 *     left means no ocean at all;
 *   · a COLONY moves no global parameter and has no room to read: it is ONE
 *     standard build (`BuildColony`) on a tile the ordinary rules allow — the
 *     tile's own BUILD BONUS is paid by the colony, no M€ change hands, no
 *     trade fleet is spent. What the reading can honestly say before the pick
 *     is only WHO builds; after it, WHERE the cube landed;
 *   · a PARAMETER STEP (Mohole Contest, RX23) is the winner RAISING the
 *     parameter exactly as a player's own card would — REWARDED, unlike a
 *     world move: +1 TR per step actually made, the track's own bonuses on the
 *     way (the −24 / −20 °C heat production, the 0 °C ocean), the winner's own
 *     card hooks. The ceiling cuts the steps and the reading says so («at its
 *     maximum — no step»); the ROOM is the same arithmetic a world move and a
 *     tile read (`parameterRoom`), never a second calculation. The step is
 *     paid by the family's ONE shared executor (`WinnerParameterStep.ts`) —
 *     a card declares the data and the step is derived from it.
 *
 * Nothing here promises the CELL or the TILE: its printed bonuses, its
 * adjacency and the reactions it sets off belong to the placement dossier /
 * the colony's own screen — a surface that has no cell yet names none of them.
 * The 0 °C ocean a temperature step sets off is a placement of ITS OWN (the
 * engine's follow-up): the reading says that one follows, and nothing about
 * where it lands or what its cell pays.
 */
import {ParameterMoveId, ParameterTable, parameterRoom} from './parameterMove';

/** The Turmoil Redux greenery revision (rulebook p.3): a greenery is worth 1 TR for the tile itself, on top of its oxygen. */
export const REDUX_GREENERY_TILE_TR = 1;

export type WinnerTileKind = 'greenery' | 'ocean';

/** The winner's part: ONE tile, through the standard placement (no cost, no action spent). */
export type WinnerTileReward = {
  kind: 'tile';
  tile: WinnerTileKind;
};

/**
 * The winner's part: ONE COLONY, built for free through the standard build
 * (Colony Contest, RX09) — the ordinary availability (an ACTIVE tile that is
 * not full and holds none of the winner's cubes), the tile's own build bonus,
 * no M€, no trade fleet, no action counted.
 */
export type WinnerColonyReward = {
  kind: 'colony';
};

/**
 * The parameters a winner can RAISE DIRECTLY — every scale but the oceans (an
 * ocean is a TILE, and a tile is `WinnerTileReward`).
 */
export type WinnerStepParameter = Exclude<ParameterMoveId, 'oceans'>;

/**
 * The winner's part: a DIRECT STEP of a global parameter (Mohole Contest,
 * RX23: «increases the global temperature 2 steps») — no tile, no cell. The
 * winner makes the step as a player would, and is REWARDED for it (the
 * declaration has no `terraformRating` switch on purpose: a step credited to
 * nobody is a WORLD move, `worldMoves`, never the winner's part).
 */
export type WinnerParameterReward = {
  kind: 'parameter';
  parameter: WinnerStepParameter;
  /** The steps the part ASKS for (a positive whole number); the ceiling may cut them. */
  steps: number;
};

export type WinnerRewardDeclaration = WinnerTileReward | WinnerColonyReward | WinnerParameterReward;

export function isWinnerTileReward(reward: WinnerRewardDeclaration): reward is WinnerTileReward {
  return reward.kind === 'tile';
}

export function isWinnerParameterReward(reward: WinnerRewardDeclaration): reward is WinnerParameterReward {
  return reward.kind === 'parameter';
}

/** The parts that MOVE a global parameter (a tile's own placement, a direct step) — the ones a room is read for. */
export type WinnerParameterMover = WinnerTileReward | WinnerParameterReward;

export function isWinnerParameterMover(reward: WinnerRewardDeclaration): reward is WinnerParameterMover {
  return reward.kind === 'tile' || reward.kind === 'parameter';
}

/**
 * The global parameter a winner part moves — the shared `ParameterMoveId`, so
 * the winner's reading and a world move speak one vocabulary. A tile moves
 * the parameter its own placement moves; a direct step names its own.
 */
export type WinnerRewardParameter = ParameterMoveId;

/** The parameter a winner part moves; a colony moves none. */
export function winnerRewardParameter(reward: WinnerRewardDeclaration): WinnerRewardParameter | undefined {
  switch (reward.kind) {
  case 'tile': return reward.tile === 'greenery' ? 'oxygen' : 'oceans';
  case 'parameter': return reward.parameter;
  case 'colony': return undefined;
  }
}

/**
 * THE STEP KEY of a winner part paid by the SHARED executor — the parameter's
 * own id, so the driver's record, the guard and every reading of «the
 * winner's step» name the same thing without a per-card table. (A tile's step
 * is the card's own: `ocean` / `greenery`; a colony's `colony`.)
 */
export function winnerParameterStepKey(reward: WinnerParameterReward): string {
  return reward.parameter;
}

/** The table facts the reading needs (the game model's globals). */
export type WinnerRewardTable = ParameterTable;

/** What the winner part does to its parameter RIGHT NOW (a tile's own placement, or the direct step). */
export type WinnerParameterRoom = {
  parameter: WinnerRewardParameter;
  current: number;
  max: number;
  /** The steps the part ASKS for (a tile: 1). */
  steps: number;
  /** …and the steps it actually makes, cut by the ceiling (a tile: 0 or 1). */
  applied: number;
  /** The part moves the parameter at all (false once it is at its maximum). */
  rises: boolean;
  /** The value reached (== current when it does not rise). */
  resulting: number;
  /**
   * The tile itself can still be placed at all, cells permitting: a greenery
   * always can (a maxed oxygen only stops its raise), an ocean needs a tile
   * left in the supply. A direct step has nothing to place: always true.
   */
  tileAvailable: boolean;
  /** Oxygen reaches its 8 % bonus step: the temperature rises one step too (while it can). */
  temperatureBonus: boolean;
  /** A temperature RAISE crosses this many of the heat-production thresholds (−24 / −20 °C). */
  heatProductionBonus: number;
  /** A temperature raise reaches 0 °C: an ocean placement follows (while a tile is left). */
  oceanBonus: boolean;
};

/**
 * THE WINNER PART'S OWN MOVE, read through the SHARED model (`parameterMove
 * .parameterRoom`) — one arithmetic for the tile, for the direct step and for
 * a world move; this function only adds what belongs to a TILE (can it be
 * placed at all).
 */
export function winnerParameterRoom(reward: WinnerParameterMover, table: WinnerRewardTable): WinnerParameterRoom {
  const parameter = winnerRewardParameter(reward) as WinnerRewardParameter;
  const steps = reward.kind === 'tile' ? 1 : reward.steps;
  const room = parameterRoom({parameter, steps}, table);
  return {
    parameter,
    current: room.current,
    max: room.max,
    steps,
    applied: room.applied,
    rises: room.moves,
    resulting: room.resulting,
    // A greenery always lands (a maxed oxygen only stops its raise); an ocean needs a tile left in the
    // supply; a direct step places nothing.
    tileAvailable: reward.kind === 'parameter' || parameter === 'oxygen' ? true : room.moves,
    temperatureBonus: room.temperatureBonus,
    heatProductionBonus: room.heatProductionBonus,
    oceanBonus: room.oceanBonus,
  };
}

/**
 * The TR the part is worth before its cell is known: the tile's own (the
 * greenery revision), the parameter steps it makes, and the temperature step
 * an oxygen raise to 8 % sets off (`Game.increaseOxygenLevel`). Anything the
 * CELL adds — and whatever that temperature step sets off in turn, the 0 °C
 * ocean's own TR included — is the placement dossier's to name.
 */
export type WinnerRewardTr = {tile: number; parameter: number; temperature: number};

export function winnerRewardTr(reward: WinnerParameterMover, room: Pick<WinnerParameterRoom, 'applied' | 'tileAvailable' | 'temperatureBonus'>): WinnerRewardTr {
  if (!room.tileAvailable) {
    return {tile: 0, parameter: 0, temperature: 0};
  }
  return {
    tile: reward.kind === 'tile' && reward.tile === 'greenery' ? REDUX_GREENERY_TILE_TR : 0,
    parameter: Math.max(0, room.applied),
    temperature: room.temperatureBonus ? 1 : 0,
  };
}

export function winnerRewardTrTotal(tr: WinnerRewardTr): number {
  return tr.tile + tr.parameter + tr.temperature;
}
