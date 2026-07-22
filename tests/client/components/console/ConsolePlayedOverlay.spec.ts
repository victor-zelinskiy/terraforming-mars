import {expect} from 'chai';
import {mount, VueWrapper} from '@vue/test-utils';
import ConsolePlayedOverlay from '@/client/components/console/played/ConsolePlayedOverlay.vue';
import {consolePlayedUi, resetConsolePlayedUi} from '@/client/console/consolePlayedUi';
import {playedCategoryState, resetPlayedCategoryView} from '@/client/console/played/playedCategoryView';
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
        ConsolePlayedCategoryView: true,
      },
    },
  });
}

describe('ConsolePlayedOverlay (category navigation)', () => {
  afterEach(() => {
    resetConsolePlayedUi();
    resetPlayedCategoryView();
  });

  it('renders the tableau zones + the face-down events pile with its count', () => {
    const wrapper = make([player('red' as Color, 'Вы', RED_TABLEAU)]);
    expect(wrapper.find('.con-played__family--corporation').exists()).to.be.true;
    expect(wrapper.find('.con-played__family--prelude').exists()).to.be.true;
    expect(wrapper.find('.con-played__family--active').exists()).to.be.true;
    expect(wrapper.find('.con-played__family--automated').exists()).to.be.true;
    expect(wrapper.find(`[data-played-key="${CardName.THARSIS_REPUBLIC}"]`).exists()).to.be.true;
    // Events are ONE face-down pile, never individual cards on the main screen.
    expect(wrapper.find('.con-played__events-count').text()).to.eq('2');
    wrapper.unmount();
  });

  it('the focusable objects are CATEGORY blocks only — no per-card cursor exists', () => {
    const wrapper = make([player('red' as Color, 'Вы', RED_TABLEAU)]);
    expect(wrapper.vm.focusCategory).to.eq('corporation');
    expect(consolePlayedUi.focusCategory).to.eq('corporation');
    // The retired per-card focus API is gone from the component surface.
    expect((wrapper.vm as unknown as {focusKey?: unknown}).focusKey).to.be.undefined;
    expect(wrapper.findAll('[data-played-cat]').length).to.eq(5);
    // No slot ever renders the per-card focused state on the table.
    expect(wrapper.find('.con-played__slot--focused').exists()).to.be.false;
    wrapper.unmount();
  });

  it('B closes (emit) — the shell owns the actual open flag', () => {
    const wrapper = make([player('red' as Color, 'Вы', RED_TABLEAU)]);
    wrapper.vm.handleIntent(press('back'));
    expect(wrapper.emitted('close')).to.have.length(1);
    wrapper.unmount();
  });

  it('A on a focused category ARMS the physical episode (opening state + names)', async () => {
    const wrapper = make([player('red' as Color, 'Вы', RED_TABLEAU)]);
    wrapper.vm.focusCategory = 'events';
    await wrapper.vm.$nextTick();
    wrapper.vm.handleIntent(press('confirm'));
    await wrapper.vm.$nextTick();
    expect(playedCategoryState.phase).to.eq('opening');
    expect(playedCategoryState.category).to.eq('events');
    expect(playedCategoryState.names).to.deep.eq([CardName.ASTEROID, CardName.BIG_ASTEROID]);
    // ANTI-BLINK: the table cards are NOT held yet — the hold flips only in
    // the same turn the director paints the proxies over them.
    expect(playedCategoryState.holdCards).to.be.false;
    expect(wrapper.find('.con-played__slot--events-out').exists()).to.be.false;
    // The category view is mounted for the episode.
    expect(wrapper.findComponent({name: 'ConsolePlayedCategoryView'}).exists()).to.be.true;
    // The proxy-paint turn (simulated — the view is stubbed here): the
    // events stack renders as the held ghost (the cards are away).
    playedCategoryState.holdCards = true;
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.con-played__slot--events-out').exists()).to.be.true;
    expect(wrapper.find('.con-played__family--out').exists()).to.be.true;
    wrapper.unmount();
  });

  it('face-up categories hold their slots while lifted (one physical copy)', async () => {
    const wrapper = make([player('red' as Color, 'Вы', RED_TABLEAU)]);
    wrapper.vm.openCategory('active');
    playedCategoryState.holdCards = true; // the proxy-paint turn (view stubbed)
    await wrapper.vm.$nextTick();
    const slot = wrapper.find(`[data-played-key="${CardName.PREDATORS}"]`);
    expect(slot.classes()).to.include('con-played__slot--held-out');
    // The settled OPEN phase keeps the table held even after the handoff
    // releases the modal grid (holdCards false — the cards live in the view).
    playedCategoryState.holdCards = false;
    playedCategoryState.phase = 'open';
    await wrapper.vm.$nextTick();
    expect(wrapper.find(`[data-played-key="${CardName.PREDATORS}"]`).classes()).to.include('con-played__slot--held-out');
    wrapper.unmount();
  });

  it('LB/RB cycles the viewed player; focus reseeds and any open category folds', async () => {
    const bot = player('green' as Color, 'MarsBot', [CardName.CREDICOR, CardName.BIRDS]);
    const wrapper = make([player('red' as Color, 'Вы', RED_TABLEAU), bot]);
    expect(consolePlayedUi.canCyclePlayer).to.be.true;
    wrapper.vm.openCategory('active');
    await wrapper.vm.$nextTick();
    wrapper.vm.handleIntent(press('bumperR'));
    await wrapper.vm.$nextTick();
    // The category view delegates input while up — the cycle only runs from
    // the table, so re-issue after the fold.
    if (wrapper.vm.viewedPlayer.name !== 'MarsBot') {
      wrapper.vm.cycleViewedPlayer(1);
      await wrapper.vm.$nextTick();
    }
    expect(wrapper.vm.viewedPlayer.name).to.eq('MarsBot');
    expect(playedCategoryState.phase).to.eq('closed');
    expect(wrapper.vm.focusCategory).to.eq('corporation');
    wrapper.unmount();
  });

  it('an empty tableau shows the calm void state, not a bare panel', () => {
    const wrapper = make([player('red' as Color, 'Вы', [])]);
    expect(wrapper.find('.con-played__void').exists()).to.be.true;
    expect(consolePlayedUi.focusCategory).to.eq('');
    wrapper.unmount();
  });

  it('identity-only tableau shows the quiet "no projects" note', () => {
    const wrapper = make([player('red' as Color, 'Вы', [CardName.THARSIS_REPUBLIC, CardName.ALLIED_BANK])]);
    expect(wrapper.find('.con-played__none').exists()).to.be.true;
    expect(wrapper.find('.con-played__family--event').exists()).to.be.false;
    wrapper.unmount();
  });

  it('a data update that removes the focused category reseeds focus (undo / reconnect)', async () => {
    const wrapper = make([player('red' as Color, 'Вы', RED_TABLEAU)]);
    wrapper.vm.focusCategory = 'automated';
    await wrapper.vm.$nextTick();
    await wrapper.setProps({players: [player('red' as Color, 'Вы', [CardName.THARSIS_REPUBLIC])]});
    expect(wrapper.vm.focusCategory).to.eq('corporation');
    wrapper.unmount();
  });

  it('the open category emptying out entirely folds the view (undo safety)', async () => {
    const wrapper = make([player('red' as Color, 'Вы', RED_TABLEAU)]);
    wrapper.vm.openCategory('events');
    await wrapper.vm.$nextTick();
    await wrapper.setProps({players: [player('red' as Color, 'Вы', [CardName.THARSIS_REPUBLIC])]});
    expect(playedCategoryState.phase).to.eq('closed');
    wrapper.unmount();
  });

  // ── the hero scene (play-animation mode) ──────────────────────────────
  describe('hero mode (the played-card landing scene)', () => {
    it('reserves a HIDDEN slot for a face-up incoming card; reveal turns it real + focuses its family', async () => {
      const wrapper = make([player('red' as Color, 'Вы', [CardName.THARSIS_REPUBLIC, CardName.PREDATORS])]);
      await wrapper.setProps({heroIncoming: {name: CardName.TREES}, heroActive: true});
      // The +1 layout is already FINAL: the synthetic slot exists, hidden.
      const slot = wrapper.find(`[data-played-key="${CardName.TREES}"]`);
      expect(slot.exists()).to.be.true;
      expect(slot.classes()).to.include('con-played__slot--incoming');
      // The header count stays honest until the landing commit.
      expect(wrapper.find('.con-played__total b').text()).to.eq('2');
      await wrapper.setProps({heroRevealed: true});
      expect(wrapper.find(`[data-played-key="${CardName.TREES}"]`).classes()).to.not.include('con-played__slot--incoming');
      expect(wrapper.find('.con-played__total b').text()).to.eq('3');
      expect(wrapper.vm.focusCategory).to.eq('automated');
      wrapper.unmount();
    });

    it('an incoming EVENT reserves the pile: counter ticks only after the reveal', async () => {
      const wrapper = make([player('red' as Color, 'Вы', [CardName.THARSIS_REPUBLIC])]);
      await wrapper.setProps({heroIncoming: {name: CardName.ASTEROID}, heroActive: true});
      // First-ever event: the pile is real geometry, but reserved-hidden.
      expect(wrapper.find('.con-played__family--event').exists()).to.be.true;
      expect(wrapper.find('.con-played__pile--reserved').exists()).to.be.true;
      expect(wrapper.find('.con-played__events-count').text()).to.eq('0');
      await wrapper.setProps({heroRevealed: true});
      expect(wrapper.find('.con-played__pile--reserved').exists()).to.be.false;
      expect(wrapper.find('.con-played__events-count').text()).to.eq('1');
      expect(wrapper.vm.focusCategory).to.eq('events');
      wrapper.unmount();
    });

    it('the synthetic +1 never duplicates once the commit carries the card', async () => {
      const wrapper = make([player('red' as Color, 'Вы', [CardName.THARSIS_REPUBLIC])]);
      await wrapper.setProps({heroIncoming: {name: CardName.TREES}, heroActive: true, heroRevealed: true});
      await wrapper.setProps({players: [player('red' as Color, 'Вы', [CardName.THARSIS_REPUBLIC, CardName.TREES])]});
      expect(wrapper.findAll(`[data-played-key="${CardName.TREES}"]`).length).to.eq(1);
      wrapper.unmount();
    });

    it('the hero scene forces the viewer seat, folds a category and inerts clicks', async () => {
      const bot = player('green' as Color, 'MarsBot', [CardName.CREDICOR]);
      const wrapper = make([player('red' as Color, 'Вы', [CardName.THARSIS_REPUBLIC, CardName.PREDATORS]), bot]);
      wrapper.vm.cycleViewedPlayer(1);
      await wrapper.vm.$nextTick();
      expect(wrapper.vm.viewedPlayer.name).to.eq('MarsBot');
      await wrapper.setProps({heroIncoming: {name: CardName.TREES}, heroActive: true});
      expect(wrapper.vm.viewedPlayer.name).to.eq('Вы');
      expect(playedCategoryState.phase).to.eq('closed');
      // A mouse click mid-scene neither refocuses nor opens a category.
      wrapper.vm.onFamilyPress('active');
      expect(playedCategoryState.phase).to.eq('closed');
      wrapper.unmount();
    });
  });
});
