/*
 * ConsoleSitTotals — what ONE seat got: its totals, one token per unit, never a chip per record. The one renderer of a
 * seat's total, shared by the results card's ledger and the breakdown under it. A `<script setup>` component (step A
 * of docs/claude/vapor/RECIPES.md): it emits and exposes nothing — its contract is the tokens, the fold and the marks
 * row it draws for the totals it is handed.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {PartyName} from '@/common/turmoil/PartyName';
import {partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {ResultsPayoutPart, ResultsTotal, ResultsTotalSource} from '@/client/console/parliament/parliamentResultsModel';
import ConsoleSitTotals from '@/client/components/console/parliament/ConsoleSitTotals.vue';

// An object and a skip are drawn by the one record renderer — its own subject; this spec reads what a total HANDS it.
// (A render function, not a template string: the runtime compiler is not in this build.)
const PartStub = defineComponent({
  name: 'ConsoleSitPayoutPart',
  props: {part: Object, leadsColony: Boolean},
  render: () => h('i', {class: 'part-stub'}),
});

const total = (over: Partial<ResultsTotal> = {}): ResultsTotal =>
  ({id: 't', kind: 'unit', unit: 'megacredits', family: 'stock', production: false, sources: [], records: 1, ...over});
const part = (over: Partial<ResultsPayoutPart> = {}): ResultsPayoutPart => ({id: 'p', kind: 'colony', unit: '', production: false, ...over});

function ledger(props: Record<string, unknown>, attrs: Record<string, unknown> = {}) {
  return mount(ConsoleSitTotals as any, {
    ...globalConfig,
    props,
    attrs,
    global: {...globalConfig.global, stubs: {ConsoleSitPayoutPart: PartStub}},
  });
}

/** The classes the shared resolver gives an icon key — what a token's unit must wear. */
const sprite = (key: string): Array<string> => iconClassFor(key).split(' ').filter((c) => c !== '');

const TOKEN = '.con-sit__totals-tokens > [data-sit-total]';

