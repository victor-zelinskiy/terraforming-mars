/*
 * ConsoleColonyLedger — the ONE reading of «gain all your colony bonuses k times»: the multiplier (the yield block's
 * own line), a row per tile — the printed bonus, «× k», the total, the state — and the sums by unit; and the same
 * ledger for a CARD's payout (no multiplier line, no sums, receipts by landing). A `<script setup>` component (step A
 * of docs/claude/vapor/RECIPES.md): nothing here computes — the reading arrives as a prop from `colonyLedgerModel`.
 * It emits nothing and exposes nothing.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {$t, translateText} from '@/client/directives/i18n';
import {CardResource} from '@/common/CardResource';
import {ColonyName} from '@/common/colonies/ColonyName';
import {ColonyLedgerBonus, ColonyLedgerRow, ColonyLedgerTotals} from '@/common/parliament/colonyLedger';
import {InfluenceScaledEffect, InfluenceYield} from '@/common/parliament/influenceScaling';
import {COLONY_LEDGER_TOTAL, ColonyLedgerReading, colonyLedgerEmptyKey} from '@/client/console/parliament/colonyLedgerModel';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {resolvePluralGroups} from '@/client/i18n/pluralForms';
import {getPreferences} from '@/client/utils/PreferencesManager';
import ConsoleColonyLedger from '@/client/components/console/parliament/ConsoleColonyLedger.vue';

// The multiplier line is the yield block's own subject; here it is a mark that carries what the ledger hands it.
// (A render function, not a template string: the runtime compiler is not in this build.)
const YieldStub = defineComponent({
  name: 'ConsoleInfluenceYield',
  props: {
    yields: {type: Array, required: true},
    oneNumber: Boolean,
    formula: {type: Boolean, default: true},
    captions: {type: Boolean, default: true},
    size: String,
  },
  render: () => h('i', {class: 'yield-stub'}),
});

const EFFECT: InfluenceScaledEffect = {id: 'colonyBonuses', unit: {kind: 'cardResource', resources: [CardResource.ANIMAL]}, perInfluence: 1, recipient: 'each'};
const YIELDS: ReadonlyArray<InfluenceYield> = [{effect: EFFECT, context: 'estimate', influence: 3, amount: 3}];

const MONEY: ColonyLedgerBonus = {kind: 'stock', resource: 'megacredits', amount: 2, description: 'Gain 2 M€'};
const ENERGY: ColonyLedgerBonus = {kind: 'production', resource: 'energy', amount: 1, description: 'Gain 1 energy production'};
const PAIR: ColonyLedgerBonus = {kind: 'draw-discard', amount: 1, description: 'Draw 1 card and discard 1 card'};
const DISCOUNT: ColonyLedgerBonus = {kind: 'hud', amount: 1, description: 'Gain a card discount'};

const NO_TOTALS: ColonyLedgerTotals = {stock: [], production: [], cardResources: [], cards: 0, pairs: 0, other: 0};

const row = (colony: ColonyName, bonus: ColonyLedgerBonus, multiplier: number, over: Partial<ColonyLedgerRow> = {}): ColonyLedgerRow => ({
  colony, bonus, multiplier, cubes: 1, total: bonus.amount * multiplier, state: 'pending', records: [], ...over,
});

type LedgerProps = {
  reading: ColonyLedgerReading,
  size?: 'compact' | 'normal' | 'hero',
  kicker?: string,
  person?: 'you' | 'they',
  activeColony?: string,
  landedColonies?: ReadonlySet<string>,
};

function ledger(props: LedgerProps) {
  return mount(ConsoleColonyLedger, {
    ...globalConfig,
    props,
    global: {...globalConfig.global, stubs: {ConsoleInfluenceYield: YieldStub}},
  });
}

const rowOf = (w: ReturnType<typeof ledger>, colony: ColonyName) => w.find(`[data-colony-row="${colony}"]`);
const timesWord = (n: number): string => resolvePluralGroups(translateText('time(s)'), getPreferences().lang, n);

describe('ConsoleColonyLedger — the one reading of «all your colony bonuses»', () => {
  it('a RESOLUTION at the vote: the multiplier line, a row per tile — the printed bonus, «× k», the total — and the sums by unit', () => {
    const w = ledger({
      reading: {
        effect: EFFECT, context: 'vote', yields: YIELDS, multiplier: 3, winMultiplier: 4, empty: false,
        rows: [row(ColonyName.LUNA, MONEY, 3), row(ColonyName.TITAN, ENERGY, 3), row(ColonyName.PLUTO, PAIR, 3)],
        totals: {...NO_TOTALS, stock: [{resource: 'megacredits', amount: 6}], production: [{resource: 'energy', amount: 3}], pairs: 3},
      },
      size: 'compact',
      kicker: 'Colony bonuses',
    });
    expect(w.classes()).to.include.members(['con-cledger', 'con-cledger--compact', 'con-cledger--vote']);
    expect(w.classes(), 'a resolution\'s reading is no card\'s').to.not.include('con-cledger--card');
    expect(w.attributes('data-colony-ledger-context')).to.eq('vote');
    expect(w.attributes('data-colony-ledger-multiplier')).to.eq('3');
    expect(w.attributes('data-colony-ledger-win')).to.eq('4');
    expect(w.attributes('data-colony-ledger-rows')).to.eq('3');
    expect(w.attributes('data-colony-ledger-empty')).to.eq(undefined);
    expect(w.find('.con-cledger__kicker').text()).to.eq($t('Colony bonuses'));

    const k = w.findComponent(YieldStub);
    expect(k.props('yields')).to.deep.eq(YIELDS);
    expect(k.props('oneNumber'), 'the vote reads ONE number').to.eq(true);
    expect(k.props('formula')).to.eq(false);
    expect(k.props('captions')).to.eq(false);
    expect(k.props('size')).to.eq('compact');
    expect(k.classes()).to.include('con-cledger__k');

    const rows = w.findAll('.con-cledger__rows > .con-cledger__row');
    expect(rows.map((r) => r.attributes('data-colony-row'))).to.deep.eq([ColonyName.LUNA, ColonyName.TITAN, ColonyName.PLUTO]);
    expect(rows.map((r) => r.attributes('data-colony-row-state'))).to.deep.eq(['pending', 'pending', 'pending']);
    expect(rows.map((r) => r.attributes('data-colony-row-total'))).to.deep.eq(['6', '3', '3']);
    expect(rows.map((r) => r.find('.con-cledger__name').text())).to.deep.eq([$t(ColonyName.LUNA), $t(ColonyName.TITAN), $t(ColonyName.PLUTO)]);
    expect(rows.map((r) => r.find('.con-cledger__planet').classes().includes(`${r.attributes('data-colony-row')}-background`))).to.deep.eq([true, true, true]);
    expect(rows.map((r) => r.find('[data-colony-row-times]').text())).to.deep.eq(['× 3', '× 3', '× 3']);
    expect(rows.map((r) => r.find('.con-cledger__state').text()), 'nothing is paid yet — the cell stands empty').to.deep.eq(['', '', '']);

    const luna = rowOf(w, ColonyName.LUNA);
    expect(luna.find('[data-colony-bonus] .con-cledger__num').text()).to.eq('+2');
    expect(luna.find('[data-colony-bonus] .con-cledger__unit').classes()).to.include.members(iconClassFor('megacredits').split(' '));
    expect(luna.find('[data-colony-row-sum] .con-cledger__num--sum').text()).to.eq('+6');
    const titan = rowOf(w, ColonyName.TITAN);
    expect(titan.find('[data-colony-bonus] .con-cledger__unit').classes()).to.include.members([...iconClassFor('energy').split(' '), 'con-cledger__unit--prod']);
    // Pluto's pair never merges: «card → discard», and the total is the number of PAIRS with its word.
    const pluto = rowOf(w, ColonyName.PLUTO);
    expect(pluto.find('[data-colony-bonus] .con-cledger__disc').exists()).to.eq(true);
    expect(pluto.find('[data-colony-bonus] .con-cledger__num').exists()).to.eq(false);
    expect(pluto.find('[data-colony-row-sum] .con-cledger__num--sum').text()).to.eq('3');
    expect(pluto.find('[data-colony-row-sum] .con-cledger__times-word').text()).to.eq(timesWord(3));

    const totals = w.find('[data-colony-ledger-totals]');
    expect(totals.find('.con-cledger__totals-kicker').text()).to.eq($t(COLONY_LEDGER_TOTAL));
    const sums = totals.findAll('[data-colony-ledger-sum]');
    expect(sums.map((sum) => sum.attributes('data-colony-ledger-sum'))).to.deep.eq(['stock:megacredits', 'production:energy', 'pairs']);
    expect(sums.map((sum) => sum.find('.con-cledger__num').text())).to.deep.eq(['+6', '+3', '3']);
    expect(sums[1].find('.con-cledger__unit').classes()).to.include('con-cledger__unit--prod');
    expect(sums[2].find('.con-cledger__times-word').text()).to.eq($t('card → discard'));
  });

  it('an APPLIED ledger: a skip names its reason, a paid row is «received» — on its LANDING where the stage hands one in; the active row is marked', async () => {
    const reading: ColonyLedgerReading = {
      effect: EFFECT, context: 'applied', yields: YIELDS, multiplier: 3, empty: false,
      rows: [
        row(ColonyName.LUNA, MONEY, 3, {state: 'paid'}),
        row(ColonyName.TITAN, ENERGY, 3, {state: 'paid'}),
        row(ColonyName.PLUTO, PAIR, 3, {state: 'skipped', skipped: 'The deck is empty'}),
      ],
      totals: {...NO_TOTALS, stock: [{resource: 'megacredits', amount: 6}]},
    };
    const w = ledger({reading});
    expect(w.classes()).to.include.members(['con-cledger--normal', 'con-cledger--applied']);
    expect(w.findComponent(YieldStub).props('oneNumber'), 'only the vote reads one number').to.eq(false);
    expect(w.find('.con-cledger__kicker').exists(), 'no kicker was given').to.eq(false);
    const stateOf = (colony: ColonyName) => rowOf(w, colony).attributes('data-colony-row-state');
    expect([stateOf(ColonyName.LUNA), stateOf(ColonyName.TITAN), stateOf(ColonyName.PLUTO)], 'no landings handed in: a paid record reads received at once').to.deep.eq(
      ['received', 'received', 'skipped']);
    const received = rowOf(w, ColonyName.LUNA).find('.con-cledger__state');
    expect(received.classes()).to.include('con-cledger__state--received');
    expect(received.text()).to.eq(`✓ ${$t('Received')}`);
    const skipped = rowOf(w, ColonyName.PLUTO).find('.con-cledger__state');
    expect(skipped.classes()).to.include('con-cledger__state--skipped');
    expect(skipped.attributes('data-colony-row-reason')).to.eq('');
    expect(skipped.text()).to.eq(`✕ ${$t('The deck is empty')}`);
    expect(rowOf(w, ColonyName.PLUTO).classes()).to.include('con-cledger__row--skipped');

    await w.setProps({landedColonies: new Set<string>([ColonyName.LUNA]), activeColony: ColonyName.TITAN});
    expect([stateOf(ColonyName.LUNA), stateOf(ColonyName.TITAN), stateOf(ColonyName.PLUTO)], 'Titan\'s wave is still in the air').to.deep.eq(
      ['received', 'pending', 'skipped']);
    expect(rowOf(w, ColonyName.TITAN).classes()).to.include.members(['con-cledger__row--pending', 'con-cledger__row--active']);
    expect(rowOf(w, ColonyName.TITAN).attributes('data-colony-row-active')).to.eq('');
    expect(rowOf(w, ColonyName.LUNA).attributes('data-colony-row-active')).to.eq(undefined);
    expect(rowOf(w, ColonyName.TITAN).find('.con-cledger__state').text()).to.eq('');
  });

  it('a CARD\'s ledger: no multiplier line and no sums; «× N» only above one cube; a pending row wears the word of its step; a receipt is the row\'s landing', async () => {
    const reading: ColonyLedgerReading = {
      context: 'preview', multiplier: 1, empty: false,
      rows: [
        row(ColonyName.LUNA, MONEY, 1, {state: 'paid'}),
        row(ColonyName.TITANIA, DISCOUNT, 2, {cubes: 2}),
        row(ColonyName.MIRANDA, {kind: 'card-resource', resource: CardResource.ANIMAL, amount: 1, description: 'Add 1 animal to a card'}, 1, {asks: 'card'}),
      ],
      totals: {...NO_TOTALS, stock: [{resource: 'megacredits', amount: 2}]},
    };
    const w = ledger({reading});
    expect(w.classes()).to.include.members(['con-cledger--card', 'con-cledger--preview']);
    expect(w.findComponent(YieldStub).exists(), 'a card has no influence — no multiplier line').to.eq(false);
    expect(w.find('[data-colony-ledger-totals]').exists(), 'the composer\'s own chips are the sums').to.eq(false);

    const luna = rowOf(w, ColonyName.LUNA);
    expect(luna.find('[data-colony-row-times]').text(), 'a single payout is whole in the bonus cell').to.eq('');
    expect(luna.find('[data-colony-row-sum]').text()).to.eq('');
    expect(luna.find('[data-colony-bonus] .con-cledger__num').text()).to.eq('+2');
    expect(luna.attributes('data-colony-row-state'), 'a card\'s payout keeps no record — paid is not yet received').to.eq('pending');

    // Two cubes: the row repeats — a description-only benefit reads its count with the word.
    const titania = rowOf(w, ColonyName.TITANIA);
    expect(titania.find('[data-colony-bonus] .con-cledger__desc').text()).to.eq($t('Gain a card discount'));
    expect(titania.find('[data-colony-row-times]').text()).to.eq('× 2');
    expect(titania.find('[data-colony-row-sum] .con-cledger__num--sum').text()).to.eq('2');
    expect(titania.find('[data-colony-row-sum] .con-cledger__times-word').text()).to.eq(timesWord(2));

    const asks = rowOf(w, ColonyName.MIRANDA).find('.con-cledger__state');
    expect(asks.classes()).to.include('con-cledger__state--asks');
    expect(asks.attributes('data-colony-row-asks')).to.eq('card');
    expect(asks.text()).to.eq($t('card choice'));

    await w.setProps({landedColonies: new Set<string>([ColonyName.LUNA])});
    expect(rowOf(w, ColonyName.LUNA).attributes('data-colony-row-state')).to.eq('received');
    expect(rowOf(w, ColonyName.LUNA).find('.con-cledger__state').text()).to.eq(`✓ ${$t('Received')}`);
    expect(rowOf(w, ColonyName.MIRANDA).attributes('data-colony-row-state')).to.eq('pending');
  });

  it('NO COLONIES is said in words — the viewer\'s phrase or another seat\'s — never an empty box', async () => {
    const w = ledger({reading: {effect: EFFECT, context: 'vote', yields: YIELDS, multiplier: 3, rows: [], totals: NO_TOTALS, empty: true}});
    expect(w.classes()).to.include('con-cledger--empty');
    expect(w.attributes('data-colony-ledger-empty')).to.eq('');
    expect(w.attributes('data-colony-ledger-rows')).to.eq('0');
    expect(w.find('[data-colony-ledger-none]').text()).to.eq($t(colonyLedgerEmptyKey('you')));
    expect(w.find('.con-cledger__rows').exists()).to.eq(false);
    expect(w.find('[data-colony-ledger-totals]').exists()).to.eq(false);
    expect(w.findComponent(YieldStub).exists(), 'the multiplier that would have applied still stands').to.eq(true);

    await w.setProps({person: 'they'});
    expect(w.find('[data-colony-ledger-none]').text()).to.eq($t(colonyLedgerEmptyKey('they')));
  });
});
