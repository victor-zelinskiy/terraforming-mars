import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {PlayerInput} from '../../PlayerInput';
import {CardResource} from '../../../common/CardResource';
import {CardName} from '../../../common/cards/CardName';
import {Resource} from '../../../common/Resource';
import {Priority} from '../../deferredActions/Priority';
import {CardRenderer} from '../render/CardRenderer';
import {digit} from '../Options';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {gainOrAddResourceChoice, gainOrAddResourceBranches, hasAddTarget, GainSpec, AddSpec} from '../gainOrAddResource';

export class ImportedHydrogen extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.EVENT,
      name: CardName.IMPORTED_HYDROGEN,
      tags: [Tag.EARTH, Tag.SPACE],
      cost: 16,

      behavior: {
        ocean: {},
      },

      metadata: {
        cardNumber: '019',
        renderData: CardRenderer.builder((b) => {
          b.plants(3, {digit});
          b.or();
          b.resource(CardResource.MICROBE, {amount: 3, digit}).asterix().or();
          b.resource(CardResource.ANIMAL, {amount: 2, digit}).asterix().br;
          b.oceans(1);
        }),
        description: 'Gain 3 plants, or add 3 microbes or 2 animals to ANOTHER card. Place an ocean tile.',
      },
    });
  }

  // "Gain 3 plants OR add 3 microbes / 2 animals to ANOTHER card." The fallback
  // and the two add-alternatives are built by the shared, drift-free
  // `gainOrAddResource` helper (same spec drives the live choice and the preview).
  private static readonly GAIN: GainSpec = {resource: Resource.PLANTS, amount: 3};
  private static readonly ADDS: ReadonlyArray<AddSpec> = [
    {resource: CardResource.MICROBE, amount: 3},
    {resource: CardResource.ANIMAL, amount: 2},
  ];

  public override bespokePlay(player: IPlayer): undefined | PlayerInput {
    // No card can hold microbes/animals → the alternatives are impossible; gain the
    // fallback directly (the preview still SHOWS them disabled-with-reason).
    if (!hasAddTarget(player, ImportedHydrogen.ADDS)) {
      player.stock.add(ImportedHydrogen.GAIN.resource, ImportedHydrogen.GAIN.amount, {log: true});
      return undefined;
    }
    // Defer the choice ahead of the ocean (PLAY_CARD_RESOURCE_CHOICE < PLACE_OCEAN_TILE)
    // so the play modal pre-collects it; the ocean then rides PlacementBanner.
    player.defer(
      gainOrAddResourceChoice(player, ImportedHydrogen.GAIN, ImportedHydrogen.ADDS),
      Priority.PLAY_CARD_RESOURCE_CHOICE);
    return undefined;
  }

  public cardPlayPreview(player: IPlayer): ActionPreview {
    return gainOrAddResourceBranches(player, this, ImportedHydrogen.GAIN, ImportedHydrogen.ADDS);
  }
}
