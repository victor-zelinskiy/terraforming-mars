import {Card} from '../Card';
import {CardName} from '../../../common/cards/CardName';
import {PlaceTile} from '../../../server/deferredActions/PlaceTile';
import {CanAffordOptions, IPlayer} from '../../IPlayer';
import {SpaceBonus} from '../../../common/boards/SpaceBonus';
import {TileType} from '../../../common/TileType';
import {CardType} from '../../../common/cards/CardType';
import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {CardRenderer} from '../render/CardRenderer';
import {message} from '../../logs/MessageBuilder';
import {Units} from '../../../common/Units';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {AdjacencyBonus} from '../../ares/AdjacencyBonus';
import {Space} from '../../boards/Space';
import {BoardFact} from '../../../common/boards/BoardInformationFacts';
import {Resource} from '../../../common/Resource';
import * as actionPreviews from '../actionPreviews';
import * as placementPreviews from '../placementPreviews';

/** The adjacency bonus this tile hands to future neighbours (2 energy). Declared
 *  on the card so BOTH the live placement and the read-only preview read the SAME
 *  value — the preview derives it generically from `Card.adjacencyBonus`. */
const SOLAR_FARM_ADJACENCY: AdjacencyBonus = {bonus: [SpaceBonus.ENERGY, SpaceBonus.ENERGY]};

export class SolarFarm extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.AUTOMATED,
      name: CardName.SOLAR_FARM,
      tags: [Tag.POWER, Tag.BUILDING],
      cost: 12,
      adjacencyBonus: SOLAR_FARM_ADJACENCY,

      metadata: {
        cardNumber: 'A17',
        renderData: CardRenderer.builder((b) => {
          b.production((pb) => {
            pb.energy(1).slash().plants(1);
          }).asterix().nbsp.tile(TileType.SOLAR_FARM, false, true).br;
        }),
        description: 'Place this tile which grants an ADJACENCY BONUS of 2 energy. Increase your energy production 1 step for each plant resource on the area where you place the tile.',
        infoText: [
          {text: 'Place a special tile that grants an adjacency bonus of 2 energy.', tokens: ['tile-']},
          {text: 'Increase your energy production 1 step for each plant resource on the area where you place the tile.', tokens: ['production(']},
        ],
      },
    });
  }

  public override bespokeCanPlay(player: IPlayer, canAffordOptions: CanAffordOptions): boolean {
    return player.game.board.getAvailableSpacesOnLand(player, canAffordOptions).length > 0;
  }

  /** Energy production granted for a space — one step per PLANT bonus printed on
   *  it. The single rule source, shared by the live play and the preview. */
  private energyFor(space: Space): number {
    return space.bonus.filter((b) => b === SpaceBonus.PLANT).length;
  }

  public productionBox(player: IPlayer) {
    const space = player.game.board.getSpaceByTileCard(this.name);
    if (space === undefined) {
      throw new Error('Solar Farm space not found');
    }
    return Units.of({energy: this.energyFor(space)});
  }

  public override bespokePlay(player: IPlayer) {
    player.game.defer(
      new PlaceTile(player, {
        tile: {tileType: TileType.SOLAR_FARM, card: this.name},
        on: 'land',
        title: message('Select space for ${0} tile', (b) => b.card(this)),
        adjacencyBonus: SOLAR_FARM_ADJACENCY,
      }).andThen(() => {
        player.production.adjust(this.productionBox(player), {log: true});
      }));
    return undefined;
  }

  public cardPlayPreview(player: IPlayer): ActionPreview {
    return actionPreviews.placementPreview(this, player, {tile: TileType.SOLAR_FARM});
  }

  /**
   * The whole point of choosing a space for this card: the energy production is
   * the number of PLANT bonuses the area prints (0, 1 or 2). Without this the
   * placement panel showed only "cell bonus +2 plants" and the player learned the
   * production — the card's actual payload — after committing.
   */
  public placementPreview(player: IPlayer, space: Space): ReadonlyArray<BoardFact> {
    const energy = this.energyFor(space);
    if (energy === 0) {
      return [placementPreviews.noEffectHere(this,
        'No plant bonus on this area — no energy production',
        {description: 'This card raises energy production by 1 per plant bonus on the chosen area.'})];
    }
    // No description: the title already says WHY the number is what it is, and
    // the chip says what it becomes. A second line would only restate both.
    return [placementPreviews.productionChange(player, this, Resource.ENERGY, energy,
      'Energy production from the area\'s plant bonuses')];
  }
}
