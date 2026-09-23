/*
 * THE WINNER'S PART OF AN ENACTMENT, AS DATA (Turmoil Redux).
 *
 * Several resolutions give the player who WON the vote something on top of the
 * effect every participant receives: Aquifer Contest an ocean, Biodome Contest
 * a greenery that raises oxygen 1 step, Colony Contest a COLONY built for free.
 * The sentence lives in the catalog (`text.winner`); the DATA lives here, so
 * every surface that has to say «what does the winner get, and what will it do
 * to the table right now» reads ONE declaration and the SAME rules the engine
 * pays by — never a per-card table, never a re-derived number:
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
 *     is only WHO builds; after it, WHERE the cube landed.
 *
 * Nothing here promises the CELL or the TILE: its printed bonuses, its
 * adjacency and the reactions it sets off belong to the placement dossier /
 * the colony's own screen — a surface that has no cell yet names none of them.
 */
import {MAX_OCEAN_TILES, MAX_OXYGEN_LEVEL, MAX_TEMPERATURE, OXYGEN_LEVEL_FOR_TEMPERATURE_BONUS} from '../constants';

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

export type WinnerRewardDeclaration = WinnerTileReward | WinnerColonyReward;

export function isWinnerTileReward(reward: WinnerRewardDeclaration): reward is WinnerTileReward {
  return reward.kind === 'tile';
}

/** The global parameter a winner tile's own placement moves. */
export type WinnerRewardParameter = 'oxygen' | 'oceans';

/** The parameter a winner TILE moves; a colony moves none. */
export function winnerRewardParameter(reward: WinnerRewardDeclaration): WinnerRewardParameter | undefined {
  if (!isWinnerTileReward(reward)) {
    return undefined;
  }
  return reward.tile === 'greenery' ? 'oxygen' : 'oceans';
}

/** The table facts the reading needs (the game model's globals). */
export type WinnerRewardTable = {
  oxygenLevel: number;
  temperature: number;
  oceans: number;
};

/** What the tile's own placement does to its parameter RIGHT NOW. */
export type WinnerParameterRoom = {
  parameter: WinnerRewardParameter;
  current: number;
  max: number;
  /** The placement moves the parameter one step (false once it is at its maximum). */
  rises: boolean;
  /** The step reached (== current when it does not rise). */
  resulting: number;
  /**
   * The tile itself can still be placed at all, cells permitting: a greenery
   * always can (a maxed oxygen only stops its raise), an ocean needs a tile
   * left in the supply.
   */
  tileAvailable: boolean;
  /** Oxygen reaches its 8 % bonus step: the temperature rises one step too (while it can). */
  temperatureBonus: boolean;
};

export function winnerParameterRoom(reward: WinnerTileReward, table: WinnerRewardTable): WinnerParameterRoom {
  if (reward.tile === 'greenery') {
    const current = table.oxygenLevel;
    const rises = current < MAX_OXYGEN_LEVEL;
    const resulting = rises ? current + 1 : current;
    return {
      parameter: 'oxygen',
      current,
      max: MAX_OXYGEN_LEVEL,
      rises,
      resulting,
      tileAvailable: true,
      temperatureBonus: rises && current < OXYGEN_LEVEL_FOR_TEMPERATURE_BONUS && resulting >= OXYGEN_LEVEL_FOR_TEMPERATURE_BONUS &&
        table.temperature < MAX_TEMPERATURE,
    };
  }
  const current = table.oceans;
  const rises = current < MAX_OCEAN_TILES;
  return {
    parameter: 'oceans',
    current,
    max: MAX_OCEAN_TILES,
    rises,
    resulting: rises ? current + 1 : current,
    tileAvailable: rises,
    temperatureBonus: false,
  };
}

/**
 * The TR the tile is worth before its cell is known: the tile's own (the
 * greenery revision), the parameter step it makes, and the temperature step
 * an oxygen raise to 8 % sets off (`Game.increaseOxygenLevel`). Anything the
 * CELL adds — and whatever that temperature step sets off in turn — is the
 * placement dossier's to name.
 */
export type WinnerRewardTr = {tile: number; parameter: number; temperature: number};

export function winnerRewardTr(reward: WinnerTileReward, room: Pick<WinnerParameterRoom, 'rises' | 'tileAvailable' | 'temperatureBonus'>): WinnerRewardTr {
  if (!room.tileAvailable) {
    return {tile: 0, parameter: 0, temperature: 0};
  }
  return {
    tile: reward.tile === 'greenery' ? REDUX_GREENERY_TILE_TR : 0,
    parameter: room.rises ? 1 : 0,
    temperature: room.temperatureBonus ? 1 : 0,
  };
}

export function winnerRewardTrTotal(tr: WinnerRewardTr): number {
  return tr.tile + tr.parameter + tr.temperature;
}
