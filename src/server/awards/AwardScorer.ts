import {PlayerId} from '../../common/Types';
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {IAward} from './IAward';
import {CardName} from '../../common/cards/CardName';
import {ASIMOV_AWARD_BONUS} from '../../common/constants';
import {AutomaMAEvaluation} from '../automa/AutomaMAEvaluation';

export class AwardScorer {
  private scores: Map<PlayerId, number> = new Map();
  constructor(game: IGame, award: IAward) {
    for (const player of game.players) {
      // MarsBot's award strength comes from the board reference card (its
      // tracks), never its played cards — one patch point covers the award
      // overlay, the bot's own funding decisions AND the endgame scoring.
      if (player.isMarsBot) {
        this.scores.set(player.id, AutomaMAEvaluation.botAwardScore(award, game));
        continue;
      }
      let score = award.getScore(player);
      if (player.tableau.has(CardName.ASIMOV)) {
        score += ASIMOV_AWARD_BONUS;
      }
      this.scores.set(player.id, score);
    }
  }

  public get(player: IPlayer): number {
    // Ideally throw when player does not match, but this is OK.
    return this.scores.get(player.id) ?? 0;
  }
}
