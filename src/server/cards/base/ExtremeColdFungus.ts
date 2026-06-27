import {IActionCard} from '../ICard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {OrOptions} from '../../inputs/OrOptions';
import {SelectOption} from '../../inputs/SelectOption';
import {SelectCard} from '../../inputs/SelectCard';
import {IProjectCard} from '../IProjectCard';
import {CardResource} from '../../../common/CardResource';
import {CardName} from '../../../common/cards/CardName';
import {Resource} from '../../../common/Resource';
import {CardRenderer} from '../render/CardRenderer';
import {max} from '../Options';
import * as actionPreviews from '../actionPreviews';
import * as actionReason from '../actionReasons';

export class ExtremeColdFungus extends Card implements IActionCard, IProjectCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.EXTREME_COLD_FUNGUS,
      tags: [Tag.MICROBE],
      cost: 13,

      requirements: {temperature: -10, max},
      metadata: {
        cardNumber: '134',
        description: 'It must be -10 C or colder.',
        renderData: CardRenderer.builder((b) => {
          b.action('Gain 1 plant.', (eb) => {
            eb.empty().startAction.plants(1);
          }).br;
          b.or().br;
          b.action('Add 2 microbes to ANOTHER card.', (eb) => {
            eb.empty().startAction.resource(CardResource.MICROBE, 2).asterix();
          });
        }),
      },
    });
  }
  public canAct(): boolean {
    return true;
  }
  // Branch order MUST match action(): add-2-microbes (only when a microbe card
  // exists) pushed first, gain-1-plant second. The microbe target is PRE-COLLECTED
  // via the branch's optionInput (the same SelectCard action() builds) so the player
  // picks/sees the destination card in the modal — even for a single candidate.
  public actionPreview(player: IPlayer) {
    const microbeCards = player.getResourceCards(CardResource.MICROBE);
    const hasMicrobeCard = microbeCards.length > 0;
    return actionPreviews.orBranches(this, [
      {
        available: hasMicrobeCard,
        title: 'Add 2 microbes to another card',
        unavailableReason: actionReason.targetReason('No card to add microbes to'),
        effects: [actionPreviews.cardResourceGain(CardResource.MICROBE, 2)],
        optionInput: hasMicrobeCard ? actionPreviews.cardInput(player, 'Select card to add 2 microbes', 'Add microbes', microbeCards) : undefined,
      },
      {
        available: true,
        title: 'Gain 1 plant',
        effects: [actionPreviews.stockGain(player, Resource.PLANTS, 1)],
      },
    ]);
  }
  public action(player: IPlayer) {
    const otherMicrobeCards = player.getResourceCards(CardResource.MICROBE);

    if (otherMicrobeCards.length === 0) {
      player.stock.add(Resource.PLANTS, 1, {log: true});
      return undefined;
    }

    const gainPlantOption = new SelectOption('Gain 1 plant', 'Gain plant').andThen(() => {
      player.stock.add(Resource.PLANTS, 1, {log: true});
      return undefined;
    });

    // ALWAYS a SelectCard for the microbe target — even a single candidate — so the
    // player SEES which card gets the microbes + its current → resulting (no silent
    // single-target apply; fork-wide no-autoselect rule). SelectCard never auto-resolves.
    return new OrOptions(
      new SelectCard(
        'Select card to add 2 microbes',
        'Add microbes',
        otherMicrobeCards)
        .andThen(([card]) => {
          player.addResourceTo(card, {qty: 2, log: true});
          return undefined;
        }),
      gainPlantOption,
    );
  }
}
