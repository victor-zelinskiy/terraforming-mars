import {mount} from '@vue/test-utils';
import {globalConfig} from './getLocalVue';
import {expect} from 'chai';
import SelectPaymentV2 from '@/client/components/SelectPaymentV2.vue';
import {SelectPaymentModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';

/*
 * Controlled mode is how the card-action confirmation modal embeds a payment
 * choice as a STEP: the widget never self-submits, it just emits the live
 * payment as a ready-to-batch `{type:'payment', payment}` response on `@change`.
 * PaymentFormV2 fires `change` immediately on mount with the default payment, so
 * the host captures a valid response without the player touching anything — and
 * the modal's single ВЫПОЛНИТЬ commits it. No standalone Confirm button.
 */
describe('SelectPaymentV2 — controlled mode', () => {
  function mountControlled(amount: number, playerFields: Partial<PublicPlayerModel>, paymentOptions: SelectPaymentModel['paymentOptions']) {
    const thisPlayer: Partial<PublicPlayerModel> = {
      steel: 0, titanium: 0, heat: 0, megacredits: 0, steelValue: 2, titaniumValue: 3, tableau: [],
      ...playerFields,
    };
    const playerView: Partial<PlayerViewModel> = {thisPlayer: thisPlayer as PublicPlayerModel, id: 'playerid-foo'};
    const playerinput: SelectPaymentModel = {
      type: 'payment', buttonLabel: 'Pay', title: 'foo', amount, paymentOptions,
      auroraiData: 0, kuiperAsteroids: 0, seeds: 0, spireScience: 0, floaters: 0, microbes: 0, graphene: 0, reserveUnits: undefined,
    };
    return mount(SelectPaymentV2, {
      ...globalConfig,
      props: {playerView, playerinput, onsave: () => {}, controlled: true, showsave: false, showtitle: false},
    });
  }

  it('emits a ready-to-batch {type:"payment"} response on mount, covering the cost', () => {
    const wrapper = mountControlled(12, {megacredits: 100, titanium: 3, titaniumValue: 3}, {titanium: true});
    const emitted = wrapper.emitted('change');
    expect(emitted, 'controlled SelectPaymentV2 must emit change on mount').is.not.undefined;
    const last = (emitted as Array<Array<unknown>>)[emitted!.length - 1][0] as {type: string, payment: Record<string, number>};
    expect(last.type).eq('payment');
    // The default mix covers the 12 M€ cost (titanium ×3 + M€), whatever the split.
    expect(last.payment.megacredits + last.payment.titanium * 3).is.at.least(12);
  });

  it('renders NO standalone Confirm button (the modal owns the single submit)', () => {
    const wrapper = mountControlled(8, {megacredits: 100, steel: 4}, {steel: true});
    expect(wrapper.find('[data-test="save"]').exists()).is.false;
  });

  it('emits undefined while the mix is under the cost, so the host keeps its CTA disabled', async () => {
    // titanium 4 (×3 = 12) is the only resource, no M€. Default maxes it (= 12).
    const wrapper = mountControlled(12, {megacredits: 0, titanium: 4, titaniumValue: 3}, {titanium: true});
    let emitted = wrapper.emitted('change') as Array<Array<unknown>>;
    expect(emitted[emitted.length - 1][0], 'the covering default must be a real response').is.not.undefined;
    // Drop one titanium → 3 × 3 = 9 < 12, and there's no M€ to make it up.
    await wrapper.find('[data-test="titanium"] .payment-v2-step--minus').trigger('click');
    emitted = wrapper.emitted('change') as Array<Array<unknown>>;
    expect(emitted[emitted.length - 1][0], 'an under-payment must emit undefined').is.undefined;
  });

  it('MAX on heat (Helion) does NOT overpay when an alt resource is already seeded', async () => {
    // Regression: cost 10, default seeds steel 3 (×2 = 6) + M€ 4. MAX heat used to
    // set heat to the FULL cost (10) on top of the still-allocated steel (6) and only
    // re-balance M€ → total 16, a 6 M€ overpay. With the fix, MAX heat maximizes heat
    // and drops the OTHER resources, so the total spent equals the cost exactly.
    const wrapper = mountControlled(10, {megacredits: 50, steel: 3, heat: 20, steelValue: 2}, {steel: true, heat: true});
    const max = wrapper.find('[data-test="heat"] .payment-v2-step--max');
    expect(max.exists(), 'heat MAX control should render').is.true;
    await max.trigger('click');
    await wrapper.vm.$nextTick();
    const emitted = wrapper.emitted('change') as Array<Array<unknown>>;
    const last = emitted[emitted.length - 1][0] as {type: string, payment: Record<string, number>};
    const total = last.payment.megacredits + last.payment.steel * 2 + last.payment.heat;
    expect(total, 'MAX heat must not overpay').to.eq(10);
    expect(last.payment.heat, 'heat should be used').to.be.greaterThan(0);
  });

  it('re-emits the updated response when the player adjusts the resource mix', async () => {
    const wrapper = mountControlled(12, {megacredits: 100, titanium: 3, titaniumValue: 3}, {titanium: true});
    // The default already spends titanium; decrement it and confirm a fresh change fires.
    const minus = wrapper.find('[data-test="titanium"] .payment-v2-step--minus');
    expect(minus.exists(), 'titanium row − control should render').is.true;
    const before = (wrapper.emitted('change') as Array<Array<unknown>>).length;
    await minus.trigger('click');
    const emitted = wrapper.emitted('change') as Array<Array<unknown>>;
    expect(emitted.length, 'a fresh change must re-emit').is.greaterThan(before);
    const last = emitted[emitted.length - 1][0] as {type: string, payment: Record<string, number>};
    expect(last.type).eq('payment');
    // Still covers the cost after the adjustment.
    expect(last.payment.megacredits + last.payment.titanium * 3).is.at.least(12);
  });
});
