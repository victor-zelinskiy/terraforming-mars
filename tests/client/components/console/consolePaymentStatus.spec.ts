import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import ConsolePaymentStatus from '@/client/components/console/ConsolePaymentStatus.vue';
import {PaymentStatus} from '@/client/console/paymentPlan';

/*
 * THE PAYMENT VERDICT — one element, one geometry, both densities: the ledger «paid / price» and the verdict phrase.
 * What this spec owns: the element is always there, a verdict differs by its class, glyph and wording only, the
 * delta wears a sign only for an overpay, and the price's unit names the icon and the aria. (The unit runner has no
 * RU bundle — a key reads as itself.)
 */
function status(over: Partial<PaymentStatus> = {}): PaymentStatus {
  return {kind: 'exact', cost: 12, paid: 12, delta: 0, labelKey: 'Exact payment', ok: true, ...over};
}

function mountStatus(props: {status: PaymentStatus, mode?: 'compact' | 'expanded'}) {
  return mount(ConsolePaymentStatus, {...globalConfig, props});
}

describe('ConsolePaymentStatus — the payment verdict', () => {
  it('an exact payment: the ledger, the verdict, no delta — compact by default', () => {
    const verdict = mountStatus({status: status()});
    expect(verdict.classes()).to.include.members(['con-paystatus', 'con-paystatus--exact', 'con-paystatus--compact']);
    expect(verdict.attributes('role')).to.eq('status');
    expect(verdict.find('.con-paystatus__glyph').text()).to.eq('✓');
    expect(verdict.find('.con-paystatus__cap').text()).to.eq('Paid');
    expect(verdict.find('.con-paystatus__paid').text()).to.eq('12');
    expect(verdict.find('.con-paystatus__cost').text()).to.eq('12');
    expect(verdict.find('.con-paystatus__icon').classes()).to.include('resource_icon--megacredits');
    expect(verdict.find('.con-paystatus__verdict-text').text()).to.eq('Exact payment');
    expect(verdict.find('.con-paystatus__delta').exists()).to.eq(false);
    expect(verdict.attributes('aria-label')).to.eq('Paid: 12 of 12 M€. Exact payment');
  });

  it('an overpay warns and signs its delta; the expanded density is a class of the same element', () => {
    const verdict = mountStatus({status: status({kind: 'overpay', paid: 13, delta: 1, labelKey: 'Overpay'}), mode: 'expanded'});
    expect(verdict.classes()).to.include.members(['con-paystatus--overpay', 'con-paystatus--expanded']);
    expect(verdict.classes()).to.not.include('con-paystatus--compact');
    expect(verdict.find('.con-paystatus__glyph').text()).to.eq('⚠');
    expect(verdict.find('.con-paystatus__delta').text()).to.eq('+1');
    expect(verdict.find('.con-paystatus__delta-icon').classes()).to.include('resource_icon--megacredits');
    expect(verdict.attributes('aria-label')).to.eq('Paid: 13 of 12 M€. Overpay +1 M€');
  });

  it('a shortfall and an impossible price refuse; the shortfall\'s delta wears no sign', async () => {
    const verdict = mountStatus({status: status({kind: 'short', paid: 10, delta: 2, labelKey: 'Not enough', ok: false})});
    expect(verdict.classes()).to.include('con-paystatus--short');
    expect(verdict.find('.con-paystatus__glyph').text()).to.eq('✕');
    expect(verdict.find('.con-paystatus__delta').text()).to.eq('2');
    await verdict.setProps({status: status({kind: 'impossible', paid: 3, labelKey: 'Not enough resources', ok: false})});
    expect(verdict.classes()).to.include('con-paystatus--impossible');
    expect(verdict.find('.con-paystatus__glyph').text()).to.eq('✕');
    expect(verdict.find('.con-paystatus__delta').exists(), 'the element stays, the delta leaves').to.eq(false);
    expect(verdict.find('.con-paystatus__verdict-text').text()).to.eq('Not enough resources');
  });

  it('a price in another unit names it on the icon and in the aria', () => {
    const verdict = mountStatus({status: status({cost: 4, paid: 4, costUnit: 'energy'})});
    expect(verdict.find('.con-paystatus__icon').classes()).to.include('resource_icon--energy');
    expect(verdict.attributes('aria-label')).to.eq('Paid: 4 of 4 Energy. Exact payment');
  });
});
