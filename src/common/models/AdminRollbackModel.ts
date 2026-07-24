import {Color} from '../Color';
import {GameId} from '../Types';
import {Phase} from '../Phase';

/**
 * Payloads for the dev-only admin game-rollback tool (console main-menu plate,
 * name-gated on {@link ../utils/adminName.ADMIN_NAME}). A game's state is stored
 * as a growing series of SAVE points (`saveId`); rolling back deletes the saves
 * ahead of a chosen point and reloads the game there. See the server routes
 * `ApiAdminRollbackGames` / `ApiAdminRollbackHistory` / `ApiAdminRollback`.
 */

export type AdminRollbackPlayer = {
  name: string;
  color: Color;
};

/** One game in the rollback picker. The generation is FRESH (authoritative). */
export type AdminRollbackGameSummary = {
  id: GameId;
  name: string;
  phase: Phase;
  /**
   * The CURRENT generation of the game, read from the authoritative in-memory
   * instance (never a stale cached list value) — so a game whose generation
   * advanced since the list was last shown reflects the real value on open.
   */
  generation: number;
  players: ReadonlyArray<AdminRollbackPlayer>;
  createdTimeMs: number;
};

/** One persisted save point of a game (its generation + phase at that save). */
export type AdminRollbackSave = {
  saveId: number;
  generation: number;
  phase: Phase;
};

/** The full save history of one game — the rollback detail-view payload. */
export type AdminRollbackHistory = {
  id: GameId;
  name: string;
  /** The latest (current) save id. */
  currentSaveId: number;
  /** The generation at the latest save. */
  currentGeneration: number;
  /** Every persisted save, ascending by `saveId`. */
  saves: ReadonlyArray<AdminRollbackSave>;
};

/** The game's fresh state after a rollback. */
export type AdminRollbackResult = {
  id: GameId;
  /** The save the game was restored to. */
  saveId: number;
  generation: number;
  phase: Phase;
  /** The new latest save id (equals {@link saveId}). */
  currentSaveId: number;
  /** How many save points were deleted. */
  deletedSaves: number;
};
