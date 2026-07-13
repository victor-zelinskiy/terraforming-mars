import {CardType} from '../../../common/cards/CardType';
import {IProjectCard} from '../IProjectCard';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Card} from '../Card';
import {Tag} from '../../../common/cards/Tag';
import {IPlayer} from '../../IPlayer';
import {UnderworldExpansion} from '../../underworld/UnderworldExpansion';
import {createMarsSelectSpace} from '../../boards/marsSelectSpaceHelper';

export class ArtesianAquifer extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.AUTOMATED,
      name: CardName.ARTESIAN_AQUIFER,
      tags: [Tag.BUILDING],
      cost: 16,

      tr: {oceans: 1},

      metadata: {
        cardNumber: 'U059',
        renderData: CardRenderer.builder((b) => {
          b.excavate().asterix().oceans(1);
        }),
        description: 'Excavate 1 underground resource on ANY SPACE RESERVED FOR AN OCEAN. Then, place an ocean tile there, if possible.',
      },
    });
  }

  private availableSpaces(player: IPlayer) {
    return player.game.board.getAvailableSpacesForOcean(player).filter((space) => space.excavator === undefined);
  }

  public override bespokeCanPlay(player: IPlayer): boolean {
    if (!player.game.canAddOcean()) {
      this.addWarning('maxoceans');
    }
    return this.availableSpaces(player).length > 0;
  }

  public override bespokePlay(player: IPlayer) {
    return createMarsSelectSpace(
      player,
      'Select space to excavate and place ocean',
      this.availableSpaces(player),
      {
        placementType: 'ocean',
        customReasoner: (space) => {
          // Excavated ocean reserves are filtered out; generic check
          // doesn't know about excavator tokens.
          if (space.spaceType === 'ocean' && space.tile === undefined && space.excavator !== undefined) {
            return 'already-excavated';
          }
          return undefined;
        },
      })
      .andThen((space) => {
        UnderworldExpansion.excavate(player, space);
        player.game.addOcean(player, space);
        return undefined;
      });
  }
}
