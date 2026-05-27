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

  // `passed` is checked BEFORE `isWaiting`. A passed player cannot be the
  // active waited-on player by definition, and `game.passedPlayers` is part
  // of the playerView so it updates atomically with `player.actionsTakenThisRound`
  // when the server processes the pass. Without this ordering, the live
  // `playersWaitingFor` poll (an independent timer signal) can briefly lag
  // and report the passer as still waiting — combined with the now-reset
  // `actionsTakenThisRound=0`, the LeftPlayerCard would flash "ДЕЙСТВИЕ 1/2"
  // for a tick before the poll catches up and the label switches to passed.
  if (game.passedPlayers.includes(player.color)) {
    return 'passed';
  }

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
  // Two signals carry "is this player being waited on by the server":
  //
  //  - `player.isWaitingForInput` from the playerView model — set when the
  //    server built the playerView (i.e. atomically with the POST response
  //    that resolved the previous action).
  //  - `livePlayersWaitingFor` from an independent poll timer in
  //    WaitingFor.vue — updates between full playerView refreshes so the
  //    UI can track simultaneous-action phases (drafting, research)
  //    without requiring a model refresh.
  //
  // When they disagree, the right tiebreaker depends on which is fresher.
  // The "passer-flash" bug is the canonical disagreement: the viewer just
  // passed, the POST response arrives with a fresh model where
  // `isWaitingForInput=false`, but the live poll hasn't caught up yet and
  // still lists the viewer as waiting. Trusting the live signal here makes
  // the LeftPlayerCard flash "ДЕЙСТВИЕ 1/2" for a tick before the poll
  // refreshes (because `actionsTakenThisRound` was reset to 0).
  //
  // Rule: if the model says NOT waiting, trust it — there's no realistic
  // scenario where the server-built playerView says false while the live
  // signal correctly says true (the live poll can update WITHOUT a model
  // refresh, but every model refresh comes from the server after the new
  // state is committed, so the model is never "behind" on `false`).
  if (!player.isWaitingForInput) {
    return false;
  }
  // Model says waiting. Defer to live signal when available — it can
  // legitimately disagree by saying "not waiting" if another player
  // resolved their simultaneous prompt between model refreshes.
  return livePlayersWaitingFor !== undefined
    ? livePlayersWaitingFor.includes(player.color)
    : true;
}
