import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {CardName} from '../../../common/cards/CardName';
import {CardResource} from '../../../common/CardResource';
import {AddResourcesToCard} from '../../deferredActions/AddResourcesToCard';
import {Size} from '../../../common/cards/render/Size';
import {Card} from '../Card';
import {CardRenderer} from '../render/CardRenderer';
import {ActionPreview, ActionPreviewStep, ActionEffect} from '../../../common/models/ActionPreviewModel';
import * as actionPreviews from '../actionPreviews';

export class EcologyResearch extends Card implements IProjectCard {
  constructor() {
    super({
      cost: 21,
      tags: [Tag.SCIENCE, Tag.PLANT, Tag.ANIMAL, Tag.MICROBE],
      name: CardName.ECOLOGY_RESEARCH,
      type: CardType.AUTOMATED,
      victoryPoints: 1,

      behavior: {
        production: {plants: {colonies: {colonies: {}}}},
      },

      metadata: {
        description: 'Increase your plant production 1 step for each colony you own. Add 1 animal to ANOTHER card and 2 microbes to ANOTHER card.',
        cardNumber: 'C09',
        renderData: CardRenderer.builder((b) => {
          b.production((pb) => pb.plants(1).slash().colonies(1, {size: Size.SMALL})).br;
          b.resource(CardResource.ANIMAL).asterix().nbsp.nbsp.resource(CardResource.MICROBE, 2).asterix();
        }),
      },
    });
  }

  public override bespokePlay(player: IPlayer) {
    const animalCards = player.getResourceCards(CardResource.ANIMAL);
    if (animalCards.length) {
      player.game.defer(new AddResourcesToCard(player, CardResource.ANIMAL, {count: 1}));
    }

    const microbeCards = player.getResourceCards(CardResource.MICROBE);
    if (microbeCards.length) {
      player.game.defer(new AddResourcesToCard(player, CardResource.MICROBE, {count: 2}));
    }

    return undefined;
  }

  // The on-play preview: `playPreview` auto-includes the declarative plant
  // production chip (1 per colony). The bespoke "add 1 animal to a card" + "add 2
  // microbes to a card" additions (NOT in `behavior`) are shown as their own
  // gain chips + target pickers — in the SAME order bespokePlay defers them
  // (animal then microbe) so the pre-collected picks line up with the live queue.
  // A picker that the live path would auto-resolve (a single candidate) yields no
  // step; a resource with no candidate card adds neither chip nor step.
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const extra: Array<ActionEffect> = [];
    const steps: Array<ActionPreviewStep | undefined> = [];
    if (player.getResourceCards(CardResource.ANIMAL).length > 0) {
      extra.push(actionPreviews.cardResourceGain(CardResource.ANIMAL, 1));
      steps.push(actionPreviews.addToCardStep(player, CardResource.ANIMAL, {count: 1}));
    }
    if (player.getResourceCards(CardResource.MICROBE).length > 0) {
      extra.push(actionPreviews.cardResourceGain(CardResource.MICROBE, 2));
      steps.push(actionPreviews.addToCardStep(player, CardResource.MICROBE, {count: 2}));
    }
    return actionPreviews.playPreview(this, player, extra, steps);
  }
}
