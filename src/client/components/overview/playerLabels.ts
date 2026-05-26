import {ViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {Color} from '@/common/Color';
import {Phase} from '@/common/Phase';
import {ActionLabel} from './ActionLabel';

const SHOW_NEXT_LABEL_MIN = 2;

export function playerIndexInList(
  color: PublicPlayerModel['color'],
  players: ReadonlyArray<PublicPlayerModel>,
): number {
  for (let idx = 0; idx < players.length; idx++) {
    if (players[idx].color === color) {
      return idx;
    }
  }
  return -1;
}

/**
 * Returns the status label for `player` in the current game state.
 *
 * Source of truth for "is the server waiting on this player?" is
 * `livePlayersWaitingFor` when provided (continuous-poll signal — stays
 * in sync across all clients without requiring a full view refresh),
 * otherwise the per-player `isWaitingForInput` snapshot from the model.
 * Past versions used `player.isActive` / `needsToDraft` / `needsToResearch`
 * which can stay stale across phase transitions (e.g. when ACTION ends
 * and a Turmoil prompt fires, `activePlayer` may still point at the
 * last actor, but it is NOT the one being prompted).
 *
 * The phase-specific label distinguishes WHAT they're being waited on
 * for: action turn / research / drafting / Turmoil decision.
 */
export function actionLabelForPlayer(
  playerView: ViewModel,
  player: PublicPlayerModel,
  livePlayersWaitingFor?: ReadonlyArray<Color>,
): ActionLabel {
  const game = playerView.game;
  const isWaiting = isPlayerWaiting(player, livePlayersWaitingFor);

  if (isWaiting) {
    // A specific prompt-kind from the server (World Government Terraforming
    // or Turmoil delegate) takes priority over the generic phase-based label.
    // Detection is in ServerModel.detectWaitingForKind — based on the title
    // of the player's current waitingFor.
    if (player.waitingForKind === 'globalsupport') return 'globalsupport';
    if (player.waitingForKind === 'delegate') return 'delegate';

    switch (game.phase) {
    case Phase.INITIALDRAFTING:
    case Phase.DRAFTING:
    case Phase.PRELUDES:
    case Phase.CEOS:
      return 'drafting';
    case Phase.RESEARCH:
      return 'researching';
    default:
      return 'turn';
    }
  }

  if (game.passedPlayers.includes(player.color)) {
    return 'passed';
  }

  // "next" label is only meaningful during ACTION phase — show it on the
  // player who's up immediately after the current actor (so multi-player
  // games have a clear "you're on deck" hint).
  if (game.phase === Phase.ACTION) {
    const notPassedPlayers = playerView.players.filter(
      (p) => !game.passedPlayers.includes(p.color),
    );
    const currentPlayerIndex = playerIndexInList(player.color, notPassedPlayers);
    if (currentPlayerIndex !== -1 && playerView.players.length > SHOW_NEXT_LABEL_MIN) {
      const prevPlayerIndex = currentPlayerIndex === 0 ?
        notPassedPlayers.length - 1 :
        currentPlayerIndex - 1;
      if (isPlayerWaiting(notPassedPlayers[prevPlayerIndex], livePlayersWaitingFor)) {
        return 'next';
      }
    }
  }

  return 'none';
}

function isPlayerWaiting(
  player: PublicPlayerModel,
  livePlayersWaitingFor: ReadonlyArray<Color> | undefined,
): boolean {
  return livePlayersWaitingFor !== undefined
    ? livePlayersWaitingFor.includes(player.color)
    : player.isWaitingForInput;
}
