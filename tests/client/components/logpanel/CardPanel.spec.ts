import {mount, shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {defineComponent, h, PropType} from 'vue';
import {globalConfig} from '../getLocalVue';
import CardPanel from '@/client/components/logpanel/CardPanel.vue';
import {CardName} from '@/common/cards/CardName';
import {ColonyName} from '@/common/colonies/ColonyName';
import {LogMessage} from '@/common/logs/LogMessage';
import {LogMessageData} from '@/common/logs/LogMessageData';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {LogMessageType} from '@/common/logs/LogMessageType';
import {ColonyModel, simpleColonyModel} from '@/common/models/ColonyModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {GlobalEventName} from '@/common/turmoil/globalEvents/GlobalEventName';

/*
 * The panel beside the log: what a clicked message NAMES, shown whole — a card face per card token, a global event,
 * a colony. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): what it renders for its two props,
 * and its one verb — `hide`, off the close button. It exposes nothing. Its four children are stubbed under the names
 * its template uses (the imports' names): their own rendering is theirs.
 */

/** What the panel hands a card face: the name, and what the table knows about that card. */
type PanelCard = {name: CardName, isSelfReplicatingRobotsCard: boolean, resources: number | undefined};

const CardStub = defineComponent({
  name: 'Card',
  props: {card: {type: Object as PropType<PanelCard>, required: true}},
  render() {
    return h('i', {'class': 'card-stub', 'data-card': this.card.name});
  },
});

const GlobalEventStub = defineComponent({
  name: 'GlobalEvent',
  props: {
    globalEventName: {type: String as PropType<GlobalEventName>, required: true},
    type: {type: String, required: true},
  },
  render() {
    return h('i', {'class': 'event-stub', 'data-event': this.globalEventName});
  },
});

// (Named as the component it stands for names itself — `colony`; the key it is stubbed under is the import's.)
const ColonyStub = defineComponent({
  name: 'colony',
  props: {colony: {type: Object as PropType<ColonyModel>, required: true}},
  render() {
    return h('i', {'class': 'colony-stub', 'data-colony': this.colony.name});
  },
});

const ButtonStub = defineComponent({
  name: 'AppButton',
  props: {
    size: {type: String, default: 'normal'},
    type: {type: String, default: 'normal'},
    align: {type: String, default: 'center'},
    disableOnServerBusy: {type: Boolean, default: true},
  },
  emits: ['click'],
  render() {
    return h('button', {'class': 'close-stub', 'onClick': () => this.$emit('click')});
  },
});

// Ants lies in Ada's tableau with 3 resources; Mine is a card of Bo's Self-Replicating Robots, with 2.
const PLAYERS = [
  {color: 'red', name: 'Ada', tableau: [{name: CardName.ANTS, resources: 3}], selfReplicatingRobotsCards: []},
  {color: 'blue', name: 'Bo', tableau: [], selfReplicatingRobotsCards: [{name: CardName.MINE, resources: 2}]},
] as unknown as Array<PublicPlayerModel>;

function messageOf(data: Array<LogMessageData>): LogMessage {
  return new LogMessage(LogMessageType.DEFAULT, data.map((_, i) => '${' + i + '}').join(' '), data);
}

function panelOf(message: LogMessage) {
  return mount(CardPanel, {
    global: {...globalConfig.global, stubs: {Card: CardStub, GlobalEvent: GlobalEventStub, Colony: ColonyStub, AppButton: ButtonStub}},
    props: {message, players: PLAYERS},
  });
}

describe('CardPanel', () => {
  it('mounts without errors', () => {
    const wrapper = shallowMount(CardPanel, {
      ...globalConfig,
      props: {
        message: new LogMessage(LogMessageType.DEFAULT, '', []),
        players: [],
      },
    });
    expect(wrapper.exists()).to.be.true;
  });

  it('shows what the message names: a face per card (its resources and its robots flag read off the players), the global event, the colony', () => {
    const wrapper = panelOf(messageOf([
      {type: LogMessageDataType.PLAYER, value: 'red'},
      {type: LogMessageDataType.CARD, value: CardName.ANTS},
      {type: LogMessageDataType.CARDS, value: [CardName.MINE, CardName.BIRDS]},
      {type: LogMessageDataType.GLOBAL_EVENT, value: GlobalEventName.GLOBAL_DUST_STORM},
      {type: LogMessageDataType.COLONY, value: ColonyName.LUNA},
    ]));
    expect(wrapper.find('.card-panel').exists()).to.eq(true);

    // The single card token first, then every card of the list token — each in a box of its own.
    expect(wrapper.findAllComponents(CardStub).map((c) => c.props('card'))).to.deep.eq([
      {name: CardName.ANTS, isSelfReplicatingRobotsCard: false, resources: 3},
      {name: CardName.MINE, isSelfReplicatingRobotsCard: true, resources: 2},
      {name: CardName.BIRDS, isSelfReplicatingRobotsCard: false, resources: undefined},
    ]);

    const events = wrapper.findAllComponents(GlobalEventStub);
    expect(events.map((e) => [e.props('globalEventName'), e.props('type')])).to.deep.eq([[GlobalEventName.GLOBAL_DUST_STORM, 'prior']]);
    expect(wrapper.findAllComponents(ColonyStub).map((c) => c.props('colony'))).to.deep.eq([simpleColonyModel(ColonyName.LUNA)]);

    const boxes = wrapper.findAll('.card-panel > .cardbox');
    expect(boxes.map((b) => b.attributes('id'))).to.deep.eq(Array(5).fill('log_panel_card'));
    expect(boxes.map((b) => b.find('i').classes()[0])).to.deep.eq(['card-stub', 'card-stub', 'card-stub', 'event-stub', 'colony-stub']);
  });

  it('its close button — big, of the `close` kind, on the right, live while the server is busy — emits `hide`, with no payload', async () => {
    const wrapper = panelOf(messageOf([{type: LogMessageDataType.CARD, value: CardName.ANTS}]));
    const close = wrapper.findComponent(ButtonStub);
    expect([close.props('size'), close.props('type'), close.props('align'), close.props('disableOnServerBusy')])
      .to.deep.eq(['big', 'close', 'right', false]);
    expect(wrapper.emitted('hide')).to.eq(undefined);

    await wrapper.find('.close-stub').trigger('click');
    expect(wrapper.emitted('hide')).to.deep.eq([[]]);
  });

  it('a message that names no card, event or colony shows no panel at all — and the panel follows the message', async () => {
    const wrapper = panelOf(messageOf([
      {type: LogMessageDataType.PLAYER, value: 'red'},
      {type: LogMessageDataType.RAW_STRING, value: '3'},
    ]));
    expect(wrapper.find('.card-panel').exists()).to.eq(false);
    expect(wrapper.find('.close-stub').exists(), 'nothing to close').to.eq(false);

    await wrapper.setProps({message: messageOf([{type: LogMessageDataType.COLONY, value: ColonyName.LUNA}])});
    expect(wrapper.find('.card-panel').exists()).to.eq(true);
    expect(wrapper.findAll('.card-panel > .cardbox').map((b) => b.find('i').attributes('data-colony'))).to.deep.eq([ColonyName.LUNA]);
    expect(wrapper.findComponent(CardStub).exists()).to.eq(false);
  });
});
