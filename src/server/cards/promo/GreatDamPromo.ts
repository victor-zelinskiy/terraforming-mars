import {IProjectCard} from '../IProjectCard';
import {CardMetadata} from '../../../common/cards/CardMetadata';
import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {TileType} from '../../../common/TileType';
import {CardRenderer} from '../render/CardRenderer';
import {Card} from '../Card';
import {AdjacencyBonus} from '../../ares/AdjacencyBonus';
import {Board} from '../../boards/Board';
import {Space} from '../../boards/Space';
import {PlaceTile} from '../../deferredActions/PlaceTile';
import {CanAffordOptions, IPlayer} from '../../IPlayer';
import {message} from '../../logs/MessageBuilder';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as reason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';

export class GreatDamPromo extends Card implements IProjectCard {
  constructor(
    name = CardName.GREAT_DAM_PROMO,
    adjacencyBonus: AdjacencyBonus | undefined = undefined,
    metadata: CardMetadata = {
      infoText: [
        {text: 'Increase your energy production 2 steps.', tokens: ['production(']},
        {text: 'Place this tile adjacent to an ocean tile.', tokens: ['tile-']},
      ],
      cardNumber: 'X32',
      renderData: CardRenderer.builder((b) => {
        b.production((pb) => pb.energy(2)).tile(TileType.GREAT_DAM, true, false).asterix();
      }),
      description: 'Requires 4 ocean tiles. Increase your energy production 2 steps. Place this tile ADJACENT TO an ocean tile.',
    },
  ) {
    super({
      type: CardType.AUTOMATED,
      name,
      cost: 15,
      tags: [Tag.POWER, Tag.BUILDING],
      metadata,
      adjacencyBonus,

      behavior: {
        production: {energy: 2},
      },

      requirements: {oceans: 4},
      victoryPoints: 1,
    });
  }
  public override bespokeCanPlay(player: IPlayer, canAffordOptions: CanAffordOptions): boolean {
    return this.getAvailableSpaces(player, canAffordOptions).length > 0;
  }

  // The oceans requirement is auto-explained, but the bespoke tile placement
  // (a land cell adjacent to an ocean) isn't — name it.
  public unplayableReason(player: IPlayer): UnplayableReason | undefined {
    if (this.getAvailableSpaces(player).length === 0) {
      return reason.placementReason('No space adjacent to an ocean to place the tile');
    }
    return undefined;
  }

  public override bespokePlay(player: IPlayer) {
    const board = player.game.board;
    const placeable = new Set(board.getAvailableSpacesOnLand(player).map((s) => s.id));
    player.game.defer(
      new PlaceTile(player, {
        tile: {tileType: TileType.GREAT_DAM, card: this.name},
        on: () => this.getAvailableSpaces(player),
        title: message('Select space for ${0}', (b) => b.card(this)),
        adjacencyBonus: this.adjacencyBonus,
        placementType: 'land',
        customReasoner: (space) => {
          if (placeable.has(space.id) && !board.getAdjacentSpaces(space).some((s) => Board.isOceanSpace(s))) {
            return 'requires-adjacent-ocean';
          }
          return undefined;
        },
      }));
    return undefined;
  }

  public cardPlayPreview(player: IPlayer): ActionPreview {
    return actionPreviews.placementPreview(this, player, {text: 'After confirming, place the tile next to an ocean.'});
  }

  private getAvailableSpaces(player: IPlayer, canAffordOptions?: CanAffordOptions): Array<Space> {
    return player.game.board.getAvailableSpacesOnLand(player, canAffordOptions)
      .filter(
        (space) => player.game.board.getAdjacentSpaces(space).filter(
          (adjacentSpace) => Board.isOceanSpace(adjacentSpace),
        ).length > 0,
      );
  }
}

