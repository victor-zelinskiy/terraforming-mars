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
import {CardResourceTrader, CardTradeDoorSpec, cardTradeDoorOption, cardTradeDoorReason} from '../../colonies/cardTradeDoor';
import {OrOptions} from '../../inputs/OrOptions';
import {SelectOption} from '../../inputs/SelectOption';
import {effectChoice} from '../../inputs/choiceContext';
import * as reason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';
import {DeclaredHolderRole} from '../../../common/cards/holderRole';

/** Variant A's printed price and yield. */
const ENERGY_COST = 2;
const MECHS_ADDED = 2;
/** Variant B's printed price — one mech off this card per free trade (the role's price reads it too). */
const MECHS_PER_TRADE = 1;

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

  /** The mechs here buy a free TRADE (`common/cards/holderRole.ts` — the satellite's split, the target step's value line). */
  public readonly resourceRole: DeclaredHolderRole = {kind: 'trade', price: MECHS_PER_TRADE};

  private canBuyMechs(player: IPlayer): boolean {
    return player.energy >= ENERGY_COST;
  }

  /** ONE blocker for variant B, in check order: the mech on this card (the
   *  only condition the card adds), then the engine's own trade gate. */
  private tradeVariantReason(player: IPlayer): string | undefined {
    return cardTradeDoorReason(player, this, AUTOMATED_CONVOYS_TRADE_DOOR);
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
      // The trader IS the implementation — the shared card door.
      options.push(cardTradeDoorOption(player, new TradeWithAutomatedConvoys(player),
        'Spend 1 mech from this card to trade for free', 'Trade'));
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

/** Pays a colony trade fee with 1 mech from Automated Convoys (the card's action) — the shared card door
 *  (`colonies/cardTradeDoor.ts`; Titan Floating Launch-Pad and Veynon Dynamics are its siblings). */
export const AUTOMATED_CONVOYS_TRADE_DOOR: CardTradeDoorSpec = {
  card: CardName.AUTOMATED_CONVOYS,
  icon: 'mech',
  price: MECHS_PER_TRADE,
  optionText: 'Pay 1 mech (use ${0} action)',
  logText: '${0} spent 1 mech to trade with ${1}',
  noResourceReason: 'No mechs on this card',
  spend: 'recorded',
};

export class TradeWithAutomatedConvoys extends CardResourceTrader {
  constructor(player: IPlayer) {
    super(player, AUTOMATED_CONVOYS_TRADE_DOOR);
  }
}
