import {Expansion, EXPANSIONS} from '../../common/cards/GameModule';
import {Phase} from '../../common/Phase';
import {IGame} from '../IGame';
import {JoinableGameSummary, JoinablePlayer} from '../../common/models/JoinableGameModel';
import {normalizePlayerName} from '../../common/utils/playerName';

/**
 * Build a {@link JoinableGameSummary} for `game` from the perspective of a
 * player whose normalized name is `normalizedName`. Returns `undefined` when the
 * game is finished or no seat matches the name — those are simply not part of
 * the requester's join list.
 *
 * Only the requester's OWN matched seat exposes a `PlayerId` (their private join
 * link). If two seats share the name the match is ambiguous: no link is handed
 * out and the client renders an ambiguity state.
 */
export function getJoinableGameSummary(game: IGame, normalizedName: string): JoinableGameSummary | undefined {
  if (game.phase === Phase.END) {
    return undefined;
  }

  const players = game.playersInGenerationOrder;
  const matches = players.filter((p) => normalizePlayerName(p.name) === normalizedName);
  if (matches.length === 0) {
    return undefined;
  }

  const expansions: ReadonlyArray<Expansion> =
    EXPANSIONS.filter((e) => game.gameOptions.expansions[e] === true);

  const roster: ReadonlyArray<JoinablePlayer> = players.map((p) => ({
    name: p.name,
    color: p.color,
    isYou: normalizePlayerName(p.name) === normalizedName,
  }));

  const ambiguous = matches.length > 1;

  return {
    id: game.id,
    name: game.name,
    createdTimeMs: game.createdTime.getTime(),
    phase: game.phase,
    generation: game.getGeneration(),
    boardName: game.gameOptions.boardName,
    expansions,
    players: roster,
    maxPlayers: players.length,
    activePlayer: game.activePlayer.color,
    you: ambiguous ? undefined : {id: matches[0].id, color: matches[0].color},
    ambiguous,
  };
}
