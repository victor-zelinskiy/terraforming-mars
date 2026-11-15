/*
 * THE TABLE'S LIVENESS — «while the game is not over, somebody is asked, or MarsBot's turn is on its way»
 * (FREEZE ZERO — docs/claude/console/freeze-zero/PLAN.md §4).
 *
 * Every freeze the console can see is a screen that does not serve the server's question. This is the one it cannot:
 * the SERVER asks nobody. The game is not over, no seat holds a prompt, no bot turn is pending — the poll answers
 * «WAIT, nobody» to every page for ever, each page is a healthy screen waiting for another seat, and nothing anywhere
 * says the table is dead. It forms where the engine runs with nobody at the other end of a request: the bot's turn
 * on its timer (`BotTurnScheduler`), whose failure used to end in a `console.error` of a process no one reads.
 *
 * THE INVARIANT is structural and has no healthy exception: the engine hands the question on synchronously inside
 * the request (or the bot's timer) that answered the last one, so BETWEEN requests either a seat is asked or the
 * bot's pending marker stands. It is looked at where every page already comes once a second — the poll — and a table
 * found dead twice, `DEAD_TABLE_CONFIRM_MS` apart, is
 *
 *   · SAID, once: a server error with what stood (the phase, the generation, whose turn it was);
 *   · and, in the ACTION phase, put back on THE LOADER'S ROAD (`Game.resumeActionPhase` — exactly what a restart of
 *     the server does for this state: a bot whose turn is no longer pending is moved past, a human is asked their
 *     action again). No new rule: the recovery the game already has for a reload, taken without the reload.
 *
 * One attempt per death: a table that is still dead after it stays said and is not walked again (an advance that
 * throws every time is the engine's defect — it is in the report, with its stack).
 */
import {Phase} from '../../common/Phase';
import {GameId} from '../../common/Types';
import {IGame} from '../IGame';
import {BotTurnScheduler} from '../automa/BotTurnScheduler';
import {reportServerError} from '../diagnostics/serverDiagnostics';

/** A table is called dead only when two looks this far apart both found it so. */
export const DEAD_TABLE_CONFIRM_MS = 5_000;

export type TableLook =
  /** Somebody is asked, or the bot's turn is on its way, or the game is over. */
  | 'alive'
  /** Nobody is asked — seen, not yet confirmed. */
  | 'suspect'
  /** Confirmed dead, said, and the loader's road put a question back. */
  | 'recovered'
  /** Confirmed dead and said; nothing put a question back. */
  | 'dead';

/**
 * IS NOBODY ASKED, WITH NOTHING ON ITS WAY? A reading of the game as it stands between two requests.
 *
 * «On its way» is the bot's pending turn WITH the scheduler's session behind it (`BotTurnScheduler.turnOnItsWay`) —
 * the pending marker alone is a field of the game and proves nothing: it outlives a lost timer, a resolve that never
 * came back, a save loaded by a process whose scheduler is not running.
 */
export function tableStandsDead(game: IGame, botOnItsWay: boolean = BotTurnScheduler.getInstance().turnOnItsWay(game.id)): boolean {
  if (game.phase === Phase.END) {
    return false;
  }
  if (game.automa?.pendingTurn === true && botOnItsWay) {
    return false;
  }
  return game.players.every((player) => player.getWaitingFor() === undefined);
}

/** What stood, for the report — no id of the game or of a seat: the report leaves the device. */
function describe(game: IGame): string {
  const active = game.activePlayer;
  return `nobody is asked and no bot turn is on its way${game.automa?.pendingTurn === true ? ' (its pending marker stands, with no session behind it)' : ''} — phase ${game.phase}, generation ${game.generation}, ` +
    `active: ${active === undefined ? 'nobody' : active.isMarsBot ? 'MarsBot' : 'a player'}, deferred: ${game.deferredActions.length}`;
}

const seen = new Map<GameId, {since: number, said: boolean}>();

/**
 * ONE LOOK at a table (the poll's). Cheap on a live table: a scan of the seats.
 */
export function lookAtTable(game: IGame, now: number = Date.now()): TableLook {
  if (!tableStandsDead(game)) {
    seen.delete(game.id);
    return 'alive';
  }
  const prior = seen.get(game.id);
  if (prior === undefined) {
    seen.set(game.id, {since: now, said: false});
    return 'suspect';
  }
  if (prior.said) {
    return 'dead';
  }
  if (now - prior.since < DEAD_TABLE_CONFIRM_MS) {
    return 'suspect';
  }
  prior.said = true;
  const what = describe(game);
  console.error(`TableLiveness: a dead table (game ${game.id}) — ${what}`);
  reportServerError('a dead table', new Error(what));
  if (game.phase !== Phase.ACTION) {
    return 'dead';
  }
  try {
    // (A stale session of the scheduler — a resolve that never came back — must not resolve the turn a second time.)
    BotTurnScheduler.getInstance().forget(game.id);
    game.resumeActionPhase();
    // The pages learn of it the way they learn of any move.
    game.gameAge++;
    game.notifyStateChange();
  } catch (err) {
    console.error(`TableLiveness: the loader's road could not revive the table (game ${game.id})`, err);
    reportServerError('reviving a dead table', err);
    return 'dead';
  }
  if (tableStandsDead(game)) {
    return 'dead';
  }
  seen.delete(game.id);
  return 'recovered';
}

/** A game that left the server (deleted, purged) takes its record with it. */
export function forgetTable(gameId: GameId): void {
  seen.delete(gameId);
}

/** Tests only. */
export function resetTableLivenessForTesting(): void {
  seen.clear();
}
