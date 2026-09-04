import {Color} from '../../common/Color';
import {Expansion, EXPANSIONS} from '../../common/cards/GameModule';
import {BoardName} from '../../common/boards/BoardName';
import {Phase} from '../../common/Phase';
import {CampaignId, GameId, PlayerId} from '../../common/Types';
import {IGame} from '../IGame';
import {IGameLoader} from '../database/IGameLoader';
import {Database} from '../database/Database';
import {SerializedGame} from '../SerializedGame';
import {normalizePlayerName} from '../../common/utils/playerName';

/**
 * THE LOBBY INDEX — the server's cheap, always-current answer to «which games
 * exist, who sits in them, and what has changed since you last asked».
 *
 * WHY IT EXISTS. `api/games/joinable` used to answer by loading EVERY game in
 * the library through `GameLoader.getGame()` on EVERY request. Three costs, all
 * of which the player felt:
 *   1. a full `Game.deserialize()` per game per request — seconds of CPU on a
 *      Steam Deck with a real library, which is longer than the LAN probe
 *      timeout a guest allows, so the guest silently listed NO games at all;
 *   2. `getGame()` TOUCHES the cache, so every listing reset the idle clock of
 *      every game in the library and defeated idle eviction (memory);
 *   3. nothing told anyone the answer had CHANGED, so a client could only find
 *      a new game by polling — and only while it happened to be polling.
 *
 * WHAT IT IS. A `gameId -> LobbyRecord` map of exactly the fields a listing
 * needs, plus a monotonic {@link revision} that moves whenever any record is
 * added, changed or dropped. The realtime layer broadcasts that revision to
 * lobby subscribers (`RealtimeHub.invalidateLobby`), which is what turns «a new
 * game appeared» into a PUSH instead of a poll.
 *
 * FRESHNESS BY CONSTRUCTION. A record is never trusted over the live object:
 * {@link LobbyIndex.snapshot} re-derives from the RESIDENT `IGame` for every
 * game currently in memory (free — no I/O, and it deliberately does not touch
 * the cache), and falls back to the cached record only for games that are NOT
 * resident, i.e. games that by definition are not changing. A cold game unknown
 * to the index is read once from the database in its SERIALIZED form — orders of
 * magnitude cheaper than deserializing a whole `Game`.
 *
 * The module is a LEAF on purpose (no realtime import): the revision listener is
 * injected from `GameServer`, mirroring how the realtime subscription resolver
 * is wired, so `GameLoader -> lobbyIndex -> RealtimeHub` can never become a
 * cycle.
 */

/** One seat as the lobby lists it. `id` is the seat's private participant token. */
export type LobbySeat = {
  id: PlayerId;
  name: string;
  /** Case/space-insensitive form — what a name-scoped listing matches on. */
  normalizedName: string;
  color: Color;
};

/** The name-INDEPENDENT summary of one game. Filtering by player happens on top. */
export type LobbyRecord = {
  id: GameId;
  name: string;
  createdTimeMs: number;
  phase: Phase;
  generation: number;
  boardName: BoardName;
  /** Only the ENABLED expansions, in a stable order. */
  expansions: ReadonlyArray<Expansion>;
  /** Seats in GENERATION order (first player first) — the roster order shown. */
  seats: ReadonlyArray<LobbySeat>;
  activePlayerColor: Color;
  finished: boolean;
  /** Campaign mode: present when the game is one mission of a campaign —
   *  «Мои партии» groups mission rows into ONE campaign row on it. */
  campaign?: {id: CampaignId, name: string, slot: number, count: number, final: boolean};
};

function campaignOf(gameOptions: {campaign?: {campaignId: CampaignId, campaignName: string, missionSlot: number, missionCount: number, final: boolean}}): LobbyRecord['campaign'] {
  const c = gameOptions.campaign;
  if (c === undefined) {
    return undefined;
  }
  return {id: c.campaignId, name: c.campaignName, slot: c.missionSlot, count: c.missionCount, final: c.final};
}

