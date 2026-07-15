import {IGame} from '../IGame';
import {GameId} from '../../common/Types';
import {Phase} from '../../common/Phase';
import {botTurnKey} from '../../common/automa/MarsBotTurn';
import {AutomaController} from './AutomaController';
import {RealtimeHub} from '../server/realtime/RealtimeHub';
import {marsBotOf} from './AutomaUtil';

/**
 * Server-authoritative, NON-BLOCKING pacing of MarsBot's turn.
 *
 * The bot used to resolve its whole turn synchronously inside the human's
 * request stack (`Game.startActionsForPlayer` → `AutomaController.takeTurn`),
 * so the model the human received already reflected the post-bot state and no
 * client ever observed the bot as the active player. This scheduler splits that
 * into two server steps with a bounded idle between them:
 *
 *   1. `onBotTurnDue(game)` — mark the turn PENDING, persist + broadcast the
 *      state where the bot IS the active player (its chip reads «Действие»),
 *      and schedule a deferred resolve. Returns immediately — no `sleep`, no
 *      blocked request thread / event loop, no held game lock.
 *   2. after ~1s (extended while clients are still presenting the previous
 *      turn's notification, bounded), `AutomaController.takeTurn` runs and the
 *      result is broadcast. Turn hand-off then proceeds through the ordinary
 *      game loop.
 *
 * The server stays the single source of truth: the client only DISPLAYS the
 * pending/active state and soft-acks when it has seen a turn — it never decides
 * when the bot acts. Every guarantee (idempotency, cancellation, recovery,
 * bounded wait) lives here, keyed by a per-turn session token.
 *
 * DISABLED by default so the whole existing test suite keeps resolving the bot
 * synchronously (identical to before). Production enables it at server start
 * (`server.ts`); a forgotten enable degrades safely to the legacy inline turn.
 */

export const BOT_TURN_INITIAL_DELAY_MS = 200;
export const BOT_TURN_EXTENSION_MS = 500;
export const BOT_TURN_MAX_EXTENSIONS = 3;
/** Bound the per-game unacked-turn map (a game is finite, but be tidy). */
const UNACKED_TURN_CAP = 12;

type TimerHandle = ReturnType<typeof setTimeout>;
type SetTimer = (cb: () => void, ms: number) => TimerHandle;
type ClearTimer = (handle: TimerHandle) => void;
type ConnectedProvider = (gameId: GameId) => ReadonlySet<string>;
type GameProvider = (gameId: GameId) => Promise<IGame | undefined>;

interface PendingSession {
  readonly gameId: GameId;
  /** Unique per pending window — the idempotency / staleness guard. */
  readonly token: number;
  extensions: number;
  timer: TimerHandle | undefined;
}

const EMPTY: ReadonlySet<string> = new Set<string>();

export class BotTurnScheduler {
  private static instance: BotTurnScheduler | undefined;

  private enabled = false;
  private tokenSeq = 0;
  private readonly sessions = new Map<GameId, PendingSession>();
  /** gameId → (turnKey → participants that have NOT yet acked that turn). */
  private readonly unacked = new Map<GameId, Map<string, Set<string>>>();

  // Injectable seams so the scheduler is unit-testable without real timers,
  // the realtime hub or the game loader.
  private setTimer: SetTimer = (cb, ms) => setTimeout(cb, ms);
  private clearTimer: ClearTimer = (handle) => clearTimeout(handle);
  /** How a due turn is actually resolved — the real automa turn in production;
   *  a spy in unit tests (so the scheduler logic is testable without a game). */
  private resolveTurn: (game: IGame) => void = (game) => AutomaController.takeTurn(game);
  private connectedProvider: ConnectedProvider = (gameId) => RealtimeHub.getInstance().connectedParticipants(gameId);
  private gameProvider: GameProvider = (gameId) => {
    // Lazy require breaks the module-init cycle GameLoader → (recovery) →
    // BotTurnScheduler → GameLoader. Both are singletons resolved at call time.
    const {GameLoader} = require('../database/GameLoader');
    return GameLoader.getInstance().getGame(gameId);
  };

  public static getInstance(): BotTurnScheduler {
    if (BotTurnScheduler.instance === undefined) {
      BotTurnScheduler.instance = new BotTurnScheduler();
    }
    return BotTurnScheduler.instance;
  }

