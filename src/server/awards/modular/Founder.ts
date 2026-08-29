import {IAward} from '../IAward';
import {IPlayer} from '../../IPlayer';
import {Space} from '../../boards/Space';
import {Board, isSpecialTileSpace} from '../../boards/Board';

export class Founder implements IAward {
  public readonly name = 'Founder';
  public readonly description = 'Have the most tiles adjacent to special tiles.';

  public getScore(player: IPlayer): number {
    return Founder.count(player, isSpecialTileSpace);
  }

  /**
   * The counting itself, with the «what is a special tile» question injected.
   *
   * ONE implementation, because Terra Cimmeria's Automa rule needs the same
   * count over a DIFFERENT set: «the Neural Instance tile counts as a special
   * tile for MarsBot but not for you» (Adding Expansions p.9). MarsBot uses the
   * canonical classifier above (which already answers TRUE for it); the human
   * side of an automa game passes a set without it
   * (`AutomaMAEvaluation.humanAwardScore`). A second copy of these four lines
   * is exactly how the two would drift.
   */
  public static count(player: IPlayer, isSpecial: (space: Space) => boolean): number {
    const board = player.game.board;
    const specialTiles = board.spaces.filter(isSpecial);
    const adjacentToSpecialSpaces = new Set(specialTiles.map((s) => board.getAdjacentSpaces(s)).flat());

    return board.spaces.filter(Board.ownedBy(player))
      .filter((space) => space.tile !== undefined)
      .filter((space) => adjacentToSpecialSpaces.has(space))
      .length;
  }
}
