import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {IPlayer} from '../../IPlayer';
import {Space} from '../../boards/Space';
import {UnderworldExpansion} from '../../underworld/UnderworldExpansion';
import {Card, productionBoxWithBonusResource} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {IProjectCard} from '../../cards/IProjectCard';
import {Resource} from '../../../common/Resource';
import {SelectSpace} from '../../inputs/SelectSpace';
import {Tag} from '../../../common/cards/Tag';
import {UndergroundResourceToken} from '../../../common/underworld/UndergroundResourceToken';
import {createMarsSelectSpace} from '../../boards/marsSelectSpaceHelper';

export class Deepmining extends Card implements IProjectCard {
  public readonly title = 'Select an identified space with a steel or titanium bonus';
  public bonusResource: Array<Resource> | undefined;

  constructor() {
    super({
      name: CardName.DEEPMINING,
      cost: 11,
      type: CardType.AUTOMATED,
      tags: [Tag.BUILDING],
      metadata: {
        cardNumber: 'U029',
        renderData: CardRenderer.builder((b) => {
          b.excavate(1).asterix().br;
          b.production((pb) => pb.steel(1).or().titanium(1)).asterix();
        }),
        description: 'Excavate an underground resource that depicts steel or titanium ANYWHERE ON THE BOARD. ' +
          'Increase your production of that resource 1 step.',
      },
    });
  }

  steelTokens: ReadonlyArray<UndergroundResourceToken> = [
    'steel1production',
    'steel2',
    'steel2plant',
    'steel2pertemp',
  ] as const;
  titaniumTokens: ReadonlyArray<UndergroundResourceToken> = [
    'titanium1pertemp',
    'titanium1production',
    'titanium2',
    'titaniumandplant',
  ] as const;

  public override bespokeCanPlay(player: IPlayer): boolean {
    return this.getAvailableSpaces(player).length > 0;
  }

  public getAvailableSpaces(player: IPlayer): ReadonlyArray<Space> {
    return player.game.board.spaces.filter((space) => {
      if (space.excavator !== undefined) {
        return false;
      }
      if (space.undergroundResources === undefined) {
        return false;
      }
      if (this.steelTokens.includes(space.undergroundResources)) {
        return true;
      }
      if (this.titaniumTokens.includes(space.undergroundResources)) {
        return true;
      }
      return false;
    });
  }

  public override bespokePlay(player: IPlayer): SelectSpace {
    // Operates on tokens, not empty cells. Three distinct reasons:
    //   - no token identified (most cells)
    //   - already excavated
    //   - wrong bonus type (token is neither steel nor titanium)
    // Generic 'occupied' / 'reserved-*' would be misleading.
    const allTokens: ReadonlyArray<UndergroundResourceToken> = [...this.steelTokens, ...this.titaniumTokens];
    return createMarsSelectSpace(player, this.title, this.getAvailableSpaces(player), {
      customReasoner: (space) => {
        if (space.undergroundResources === undefined) return 'not-identified';
        if (space.excavator !== undefined) return 'already-excavated';
        if (!allTokens.includes(space.undergroundResources)) return 'wrong-bonus-type';
        return undefined;
      },
    })
      .andThen((space) => {
        this.spaceSelected(player, space);
        return undefined;
      });
  }

  public productionBox() {
    return productionBoxWithBonusResource(this);
  }

  protected spaceSelected(player: IPlayer, space: Space) {
    const token = UnderworldExpansion.excavate(player, space);
    if (token === undefined) {
      throw new Error('unexpected failed deep mining');
    }
    const resource = this.steelTokens.includes(token) ? Resource.STEEL : Resource.TITANIUM;
    player.production.add(resource, 1, {log: true});
    this.bonusResource = [resource];
  }
}
