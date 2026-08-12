import {GameIdLedger, IDatabase} from './IDatabase';
import {IGame, Score} from '../IGame';
import {GameOptions} from '../game/GameOptions';
import {GameId, isGameId, ParticipantId} from '../../common/Types';
import {SerializedGame} from '../SerializedGame';
import {Dirent, existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync} from 'fs';
import {rename, writeFile} from 'fs/promises';
import {Session, SessionId} from '../auth/Session';
import {toID} from '../../common/utils/utils';

const path = require('path');
const defaultDbFolder = path.resolve(process.cwd(), './db/files');

// Serialized game state is machine-read and is by far the largest thing this
// backend writes — indenting it inflates a late-game 5-player save from ~580KB
// to ~1020KB, on every single player action, for no runtime benefit. Set
// TM_FS_DB_PRETTY to get hand-readable files back while debugging.
// (Game results and sessions stay indented: they are tiny, rare and read by people.)
const gameStateIndent = process.env.TM_FS_DB_PRETTY !== undefined ? 2 : undefined;

export class LocalFilesystem implements IDatabase {
  protected readonly dbFolder: string;
  private readonly historyFolder: string;
  private readonly completedFolder: string;
  private readonly sessionsFolder: string;
  public static quiet: boolean = false;

  /**
   * Chain of the writes deferred by `saveSerializedGame`. Every read awaits it
   * first, so moving the writes off the hot path stays invisible to callers.
   */
  private pendingWrites: Promise<unknown> = Promise.resolve();

  constructor(dbFolder: string = defaultDbFolder) {
    this.dbFolder = dbFolder;
    this.historyFolder = path.resolve(dbFolder, 'history');
    this.completedFolder = path.resolve(dbFolder, 'completed');
    this.sessionsFolder = path.resolve(dbFolder, 'sessions');
  }

  public initialize(): Promise<void> {
    console.log(`Starting local database at ${this.dbFolder}`);
    const dirs = [this.dbFolder, this.historyFolder, this.completedFolder, this.sessionsFolder];
    for (const folder of dirs) {
      if (!existsSync(folder)) {
        // recursive: the embedded desktop server roots the db under a fresh
        // <userData>/embedded dir whose parents may not exist yet.
        mkdirSync(folder, {recursive: true});
      }
    }
    return Promise.resolve();
  }

  // `extension` exists so a write can stage into a sibling temp file. It must
  // never be 'json': `asGameId` and `getSaveIds` match on that suffix, and a temp
  // file that matched would surface as a duplicate game / phantom save id.
  private filename(gameId: GameId, extension: string = 'json'): string {
    return path.resolve(this.dbFolder, `${gameId}.${extension}`);
  }

  private historyFilename(gameId: GameId, saveId: number, extension: string = 'json') {
    const saveIdString = saveId.toString().padStart(5, '0');
    return path.resolve(this.historyFolder, `${gameId}-${saveIdString}.${extension}`);
  }

  private completedFilename(gameId: GameId) {
    return path.resolve(this.completedFolder, `${gameId}.json`);
  }

  private sessionFilename(sessionId: SessionId) {
    return path.resolve(this.sessionsFolder, `${sessionId}.json`);
  }

  saveGame(game: IGame): Promise<void> {
    if (!LocalFilesystem.quiet) {
      console.log(`saving ${game.id} at position ${game.lastSaveId}`);
    }
    this.saveSerializedGame(game.serialize());
    game.lastSaveId++;
    // Resolves once the save is actually on disk. `Game.save()` discards this
    // (it always has), so a player action is acknowledged a few ms before it
    // lands and a crash inside that window costs that one action. Callers that
    // need the guarantee — GameLoader.completeGame — await it and still get it.
    return this.pendingWrites.then(() => undefined);
  }

