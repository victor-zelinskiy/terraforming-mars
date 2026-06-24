import {IProjectCard} from '../IProjectCard';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {CardResource} from '../../../common/CardResource';
import {CardName} from '../../../common/cards/CardName';
import {Resource} from '../../../common/Resource';
import {CardRenderer} from '../render/CardRenderer';
import {digit} from '../Options';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as actionPreviews from '../actionPreviews';
import {gainOrAddResourceChoice, gainOrAddResourceBranches, GainSpec, AddSpec} from '../gainOrAddResource';

export class LocalHeatTrapping extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.EVENT,
      name: CardName.LOCAL_HEAT_TRAPPING,
      cost: 1,

      // Normally reserveUnits is managed by the rest of the game engine. But in this case
      // the only purpose of reserveUnits is to prevent the player from spending that heat
      // as Helion. Managing reserveUnits in this case will be handled by overriding canPlay
      // and play, which is not a rare behavior.
      //
      // This is made that much more complicated thanks to Merger and Stormcraft Incorporated.
      reserveUnits: {heat: 5},

      metadata: {
        cardNumber: '190',
        renderData: CardRenderer.builder((b) => {
          b.minus().heat(5, {digit});
          b.plus().plants(4, {digit});
          b.or().resource(CardResource.ANIMAL, {amount: 2, digit}).asterix();
        }),
        description: 'Spend 5 heat to gain either 4 plants, or to add 2 animals to ANOTHER card.',
      },
    });
  }

  // "Gain 4 plants OR add 2 animals to ANOTHER card", after spending 5 heat. Shared,
  // drift-free builder (see `gainOrAddResource`); the −5 heat shows as a prefix chip.
  private static readonly GAIN: GainSpec = {resource: Resource.PLANTS, amount: 4};
  private static readonly ADDS: ReadonlyArray<AddSpec> = [
    {resource: CardResource.ANIMAL, amount: 2},
  ];

  public override canPlay(player: IPlayer) {
    // This card can cost 0 or 1.
    const cardCost = player.getCardCost(this); // Would be nice to use precalculated value.

    let heat = player.heat;
    let floaters = player.resourcesOnCard(CardName.STORMCRAFT_INCORPORATED);

    // If the card costs anything, determine where that 1MC can come from. Assume it can come from MC first.
    if (cardCost === 1 && player.megaCredits === 0) {
      if (heat > 0) {
        heat--;
      } else if (floaters > 0) {
        floaters--;
      } else {
        return false;
      }
    }

    // At this point, the card cost has been assumed handled, and it's just a question of whether there's 5 heat
    // left.

    const availableHeat = heat + (floaters * 2);
    return availableHeat >= 5;
  }

  // By overriding play, the heat is not deducted automatically.
  public override play(player: IPlayer) {
    // SIDE-EFFECT FREE to build (the mutations live in the option callbacks), so the
    // same choice drives `play` and the read-only `cardPlayPreview` without drifting.
    const choice = gainOrAddResourceChoice(player, this, LocalHeatTrapping.GAIN, LocalHeatTrapping.ADDS, {trigger: 'You spent 5 heat.'});
    return player.spendHeat(5, () => {
      // With no animal card the only option is "gain 4 plants" → auto-resolve it.
      if (choice.options.length === 1) {
        return choice.options[0].cb();
      }
      return choice;
    });
  }

  // The on-play preview: the −5 heat the effect spends (prefix chip) PLUS the
  // "gain 4 plants / add 2 animals" branches — the add branch shown disabled-with-
  // reason when there's no animal card, so the alternative is never silently hidden.
  // With Stormcraft floaters-as-heat the live path inserts a heat-SOURCE prompt
  // BEFORE the choice; it's pre-collected here as a `preStep` (SpendHeatContent),
  // so the player resolves the heat payment AND the gain/add choice in ONE modal —
  // the batch replays [play, heat-source, choice]. (No Stormcraft → no preStep.)
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const heatCost = actionPreviews.stockCost(player, Resource.HEAT, 5);
    const preview = gainOrAddResourceBranches(player, this, LocalHeatTrapping.GAIN, LocalHeatTrapping.ADDS, {prefixEffects: [heatCost]});
    const heatStep = actionPreviews.spendHeatStep(player, 5);
    return heatStep !== undefined ? {...preview, preSteps: [heatStep]} : preview;
  }
}
