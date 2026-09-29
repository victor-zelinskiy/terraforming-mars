import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {CardResource} from '../../../common/CardResource';
import {CardName} from '../../../common/cards/CardName';
import {Resource} from '../../../common/Resource';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {CardRenderer} from '../render/CardRenderer';
import {Card} from '../Card';
import {IPlayer} from '../../IPlayer';
import {PlayerInput} from '../../PlayerInput';
import {IColony} from '../../colonies/IColony';
import {IColonyTrader} from '../../colonies/IColonyTrader';
import {ColoniesHandler} from '../../colonies/ColoniesHandler';
import {OrOptions} from '../../inputs/OrOptions';
import {SelectOption} from '../../inputs/SelectOption';
import {effectChoice} from '../../inputs/choiceContext';
import {message} from '../../logs/MessageBuilder';
import * as reason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';

/** Variant A's printed price and yield. */
const ENERGY_COST = 2;
const MECHS_ADDED = 2;

/**
 * TR66 — AUTOMATED CONVOYS («Беспилотные конвои»).
 *
 * ONE blue-card action, exactly one of two variants per activation — the
 * Modular Floodgates shape (DP11) with Titan Floating Launch-Pad's second half:
 *
 *  A. Pay 2 energy → add 2 mechs to THIS card.
 *  B. Spend 1 mech from THIS card → trade for free. NOT a trade of its own: the
 *     second entry point into the ONE trade, paid through this card's own
 *     {@link TradeWithAutomatedConvoys} (registered in `Colonies.tradeHandlers`).
 *
 * The ▲ beside the art is the Colonies symbol: the manifest declares
 * `compatibility: 'colonies'` (Delta Works precedent).
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/AutomatedConvoys.spec.ts):
 *  1. A's energy leaves through `stock.deduct` and the mechs arrive through
 *     `addResourceTo` — both on the event recorder, no direct field write.
 *  2. B is FREE, never fleetless: the fee is the mech, `Colony.trade` still
 *     spends a trade fleet, and the trade is the one `Colony.trade` door (the
 *     chairman's «trade N times» quest, the journal, the events).
 *  3. B is available ⇔ a mech is here AND `tradeBlockedReason()` is clear —
 *     ONE blocker, the card's own premise first.
 *  4. `canAct` ⇔ at least one variant; when both are dead the reason names
 *     the one blocker the player can act on (see `actionUnavailableReason`).
 *  5. One live variant is the whole action (no prompt); two → `OrOptions`.
 *  6. The mechs here are NOT money: the `mechs` payment unit reads EVA Mechs
 *     only (`CARD_FOR_SPENDABLE_RESOURCE.mechs`), and this card spends its own.
 *  7. Branch order is the printed row order everywhere: A, then B.
 */
