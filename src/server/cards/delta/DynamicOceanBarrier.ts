import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {IPlayer} from '../../IPlayer';
import {Space} from '../../boards/Space';
import {Board} from '../../boards/Board';
import {BoardType} from '../../boards/BoardType';
import {Phase} from '../../../common/Phase';
import {BonusDeltaAdvance} from '../../deferredActions/BonusDeltaAdvance';

export class DynamicOceanBarrier extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.DYNAMIC_OCEAN_BARRIER,
      tags: [Tag.BUILDING],
      cost: 8,

      metadata: {
        cardNumber: 'DP03',
        renderData: CardRenderer.builder((b) => {
          b.effect('Whenever you place an ocean tile, you may move 1 step on the Hydronetwork without paying energy. If you pay 1 energy for this action, you may ignore 1 required tag.', (eb) => {
            eb.oceans(1).startEffect.plate('Hydronetwork').asterix();
          });
        }),
      },
    });
  }

  /**
   * The trigger. `Game.addTile` is the ONE server-authoritative placement
   * event, so this is the only place that can honestly answer «did MY owner
   * really place an ocean?» — never a route, never the open client.
   *
   * Four gates, each for a case the rules exclude:
   *  - `BoardType.MARS` — the Moon has its own board and no Delta track link;
   *  - `cardOwner === activePlayer` — someone else's ocean pays nobody;
   *  - `Board.isUncoveredOceanSpace` — a REAL ocean tile is now on the board
   *    (a raised ocean parameter with no tile, and a failed/cancelled
   *    placement, never reach this callback at all);
   *  - `Phase.SOLAR` — World Government / neutral terraforming. The owner may
   *    be the one picking the coordinate, but the placement is not theirs:
   *    `addTile` itself skips the placement bonuses and clears `space.player`
   *    for exactly this phase.
   *
   * Whether the move is POSSIBLE is deliberately not asked here — the queued
   * action re-asks the standard movement pipeline at execute time, which is
   * the only moment the answer is still true (two oceans queue two offers and
   * the first one moves the marker).
   */
  public onTilePlaced(cardOwner: IPlayer, activePlayer: IPlayer, space: Space, boardType: BoardType) {
    if (boardType !== BoardType.MARS || cardOwner !== activePlayer) {
      return;
    }
    if (!Board.isUncoveredOceanSpace(space) || cardOwner.game.phase === Phase.SOLAR) {
      return;
    }
    if (cardOwner.deltaProjectData === undefined) {
      return;
    }
    cardOwner.game.defer(new BonusDeltaAdvance(cardOwner, this));
  }
}
