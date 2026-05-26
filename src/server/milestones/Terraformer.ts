import {IMilestone} from './IMilestone';
import {IPlayer} from '../IPlayer';
import {IGame} from '../IGame';
import {Turmoil} from '../turmoil/Turmoil';

export class Terraformer implements IMilestone {
  public readonly name = 'Terraformer';
  private terraformRating: number = 35;
  private terraformRatingTurmoil: number = 26;
  // Static fallback used in contexts where no IGame is available (e.g. the
  // pre-game manifest in `genfiles/milestones.json`). Per-game UI prefers
  // getDescription(game) below.
  public readonly description = 'Have a terraform rating of 35 (or 26 with Turmoil.)';
  public getScore(player: IPlayer): number {
    return player.terraformRating;
  }
  public canClaim(player: IPlayer): boolean {
    return this.getScore(player) >= this.getThreshold(player.game);
  }
  public getThreshold(game: IGame): number {
    return Turmoil.ifTurmoilElse(game, () => this.terraformRatingTurmoil, () => this.terraformRating);
  }
  public getDescription(game: IGame): string {
    // Plain string literals (not template expressions) so the i18n system
    // can match them against translation keys exactly.
    return Turmoil.ifTurmoilElse(
      game,
      () => 'Have a terraform rating of 26',
      () => 'Have a terraform rating of 35',
    );
  }
}
