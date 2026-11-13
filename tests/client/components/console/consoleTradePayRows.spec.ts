/*
 * ConsoleTradePayRows — «СПОСОБ ОПЛАТЫ», the payment paths of a trade as rows; the colony focus stage and the
 * fleet-dock stage mount the same one. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md) and a
 * FRAGMENT on purpose, so it is mounted here the way its stages mount it: inside a host's own element, under the
 * string ref `payRows` — through which they read exactly one member, `focusedEl()` (the cursor's row, kept in view;
 * R11: a STRING ref key bound dynamically inside `v-for`).
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick, reactive} from 'vue';
import {globalConfig} from '../getLocalVue';
import ConsoleTradePayRows from '@/client/components/console/ConsoleTradePayRows.vue';
import {TradePayDisabledEntry, TradePayEntry, TradePayRow} from '@/client/console/colonyTrade/tradePayModel';

/** What a stage reads through its ref — the component's whole contract with its parents. */
type PayRowsReach = {focusedEl(): HTMLElement | undefined};

type PayProps = {
  heading?: boolean,
  rows?: ReadonlyArray<TradePayRow>,
  disabled?: ReadonlyArray<TradePayDisabledEntry>,
  chosenIndex?: number,
  lockedIndex?: number,
  focusedIndex?: number,
  energyIndex?: number,
  energyMixLive?: boolean,
  mix?: {energy: number, steel: number},
  mixAdjustable?: boolean,
  held?: TradePayEntry,
};

// The SERVER's option indexes ride along: 1 is a refused path, so the usable rows read 0 · 2 · 3.
const ROWS: ReadonlyArray<TradePayRow> = [
  {index: 0, title: 'Pay 9 M€', iconClass: 'resource_icon resource_icon--megacredits', preview: '30 → 21'},
  {index: 2, title: 'Pay 3 energy', iconClass: 'resource_icon resource_icon--energy', preview: '4 → 1'},
  {index: 3, title: 'Pay 3 titanium', iconClass: '', preview: ''},
];

function mountUnderHost(initial: PayProps) {
  const props = reactive<PayProps>({...initial});
  const Host = defineComponent({
    render: () => h('div', {class: 'stage-column'}, [h(ConsoleTradePayRows, {ref: 'payRows', ...props})]),
  });
  const host = mount(Host, {...globalConfig});
  return {
    host,
    props,
    /** Exactly the stages' read: `(this.$refs.payRows ?? undefined) as … | undefined`. */
    reach: () => (host.vm.$refs.payRows ?? undefined) as PayRowsReach | undefined,
    row: (index: number) => host.find(`.con-colfocus__payrow[data-pay-index="${index}"]`),
  };
}

