import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import JournalGroup from '@/client/components/journal/JournalGroup.vue';
import JournalChildRow from '@/client/components/journal/JournalChildRow.vue';
import {LogMessage} from '@/common/logs/LogMessage';
import {LogMessageType} from '@/common/logs/LogMessageType';
import {LogMessageData} from '@/common/logs/LogMessageData';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {GameEvent, JournalEntryRole} from '@/common/events/GameEvent';
import {CardName} from '@/common/cards/CardName';
import {Phase} from '@/common/Phase';

function msg(text: string, role: JournalEntryRole, data: Array<LogMessageData> = []): LogMessage {
  const m = new LogMessage(LogMessageType.DEFAULT, text, data);
  m.role = role;
  return m;
}

const RED: LogMessageData = {type: LogMessageDataType.PLAYER, value: 'red'};
const BLUE: LogMessageData = {type: LogMessageDataType.PLAYER, value: 'blue'};

describe('JournalGroup', () => {
  it('renders the dominant root + its consequence rows as one cluster', () => {
    const wrapper = shallowMount(JournalGroup, {
      ...globalConfig,
      props: {
        header: msg('played card', 'root-action'),
        children: [msg('effect a', 'effect-result'), msg('detail b', 'detail')],
        category: 'standard-project',
        players: [],
      },
    });
    expect(wrapper.find('.journal-group').classes()).to.include('journal-group--standard-project');
    expect(wrapper.find('.journal-group__spine').exists()).to.be.true;
    expect(wrapper.findAll('.journal-group__child').length).to.eq(2);
    // No per-group collapse toggle anymore.
    expect(wrapper.find('.journal-group__toggle').exists()).to.be.false;
  });

  it('summary mode hides the rows and shows a consequence count', () => {
    const wrapper = shallowMount(JournalGroup, {
      ...globalConfig,
      props: {
        header: msg('played card', 'root-action'),
        children: [msg('a', 'detail'), msg('b', 'detail'), msg('c', 'detail')],
        category: 'card-play',
        players: [],
        mode: 'summary',
      },
    });
    expect(wrapper.findAll('.journal-group__child').length).to.eq(0);
    const count = wrapper.find('.journal-group__count');
    expect(count.exists()).to.be.true;
    expect(count.text()).to.contain('3');
  });

  it('drops the leading player chip on a child that repeats the root actor', () => {
    const wrapper = shallowMount(JournalGroup, {
      ...globalConfig,
      props: {
        header: msg('${0} played a card', 'root-action', [RED]),
        children: [msg('${0} gained 2 plants', 'effect-result', [RED])],
        players: [],
      },
    });
    // Same player as root → the leading PLAYER token is dropped (reads as a
    // consequence, not a standalone action).
    const tokens = (wrapper.vm as any).childTokens((wrapper.vm as any).children[0]);
    expect(tokens.some((t: string | LogMessageData) => typeof t !== 'string' && t.type === LogMessageDataType.PLAYER)).to.be.false;
  });

  it('keeps the player chip on a child from a different player', () => {
    const wrapper = shallowMount(JournalGroup, {
      ...globalConfig,
      props: {
        header: msg('${0} played a card', 'root-action', [RED]),
        children: [msg('${0} added an animal', 'effect-result', [BLUE])],
        players: [],
      },
    });
    const tokens = (wrapper.vm as any).childTokens((wrapper.vm as any).children[0]);
    expect(tokens.some((t: string | LogMessageData) => typeof t !== 'string' && t.type === LogMessageDataType.PLAYER)).to.be.true;
  });

  it('renders event-driven children (source → impact) when structured events exist', () => {
    const header = msg('played card', 'root-action');
    header.correlationId = 1;
    const events: Array<GameEvent> = [
      {id: 1, generation: 1, phase: Phase.ACTION, type: 'action', source: {kind: 'standardProject', card: CardName.CITY}, player: 'red', impact: {}, correlationId: 1, visibility: 'journal'},
      {id: 2, generation: 1, phase: Phase.ACTION, type: 'resource-changed', source: {kind: 'spaceBonus'}, player: 'red', impact: {stock: {plants: 2}}, correlationId: 1, parentId: 1, visibility: 'analytics'},
    ];
    const wrapper = shallowMount(JournalGroup, {
      ...globalConfig,
      props: {
        header,
        children: [msg('fallback log', 'detail')],
        events,
        players: [],
      },
    });
    // Event-driven path wins over the LogMessage fallback.
    expect(wrapper.findAllComponents(JournalChildRow).length).to.eq(1);
  });

  it('highlights matched children and dims the rest under an active filter', () => {
    const wrapper = shallowMount(JournalGroup, {
      ...globalConfig,
      props: {
        header: msg('played card', 'root-action'),
        children: [msg('a', 'effect-result'), msg('b', 'effect-result')],
        players: [],
        filterActive: true,
        headerMatched: false,
        childMatched: [true, false],
      },
    });
    expect(wrapper.find('.journal-group__child--matched').exists()).to.be.true;
    expect(wrapper.find('.journal-group__child--dim').exists()).to.be.true;
    expect(wrapper.find('.journal-group__root--dim').exists()).to.be.true;
  });
});
