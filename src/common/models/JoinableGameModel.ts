import {Color} from '../Color';
import {CampaignId, GameId, PlayerId} from '../Types';
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
 * Which SLICE of the requester's games a listing asks for.
 *
 * `active` — the games still being played (the default: the join list, the
 * console menu's CONTINUE item and its badge all mean this).
 * `finished` — the ARCHIVE. A finished game is still enterable: the console
 * lands on the SETTLED final scoring, where the player can replay the count
 * or open the game overview (see `consoleEndgameState`'s re-entry contract).
 */
export type JoinableGameStatus = 'active' | 'finished';

/**
 * A summary of a game in which one of the players' normalized name matches the
 * requester — the payload of the premium "join games" list. It is deliberately
 * minimal and exposes only board-public information plus the requester's own
 * seat link.
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
   * The game has ENDED (Phase.END). A finished row is opened to review the
   * result, never to take a turn — so `activePlayer` carries no turn meaning
   * here and no UI may read it as one.
   */
  finished: boolean;
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
  /**
   * Campaign mode: present when this game is one MISSION of a campaign.
   * «Мои партии» collapses mission rows sharing `campaign.id` into one
   * campaign row whose front door is the Campaign Map. Absent on a host
   * running an older server build — grouping must tolerate partial data.
   */
  campaign?: {id: CampaignId, name: string, slot: number, count: number, final: boolean};
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
