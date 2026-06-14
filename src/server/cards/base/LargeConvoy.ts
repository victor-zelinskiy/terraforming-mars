import {IPlayer} from '../../IPlayer';
import {Card} from '../Card';
import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {PlayerInput} from '../../PlayerInput';
import {CardResource} from '../../../common/CardResource';
import {CardName} from '../../../common/cards/CardName';
import {Resource} from '../../../common/Resource';
import {Priority} from '../../deferredActions/Priority';
import {CardRenderer} from '../render/CardRenderer';
import {Size} from '../../../common/cards/render/Size';
import {digit} from '../Options';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {gainOrAddResourceChoice, gainOrAddResourceBranches, hasAddTarget, GainSpec, AddSpec} from '../gainOrAddResource';

export class LargeConvoy extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.EVENT,
      name: CardName.LARGE_CONVOY,
      tags: [Tag.EARTH, Tag.SPACE],
      cost: 36,
      victoryPoints: 2,

      behavior: {
        drawCard: 2,
        ocean: {},
      },

      metadata: {
        cardNumber: '143',
        renderData: CardRenderer.builder((b) => {
          b.oceans(1).cards(2).br;
          b.plants(5, {digit}).or(Size.MEDIUM).resource(CardResource.ANIMAL, {amount: 4, digit}).asterix();
        }),
        description: 'Place an ocean tile and draw 2 cards. Gain 5 plants or add 4 animals to ANOTHER card.',
      },
    });
  }

  // "Gain 5 plants OR add 4 animals to ANOTHER card." Shared, drift-free builder
  // (see `gainOrAddResource`); the draw 2 + ocean ride the declarative `behavior`.
  private static readonly GAIN: GainSpec = {resource: Resource.PLANTS, amount: 5};
  private static readonly ADDS: ReadonlyArray<AddSpec> = [
    {resource: CardResource.ANIMAL, amount: 4},
  ];

  public override bespokePlay(player: IPlayer): PlayerInput | undefined {
    if (!hasAddTarget(player, LargeConvoy.ADDS)) {
      player.stock.add(LargeConvoy.GAIN.resource, LargeConvoy.GAIN.amount, {log: true});
      return undefined;
    }
    // Resolve the choice ahead of the ocean so the play modal pre-collects it.
    player.defer(
      gainOrAddResourceChoice(player, LargeConvoy.GAIN, LargeConvoy.ADDS),
      Priority.PLAY_CARD_RESOURCE_CHOICE);
    return undefined;
  }

  public cardPlayPreview(player: IPlayer): ActionPreview {
    return gainOrAddResourceBranches(player, this, LargeConvoy.GAIN, LargeConvoy.ADDS);
  }
}
