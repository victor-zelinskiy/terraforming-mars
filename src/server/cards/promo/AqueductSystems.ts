import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Board} from '../../boards/Board';
import {nextTo} from '../Options';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import * as reason from '../actionReasons';

export class AqueductSystems extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.AUTOMATED,
      name: CardName.AQUEDUCT_SYSTEMS,
      tags: [Tag.BUILDING],
      cost: 9,

      victoryPoints: 1,

      behavior: {
        drawCard: {count: 3, tag: Tag.BUILDING},
      },

      requirements: [{cities: 1, nextTo}, {oceans: 1}],

      metadata: {
        cardNumber: 'X50',
        renderData: CardRenderer.builder((b) => {
          b.cards(3, {secondaryTag: Tag.BUILDING});
        }),
        description: 'Requires you have a city next to an ocean. Draw 3 cards with a building tag.',
      },
    });
  }

  public override bespokeCanPlay(player: IPlayer) {
    const board = player.game.board;
    const oceans = board.getOceanSpaces({upgradedOceans: true, wetlands: true});
    return oceans.some((ocean) => {
      return board.getAdjacentSpaces(ocean).some((space) => {
        return Board.isCitySpace(space) && space.player === player;
      });
    });
  }

  // The city/ocean requirements are auto-explained, but the bespoke nuance is that
  // the city must be YOURS (an opponent's city next to an ocean satisfies the
  // requirement yet still can't be played). Only surface it when a city of yours
  // and an ocean both exist, so the generic requirement reasons aren't duplicated.
  public unplayableReason(player: IPlayer): UnplayableReason | undefined {
    const board = player.game.board;
    const ownsCity = board.getCities(player).length > 0;
    const hasOcean = board.getOceanSpaces({upgradedOceans: true, wetlands: true}).length > 0;
    if (ownsCity && hasOcean && !this.bespokeCanPlay(player)) {
      return reason.targetReason('No city of yours next to an ocean');
    }
    return undefined;
  }
}