describe('ConsoleTradePayRows — the payment paths of a trade', () => {
  it('renders the heading when asked, a row per path under the SERVER\'s index, and every refused path with its reason', async () => {
    const {host, props, row} = mountUnderHost({
      rows: ROWS,
      disabled: [{title: 'Pay 3 steel (1)', iconClass: 'resource_icon resource_icon--steel', reason: 'Not enough steel'}],
      chosenIndex: 0,
      focusedIndex: 2,
    });

    expect(host.find('.con-colfocus__sec-title').exists(), 'the heading is the stage\'s call').to.eq(false);
    // A fragment: the rows are the host column's own children — no wrapper box between them.
    const live = host.findAll('.stage-column > .con-colfocus__payrow[data-pay-index]');
    expect(live.map((r) => r.attributes('data-pay-index')), 'a filtered list never renumbers').to.deep.eq(['0', '2', '3']);
    expect(live.map((r) => r.find('.con-colfocus__payrow-title').text())).to.deep.eq(['Pay 9 M€', 'Pay 3 energy', 'Pay 3 titanium']);
    expect(live.map((r) => r.classes().includes('con-colfocus__payrow--focused')), 'the cursor').to.deep.eq([false, true, false]);
    expect(live.map((r) => r.classes().includes('con-colfocus__payrow--chosen')), 'the choice').to.deep.eq([true, false, false]);
    expect(live.map((r) => r.classes().includes('con-colfocus__payrow--locked')), 'no fee is pinned').to.deep.eq([false, false, false]);
    expect(live.map((r) => r.find('.con-colfocus__payrow-dot').exists()), 'the dot marks the chosen path').to.deep.eq([true, false, false]);

    expect(row(0).find('i.con-colfocus__payrow-icon').classes()).to.contain('resource_icon--megacredits');
    expect(row(0).find('.con-colfocus__payrow-delta').text()).to.eq('30 → 21');
    expect(row(3).find('.con-colfocus__payrow-icon').exists(), 'no icon class — no icon').to.eq(false);
    expect(row(3).find('.con-colfocus__payrow-delta').exists(), 'no preview — no delta').to.eq(false);

    const off = host.findAll('.stage-column > .con-colfocus__payrow--off');
    expect(off.length).to.eq(1);
    expect(off[0].attributes('data-pay-index'), 'a refused path is not a target').to.eq(undefined);
    expect(off[0].find('.con-colfocus__payrow-title').text()).to.eq('Pay 3 steel (1)');
    expect(off[0].find('.con-colfocus__payrow-reason').text()).to.eq('Not enough steel');
    expect(off[0].find('i.con-colfocus__payrow-icon').classes()).to.contain('resource_icon--steel');

    props.heading = true;
    props.lockedIndex = 0;
    await nextTick();
    expect(host.find('.stage-column > .con-colfocus__sec-title').text()).to.eq('Payment method');
    expect(row(0).classes(), 'the entry pins the fee to this path').to.contain('con-colfocus__payrow--locked');
  });

  it('the flexible family: the energy / steel pair while the substitution is live, the chosen row\'s draft in place of its delta, the next step named', async () => {
    const {props, row} = mountUnderHost({rows: ROWS, chosenIndex: 0, energyIndex: 2, energyMixLive: true});

    const pair = row(2).findAll('i.con-colfocus__payrow-icon');
    expect(pair.map((i) => i.classes().find((c) => c.startsWith('resource_icon--'))), 'never a lone energy icon over a family steel may pay')
      .to.deep.eq(['resource_icon--energy', 'resource_icon--steel']);
    expect(row(2).find('.con-colfocus__payrow-slash').exists()).to.eq(true);
    expect(row(2).find('.con-colfocus__payrow-mix').exists(), 'the family is not chosen — no draft yet').to.eq(false);
    expect(row(2).find('.con-colfocus__payrow-delta').text()).to.eq('4 → 1');
    expect(row(0).find('.con-colfocus__payrow-slash').exists(), 'the pair stands on the energy row only').to.eq(false);

    props.chosenIndex = 2;
    props.mix = {energy: 2, steel: 1};
    await nextTick();
    expect(row(2).findAll('.con-colfocus__payrow-mix > b').map((b) => b.text()), 'energy + steel, as drafted').to.deep.eq(['2', '1']);
    expect(row(2).find('.con-colfocus__payrow-delta').exists(), 'the stale energy-only delta is gone').to.eq(false);
    expect(row(2).find('.con-colfocus__payrow-next').exists(), 'one valid mix — nothing to compose').to.eq(false);

    props.mixAdjustable = true;
    await nextTick();
    expect(row(2).find('.con-colfocus__payrow-next').text()).to.eq('Next: payment composition');

    props.energyMixLive = false;
    await nextTick();
    expect(row(2).find('.con-colfocus__payrow-slash').exists(), 'the substitution left — the row wears its own icon').to.eq(false);
    expect(row(2).find('i.con-colfocus__payrow-icon').classes()).to.contain('resource_icon--energy');
  });

  it('past the commit the RECEIPT keeps showing what was chosen — only once the list itself is gone, with the mix it was paid with', async () => {
    const held: TradePayEntry = {title: 'Pay 3 energy', iconClass: 'resource_icon resource_icon--energy', preview: '4 → 1'};
    const {host, props} = mountUnderHost({rows: ROWS, held});
    expect(host.find('[data-pay-receipt]').exists(), 'the list still stands').to.eq(false);

    props.rows = [];
    await nextTick();
    const receipt = host.find('.stage-column > [data-pay-receipt]');
    expect(receipt.classes()).to.include.members(['con-colfocus__payrow', 'con-colfocus__payrow--chosen', 'con-colfocus__payrow--locked']);
    expect(receipt.find('.con-colfocus__payrow-dot').exists()).to.eq(true);
    expect(receipt.find('.con-colfocus__payrow-title').text()).to.eq('Pay 3 energy');
    expect(receipt.find('.con-colfocus__payrow-delta').text()).to.eq('4 → 1');
    expect(host.findAll('.con-colfocus__payrow[data-pay-index]').length).to.eq(0);

    props.held = {...held, mix: {energy: 2, steel: 0}};
    await nextTick();
    const paid = host.find('[data-pay-receipt] > .con-colfocus__payrow-mix');
    expect(paid.findAll('b').map((b) => b.text()), 'the composition actually paid — no steel, no «+»').to.deep.eq(['2']);
    expect(paid.find('span').exists()).to.eq(false);
    expect(host.find('[data-pay-receipt] > .con-colfocus__payrow-delta').exists(), 'never the energy-first preview').to.eq(false);

    props.held = undefined;
    await nextTick();
    expect(host.find('[data-pay-receipt]').exists()).to.eq(false);
  });

  it('a PARENT\'s ref sees exactly `focusedEl` — the node of the row under the cursor, following it, and nothing when the cursor is elsewhere', async () => {
    const {props, reach, row} = mountUnderHost({rows: ROWS, chosenIndex: 0, focusedIndex: 2});
    const payRows = reach();
    expect(payRows, 'the stage\'s ref stands').to.not.eq(undefined);
    expect(Object.keys(payRows ?? {}), 'the exposed list is the contract — nothing else of the script').to.deep.eq(['focusedEl']);
    expect((payRows as unknown as Record<string, unknown>).focusedRow, 'the template ref stays inside').to.eq(undefined);

    expect(payRows?.focusedEl(), 'the row itself, not the array the ref holds').to.eq(row(2).element);

    props.focusedIndex = 3;
    await nextTick();
    expect(payRows?.focusedEl(), 'the cursor stepped — the ref followed').to.eq(row(3).element);

    props.focusedIndex = -1;
    await nextTick();
    expect(payRows?.focusedEl(), 'the cursor left the payment rows').to.eq(undefined);

    props.focusedIndex = 0;
    await nextTick();
    expect(payRows?.focusedEl(), '…and came back').to.eq(row(0).element);
  });
});
