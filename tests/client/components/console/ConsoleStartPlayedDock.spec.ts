import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import ConsoleStartPlayedDock from '@/client/components/console/ConsoleStartPlayedDock.vue';
import {armPlayedHero, abortPlayedHero, playedHeroState} from '@/client/console/played/consolePlayedHero';
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {PlayerViewModel} from '@/common/models/PlayerModel';

function view(tableau: Array<CardName>): PlayerViewModel {
  const me = {color: 'red' as Color, name: 'Вы', tableau: tableau.map((n) => ({name: n}))};
  return {
    thisPlayer: me,
    players: [me],
    game: {automa: undefined},
  } as unknown as PlayerViewModel;
}

function settle(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function make(v: PlayerViewModel) {
  return mount(ConsoleStartPlayedDock, {
    props: {playerView: v},
    global: {
      mocks: {$t: (s: string) => s},
      stubs: {ConsolePlayedCardLite: true},
    },
  });
}

describe('ConsoleStartPlayedDock (the compact «РАЗЫГРАНО · owner» destination)', () => {
  afterEach(async () => {
    abortPlayedHero();
    await settle(5);
  });

  it('is the COMPACT destination dock — owner line + both start families standing, never the tableau overview', () => {
    const wrapper = make(view([]));
    // Never the full «Разыграно» overview (its layout answers a different question).
    expect(wrapper.find('.con-played').exists()).to.be.false;
    // The owner line: «РАЗЫГРАНО · <owner>».
    expect(wrapper.find('.con-splayed__title').text()).to.eq('Played');
    expect(wrapper.find('.con-splayed__owner-name').text()).to.eq('Вы');
    // Both start families stand from the first frame — a destination exists
    // before anything flies; an empty one shows the calm waiting plate.
    expect(wrapper.find('[data-splayed-fam="corporation"]').exists()).to.be.true;
    expect(wrapper.find('[data-splayed-fam="prelude"]').exists()).to.be.true;
    expect(wrapper.findAll('.con-splayed__plate').length).to.eq(2);
    // Idle: no reserved front anchor (nothing is inbound).
    expect(wrapper.find('[data-start-front]').exists()).to.be.false;
    // The root keeps the legacy physical address of the transfer chains.
    expect(wrapper.classes()).to.contain('con-start__played');
    wrapper.unmount();
  });

  it('RECEIVING an empty family (the corporation play): the front anchor reserves real room, fills at the reveal, the count ticks 0 → 1', async () => {
    armPlayedHero(CardName.THARSIS_REPUBLIC, false, {manualTableOpen: false, host: 'workspace'});
    playedHeroState.phase = 'preparing';
    const wrapper = make(view([]));
    await wrapper.vm.$nextTick();
    const fam = wrapper.find('[data-splayed-fam="corporation"]');
    expect(fam.classes()).to.contain('con-splayed__fam--receiving');
    // Pre-dock: the anchor is EMPTY room — no face, no played-key, no count.
    const front = fam.find('[data-start-front]');
    expect(front.exists()).to.be.true;
    expect(front.attributes('data-played-key')).to.be.undefined;
    expect(front.find('.con-splayed__face').exists()).to.be.false;
    expect(fam.find('.con-splayed__cap-count').exists()).to.be.false;
    // THE DOCK: the landed card occupies the front and STAYS; the count ticks.
    playedHeroState.revealed = true;
    await wrapper.vm.$nextTick();
    expect(front.attributes('data-played-key')).to.eq(CardName.THARSIS_REPUBLIC);
    expect(front.find('.con-splayed__face').exists()).to.be.true;
    expect(fam.find('.con-splayed__cap-count').text()).to.eq('1');
    wrapper.unmount();
  });

  it('RECEIVING onto a standing stack (a prelude): geometric Top Card Handoff — the previous top holds its open face on its future strip, crops at the reveal; the other family recedes aside', async () => {
    armPlayedHero(CardName.BIOLAB, false, {manualTableOpen: false, host: 'workspace'});
    playedHeroState.phase = 'preparing';
    const wrapper = make(view([CardName.THARSIS_REPUBLIC, CardName.ECOLOGY_EXPERTS]));
    await wrapper.vm.$nextTick();
    const fam = wrapper.find('[data-splayed-fam="prelude"]');
    expect(fam.classes()).to.contain('con-splayed__fam--receiving');
    // The lying top waits on its FUTURE strip slot, face still open (peek=false).
    const prev = fam.find('.con-splayed__strip--prev');
    expect(prev.attributes('data-played-key')).to.eq(CardName.ECOLOGY_EXPERTS);
    expect(prev.findComponent({name: 'ConsolePlayedCardLite'}).props('peek')).to.be.false;
    // The corporation family is context now — receded, never unmounted.
    expect(wrapper.find('[data-splayed-fam="corporation"]').classes()).to.contain('con-splayed__fam--aside');
    // The reveal: the new card covers the previous top back to a strip.
    playedHeroState.revealed = true;
    await wrapper.vm.$nextTick();
    expect(prev.findComponent({name: 'ConsolePlayedCardLite'}).props('peek')).to.be.true;
    expect(fam.find('[data-start-front]').attributes('data-played-key')).to.eq(CardName.BIOLAB);
    expect(fam.find('.con-splayed__cap-count').text()).to.eq('2');
    wrapper.unmount();
  });

  it('the docked card is addressable as `.con-start__played [data-played-key]` — the reward-source / transfer-target chain resolves on the dock', async () => {
    armPlayedHero(CardName.THARSIS_REPUBLIC, false, {manualTableOpen: false, host: 'workspace'});
    playedHeroState.phase = 'preparing';
    playedHeroState.revealed = true;
    const wrapper = make(view([]));
    await wrapper.vm.$nextTick();
    const hit = wrapper.element.matches('.con-start__played') &&
      wrapper.element.querySelector(`[data-played-key="${CardName.THARSIS_REPUBLIC}"]`) !== null;
    expect(hit).to.be.true;
    wrapper.unmount();
  });

  it('AFTER the transaction: the landed card stays physically in the stack as its open top — the dock is compact again', async () => {
    // No live hero (the transaction closed); the tableau now carries the corp.
    const wrapper = make(view([CardName.THARSIS_REPUBLIC]));
    const fam = wrapper.find('[data-splayed-fam="corporation"]');
    expect(fam.classes()).to.not.contain('con-splayed__fam--receiving');
    expect(fam.find('[data-start-front]').exists()).to.be.false;
    const top = fam.find('.con-splayed__strip--top');
    expect(top.attributes('data-played-key')).to.eq(CardName.THARSIS_REPUBLIC);
    // Open face (peek=false): the corporation stays readable in the tableau.
    expect(top.findComponent({name: 'ConsolePlayedCardLite'}).props('peek')).to.be.false;
    expect(fam.find('.con-splayed__cap-count').text()).to.eq('1');
    wrapper.unmount();
  });
});
