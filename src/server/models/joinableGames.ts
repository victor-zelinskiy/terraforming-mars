import {IGame} from '../IGame';
import {JoinableGameStatus, JoinableGameSummary, JoinablePlayer} from '../../common/models/JoinableGameModel';
import {LobbyRecord, lobbyRecordFromGame} from './lobbyIndex';

/**
 * Build a {@link JoinableGameSummary} for one game from the perspective of a
 * player whose normalized name is `normalizedName`. Returns `undefined` when the
 * game is in the OTHER slice (see {@link JoinableGameStatus} — `active` is the
 * default and excludes finished games; `finished` lists only those) or when no
 * seat matches the name.
 *
 * Only the requester's OWN matched seat exposes a `PlayerId` (their private join
 * link). If two seats share the name the match is ambiguous: no link is handed
 * out and the client renders an ambiguity state.
 *
 * The input is a {@link LobbyRecord} — the name-INDEPENDENT summary the lobby
 * index keeps for every game. That is what makes a listing cheap: the per-game
 * derivation happens once (and only when the game actually changed), while this
 * function is a pure per-requester filter over it.
 */
export function joinableSummaryFromRecord(
  record: LobbyRecord,
  normalizedName: string,
  status: JoinableGameStatus = 'active',
): JoinableGameSummary | undefined {
  if (record.finished !== (status === 'finished')) {
    return undefined;
  }

  const matches = record.seats.filter((s) => s.normalizedName === normalizedName);
  if (matches.length === 0) {
    return undefined;
  }

  const roster: ReadonlyArray<JoinablePlayer> = record.seats.map((s) => ({
    name: s.name,
    color: s.color,
    isYou: s.normalizedName === normalizedName,
  }));

  const ambiguous = matches.length > 1;

  return {
    id: record.id,
    name: record.name,
    createdTimeMs: record.createdTimeMs,
    phase: record.phase,
    generation: record.generation,
    boardName: record.boardName,
    expansions: record.expansions,
    players: roster,
    maxPlayers: record.seats.length,
    activePlayer: record.activePlayerColor,
    finished: record.finished,
    you: ambiguous ? undefined : {id: matches[0].id, color: matches[0].color},
    ambiguous,
    campaign: record.campaign,
  };
}

/**
 * The same summary derived straight from a live game. Kept as the single-game
 * entry point (rematch / tests / any caller holding an `IGame`); it goes through
 * the very same record shape, so a listing and a one-off can never disagree.
 */
export function getJoinableGameSummary(
  game: IGame,
  normalizedName: string,
  status: JoinableGameStatus = 'active',
): JoinableGameSummary | undefined {
  return joinableSummaryFromRecord(lobbyRecordFromGame(game), normalizedName, status);
}
