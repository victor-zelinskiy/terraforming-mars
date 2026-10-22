import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {PartyName} from '../../../common/turmoil/PartyName';
import {Resource} from '../../../common/Resource';
import {CardRenderer} from '../render/CardRenderer';
import {Size} from '../../../common/cards/render/Size';
import {Card} from '../Card';
import {SpaceType} from '../../../common/boards/SpaceType';
import {Board} from '../../boards/Board';
import {Space} from '../../boards/Space';
import {ActionEffect, ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as actionPreviews from '../actionPreviews';

export class RedTourismWave extends Card implements IProjectCard {
  constructor() {
    super({
      cost: 3,
      tags: [Tag.EARTH],
      name: CardName.RED_TOURISM_WAVE,
      type: CardType.EVENT,

      requirements: {party: PartyName.REDS},
      metadata: {
        // ONE block for the one bonus (T12 — a bespoke play is `needsCuration` for the generator the moment it enters the
        // premium scope; the requirement is the cassette's own prose).
        infoText: [
          {text: 'Gain 1 M€ for each empty area adjacent to your tiles.', tokens: ['megacredits']},
        ],
        cardNumber: 'T12',
        renderData: CardRenderer.builder((b) => {
          b.megacredits(1).slash().emptyTile('normal', {size: Size.SMALL}).asterix();
        }),
        description: 'Requires that Reds are ruling or that you have 2 delegates there. Gain 1 M€ from each EMPTY AREA ADJACENT TO YOUR TILES',
      },
    });
  }

  public override bespokePlay(player: IPlayer) {
    const amount = RedTourismWave.getAdjacentEmptySpacesCount(player);
    player.stock.add(Resource.MEGACREDITS, amount, {log: true});
    return undefined;
  }

  // THE COUNTED PLAY (T12): the M€ with what it counted — the number AND the cells. The hand tile's plate, the composer's
  // chip and its «ПОЧЕМУ», and the board peek (L3 «Показать на поле» — the counted cells on the field) all read this one
  // reading; a zero names itself instead of a bare «0».
  public countedPlayForecast(player: IPlayer): ReadonlyArray<ActionEffect> {
    return [RedTourismWave.emptyAreasGain(player)];
  }

  public cardPlayPreview(player: IPlayer): ActionPreview {
    return actionPreviews.playPreview(this, player, this.countedPlayForecast(player));
  }

  /**
   * «+N M€ — N empty areas next to your tiles», with the cells: the ONE chip of the rule «1 M€ per empty area adjacent
   * to your tiles» (this card and Hermetic Order of Mars). The count is the play's own static, the cells are the same
   * walk's — `RedTourismWave.spec` pins that they never disagree.
   */
  public static emptyAreasGain(player: IPlayer): ActionEffect {
    const spaces = RedTourismWave.getAdjacentEmptySpaces(player);
    return actionPreviews.counted(actionPreviews.stockGain(player, Resource.MEGACREDITS, spaces.length), {
      count: spaces.length,
      label: 'Empty areas next to your tiles',
      spaces: spaces.map((s) => s.id),
      zero: 'No empty areas next to your tiles',
    });
  }

  /** The empty areas the count counts, in the board's order — the same predicate as `getAdjacentEmptySpacesCount`. */
  public static getAdjacentEmptySpaces(player: IPlayer): ReadonlyArray<Space> {
    const board = player.game.board;
    return board.spaces.filter((space) => {
      if (space.spaceType === SpaceType.COLONY || space.spaceType === SpaceType.RESTRICTED || Board.hasRealTile(space)) {
        return false;
      }
      return board.getAdjacentSpaces(space).some((adj) => Board.hasRealTile(adj) && adj.player === player);
    });
  }

  // This is static because it's shared with Tourist.
  public static getAdjacentEmptySpacesCount(player: IPlayer): number {
    const board = player.game.board;
    return board.spaces.filter((space) => {
      if (space.spaceType === SpaceType.COLONY) {
        return false;
      }
      if (space.spaceType === SpaceType.RESTRICTED) {
        return false;
      }
      if (Board.hasRealTile(space)) {
        return false;
      }
      return board.getAdjacentSpaces(space).some((adj) => {
        return Board.hasRealTile(adj) && adj.player === player;
      });
    }).length;
  }
}