  saveSerializedGame(serializedGame: SerializedGame): void {
    const gameId = serializedGame.id;
    const saveId = serializedGame.lastSaveId;
    // The only unavoidably synchronous part: it snapshots live, still-mutating
    // game state. Both writes then leave the event loop free to serve previews,
    // websocket traffic and bot pacing while the disk works.
    const text = JSON.stringify(serializedGame, null, gameStateIndent);
    // Both files go through ONE chain, and that is what makes the rest safe:
    // saves never interleave, so the fixed temp names cannot collide, and a
    // reader that awaits the chain sees every save queued before it.
    //
    // The trailing catch is mandatory, not defensive: a rejection left on the
    // chain would be inherited by every later save and by flushPendingWrites,
    // so one bad write would fail every read from then on. It cannot rethrow
    // either — `Game.save()` discards this promise, and an unhandled rejection
    // takes the whole utility process down. So a failed write is loud in the log
    // and then dropped, which is survivable only because each save writes the
    // COMPLETE state: the next successful save repairs a failed one.
    this.pendingWrites = this.pendingWrites
      .then(() => this.writeAtomic(this.filename(gameId), this.filename(gameId, 'tmp'), text))
      .then(() => this.writeAtomic(
        this.historyFilename(gameId, saveId),
        this.historyFilename(gameId, saveId, 'tmp'),
        text))
      .catch((err) => console.error(
        `FAILED to save ${gameId} at ${saveId}; the next successful save will re-persist it`, err));
  }

  /**
   * Settles every write queued so far. EVERY read goes through this, so the
   * deferred writes are not observable. Also public because a caller about to
   * take the folder away (a test tearing down its temp dir, a shutdown hook)
   * has to settle them too.
   */
  public flushPendingWrites(): Promise<unknown> {
    return this.pendingWrites;
  }

  /**
   * Writes through a temp file so neither a concurrent reader nor a process
   * killed mid-write can observe a truncated file.
   *
   * Only the RENAME is caught: on Windows an antivirus scanner can hold a
   * transient lock on a freshly created file, and the temp file is complete by
   * then, so finishing in place is safe. A failing temp WRITE (out of disk,
   * permissions) is deliberately allowed to propagate — falling back there would
   * open the good file with 'w', truncate it, and then fail too, destroying the
   * very state this method exists to protect.
   */
  private async writeAtomic(filename: string, tmpFilename: string, text: string): Promise<void> {
    await writeFile(tmpFilename, text);
    try {
      await rename(tmpFilename, filename);
    } catch (err) {
      console.error(`Atomic rename of ${filename} failed, writing in place`, err);
      await writeFile(filename, text);
    }
  }

  async getGame(gameId: GameId): Promise<SerializedGame> {
    await this.flushPendingWrites();
    try {
      if (!LocalFilesystem.quiet) {
        console.log(`Loading ${gameId}`);
      }
      const text = readFileSync(this.filename(gameId));
      const serializedGame = JSON.parse(text.toString());
      return serializedGame;
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      throw error;
    }
  }

  async getGameId(participantId: ParticipantId): Promise<GameId> {
    const participants = await this.getParticipants();
    for (const entry of participants) {
      if (entry.participantIds.includes(participantId)) {
        return entry.gameId;
      }
    }
    throw new Error(`participant id ${participantId} not found`);
  }

  /** Save ids of `gameId`, ASCENDING. Callers rely on the order — see the sort below. */
  async getSaveIds(gameId: GameId): Promise<Array<number>> {
    await this.flushPendingWrites();
    const results: Array<number> = [];
    const entries = readdirSync(this.historyFolder, {withFileTypes: true});
    for (const dirent of entries) {
      if (dirent.name.startsWith(gameId + '-') && dirent.isFile()) {
        const match = dirent.name.match(/(.*)-(.*).json/);
        if (match !== null) {
          const saveIdAsString = match[2];
          results.push(Number(saveIdAsString));
        }
      }
    }
    // readdir order is filesystem dependent — NTFS returns entries sorted, ext4's
    // htree returns them in hash order — so the order has to be established here.
    // Consumers that take a tail (deleteGameNbrSaves) or replay in sequence
    // (exportLogs) silently did the wrong thing on Linux hosts without this.
    return results.sort((a, b) => a - b);
  }

