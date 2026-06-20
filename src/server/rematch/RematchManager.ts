import {Color} from '../../common/Color';
import {GameId, ParticipantId, PlayerId, SpectatorId, isGameId, isPlayerId, isSpectatorId, safeCast} from '../../common/Types';
import {RematchModel, RematchStatus, RematchVoteModel, RematchVoteStatus} from '../../common/models/RematchModel';
import {IGame} from '../IGame';
import {IGameLoader} from '../database/IGameLoader';
import {Game} from '../Game';
import {Player} from '../Player';
import {chooseBoard} from '../boards/randomBoard';
import {generateRandomId} from '../utils/server-ids';

type NewGameRef = {
  id: GameId;
  spectatorId: SpectatorId;
  players: ReadonlyArray<{color: Color, id: PlayerId}>;
};

type RematchEntry = {
  status: RematchStatus;
  offeredBy?: Color;
  declinedBy?: Color;
  // Per-colour vote, only populated while an offer is live. The offerer is
  // seeded `accepted`.
  votes: Map<Color, RematchVoteStatus>;
  newGame?: NewGameRef;
  // Guards against creating two rematch games when the final acceptances race
  // (the create step awaits, so a second concurrent accept could otherwise slip
  // past the all-accepted check before `status` flips to `created`).
  creating?: boolean;
};

/**
 * In-memory registry of rematch offers, keyed by the FINISHED game's id.
 *
 * Deliberately NOT serialized onto the Game (a rematch is decided in the few
 * minutes after a game ends, while the game is still cached) — this keeps the
 * feature fully isolated from Game/SerializedGame. A server restart mid-offer
 * simply drops the offer; players re-offer. Mirrors the fork's other bounded,
 * self-contained subsystems.
 */
export class RematchManager {
  private static instance: RematchManager | undefined;
  private readonly entries = new Map<GameId, RematchEntry>();

  public static getInstance(): RematchManager {
    if (RematchManager.instance === undefined) {
      RematchManager.instance = new RematchManager();
    }
    return RematchManager.instance;
  }

  /** Test hook — drops all state. */
  public static reset(): void {
    RematchManager.instance = new RematchManager();
  }

  private entry(gameId: GameId): RematchEntry {
    let e = this.entries.get(gameId);
    if (e === undefined) {
      e = {status: 'none', votes: new Map()};
      this.entries.set(gameId, e);
    }
    return e;
  }

  /**
   * A player proposes (or re-proposes) a rematch. Resets any prior offer, seeds
   * every player to `pending` except the offerer (`accepted`). A solo game has
   * no other players, so this immediately creates the new game.
   */
  public async offer(game: IGame, color: Color, loader: IGameLoader): Promise<void> {
    const e = this.entry(game.id);
    if (e.status === 'created' || e.creating === true) {
      return;
    }
    e.status = 'offered';
    e.offeredBy = color;
    e.declinedBy = undefined;
    e.newGame = undefined;
    e.votes = new Map();
    for (const player of game.players) {
      e.votes.set(player.color, player.color === color ? 'accepted' : 'pending');
    }
    await this.maybeCreate(game, e, loader);
  }

  /** A non-offering player accepts the live offer. */
  public async accept(game: IGame, color: Color, loader: IGameLoader): Promise<void> {
    const e = this.entry(game.id);
    if (e.status !== 'offered' || !e.votes.has(color)) {
      return;
    }
    e.votes.set(color, 'accepted');
    await this.maybeCreate(game, e, loader);
  }

  /** Any voting player declines — kills the offer. Anyone may offer again. */
  public decline(game: IGame, color: Color): void {
    const e = this.entry(game.id);
    if (e.status !== 'offered' || !e.votes.has(color)) {
      return;
    }
    e.votes.set(color, 'declined');
    e.status = 'declined';
    e.declinedBy = color;
  }

  /** The offerer withdraws their own live offer. */
  public cancel(game: IGame, color: Color): void {
    const e = this.entry(game.id);
    if (e.status !== 'offered' || e.offeredBy !== color) {
      return;
    }
    this.entries.set(game.id, {status: 'none', votes: new Map()});
  }

