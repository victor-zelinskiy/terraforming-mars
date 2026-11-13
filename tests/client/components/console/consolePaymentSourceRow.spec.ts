/*
 * ConsolePaymentSourceRow — ONE source row of the console payment panel. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): what it renders for its props — the pure `PaymentSourceRow`, the density, the cursor,
 * the price's denomination, the pulse nonce. It emits nothing and exposes nothing (the host owns every input). The
 * rows are the real `buildPaymentView`'s; the unit runner renders the English keys.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {buildPaymentView, PaymentLane, PaymentSourceRow} from '@/client/console/paymentPlan';
import ConsolePaymentSourceRow from '@/client/components/console/ConsolePaymentSourceRow.vue';

const STEEL: PaymentLane = {unit: 'steel', rate: 2, available: 5, reserved: false};
const TITANIUM: PaymentLane = {unit: 'titanium', rate: 3, available: 4, reserved: false};

/** A price of 21: steel 2 of 5 (×2), titanium 1 of 4 (×3), M€ tops up the remaining 14 of 30. */
function mixedRows(): ReadonlyArray<PaymentSourceRow> {
  return buildPaymentView({cost: 21, lanes: [STEEL, TITANIUM], counts: {steel: 2, titanium: 1}, mcAvailable: 30}).rows;
}

/** A price of 11 with ONE alternative: steel is the quick-adjust lane, 5 of 5 owned (the «+» is at its limit). */
function quickSteel(): PaymentSourceRow {
  return buildPaymentView({cost: 11, lanes: [STEEL], counts: {steel: 5}, mcAvailable: 65}).rows[0];
}

function mountRow(row: PaymentSourceRow, props: Record<string, unknown> = {}) {
  return mount(ConsolePaymentSourceRow, {global: globalConfig.global, props: {row, ...props}});
}