export class AutomatedConvoys extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.AUTOMATED_CONVOYS,
      type: CardType.ACTIVE,
      tags: [Tag.SPACE],
      cost: 9,
      resourceType: CardResource.MECH,

      metadata: {
        cardNumber: 'TR66',
        // EACH PRINTED ROW DESCRIBES ITSELF (the TFLP / DP11 contract): a
        // description-less row folds into its sibling, and one caption would
        // then speak for both variants.
        renderData: CardRenderer.builder((b) => {
          b.action('Pay 2 energy to add 2 mech resources to this card.', (eb) => {
            eb.energy(ENERGY_COST).startAction.resource(CardResource.MECH, {amount: MECHS_ADDED});
          }).br;
          b.or().br;
          b.action('Spend 1 mech from here to trade for free.', (eb) => {
            eb.resource(CardResource.MECH).startAction.trade();
          });
        }),
      },
    });
  }

  private canBuyMechs(player: IPlayer): boolean {
    return player.energy >= ENERGY_COST;
  }

  /** ONE blocker for variant B, in check order: the mech on this card (the
   *  only condition the card adds), then the engine's own trade gate. */
  private tradeVariantReason(player: IPlayer): string | undefined {
    if (this.resourceCount < 1) {
      return 'No mechs on this card';
    }
    return player.colonies.tradeBlockedReason();
  }

  public canAct(player: IPlayer): boolean {
    return this.canBuyMechs(player) || this.tradeVariantReason(player) === undefined;
  }

  /** Both variants dead → the blocker the player can act on. With no mech the
   *  trade was never on the table, so the energy is what is missing; with a
   *  mech in hand the player HAS the means, and what matters is what closed
   *  the trade. */
  public actionUnavailableReason(player: IPlayer): UnplayableReason | undefined {
    if (this.canAct(player)) {
      return undefined;
    }
    if (this.resourceCount < 1) {
      return reason.notEnoughEnergy();
    }
    return reason.ruleReason(this.tradeVariantReason(player) ?? 'No colony available to trade with');
  }

  /** Two declared branches, in the SAME order `action()` pushes its options. */
  public actionPreview(player: IPlayer): ActionPreview {
    const tradeReason = this.tradeVariantReason(player);
    return actionPreviews.orBranches(this, [
      {
        available: this.canBuyMechs(player),
        title: 'Pay 2 energy to add 2 mechs to this card',
        effects: [
          actionPreviews.stockCost(player, Resource.ENERGY, ENERGY_COST),
          actionPreviews.cardGain(this, MECHS_ADDED),
        ],
        unavailableReason: reason.notEnoughEnergy(),
      },
      {
        // The trade's SECOND DOOR: the console hands the player to the colony
        // workspace with this card's payment path locked — nothing commits
        // until the trade itself is confirmed.
        available: tradeReason === undefined,
        title: 'Spend 1 mech from this card to trade for free',
        effects: [actionPreviews.cardCost(this, 1)],
        steps: [actionPreviews.colonyTradeStep(this)],
        unavailableReason: reason.ruleReason(tradeReason ?? 'No colony available to trade with'),
      },
    ]);
  }

  public action(player: IPlayer): PlayerInput | undefined {
    const options: Array<SelectOption> = [];
    if (this.canBuyMechs(player)) {
      options.push(new SelectOption('Pay 2 energy to add 2 mechs to this card', 'Add mechs').andThen(() => {
        player.stock.deduct(Resource.ENERGY, ENERGY_COST, {log: true, from: {card: this.name}});
        player.addResourceTo(this, {qty: MECHS_ADDED, log: true});
        return undefined;
      }));
    }
    if (this.tradeVariantReason(player) === undefined) {
      options.push(new SelectOption('Spend 1 mech from this card to trade for free', 'Trade').andThen(() => {
        // The trader IS the implementation; this is one of its two entry
        // points (the colonies menu's fee picker is the other).
        const trader = new TradeWithAutomatedConvoys(player);
        player.defer(
          ColoniesHandler.tradeColonyPick(player, 'Select colony tile to trade with for free', 'trade')
            .andThen((colony) => {
              const events = player.game.events;
              events?.beginAction(player, {kind: 'colony', name: colony.name}, {category: 'colony'});
              try {
                trader.trade(colony);
              } finally {
                events?.endScope();
              }
              return undefined;
            }));
        return undefined;
      }));
    }
    if (options.length === 0) {
      return undefined;
    }
    if (options.length === 1) {
      return options[0].cb(undefined);
    }
    return new OrOptions(...options).markChoiceContext(effectChoice(this));
  }
}

/** Pays a colony trade fee with 1 mech from Automated Convoys (the card's action). */
export class TradeWithAutomatedConvoys implements IColonyTrader {
  private automatedConvoys: AutomatedConvoys | undefined;

  constructor(private player: IPlayer) {
    const card = player.tableau.get(CardName.AUTOMATED_CONVOYS);
    this.automatedConvoys = card === undefined ? undefined : (card as AutomatedConvoys);
  }

  public canUse() {
    return (this.automatedConvoys?.resourceCount ?? 0) > 0 &&
      !this.player.actionsThisGeneration.has(CardName.AUTOMATED_CONVOYS);
  }

  public optionText() {
    return message('Pay 1 mech (use ${0} action)', (b) => b.cardName(CardName.AUTOMATED_CONVOYS));
  }

  /** `card` is this path's structural IDENTITY: the card's own action enters
   *  this very option, and the console locks the fee by it — never by the
   *  translated label. */
  public optionMetadata() {
    const current = this.automatedConvoys?.resourceCount ?? 0;
    return {kind: 'resourceRemoval' as const, icon: 'mech', amount: 1,
      card: CardName.AUTOMATED_CONVOYS,
      resource: {current, resulting: Math.max(0, current - 1)}};
  }

  /** Mirrors `canUse`, one named blocker each; `undefined` = the card is not
   *  owned, so there is no option to explain. */
  public disabledReason() {
    if (this.automatedConvoys === undefined) {
      return undefined;
    }
    if (this.automatedConvoys.resourceCount <= 0) {
      return 'No mechs on this card';
    }
    return 'This card\'s action was already used this generation';
  }

  public trade(colony: IColony) {
    if (this.automatedConvoys !== undefined) {
      this.player.removeResourceFrom(this.automatedConvoys, 1, {log: false});
    }
    this.player.actionsThisGeneration.add(CardName.AUTOMATED_CONVOYS);
    this.player.game.log('${0} spent 1 mech to trade with ${1}', (b) => b.player(this.player).colony(colony));
    colony.trade(this.player);
  }
}
