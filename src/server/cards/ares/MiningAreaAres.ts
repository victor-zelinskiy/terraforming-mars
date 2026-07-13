import {CardName} from '../../../common/cards/CardName';
import {MiningArea} from '../base/MiningArea';
import {TileType} from '../../../common/TileType';
import {CardRenderer} from '../render/CardRenderer';

export class MiningAreaAres extends MiningArea {
  protected override readonly isAres = true;
  constructor() {
    super(
      CardName.MINING_AREA_ARES,
      {
        cardNumber: 'A14',
        infoText: [
          {text: 'Place this tile on an area with a steel or titanium placement bonus, adjacent to another of your tiles.', tokens: ['tile-']},
          {text: 'This tile provides an adjacency bonus of the same resource as the area.', tokens: ['tile-']},
          {text: 'Increase the matching production (steel or titanium) 1 step.', tokens: ['production(']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.tile(TileType.MINING_STEEL_BONUS, false, true);
          b.tile(TileType.MINING_TITANIUM_BONUS, false, true).asterix().br;
          b.production((pb) => {
            pb.steel(1).or().titanium(1);
          }).asterix();
        }),
        description: 'Place one of these tiles on an area with a steel or titanium placement bonus, ADJACENT TO ANOTHER OF YOUR TILES. This tile provides an ADJACENCY BONUS of the same resource as the area. Increase your production of that resource 1 step.',
      });
  }
}
