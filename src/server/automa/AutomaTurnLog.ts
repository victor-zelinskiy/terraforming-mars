import {Color} from '../../common/Color';
import {LogMessage} from '../../common/logs/LogMessage';
import {Resource} from '../../common/Resource';
import {TileType} from '../../common/TileType';
import {SpaceId} from '../../common/Types';
import {BonusCardId} from '../../common/automa/AutomaTypes';
import {MarsBotBonusFate, MarsBotBonusResolution, MarsBotImpactChange, MarsBotParamChange, MarsBotStepCause, MarsBotTurn, MarsBotTurnStep, MarsBotTurnTile, MarsBotTurnVisual} from '../../common/automa/MarsBotTurn';
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';

/**
 * How many resolved turn scripts the server keeps (`AutomaState.turnHistory`).
 * Consecutive bot turns can resolve inside ONE human input (the human passed,
 * the bot plays the generation out alone), so `lastTurn` alone loses the
 * intermediate scripts — the history keeps every recent turn addressable for
 * the client's notification queue + the journal's «Осмотреть ход» replay.
 */
export const MAX_TURN_HISTORY = 24;

/** The in-flight recording of one bot turn (lives on `AutomaState.turnRecording`). */
export type MarsBotTurnRecording = {
  steps: Array<MarsBotTurnStep>;
  logIndex: number;
  snapshots: ReadonlyArray<PlayerSnapshot>;
  /** Board-visible state around the whole turn — diffed into `turn.visual`. */
  boardSnapshot: BoardSnapshot;
  /**
   * Phase B: the WHY the resolver is currently attributing steps to (which tag
   * / the bonus effect / a colony trade / the Delta advance). Stamped onto the
   * typed steps + the public log lines flushed under it, so the review groups
   * cause → effect from data. Flushed eagerly on every `setCause` transition
   * so a lazily-flushed log lands under the cause that was live when it fired.
   */
  currentCause?: MarsBotStepCause;
};

