import {IGame} from '../IGame';
import {SerializedGame} from '../SerializedGame';
import {AdminRollbackGameSummary, AdminRollbackSave} from '../../common/models/AdminRollbackModel';
import {isAdminName} from '../../common/utils/adminName';
import {isLoopbackIp} from '../routes/ApiLocalGameDelete';

/**
 * May this request use the game-rollback tool?
 *
 * Two doors, either suffices:
 *  - a LOOPBACK connection — the machine's owner rolling back games hosted on
 *    their own device (the same connection-is-the-authorization model as
 *    {@link isLoopbackIp}'s home, ApiLocalGameDelete: a LAN guest must not be
 *    able to rewind the host's games, while the host owns them like files);
 *  - the ADMIN_NAME soft identity — the pre-existing dev door, usable from a
 *    remote browser against a dev server.
 */
export function rollbackAuthorized(ip: string, name: string | null | undefined): boolean {
  return isLoopbackIp(ip) || isAdminName(name);
}

/**
 * Build an {@link AdminRollbackGameSummary} from the AUTHORITATIVE in-memory
 * game — so the generation shown is always the game's real current generation,
 * never a stale list value.
 */
export function buildAdminGameSummary(game: IGame): AdminRollbackGameSummary {
  return {
    id: game.id,
    name: game.name,
    phase: game.phase,
    generation: game.getGeneration(),
    players: game.playersInGenerationOrder.map((p) => ({name: p.name, color: p.color})),
    createdTimeMs: game.createdTime.getTime(),
  };
}

/** Build one save-history row from a serialized game version. */
export function serializedSaveEntry(serialized: SerializedGame, saveId: number): AdminRollbackSave {
  return {
    saveId,
    generation: serialized.generation,
    phase: serialized.phase,
  };
}

/**
 * Number of save rows to delete so that `targetSaveId` becomes the latest save:
 * every persisted save STRICTLY GREATER than the target.
 *
 * This is derived from the persisted save-id set (never the in-memory
 * `lastSaveId`), so it is deterministic regardless of whether the game is
 * mid-turn or idle — unlike `GameLoader.restoreGameAt`, whose delete count is
 * `lastSaveId - saveId - 1` and therefore lands one save off for an idle
 * (freshly-loaded, not-yet-re-saved) game. `deleteGameNbrSaves` removes the
 * top-N by `save_id DESC`, which are exactly those N saves above the target
 * (the target itself is in the set), leaving the target as the new latest save.
 */
export function savesToDelete(saveIds: ReadonlyArray<number>, targetSaveId: number): number {
  return saveIds.filter((id) => id > targetSaveId).length;
}
