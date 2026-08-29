import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ConsolePaymentPanel from '@/client/components/console/ConsolePaymentPanel.vue';
import {buildEnergyMixView, buildPaymentView, PaymentLane, PaymentView} from '@/client/console/paymentPlan';

/**
 * The ONE console payment panel, rendered in both densities.
 *
 * The load-bearing claim under test is the UNIFICATION: `compact` and
 * `expanded` are the SAME rows, in the SAME order, with the SAME numbers and
 * the SAME verdict element — only the micro captions, the cursor and the dial
 * pills differ. Plus the layout-shift contract: the row set and the verdict
 * element are unconditional, so no payment state can add or drop a box.
 */
const STEEL: PaymentLane = {unit: 'steel', rate: 2, available: 5, reserved: false};
const TITANIUM: PaymentLane = {unit: 'titanium', rate: 3, available: 4, reserved: false};
const PLANTS: PaymentLane = {unit: 'plants', rate: 3, available: 7, reserved: false};

function view(over: Partial<Parameters<typeof buildPaymentView>[0]> = {}): PaymentView {
  return buildPaymentView({cost: 11, lanes: [STEEL], counts: {steel: 5}, mcAvailable: 65, ...over});
}

function mountPanel(v: PaymentView, props: Record<string, unknown> = {}) {
  return mount(ConsolePaymentPanel, {global: globalConfig.global, props: {view: v, ...props}});
}

function unitsOf(w: ReturnType<typeof mountPanel>): Array<string> {
  return w.findAll('.con-payrow').map((r) => r.attributes('data-pay-unit') ?? '');
}

