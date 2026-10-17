import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Size} from '../../../common/cards/render/Size';
import {IPlayer} from '../../IPlayer';
import {SelectAmount} from '../../inputs/SelectAmount';
import {namedCardEffect} from '../../inputs/choiceContext';
import {Card} from '../Card';

export class Supercapacitors extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.SUPERCAPACITORS,
      tags: [Tag.POWER, Tag.BUILDING],
      cost: 4,

      behavior: {
        production: {megacredits: 1},
      },

      metadata: {
        cardNumber: 'X46',
        infoText: [{kind: 'effect-short', text: 'Energy may stay instead of turning to heat'}],
        renderData: CardRenderer.builder((b) => {
          // Energy -> heat conversion with a crossed-out arrow: during production
          // you MAY skip converting each energy resource into heat.
          b.effect('Converting energy to heat during production is optional.', (eb) => {
            eb.startEffect.energy(1).arrow(Size.MEDIUM, true).heat(1);
          });
          b.br;
          b.production((pb) => pb.megacredits(1));
        }),
        description: 'Increase M€ production 1 step.',
      },
    });
  }

  public static onProduction(player: IPlayer) {
    if (player.energy === 0) {
      player.finishProductionPhase();
      return;
    }
    player.defer(
      // The conversion hint lets the modern stepper render the rich
      // [energy] → [heat] composition + a live stock preview for both sides.
      // The choiceContext marker attributes the prompt to this card (console
      // source dock + L3 «Источник» + the deferred chip), and the console's
      // premium conversion prompt keys its layout off the conversion hint —
      // never off this (translatable) title.
      new SelectAmount('Choose how much energy to convert to heat', 'OK', 0, player.energy, true,
        {icon: 'energy', conversion: {from: 'energy', to: 'heat'}})
        .markChoiceContext(namedCardEffect(CardName.SUPERCAPACITORS, false))
        .andThen((amount) => {
          // The chosen amount goes through the ONE conversion of the production
          // phase (the snapshot for the paired transition, the stock
          // chokepoints under the phase's `conversion` source — TR61); a zero
          // converts nothing and leaves no snapshot (no empty ceremony).
          player.convertEnergyToHeat(amount);
          player.finishProductionPhase();
          return undefined;
        },
        ));
  }
}
