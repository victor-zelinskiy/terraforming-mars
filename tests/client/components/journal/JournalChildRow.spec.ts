import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import JournalChildRow from '@/client/components/journal/JournalChildRow.vue';
import {JournalChildVM} from '@/client/components/journal/journalEventChild';
import {CardName} from '@/common/cards/CardName';

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

  it('a NON-discount row (payment) shows NO discount badge', () => {
    const wrapper = mountRow({
      source: {kind: 'label', label: 'Payment'},
      bucket: 'payment',
      chips: [{icon: 'megacredits', text: '−1'}],
    });
    expect(wrapper.find('.journal-child-row__discount-badge').exists()).is.false;
  });
});