  async getGameVersion(gameId: GameId, saveId: number): Promise<SerializedGame> {
    await this.flushPendingWrites();
    try {
      if (!LocalFilesystem.quiet) {
        console.log(`Loading ${gameId} at ${saveId}`);
      }
      const text = readFileSync(this.historyFilename(gameId, saveId));
      const serializedGame = JSON.parse(text.toString());
      return serializedGame;
    } catch (e) {
      console.log(e);
      throw new Error(`Game ${gameId} not found at save_id ${saveId}`);
    }
  }

  async getPlayerCount(gameId: GameId): Promise<number> {
    await this.flushPendingWrites();
    const initialSave = this.historyFilename(gameId, 0);
    if (!existsSync(this.filename(gameId)) || !existsSync(initialSave)) {
      throw new Error(`${gameId} not found`);
    }
    const text = readFileSync(initialSave);
    const serializedGame = JSON.parse(text.toString()) as SerializedGame;
    return serializedGame.players.length;
  }

  async getGameIds(): Promise<Array<GameId>> {
    await this.flushPendingWrites();
    const gameIds: Array<GameId> = [];

    readdirSync(this.dbFolder, {withFileTypes: true}).forEach((dirent: Dirent) => {
      const gameId = this.asGameId(dirent);
      if (gameId !== undefined) {
        gameIds.push(gameId);
      }
    });
    return gameIds;
  }

  saveGameResults(gameId: GameId, players: number, generations: number, gameOptions: GameOptions, scores: Array<Score>): void {
    const obj = {gameId, players, generations, gameOptions, scores};
    const text = JSON.stringify(obj, null, 2);
    writeFileSync(this.completedFilename(gameId), text);
  }

  markFinished(_gameId: GameId): Promise<void> {
    // Not implemented here.
    return Promise.resolve();
  }

  purgeUnfinishedGames(): Promise<Array<GameId>> {
    // Not implemented.
    return Promise.resolve([]);
  }

  compressCompletedGames(): Promise<unknown> {
    // Not implemented.
    return Promise.resolve();
  }

  async deleteGameNbrSaves(gameId: GameId, rollbackCount: number): Promise<void> {
    if (rollbackCount <= 0) {
      console.error(`invalid rollback count for ${gameId}: ${rollbackCount}`);
      // Should this be an error?
      return;
    }

    // The tail is the newest saves only because getSaveIds sorts ascending.
    const saveIds = await this.getSaveIds(gameId);
    for (const version of saveIds.slice(-rollbackCount)) {
      this.deleteVersion(gameId, version);
    }

    // Dropping the history versions is the WHOLE rollback for the SQL backends,
    // whose getGame reads `ORDER BY save_id DESC LIMIT 1` and so re-points itself
    // for free. This one keeps the current state in a file of its own, and THAT
    // file is what getGame reads — so every reload (undo, admin rollback) would
    // otherwise come straight back with the state just discarded, and the rollback
    // would silently do nothing while reporting success.
    const survivor = saveIds[saveIds.length - rollbackCount - 1];
    if (survivor !== undefined) {
      await this.repointCurrentState(gameId, survivor);
    }
  }