  public enable(): void {
    this.enabled = true;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  // ---------------------------------------------------------------------------
  // Production entry points
  // ---------------------------------------------------------------------------

  /**
   * Called from `Game.startActionsForPlayer` when the active player is the bot
   * for an ACTION-phase turn (NOT the PRELUDES pass-back). Disabled → resolve
   * synchronously (byte-identical to the historical inline call). Enabled →
   * pend + broadcast the active state, then schedule the deferred resolve.
   */
  public onBotTurnDue(game: IGame): void {
    const automa = game.automa;
    if (this.enabled === false || automa === undefined) {
      this.resolveTurn(game);
      return;
    }
    automa.pendingTurn = true;
    // Bump the observable version so every OTHER connected client refreshes to
    // the "bot is active" state (the acting human's own response already
    // reflects it — it is built after this returns). Persisting also records
    // the pending marker for restart recovery.
    game.gameAge++;
    game.save();
    this.startSession(game.id);
  }

  /**
   * Recovery: on game load (server restart / cache eviction) the in-memory
   * timer for a still-pending bot turn is gone. Reschedule so the game can
   * never stay stuck on an active-but-unresolved bot turn. Idempotent — a live
   * session is left alone.
   */
  public recoverIfNeeded(game: IGame): void {
    if (this.enabled === false) {
      return;
    }
    if (this.sessions.has(game.id)) {
      return;
    }
    if (this.isPendingBotTurn(game) === false) {
      return;
    }
    this.startSession(game.id);
  }

  /**
   * A client reports it has finished presenting a bot-turn notification
   * (dismissed / TTL expired / opened its review). A SOFT signal: it can only
   * SHORTEN the wait before the next bot turn (by removing an extension
   * reason); it can never block, and a lost ack is bounded by the max delay.
   */
  public ack(gameId: GameId, participantId: string, turnKey: string): void {
    const perGame = this.unacked.get(gameId);
    if (perGame === undefined) {
      return;
    }
    const remaining = perGame.get(turnKey);
    if (remaining === undefined) {
      return;
    }
    remaining.delete(participantId);
    if (remaining.size === 0) {
      perGame.delete(turnKey);
    }
  }

  /** Drop all pacing state for a deleted / finished game. */
  public forget(gameId: GameId): void {
    this.cancel(gameId);
    this.unacked.delete(gameId);
  }

  // ---------------------------------------------------------------------------
  // Scheduling internals
  // ---------------------------------------------------------------------------

  private startSession(gameId: GameId): void {
    this.cancel(gameId);
    const token = ++this.tokenSeq;
    const session: PendingSession = {gameId, token, extensions: 0, timer: undefined};
    this.sessions.set(gameId, session);
    session.timer = this.setTimer(() => this.onDue(gameId, token), BOT_TURN_INITIAL_DELAY_MS);
  }

  private cancel(gameId: GameId): void {
    const session = this.sessions.get(gameId);
    if (session?.timer !== undefined) {
      this.clearTimer(session.timer);
    }
    this.sessions.delete(gameId);
  }

  private onDue(gameId: GameId, token: number): void {
    const session = this.sessions.get(gameId);
    if (session === undefined || session.token !== token) {
      return; // superseded by a newer turn, or cancelled
    }
    session.timer = undefined;
    void this.resolveDue(gameId, token);
  }

  private async resolveDue(gameId: GameId, token: number): Promise<void> {
    const game = await this.gameProvider(gameId);
    // Re-validate after the async load — a newer session or cancellation may
    // have won the race while we awaited.
    const session = this.sessions.get(gameId);
    if (session === undefined || session.token !== token) {
      return;
    }
    if (game === undefined) {
      this.forget(gameId);
      return;
    }
    if (this.isPendingBotTurn(game) === false) {
      // The game advanced past this bot turn (undo, unexpected change, already
      // resolved). Drop the stale session; recovery will re-arm if a genuine
      // pending turn reappears.
      this.sessions.delete(gameId);
      return;
    }
    if (session.extensions < BOT_TURN_MAX_EXTENSIONS && this.hasOutstandingNotifications(game)) {
      session.extensions++;
      session.timer = this.setTimer(() => this.onDue(gameId, token), BOT_TURN_EXTENSION_MS);
      return;
    }
    this.sessions.delete(gameId);
    this.resolveNow(game);
  }

  private resolveNow(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined) {
      return;
    }
    const bot = marsBotOf(game);
    // Clear the marker FIRST: a duplicate/stale callback can no longer resolve
    // (isPendingBotTurn now returns false), AND takeTurn may synchronously
    // start the NEXT bot turn (re-setting pendingTurn for a fresh session).
    automa.pendingTurn = false;
    // This runs on a timer, not a request stack — a throw here would be an
    // unhandled rejection. Contain it: the pending marker is already cleared, so
    // a genuinely broken turn stops rather than looping (the same end state a
    // synchronous takeTurn failure produced before pacing), and the process
    // stays healthy.
    try {
      this.resolveTurn(game);
      const lastTurn = automa.lastTurn;
      if (lastTurn !== undefined) {
        this.registerResolvedTurn(game, botTurnKey(bot.color, lastTurn));
      }
      // Broadcast the resolved result (+ any freshly-pending next turn's active
      // state). takeTurn already logged (bumping gameAge), but bump + save
      // explicitly so the transition is always observable and persisted.
      game.gameAge++;
      game.save();
    } catch (err) {
      console.error(`BotTurnScheduler: resolving bot turn for game ${game.id} failed`, err);
    }
  }

