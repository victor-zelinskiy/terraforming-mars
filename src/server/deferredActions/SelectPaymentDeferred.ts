import {IPlayer} from '../IPlayer';
import {SelectPayment} from '../inputs/SelectPayment';
import {Payment} from '../../common/inputs/Payment';
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {CardName} from '../../common/cards/CardName';
import {Message} from '../../common/logs/Message';
import {message} from '../logs/MessageBuilder';
import {Units} from '../../common/Units';
import {SelectPaymentModel} from '../../common/models/PlayerInputModel';

export type Options = {
  canUseSteel?: boolean;
  canUseTitanium?: boolean;
  canUseSeeds?: boolean,
  canUseAuroraiData?: boolean,
  canUseGraphene?: boolean;
  canUseAsteroids?: boolean;
  canUseSpireScience?: boolean,
  reserveUnits?: Units | undefined;
  title?: string | Message;
}

export class SelectPaymentDeferred extends DeferredAction<Payment> {
  constructor(
    player: IPlayer,
    public amount: number,
    public options: Options = {},
  ) {
    super(player, Priority.DEFAULT);
  }

  private mustPayWithMegacredits() {
    if (this.player.canUseHeatAsMegaCredits && this.player.availableHeat() > 0) {
      return false;
    }
    if (this.options.canUseSteel && this.player.steel > 0) {
      return false;
    }
    if ((this.options.canUseTitanium || this.player.canUseTitaniumAsMegacredits) && this.player.titanium > 0) {
      return false;
    }
    if (this.options.canUseGraphene && this.player.resourcesOnCard(CardName.CARBON_NANOSYSTEMS) > 0) {
      return false;
    }
    if (this.options.canUseAsteroids && this.player.resourcesOnCard(CardName.KUIPER_COOPERATIVE) > 0) {
      return false;
    }
    if (this.options.canUseSeeds && (this.player.resourcesOnCard(CardName.SOYLENT_SEEDLING_SYSTEMS) > 0)) {
      return false;
    }
    if (this.options.canUseAuroraiData && (this.player.resourcesOnCard(CardName.AURORAI) > 0)) {
      return false;
    }
    if (this.options.canUseSpireScience && (this.player.resourcesOnCard(CardName.SPIRE) > 0)) {
      return false;
    }

    return true;
  }

  // The SelectPayment this deferred would prompt with — extracted so the live
  // `execute` and the read-only `previewPaymentModel` (action-preview rework)
  // build the IDENTICAL input, with no chance of the two drifting apart.
  private buildSelectPayment(): SelectPayment {
    return new SelectPayment(
      this.options.title || message('Select how to spend ${0} M€', (b) => b.number(this.amount)),
      this.amount,
      {
        steel: this.options.canUseSteel || false,
        titanium: this.options.canUseTitanium || false,
        heat: this.player.canUseHeatAsMegaCredits,
        seeds: this.options.canUseSeeds || false,
        auroraiData: this.options.canUseAuroraiData || false,
        spireScience: this.options.canUseSpireScience || false,
        lunaTradeFederationTitanium: this.player.canUseTitaniumAsMegacredits,
        kuiperAsteroids: this.options.canUseAsteroids || false,
        graphene: this.options.canUseGraphene || false,
      }, this.options.reserveUnits);
  }

  /**
   * READ-ONLY preview of the payment prompt this deferred WOULD raise — the
   * `SelectPaymentModel` the player would otherwise see as a separate modal after
   * activating the action — or `undefined` when the live path would NOT prompt
   * (amount 0, or the player can only pay in M€ so `execute` auto-pays). Used by
   * the action-preview rework to embed the payment choice INSIDE the action
   * confirmation modal (so it isn't a separate follow-up step). Mutates NOTHING —
   * `mustPayWithMegacredits`, `buildSelectPayment` and `SelectPayment.toModel` are
   * all read-only; the actual `player.pay` only happens in `execute`.
   */
  public previewPaymentModel(): SelectPaymentModel | undefined {
    if (this.amount <= 0 || this.mustPayWithMegacredits()) {
      return undefined;
    }
    return this.buildSelectPayment().toModel(this.player);
  }

  public execute() {
    if (this.amount === 0) {
      this.cb(Payment.of({}));
      return undefined;
    }

    // A deferred payment IS a payment — attribute the spend to the `payment`
    // source (journal reads "Оплата → −N") rather than letting it inherit the
    // surrounding action's source (e.g. a colony trade fee read "Luna → −3").
    const events = this.player.game.events;
    if (this.mustPayWithMegacredits()) {
      if (this.player.megaCredits < this.amount) {
        throw new Error(`Player does not have ${this.amount} M€`);
      }
      const payment = Payment.of({megacredits: this.amount});
      events.withSource({kind: 'payment'}, () => this.player.pay(payment));
      this.cb(payment);
      return undefined;
    }

    return this.buildSelectPayment()
      .andThen((payment) => {
        events.withSource({kind: 'payment'}, () => this.player.pay(payment));
        this.cb(payment);
        return undefined;
      });
  }
}
