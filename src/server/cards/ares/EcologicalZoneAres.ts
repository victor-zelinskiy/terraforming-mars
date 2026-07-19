import {CardName} from '../../../common/cards/CardName';
import {EcologicalZone} from '../base/EcologicalZone';
import {SpaceBonus} from '../../../common/boards/SpaceBonus';
import {TileType} from '../../../common/TileType';
import {CardRenderer} from '../render/CardRenderer';
import {CardResource} from '../../../common/CardResource';
import {Tag} from '../../../common/cards/Tag';

export class EcologicalZoneAres extends EcologicalZone {
  constructor() {
    super(
      CardName.ECOLOGICAL_ZONE_ARES,
      11,
      {bonus: [SpaceBonus.ANIMAL]},
      {
        description: {
          text: 'Requires that YOU have a greenery tile. Place this tile adjacent to ANY greenery.',
          align: 'left',
        },
        // The vpText node crams the tile's adjacency bonus INTO the VP line, so
        // author the split: the adjacency belongs to the on-play tile, the VP
        // line is only «1 VP per 2 animals». (The effect is auto-extracted.)
        infoText: [
          {text: 'Place a special tile adjacent to any greenery.', tokens: ['tile-']},
          {text: 'The tile grants an adjacency bonus of 1 animal.', tokens: ['tile-']},
          {kind: 'victory-points', text: '1 VP per 2 animals on this card.'},
        ],
        cardNumber: 'A08',
        reimplements: CardName.ECOLOGICAL_ZONE,
        renderData: CardRenderer.builder((b) => {
          b.effect('When you play an animal or plant tag INCLUDING THESE, add an animal to this card.', (eb) => {
            eb.tag(Tag.ANIMAL).slash().tag(Tag.PLANT).startEffect.resource(CardResource.ANIMAL);
          }).br;
          // Render the Ares ecological-zone tile as the card's TILE GRAPHIC.
          // `isAres = true` selects `card-tile-ecological-zone-ares` (the custom
          // ares_ecological_zone.png) instead of the generic symbol tile. It
          // gets its OWN row (`.br` ends the vpText row first) so it renders
          // as a clean centred graphic — chaining it onto the long vpText made
          // it float to the right of the wrapped text.
          b.vpText('The tile grants an ADJACENCY BONUS of 1 animal. 1 VP per 2 animals on this card.').br;
          b.tile(TileType.ECOLOGICAL_ZONE, false, true);
        }),
      },
    );
  }
}
