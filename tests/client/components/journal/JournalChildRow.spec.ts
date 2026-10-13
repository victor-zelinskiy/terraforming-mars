import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import JournalChildRow from '@/client/components/journal/JournalChildRow.vue';
import {JournalChildVM} from '@/client/components/journal/journalEventChild';
import {CardName} from '@/common/cards/CardName';
import {PartyName} from '@/common/turmoil/PartyName';
import {Tag} from '@/common/cards/Tag';

function mountRow(vm: JournalChildVM) {
  return mount(JournalChildRow, {
    ...globalConfig,
    props: {vm, players: []},
  });
}

describe('JournalChildRow', () => {
  it('a DISCOUNT row shows an explicit "Discount" badge (a "−N M€" chip alone reads as a charge)', () => {
    const wrapper = mountRow({
      source: {kind: 'card', card: CardName.SOLAR_LOGISTICS},
      bucket: 'discount',
      chips: [{icon: 'megacredits', text: '−2', saved: true}],
    });
    const badge = wrapper.find('.journal-child-row__discount-badge');
    expect(badge.exists()).is.true;
    // The saved chip keeps its distinct gold tone too.
    expect(wrapper.find('.journal-child-row__chip--saved').exists()).is.true;
  });

  it('a SKIPPED row names the effect, strikes its magnitude and states the cause — «Пропущено», never a gain chip', () => {
    const wrapper = mountRow({
      source: {kind: 'card', card: CardName.SUPREME_EXPERTISE},
      bucket: 'skipped',
      chips: [],
      skipped: {label: 'Add resources to a card', reason: 'No eligible card', chip: {icon: 'data', text: '+4'}},
    });
    expect(wrapper.find('.journal-child-row__skipped-badge').exists()).is.true;
    expect(wrapper.find('.journal-child-row__skipped-label').text()).eq('Add resources to a card');
    expect(wrapper.find('.journal-child-row__skipped-reason').text()).eq('No eligible card');
    const struck = wrapper.find('.journal-child-row__chip--skipped');
    expect(struck.exists()).is.true;
    expect(struck.text()).eq('+4');
    expect(wrapper.find('.journal-child-row__chip--pos').exists(), 'never tinted as a gain').is.false;
    expect(wrapper.find('.journal-child-row__discount-badge').exists()).is.false;
  });

  it('a skipped effect with no single magnitude draws no chip, only its name and cause', () => {
    const wrapper = mountRow({
      source: {kind: 'card', card: CardName.HIRED_RAIDERS},
      bucket: 'skipped',
      chips: [],
      skipped: {label: 'Steal resources from another player', reason: 'No valid target available'},
    });
    expect(wrapper.find('.journal-child-row__chip--skipped').exists()).is.false;
    expect(wrapper.find('.journal-child-row__skipped-label').text()).eq('Steal resources from another player');
  });

  it('a delegate placed by an EFFECT names the resolution it stands on (Turmoil Redux — «[делегат] +1 · <резолюция>»)', () => {
    const wrapper = mountRow({
      source: {kind: 'card', card: CardName.POLITICAL_DONATION},
      bucket: 'card',
      chips: [{icon: 'delegate', text: '+1'}],
      political: {kind: 'resolution', resolution: 'RDX_GREENS_1'},
    });
    expect(wrapper.find('.journal-child-row__chip-icon').classes()).includes('resource_icon--delegate');
    expect(wrapper.find('.journal-child-row__chip--pos').text()).eq('+1');
    const address = wrapper.find('.journal-token--resolution');
    expect(address.exists(), 'the chip has an address').is.true;
    expect(address.text()).not.eq('');
  });

  it('neutral delegates added to Popular Support name the party and what its area holds', () => {
    const wrapper = mountRow({
      source: {kind: 'card', card: CardName.POLITICAL_DONATION},
      bucket: 'card',
      chips: [{icon: 'neutral-delegate', text: '+3'}],
      political: {kind: 'support', party: PartyName.GREENS, total: 3},
    });
    expect(wrapper.find('.journal-child-row__chip-icon').classes()).includes('resource_icon--neutral-delegate');
    const address = wrapper.find('.journal-child-row__tile');
    expect(address.text()).contains('Popular support');
    expect(address.text()).contains('3/3');
    expect(wrapper.find('.journal-token--resolution').exists()).is.false;
  });

  describe('a CONDITIONAL DRAW SEARCH row (PL-033)', () => {
    const search = (over: Partial<NonNullable<JournalChildVM['search']>> = {}): JournalChildVM => ({
      source: {kind: 'card', card: CardName.AQUEDUCT_SYSTEMS},
      bucket: 'search',
      chips: [],
      search: {
        rule: {count: 3, tag: Tag.BUILDING},
        revealed: 6,
        kept: 3,
        discarded: [CardName.ANTS, CardName.BIRDS, CardName.COMET],
        exhausted: false,
        ...over,
      },
    });

    it('names the counts through the reading renderer (no raw template), the thrown-away cards as card chips in order, then the rule', () => {
      const wrapper = mountRow(search());
      const row = wrapper.find('[data-journal-search]');
      expect(row.exists()).is.true;
      expect(row.attributes('data-search-revealed')).eq('6');
      expect(row.attributes('data-search-kept')).eq('3');
      expect(row.attributes('data-search-discarded')).eq('3');
      expect(row.attributes('data-search-exhausted')).eq('no');
      expect(wrapper.find('[data-journal-search-tally]').text()).eq('Turned over 6 · received 3 · thrown away 3');
      const discards = wrapper.findAll('[data-journal-search-discard]');
      expect(discards.map((d) => d.find('.journal-chip__label').text())).deep.eq([CardName.ANTS, CardName.BIRDS, CardName.COMET]);
      // The rule is the ONE renderer of the server's descriptor — the same one the reveal and the composer's chip mount.
      expect(wrapper.find('[data-journal-search-rule] [data-draw-search]').attributes('data-draw-search')).eq('with:building');
      expect(wrapper.find('[data-journal-search-end]').exists(), 'the deck did not run out').is.false;
      expect(wrapper.text()).not.contains('${');
      // Nothing summed: no impact chip, no arrow.
      expect(wrapper.find('.journal-child-row__chip').exists()).is.false;
      expect(wrapper.find('.journal-child-row__arrow').exists()).is.false;
    });

    it('a search that threw nothing away still says how many it turned over — «Turned over 2 · received 2», the rule, no chips', () => {
      const wrapper = mountRow(search({revealed: 2, kept: 2, discarded: []}));
      expect(wrapper.find('[data-journal-search-tally]').text()).eq('Turned over 2 · received 2');
      expect(wrapper.findAll('[data-journal-search-discard]')).has.length(0);
      expect(wrapper.find('[data-draw-search]').exists()).is.true;
    });

    it('the deck ran out: the row names it', () => {
      const wrapper = mountRow(search({revealed: 4, kept: 1, discarded: [CardName.ANTS, CardName.BIRDS, CardName.COMET], exhausted: true}));
      expect(wrapper.find('[data-journal-search]').attributes('data-search-exhausted')).eq('yes');
      expect(wrapper.find('[data-journal-search-end]').text()).contains('the whole deck was turned over');
    });

    it('an opaque `include` search has no rule to draw — counts and names only', () => {
      const wrapper = mountRow(search({rule: undefined, revealed: 2, kept: 1, discarded: [CardName.ANTS]}));
      expect(wrapper.find('[data-journal-search-rule]').exists()).is.false;
      expect(wrapper.find('[data-journal-search-tally]').text()).eq('Turned over 2 · received 1 · thrown away 1');
    });
  });

  it('a NON-discount row (payment) shows NO discount badge', () => {
    const wrapper = mountRow({
      source: {kind: 'label', label: 'Payment'},
      bucket: 'payment',
      chips: [{icon: 'megacredits', text: '−1'}],
    });
    expect(wrapper.find('.journal-child-row__discount-badge').exists()).is.false;
  });
});
