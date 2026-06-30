import {Color} from '../Color';
import {GameId, PlayerId} from '../Types';
import {Phase} from '../Phase';
import {BoardName} from '../boards/BoardName';
import {Expansion} from '../cards/GameModule';

/**
 * One player as shown in a joinable-game roster. Only the requester's OWN seat
 * carries a join id (see {@link JoinableGameSummary.you}); other players are
 * shown by name + cube colour only, never by their private participant id.
 */
export type JoinablePlayer = {
  name: string;
  color: Color;
  /** True when this seat's normalized name matches the requester's. */
  isYou: boolean;
};

/**
 * A summary of an unfinished game in which one of the players' normalized name
 * matches the requester — the payload of the premium "join games" list. It is
 * deliberately minimal and exposes only board-public information plus the
 * requester's own seat link.
 */
export type JoinableGameSummary = {
  id: GameId;
  name: string;
  createdTimeMs: number;
  phase: Phase;
  generation: number;
  boardName: BoardName;
  /** Only the ENABLED expansions, in a stable order. */
  expansions: ReadonlyArray<Expansion>;
  players: ReadonlyArray<JoinablePlayer>;
  /** Always === players.length (TFM has no open seats), kept for UI occupancy. */
  maxPlayers: number;
  activePlayer: Color;
  /**
   * The requester's matched seat — the only place a `PlayerId` (private join
   * link) is exposed. Undefined when no seat matches OR when the match is
   * ambiguous (see {@link ambiguous}).
   */
  you?: {id: PlayerId, color: Color};
  /**
   * True when MORE THAN ONE player in this game matches the requester's
   * normalized name. The name-based identity can't safely pick a seat, so the
   * UI shows an ambiguity state instead of an auto-join link.
   */
  ambiguous: boolean;
};

export type PlayerColorOverrideStatus =
  | 'noop'      // current colour already equals desired colour
  | 'updated'   // colour changed + game migrated/saved
  | 'conflict'  // another player in the game already uses the desired colour
  | 'not-found' // game / player no longer available
  | 'error';

export type PlayerColorOverrideResult = {
  status: PlayerColorOverrideStatus;
  /** Resulting colour of the seat (the desired colour on 'updated'/'noop'). */
  color?: Color;
  previousColor?: Color;
  /** English i18n key explaining a non-success status. */
  message?: string;
};