/** The board-visible values snapshotted around the turn (for `turn.visual`). */
type BoardSnapshot = {
  temperature: number;
  oxygenLevel: number;
  oceans: number;
  venusScaleLevel: number;
  /** Occupied spaces at turn start (id → tile type). */
  tiles: Map<SpaceId, TileType>;
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

function boardSnapshotOf(game: IGame): BoardSnapshot {
  const tiles = new Map<SpaceId, TileType>();
  for (const space of game.board.spaces) {
    if (space.tile !== undefined) {
      tiles.set(space.id, space.tile.tileType);
    }
  }
  return {
    temperature: game.getTemperature(),
    oxygenLevel: game.getOxygenLevel(),
    oceans: game.board.getOceanSpaces().length,
    venusScaleLevel: game.getVenusScaleLevel(),
    tiles,
  };
}

/**
 * The turn's board-visible footprint: the tiles it placed + the global
 * parameters it moved (before → after). Feeds the client's STAGED visual
 * commits — the presented board/HUD advances turn-by-turn in lockstep with
 * the turn's compact notification. Returns undefined when nothing visible
 * moved (no empty objects in the script).
 */
function boardVisualOf(before: BoardSnapshot, game: IGame): MarsBotTurnVisual | undefined {
  const visual: MarsBotTurnVisual = {};
  const tiles: Array<MarsBotTurnTile> = [];
  for (const space of game.board.spaces) {
    if (space.tile !== undefined && before.tiles.get(space.id) !== space.tile.tileType) {
      tiles.push({
        spaceId: space.id,
        tileType: space.tile.tileType,
        ...(space.player !== undefined ? {color: space.player.color} : {}),
      });
    }
  }
  if (tiles.length > 0) {
    visual.tiles = tiles;
  }
  const param = (b: number, a: number): MarsBotParamChange | undefined =>
    (a !== b ? {before: b, after: a} : undefined);
  const temperature = param(before.temperature, game.getTemperature());
  const oxygenLevel = param(before.oxygenLevel, game.getOxygenLevel());
  const oceans = param(before.oceans, game.board.getOceanSpaces().length);
  const venusScaleLevel = param(before.venusScaleLevel, game.getVenusScaleLevel());
  if (temperature !== undefined) {
    visual.temperature = temperature;
  }
  if (oxygenLevel !== undefined) {
    visual.oxygenLevel = oxygenLevel;
  }
  if (oceans !== undefined) {
    visual.oceans = oceans;
  }
  if (venusScaleLevel !== undefined) {
    visual.venusScaleLevel = venusScaleLevel;
  }
  return Object.keys(visual).length > 0 ? visual : undefined;
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
      // Board-visible snapshot (tiles + global params) → `turn.visual`.
      boardSnapshot: boardSnapshotOf(game),
      currentCause: undefined,
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
      if (own !== undefined && (step.kind === 'reveal' || step.kind === 'failed' || step.kind === 'pass' || step.kind === 'attack')) {
        step.message = own;
      }
    }
    AutomaTurnLog.pushLogs(recording, fresh);
    // Attribute the typed step to the live cause (tag / advance / attack / log
    // carry `cause`; a step that already set its own keeps it).
    if ((step.kind === 'tag' || step.kind === 'advance' || step.kind === 'attack' || step.kind === 'log') &&
        step.cause === undefined && recording.currentCause !== undefined) {
      step.cause = recording.currentCause;
    }
    recording.steps.push(step);
  }

  /**
   * Phase B: switch the cause the resolver attributes subsequent steps to.
   * Flushes the pending public log lines FIRST — under the OUTGOING cause — so
   * a lazily-flushed board-effect line (a tile placement, a Delta advance) is
   * grouped with the effect that produced it, not the next one.
   */
  public static setCause(game: IGame, cause: MarsBotStepCause | undefined): void {
    const recording = game.automa?.turnRecording;
    if (recording === undefined) {
      return;
    }
    AutomaTurnLog.pushLogs(recording, AutomaTurnLog.takeFreshLogs(game));
    recording.currentCause = cause;
  }

  /** Phase B: stamp the resolved fate onto the turn's bonus-card reveal step. */
  public static setBonusFate(game: IGame, fate: MarsBotBonusFate): void {
    AutomaTurnLog.mergeBonusResolution(game, {fate});
  }

  /** The ONE branch the bonus card actually took (an i18n template + params). */
  public static setBonusBranch(game: IGame, branch: {key: string, params?: ReadonlyArray<string>}): void {
    AutomaTurnLog.mergeBonusResolution(game, {branch});
  }

  /** A chained fallback bonus card this one drew (parent → secondary as one flow). */
  public static setBonusSecondary(game: IGame, secondaryCard: BonusCardId): void {
    AutomaTurnLog.mergeBonusResolution(game, {secondaryCard});
  }

  /** Merge into the turn's bonus reveal-step resolution (created lazily; fate defaults). */
  private static mergeBonusResolution(game: IGame, partial: Partial<MarsBotBonusResolution>): void {
    const recording = game.automa?.turnRecording;
    if (recording === undefined) {
      return;
    }
    for (let i = recording.steps.length - 1; i >= 0; i--) {
      const step = recording.steps[i];
      if (step.kind === 'reveal' && step.card.kind === 'bonus') {
        step.resolution = {fate: 'discarded', ...step.resolution, ...partial};
        return;
      }
    }
  }

  /** Push flushed public log lines as `{kind:'log'}` steps, stamped with the live cause. */
  private static pushLogs(recording: MarsBotTurnRecording, messages: ReadonlyArray<LogMessage>): void {
    for (const message of messages) {
      recording.steps.push({kind: 'log', message, ...(recording.currentCause !== undefined ? {cause: recording.currentCause} : {})});
    }
  }

  public static finish(game: IGame): void {
    const automa = game.automa;
    const recording = automa?.turnRecording;
    if (automa === undefined || recording === undefined) {
      return;
    }
    AutomaTurnLog.pushLogs(recording, AutomaTurnLog.takeFreshLogs(game));
    // A change an explicit attack step already narrated (same target, same
    // resource, the EXACT same before → after) would read as a SECOND loss if
    // the results section repeated it — drop only that exact duplicate. A
    // non-matching overlap (another effect also touched the resource this
    // turn) keeps the honest whole-turn net.
    const attacks = recording.steps
      .filter((s): s is Extract<MarsBotTurnStep, {kind: 'attack'}> => s.kind === 'attack');
    const coveredByAttack = (target: Color, change: MarsBotImpactChange): boolean =>
      change.scope === 'stock' && attacks.some((s) =>
        s.attack.target === target && s.attack.resource === change.resource &&
        s.attack.before === change.before && s.attack.after === change.after);
    // The "turn results" section: one impact step per participant the turn
    // actually touched — the bot's own gains first, then its targets.
    const impacts = recording.snapshots
      .map((snapshot) => {
        const player = game.players.find((p) => p.color === snapshot.color);
        return player === undefined ? undefined : {
          target: snapshot.color,
          targetIsBot: snapshot.isBot,
          changes: diffOf(snapshot, player).filter((c) => !coveredByAttack(snapshot.color, c)),
        };
      })
      .filter((impact): impact is NonNullable<typeof impact> => impact !== undefined && impact.changes.length > 0)
      .sort((a, b) => Number(b.targetIsBot) - Number(a.targetIsBot));
    for (const impact of impacts) {
      recording.steps.push({kind: 'impact', impact});
    }
    // The whole turn resolves inside the 'automa-turn' journal scope opened by
    // AutomaController — its root id is the journal group of this turn. Stamp
    // it onto the script so notification / theater / journal share ONE key.
    const correlationId = game.events.captureContext()?.rootId;
    const visual = boardVisualOf(recording.boardSnapshot, game);
    const turn: MarsBotTurn = {
      id: automa.turnCounter,
      generation: game.generation,
      ...(correlationId !== undefined ? {correlationId} : {}),
      ...(visual !== undefined ? {visual} : {}),
      steps: recording.steps,
    };
    automa.lastTurn = turn;
    automa.turnHistory.push(turn);
    if (automa.turnHistory.length > MAX_TURN_HISTORY) {
      automa.turnHistory.splice(0, automa.turnHistory.length - MAX_TURN_HISTORY);
    }
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
