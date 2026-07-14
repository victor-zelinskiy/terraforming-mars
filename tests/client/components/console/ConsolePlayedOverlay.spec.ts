import {expect} from 'chai';
import {mount, VueWrapper} from '@vue/test-utils';
import ConsolePlayedOverlay from '@/client/components/console/played/ConsolePlayedOverlay.vue';
import {consolePlayedUi, resetConsolePlayedUi} from '@/client/console/consolePlayedUi';
import {EVENTS_PILE_KEY} from '@/client/components/console/consolePlayedModel';
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {GamepadIntent, SemanticButton} from '@/client/gamepad/gamepadPollModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';

function player(color: Color, name: string, tableau: Array<CardName>): PublicPlayerModel {
  return {color, name, tableau: tableau.map((n) => ({name: n}))} as unknown as PublicPlayerModel;
}

function press(button: SemanticButton): GamepadIntent {
  return {kind: 'press', button};
}

const RED_TABLEAU = [
  CardName.THARSIS_REPUBLIC, // corporation
  CardName.ALLIED_BANK, // prelude
  CardName.PREDATORS, // active
  CardName.TREES, // automated
  CardName.ASTEROID, // event
  CardName.BIG_ASTEROID, // event
];

function make(players: Array<PublicPlayerModel>): VueWrapper<InstanceType<typeof ConsolePlayedOverlay>> {
  return mount(ConsolePlayedOverlay, {
    props: {players, thisPlayerColor: 'red' as Color},
    global: {
      mocks: {$t: (s: string) => s},
      stubs: {
        ConsolePlayedCardLite: true,
        ConsoleCardFocusFrame: true,
      },
    },
  });
}

describe('ConsolePlayedOverlay', () => {
  afterEach(() => {
    resetConsolePlayedUi();
  });

  it('renders the tableau zones + the face-down events pile with its count', () => {
    const wrapper = make([player('red' as Color, 'Вы', RED_TABLEAU)]);
    expect(wrapper.find('.con-played__family--corporation').exists()).to.be.true;
    expect(wrapper.find('.con-played__family--prelude').exists()).to.be.true;
    expect(wrapper.find('.con-played__family--active').exists()).to.be.true;
    expect(wrapper.find('.con-played__family--automated').exists()).to.be.true;
    expect(wrapper.find(`[data-played-key="${CardName.THARSIS_REPUBLIC}"]`).exists()).to.be.true;
    // Events are ONE face-down pile, never individual cards on the main screen.
    expect(wrapper.findAll('[data-played-key]').length).to.eq(5); // 4 face-up + the pile
    expect(wrapper.find('.con-played__events-count').text()).to.eq('2');
    wrapper.unmount();
  });

  it('seeds focus on the first target and mirrors focusKind for the command bar', () => {
    const wrapper = make([player('red' as Color, 'Вы', RED_TABLEAU)]);
    expect(wrapper.vm.focusKey).to.eq(CardName.THARSIS_REPUBLIC);
    expect(consolePlayedUi.focusKind).to.eq('card');
    expect(consolePlayedUi.canCyclePlayer).to.be.false;
    wrapper.unmount();
  });

  it('B closes (emit) — the shell owns the actual open flag', () => {
    const wrapper = make([player('red' as Color, 'Вы', RED_TABLEAU)]);
    wrapper.vm.handleIntent(press('back'));
    expect(wrapper.emitted('close')).to.have.length(1);
    wrapper.unmount();
  });

  it('X on the events pile opens the nested list; B inside is a LOCAL back to the pile', async () => {
    const wrapper = make([player('red' as Color, 'Вы', RED_TABLEAU)]);
    wrapper.vm.focusKey = EVENTS_PILE_KEY;
    await wrapper.vm.$nextTick();
    expect(consolePlayedUi.focusKind).to.eq('events');
    wrapper.vm.handleIntent(press('secondary')); // X = open the pile
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.eventsOpen).to.be.true;
    expect(consolePlayedUi.eventsOpen).to.be.true;
    // The turned-over events render face up inside the nested panel.
    expect(wrapper.findAll('[data-events-key]').length).to.eq(2);
    expect(wrapper.vm.eventsFocusKey).to.eq(CardName.ASTEROID);
    // B closes ONLY the list; focus returns to the pile, no close emit.
    wrapper.vm.handleIntent(press('back'));
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.eventsOpen).to.be.false;
    expect(wrapper.vm.focusKey).to.eq(EVENTS_PILE_KEY);
    expect(wrapper.emitted('close')).to.be.undefined;
    wrapper.unmount();
  });

  it('LB/RB cycles the viewed player; a missing focus key reseeds on the new tableau', async () => {
    const bot = player('green' as Color, 'MarsBot', [CardName.CREDICOR, CardName.BIRDS]);
    const wrapper = make([player('red' as Color, 'Вы', RED_TABLEAU), bot]);
    expect(consolePlayedUi.canCyclePlayer).to.be.true;
    wrapper.vm.handleIntent(press('bumperR'));
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.viewedPlayer.name).to.eq('MarsBot');
    expect(wrapper.vm.focusKey).to.eq(CardName.CREDICOR);
    // The bot has no events → no pile target.
    expect(wrapper.find('.con-played__family--event').exists()).to.be.false;
    wrapper.unmount();
  });

  it('an empty tableau shows the calm void state, not a bare panel', () => {
    const wrapper = make([player('red' as Color, 'Вы', [])]);
    expect(wrapper.find('.con-played__void').exists()).to.be.true;
    expect(consolePlayedUi.focusKind).to.eq('none');
    wrapper.unmount();
  });

  it('identity-only tableau shows the quiet "no projects" note', () => {
    const wrapper = make([player('red' as Color, 'Вы', [CardName.THARSIS_REPUBLIC, CardName.ALLIED_BANK])]);
    expect(wrapper.find('.con-played__none').exists()).to.be.true;
    expect(wrapper.find('.con-played__family--event').exists()).to.be.false;
    wrapper.unmount();
  });

  it('a data update that removes the focused card reseeds focus (undo / reconnect)', async () => {
    const wrapper = make([player('red' as Color, 'Вы', RED_TABLEAU)]);
    wrapper.vm.focusKey = CardName.TREES;
    await wrapper.vm.$nextTick();
    await wrapper.setProps({players: [player('red' as Color, 'Вы', [CardName.THARSIS_REPUBLIC])]});
    expect(wrapper.vm.focusKey).to.eq(CardName.THARSIS_REPUBLIC);
    wrapper.unmount();
  });
});
