import {IPlayer} from '../IPlayer';
import {AppError} from '../server/AppError';
import {STALE_PROMPT} from '../../common/app/AppErrorId';

/**
 * THE PROMPT IDENTITY GATE, shared by `/player/input` and `/player/input-batch`.
 *
 * Every waitingFor model carries the prompt's server-side serial (`promptId`,
 * stamped in `ServerModel.getWaitingFor` from `Player.waitingForSerial`), and
 * the client echoes it with every submit. A mismatch means the answer was
 * prepared against a prompt the server NO LONGER HOLDS — the standing case is
 * a game reloaded after cache eviction (loadState re-runs `takeAction()`,
 * rebuilding the action menu), plus undo restores and the bot's paced turn.
 *
 * Without this gate such a submit was applied to WHATEVER prompt stands now:
 * at best a confusing `InputError` («Unknown card name Atmoscoop» — the
 * 2026-09-05 field report, where the rebuilt play offer no longer listed the
 * card the player was shown), at worst a silently executed WRONG OrOptions
 * branch, because branch responses address options by INDEX. Refusing with a
 * structured `STALE_PROMPT` lets the client auto-refresh and the player retry
 * against fresh state.
 *
 * The stamp is OPTIONAL on the wire (older clients / tests submit without
 * one) and is consumed here — like `runId`, it must not reach the input
 * response processors.
 */
export function validatePromptId(entity: {promptId?: unknown}, player: IPlayer): void {
  const promptId = entity.promptId;
  delete entity.promptId;
  if (promptId === undefined) {
    return;
  }
  if (typeof promptId !== 'number') {
    return;
  }
  const waitingFor = player.getWaitingFor();
  if (waitingFor === undefined || promptId !== player.waitingForSerial) {
    // Attribution breadcrumb: the whole point of this gate is that the NEXT
    // occurrence of a client/server prompt divergence names its producer in
    // the server log instead of surfacing as a cryptic InputError. Keep it
    // one line and structural (no titles — they are translatable Messages).
    console.warn(
      `[stale-prompt] player ${player.id} submitted against prompt #${promptId}; ` +
      `server holds ${waitingFor === undefined ? 'NO prompt' : `#${player.waitingForSerial} (${waitingFor.type})`} — ` +
      `gameAge=${player.game.gameAge} undoCount=${player.game.undoCount} phase=${player.game.phase}`);
    throw new AppError(STALE_PROMPT, 'The game state has changed. Your last action was not applied — please try again.');
  }
}