  private async maybeCreate(game: IGame, e: RematchEntry, loader: IGameLoader): Promise<void> {
    if (e.status !== 'offered' || e.creating === true) {
      return;
    }
    const allAccepted = Array.from(e.votes.values()).every((v) => v === 'accepted');
    if (!allAccepted) {
      return;
    }
    e.creating = true;
    try {
      const newGame = await createRematchGame(game, loader);
      e.newGame = {
        id: newGame.id,
        spectatorId: newGame.spectatorId,
        players: newGame.players.map((p) => ({color: p.color, id: p.id})),
      };
      e.status = 'created';
    } finally {
      e.creating = false;
    }
  }

  /** Builds the per-viewer model. `viewerId` is the viewer's participant id. */
  public getModel(game: IGame, viewerId: ParticipantId): RematchModel {
    const e: RematchEntry = this.entries.get(game.id) ?? {status: 'none', votes: new Map()};

    let viewerColor: Color | undefined;
    let viewerIsPlayer = false;
    if (isPlayerId(viewerId)) {
      try {
        viewerColor = game.getPlayerById(viewerId).color;
        viewerIsPlayer = true;
      } catch {
        // Not a player of this game — treat as a non-voting viewer.
      }
    }

    const votes: ReadonlyArray<RematchVoteModel> = game.players.map((p) => ({
      color: p.color,
      name: p.name,
      status: e.votes.get(p.color) ?? 'pending',
    }));

    const viewerMustVote = e.status === 'offered' &&
      viewerColor !== undefined &&
      e.votes.get(viewerColor) === 'pending';
    const viewerIsOfferer = e.offeredBy !== undefined && e.offeredBy === viewerColor;

    let joinKind: 'player' | 'spectator' | undefined;
    let joinId: ParticipantId | undefined;
    if (e.status === 'created' && e.newGame !== undefined) {
      if (viewerIsPlayer && viewerColor !== undefined) {
        const slot = e.newGame.players.find((p) => p.color === viewerColor);
        if (slot !== undefined) {
          joinKind = 'player';
          joinId = slot.id;
        }
      } else {
        joinKind = 'spectator';
        joinId = e.newGame.spectatorId;
      }
    }

    return {
      status: e.status,
      offeredBy: e.offeredBy,
      declinedBy: e.declinedBy,
      votes,
      viewerIsPlayer,
      viewerColor,
      viewerMustVote,
      viewerIsOfferer,
      newGameId: e.status === 'created' ? e.newGame?.id : undefined,
      joinKind,
      joinId,
    };
  }
}

/**
 * Creates a fresh game with the SAME settings as the finished one: same
 * `GameOptions`, same players (name / colour / beginner / handicap) with new
 * ids, same first player, but a new random seed (fresh board & decks). Mirrors
 * the relevant part of `ApiCreateGame` but sources everything from the finished
 * game rather than a request body.
 */
async function createRematchGame(game: IGame, loader: IGameLoader): Promise<IGame> {
  const newGameId = safeCast(generateRandomId('g'), isGameId);
  const spectatorId = safeCast(generateRandomId('s'), isSpectatorId);
  const players = game.players.map((p) => new Player(
    p.name,
    p.color,
    p.beginner,
    p.handicap,
    safeCast(generateRandomId('p'), isPlayerId),
  ));
  // "Random first player" re-randomizes on the rematch (the create form resolves
  // it client-side, so the finished game only records the INTENT); an explicit
  // first player is kept by colour.
  const firstPlayer = game.gameOptions.randomFirstPlayer === true ?
    players[Math.floor(Math.random() * players.length)] :
    (players.find((p) => p.color === game.first.color) ?? players[0]);
  // `Game.newInstance` rejects a clonedGamedId; clear it so a rematch of a
  // cloned game still works (we always build a fresh instance, never clone).
  const gameOptions = {...game.gameOptions, clonedGamedId: undefined};
  // "Same settings" means a RANDOM board re-rolls (the finished game's boardName
  // is already a concrete board). An explicit board is kept as-is. Preserve the
  // randomBoardOption so subsequent rematches keep re-rolling.
  if (gameOptions.randomBoardOption !== undefined) {
    gameOptions.boardName = chooseBoard(gameOptions.randomBoardOption);
  }
  const seed = Math.random();
  const newGame = Game.newInstance(newGameId, players, firstPlayer, spectatorId, gameOptions, seed);
  await loader.add(newGame);
  return newGame;
}
