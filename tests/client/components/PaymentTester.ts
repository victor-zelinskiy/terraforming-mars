import {VueWrapper} from '@vue/test-utils';
import {expect} from 'chai';
import {Payment} from '@/common/inputs/Payment';
import {SPENDABLE_RESOURCES, SpendableResource} from '@/common/inputs/Spendable';

export class PaymentTester {
  constructor(private wrapper: VueWrapper<any>) {}

  private static selector(unit: SpendableResource) {
    return `[data-test=${unit}]`;
  }

  public async clickMax(type: SpendableResource) {
    const button = this.wrapper.find(PaymentTester.selector(type) + ' .btn-max, ' + PaymentTester.selector(type) + ' .payment-v2-step--max');
    await button.trigger('click');
    await this.nextTick();
  }

  public async clickMinus(type: SpendableResource) {
    const button = this.wrapper.find(PaymentTester.selector(type) + ' .btn-minus, ' + PaymentTester.selector(type) + ' .payment-v2-step--minus');
    await button.trigger('click');
    await this.nextTick();
  }

  public async clickPlus(type: SpendableResource) {
    const button = this.wrapper.find(PaymentTester.selector(type) + ' .btn-plus, ' + PaymentTester.selector(type) + ' .payment-v2-step--plus');
    await button.trigger('click');
    await this.nextTick();
  }

  public async clickSave() {
    const button = this.wrapper.find('[data-test=save]');
    await button.trigger('click');
    await this.nextTick();
  }

  public getValue(unit: SpendableResource): number {
    const input = this.wrapper.find(PaymentTester.selector(unit) + ' input');
    if (input.exists()) {
      const textBox = input.element as HTMLInputElement;
      return Number.parseInt(textBox?.value);
    }
    const value = this.wrapper.find(PaymentTester.selector(unit) + ' .payment-v2-row__count-value');
    if (!value.exists()) {
      throw new Error('Cannot find text box for ' + unit);
    }
    return Number.parseInt(value.text());
  }

  public getPayment(): Partial<Payment> {
    const payment: Partial<Payment> = {};
    for (const unit of SPENDABLE_RESOURCES) {
      if (this.isAvailable(unit)) {
        payment[unit] = this.getValue(unit);
      }
    }
    return payment;
  }

  expectPayment(expected: Partial<Payment>) {
    expect(this.getPayment()).deep.eq(expected);
  }

  public expectValue(resource: SpendableResource, amount: number) {
    expect(this.getValue(resource), `text box value for ${resource}`).eq(amount);
  }

  /**
   * Returns true when the text box for `resource` is visible.
   */
  private isAvailable(resource: SpendableResource): boolean {
    const selector = PaymentTester.selector(resource);
    return this.wrapper.find(selector + ' input, ' + selector + ' .payment-v2-row__count-value').exists();
  }

  /**
   * Passes when the text box for `resource` is visible.
   */
  public expectIsAvailable(resource: SpendableResource) {
    expect(this.isAvailable(resource), `Expect input for ${resource} to be visible`).is.true;
  }

  /**
   * Passes when the text box for `resource` is not visible.
   */
  public expectIsNotAvailable(resource: SpendableResource) {
    expect(this.isAvailable(resource), `Expect input for ${resource} to be invisible`).is.false;
  }

  /**
   * Return the set of payment components visible in the UI.
   */
  public getAvailablePaymentComponents(): ReadonlyArray<SpendableResource> {
    const available: Array<SpendableResource> = [];
    for (const unit of SPENDABLE_RESOURCES) {
      if (this.isAvailable(unit)) {
        available.push(unit);
      }
    }
    return available;
  }

  /**
   * Passes when the visible set of UI components is this list and only this list.
   */
  public expectAvailablePaymentComponents(...resources: Array<SpendableResource>) {
    const available = this.getAvailablePaymentComponents();
    expect(available).has.members(resources);
  }

  public async nextTick() {
    await this.wrapper.vm.$nextTick();
  }
}
