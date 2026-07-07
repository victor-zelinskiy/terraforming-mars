import {MarsBotTurnStep} from '../../common/automa/MarsBotTurn';
import {IGame} from '../IGame';

/**
 * Records the typed script of a MarsBot turn (see `MarsBotTurn` in common) —
 * the data feed of the client "turn theater".
 *
 * The recorder interleaves two sources, preserving order:
 *   • typed steps noted explicitly by the resolver (reveal / tag / advance /
 *     failed / pass), and
 *   • every PUBLIC `game.log` line emitted while the turn resolves (tile
 *     placements, TR gains, milestone claims, human on-tile triggers, …),
 *     flushed as `{kind: 'log'}` steps before each typed step and at finish.
 *
 * `consumeLog: true` attaches the just-emitted log line to the typed step
 * itself (reveal / failed / pass log their own headline) so the theater never
 * shows the same fact twice while the journal keeps its full record.
 *
 * Outside an active recording every call is a no-op — track advances that
 * happen during the HUMAN's turn (storage exchange after a trade, …) stay
 * journal-only, exactly as before.
 */
export class AutomaTurnLog {
  public static begin(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined) {
      throw new Error('Not an automa game');
    }
    automa.turnCounter++;
    automa.turnRecording = {steps: [], logIndex: game.gameLog.length};
  }

  public static note(game: IGame, step: MarsBotTurnStep, opts?: {consumeLog?: boolean}): void {
    const recording = game.automa?.turnRecording;
    if (recording === undefined) {
      return;
    }
    const fresh = AutomaTurnLog.takeFreshLogs(game);
    if (opts?.consumeLog === true && fresh.length > 0) {
      const own = fresh.pop();
      if (own !== undefined && (step.kind === 'reveal' || step.kind === 'failed' || step.kind === 'pass')) {
        step.message = own;
      }
    }
    for (const message of fresh) {
      recording.steps.push({kind: 'log', message});
    }
    recording.steps.push(step);
  }

  public static finish(game: IGame): void {
    const automa = game.automa;
    const recording = automa?.turnRecording;
    if (automa === undefined || recording === undefined) {
      return;
    }
    for (const message of AutomaTurnLog.takeFreshLogs(game)) {
      recording.steps.push({kind: 'log', message});
    }
    automa.lastTurn = {id: automa.turnCounter, generation: game.generation, steps: recording.steps};
    automa.turnRecording = undefined;
  }

  /** The public log lines emitted since the last flush (private ones never leave the server). */
  private static takeFreshLogs(game: IGame) {
    const recording = game.automa?.turnRecording;
    if (recording === undefined) {
      return [];
    }
    const fresh = game.gameLog.slice(recording.logIndex).filter((m) => m.playerId === undefined);
    recording.logIndex = game.gameLog.length;
    return fresh;
  }
}
