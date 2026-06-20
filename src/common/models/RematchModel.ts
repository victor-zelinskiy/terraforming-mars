import {Color} from '../Color';
import {GameId, ParticipantId} from '../Types';

/**
 * Lifecycle of a rematch offer for a finished game.
 *
 *  - `none`     — no active offer (initial / after a cancel).
 *  - `offered`  — a player proposed a rematch; others are voting.
 *  - `declined` — a player declined; the offer is dead. Anyone may offer again.
 *  - `created`  — every player accepted; the new game exists and is joinable.
 */
export type RematchStatus = 'none' | 'offered' | 'declined' | 'created';

export type RematchVoteStatus = 'pending' | 'accepted' | 'declined';

export type RematchVoteModel = {
  color: Color;
  name: string;
  status: RematchVoteStatus;
};

/**
 * Per-VIEWER rematch state for a finished game (served by `/api/game/rematch`).
 *
 * The vote tally is public (every player sees who accepted / declined), but the
 * join link is private: each player is told ONLY their OWN new-game participant
 * id (`joinKind`/`joinId`), so nobody can open another player's perspective in
 * the live rematch. Spectators get the new spectator id instead.
 */
export type RematchModel = {
  status: RematchStatus;
  /** The player who made the current offer (status `offered` / `created`). */
  offeredBy?: Color;
  /** The player who declined (status `declined`). */
  declinedBy?: Color;
  /** Per-player vote tally. The offerer is always `accepted`. */
  votes: ReadonlyArray<RematchVoteModel>;
  /** True iff the viewer is one of the finished game's players (not a spectator). */
  viewerIsPlayer: boolean;
  /** The viewer's colour, when they are a player. */
  viewerColor?: Color;
  /** True iff the viewer is a player who still owes a vote on the current offer. */
  viewerMustVote: boolean;
  /** True iff the viewer is the player who made the current offer. */
  viewerIsOfferer: boolean;
  /** The new game's id, when `created` (informational). */
  newGameId?: GameId;
  /** How the viewer joins the new game: as a player or as a spectator. */
  joinKind?: 'player' | 'spectator';
  /** The viewer's OWN participant id in the new game (private to them). */
  joinId?: ParticipantId;
};

export type RematchAction = 'offer' | 'accept' | 'decline' | 'cancel';