describe('ConsolePaymentPanel — one panel, two densities', () => {
  it('compact renders every source row in lane order with M€ LAST', () => {
    const w = mountPanel(view({cost: 21, lanes: [STEEL, TITANIUM], counts: {steel: 2, titanium: 1}, mcAvailable: 30}));
    expect(unitsOf(w)).to.deep.equal(['steel', 'titanium', 'megacredits']);
    expect(w.find('.con-pay--compact').exists()).to.be.true;
  });

  /** The whole point: the LT switch changes DENSITY, not the content. */
  it('expanded renders the IDENTICAL rows, in the identical order', () => {
    const v = view({cost: 21, lanes: [STEEL, TITANIUM], counts: {steel: 2, titanium: 1}, mcAvailable: 30});
    const compact = mountPanel(v);
    const expanded = mountPanel(v, {mode: 'expanded', focusUnit: 'steel'});
    expect(unitsOf(expanded)).to.deep.equal(unitsOf(compact));
    expect(expanded.find('.con-pay--expanded').exists()).to.be.true;
    // ...and the same numbers, cell for cell.
    const nums = (w: ReturnType<typeof mountPanel>) =>
      w.findAll('.con-payrow').map((r) => [r.find('.con-payrow__used').text(), r.find('.con-payrow__stock').text(), r.find('.con-payrow__worth').text()]);
    expect(nums(expanded)).to.deep.equal(nums(compact));
  });

  /**
   * The micro captions are what turn three numbers into a table — «4» alone
   * does not say whether it is spent, left or worth. The quick summary needs
   * that as much as the editor does, so both densities render the SAME
   * captions (the editor only reads them louder, which is paint).
   */
  it('names every number in BOTH densities — the caption set is identical', () => {
    const v = view({cost: 21, lanes: [STEEL, TITANIUM], counts: {steel: 2, titanium: 1}, mcAvailable: 30});
    const caps = (w: ReturnType<typeof mountPanel>) => w.findAll('.con-payrow__cap').map((c) => c.text());
    const compact = caps(mountPanel(v));
    const expanded = caps(mountPanel(v, {mode: 'expanded', focusUnit: 'steel'}));
    // 3 rows × 3 numeric cells, every one of them labelled.
    expect(compact).to.have.length(9);
    expect(compact.every((t) => t !== '')).to.be.true;
    expect(compact).to.deep.equal(expanded);
  });

  it('the M€ lane TOPS UP rather than «uses» — its own caption says so', () => {
    const w = mountPanel(view({cost: 21, lanes: [STEEL, TITANIUM], counts: {steel: 2, titanium: 1}, mcAvailable: 30}));
    const usedCap = (i: number) => w.findAll('.con-payrow')[i].find('.con-payrow__cap').text();
    expect(usedCap(2)).to.not.equal(usedCap(0)); // «дополняет» vs «использ.»
  });

  it('a source row states used, before → after, and its M€ contribution', () => {
    const w = mountPanel(view());
    const steel = w.findAll('.con-payrow')[0];
    expect(steel.attributes('data-pay-unit')).to.equal('steel');
    expect(steel.find('.con-payrow__used').text()).to.equal('5');
    expect(steel.find('.con-payrow__before').text()).to.equal('5');
    expect(steel.find('.con-payrow__after').text()).to.equal('0');
    expect(steel.find('.con-payrow__worth-num').text()).to.equal('10');
    // The payment VALUE of one unit — why 5 steel pays 10.
    expect(steel.find('.con-payrow__rate').text()).to.equal('×2');
  });

  it('the M€ lane is badged AUTO, is never dialable, and is rendered even at 0 spent', () => {
    const w = mountPanel(view({cost: 10, counts: {steel: 5}}));
    const mc = w.findAll('.con-payrow')[1];
    expect(mc.attributes('data-pay-unit')).to.equal('megacredits');
    expect(mc.find('.con-payrow__auto').exists()).to.be.true;
    expect(mc.find('.con-payrow__pills').exists()).to.be.false;
    expect(mc.find('.con-payrow__used').text()).to.equal('0');
  });

  it('compact puts the dial pills on the single quick-adjust source only', () => {
    const w = mountPanel(view());
    const rows = w.findAll('.con-payrow');
    expect(rows[0].find('.con-payrow__pills').exists()).to.be.true;
    expect(rows[1].find('.con-payrow__pills').exists()).to.be.false;
  });

  it('a direction at its limit renders an --off pill (never a dead-looking live one)', () => {
    // 5 steel owned, cap = ceil(11/2) = 6 → up is at the ownership limit.
    const w = mountPanel(view());
    const pills = w.findAll('.con-payrow__pill');
    expect(pills).to.have.length(2);
    expect(pills[0].classes()).to.not.include('con-payrow__pill--off'); // down is live
    expect(pills[1].classes()).to.include('con-payrow__pill--off'); // up is capped
  });

  it('expanded moves the pills onto the FOCUSED source and marks it', () => {
    const v = view({cost: 21, lanes: [STEEL, TITANIUM], counts: {steel: 2, titanium: 1}, mcAvailable: 30});
    const w = mountPanel(v, {mode: 'expanded', focusUnit: 'titanium'});
    const rows = w.findAll('.con-payrow');
    expect(rows[1].classes()).to.include('con-payrow--focused');
    expect(rows[1].find('.con-payrow__pills').exists()).to.be.true;
    expect(rows[0].find('.con-payrow__pills').exists()).to.be.false;
    // The cursor is locatable by the hosts' scroll math.
    expect(w.find('.con-payrow--focused').attributes('data-pay-unit')).to.equal('titanium');
  });

  /** ── The layout-shift contract ─────────────────────────────────────── */
  it('the verdict element is UNCONDITIONAL — exact, overpay and shortfall all render one', () => {
    const exact = mountPanel(view());
    const overpay = mountPanel(view({cost: 11, lanes: [{...STEEL, available: 6}], counts: {steel: 6}}));
    const short = mountPanel(view({cost: 11, counts: {steel: 1}, mcAvailable: 0}));
    for (const w of [exact, overpay, short]) {
      expect(w.findAll('.con-paystatus')).to.have.length(1);
    }
    expect(exact.find('.con-paystatus').classes()).to.include('con-paystatus--exact');
    expect(overpay.find('.con-paystatus').classes()).to.include('con-paystatus--overpay');
    expect(short.find('.con-paystatus').classes()).to.include('con-paystatus--short');
  });

  it('appearing / disappearing overpay changes NO element count — only the verdict class', () => {
    const before = mountPanel(view({cost: 11, lanes: [{...STEEL, available: 6}], counts: {steel: 5}}));
    const after = mountPanel(view({cost: 11, lanes: [{...STEEL, available: 6}], counts: {steel: 6}}));
    const shape = (w: ReturnType<typeof mountPanel>) => ({
      rows: w.findAll('.con-payrow').length,
      status: w.findAll('.con-paystatus').length,
      delta: w.findAll('.con-paystatus__delta').length,
      cells: w.findAll('.con-payrow__cell').length,
    });
    expect(before.find('.con-paystatus').classes()).to.include('con-paystatus--exact');
    expect(after.find('.con-paystatus').classes()).to.include('con-paystatus--overpay');
    // Everything that occupies space is identical; only the delta VALUE box is
    // added, and the status reserves its height in CSS for exactly that.
    expect(shape(before).rows).to.equal(shape(after).rows);
    expect(shape(before).status).to.equal(shape(after).status);
    expect(shape(before).cells).to.equal(shape(after).cells);
  });

  it('the verdict states paid / cost and the signed delta', () => {
    const w = mountPanel(view({cost: 11, lanes: [{...STEEL, available: 6}], counts: {steel: 6}}));
    expect(w.find('.con-paystatus__paid').text()).to.equal('12');
    expect(w.find('.con-paystatus__cost').text()).to.equal('11');
    expect(w.find('.con-paystatus__delta').text()).to.equal('+1');
  });

  /** ── The mode-switch affordance lives IN the block, not beside it ──── */
  it('compact offers the expand hint only when the editor is a REAL second stage', () => {
    // TWO alternatives — a mix the bumpers cannot express → the entry earns its
    // place.
    const multi = view({cost: 21, lanes: [STEEL, TITANIUM], counts: {steel: 2, titanium: 1}, mcAvailable: 30});
    expect(mountPanel(multi).find('.con-pay__hint').exists()).to.be.true;
    // ONE alternative — this block already IS the editor (its own row carries
    // the dial pills), so «Настроить оплату» would open the same screen again.
    expect(mountPanel(view()).find('.con-payrow--dial').exists()).to.be.true;
    expect(mountPanel(view()).find('.con-pay__hint').exists()).to.be.false;
    // Pure AUTO M€ — nothing to configure at all.
    expect(mountPanel(view({lanes: [], counts: {}})).find('.con-pay__hint').exists()).to.be.false;
  });

  it('expanded offers the way back; a standalone host can suppress the hint entirely', () => {
    expect(mountPanel(view(), {mode: 'expanded'}).find('.con-pay__hint').exists()).to.be.true;
    expect(mountPanel(view(), {mode: 'expanded', hintMode: 'none'}).find('.con-pay__hint').exists()).to.be.false;
  });

  it('the price is stated once, in the block head', () => {
    const w = mountPanel(view({cost: 7}));
    expect(w.findAll('.con-pay__price-value')).to.have.length(1);
    expect(w.find('.con-pay__price-value').text()).to.equal('7');
  });

  it('icon-only data carries an accessible label on every row and on the verdict', () => {
    const w = mountPanel(view());
    for (const row of w.findAll('.con-payrow')) {
      expect(row.attributes('aria-label')).to.be.a('string').and.not.equal('');
    }
    expect(w.find('.con-paystatus').attributes('aria-label')).to.be.a('string').and.not.equal('');
    expect(w.find('.con-pay').attributes('aria-label')).to.be.a('string').and.not.equal('');
  });

  it('big numbers render intact (no truncation of a 3-digit stock)', () => {
    const w = mountPanel(view({cost: 99, lanes: [{unit: 'titanium', rate: 3, available: 40, reserved: false}], counts: {titanium: 33}, mcAvailable: 163}));
    const mc = w.findAll('.con-payrow')[1];
    expect(mc.find('.con-payrow__before').text()).to.equal('163');
    expect(mc.find('.con-payrow__after').text()).to.equal('163');
    expect(w.find('.con-paystatus').classes()).to.include('con-paystatus--exact');
  });

  /**
   * Martian Lumber Corp's plants are an ordinary alternative source and must
   * read as one: the same row, the same ×3 rate badge, the same dial pills the
   * single-alt quick-adjust puts on steel.
   */
  it('a plants lane (Martian Lumber Corp) is an ordinary alt source row', () => {
    const w = mountPanel(view({cost: 12, lanes: [PLANTS], counts: {plants: 4}, mcAvailable: 20}));
    expect(unitsOf(w)).to.deep.equal(['plants', 'megacredits']);
    const plants = w.findAll('.con-payrow')[0];
    expect(plants.find('.con-payrow__rate').text()).to.equal('×3');
    expect(plants.find('.con-payrow__used').text()).to.equal('4');
    expect(plants.find('.con-payrow__worth-num').text()).to.equal('12'); // 4 × 3
    expect(plants.find('.con-payrow__icon').classes()).to.include('resource_icon--plants');
    // The only alternative → the bumpers drive it in place, no editor stage.
    expect(plants.find('.con-payrow__pills').exists()).to.be.true;
    expect(w.find('.con-pay__hint').exists()).to.be.false;
  });

  /**
   * A row's icon comes from the SPRITE table, not from the ledger key — the
   * `card-resource-*` classes are generated singular, so `microbes` /
   * `auroraiData` / `lunaArchivesScience` used to resolve to classes no
   * stylesheet defines and painted an empty box.
   */
  it('card-bound sources resolve a REAL sprite class, not their ledger key', () => {
    const cases: Array<[PaymentLane, string]> = [
      [{unit: 'microbes', rate: 2, available: 3, reserved: false}, 'card-resource-microbe'],
      [{unit: 'floaters', rate: 3, available: 3, reserved: false}, 'card-resource-floater'],
      [{unit: 'lunaArchivesScience', rate: 1, available: 3, reserved: false}, 'card-resource-science'],
      [{unit: 'seeds', rate: 5, available: 3, reserved: false}, 'card-resource-seed'],
      [{unit: 'auroraiData', rate: 3, available: 3, reserved: false}, 'card-resource-data'],
      [{unit: 'kuiperAsteroids', rate: 1, available: 3, reserved: false}, 'card-resource-asteroid'],
    ];
    for (const [lane, expected] of cases) {
      const w = mountPanel(view({cost: 12, lanes: [lane], counts: {}, mcAvailable: 20}));
      expect(w.findAll('.con-payrow')[0].find('.con-payrow__icon').classes(), lane.unit).to.include(expected);
    }
  });

  /**
   * The ENERGY-EQUIVALENT price (Delta Works: 1 steel = 1 energy) — the SAME
   * panel over `buildEnergyMixView`: an energy-denominated ledger (every
   * price/contribution icon follows `costUnit`), steel as the one dialable
   * lane, energy as the auto lane that tops up the remainder, and the
   * modifier's source badge naming the card.
   */
  it('an energy-denominated view swaps every ledger icon to energy and badges the source card', () => {
    const v = buildEnergyMixView({cost: 3, energyAvailable: 500, steelAvailable: 502, minSteel: 0, maxSteel: 3, steelUsed: 1});
    const w = mountPanel(v, {titleKey: 'Payment mix', hintMode: 'none', sourceCard: 'Delta Works'});
    expect(unitsOf(w)).to.deep.equal(['steel', 'energy']);
    // The price and the verdict ledger are stated in ENERGY, not M€.
    expect(w.find('.con-pay__price-icon').classes()).to.include('resource_icon--energy');
    expect(w.find('.con-paystatus__icon').classes()).to.include('resource_icon--energy');
    const [steel, energy] = w.findAll('.con-payrow');
    expect(steel.find('.con-payrow__worth-icon').classes()).to.include('resource_icon--energy');
    // Steel is the dialable lane (pills in place, no editor hint), 1:1 —
    // never the ×2 steelValue of a card payment.
    expect(steel.find('.con-payrow__pills').exists()).to.be.true;
    expect(steel.find('.con-payrow__rate').exists()).to.be.false;
    expect(w.find('.con-pay__hint').exists()).to.be.false;
    // Energy tops up the remainder — the auto lane's own caption + badge.
    expect(energy.find('.con-payrow__auto').exists()).to.be.true;
    expect(energy.find('.con-payrow__used').text()).to.equal('2');
    expect(steel.find('.con-payrow__used').text()).to.equal('1');
    // The modifier's source badge: the card name + the 1:1 exchange rule.
    const badge = w.find('.con-pay__source');
    expect(badge.exists()).to.be.true;
    expect(badge.find('.con-pay__source-card').text()).to.equal('Delta Works');
    expect(badge.findAll('.con-pay__source-icon')).to.have.length(2);
    // The verdict: paid 3 / 3, exact.
    expect(w.find('.con-paystatus__paid').text()).to.equal('3');
    expect(w.find('.con-paystatus').classes()).to.include('con-paystatus--exact');
  });

  it('a single-allocation energy price is read-only: no pills, no badge without a mix', () => {
    const v = buildEnergyMixView({cost: 1, energyAvailable: 5, steelAvailable: 0, minSteel: 0, maxSteel: 0, steelUsed: 0});
    const w = mountPanel(v, {hintMode: 'none'});
    expect(unitsOf(w)).to.deep.equal(['energy']);
    const energy = w.findAll('.con-payrow')[0];
    // Alone, energy is simply the price — not an «auto» lane topping up.
    expect(energy.find('.con-payrow__auto').exists()).to.be.false;
    expect(energy.find('.con-payrow__pills').exists()).to.be.false;
    expect(w.find('.con-pay__source').exists()).to.be.false;
    expect(w.find('.con-paystatus').classes()).to.include('con-paystatus--exact');
  });

  it('an unaffordable energy price blocks with an honest shortfall in energy units', () => {
    const v = buildEnergyMixView({cost: 5, energyAvailable: 1, steelAvailable: 2, minSteel: 3, maxSteel: 2, steelUsed: 0});
    const w = mountPanel(v, {hintMode: 'none'});
    expect(w.find('.con-pay--blocked').exists()).to.be.true;
    expect(w.find('.con-paystatus').classes()).to.include('con-paystatus--short');
    expect(w.find('.con-paystatus__delta').text()).to.equal('2');
    expect(w.find('.con-paystatus__delta-icon').classes()).to.include('resource_icon--energy');
  });
});
