import {Color} from '../../common/Color';
import {Resource} from '../../common/Resource';
import {MarsBotImpactChange, MarsBotTurnStep} from '../../common/automa/MarsBotTurn';
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';

/** The in-flight recording of one bot turn (lives on `AutomaState.turnRecording`). */
export type MarsBotTurnRecording = {
  steps: Array<MarsBotTurnStep>;
  logIndex: number;
  snapshots: ReadonlyArray<PlayerSnapshot>;
};

/** The values snapshotted around the whole turn to derive the impact steps. */
type PlayerSnapshot = {
  color: Color;
  isBot: boolean;
  stock: Record<Resource, number>;
  production: Record<Resource, number>;
  tr: number;
};

const RESOURCES: ReadonlyArray<Resource> = [
  Resource.MEGACREDITS, Resource.STEEL, Resource.TITANIUM,
  Resource.PLANTS, Resource.ENERGY, Resource.HEAT,
];

function snapshotOf(player: IPlayer): PlayerSnapshot {
  const stock = {} as Record<Resource, number>;
  const production = {} as Record<Resource, number>;
  for (const resource of RESOURCES) {
    stock[resource] = player.stock.get(resource);
    production[resource] = player.production.get(resource);
  }
  return {color: player.color, isBot: player.isMarsBot === true, stock, production, tr: player.terraformRating};
}

function diffOf(before: PlayerSnapshot, player: IPlayer): Array<MarsBotImpactChange> {
  const after = snapshotOf(player);
  const changes: Array<MarsBotImpactChange> = [];
  for (const resource of RESOURCES) {
    if (after.stock[resource] !== before.stock[resource]) {
      changes.push({resource, scope: 'stock', before: before.stock[resource], after: after.stock[resource]});
    }
  }
  for (const resource of RESOURCES) {
    if (after.production[resource] !== before.production[resource]) {
      changes.push({resource, scope: 'production', before: before.production[resource], after: after.production[resource]});
    }
  }
  if (after.tr !== before.tr) {
    changes.push({resource: 'tr', scope: 'stock', before: before.tr, after: after.tr});
  }
  return changes;
}

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
    automa.turnRecording = {
      steps: [],
      logIndex: game.gameLog.length,
      // Whole-turn per-player snapshots: the finish() diff turns them into
      // explicit "before → after" impact steps for every affected participant
      // (the target of an attack, the bot's own gains). Snapshot-based, so any
      // mechanic is covered without per-site instrumentation.
      snapshots: game.players.map(snapshotOf),
    };
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
    // The "turn results" section: one impact step per participant the turn
    // actually touched — the bot's own gains first, then its targets.
    const impacts = recording.snapshots
      .map((snapshot) => {
        const player = game.players.find((p) => p.color === snapshot.color);
        return player === undefined ? undefined : {
          target: snapshot.color,
          targetIsBot: snapshot.isBot,
          changes: diffOf(snapshot, player),
        };
      })
      .filter((impact): impact is NonNullable<typeof impact> => impact !== undefined && impact.changes.length > 0)
      .sort((a, b) => Number(b.targetIsBot) - Number(a.targetIsBot));
    for (const impact of impacts) {
      recording.steps.push({kind: 'impact', impact});
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