function seatsOf(
  players: ReadonlyArray<{id: PlayerId, name: string, color: Color}>,
): Array<LobbySeat> {
  return players.map((p) => ({
    id: p.id,
    name: p.name,
    normalizedName: normalizePlayerName(p.name),
    color: p.color,
  }));
}

function enabledExpansions(expansions: Partial<Record<Expansion, boolean>>): Array<Expansion> {
  return EXPANSIONS.filter((e) => expansions[e] === true);
}

/** Derive a record from a LIVE game — the authoritative path. */
export function lobbyRecordFromGame(game: IGame): LobbyRecord {
  return {
    id: game.id,
    name: game.name,
    createdTimeMs: game.createdTime.getTime(),
    phase: game.phase,
    generation: game.getGeneration(),
    boardName: game.gameOptions.boardName,
    expansions: enabledExpansions(game.gameOptions.expansions),
    seats: seatsOf(game.playersInGenerationOrder),
    activePlayerColor: game.activePlayer.color,
    finished: game.phase === Phase.END,
    campaign: campaignOf(game.gameOptions),
  };
}

/**
 * Derive a record from the SERIALIZED form — the cheap cold-start path (no
 * `Game.deserialize`, no card/board reconstruction).
 *
 * `playersInGenerationOrder` is `players` rotated so the FIRST player leads
 * (`Game.setFirstPlayer`); reproduced here so both derivations agree exactly —
 * guarded by `tests/models/lobbyIndex.spec.ts`.
 */
export function lobbyRecordFromSerialized(d: SerializedGame): LobbyRecord {
  const players = d.players ?? [];
  const doubled = [...players, ...players];
  const firstIdx = doubled.findIndex((p) => p.id === d.first);
  const inGenerationOrder = firstIdx < 0 ? players : doubled.slice(firstIdx, firstIdx + players.length);
  const active = players.find((p) => p.id === d.activePlayer);
  return {
    id: d.id,
    name: d.name ?? '',
    createdTimeMs: d.createdTimeMs,
    phase: d.phase,
    generation: d.generation,
    boardName: d.gameOptions.boardName,
    expansions: enabledExpansions(d.gameOptions.expansions),
    seats: seatsOf(inGenerationOrder),
    activePlayerColor: active?.color ?? inGenerationOrder[0]?.color ?? players[0]?.color ?? ('neutral' as Color),
    finished: d.phase === Phase.END,
    campaign: campaignOf(d.gameOptions),
  };
}

/** A compact form of everything a listing shows — the change detector. */
function fingerprint(r: LobbyRecord): string {
  return [
    r.id,
    r.name,
    r.phase,
    r.generation,
    r.boardName,
    r.activePlayerColor,
    r.finished ? '1' : '0',
    r.expansions.join(','),
    r.seats.map((s) => `${s.id}:${s.name}:${s.color}`).join('|'),
  ].join('~');
}

/**
 * A shape that is plausibly a real serialized game (a stub / corrupt blob is
 * not). `name` is required here even though the type marks it optional: a save
 * old enough to lack one gets a freshly RANDOMIZED name from
 * `Game.deserialize`, so deriving a listing from it would show a different game
 * name on every read. Those fall through to the loader instead.
 */
function usableSerializedGame(d: SerializedGame | undefined): d is SerializedGame {
  return d !== undefined &&
    typeof d.id === 'string' &&
    typeof d.name === 'string' &&
    Array.isArray(d.players) &&
    typeof d.gameOptions === 'object' && d.gameOptions !== null;
}

export type LobbyRevisionListener = (revision: number) => void;

export class LobbyIndex {
  private static instance: LobbyIndex | undefined;

  private readonly records = new Map<GameId, LobbyRecord>();
  private readonly prints = new Map<GameId, string>();
  private rev = 0;
  private listener: LobbyRevisionListener | undefined;

  public static getInstance(): LobbyIndex {
    if (LobbyIndex.instance === undefined) {
      LobbyIndex.instance = new LobbyIndex();
    }
    return LobbyIndex.instance;
  }

