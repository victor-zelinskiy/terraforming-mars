/*
 * JournalEntry — one row of the journal feed: a generation divider, or a time gutter and the parsed token line. A
 * `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): four props in, nothing out, nothing exposed —
 * the spec is what it renders for them.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {CardName} from '@/common/cards/CardName';
import {LogMessage} from '@/common/logs/LogMessage';
import {LogMessageData} from '@/common/logs/LogMessageData';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {LogMessageType} from '@/common/logs/LogMessageType';
import JournalEntry from '@/client/components/journal/JournalEntry.vue';

// The token renderer and the fan are their own subjects; this spec reads what the row HANDS each of them.
// (Render functions, not template strings: the runtime compiler is not in this build.)
const TokenStub = defineComponent({
  name: 'JournalTokenRenderer',
  props: ['token', 'players'],
  render: () => h('i', {class: 'token-stub'}),
});
const FanStub = defineComponent({
  name: 'JournalCardFan',
  props: ['cards', 'kind'],
  render: () => h('i', {class: 'fan-stub'}),
});

// The divider joins its word and its number with a non-breaking space (the template's `&nbsp;`).
const NBSP = String.fromCharCode(160);

const RED: LogMessageData = {type: LogMessageDataType.PLAYER, value: 'red'};
const ANTS: LogMessageData = {type: LogMessageDataType.CARD, value: CardName.ANTS};

// No i18n plugin on purpose: the component imports its own `v-i18n` — the global one is not there to lean on.
function entry(props: Record<string, unknown>) {
  return mount(JournalEntry, {
    props: {players: [], ...props},
    global: {config: globalConfig.global.config, stubs: {JournalTokenRenderer: TokenStub, JournalCardFan: FanStub}},
  });
}

describe('JournalEntry — one row of the journal feed', () => {
  it('a NEW_GENERATION message is the centred divider — the word and the number between two lines, no entry row', () => {
    const w = entry({message: new LogMessage(LogMessageType.NEW_GENERATION, 'Generation ${0}', [{type: LogMessageDataType.RAW_STRING, value: '7'}])});
    const divider = w.find('li.journal-gen-divider');
    expect(divider.exists()).to.eq(true);
    expect(divider.findAll('.journal-gen-divider__line')).to.have.length(2);
    const label = divider.find('.journal-gen-divider__label');
    expect(label.find('span').attributes('tm-has-i18n'), 'the word is translated by the row\'s own `v-i18n`').to.eq('true');
    expect(label.text()).to.eq(`${$t('Generation')}${NBSP}7`);
    expect(w.find('.journal-entry').exists()).to.eq(false);
    expect(w.findComponent(TokenStub).exists()).to.eq(false);
  });

  it('any other message is a row: its correlation id, the HH:MM stamp labelled with the full date, the parsed line token by token', async () => {
    const message = new LogMessage(LogMessageType.DEFAULT, '${0} played ${1}', [RED, ANTS]);
    message.correlationId = 42;
    message.timestamp = new Date(2026, 0, 2, 3, 4).getTime();
    const w = entry({message});
    expect(w.find('.journal-gen-divider').exists()).to.eq(false);
    const row = w.find('li.journal-entry');
    expect(row.classes()).to.deep.eq(['journal-entry']);
    expect(row.attributes('data-correlation-id')).to.eq('42');
    expect(row.find('.journal-entry__rail').attributes('aria-hidden')).to.eq('true');

    const time = row.find('.journal-entry__time');
    expect(time.text()).to.eq('03:04');
    expect(time.attributes('aria-label')).to.eq(new Date(message.timestamp).toLocaleString());

    const tokens = w.findAllComponents(TokenStub);
    expect(tokens.map((token) => token.props('token'))).to.deep.eq([RED, ' played ', ANTS]);
    expect(tokens.map((token) => token.props('players')), 'every token gets the row\'s players').to.deep.eq([[], [], []]);
    expect(w.findAll('.journal-entry__body > .token-stub')).to.have.length(3);

    await w.setProps({timeShown: false});
    expect(w.find('.journal-entry__time').exists(), 'the feed shows the stamp only where it changes').to.eq(false);
  });

  it('the row says how it arrived: fresh when it animates in, private when it is one player\'s own, an announcement by its type', () => {
    const fresh = entry({message: new LogMessage(LogMessageType.DEFAULT, 'a', []), animateIn: true});
    expect(fresh.find('li.journal-entry').classes()).to.deep.eq(['journal-entry', 'journal-entry--fresh']);

    const own = entry({message: new LogMessage(LogMessageType.DEFAULT, 'a', [], 'p-own')});
    expect(own.find('li.journal-entry').classes()).to.deep.eq(['journal-entry', 'journal-entry--private']);

    const said = entry({message: new LogMessage(LogMessageType.ANNOUNCEMENT, 'a', [])});
    expect(said.find('li.journal-entry').classes()).to.deep.eq(['journal-entry', 'journal-entry--announcement']);
  });

  it('several cards drawn at once read as a FAN of their faces, in the line\'s order; one card, or an ellipsis, stays a token', () => {
    const two: LogMessageData = {type: LogMessageDataType.CARDS, value: [CardName.ANTS, CardName.BIRDS]};
    const one: LogMessageData = {type: LogMessageDataType.CARDS, value: [CardName.COMET]};
    const hidden: LogMessageData = {type: LogMessageDataType.CARDS, value: [CardName.ANTS, CardName.BIRDS], attrs: {ellipsis: true}};
    const w = entry({message: new LogMessage(LogMessageType.DEFAULT, '${0} drew ${1}, ${2} and ${3}', [RED, two, one, hidden])});

    expect(w.findAllComponents(FanStub).map((fan) => fan.props())).to.deep.eq([{cards: [CardName.ANTS, CardName.BIRDS], kind: 'kept'}]);
    expect(w.findAllComponents(TokenStub).map((token) => token.props('token'))).to.deep.eq([RED, ' drew ', ', ', one, ' and ', hidden]);
    expect(w.findAll('.journal-entry__body > *').map((part) => part.classes())).to.deep.eq([
      ['token-stub'], ['token-stub'], ['fan-stub'], ['token-stub'], ['token-stub'], ['token-stub'], ['token-stub'],
    ]);
  });
});
