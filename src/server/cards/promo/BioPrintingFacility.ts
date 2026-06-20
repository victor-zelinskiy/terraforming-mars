import {IProjectCard} from '../IProjectCard';
import {IActionCard} from '../ICard';
import {Card} from '../Card';
import {CardName} from '../../../common/cards/CardName';
import {CardType} from '../../../common/cards/CardType';
import {CardResource} from '../../../common/CardResource';
import {Tag} from '../../../common/cards/Tag';
import {IPlayer} from '../../IPlayer';
import {Resource} from '../../../common/Resource';
import {SelectCard} from '../../inputs/SelectCard';
import {OrOptions} from '../../inputs/OrOptions';
import {SelectOption} from '../../inputs/SelectOption';
import {CardRenderer} from '../render/CardRenderer';
import {digit} from '../Options';
import * as actionReason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';

export class BioPrintingFacility extends Card implements IActionCard, IProjectCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.BIO_PRINTING_FACILITY,
      tags: [Tag.BUILDING],
      cost: 7,

      metadata: {
        cardNumber: 'X36',
        // TWO action boxes (not one box with an internal OR) STACKED VERTICALLY with
        // an `or` divider between them (mirrors RegolithEaters), so the ДЕЙСТВИЯ overlay
        // renders the card as TWO separate, individually-selectable action rows (the
        // fork's split-action model) instead of one row that forces a branch choice
        // INSIDE the confirm modal. Each box maps to its own preview branch (per-row
        // select → its own confirm + per-branch stats). The 2 energy cost is shown on
        // BOTH boxes (each branch spends it). The `.br` between boxes is load-bearing:
        // without it the two boxes render SIDE BY SIDE and overflow the card width
        // (their descriptions never wrap) — the bug this layout fixes.
        renderData: CardRenderer.builder((b) => {
          b.action('Spend 2 energy to gain 2 plants.', (eb) => {
            eb.energy(2, {digit}).startAction.plants(2);
          }).br;
          b.or().br;
          b.action('Spend 2 energy to add 1 animal to ANOTHER card.', (eb) => {
            eb.energy(2, {digit}).startAction.resource(CardResource.ANIMAL).asterix();
          });
        }),
      },
    });
  }

  public canAct(player: IPlayer): boolean {
    return player.energy >= 2;
  }

  public actionUnavailableReason() {
    return actionReason.notEnoughEnergy();
  }

  // Branch order MUST match action(): add-animal (only when an animal card
  // exists) pushed first, gain-plants second. 2 energy is always spent. The
  // render-node order (plants box, then animal box) DIFFERS — the overlay maps
  // each node to its branch by token overlap (branchPositionForNode), so this is
  // fine. The animal branch PRE-COLLECTS the destination card via the premium
  // target picker (`optionInput`), shown EVEN for one candidate (no-autoselect).
  public actionPreview(player: IPlayer) {
    const animalCards = player.getResourceCards(CardResource.ANIMAL);
    const hasAnimalCard = animalCards.length > 0;
    return actionPreviews.orBranches(this, [
      {
        available: hasAnimalCard,
        title: 'Add 1 animal to another card',
        effects: [actionPreviews.stockCost(player, Resource.ENERGY, 2), actionPreviews.cardResourceGain(CardResource.ANIMAL, 1)],
        // The branch's OrOptions option IS this SelectCard, so its picked-card
        // response nests into the branch pick — collected BEFORE confirm.
        optionInput: hasAnimalCard ? actionPreviews.cardInput(player, 'Select card to add 1 animal', 'Add animal', animalCards) : undefined,
        unavailableReason: actionReason.targetReason('No card to add an animal to'),
      },
      {
        available: true,
        title: 'Gain 2 plants',
        effects: [actionPreviews.stockCost(player, Resource.ENERGY, 2), actionPreviews.stockGain(player, Resource.PLANTS, 2)],
      },
    ]);
  }

  public action(player: IPlayer) {
    const availableAnimalCards = player.getResourceCards(CardResource.ANIMAL);
    player.stock.deduct(Resource.ENERGY, 2);

    if (availableAnimalCards.length === 0) {
      player.stock.add(Resource.PLANTS, 2, {log: true});
      return undefined;
    }

    const gainPlantOption = new SelectOption('Gain 2 plants', 'Gain plants').andThen(() => {
      player.stock.add(Resource.PLANTS, 2, {log: true});
      return undefined;
    });

    // ALWAYS a SelectCard for the animal branch — even for a single candidate — so
    // the player ALWAYS sees/picks WHERE the animal goes (matches the premium
    // confirm modal's pre-collected `optionInput`, byte-for-byte). The OrOptions
    // option order (animal first, plants second) matches actionPreview's branch order.
    return new OrOptions(
      new SelectCard(
        'Select card to add 1 animal',
        'Add animal',
        availableAnimalCards)
        .andThen(([card]) => {
          player.addResourceTo(card, {log: true});
          return undefined;
        }),
      gainPlantOption,
    );
  }
}