describe('ConsoleSitTotals — what one seat got', () => {
  it('ONE token per unit: the signed number, its icon — a loss, a production frame, the card a resource landed on, a discard', () => {
    const w = ledger({totals: [
      total({id: 'mc', amount: 6, records: 2}),
      total({id: 'heat', unit: 'heat', production: true, amount: -1}),
      total({id: 'microbe', unit: 'Microbe', family: 'cardResource', amount: 2, card: 'Tardigrades'}),
      total({id: 'either', unit: '', units: ['Data', 'Microbe'], family: 'cardResource', amount: 1}),
      total({id: 'thrown', kind: 'discard', unit: 'cards', family: 'cards', amount: 1}),
    ]}, {'class': 'from-host'});
    // The template STARTS WITH ITS ROOT: the host's class lands on the totals.
    expect((w.element as HTMLElement).tagName).to.eq('SPAN');
    expect(w.classes()).to.include.members(['con-sit__totals', 'from-host']);
    expect(w.attributes('data-sit-totals')).to.eq('');

    const tokens = w.findAll(TOKEN);
    expect(tokens.map((t) => t.attributes('data-sit-total-kind'))).to.deep.eq(['unit', 'unit', 'unit', 'unit', 'discard']);
    expect(tokens.map((t) => t.attributes('data-sit-total-unit'))).to.deep.eq(['megacredits', 'heat', 'Microbe', '', 'cards']);
    expect(tokens.map((t) => t.attributes('data-sit-total-amount'))).to.deep.eq(['6', '-1', '2', '1', '1']);
    expect(tokens[0].attributes('data-sit-total-records')).to.eq('2');
    expect(tokens.map((t) => t.find('.con-sit__total-amount').text()), 'signed — and a discard is a bare count').to.deep.eq(['+6', '−1', '+2', '+1', '1']);
    expect(tokens.map((t) => t.classes().includes('con-sit__total--loss'))).to.deep.eq([false, true, false, false, false]);
    expect(tokens.map((t) => t.attributes('data-sit-total-production'))).to.deep.eq([undefined, '', undefined, undefined, undefined]);

    expect(tokens[0].find('i.con-sit__total-unit').classes()).to.include.members(sprite('megacredits'));
    expect(tokens[1].find('i.con-sit__total-unit').classes()).to.include.members([...sprite('heat'), 'con-iyield__unit--prod']);
    expect(tokens[2].find('i.con-sit__total-unit').classes()).to.include.members(sprite('microbe'));
    expect(tokens[2].find('[data-sit-total-card]').text(), 'the card\'s mini name beside the icon').to.eq($t('Tardigrades'));
    // A unit of several kinds draws as ONE unit, an icon per kind.
    expect(tokens[3].findAll('i.con-iyield__unit.con-sit__total-unit').length).to.eq(2);
    expect(tokens[4].classes()).to.include('con-sit__total--discard');
    expect(tokens[4].find('.con-sit__total-discard').exists()).to.eq(true);
    expect(tokens[4].find('i.con-sit__total-unit').classes()).to.include.members(sprite('cards'));
  });

  it('an object and a skip are ONE record each, drawn by the one record renderer — and the FOLD counts what it hides', async () => {
    const built = part({id: 'built', tile: 'colony', colony: 'Luna'});
    const skip = part({id: 'skip', kind: 'skipped', skipped: {title: 'Draw a card', reason: 'The deck is empty'}});
    const w = ledger({totals: [
      total({id: 'mc', amount: 6}),
      total({id: 'object', kind: 'object', unit: '', family: 'none', part: built}),
      total({id: 'skipped', kind: 'skipped', unit: '', family: 'none', part: skip}),
      total({id: 'steel', unit: 'steel', amount: 2}),
    ]});

    const tokens = w.findAll(TOKEN);
    expect(tokens.map((t) => t.attributes('data-sit-total-kind')), 'a skip is never a token').to.deep.eq(['unit', 'object', 'unit']);
    expect(tokens[1].classes()).to.include('con-sit__total--object');
    expect(tokens[1].attributes('data-sit-total-unit')).to.eq('colony');
    expect(tokens[1].attributes('data-sit-total-records')).to.eq('1');

    const skips = w.findAll('.con-sit__total--skipped');
    expect(skips.length).to.eq(1);
    expect(skips[0].attributes('data-sit-total-kind')).to.eq('skipped');
    expect(w.find('.con-sit__totals-tokens .con-sit__total--skipped').exists(), 'the skip stands apart from the tokens').to.eq(false);

    const records = w.findAllComponents(PartStub);
    expect(records.length).to.eq(2);
    expect(records[0].props('part')).to.deep.eq(built);
    expect(records[0].props('leadsColony'), 'a colony BUILT names which tile').to.eq(true);
    expect(records[1].props('part')).to.deep.eq(skip);
    expect(records[1].props('leadsColony')).to.eq(false);
    expect(w.find('[data-sit-total-fold]').exists(), 'no fold — every token shown').to.eq(false);

    // The solver's fold: this many tokens, the rest COUNTED — the skip is not a token and is never folded away.
    await w.setProps({fold: 1});
    expect(w.findAll(TOKEN).map((t) => t.attributes('data-sit-total-unit'))).to.deep.eq(['megacredits']);
    const fold = w.find('[data-sit-total-fold]');
    expect(fold.attributes('data-sit-total-fold-count')).to.eq('2');
    expect(fold.text()).to.include('+2');
    expect(w.findAll('.con-sit__total--skipped').length).to.eq(1);

    await w.setProps({fold: undefined});
    expect(w.findAll(TOKEN).length).to.eq(3);
    expect(w.find('[data-sit-total-fold]').exists()).to.eq(false);
  });

  it('the marks row says WHERE the totals came from, in icons only — and stands only when there are marks', () => {
    const marks: Array<ResultsTotalSource> = [{kind: 'colony', colony: 'Luna', times: 2}, {kind: 'colony', colony: 'Pluto'}, {kind: 'party', party: PartyName.GREENS}, {kind: 'winner'}];
    const w = ledger({totals: [total({amount: 6})], marks});
    const cells = w.find('[data-sit-total-sources]').findAll('[data-sit-total-source]');
    expect(cells.map((c) => c.attributes('data-sit-total-source-kind'))).to.deep.eq(['colony', 'colony', 'party', 'winner']);
    expect(cells.map((c) => c.attributes('data-sit-total-source-of'))).to.deep.eq(['Luna', 'Pluto', PartyName.GREENS, undefined]);
    expect(cells[0].find('.con-sit__part-planet').classes()).to.include('Luna-background');
    expect(cells[0].find('.con-sit__mark-times').text()).to.eq('×2');
    expect(cells[1].find('.con-sit__mark-times').exists(), 'paid once — no «×k»').to.eq(false);
    expect(cells[2].find('img.con-sit__emblem').attributes('src')).to.eq(partyEmblemUrl(PartyName.GREENS));
    expect(cells[3].find('svg.con-sit__payout-crown').exists()).to.eq(true);

    // The breakdown prints its sources as lines instead: no marks, no row — and nothing but skips, no tokens zone.
    const bare = ledger({totals: [total({id: 'skipped', kind: 'skipped', unit: '', family: 'none', part: part({kind: 'skipped'})})]});
    expect(bare.find('[data-sit-total-sources]').exists()).to.eq(false);
    expect(bare.find('.con-sit__totals-tokens').exists()).to.eq(false);
    expect(bare.findAll('.con-sit__total--skipped').length).to.eq(1);
  });
});
