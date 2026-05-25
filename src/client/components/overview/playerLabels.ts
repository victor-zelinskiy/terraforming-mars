import {ViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
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

export function actionLabelForPlayer(playerView: ViewModel, player: PublicPlayerModel): ActionLabel {
  const game = playerView.game;
  if (game.phase === Phase.DRAFTING) {
    return player.needsToDraft ? 'drafting' : 'none';
  }
  if (game.phase === Phase.RESEARCH) {
    return player.needsToResearch ? 'researching' : 'none';
  }
  if (game.passedPlayers.includes(player.color)) {
    return 'passed';
  }
  if (player.isActive) {
    return 'active';
  }
  const notPassedPlayers = playerView.players.filter(
    (p) => !game.passedPlayers.includes(p.color),
  );
  const currentPlayerIndex = playerIndexInList(player.color, notPassedPlayers);
  if (currentPlayerIndex === -1) {
    return 'none';
  }
  const prevPlayerIndex = currentPlayerIndex === 0 ?
    notPassedPlayers.length - 1 :
    currentPlayerIndex - 1;
  const isNext = notPassedPlayers[prevPlayerIndex].isActive;
  if (isNext && playerView.players.length > SHOW_NEXT_LABEL_MIN) {
    return 'next';
  }
  return 'none';
}
