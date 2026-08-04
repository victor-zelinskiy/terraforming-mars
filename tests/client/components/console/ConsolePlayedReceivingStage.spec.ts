import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import ConsolePlayedReceivingStage from '@/client/components/console/played/ConsolePlayedReceivingStage.vue';
import {armPlayedHero, abortPlayedHero, playedHeroState} from '@/client/console/played/consolePlayedHero';
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {PlayerViewModel} from '@/common/models/PlayerModel';

function view(tableau: Array<CardName>, others: Array<{color: Color, name: string, tableau: Array<CardName>}> = []): PlayerViewModel {
  const me = {color: 'red' as Color, name: 'Вы', tableau: tableau.map((n) => ({name: n}))};
  return {
    thisPlayer: me,
    players: [me, ...others.map((o) => ({...o, tableau: o.tableau.map((n) => ({name: n}))}))],
    game: {automa: undefined},
  } as unknown as PlayerViewModel;
}

function settle(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function make(v: PlayerViewModel) {
  return mount(ConsolePlayedReceivingStage, {
    props: {playerView: v},
    global: {
      mocks: {$t: (s: string) => s},
      stubs: {ConsolePlayedCardLite: true},
    },
  });
}

describe('ConsolePlayedReceivingStage (the receiving & effect resolution stage)', () => {
  afterEach(async () => {
    abortPlayedHero();
    await settle(5);
  });

  it('is a SPECIALIZED scene — never the embedded overview layout', async () => {
    armPlayedHero(CardName.TREES, false, {manualTableOpen: false, host: 'workspace'});
    playedHeroState.phase = 'preparing';
    const wrapper = make(view([CardName.THARSIS_REPUBLIC, CardName.PREDATORS, CardName.BUSHES]));
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.con-played').exists()).to.be.false;
    expect(wrapper.find('.con-played--embedded').exists()).to.be.false;
    // The destination (automated: BUSHES lies there) is the centre stack…
    expect(wrapper.find('.con-recv__dest').exists()).to.be.true;
    expect(wrapper.find('.con-recv__stack').exists()).to.be.true;
    // …and the other families are compact minis, never full columns.
    const minis = wrapper.findAll('.con-recv__mini');
    expect(minis.length).to.eq(2); // corporation + active
    expect(wrapper.find('.con-recv__mini .con-recv__mini-stack').exists()).to.be.true;
    wrapper.unmount();
  });

  it('lays out the FINAL silhouette from the first frame: front anchor reserved, previous top open', async () => {
    armPlayedHero(CardName.TREES, false, {manualTableOpen: false, host: 'workspace'});
    playedHeroState.phase = 'preparing';
    const wrapper = make(view([CardName.BUSHES, CardName.GRASS]));
    await wrapper.vm.$nextTick();
    const front = wrapper.find('[data-recv-front]');
    expect(front.exists()).to.be.true;
    // Pre-dock: the anchor is EMPTY room (no card, no data-played-key yet).
    expect(front.attributes('data-played-key')).to.be.undefined;
    expect(front.find('.con-recv__face').exists()).to.be.false;
    // The previous top lies OPEN (full face) on its future strip.
    const prev = wrapper.find('.con-recv__strip--prev');
    expect(prev.attributes('data-recv-strip')).to.eq(CardName.GRASS);
    expect(prev.findComponent({name: 'ConsolePlayedCardLite'}).props('peek')).to.be.false;
    wrapper.unmount();
  });

  it('TOP CARD HANDOFF at the reveal: the new card takes the front, the previous top becomes a strip, the count ticks', async () => {
    armPlayedHero(CardName.TREES, false, {manualTableOpen: false, host: 'workspace'});
    playedHeroState.phase = 'preparing';
    const wrapper = make(view([CardName.BUSHES, CardName.GRASS, CardName.TREES]));
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.con-recv__caption-count').text()).to.eq('2'); // pre-dock truth
    playedHeroState.revealed = true;
    await wrapper.vm.$nextTick();
    const front = wrapper.find('[data-recv-front]');
    expect(front.attributes('data-played-key')).to.eq(CardName.TREES);
    expect(front.find('.con-recv__face').exists()).to.be.true;
    // The previous top is now a covered strip (peek face) — it never moved.
    expect(wrapper.find('.con-recv__strip--prev').findComponent({name: 'ConsolePlayedCardLite'}).props('peek')).to.be.true;
    expect(wrapper.find('.con-recv__caption-count').text()).to.eq('3');
    wrapper.unmount();
  });

  it('an EVENT destination is the face-down pile; the landed card is a back, keyed for the reward source', async () => {
    armPlayedHero(CardName.ASTEROID, true, {manualTableOpen: false, host: 'workspace'});
    playedHeroState.phase = 'preparing';
    const wrapper = make(view([CardName.BIG_ASTEROID]));
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.con-recv__backpile').exists()).to.be.true;
    expect(wrapper.find('.con-recv__stack').exists()).to.be.false;
    playedHeroState.revealed = true;
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-recv-front]').attributes('data-played-key')).to.eq(CardName.ASTEROID);
    wrapper.unmount();
  });

  it('a FOREIGN effect target brings its owner in as a prepared mini (prewarm, before anything moves)', async () => {
    armPlayedHero(CardName.LOCAL_HEAT_TRAPPING, true, {
      manualTableOpen: false, host: 'workspace',
      rewards: [{channel: 'card-resource', resource: 'animal', amount: 2, targetCard: CardName.BIRDS}],
    });
    playedHeroState.phase = 'preparing';
    const wrapper = make(view([], [{color: 'green' as Color, name: 'Соперник', tableau: [CardName.BIRDS]}]));
    await wrapper.vm.$nextTick();
    const foreign = wrapper.find('[data-recv-mini="active:green"]');
    expect(foreign.exists()).to.be.true;
    expect(foreign.find('.con-recv__mini-owner').text()).to.contain('Соперник');
    expect(foreign.find(`[data-recv-ministrip="active:green|${CardName.BIRDS}"]`).exists()).to.be.true;
    wrapper.unmount();
  });

  it('EMERGENCE: the target comes out of its strip into the fixed layer (one visual owner), and settles back', async () => {
    armPlayedHero(CardName.TREES, false, {manualTableOpen: false, host: 'workspace'});
    playedHeroState.phase = 'showing-result';
    playedHeroState.revealed = true;
    const wrapper = make(view([CardName.TARDIGRADES, CardName.BUSHES, CardName.TREES]));
    await wrapper.vm.$nextTick();
    // TARDIGRADES is an ACTIVE-family card → it lives in a mini here.
    const promise = wrapper.vm.emergeTarget(CardName.TARDIGRADES);
    await wrapper.vm.$nextTick();
    const emerged = wrapper.find('.con-recv__emerge');
    expect(emerged.exists()).to.be.true;
    expect(emerged.attributes('data-played-key')).to.eq(CardName.TARDIGRADES);
    // Its strip holds the geometry as a quiet footprint (never a collapse).
    expect(wrapper.find('.con-recv__face--away').exists()).to.be.true;
    await promise;
    await wrapper.vm.settleTarget(CardName.TARDIGRADES);
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.con-recv__emerge').exists()).to.be.false;
    expect(wrapper.find('.con-recv__face--away').exists()).to.be.false;
    wrapper.unmount();
  });

  it('the OPEN previous top needs no emergence — an accent marks it and releases', async () => {
    armPlayedHero(CardName.TREES, false, {manualTableOpen: false, host: 'workspace'});
    playedHeroState.phase = 'showing-result';
    playedHeroState.revealed = true;
    const wrapper = make(view([CardName.BUSHES, CardName.GRASS, CardName.TREES]));
    await wrapper.vm.$nextTick();
    const promise = wrapper.vm.emergeTarget(CardName.GRASS);
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.con-recv__emerge').exists()).to.be.false; // no layer — already open
    expect(wrapper.find('.con-recv__strip--accent').exists()).to.be.true;
    await promise;
    await wrapper.vm.settleTarget(CardName.GRASS);
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.con-recv__strip--accent').exists()).to.be.false;
    wrapper.unmount();
  });
});