  /**
   * True iff the game is genuinely waiting on the bot to take an as-yet
   * unresolved turn. Structural + marker-based so a duplicate callback, an
   * undo, or a bonus card that deferred a HUMAN sub-prompt (the turn already
   * resolved) all read as "not pending".
   */
  private isPendingBotTurn(game: IGame): boolean {
    const automa = game.automa;
    if (automa === undefined || automa.pendingTurn !== true) {
      return false;
    }
    if (game.phase === Phase.END) {
      return false;
    }
    if (game.activePlayer?.isMarsBot !== true) {
      return false;
    }
    if (game.players.some((player) => player.getWaitingFor() !== undefined)) {
      return false;
    }
    return true;
  }

  // ---------------------------------------------------------------------------
  // Notification-ack pacing
  // ---------------------------------------------------------------------------

  private registerResolvedTurn(game: IGame, turnKey: string): void {
    const relevant = this.relevantConnected(game);
    if (relevant.size === 0) {
      return; // nobody connected to wait for
    }
    let perGame = this.unacked.get(game.id);
    if (perGame === undefined) {
      perGame = new Map();
      this.unacked.set(game.id, perGame);
    }
    perGame.set(turnKey, new Set(relevant));
    while (perGame.size > UNACKED_TURN_CAP) {
      const oldest = perGame.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      perGame.delete(oldest);
    }
  }

  private hasOutstandingNotifications(game: IGame): boolean {
    const relevant = this.relevantConnected(game);
    if (relevant.size === 0) {
      return false;
    }
    const perGame = this.unacked.get(game.id);
    if (perGame === undefined) {
      return false;
    }
    for (const remaining of perGame.values()) {
      for (const participantId of remaining) {
        if (relevant.has(participantId)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Connected participants that are HUMAN players of this game — never the bot
   * (it has no client), never spectators (they don't gate a turn). Empty ⇒
   * nobody to wait for (WS off, everyone disconnected) ⇒ timer-only pacing.
   */
  private relevantConnected(game: IGame): ReadonlySet<string> {
    const connected = this.connectedProvider(game.id);
    if (connected.size === 0) {
      return EMPTY;
    }
    const humans = new Set<string>(
      game.players.filter((player) => player.isMarsBot !== true).map((player) => player.id));
    const result = new Set<string>();
    for (const participantId of connected) {
      if (humans.has(participantId)) {
        result.add(participantId);
      }
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // Testing hooks
  // ---------------------------------------------------------------------------

  public configureForTesting(opts: {
    setTimer?: SetTimer,
    clearTimer?: ClearTimer,
    connectedProvider?: ConnectedProvider,
    gameProvider?: GameProvider,
    resolveTurn?: (game: IGame) => void,
  }): void {
    if (opts.setTimer !== undefined) {
      this.setTimer = opts.setTimer;
    }
    if (opts.clearTimer !== undefined) {
      this.clearTimer = opts.clearTimer;
    }
    if (opts.connectedProvider !== undefined) {
      this.connectedProvider = opts.connectedProvider;
    }
    if (opts.gameProvider !== undefined) {
      this.gameProvider = opts.gameProvider;
    }
    if (opts.resolveTurn !== undefined) {
      this.resolveTurn = opts.resolveTurn;
    }
  }

  public enableForTesting(): void {
    this.enabled = true;
  }

  /** How many extensions the current pending session has taken (test visibility). */
  public extensionsForTesting(gameId: GameId): number | undefined {
    return this.sessions.get(gameId)?.extensions;
  }

  public hasSessionForTesting(gameId: GameId): boolean {
    return this.sessions.has(gameId);
  }

  /** Fire the armed timer for a game deterministically (returns the resolve promise). */
  public async fireDueForTesting(gameId: GameId): Promise<void> {
    const session = this.sessions.get(gameId);
    if (session === undefined) {
      return;
    }
    session.timer = undefined;
    await this.resolveDue(gameId, session.token);
  }

  public resetForTesting(): void {
    for (const session of this.sessions.values()) {
      if (session.timer !== undefined) {
        this.clearTimer(session.timer);
      }
    }
    this.sessions.clear();
    this.unacked.clear();
    this.enabled = false;
    this.tokenSeq = 0;
    this.setTimer = (cb, ms) => setTimeout(cb, ms);
    this.clearTimer = (handle) => clearTimeout(handle);
    this.resolveTurn = (game) => AutomaController.takeTurn(game);
    this.connectedProvider = (gameId) => RealtimeHub.getInstance().connectedParticipants(gameId);
    this.gameProvider = (gameId) => {
      const {GameLoader} = require('../database/GameLoader');
      return GameLoader.getInstance().getGame(gameId);
    };
  }
}
