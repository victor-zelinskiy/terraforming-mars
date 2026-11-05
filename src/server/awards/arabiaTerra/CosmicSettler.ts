import {IAward} from '../IAward';
import {ICard} from '../../cards/ICard';
import {IPlayer} from '../../IPlayer';

export class CosmicSettler implements IAward {
  public readonly name = 'Cosmic Settler';
  public readonly description = 'Own the most cities not on Mars';
  public getScore(player: IPlayer): number {
    return player.game.board.getCitiesOffMars(player).length;
  }

  /**
   * Does this card place a city OFF MARS? — a declarative city on a NAMED space (Ganymede Colony, Phobos Space Haven,
   * Stanford Torus, the Venus cities, …): every named city space is an off-Mars colony slot (Noctis City is bespoke
   * and on Mars). MarsBot's reading of this award counts such cards in its played pile (it owns no off-Mars city —
   * its cities are placed by track icons, on Mars); co-located so the two readings cannot drift.
   */
  public static placesCityOffMars(card: ICard): boolean {
    return card.behavior?.city?.space !== undefined;
  }
}