  /**
   * Rewrites the current-state file from `saveId`'s history version.
   *
   * It rides `pendingWrites` for the reason every save does: the chain is what
   * keeps writes from interleaving (so the fixed temp names cannot collide), and
   * reading the source INSIDE it is what guarantees we copy the surviving save
   * rather than one a queued write is still about to replace. Two things differ
   * from a save, both because a caller is about to reload the game from this file:
   * it is AWAITED, and a failure REACHES that caller instead of being logged and
   * dropped — a rollback that quietly did nothing is the bug this method exists to
   * fix. The chain itself still absorbs the rejection, since one left on it would
   * be inherited by every later save and by flushPendingWrites.
   */
  private async repointCurrentState(gameId: GameId, saveId: number): Promise<void> {
    let failure: unknown;
    this.pendingWrites = this.pendingWrites
      .then(() => this.writeAtomic(
        this.filename(gameId),
        this.filename(gameId, 'tmp'),
        readFileSync(this.historyFilename(gameId, saveId)).toString()))
      .catch((err) => {
        failure = err;
      });
    await this.pendingWrites;
    if (failure !== undefined) {
      throw new Error(`Could not roll ${gameId} back to save ${saveId}: ${String(failure)}`);
    }
  }

  async deleteGame(gameId: GameId): Promise<void> {
    const saveIds = await this.getSaveIds(gameId);
    for (const saveId of saveIds) {
      try {
        this.deleteVersion(gameId, saveId);
      } catch (err) {
        console.error(`While deleting save ${saveId} of ${gameId}`, err);
      }
    }
    if (existsSync(this.filename(gameId))) {
      unlinkSync(this.filename(gameId));
    }
    if (existsSync(this.completedFilename(gameId))) {
      unlinkSync(this.completedFilename(gameId));
    }
  }

  public stats(): Promise<{[key: string]: string | number}> {
    return Promise.resolve({
      type: 'Local Filesystem',
      path: this.dbFolder.toString(),
      history_path: this.historyFolder.toString(),
    });
  }

  public storeParticipants(_entry: GameIdLedger): Promise<void> {
    // Not necessary.
    return Promise.resolve();
  }

  private asGameId(dirent: Dirent): GameId | undefined {
    if (!dirent.isFile()) {
      return undefined;
    }
    const re = /(.*).json/;
    const result = dirent.name.match(re);
    if (result === null) {
      return undefined;
    }
    return isGameId(result[1]) ? result[1] : undefined;
  }

  public async getParticipants(): Promise<Array<GameIdLedger>> {
    await this.flushPendingWrites();
    const gameIds: Array<GameIdLedger> = [];
    const entries = readdirSync(this.dbFolder, {withFileTypes: true});
    for (const dirent of entries) {
      const gameId = this.asGameId(dirent);
      if (gameId !== undefined) {
        try {
          const text = readFileSync(this.filename(gameId));
          const game: SerializedGame = JSON.parse(text.toString());
          const participantIds: Array<ParticipantId> = game.players.map(toID);
          if (game.spectatorId) {
            participantIds.push(game.spectatorId);
          }
          gameIds.push({gameId, participantIds});
        } catch (e) {
          console.error(`While reading ${gameId} `, e);
        }
      }
    }
    return gameIds;
  }

  createSession(session: Session): Promise<void> {
    const text = JSON.stringify(session, null, 2);
    writeFileSync(this.sessionFilename(session.id), text);
    return Promise.resolve();
  }
  deleteSession(sessionId: SessionId): Promise<void> {
    unlinkSync(this.sessionFilename(sessionId));
    return Promise.resolve();
  }
  getSessions(): Promise<Array<Session>> {
    const sessions: Array<Session> = [];
    const now = Date.now();
    const entries = readdirSync(this.sessionsFolder, {withFileTypes: true});
    for (const dirent of entries) {
      if (dirent.isFile() && dirent.name.endsWith('.json')) {
        try {
          const text = readFileSync(this.sessionsFolder + '/' + dirent.name);
          const session: Session = JSON.parse(text.toString());
          if (session.expirationTimeMillis > now) {
            sessions.push(session);
          }
        } catch (e) {
          console.error(`While reading ${dirent.name} `, e);
        }
      }
    }
    return Promise.resolve(sessions);
  }

  private deleteVersion(gameId: GameId, version: number) {
    unlinkSync(this.historyFilename(gameId, version));
  }
}
