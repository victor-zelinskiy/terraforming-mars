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

  it('a NON-discount row (payment) shows NO discount badge', () => {
    const wrapper = mountRow({
      source: {kind: 'label', label: 'Payment'},
      bucket: 'payment',
      chips: [{icon: 'megacredits', text: '−1'}],
    });
    expect(wrapper.find('.journal-child-row__discount-badge').exists()).is.false;
  });
});
