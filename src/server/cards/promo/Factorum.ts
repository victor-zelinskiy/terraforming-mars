import {CorporationCard} from '../corporation/CorporationCard';
import {IPlayer} from '../../IPlayer';
import {Tag} from '../../../common/cards/Tag';
import {IActionCard} from '../ICard';
import {Resource} from '../../../common/Resource';
import {SelectOption} from '../../inputs/SelectOption';
import {OrOptions} from '../../inputs/OrOptions';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Size} from '../../../common/cards/render/Size';
import {SelectPaymentDeferred} from '../../deferredActions/SelectPaymentDeferred';
import {TITLES} from '../../inputs/titles';
import {ICorporationCard} from '../corporation/ICorporationCard';
import * as actionReason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';

const DRAW_COST = 3;

export class Factorum extends CorporationCard implements ICorporationCard, IActionCard {
  constructor() {
    super({
      name: CardName.FACTORUM,
      tags: [Tag.POWER, Tag.BUILDING],
      startingMegaCredits: 37,

      behavior: {
        production: {steel: 1},
      },

      metadata: {
        cardNumber: 'R22',
        description: 'You start with 37 M€. Increase your steel production 1 step.',
        infoText: [{kind: 'action-short', text: 'Raise energy production if you have none', tokens: ['production(energy)']}],
        renderData: CardRenderer.builder((b) => {
          b.megacredits(37).nbsp.production((pb) => pb.steel(1));
          // Two SEPARATE action() nodes (with an `or` divider) so the premium
          // Actions overlay splits this into two distinct, individually-activatable
          // rows — and the confirm modal opens directly on the chosen branch instead
          // of falling back to the in-modal branch picker. Mirrors RegolithEaters.
          b.corpBox('action', (ce) => {
            ce.vSpace(Size.LARGE);
            ce.action('Increase your energy production 1 step if you have no energy resources.', (eb) => {
              eb.empty().startAction.production((pb) => pb.energy(1)).asterix();
            }).br;
            ce.or().br;
            ce.action('Spend 3 M€ to draw a building card.', (eb) => {
              eb.megacredits(3).startAction.cards(1, {secondaryTag: Tag.BUILDING});
            });
          });
        }),
      },
    });
  }

  public canAct(player: IPlayer): boolean {
    return player.energy === 0 || player.canAfford(DRAW_COST);
  }

  public actionUnavailableReason(player: IPlayer) {
    return actionReason.needMoreMC(player, DRAW_COST);
  }

  // Branch order MUST match action(): increase-energy-production (only with no
  // energy resources) pushed first, draw-a-building-card second.
  public actionPreview(player: IPlayer) {
    // The 3 M€ is a real CHOICE whenever the player can pay with something else
    // (Helion heat, Luna titanium) — `SelectPaymentDeferred` then prompts. Host
    // it as a step so the confirm collects it, exactly like WaterImportFromEuropa;
    // when only M€ can pay, the live path auto-pays and the flat cost chip stands.
    const pay = actionPreviews.paymentStep(player, DRAW_COST, {title: TITLES.payForCardAction(this.name)});
    return actionPreviews.orBranches(this, [
      {
        available: player.energy === 0,
        title: 'Increase your energy production 1 step',
        effects: [actionPreviews.productionChange(player, Resource.ENERGY, 1)],
        unavailableReason: actionReason.ruleReason('Only available when you have no energy'),
      },
      {
        available: player.canAfford(DRAW_COST),
        title: 'Spend 3 M€ to draw a building card',
        effects: pay !== undefined ?
          [actionPreviews.drawGain(1)] :
          [actionPreviews.stockCost(player, Resource.MEGACREDITS, DRAW_COST), actionPreviews.drawGain(1)],
        steps: [pay],
        unavailableReason: actionReason.needMoreMC(player, DRAW_COST),
      },
    ]);
  }

  public action(player: IPlayer) {
    const increaseEnergy = new SelectOption(
      'Increase your energy production 1 step',
      'Increase production')
      .andThen(() => {
        player.production.add(Resource.ENERGY, 1, {log: true});
        return undefined;
      });

    const drawBuildingCard = new SelectOption('Spend 3 M€ to draw a building card', 'Draw card')
      .andThen(() => {
        player.game.defer(new SelectPaymentDeferred(player, DRAW_COST, {title: TITLES.payForCardAction(this.name)}))
          .andThen(() => player.drawCard(1, {tag: Tag.BUILDING}));
        return undefined;
      });

    const options = [];
    if (player.energy === 0) {
      options.push(increaseEnergy);
    }
    if (player.canAfford(DRAW_COST)) {
      options.push(drawBuildingCard);
    }
    // RESOLVE the lone legal option instead of RETURNING it (the TitanAirScrapping
    // idiom). Returning it left a `SelectOption` standing as the next `waitingFor`
    // — a forced confirm of the only thing that could happen — which the preview's
    // auto-resolve contract (`orBranches` gives a lone available branch index -1,
    // so the batch submits nothing for it) says is not there. The premium/console
    // confirm already showed the branch and its effects, so that prompt was a
    // second confirmation of a decision the player had just made, and it arrived
    // as a bare generic band outside the action workspace.
    if (options.length === 1) {
      return options[0].cb(undefined);
    }
    return new OrOptions(...options);
  }
}
