import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import JournalGroup from '@/client/components/journal/JournalGroup.vue';
import {LogMessage} from '@/common/logs/LogMessage';
import {LogMessageType} from '@/common/logs/LogMessageType';
import {JournalEntryRole} from '@/common/events/GameEvent';

function msg(text: string, role: JournalEntryRole): LogMessage {
  const m = new LogMessage(LogMessageType.DEFAULT, text, []);
  m.role = role;
  return m;
}

describe('JournalGroup', () => {
  it('renders the root header and its children', () => {
    const wrapper = shallowMount(JournalGroup, {
      ...globalConfig,
      props: {
        header: msg('played card', 'root-action'),
        children: [msg('effect a', 'effect-result'), msg('detail b', 'detail')],
        category: 'card-play',
        players: [],
      },
    });
    expect(wrapper.find('.journal-group').classes()).to.include('journal-group--card-play');
    expect(wrapper.find('.journal-group__root').exists()).to.be.true;
    expect(wrapper.findAll('.journal-group__child').length).to.eq(2);
    // Short chain → no collapse toggle.
    expect(wrapper.find('.journal-group__toggle').exists()).to.be.false;
  });

  it('collapses a long chain and expands on toggle', async () => {
    const children = [0, 1, 2, 3, 4].map((i) => msg(`effect ${i}`, 'effect-result'));
    const wrapper = shallowMount(JournalGroup, {
      ...globalConfig,
      props: {
        header: msg('played card', 'root-action'),
        children,
        category: 'card-play',
        players: [],
      },
    });
    // 5 children, threshold 3 → 3 shown + a toggle.
    expect(wrapper.findAll('.journal-group__child').length).to.eq(3);
    const toggle = wrapper.find('.journal-group__toggle');
    expect(toggle.exists()).to.be.true;

    await toggle.trigger('click');
    expect(wrapper.findAll('.journal-group__child').length).to.eq(5);
  });

  it('shows every child (no collapse) while a filter is active', () => {
    const children = [0, 1, 2, 3, 4].map((i) => msg(`effect ${i}`, 'effect-result'));
    const wrapper = shallowMount(JournalGroup, {
      ...globalConfig,
      props: {
        header: msg('played card', 'root-action'),
        children,
        category: 'card-play',
        players: [],
        filterActive: true,
        headerMatched: false,
        childMatched: [true, false, false, false, false],
      },
    });
    // Filtering expands the chain so the matched child stays visible.
    expect(wrapper.findAll('.journal-group__child').length).to.eq(5);
    expect(wrapper.find('.journal-group__child--matched').exists()).to.be.true;
    expect(wrapper.find('.journal-group__root--dim').exists()).to.be.true;
  });
});