describe('ConsolePaymentSourceRow — one source of a payment', () => {
  it('a dialed source: its unit on the hook, its sprite and name, the rate — and every number under its caption', () => {
    const steel = mixedRows()[0];
    const w = mountRow(steel);
    // The template starts with its root: the wrapper IS the row.
    expect(w.classes()).to.include.members(['con-payrow', 'con-payrow--live']);
    expect(w.classes()).to.not.include.members(['con-payrow--auto', 'con-payrow--idle', 'con-payrow--focused', 'con-payrow--dial']);
    expect(w.attributes('data-pay-unit')).to.eq('steel');
    expect(w.attributes('role')).to.eq('group');
    expect(w.find('.con-payrow__icon').classes()).to.include('resource_icon--steel');
    expect(w.find('.con-payrow__name').text()).to.eq('Steel');
    expect(w.find('.con-payrow__rate').text()).to.eq('×2');
    expect(w.findAll('.con-payrow__cap').map((c) => c.text())).to.deep.eq(['Used', 'Remaining', 'Contribution']);
    expect(w.find('.con-payrow__used').text()).to.eq('2');
    expect(w.find('.con-payrow__before').text()).to.eq('5');
    expect(w.find('.con-payrow__after').text()).to.eq('3');
    expect(w.find('.con-payrow__worth-num').text()).to.eq('4');
    expect(w.find('.con-payrow__worth-icon').classes(), 'the contribution reads in M€ by default').to.include('resource_icon--megacredits');
    expect(w.attributes('aria-label')).to.eq('Steel, Used: 2, Remaining: 3 of 5, Contribution: 4 M€');
  });

  it('the price\'s denomination follows `costUnit` — the contribution\'s icon and the aria reading', () => {
    const w = mountRow(mixedRows()[0], {costUnit: 'energy'});
    expect(w.find('.con-payrow__worth-icon').classes()).to.include('resource_icon--energy');
    expect(w.find('.con-payrow__worth-icon').classes()).to.not.include('resource_icon--megacredits');
    expect(w.attributes('aria-label')).to.contain('Contribution: 4 Energy');
  });

  it('the auto M€ lane TOPS UP: badged, never dialable, no rate — and an idle lane is marked', () => {
    const megacredits = mixedRows()[2];
    const w = mountRow(megacredits, {mode: 'expanded', focused: true});
    expect(w.attributes('data-pay-unit')).to.eq('megacredits');
    expect(w.classes()).to.include('con-payrow--auto');
    expect(w.find('.con-payrow__auto').text()).to.eq('auto');
    expect(w.find('.con-payrow__pills').exists(), 'the cursor on it gives no dial').to.eq(false);
    expect(w.find('.con-payrow__flash').exists()).to.eq(false);
    expect(w.find('.con-payrow__rate').exists(), 'M€ never carries a rate badge').to.eq(false);
    expect(w.find('.con-payrow__cap').text()).to.eq('Tops up');
    expect(w.find('.con-payrow__used').text()).to.eq('14');
    expect(w.attributes('aria-label')).to.eq('Megacredits, Tops up: 14, Remaining: 16 of 30, Contribution: 14 M€, Paid automatically');

    // A lane that spends nothing reads idle — until the cursor stands on it.
    const unused = buildPaymentView({cost: 21, lanes: [STEEL, TITANIUM], counts: {titanium: 1}, mcAvailable: 30}).rows[0];
    expect(mountRow(unused).classes()).to.include('con-payrow--idle');
    expect(mountRow(unused).classes()).to.not.include('con-payrow--live');
    expect(mountRow(unused, {mode: 'expanded', focused: true}).classes()).to.not.include('con-payrow--idle');
  });

  it('the dial pills stand on the row the bumpers DRIVE — the quick-adjust lane in the summary, the focused lane in the editor', async () => {
    // The summary: only the single quick-adjust lane; a direction at its limit is off.
    const quick = mountRow(quickSteel());
    expect(quick.classes()).to.include('con-payrow--dial');
    const pills = quick.findAll('.con-payrow__pill');
    expect(quick.findAll('.con-payrow__pill > span:last-child').map((p) => p.text())).to.deep.eq(['−1', '+1']);
    expect(pills.map((p) => p.classes().includes('con-payrow__pill--off')), '«−» is live, «+» is at the ownership limit').to.deep.eq([false, true]);
    expect(mountRow(mixedRows()[0]).find('.con-payrow__pills').exists(), 'one of two alternatives is no quick-adjust lane').to.eq(false);

    // The editor: the pills follow the cursor, whatever the lane.
    const row = mountRow(mixedRows()[0], {mode: 'expanded'});
    expect(row.find('.con-payrow__pills').exists()).to.eq(false);
    expect(row.find('.con-payrow__flash').exists()).to.eq(false);
    await row.setProps({focused: true});
    expect(row.classes()).to.include.members(['con-payrow--focused', 'con-payrow--dial']);
    expect(row.find('.con-payrow__pills').exists()).to.eq(true);

    // The one-shot pulse is RE-KEYED by the host's nonce: a new node each adjust (that is what restarts it).
    const before = row.find('.con-payrow__flash').element;
    await row.setProps({flashNonce: 1});
    const after = row.find('.con-payrow__flash').element;
    expect(after, 'a fresh pulse node').to.not.eq(before);
    await row.setProps({focused: false});
    expect(row.find('.con-payrow__flash').exists()).to.eq(false);
  });

  it('a card-bound lane names the card its units leave; a reserved lane says so', () => {
    const floaters = buildPaymentView({
      cost: 12, lanes: [{unit: 'floaters', rate: 3, available: 3, reserved: true}], counts: {floaters: 2}, mcAvailable: 20,
    }).rows[0];
    expect(floaters.sourceCard, 'the fixture: a card-bound lane has its card').to.not.eq(undefined);
    const w = mountRow(floaters);
    expect(w.find('.con-payrow__icon').classes(), 'the sprite key, not the ledger key').to.include('card-resource-floater');
    expect(w.find('.con-payrow__source').attributes('data-pay-source')).to.eq(floaters.sourceCard);
    expect(w.find('.con-payrow__source').text()).to.eq(`· ${floaters.sourceCard}`);
    expect(w.attributes('aria-label')).to.contain(`Floaters · ${floaters.sourceCard}, Used: 2`);
    expect(w.classes()).to.include('con-payrow--reserved');
    expect(w.find('.con-payrow__reserved').text()).to.eq('reserved');

    const plain = mountRow(mixedRows()[0]);
    expect(plain.find('.con-payrow__source').exists()).to.eq(false);
    expect(plain.find('.con-payrow__reserved').exists()).to.eq(false);
    expect(plain.classes()).to.not.include('con-payrow--reserved');
  });
});