  /** Tests: a clean index (the process singleton otherwise leaks between specs). */
  public static resetForTesting(): void {
    LobbyIndex.instance = new LobbyIndex();
  }

  /**
   * Wire the "the lobby changed" listener (realtime broadcast). One listener —
   * the hub — set once at server start; injected so this module stays a leaf.
   */
  public onRevisionChanged(listener: LobbyRevisionListener | undefined): void {
    this.listener = listener;
  }

  public revision(): number {
    return this.rev;
  }

  /** Upsert from a live game. Returns true when something observable changed. */
  public recordGame(game: IGame): boolean {
    try {
      return this.upsert(lobbyRecordFromGame(game));
    } catch (err) {
      // A listing must never be able to break a save / a game creation.
      console.warn(`lobbyIndex: could not record game ${game?.id}`, err);
      return false;
    }
  }

  /** Forget a game (deleted / purged). Returns true when it was known. */
  public drop(gameId: GameId): boolean {
    if (!this.records.has(gameId)) {
      return false;
    }
    this.records.delete(gameId);
    this.prints.delete(gameId);
    this.bump();
    return true;
  }

  private upsert(record: LobbyRecord): boolean {
    const print = fingerprint(record);
    if (this.prints.get(record.id) === print) {
      // Still store the fresh object so callers never hold a stale reference.
      this.records.set(record.id, record);
      return false;
    }
    this.records.set(record.id, record);
    this.prints.set(record.id, print);
    this.bump();
    return true;
  }

  /**
   * An EXTERNAL lobby-scoped change (a campaign was created, mutated or
   * deleted) — no game record moved, but lobby subscribers (the «Мои
   * кампании» list rides the same channel) must re-ask.
   */
  public touch(): void {
    this.bump();
  }

  private bump(): void {
    this.rev++;
    const listener = this.listener;
    if (listener === undefined) {
      return;
    }
    try {
      listener(this.rev);
    } catch (err) {
      console.error('lobbyIndex: revision listener failed', err);
    }
  }

  /**
   * Every known game, newest first — the listing's source of truth.
   *
   * Reconciles against the loader's ledger (so a game deleted by another route
   * disappears and a game created before this process started is picked up),
   * re-derives every RESIDENT game (free + always current) and reads a cold,
   * unknown game exactly once.
   */
  public async snapshot(loader: IGameLoader): Promise<ReadonlyArray<LobbyRecord>> {
    const ledger = await loader.getIds();
    const live = new Set<GameId>();
    for (const {gameId} of ledger) {
      live.add(gameId);
      const resident = loader.peek?.(gameId);
      if (resident !== undefined) {
        this.recordGame(resident);
        continue;
      }
      if (this.records.has(gameId)) {
        continue;
      }
      const record = await this.readCold(gameId, loader);
      if (record !== undefined) {
        this.upsert(record);
      }
    }
    for (const gameId of [...this.records.keys()]) {
      if (!live.has(gameId)) {
        this.drop(gameId);
      }
    }
    return [...this.records.values()].sort((a, b) => b.createdTimeMs - a.createdTimeMs);
  }

  /**
   * One cold game. The serialized read is the cheap path; a backend that cannot
   * serve it (or serves something unusable) falls back to the loader, which is
   * exactly what the route did before this index existed.
   */
  private async readCold(gameId: GameId, loader: IGameLoader): Promise<LobbyRecord | undefined> {
    try {
      const serialized = await Database.getInstance().getGame(gameId);
      if (usableSerializedGame(serialized)) {
        return lobbyRecordFromSerialized(serialized);
      }
    } catch (err) {
      console.warn(`lobbyIndex: serialized read failed for ${gameId}`, err);
    }
    try {
      const game = await loader.getGame(gameId);
      return game === undefined ? undefined : lobbyRecordFromGame(game);
    } catch (err) {
      console.warn(`lobbyIndex: skipping unloadable game ${gameId}`, err);
      return undefined;
    }
  }
}
