import {IPlayer} from '../IPlayer';
import {SelectPayment} from '../inputs/SelectPayment';
import {Payment} from '../../common/inputs/Payment';
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {CardName} from '../../common/cards/CardName';
import {Message} from '../../common/logs/Message';
import {message} from '../logs/MessageBuilder';
import {Units} from '../../common/Units';
import {ChoiceContextSource, SelectPaymentModel} from '../../common/models/PlayerInputModel';

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
  /**
   * WHO is charging — the card / standard project / rule that raised this bill.
   * Until now the only channel was `title`, a TRANSLATABLE string: the client is
   * forbidden from parsing it, so a payment prompt could name its source to a
   * human and stay anonymous to the UI. See `inputs/choiceContext.ts`.
   */
  cause?: ChoiceContextSource;
  /**
   * «Pay N M€, or as much as possible» — the amount is CLAMPED to what the player
   * can actually pay AT EXECUTION TIME.
   *
   * A rule with that wording must never fail, but sizing it when the action is
   * QUEUED does exactly that: other costs of the same event sit AHEAD of it in the
   * deferred queue and take their share first (Reds policy 2's tile tax is queued
   * behind an Ares hazard-removal payment), so the amount it was born with is
   * already unpayable by the time it runs — and it threw
   * «Player does not have N M€» with the tile already on the board.
   *
   * Only for a rule that genuinely says «or as much as possible»: a MANDATORY cost
   * must keep throwing, because silently charging less breaks the rule instead.
   */
  atMost?: boolean;
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
  /**
   * What this payment will really ask for: `amount`, or — for an «as much as
   * possible» rule (see {@link Options.atMost}) — what the player can still pay
   * RIGHT NOW, which is only knowable here, at execution time.
   */
  private payableAmount(): number {
    if (this.options.atMost !== true) {
      return this.amount;
    }
    return Math.max(0, Math.min(this.amount, this.player.spendableMegacredits()));
  }

  private buildSelectPayment(amount: number = this.amount): SelectPayment {
    const select = new SelectPayment(
      this.options.title || message('Select how to spend ${0} M€', (b) => b.number(amount)),
      amount,
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
    return this.options.cause === undefined ?
      select :
      select.markChoiceContext({source: this.options.cause, mode: 'effect-choice'});
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
    const amount = this.payableAmount();
    if (amount === 0) {
      this.cb(Payment.of({}));
      return undefined;
    }

    // A deferred payment IS a payment — attribute the spend to the `payment`
    // source (journal reads "Оплата → −N") rather than letting it inherit the
    // surrounding action's source (e.g. a colony trade fee read "Luna → −3").
    const events = this.player.game.events;
    if (this.mustPayWithMegacredits()) {
      if (this.player.megaCredits < amount) {
        throw new Error(`Player does not have ${amount} M€`);
      }
      const payment = Payment.of({megacredits: amount});
      events.withSource({kind: 'payment'}, () => this.player.pay(payment));
      this.cb(payment);
      return undefined;
    }

    return this.buildSelectPayment(amount)
      .andThen((payment) => {
        events.withSource({kind: 'payment'}, () => this.player.pay(payment));
        this.cb(payment);
        return undefined;
      });
  }
}
